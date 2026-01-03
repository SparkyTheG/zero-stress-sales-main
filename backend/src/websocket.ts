import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { AnalysisResult, TranscriptChunk } from './types/analysis.js';
import { GPTConversationAnalyzer } from './services/gptAnalyzer.js';
import { randomUUID } from 'crypto';
import {
  createCallSession,
  endCallSession,
  insertTranscriptChunks,
  verifySupabaseAccessToken,
  type TranscriptChunkRow,
} from './services/supabaseTranscriptStore.js';

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

  // Supabase persistence (only when authenticated)
  authUserId?: string;
  supabaseCallSessionId?: string;
  transcriptSeq: number;
  transcriptBuffer: TranscriptChunkRow[];
  flushTimer?: NodeJS.Timeout;
}

export class ConversationWebSocketServer {
  private wss: WebSocketServer;
  private sessions: Map<string, ClientSession> = new Map();
  private openaiApiKey: string;
  private static readonly DEBUG = process.env.DEBUG_LOGS === '1';
  private static readonly MAX_SESSION_CHUNKS = 250; // cap memory per session
  private static readonly TRANSCRIPT_FLUSH_MS = 750; // batch DB writes
  private static readonly TRANSCRIPT_FLUSH_MAX_ROWS = 5; // flush early if buffer grows

  constructor(server: Server, openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    if (ConversationWebSocketServer.DEBUG) console.log(`WebSocket server attached to HTTP server`);
  }

  private handleConnection(ws: WebSocket) {
    const sessionId = this.generateSessionId();
    const session: ClientSession = {
      ws,
      sessionId,
      transcript: [],
      gptAnalyzer: new GPTConversationAnalyzer(this.openaiApiKey),
      isAnalyzing: false,
      pendingAnalysis: false,
      currentRunId: 0,
      transcriptSeq: 0,
      transcriptBuffer: [],
    };

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
        // Handle audio data (future enhancement for direct audio processing)
        if (message.data) {
          if (ConversationWebSocketServer.DEBUG) console.log('Audio data received, length:', message.data.length);
        }
        break;

      case 'transcript':
        // Add transcript chunk
        if (message.text) {
          const speaker = message.speaker || 'unknown';
          const timestamp = Date.now();
          
          // Update admin settings if provided
          if (message.settings) {
            session.adminSettings = message.settings;
          }
          
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

          // Stream transcript to Supabase (only for authenticated users)
          this.enqueueTranscriptPersist(session, message.text, speaker);

          if (ConversationWebSocketServer.DEBUG) console.log(`[${session.sessionId}] ${speaker}: ${message.text}`);

          // FAST: reduced debounce from 1500ms to 800ms for quicker response
          const now = Date.now();
          const timeSinceLastAnalysis = now - (session.lastAnalysisTime || 0);
          
          if (message.isFinal !== false && timeSinceLastAnalysis > 800) {
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
      if (session.analysisInterval) {
        clearInterval(session.analysisInterval);
      }
      if (session.flushTimer) {
        clearTimeout(session.flushTimer);
        session.flushTimer = undefined;
      }

      // Best-effort: flush any remaining chunks and mark session ended
      this.flushTranscriptBuffer(session, true).catch(() => {});
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
      session.supabaseCallSessionId = undefined;
      session.transcriptBuffer = [];
      session.transcriptSeq = 0;
      this.sendIfOpen(session.ws, { type: 'auth_ok', userId: null });
      return;
    }

    const { userId } = await verifySupabaseAccessToken(token);
    session.authUserId = userId;
    this.sendIfOpen(session.ws, { type: 'auth_ok', userId });
  }

  private enqueueTranscriptPersist(session: ClientSession, text: string, speaker: string) {
    if (!session.authUserId) return; // only logged-in users

    // Lazy-create call session on first chunk
    if (!session.supabaseCallSessionId) {
      const callId = randomUUID();
      session.supabaseCallSessionId = callId;
      // Best-effort create; if it fails we'll keep trying on subsequent chunks
      createCallSession({ id: callId, userId: session.authUserId, meta: { ws_session_id: session.sessionId } })
        .then(() => this.sendIfOpen(session.ws, { type: 'call_session', callSessionId: callId }))
        .catch((err) => {
          if (ConversationWebSocketServer.DEBUG) console.warn(`[${session.sessionId}] createCallSession failed:`, err?.message || err);
          // allow retry: clear id so next enqueue attempts again
          session.supabaseCallSessionId = undefined;
        });
    }

    const callSessionId = session.supabaseCallSessionId;
    if (!callSessionId) return;

    session.transcriptSeq += 1;
    session.transcriptBuffer.push({
      session_id: callSessionId,
      user_id: session.authUserId,
      seq: session.transcriptSeq,
      speaker: String(speaker || 'unknown'),
      text: String(text || ''),
    });

    // Flush soon, batched
    if (session.transcriptBuffer.length >= ConversationWebSocketServer.TRANSCRIPT_FLUSH_MAX_ROWS) {
      void this.flushTranscriptBuffer(session);
      return;
    }

    if (!session.flushTimer) {
      session.flushTimer = setTimeout(() => {
        session.flushTimer = undefined;
        void this.flushTranscriptBuffer(session);
      }, ConversationWebSocketServer.TRANSCRIPT_FLUSH_MS);
    }
  }

  private async flushTranscriptBuffer(session: ClientSession, endSession: boolean = false) {
    if (!session.authUserId || !session.supabaseCallSessionId) return;
    if (session.transcriptBuffer.length === 0 && !endSession) return;

    const rows = session.transcriptBuffer.splice(0, session.transcriptBuffer.length);
    try {
      if (rows.length > 0) {
        await insertTranscriptChunks(rows);
      }
      if (endSession) {
        await endCallSession({ id: session.supabaseCallSessionId });
      }
    } catch (err) {
      // Re-queue rows for retry (idempotent on conflict)
      if (rows.length > 0) {
        session.transcriptBuffer.unshift(...rows);
      }
      if (ConversationWebSocketServer.DEBUG) {
        console.warn(`[${session.sessionId}] flushTranscriptBuffer failed:`, (err as any)?.message || err);
      }
    }
  }
}
