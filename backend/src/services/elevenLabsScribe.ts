import { WebSocket as WS, OPEN, type Data } from 'ws';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'scribe_v2_realtime';

// Use VAD commit strategy - Scribe commits on natural pauses in speech
const ELEVENLABS_URL =
  `wss://api.elevenlabs.io/v1/speech-to-text/realtime?` +
  `model_id=${encodeURIComponent(ELEVENLABS_MODEL_ID)}` +
  `&language_code=en` +
  `&audio_format=pcm_16000` +
  `&commit_strategy=vad` +
  `&vad_silence_threshold_secs=0.3` +
  `&vad_threshold=0.25`;

export interface ScribeTranscriptCallback {
  (text: string, isCommitted: boolean): void;
}

export interface ScribeErrorCallback {
  (error: Error): void;
}

export class ElevenLabsScribeRealtime {
  private ws: WS | null = null;
  private connected = false;
  private closed = false;
  private lastCommitted = '';
  private lastPartial = '';
  private sentFirstChunk = false;
  private onError?: ScribeErrorCallback;
  private onTranscript?: ScribeTranscriptCallback;

  constructor(options: { onError?: ScribeErrorCallback; onTranscript?: ScribeTranscriptCallback } = {}) {
    this.onError = options.onError;
    this.onTranscript = options.onTranscript;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.closed) throw new Error('Scribe session closed');
    if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY missing');

    console.log('[ElevenLabs] Connecting Scribe WS', { model: ELEVENLABS_MODEL_ID });

    this.ws = new WS(ELEVENLABS_URL, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    });

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('ElevenLabs connect timeout')), 15000);
      
      this.ws!.on('open', () => {
        clearTimeout(t);
        this.connected = true;
        this.sentFirstChunk = false;
        console.log('[ElevenLabs] Scribe WS open', { model: ELEVENLABS_MODEL_ID });
        resolve();
      });

      this.ws!.on('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
    });

    this.ws!.on('message', (raw) => this.onMessage(raw));
    
    this.ws!.on('close', (code, reason) => {
      this.connected = false;
      const reasonStr = Buffer.isBuffer(reason) ? reason.toString('utf8') : String(reason || '');
      console.log('[ElevenLabs] Scribe WS closed', { code, reason: reasonStr.slice(0, 200) });
      this.ws = null;
    });

    this.ws!.on('error', (err) => {
      this.connected = false;
      this.ws = null;
      console.log('[ElevenLabs] Scribe WS error', { msg: err?.message || String(err) });
      if (this.onError) this.onError(err);
    });
  }

  close(): void {
    this.closed = true;
    this.connected = false;
    try {
      this.ws?.close();
    } catch {}
  }

  private onMessage(raw: Data): void {
    let msg: any;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    const t = String(msg?.message_type || '');
    
    console.log('[ElevenLabs] Message', {
      type: t,
      hasText: !!msg?.text,
      textLen: msg?.text?.length || 0,
      textPreview: msg?.text?.slice?.(0, 50) || '(none)',
    });

    if (t === 'partial_transcript') {
      const text = String(msg?.text || '').trim();
      if (text) {
        this.lastPartial = text;
        if (this.onTranscript) {
          this.onTranscript(text, false); // false = not committed
        }
      }
      return;
    }

    if (
      t === 'committed_transcript' ||
      t === 'committed_transcript_with_timestamps' ||
      t === 'final_transcript' ||
      t === 'final_transcript_with_timestamps'
    ) {
      const text = String(msg?.text || '').trim();
      if (!text) return;

      // Dedup common repeats
      if (text === this.lastCommitted) return;
      this.lastCommitted = text;
      this.lastPartial = '';

      console.log('[ElevenLabs] Committed transcript', { len: text.length, preview: text.slice(0, 80) });

      if (this.onTranscript) {
        this.onTranscript(text, true); // true = committed
      }
      return;
    }

    // Surface auth/quota/etc errors
    const tl = t.toLowerCase();
    if (tl.includes('error')) {
      const errMsg = String(msg?.message || msg?.error || t);
      console.log('[ElevenLabs] Scribe error msg', { msgType: t, errMsg: String(errMsg).slice(0, 140) });
      if (this.onError) this.onError(new Error(errMsg));
    }
  }

  async sendPcmChunk(pcmBuffer: Buffer): Promise<string> {
    // If we were disconnected, reconnect
    if (!this.connected) {
      if (this.closed) {
        console.log('[ElevenLabs] Session permanently closed, not reconnecting');
        return '';
      }
      console.log('[ElevenLabs] Disconnected, attempting reconnect...');
      try {
        await this.connect();
        console.log('[ElevenLabs] Reconnected successfully');
      } catch (e) {
        console.log('[ElevenLabs] Reconnect failed', { err: (e as Error)?.message });
        return '';
      }
    }

    if (!this.ws || this.ws.readyState !== OPEN) {
      console.log('[ElevenLabs] WS not open after connect', { wsState: this.ws?.readyState, closed: this.closed });
      return '';
    }

    // Reset partial before sending
    this.lastPartial = '';

    const payload = {
      message_type: 'input_audio_chunk',
      audio_base_64: Buffer.from(pcmBuffer).toString('base64'),
      sample_rate: 16000,
    };

    this.sentFirstChunk = true;

    try {
      this.ws.send(JSON.stringify(payload));
    } catch (e) {
      console.log('[ElevenLabs] WS send failed', { err: (e as Error)?.message || String(e) });
      return '';
    }

    // Give a short wait for partial to arrive, then return whatever we have
    await new Promise((r) => setTimeout(r, 150));
    return this.lastPartial || '';
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Hallucination detection
function looksLikeHallucination(text: string): boolean {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return true;
  
  const badPhrases = [
    'thank you for watching',
    'thanks for watching',
    'like and subscribe',
    'subscribe to my channel',
    'hit the bell',
    'music',
    'applause',
    'disclaimer',
    'fema.gov',
    'for more information visit',
  ];
  
  if (badPhrases.some((p) => t.includes(p))) return true;
  if (t.includes('http://') || t.includes('https://') || t.includes('www.')) return true;
  return false;
}

function sanitizeTranscript(text: string): string {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  
  const cutMarkers = [
    ' disclaimer',
    'disclaimer',
    'http://',
    'https://',
    'www.',
    'fema.gov',
    'sites.google.com',
    'for more information',
  ];
  
  let cutAt = -1;
  for (const m of cutMarkers) {
    const idx = lower.indexOf(m);
    if (idx !== -1 && (cutAt === -1 || idx < cutAt)) cutAt = idx;
  }
  
  const trimmed = (cutAt === -1 ? raw : raw.slice(0, cutAt)).trim();
  if (trimmed.split(/\s+/).filter(Boolean).length < 1) return '';
  return trimmed;
}

export interface RealtimeConnectionOptions {
  onTranscript?: (history: string) => Promise<void>;
  onChunk?: (text: string) => void;
  onError?: (error: Error) => void;
}

export async function createRealtimeConnection(options: RealtimeConnectionOptions) {
  const { onTranscript, onChunk, onError } = options;
  
  let conversationHistory = '';
  let isConnected = true;
  const MAX_HISTORY_CHARS = Number(process.env.MAX_TRANSCRIPT_CHARS || 8000);
  const AUDIO_FLUSH_INTERVAL_MS = Number(process.env.AUDIO_MIN_INTERVAL_MS || 250);
  const AUDIO_MAX_PENDING_MS = Number(process.env.AUDIO_MAX_PENDING_MS || 600);
  const AUDIO_MAX_PENDING_BYTES = Number(process.env.AUDIO_MAX_PENDING_BYTES || 16000 * 2 * 1); // 1s of PCM16@16k
  
  let lastAudioFlushMs = 0;
  let audioChunkCount = 0;
  let pendingPcm: Buffer = Buffer.alloc(0);

  // Handler for committed transcripts from Scribe
  const handleScribeTranscript = (text: string, isCommitted: boolean) => {
    if (!text || !isCommitted) return; // Only process committed transcripts

    const trimmed = String(text).trim();
    if (!trimmed) return;
    if (looksLikeHallucination(trimmed)) {
      console.log('[Scribe] Rejected hallucination', { preview: trimmed.slice(0, 60) });
      return;
    }
    
    const cleaned = sanitizeTranscript(trimmed);
    if (!cleaned) return;
    if (looksLikeHallucination(cleaned)) return;

    console.log('[Scribe] Accepted', { len: cleaned.length, preview: cleaned.slice(0, 80) });

    // Send chunk to frontend for display
    if (onChunk && isConnected) {
      try {
        onChunk(cleaned);
      } catch (e) {
        console.error('[Scribe] onChunk error:', e);
      }
    }

    // Add to conversation history
    conversationHistory += cleaned + ' ';
    if (conversationHistory.length > MAX_HISTORY_CHARS) {
      conversationHistory = conversationHistory.slice(conversationHistory.length - MAX_HISTORY_CHARS);
    }

    // Trigger analysis on committed transcripts
    if (onTranscript && isConnected) {
      onTranscript(conversationHistory).catch((err) => {
        console.error('[Scribe] Analysis error:', err);
      });
    }
  };

  const scribe = new ElevenLabsScribeRealtime({
    onError,
    onTranscript: handleScribeTranscript,
  });

  try {
    await scribe.connect();

    const connection = {
      sendAudio: async (audioData: Buffer | Uint8Array): Promise<{ text: string; error?: string }> => {
        const chunkNum = ++audioChunkCount;
        console.log(`[Audio] Chunk #${chunkNum}`, {
          bytes: audioData?.length || (audioData as any)?.byteLength || 0,
          scribeConnected: scribe.isConnected(),
        });

        try {
          const now = Date.now();
          const buf = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData || []);
          pendingPcm = (pendingPcm.length ? Buffer.concat([pendingPcm, buf]) : buf) as any;

          const pendingAgeMs = lastAudioFlushMs ? now - lastAudioFlushMs : 0;
          const shouldFlush =
            !lastAudioFlushMs ||
            now - lastAudioFlushMs >= AUDIO_FLUSH_INTERVAL_MS ||
            pendingPcm.length >= AUDIO_MAX_PENDING_BYTES ||
            pendingAgeMs >= AUDIO_MAX_PENDING_MS;

          if (!shouldFlush) {
            return { text: '' };
          }

          const pcmToSend = pendingPcm;
          pendingPcm = Buffer.alloc(0);
          lastAudioFlushMs = now;
          
          console.log('[Audio] Flushing to Scribe', {
            bytes: pcmToSend.length,
            flushIntervalMs: AUDIO_FLUSH_INTERVAL_MS,
          });

          const text = await scribe.sendPcmChunk(pcmToSend);
          const trimmed = String(text || '').trim();
          
          console.log(`[Audio] Scribe returned for chunk #${chunkNum}`, {
            textLen: trimmed.length,
            preview: trimmed.slice(0, 60) || '(empty)',
          });

          if (!trimmed) return { text: '' };
          if (looksLikeHallucination(trimmed)) {
            console.log(`[Audio] Rejected hallucination chunk #${chunkNum}`, { preview: trimmed.slice(0, 60) });
            return { text: '' };
          }

          const cleaned = sanitizeTranscript(trimmed);
          if (!cleaned) {
            console.log(`[Audio] Sanitized to empty chunk #${chunkNum}`, { before: trimmed.slice(0, 60) });
            return { text: '' };
          }

          if (looksLikeHallucination(cleaned)) {
            console.log(`[Audio] Post-sanitize hallucination chunk #${chunkNum}`, { cleaned: cleaned.slice(0, 60) });
            return { text: '' };
          }

          console.log(`[Audio] Accepted chunk #${chunkNum}`, { cleanedLen: cleaned.length });
          return { text: cleaned };
        } catch (error) {
          console.log(`[Audio] Error chunk #${chunkNum}`, { err: (error as Error)?.message || String(error) });
          console.error('Audio processing error:', error);
          if (onError) onError(error as Error);
          return { text: '', error: (error as Error).message };
        }
      },

      sendTranscript: async (text: string): Promise<void> => {
        if (!text || text.trim().length === 0) return;

        conversationHistory += text + ' ';
        if (conversationHistory.length > MAX_HISTORY_CHARS) {
          conversationHistory = conversationHistory.slice(conversationHistory.length - MAX_HISTORY_CHARS);
        }
        
        console.log(`[Realtime] Received transcript: "${text.trim()}" (total history: ${conversationHistory.length} chars)`);

        if (onTranscript && isConnected) {
          try {
            await onTranscript(conversationHistory);
          } catch (error) {
            console.error('[Realtime] Transcript analysis error:', error);
            if (onError) onError(error as Error);
          }
        }
      },

      close: () => {
        isConnected = false;
        try {
          scribe.close();
        } catch {}
      },

      isConnected: () => isConnected,

      getHistory: () => conversationHistory,
    };

    return connection;
  } catch (error) {
    if (onError) {
      onError(error as Error);
    }
    throw error;
  }
}
