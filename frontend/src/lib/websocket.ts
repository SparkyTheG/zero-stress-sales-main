import type { AnalysisResult } from '../types';

export interface WebSocketMessage {
  type: 'session' | 'analysis' | 'analysis_partial' | 'analysis_scripts' | 'error';
  sessionId?: string;
  data?: AnalysisResult | any;
  error?: string;
}

export class AnalysisWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private onAnalysisCallback?: (data: AnalysisResult) => void;
  private onPartialUpdateCallback?: (type: string, data: any) => void;
  private onErrorCallback?: (error: Error) => void;

  constructor(private url: string = 'ws://localhost:3001') {}

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
              if (message.data && this.onPartialUpdateCallback) {
                this.onPartialUpdateCallback('partial', message.data);
              }
              break;

            case 'analysis_scripts':
              if (message.data && this.onPartialUpdateCallback) {
                this.onPartialUpdateCallback('scripts', message.data);
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

  sendTranscript(text: string, speaker: 'closer' | 'prospect' | 'unknown' = 'unknown', isFinal: boolean = true) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'transcript',
        text,
        speaker,
        isFinal,
      }));
    }
  }

  sendAnalyzeRequest() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'analyze',
      }));
    }
  }

  onAnalysis(callback: (data: AnalysisResult) => void) {
    this.onAnalysisCallback = callback;
  }

  onPartialUpdate(callback: (type: string, data: any) => void) {
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

