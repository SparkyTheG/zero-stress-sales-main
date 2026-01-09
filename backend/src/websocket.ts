import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { AnalysisResult, TranscriptChunk } from './types/analysis.js';
import { GPTConversationAnalyzer } from './services/gptAnalyzer.js';
import { verifySupabaseAccessToken } from './services/supabaseTranscriptStore.js';
import { getTranscriptAnalyzerAgent, TranscriptAnalyzerAgent } from './services/transcriptAnalyzerAgent.js';
import { createRealtimeConnection } from './services/elevenLabsScribe.js';

interface AdminSettings {
  pillarWeights?: { id: string; weight: number }[];
  priceTiers?: { label: string; price: number }[];
  customScriptPrompt?: string;
}

interface ClientSession {
  ws: WebSocket;
  sessionId: string;
  transcript: TranscriptChunk[];
  gptAnalyzer: GPTConversationAnalyzer;
  analysisInterval?: NodeJS.Timeout;
  lastAnalysisTime?: number;
  // Performance: prevent overlapping analysis runs
  isAnalyzing: boolean;
  pendingAnalysis: boolean;
  // Monotonic run ID so frontend can ignore stale updates
  currentRunId: number;
  // Admin settings from frontend
  adminSettings?: AdminSettings;

  // Auth info (for AI agent transcript persistence)
  authUserId?: string;
  authEmail?: string;

  // ElevenLabs Scribe realtime connection
  elevenLabsConnection?: any;
}

export class ConversationWebSocketServer {
  private wss: WebSocketServer;
  private sessions: Map<string, ClientSession> = new Map();
  private openaiApiKey: string;
  private transcriptAgent: TranscriptAnalyzerAgent;
  private static readonly DEBUG = process.env.DEBUG_LOGS === '1';
  private static readonly MAX_SESSION_CHUNKS = 250; // cap memory per session

  constructor(server: Server, openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
    this.transcriptAgent = getTranscriptAnalyzerAgent(openaiApiKey);
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    if (ConversationWebSocketServer.DEBUG) console.log(`WebSocket server attached to HTTP server`);
  }

  private async handleConnection(ws: WebSocket) {
    const sessionId = this.generateSessionId();
    const session: ClientSession = {
      ws,
      sessionId,
      transcript: [],
      gptAnalyzer: new GPTConversationAnalyzer(this.openaiApiKey),
      isAnalyzing: false,
      pendingAnalysis: false,
      currentRunId: 0,
    };

    // Initialize ElevenLabs Scribe connection for audio
    try {
      session.elevenLabsConnection = await createRealtimeConnection({
        onTranscript: async (history: string) => {
          // Trigger analysis on committed transcripts
          if (session.transcript.length > 0 || history.length > 0) {
            this.scheduleAnalysis(session);
          }
        },
        onChunk: (text: string) => {
          // Send transcript chunk to frontend for display
          this.sendIfOpen(session.ws, {
            type: 'transcript_chunk',
            text,
          });
        },
        onError: (error: Error) => {
          console.error('[ElevenLabs] Error:', error);
          this.sendIfOpen(session.ws, {
            type: 'error',
            error: error.message,
          });
        },
      });
      if (ConversationWebSocketServer.DEBUG) console.log(`[${sessionId}] ElevenLabs connection initialized`);
    } catch (error) {
      console.error('[ElevenLabs] Failed to initialize:', error);
    }

    this.sessions.set(sessionId, session);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        // NON-BLOCKING: don't await - let message handling continue immediately
        this.handleMessage(session, message);
      } catch (error) {
        console.error('Error handling message:', error);
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      this.cleanupSession(sessionId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.cleanupSession(sessionId);
    });

    // Send session ID to client
    ws.send(JSON.stringify({
      type: 'session',
      sessionId,
    }));

    if (ConversationWebSocketServer.DEBUG) console.log(`New session connected: ${sessionId}`);
  }

  private handleMessage(session: ClientSession, message: any) {
    switch (message.type) {
      case 'auth':
        // Authenticate this websocket for Supabase transcript persistence
        // Fire-and-forget; do not block message processing
        this.handleAuth(session, message?.accessToken).catch((err) => {
          if (ConversationWebSocketServer.DEBUG) console.warn(`[${session.sessionId}] auth failed:`, err?.message || err);
          this.sendIfOpen(session.ws, { type: 'auth_error', error: 'Authentication failed' });
        });
        break;

      case 'audio':
        // Handle audio data from ElevenLabs Scribe
        if (message.data && session.elevenLabsConnection) {
          // Convert base64 audio data to Buffer
          const audioBuffer = Buffer.from(message.data, 'base64');
          if (ConversationWebSocketServer.DEBUG) console.log(`[${session.sessionId}] Audio data received, bytes:`, audioBuffer.length);
          
          // Send audio to ElevenLabs Scribe (non-blocking)
          session.elevenLabsConnection.sendAudio(audioBuffer).catch((err: Error) => {
            console.error(`[${session.sessionId}] Audio processing error:`, err);
          });
        }
        break;

      case 'transcript':
        // Add transcript chunk
        if (message.text) {
          const speaker = message.speaker || 'unknown';
          const timestamp = Date.now();
          const isFinal = message.isFinal !== false;
          
          // Update admin settings if provided
          if (message.settings) {
            session.adminSettings = message.settings;
          }
        
          // Only store + analyze FINAL transcript chunks to avoid partial spam like:
          // "it's kind", "it's kind of", "it's kind of expensive"
          if (isFinal) {
            // Add to session transcript
            session.transcript.push({
              text: message.text,
              speaker,
              timestamp,
            });
            // Cap transcript to avoid memory growth over long testing sessions
            if (session.transcript.length > ConversationWebSocketServer.MAX_SESSION_CHUNKS) {
              session.transcript.splice(0, session.transcript.length - ConversationWebSocketServer.MAX_SESSION_CHUNKS);
            }

            // Add to GPT analyzer
            session.gptAnalyzer.addTranscript(message.text, speaker);

            // Use AI agent to analyze speaker and persist to Supabase (only for authenticated users)
            if (session.authUserId) {
              this.transcriptAgent.analyzeAndPersist(session.sessionId, message.text, speaker)
                .then((result) => {
                  if (result && ConversationWebSocketServer.DEBUG) {
                    console.log(`[${session.sessionId}] AI detected speaker: ${result.speaker}`);
                  }
                })
                .catch((err) => {
                  if (ConversationWebSocketServer.DEBUG) console.warn(`[${session.sessionId}] AI analysis failed:`, err);
                });
            }

            if (ConversationWebSocketServer.DEBUG) console.log(`[${session.sessionId}] ${speaker}: ${message.text}`);
          }

          // FAST: reduced debounce from 1500ms to 800ms for quicker response
          const now = Date.now();
          const timeSinceLastAnalysis = now - (session.lastAnalysisTime || 0);
          
          if (isFinal && timeSinceLastAnalysis > 300) {
            // Schedule analysis (non-blocking)
            if (ConversationWebSocketServer.DEBUG) console.log(`[${session.sessionId}] Scheduling analysis (time since last: ${timeSinceLastAnalysis}ms)`);
            this.scheduleAnalysis(session);
          }
        }
        break;

      case 'settings':
        // Update admin settings
        if (message.settings) {
          session.adminSettings = message.settings;
          if (ConversationWebSocketServer.DEBUG) console.log(`[${session.sessionId}] Admin settings updated`);
        }
        break;

      case 'analyze':
        // Trigger immediate analysis (non-blocking)
        if (message.settings) {
          session.adminSettings = message.settings;
        }
        if (ConversationWebSocketServer.DEBUG) console.log(`[${session.sessionId}] Manual analysis requested`);
        this.scheduleAnalysis(session);
        break;

      case 'clear':
        // Clear conversation history
        session.transcript = [];
        session.gptAnalyzer.clearHistory();
        if (ConversationWebSocketServer.DEBUG) console.log(`[${session.sessionId}] Conversation cleared`);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  // NON-BLOCKING analysis scheduler with overlap prevention
  private scheduleAnalysis(session: ClientSession) {
    // If already analyzing, mark pending and return immediately
    if (session.isAnalyzing) {
      session.pendingAnalysis = true;
      if (ConversationWebSocketServer.DEBUG) console.log(`[${session.sessionId}] Analysis already running, marked pending`);
      return;
    }
    
    // Start analysis (fire-and-forget, non-blocking)
    session.isAnalyzing = true;
    session.pendingAnalysis = false;
    
    this.analyzeAndSend(session).finally(() => {
      session.isAnalyzing = false;
      
      // If a new analysis was requested while we were busy, run it now
      if (session.pendingAnalysis) {
        if (ConversationWebSocketServer.DEBUG) console.log(`[${session.sessionId}] Running pending analysis`);
        this.scheduleAnalysis(session);
      }
    });
  }

  private async analyzeAndSend(session: ClientSession) {
    try {
      session.lastAnalysisTime = Date.now();
      // Increment run ID for this analysis cycle
      session.currentRunId++;
      const runId = session.currentRunId;
      
      if (ConversationWebSocketServer.DEBUG) console.log(`[${session.sessionId}] Starting progressive analysis (run ${runId})...`);
      
      // Send updates progressively as they become available - include runId for stale detection
      const sendPartial = (type: string, data: any) => {
        if (session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({
            type,
            data,
            runId, // Frontend uses this to ignore stale updates
          }));
        }
      };

      // Analyze with progressive callbacks, passing admin settings
      await session.gptAnalyzer.analyzeProgressive(sendPartial, session.adminSettings);
      
      if (ConversationWebSocketServer.DEBUG) console.log(`[${session.sessionId}] Progressive analysis completed (run ${runId})`);
    } catch (error) {
      console.error('Error analyzing conversation:', error);
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({
          type: 'error',
          error: 'Analysis failed',
        }));
      }
    }
  }

  private cleanupSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Close ElevenLabs connection
      if (session.elevenLabsConnection) {
        try {
          session.elevenLabsConnection.close();
          if (ConversationWebSocketServer.DEBUG) console.log(`[${sessionId}] ElevenLabs connection closed`);
        } catch (error) {
          console.error(`[${sessionId}] Error closing ElevenLabs connection:`, error);
        }
      }

      if (session.analysisInterval) {
        clearInterval(session.analysisInterval);
      }

      // End AI agent session (flushes buffer and marks call session ended)
      this.transcriptAgent.endSession(sessionId).catch(() => {});
      this.sessions.delete(sessionId);
      if (ConversationWebSocketServer.DEBUG) console.log(`Session cleaned up: ${sessionId}`);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  close() {
    this.wss.close();
  }

  private sendIfOpen(ws: WebSocket, payload: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  private async handleAuth(session: ClientSession, accessToken: unknown) {
    const token = typeof accessToken === 'string' ? accessToken.trim() : '';
    if (!token) {
      // Treat empty token as logout / no persistence
      session.authUserId = undefined;
      session.authEmail = undefined;
      // End any existing AI agent session
      this.transcriptAgent.endSession(session.sessionId).catch(() => {});
      this.sendIfOpen(session.ws, { type: 'auth_ok', userId: null });
      return;
    }

    const { userId, email } = await verifySupabaseAccessToken(token);
    session.authUserId = userId;
    session.authEmail = email;
    
    // Initialize AI agent session for transcript analysis and persistence
    this.transcriptAgent.initSession(session.sessionId, userId, email);
    
    // Send call session ID to frontend if available
    const callSessionId = this.transcriptAgent.getCallSessionId(session.sessionId);
    this.sendIfOpen(session.ws, { type: 'auth_ok', userId, callSessionId });
  }

}
