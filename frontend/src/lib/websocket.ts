import type { AnalysisResult } from '../types';

export interface WebSocketMessage {
  type: 'session' | 'analysis' | 'analysis_partial' | 'analysis_scripts' | 'error';
  sessionId?: string;
  data?: AnalysisResult | any;
  error?: string;
  runId?: number; // For stale update detection
}

// Get WebSocket URL dynamically based on current location
function getDefaultWebSocketUrl(): string {
  // Check for environment variable first (for development)
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl) {
    return envUrl;
  }
  
  // For local development
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    
    // If running on localhost, use port 3001 for backend
    if (host === 'localhost' || host === '127.0.0.1') {
      return `ws://${host}:3001`;
    }
    
    // For production deployment, use same host with /ws path or port 3001
    // Adjust this based on your deployment setup
    return `${protocol}//${host}:3001`;
  }
  
  return 'ws://localhost:3001';
}

export class AnalysisWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private onAnalysisCallback?: (data: AnalysisResult) => void;
  private onPartialUpdateCallback?: (type: string, data: any, runId?: number) => void;
  private onErrorCallback?: (error: Error) => void;
  // Track latest run ID to ignore stale updates
  private latestRunId = 0;

  constructor(private url: string = getDefaultWebSocketUrl()) {
    console.log('WebSocket URL:', this.url);
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Track latest run ID and ignore stale updates
          const runId = message.runId;
          if (runId !== undefined && runId > this.latestRunId) {
            this.latestRunId = runId;
          }
          
          switch (message.type) {
            case 'session':
              this.sessionId = message.sessionId || null;
              console.log('Session ID:', this.sessionId);
              break;
            
            case 'analysis':
              if (message.data && this.onAnalysisCallback) {
                this.onAnalysisCallback(message.data);
              }
              break;
            
            case 'analysis_partial':
              // FAST: Skip stale updates from older runs
              if (runId !== undefined && runId < this.latestRunId) {
                console.log(`[WS] Ignoring stale partial update (run ${runId} < latest ${this.latestRunId})`);
                break;
              }
              if (message.data && this.onPartialUpdateCallback) {
                this.onPartialUpdateCallback('partial', message.data, runId);
              }
              break;

            case 'analysis_scripts':
              // FAST: Skip stale script updates from older runs
              if (runId !== undefined && runId < this.latestRunId) {
                console.log(`[WS] Ignoring stale scripts update (run ${runId} < latest ${this.latestRunId})`);
                break;
              }
              if (message.data && this.onPartialUpdateCallback) {
                this.onPartialUpdateCallback('scripts', message.data, runId);
              }
              break;
            
            case 'error':
              if (this.onErrorCallback) {
                this.onErrorCallback(new Error(message.error || 'Unknown error'));
              }
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback(new Error('WebSocket connection error'));
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error as Error);
      }
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  sendTranscript(text: string, speaker: 'closer' | 'prospect' | 'unknown' = 'unknown', isFinal: boolean = true, settings?: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'transcript',
        text,
        speaker,
        isFinal,
        settings, // Pass admin settings to backend
      }));
    }
  }

  sendSettings(settings: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'settings',
        settings,
      }));
    }
  }

  sendAnalyzeRequest(settings?: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'analyze',
        settings,
      }));
    }
  }

  onAnalysis(callback: (data: AnalysisResult) => void) {
    this.onAnalysisCallback = callback;
  }

  onPartialUpdate(callback: (type: string, data: any, runId?: number) => void) {
    this.onPartialUpdateCallback = callback;
  }

  onError(callback: (error: Error) => void) {
    this.onErrorCallback = callback;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

let wsInstance: AnalysisWebSocket | null = null;

export function getWebSocketClient(url?: string): AnalysisWebSocket {
  if (!wsInstance) {
    wsInstance = new AnalysisWebSocket(url);
  }
  return wsInstance;
}

