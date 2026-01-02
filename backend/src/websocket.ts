import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { AnalysisResult, TranscriptChunk } from './types/analysis.js';
import { GPTConversationAnalyzer } from './services/gptAnalyzer.js';

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
}

export class ConversationWebSocketServer {
  private wss: WebSocketServer;
  private sessions: Map<string, ClientSession> = new Map();
  private openaiApiKey: string;

  constructor(server: Server, openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    console.log(`WebSocket server attached to HTTP server`);
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

    console.log(`New session connected: ${sessionId}`);
  }

  private handleMessage(session: ClientSession, message: any) {
    switch (message.type) {
      case 'audio':
        // Handle audio data (future enhancement for direct audio processing)
        if (message.data) {
          console.log('Audio data received, length:', message.data.length);
        }
        break;

      case 'transcript':
        // Add transcript chunk
        if (message.text) {
          const speaker = message.speaker || 'unknown';
          const timestamp = Date.now();
          
          // Add to session transcript
          session.transcript.push({
            text: message.text,
            speaker,
            timestamp,
          });

          // Add to GPT analyzer
          session.gptAnalyzer.addTranscript(message.text, speaker);

          console.log(`[${session.sessionId}] ${speaker}: ${message.text}`);

          // FAST: reduced debounce from 1500ms to 800ms for quicker response
          const now = Date.now();
          const timeSinceLastAnalysis = now - (session.lastAnalysisTime || 0);
          
          if (message.isFinal !== false && timeSinceLastAnalysis > 800) {
            // Schedule analysis (non-blocking)
            console.log(`[${session.sessionId}] Scheduling analysis (time since last: ${timeSinceLastAnalysis}ms)`);
            this.scheduleAnalysis(session);
          }
        }
        break;

      case 'analyze':
        // Trigger immediate analysis (non-blocking)
        console.log(`[${session.sessionId}] Manual analysis requested`);
        this.scheduleAnalysis(session);
        break;

      case 'clear':
        // Clear conversation history
        session.transcript = [];
        session.gptAnalyzer.clearHistory();
        console.log(`[${session.sessionId}] Conversation cleared`);
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
      console.log(`[${session.sessionId}] Analysis already running, marked pending`);
      return;
    }
    
    // Start analysis (fire-and-forget, non-blocking)
    session.isAnalyzing = true;
    session.pendingAnalysis = false;
    
    this.analyzeAndSend(session).finally(() => {
      session.isAnalyzing = false;
      
      // If a new analysis was requested while we were busy, run it now
      if (session.pendingAnalysis) {
        console.log(`[${session.sessionId}] Running pending analysis`);
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
      
      console.log(`[${session.sessionId}] Starting progressive analysis (run ${runId})...`);
      
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

      // Analyze with progressive callbacks
      await session.gptAnalyzer.analyzeProgressive(sendPartial);
      
      console.log(`[${session.sessionId}] Progressive analysis completed (run ${runId})`);
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
      this.sessions.delete(sessionId);
      console.log(`Session cleaned up: ${sessionId}`);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  close() {
    this.wss.close();
  }
}
