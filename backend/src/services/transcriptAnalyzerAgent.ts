import OpenAI from 'openai';
import {
  createCallSession,
  endCallSession,
  insertTranscriptChunks,
  type TranscriptChunkRow,
} from './supabaseTranscriptStore.js';
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
  conversationHistory: string; // rolling 8000 char context
  analyzedChunks: AnalyzedChunk[];
  buffer: TranscriptChunkRow[];
  seq: number;
  flushTimer?: NodeJS.Timeout;
  sessionCreated: boolean;
}

export class TranscriptAnalyzerAgent {
  private openai: OpenAI;
  private sessions: Map<string, AgentSession> = new Map();
  private static readonly MAX_CONTEXT_CHARS = 8000;
  private static readonly FLUSH_INTERVAL_MS = 1000;
  private static readonly FLUSH_MAX_ROWS = 5;
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
      const response = await this.openai.chat.completions.create({
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
            content: `CONVERSATION SO FAR:\n${session.conversationHistory.slice(-3000)}\n\n---\nNEW TEXT TO CLASSIFY:\n"${newText}"\n\nWho said this? Reply with only "closer" or "prospect":`,
          },
        ],
      });

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
      }
    } catch (error) {
      // Re-queue for retry
      if (rows.length > 0) {
        session.buffer.unshift(...rows);
      }
      console.error(`[AI Agent] Flush failed:`, error);
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
