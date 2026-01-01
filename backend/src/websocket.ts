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
    };

    this.sessions.set(sessionId, session);

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(session, message);
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

  private async handleMessage(session: ClientSession, message: any) {
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

          // Auto-analyze if this is a final transcript and enough time has passed
          // Reduced from 3000ms to 1500ms for faster response
          const now = Date.now();
          const timeSinceLastAnalysis = now - (session.lastAnalysisTime || 0);
          
          if (message.isFinal !== false && timeSinceLastAnalysis > 1500) {
            // Analyze after 1.5 seconds of the last analysis (reduced for faster response)
            console.log(`[${session.sessionId}] Triggering analysis (time since last: ${timeSinceLastAnalysis}ms)`);
            await this.analyzeAndSend(session);
          }
        }
        break;

      case 'analyze':
        // Trigger immediate analysis
        console.log(`[${session.sessionId}] Manual analysis requested`);
        await this.analyzeAndSend(session);
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

  private async analyzeAndSend(session: ClientSession) {
    try {
      session.lastAnalysisTime = Date.now();
      
      console.log(`[${session.sessionId}] Starting progressive analysis...`);
      
      // Send updates progressively as they become available
      const sendPartial = (type: string, data: any) => {
        if (session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({
            type,
            data,
          }));
        }
      };

      // Analyze with progressive callbacks
      await session.gptAnalyzer.analyzeProgressive(sendPartial);
      
      console.log(`[${session.sessionId}] Progressive analysis completed`);
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
