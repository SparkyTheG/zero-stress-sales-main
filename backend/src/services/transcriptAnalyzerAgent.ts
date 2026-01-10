import OpenAI from 'openai';
import {
  createCallSession,
  endCallSession,
  fetchTranscriptChunksForSession,
  insertTranscriptChunks,
  insertCallSessionSummary,
  type TranscriptChunkRow,
} from './supabaseTranscriptStore.js';
import { withOpenAIPool } from './openaiPool.js';
import { randomUUID } from 'crypto';

// Context about the app for the AI agent
const APP_CONTEXT = `You are an AI assistant for Zero-Stress Sales, a real-time sales coaching application.

WHAT THE APP DOES:
- Helps high-ticket closers (salespeople) during live sales calls
- Analyzes the conversation in real-time to provide coaching insights
- Tracks 27 psychological indicators across 7 pillars (Pain & Desire, Urgency, Decisiveness, Available Money, Responsibility, Price Sensitivity, Trust)
- Calculates a "Lubometer" score (0-100) indicating buying readiness
- Detects objections and suggests personalized handling scripts
- Identifies red flags and psychological patterns

THE CONVERSATION STRUCTURE:
- CLOSER: The salesperson using the app (seller)
- PROSPECT: The potential customer being sold to (buyer)

Your job is to analyze transcript text and determine WHO said each piece of text based on:
- Closers typically: ask questions, present offers, handle objections, guide the conversation, discuss pricing/packages, build rapport
- Prospects typically: express concerns, ask about price, share their situation/pain points, raise objections, show interest or hesitation, talk about their budget/timeline/decision process`;

const SPEAKER_DETECTION_PROMPT = `Based on the conversation context and the new text, determine who most likely said this new text.

Rules:
1. Analyze the CONTENT and TONE of the new text
2. Consider the conversation flow - who would logically speak next
3. Closers ask questions, present value, handle objections
4. Prospects express concerns, ask about price, share their situation

Respond with ONLY one word: "closer" or "prospect"`;

const SUMMARY_SYSTEM = `You are an expert sales call analyst for "Zero-Stress Sales".

Your job: produce high-signal conversation summaries from transcript text.

Hard rules:
- Use ONLY information present in the transcript. Do NOT invent names, numbers, companies, results, or timelines.
- If a name/company isn't explicitly stated, write "the closer" / "the prospect" (no made-up names).
- Be concise, specific, and actionable for the closer.
- Output MUST be valid JSON only. No markdown, no commentary.`;

interface AnalyzedChunk {
  text: string;
  speaker: 'closer' | 'prospect';
  originalSpeaker: string;
  seq: number;
  timestamp: number;
}

interface AgentSession {
  userId: string;
  userEmail?: string | null;
  callSessionId?: string;
  startedAtMs: number;
  conversationHistory: string; // rolling 8000 char context
  analyzedChunks: AnalyzedChunk[];
  buffer: TranscriptChunkRow[];
  seq: number;
  flushTimer?: NodeJS.Timeout;
  sessionCreated: boolean;
  lastProgressiveSummaryAtMs?: number;
  isSummarizing?: boolean;
}

export class TranscriptAnalyzerAgent {
  private openai: OpenAI;
  private sessions: Map<string, AgentSession> = new Map();
  // Speed-first: keep less rolling context in-memory for diarization + summaries
  private static readonly MAX_CONTEXT_CHARS = 3000;
  // Speaker detection only needs a small, recent window
  private static readonly SPEAKER_CONTEXT_CHARS = 800;
  private static readonly FLUSH_INTERVAL_MS = 1000;
  private static readonly FLUSH_MAX_ROWS = 5;
  private static readonly SUMMARY_MIN_INTERVAL_MS = 2 * 60 * 1000;
  private static readonly SUMMARY_MIN_CHUNKS = 10;
  private static readonly DEBUG = process.env.DEBUG_LOGS === '1';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  // Initialize a session for transcript analysis
  initSession(wsSessionId: string, userId: string, userEmail?: string | null): void {
    if (this.sessions.has(wsSessionId)) return;
    
    this.sessions.set(wsSessionId, {
      userId,
      userEmail,
      startedAtMs: Date.now(),
      conversationHistory: '',
      analyzedChunks: [],
      buffer: [],
      seq: 0,
      sessionCreated: false,
    });
    
    if (TranscriptAnalyzerAgent.DEBUG) {
      console.log(`[AI Agent] Session initialized for ${wsSessionId}`);
    }
  }

  // Remove session
  async endSession(wsSessionId: string): Promise<void> {
    const session = this.sessions.get(wsSessionId);
    if (!session) return;

    // Flush remaining buffer
    if (session.flushTimer) {
      clearTimeout(session.flushTimer);
      session.flushTimer = undefined;
    }
    
    await this.flushBuffer(wsSessionId, true);
    this.sessions.delete(wsSessionId);
    
    if (TranscriptAnalyzerAgent.DEBUG) {
      console.log(`[AI Agent] Session ended for ${wsSessionId}`);
    }
  }

  // Main method: analyze text and persist to Supabase
  async analyzeAndPersist(
    wsSessionId: string,
    text: string,
    hintSpeaker: string = 'unknown'
  ): Promise<{ speaker: 'closer' | 'prospect'; text: string } | null> {
    const session = this.sessions.get(wsSessionId);
    if (!session) {
      if (TranscriptAnalyzerAgent.DEBUG) {
        console.log(`[AI Agent] No session found for ${wsSessionId}, skipping`);
      }
      return null;
    }

    try {
      // Use AI to determine speaker
      const detectedSpeaker = await this.detectSpeaker(session, text, hintSpeaker);
      
      // Update conversation history (rolling window)
      const newLine = `${detectedSpeaker.toUpperCase()}: ${text}`;
      session.conversationHistory += (session.conversationHistory ? '\n' : '') + newLine;
      
      // Trim to max context chars
      if (session.conversationHistory.length > TranscriptAnalyzerAgent.MAX_CONTEXT_CHARS) {
        const excess = session.conversationHistory.length - TranscriptAnalyzerAgent.MAX_CONTEXT_CHARS;
        // Find first newline after the excess to avoid cutting mid-line
        const cutPoint = session.conversationHistory.indexOf('\n', excess);
        if (cutPoint > 0) {
          session.conversationHistory = session.conversationHistory.slice(cutPoint + 1);
        } else {
          session.conversationHistory = session.conversationHistory.slice(excess);
        }
      }

      // Ensure call session exists
      if (!session.sessionCreated) {
        await this.ensureCallSession(wsSessionId, session);
      }

      if (!session.callSessionId) {
        if (TranscriptAnalyzerAgent.DEBUG) {
          console.log(`[AI Agent] No call session ID, cannot persist`);
        }
        return { speaker: detectedSpeaker, text };
      }

      // Add to buffer
      session.seq += 1;
      const chunk: TranscriptChunkRow = {
        session_id: session.callSessionId,
        user_id: session.userId,
        seq: session.seq,
        speaker: detectedSpeaker,
        text: text,
      };
      session.buffer.push(chunk);

      // Track analyzed chunk
      session.analyzedChunks.push({
        text,
        speaker: detectedSpeaker,
        originalSpeaker: hintSpeaker,
        seq: session.seq,
        timestamp: Date.now(),
      });

      // Flush if buffer is large enough
      if (session.buffer.length >= TranscriptAnalyzerAgent.FLUSH_MAX_ROWS) {
        await this.flushBuffer(wsSessionId);
      } else if (!session.flushTimer) {
        session.flushTimer = setTimeout(() => {
          session.flushTimer = undefined;
          this.flushBuffer(wsSessionId).catch(() => {});
        }, TranscriptAnalyzerAgent.FLUSH_INTERVAL_MS);
      }

      return { speaker: detectedSpeaker, text };
    } catch (error) {
      console.error(`[AI Agent] Error analyzing text:`, error);
      return null;
    }
  }

  private async detectSpeaker(
    session: AgentSession,
    newText: string,
    hintSpeaker: string
  ): Promise<'closer' | 'prospect'> {
    try {
      // If we have very little context, use the hint or make educated guess
      if (session.conversationHistory.length < 100) {
        // Early in conversation - questions are usually closer, statements about problems are prospect
        const lowerText = newText.toLowerCase();
        if (lowerText.includes('?') || lowerText.startsWith('so') || lowerText.startsWith('tell me') || lowerText.startsWith('what') || lowerText.startsWith('how')) {
          return 'closer';
        }
        if (hintSpeaker === 'closer' || hintSpeaker === 'prospect') {
          return hintSpeaker;
        }
        return 'prospect'; // Default early in call
      }

      // Use GPT to analyze
      const response = await withOpenAIPool('aux', () =>
        this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 10,
          messages: [
            {
              role: 'system',
              content: APP_CONTEXT + '\n\n' + SPEAKER_DETECTION_PROMPT,
            },
            {
              role: 'user',
              content: `CONVERSATION SO FAR:\n${session.conversationHistory.slice(-TranscriptAnalyzerAgent.SPEAKER_CONTEXT_CHARS)}\n\n---\nNEW TEXT TO CLASSIFY:\n"${newText}"\n\nWho said this? Reply with only "closer" or "prospect":`,
            },
          ],
        })
      );

      const result = response.choices[0]?.message?.content?.trim().toLowerCase() || '';
      
      if (result.includes('closer')) {
        return 'closer';
      } else if (result.includes('prospect')) {
        return 'prospect';
      }

      // Fallback: use hint or pattern matching
      return this.fallbackSpeakerDetection(newText, hintSpeaker);
    } catch (error) {
      if (TranscriptAnalyzerAgent.DEBUG) {
        console.warn(`[AI Agent] Speaker detection failed, using fallback:`, error);
      }
      return this.fallbackSpeakerDetection(newText, hintSpeaker);
    }
  }

  private fallbackSpeakerDetection(text: string, hintSpeaker: string): 'closer' | 'prospect' {
    if (hintSpeaker === 'closer' || hintSpeaker === 'prospect') {
      return hintSpeaker;
    }
    
    const lower = text.toLowerCase();
    // Questions and guiding language -> closer
    if (lower.includes('?') || lower.includes('would you') || lower.includes('what if') || 
        lower.includes('let me') || lower.includes('i can') || lower.includes('we offer') ||
        lower.includes('package') || lower.includes('investment')) {
      return 'closer';
    }
    // Concerns, hesitation, personal situation -> prospect
    if (lower.includes('i\'m not sure') || lower.includes('expensive') || lower.includes('budget') ||
        lower.includes('need to think') || lower.includes('my situation') || lower.includes('can\'t afford')) {
      return 'prospect';
    }
    
    return 'unknown' as any; // Will be stored as-is
  }

  private async ensureCallSession(wsSessionId: string, session: AgentSession): Promise<void> {
    if (session.sessionCreated) return;
    
    const callId = randomUUID();
    try {
      await createCallSession({
        id: callId,
        userId: session.userId,
        userEmail: session.userEmail,
        meta: { ws_session_id: wsSessionId },
        aiAnalyzed: true,
      });
      session.callSessionId = callId;
      session.sessionCreated = true;
      
      if (TranscriptAnalyzerAgent.DEBUG) {
        console.log(`[AI Agent] Created call session ${callId}`);
      }
    } catch (error) {
      console.error(`[AI Agent] Failed to create call session:`, error);
    }
  }

  private async flushBuffer(wsSessionId: string, endSession: boolean = false): Promise<void> {
    const session = this.sessions.get(wsSessionId);
    if (!session) return;
    if (session.buffer.length === 0 && !endSession) return;

    const rows = session.buffer.splice(0, session.buffer.length);
    
    try {
      if (rows.length > 0) {
        await insertTranscriptChunks(rows);
        if (TranscriptAnalyzerAgent.DEBUG) {
          console.log(`[AI Agent] Flushed ${rows.length} chunks to Supabase`);
        }
      }
      if (endSession && session.callSessionId) {
        await endCallSession({ id: session.callSessionId });
        if (TranscriptAnalyzerAgent.DEBUG) {
          console.log(`[AI Agent] Ended call session ${session.callSessionId}`);
        }
        // Final summary (IMPORTANT: await to avoid session deletion race)
        try {
          await this.generateAndPersistSummary(wsSessionId, 'final');
        } catch (err: any) {
          console.warn('[AI Agent] Final summary failed:', err?.message || err);
        }
      } else if (!endSession) {
        // Progressive summary (throttled)
        this.maybeGenerateProgressiveSummary(wsSessionId).catch((err: any) => {
          if (TranscriptAnalyzerAgent.DEBUG) console.warn('[AI Agent] Progressive summary failed:', err?.message || err);
        });
      }
    } catch (error) {
      // Re-queue for retry
      if (rows.length > 0) {
        session.buffer.unshift(...rows);
      }
      console.error(`[AI Agent] Flush failed:`, error);
    }
  }

  private async maybeGenerateProgressiveSummary(wsSessionId: string): Promise<void> {
    const session = this.sessions.get(wsSessionId);
    if (!session?.callSessionId) return;
    if (session.isSummarizing) return;
    if (session.seq < TranscriptAnalyzerAgent.SUMMARY_MIN_CHUNKS) return;

    const now = Date.now();
    const last = session.lastProgressiveSummaryAtMs ?? 0;
    if (now - last < TranscriptAnalyzerAgent.SUMMARY_MIN_INTERVAL_MS) return;

    session.lastProgressiveSummaryAtMs = now;
    await this.generateAndPersistSummary(wsSessionId, 'progressive');
  }

  private async generateAndPersistSummary(wsSessionId: string, status: 'progressive' | 'final'): Promise<void> {
    const session = this.sessions.get(wsSessionId);
    if (!session?.callSessionId) return;
    if (session.isSummarizing) return;
    session.isSummarizing = true;

    try {
      const chunks = await fetchTranscriptChunksForSession({ sessionId: session.callSessionId });
      if (!chunks || chunks.length === 0) return;

      const transcriptLines = chunks.map((c) => `${String(c.speaker || 'unknown').toUpperCase()}: ${c.text}`);
      const transcript = transcriptLines.join('\n');

      const notes = await this.buildNotesFromTranscript(transcript, status);
      const final = await this.buildFinalSummaryFromNotes(notes, status);

      const title = (final?.title || '').toString().trim().slice(0, 80) || 'conversation';
      const executiveSummary = (final?.executiveSummary || '').toString().trim();
      const preview = executiveSummary ? executiveSummary.slice(0, 220) : (JSON.stringify(final) || '').slice(0, 220);
      const durationSeconds = Math.max(0, Math.round((Date.now() - session.startedAtMs) / 1000));

      await insertCallSessionSummary({
        session_id: session.callSessionId,
        user_id: session.userId,
        user_email: session.userEmail ?? null,
        status,
        title,
        preview,
        summary: final ?? {},
        duration_seconds: durationSeconds,
        model: 'gpt-4o-mini',
      });

      if (TranscriptAnalyzerAgent.DEBUG) {
        console.log(`[AI Agent] Stored ${status} summary for session ${session.callSessionId}`);
      }
    } finally {
      const s = this.sessions.get(wsSessionId);
      if (s) s.isSummarizing = false;
    }
  }

  private splitTranscriptByChars(transcript: string, maxChars: number): string[] {
    const lines = transcript.split('\n');
    const out: string[] = [];
    let buf = '';
    for (const line of lines) {
      const next = buf ? `${buf}\n${line}` : line;
      if (next.length > maxChars) {
        if (buf) out.push(buf);
        buf = line;
      } else {
        buf = next;
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  private async buildNotesFromTranscript(transcript: string, status: 'progressive' | 'final'): Promise<string> {
    const parts = this.splitTranscriptByChars(transcript, 12000);
    const compactNotes: any[] = [];

    for (const part of parts) {
      const res = await withOpenAIPool('aux', () =>
        this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_tokens: 700,
          messages: [
            { role: 'system', content: SUMMARY_SYSTEM },
            {
              role: 'user',
              content:
                `Summarize this PART of the sales call transcript into compact notes.\n` +
                `Status: ${status}\n\n` +
                `Return JSON with EXACT keys:\n` +
                `{"notes":[...],"objectionsRaised":[...],"objectionsResolved":[...],"decisions":[...],"nextSteps":[...],"signals":{"pain":0,"urgency":0,"trust":0,"budget":0,"decision":0}}\n\n` +
                `TRANSCRIPT PART:\n${part}`,
            },
          ],
        })
      );

      const txt = res.choices[0]?.message?.content?.trim() || '';
      try {
        compactNotes.push(JSON.parse(txt));
      } catch {
        compactNotes.push({ notes: [txt] });
      }
    }

    const notesStr = JSON.stringify(compactNotes);
    // Keep notes bounded so final step doesn't balloon
    return notesStr.length > 30000 ? notesStr.slice(0, 30000) : notesStr;
  }

  private async buildFinalSummaryFromNotes(notesJson: string, status: 'progressive' | 'final'): Promise<any> {
    const res = await withOpenAIPool('aux', () =>
      this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 1100,
        messages: [
          { role: 'system', content: SUMMARY_SYSTEM },
          {
            role: 'user',
            content:
              `Using the notes extracted from the FULL call, produce the final structured summary.\n` +
              `Status: ${status}\n\n` +
              `Output JSON with EXACT keys:\n` +
              `{\n` +
              `  "title": "short topic (1-3 words)",\n` +
              `  "executiveSummary": "2-3 sentences",\n` +
              `  "prospectSituation": "1 paragraph",\n` +
              `  "keyPoints": ["..."],\n` +
              `  "objectionsRaised": ["..."],\n` +
              `  "objectionsResolved": ["..."],\n` +
              `  "nextSteps": ["..."],\n` +
              `  "closerPerformance": "1 paragraph",\n` +
              `  "prospectReadiness": "not_ready|unsure|ready",\n` +
              `  "recommendations": "1 paragraph"\n` +
              `}\n\n` +
              `NOTES JSON:\n${notesJson}`,
          },
        ],
      })
    );

    const txt = res.choices[0]?.message?.content?.trim() || '';
    try {
      return JSON.parse(txt);
    } catch {
      // Fallback: store something still useful
      return {
        title: 'conversation',
        executiveSummary: txt.slice(0, 400),
        prospectSituation: '',
        keyPoints: [],
        objectionsRaised: [],
        objectionsResolved: [],
        nextSteps: [],
        closerPerformance: '',
        prospectReadiness: 'unsure',
        recommendations: '',
        raw: txt,
      };
    }
  }

  // Get current conversation context (for debugging/inspection)
  getConversationContext(wsSessionId: string): string {
    return this.sessions.get(wsSessionId)?.conversationHistory || '';
  }

  // Get call session ID
  getCallSessionId(wsSessionId: string): string | undefined {
    return this.sessions.get(wsSessionId)?.callSessionId;
  }
}

// Singleton instance
let agentInstance: TranscriptAnalyzerAgent | null = null;

export function getTranscriptAnalyzerAgent(apiKey: string): TranscriptAnalyzerAgent {
  if (!agentInstance) {
    agentInstance = new TranscriptAnalyzerAgent(apiKey);
  }
  return agentInstance;
}
