import OpenAI from 'openai';
import type { TranscriptChunk } from '../types/analysis.js';

export class AudioService {
  private openai: OpenAI;
  private sessions: Map<string, TranscriptChunk[]> = new Map();

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async processAudioStream(
    sessionId: string,
    audioBuffer: Buffer
  ): Promise<TranscriptChunk[]> {
    // For real-time processing, we'll use OpenAI's Whisper API
    // In production, you'd use the Realtime API for streaming
    
    try {
      // Audio transcription would be implemented here using OpenAI Whisper API
      // For production: use OpenAI Realtime API for streaming transcription
      // For now, the system accepts text transcripts directly via addTranscript()
      
      // Example implementation (commented out):
      // const transcription = await this.openai.audio.transcriptions.create({
      //   file: audioBuffer as any,
      //   model: 'whisper-1',
      //   response_format: 'verbose_json',
      // });
      
      return [];
    } catch (error) {
      console.error('Error processing audio:', error);
      throw error;
    }
  }

  // Process text directly (for testing or when audio is already transcribed)
  addTranscript(sessionId: string, text: string, speaker: 'closer' | 'prospect' | 'unknown' = 'unknown'): TranscriptChunk[] {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }

    const chunk: TranscriptChunk = {
      timestamp: Date.now(),
      speaker,
      text,
    };

    this.sessions.get(sessionId)!.push(chunk);
    return this.sessions.get(sessionId)!;
  }

  getTranscript(sessionId: string): TranscriptChunk[] {
    return this.sessions.get(sessionId) || [];
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // For real-time streaming with Realtime API
  async createRealtimeConnection(sessionId: string): Promise<void> {
    // This would establish a WebSocket connection to OpenAI Realtime API
    // For now, we'll use a simpler approach with Whisper API
    // In production, implement full Realtime API WebSocket connection
    
    console.log(`Creating realtime connection for session ${sessionId}`);
  }
}

let audioServiceInstance: AudioService | null = null;

export function getAudioService(apiKey?: string): AudioService {
  if (!audioServiceInstance && apiKey) {
    audioServiceInstance = new AudioService(apiKey);
  }
  if (!audioServiceInstance) {
    throw new Error('AudioService not initialized. Please provide API key.');
  }
  return audioServiceInstance;
}

