import OpenAI from 'openai';
import type { IndicatorScore } from '../types/analysis.js';
import { getPillarCalculator } from './pillarCalculator.js';
import { getTruthIndexCalculator } from './truthIndexCalculator.js';
import { getLubometerCalculator } from './lubometerCalculator.js';
import { getObjectionDetector } from './objectionDetector.js';
import { getPsychologicalDialsAnalyzer } from './psychologicalDialsAnalyzer.js';
import { getRedFlagsDetector } from './redFlagsDetector.js';
import type { AnalysisResult } from '../types/analysis.js';
import { withOpenAIPool } from './openaiPool.js';

// Enhanced prompt - GPT scores indicators AND detects objections/psychological patterns
const SYSTEM_PROMPT = `You are an expert sales conversation analyzer. Analyze conversation text and:
1. Score the 27 sales indicators from 1-10
2. Detect potential objections based on indicator patterns
3. Identify psychological dials (hot buttons) based on activated indicators

## THE 27 INDICATORS TO SCORE:

### PILLAR 1: Perceived Spread (Pain & Desire Gap)
1. Pain Awareness (1-10): How aware is the prospect of their pain?
2. Desire Clarity (1-10): How clear is their vision of what they want?
3. Desire Priority (1-10): How important is solving this?
4. Duration of Dissatisfaction (1-10): How long have they lived with this?

### PILLAR 2: Urgency
5. Time Pressure (1-10): Is there external timing driving this?
6. Perceived Cost of Delay (1-10): What's at stake if they wait?
7. Internal Timing Activation (1-10): Is something internal driving the timing?
8. Environmental Availability (1-10): Can they engage now?

### PILLAR 3: Decisiveness
9. Decision-Making Authority (1-10): Are they the decision maker?
10. Decision-Making Style (1-10): How do they make decisions?
11. Commitment to Decide (1-10): Are they ready to commit?
12. Self-Permission to Choose (1-10): Do they give themselves permission?

### PILLAR 4: Available Money
13. Resource Access (1-10): Do they have funds available?
14. Resource Fluidity (1-10): Can they move money around?
15. Investment Mindset (1-10): Do they see value in investing?
16. Resourcefulness (1-10): Would they find a way if it mattered?

### PILLAR 5: Responsibility & Ownership
17. Problem Recognition (1-10): Do they own the problem?
18. Solution Ownership (1-10): Do they own the solution?
19. Locus of Control (1-10): Do they believe they control outcomes?
20. Integrity: Desire vs Action (1-10): Do they follow through?

### PILLAR 6: Price Sensitivity (NOTE: Will be reversed in calculation)
21. Emotional Response to Spending (1-10 raw): How do they feel about spending?
22. Negotiation Reflex (1-10 raw): Do they try to negotiate?
23. Structural Rigidity (1-10 raw): Do they need flexible terms?

### PILLAR 7: Trust
24. External Trust (1-10): Do they trust you/the offer?
25. Internal Trust (1-10): Do they trust themselves?
26. Risk Tolerance (1-10): Are they comfortable with uncertainty?
27. ROI Ownership Framing (1-10): Do they own the ROI?

## COMPLETE LIST OF ALL 27 INDICATORS:
1. Pain Awareness (P1)
2. Desire Clarity (P1)
3. Desire Priority (P1)
4. Duration of Dissatisfaction (P1)
5. Time Pressure (P2)
6. Perceived Cost of Delay (P2)
7. Internal Timing Activation (P2)
8. Environmental Availability (P2)
9. Decision-Making Authority (P3)
10. Decision-Making Style (P3)
11. Commitment to Decide (P3)
12. Self-Permission to Choose (P3)
13. Resource Access (P4)
14. Resource Fluidity (P4)
15. Investment Mindset (P4)
16. Resourcefulness (P4)
17. Problem Recognition (P5)
18. Solution Ownership (P5)
19. Locus of Control (P5)
20. Integrity: Desire vs Action (P5)
21. Emotional Response to Spending (P6 - will be reversed)
22. Negotiation Reflex (P6 - will be reversed)
23. Structural Rigidity (P6 - will be reversed)
24. External Trust (P7)
25. Internal Trust (P7)
26. Risk Tolerance (P7)
27. ROI Ownership Framing (P7)

## SCORING GUIDELINES:
- Low (1-3): Negative signals, resistance, lack of clarity/commitment
- Mid (4-6): Neutral, moderate, mixed signals
- High (7-10): Positive signals, strong indicators, clear commitment

## OBJECTION DETECTION (Based on Indicators and Objection Matrix CSV):
CRITICAL: Extract objections DIRECTLY from the conversation text. Only include objections that the prospect actually says or clearly implies in their words.

Objection mappings from CSV (only detect if actually present in conversation):
- Indicator 1 (Pain Awareness) → "Things aren't that bad right now." (or similar phrasing)
- Indicator 2 (Desire Clarity) → "I'm not even sure what I'd want instead." (or similar phrasing)
- Indicator 3 (Desire Priority) → "This is on the back burner for now." (or similar phrasing)
- Indicator 4 (Duration of Dissatisfaction) → "I've lived with it for years." (or similar phrasing)
- Indicator 5 (Time Pressure) → "I'm not on a deadline." (or similar phrasing)
- Indicator 6 (Cost of Delay) → "I'll revisit this later." (or similar phrasing)
- Indicator 7 (Internal Timing) → "I'm not ready to decide." (or similar phrasing)
- Indicator 8 (Environmental Availability) → "It's a crazy time." (or similar phrasing)
- Indicator 9 (Decision Authority) → "I need to check with my partner." (or similar phrasing)
- Indicator 10 (Decision-Making Style) → "I usually take time to reflect." (or similar phrasing)
- Indicator 11 (Commitment) → "Can I sleep on it?" (or similar phrasing)
- Indicator 12 (Self-Permission) → "What if I fail?" (or similar phrasing)
- Indicator 13 (Resource Access) → "I don't have the funds." (or similar phrasing)
- Indicator 14 (Resource Fluidity) → "Our budget's frozen." (or similar phrasing)
- Indicator 15 (Investment Mindset) → "Not sure it's worth it." (or similar phrasing)
- Indicator 16 (Resourcefulness) → "I can't make this work." (or similar phrasing)
- Indicator 17 (Problem Recognition) → "It's not really my fault." (or similar phrasing)
- Indicator 18 (Solution Ownership) → "Will this really work for me?" (or similar phrasing)
- Indicator 19 (Locus of Control) → "If I get lucky, maybe." (or similar phrasing)
- Indicator 20 (Integrity) → "I want it, but..." (or similar phrasing)
- Indicator 21 (Emotional Response to Spending) → "I'm anxious about spending this." (or similar phrasing)
- Indicator 22 (Negotiation) → "Can you discount this?" (or similar phrasing)
- Indicator 23 (Structural Rigidity) → "I want it my way." (or similar phrasing)
- Indicator 24 (ROI Ownership) → "This should pay for itself, right?" (or similar phrasing)
- Indicator 25 (External Trust) → "I haven't seen enough proof." (or similar phrasing)
- Indicator 26 (Internal Trust) → "I'm not sure I can follow through." (or similar phrasing)
- Indicator 27 (Risk Tolerance) → "I don't want to make a mistake." (or similar phrasing)

RULES:
1. Only include objections that are ACTUALLY present in the conversation text (exact words or clear paraphrases)
2. Use the EXACT objection text from the CSV if the prospect says something matching that pattern
3. Calculate probability (0-100) based on how explicitly and strongly the objection appears
4. If no objections are detected, return empty array
5. Return maximum top 5 objections, sorted by probability (highest first)

## PSYCHOLOGICAL DIALS (Based on Hot Buttons Tracker CSV):
CRITICAL: ANY of the 27 indicators can be a hot button/psychological dial. The ticks (✓) in the CSV are just examples - ALL indicators are potential hot buttons if they show high intensity in the conversation.

RULES:
1. Look at the indicator scores you assigned - ANY indicator with a high score (7-10) indicates a strong psychological pattern activated in the conversation
2. Identify the TOP 5 indicators with the HIGHEST scores/intensity from the conversation
3. These become the psychological dials - they represent the strongest psychological patterns activated
4. For each selected indicator, use its score to calculate intensity (0-100):
   - Score 10 → 100% intensity
   - Score 9 → 90% intensity
   - Score 8 → 80% intensity
   - Score 7 → 70% intensity
   - (Score / 10) * 100 = intensity percentage
5. Use the indicator name as the dial name (e.g., "Pain Awareness", "Decision-Making Authority", "Resource Access", etc.)
6. Priority: Focus on indicators that are RELEVANT to detected objections, but also include any high-scoring indicators
7. Return the TOP 5 indicators with highest scores as psychological dials, sorted by intensity (highest first)

Note: All 27 indicators are potential hot buttons. Don't restrict to only ticked indicators - use whichever indicators show the strongest activation (highest scores) in the conversation.

## OUTPUT FORMAT:
Return ONLY a JSON object with this exact structure:
{
  "indicators": [
    { "id": 1, "name": "Pain Awareness", "score": 7, "pillarId": "P1", "evidence": ["quote from conversation"] },
    ... (all 27 indicators)
  ],
  "objections": [
    { "id": "obj1", "text": "Can I sleep on it?", "probability": 78, "indicator": 11 },
    ... (top 5 objections actually detected in conversation, use exact text or close paraphrase from conversation)
  ],
  "psychologicalDials": [
    { "name": "Pain Awareness", "intensity": 85, "color": "from-red-500 to-orange-500" },
    { "name": "Decision-Making Authority", "intensity": 78, "color": "from-blue-500 to-cyan-500" },
    ... (top 5 indicators with highest scores from your indicator scoring, ANY of the 27 indicators)
  ],
  
COLOR GUIDELINES FOR PSYCHOLOGICAL DIALS (IMPORTANT - NO BLACK/GREY):
- Pain-related indicators (P1): Use warm colors like "from-red-500 to-orange-500", "from-orange-500 to-yellow-500", "from-rose-500 to-pink-500"
- Urgency indicators (P2): Use energetic colors like "from-orange-500 to-red-500", "from-amber-500 to-orange-500", "from-red-500 to-pink-500"
- Decision indicators (P3): Use confident colors like "from-blue-500 to-cyan-500", "from-indigo-500 to-blue-500", "from-purple-500 to-blue-500"
- Money indicators (P4): Use premium colors like "from-emerald-500 to-teal-500", "from-green-500 to-emerald-500", "from-cyan-500 to-teal-500"
- Ownership indicators (P5): Use powerful colors like "from-purple-500 to-pink-500", "from-violet-500 to-purple-500", "from-fuchsia-500 to-pink-500"
- Price sensitivity (P6): Use balanced colors like "from-yellow-500 to-orange-500", "from-amber-500 to-yellow-500"
- Trust indicators (P7): Use trustworthy colors like "from-cyan-500 to-blue-500", "from-teal-500 to-cyan-500", "from-emerald-500 to-cyan-500"
- NEVER use: "from-gray-", "from-black-", "from-slate-" (these look bad)
- Always use vibrant, gradient colors that match the indicator's psychological meaning
  "objectionScripts": {
    "obj1": {
      "title": "\"Can I sleep on it?\"",
      "dialTrigger": "Commitment to Decide + Validation Seeker",
      "steps": [
        { "step": 1, "text": "I totally get that... and thank you for being honest with me.", "pause": "1s", "note": "Acknowledge their concern" },
        { "step": 2, "text": "Based on what you shared earlier, this isn't really about needing time to think...", "pause": "1.5s", "note": "Reference specific conversation details" }
      ] (EXACTLY 2 steps only)
      ]
    },
    ... (generate a script for EACH detected objection, keyed by objection id)
  }
}

## OBJECTION HANDLING SCRIPTS INSTRUCTIONS:
For EACH objection detected, generate a personalized handling script using the Indicators and Objection Matrix CSV approach. Each script should:

1. Title: The objection text in quotes (e.g., "\"Can I sleep on it?\"")
2. Dial Trigger: List the psychological dials/hot buttons that triggered this objection (e.g., "Commitment to Decide + Validation Seeker")
3. Steps: EXACTLY 2 conversation steps with:
   - step: Sequential number (1, 2)
   - text: What to say - PERSONALIZE based on actual conversation context
   - pause: Optional pause time (e.g., "1s", "2s", "1.5s") - use strategically
   - note: Optional coaching note (e.g., "Wait for response", "This is the pivot moment", "Let them answer")

Script style should:
- Reference specific things the prospect said in the conversation
- Use techniques from the CSV (PEARL, Self-led Insight, Pattern Interrupt, Direct Challenge)
- Be personalized to their indicator scores and psychological patterns
- Guide them through the objection to resolution
- End with a clear close or next step

Note: Generate scripts for ALL detected objections. Key them by objection id (e.g., "obj1", "obj2"). Make scripts contextual and personalized.

Be precise and evidence-based. Only score what you can detect. If you cannot detect an indicator, default to 5 (neutral). Always include evidence quotes.`;

interface GPTIndicatorResult {
  indicators: {
    id: number;
    name: string;
    score: number;
    pillarId: string;
    evidence: string[];
  }[];
  objections?: {
    id: string;
    text: string;
    probability: number;
    indicator: number;
  }[];
  psychologicalDials?: {
    name: string;
    intensity: number;
    color: string;
  }[];
  objectionScripts?: {
    [key: string]: {
      title: string;
      dialTrigger: string;
      steps: Array<{
        step: number;
        text: string;
        pause?: string;
        note?: string;
      }>;
    };
  };
}

export class GPTConversationAnalyzer {
  private openai: OpenAI;
  private conversationHistory: string[] = [];
  // Cache for generated scripts - only generate once per objection
  private scriptCache: Map<string, any> = new Map();
  // Cache for last analysis to avoid re-processing same data
  private lastAnalysisHash: string = '';
  private lastAnalysisResult: AnalysisResult | null = null;
  // Performance: cap memory + prompt size so the app doesn't slow down over long sessions
  private static readonly MAX_HISTORY_LINES_STORED = 150; // hard cap in memory (aggressive speed)
  // Speed-first prompt windows (aggressive)
  private static readonly MAX_WINDOW_LINES_FOR_AI = 30; // main analysis context (recent lines)
  private static readonly MAX_WINDOW_CHARS_FOR_AI = 3000; // main analysis context (recent chars)
  private static readonly MAX_WINDOW_LINES_FOR_SCRIPTS = 15; // script context (recent lines)
  private static readonly MAX_WINDOW_CHARS_FOR_SCRIPTS = 1000; // script context (recent chars)
  private static readonly MAX_SCRIPT_CACHE_ITEMS = 120; // prevent unbounded cache growth
  private static readonly DEBUG = process.env.DEBUG_LOGS === '1';

  // Optional: stream model output deltas to the frontend for perceived speed.
  // Used ONLY for score-like models (Lubometer pillars, Psych Dials, Truth Index).
  private static readonly STREAM_DELTA_MIN_CHARS = Number.parseInt(process.env.AI_STREAM_MIN_CHARS || '48', 10) || 48;
  private static readonly STREAM_DELTA_MIN_INTERVAL_MS = Number.parseInt(process.env.AI_STREAM_MIN_INTERVAL_MS || '60', 10) || 60;

  private makeStreamSink(
    sendStream: ((scope: string, event: 'start' | 'delta' | 'done', delta?: string) => void) | undefined,
    scope: string
  ): ((event: 'start' | 'delta' | 'done', delta?: string) => void) | undefined {
    if (!sendStream) return undefined;
    return (event, delta) => {
      try {
        sendStream(scope, event, delta);
      } catch {
        // never let streaming telemetry break analysis
      }
    };
  }

  private async streamChatCompletionToText(options: {
    pool: 'main' | 'aux';
    model: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: any;
    streamSink?: (event: 'start' | 'delta' | 'done', delta?: string) => void;
  }): Promise<string> {
    const {
      pool,
      model,
      messages,
      temperature,
      max_tokens,
      response_format,
      streamSink,
    } = options;

    return await withOpenAIPool(pool, async () => {
      let out = '';
      let buf = '';
      let lastFlush = 0;

      const flush = (force = false) => {
        if (!streamSink) return;
        const now = Date.now();
        if (!buf) return;
        if (!force) {
          if (buf.length < GPTConversationAnalyzer.STREAM_DELTA_MIN_CHARS && now - lastFlush < GPTConversationAnalyzer.STREAM_DELTA_MIN_INTERVAL_MS) {
            return;
          }
        }
        lastFlush = now;
        const chunk = buf;
        buf = '';
        streamSink('delta', chunk);
      };

      if (streamSink) streamSink('start');

      // OpenAI streaming: receive incremental deltas, then parse final JSON once complete.
      const stream = await this.openai.chat.completions.create({
        model,
        stream: true,
        messages,
        temperature,
        max_tokens,
        response_format,
      } as any);

      try {
        // @ts-ignore - Stream implements async iterator in openai SDK
        for await (const part of stream as any) {
          const delta: string = part?.choices?.[0]?.delta?.content || '';
          if (!delta) continue;
          out += delta;
          if (streamSink) {
            buf += delta;
            flush(false);
          }
        }
      } finally {
        flush(true);
        if (streamSink) streamSink('done');
      }

      return out;
    });
  }

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  // Generate a hash of objection for caching
  private getObjectionHash(objection: any): string {
    return `${objection.text || ''}_${objection.indicator || ''}`.toLowerCase().trim();
  }

  addTranscript(text: string, speaker: 'closer' | 'prospect' | 'unknown' = 'unknown') {
    const timestamp = new Date().toISOString();
    const speakerLabel = speaker === 'closer' ? 'CLOSER' : speaker === 'prospect' ? 'PROSPECT' : 'SPEAKER';
    this.conversationHistory.push(`[${timestamp}] ${speakerLabel}: ${text}`);
    // Hard-cap history to prevent memory growth + GC slowdown
    if (this.conversationHistory.length > GPTConversationAnalyzer.MAX_HISTORY_LINES_STORED) {
      this.conversationHistory.splice(0, this.conversationHistory.length - GPTConversationAnalyzer.MAX_HISTORY_LINES_STORED);
    }
  }

  getFullTranscript(): string {
    return this.conversationHistory.join('\n');
  }

  // Use a rolling window for AI prompts to keep latency stable over long calls
  private getWindowedTranscriptForAI(): string {
    const lines = this.conversationHistory.slice(-GPTConversationAnalyzer.MAX_WINDOW_LINES_FOR_AI);
    let t = lines.join('\n');
    if (t.length > GPTConversationAnalyzer.MAX_WINDOW_CHARS_FOR_AI) {
      t = t.slice(-GPTConversationAnalyzer.MAX_WINDOW_CHARS_FOR_AI);
      // Try to avoid starting mid-line if possible
      const idx = t.indexOf('\n');
      if (idx > 0 && idx < 200) t = t.slice(idx + 1);
    }
    return t;
  }

  // Scripts only need a smaller, recent window (speed-first)
  private getWindowedTranscriptForScripts(): string {
    const lines = this.conversationHistory.slice(-GPTConversationAnalyzer.MAX_WINDOW_LINES_FOR_SCRIPTS);
    let t = lines.join('\n');
    if (t.length > GPTConversationAnalyzer.MAX_WINDOW_CHARS_FOR_SCRIPTS) {
      t = t.slice(-GPTConversationAnalyzer.MAX_WINDOW_CHARS_FOR_SCRIPTS);
      const idx = t.indexOf('\n');
      if (idx > 0 && idx < 200) t = t.slice(idx + 1);
    }
    return t;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  async analyze(): Promise<AnalysisResult> {
    const transcript = this.getWindowedTranscriptForAI();
    const scriptsTranscript = this.getWindowedTranscriptForScripts();
    
    if (!transcript || transcript.trim().length === 0) {
      return this.getDefaultResult();
    }

    try {
      const startTime = Date.now();
      if (GPTConversationAnalyzer.DEBUG) console.log('[6-MODEL] Starting all 6 specialized models in parallel...');

      // Run all 6 models in PARALLEL - each is self-contained
      const [psychologicalDials, objections, lubometer, truthIndex, redFlags] = await Promise.all([
        this.analyzeModel1_PsychologicalDials(transcript),
        this.analyzeModel2_Objections(transcript),
        this.analyzeModel4_Lubometer(transcript),
        this.analyzeModel5_TruthIndex(transcript),
        this.analyzeModel6_RedFlags(transcript)
      ]);
      
      // Model 3: Generate scripts AFTER objections are detected (5 per objection)
      const scripts = objections.length > 0 
        ? await this.analyzeModel3_Scripts(scriptsTranscript, objections)
        : {};
      
      if (GPTConversationAnalyzer.DEBUG) console.log(`[6-MODEL] All models completed in ${Date.now() - startTime}ms`);
      
      // Combine results
      const result: AnalysisResult = {
        timestamp: Date.now(),
        conversationLength: this.conversationHistory.length,
        indicators: lubometer.indicators || [],
        pillars: lubometer.pillars || [],
        lubometer: {
          rawScore: lubometer.rawScore,
          penalties: lubometer.penalties,
          finalScore: lubometer.finalScore,
          readinessZone: lubometer.readinessZone,
          priceTiers: lubometer.priceTiers,
        },
        truthIndex,
        objections: objections.slice(0, 5).map((obj: any) => ({
          id: obj.id || `obj-${Math.random().toString(36).substring(7)}`,
          text: obj.text,
          probability: Math.max(0, Math.min(100, obj.probability || 50)),
          relatedIndicators: obj.indicator ? [obj.indicator] : [],
        })),
        psychologicalDials: psychologicalDials.slice(0, 5),
        redFlags,
        objectionScripts: scripts,
      };
      
      if (GPTConversationAnalyzer.DEBUG) console.log(`[TOTAL] Analysis completed in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      console.error('Error analyzing with 6 models:', error);
      return this.getDefaultResult();
    }
  }

  // Progressive analysis - 6 PARALLEL AI models, each with specialized prompts
  // Each model ONLY analyzes what's relevant to its specific task for maximum speed
  async analyzeProgressive(sendPartial: (type: string, data: any) => void, adminSettings?: any): Promise<void> {
    const transcript = this.getWindowedTranscriptForAI();
    const scriptsTranscript = this.getWindowedTranscriptForScripts();
    
    if (!transcript || transcript.trim().length === 0) {
      return;
    }

    try {
      const startTime = Date.now();
      if (GPTConversationAnalyzer.DEBUG) console.log('[6-MODEL PARALLEL] Starting all 6 specialized models simultaneously...');

      const sendStream = (scope: string, event: 'start' | 'delta' | 'done', delta?: string) => {
        sendPartial('ai_stream', { scope, event, delta });
      };

      // ALL 6 MODELS RUN IN PARALLEL - each has its own specialized prompt
      
      // Model 1: Psychological Dials - ONLY analyzes emotional/psychological patterns
      const psychologicalDialsPromise = this.analyzeModel1_PsychologicalDials(transcript, sendStream).then(result => {
        if (GPTConversationAnalyzer.DEBUG) console.log(`[MODEL 1 - DIALS] ✓ Completed in ${Date.now() - startTime}ms`);
        sendPartial('analysis_partial', { psychologicalDials: result });
        return result;
      });

      // Model 2: Objections Detection - ONLY detects objections from speech
      const objectionsPromise = this.analyzeModel2_Objections(transcript).then(result => {
        if (GPTConversationAnalyzer.DEBUG) console.log(`[MODEL 2 - OBJECTIONS] ✓ Completed in ${Date.now() - startTime}ms, found ${result?.length || 0}`);
        sendPartial('analysis_partial', { objections: result });
        return result;
      });

      // Model 3: Scripts - Waits for objections, then generates 2 scripts per objection
      const scriptsPromise = objectionsPromise.then(objections => {
        if (!objections || objections.length === 0) {
          if (GPTConversationAnalyzer.DEBUG) console.log(`[MODEL 3 - SCRIPTS] No objections, skipping`);
          return {};
        }
        return this.analyzeModel3_Scripts(scriptsTranscript, objections, adminSettings?.customScriptPrompt).then(result => {
          if (GPTConversationAnalyzer.DEBUG) console.log(`[MODEL 3 - SCRIPTS] ✓ Completed in ${Date.now() - startTime}ms, ${Object.keys(result).length} scripts`);
          sendPartial('analysis_scripts', { objectionScripts: result });
          return result;
        });
      });

      // Model 4: Lubometer - ONLY analyzes indicators relevant to buying readiness
      const lubometerPromise = this.analyzeModel4_Lubometer(transcript, adminSettings?.pillarWeights, sendStream).then(result => {
        if (GPTConversationAnalyzer.DEBUG) console.log(`[MODEL 4 - LUBOMETER] ✓ Completed in ${Date.now() - startTime}ms, score: ${result.finalScore}`);
        sendPartial('analysis_partial', { 
          lubometer: result,
          pillars: result.pillars,
          indicators: result.indicators
        });
        return result;
      });

      // Model 5: Truth Index - ONLY analyzes for incoherence signals
      const truthIndexPromise = this.analyzeModel5_TruthIndex(transcript, sendStream).then(result => {
        console.log(`[MODEL 5 - TRUTH INDEX] ✓ Completed in ${Date.now() - startTime}ms, score: ${result.score}`);
        sendPartial('analysis_partial', { truthIndex: result });
        return result;
      });

      // Model 6: Red Flags - ONLY looks for warning signs and blockers
      const redFlagsPromise = this.analyzeModel6_RedFlags(transcript).then(result => {
        console.log(`[MODEL 6 - RED FLAGS] ✓ Completed in ${Date.now() - startTime}ms, found ${result?.length || 0}`);
        sendPartial('analysis_partial', { redFlags: result });
        return result;
      });

      // Wait for all 6 models to complete
      await Promise.all([
        psychologicalDialsPromise,
        objectionsPromise,
        scriptsPromise,
        lubometerPromise,
        truthIndexPromise,
        redFlagsPromise
      ]);

      console.log(`[6-MODEL PARALLEL] ✅ All completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error('Error in progressive analysis:', error);
      throw error;
    }
  }

  // ============================================================
  // MODEL 1: PSYCHOLOGICAL DIALS (Top 5 of 27 Indicators)
  // Returns the TOP 5 indicators by intensity from the 27-indicator CSV
  // ============================================================
  private async analyzeModel1_PsychologicalDials(
    transcript: string,
    sendStream?: (scope: string, event: 'start' | 'delta' | 'done', delta?: string) => void
  ): Promise<any[]> {
    try {
      const streamSink = this.makeStreamSink(sendStream, 'psychological_dials');
      const content = await this.streamChatCompletionToText({
        pool: 'main',
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You analyze sales conversations to identify which of the 27 psychological indicators are MOST ACTIVE in the conversation.

⚠️ CRITICAL: You MUST analyze the ACTUAL conversation text. Score ALL 27 indicators based on what the prospect actually says, then return only the TOP 5 with the HIGHEST scores.

THE 27 INDICATORS - Score each 1-10 based on EVIDENCE in the conversation:

PILLAR 1 - Pain & Desire (IDs 1-4):
• ID 1: Pain Awareness - Does the prospect express awareness of their pain/problem?
• ID 2: Desire Clarity - Does the prospect have a clear vision of what they want?
• ID 3: Desire Priority - Does solving this seem important to them?
• ID 4: Duration of Dissatisfaction - Have they lived with this problem long?

PILLAR 2 - Urgency (IDs 5-8):
• ID 5: Time Pressure - Is there an external deadline mentioned?
• ID 6: Cost of Delay - Do they express what's at stake if they wait?
• ID 7: Internal Timing - Is something internal driving urgency?
• ID 8: Environmental Availability - Can they engage/act now?

PILLAR 3 - Decisiveness (IDs 9-12):
• ID 9: Decision Authority - Are they the decision maker?
• ID 10: Decision Style - How do they typically make decisions?
• ID 11: Commitment to Decide - Are they ready to commit?
• ID 12: Self-Permission - Do they give themselves permission to act?

PILLAR 4 - Money (IDs 13-16):
• ID 13: Resource Access - Do they have funds available?
• ID 14: Resource Fluidity - Can they move money around?
• ID 15: Investment Mindset - Do they see value in investing?
• ID 16: Resourcefulness - Would they find a way if motivated?

PILLAR 5 - Ownership (IDs 17-20):
• ID 17: Problem Recognition - Do they own the problem?
• ID 18: Solution Ownership - Do they own the solution?
• ID 19: Locus of Control - Do they believe they control outcomes?
• ID 20: Integrity (Desire vs Action) - Do they follow through on desires?

PILLAR 6 - Price Sensitivity (IDs 21-23):
• ID 21: Emotional Spending - How do they feel about spending?
• ID 22: Negotiation Reflex - Do they try to negotiate/ask for discounts?
• ID 23: Structural Rigidity - Do they need flexible payment terms?

PILLAR 7 - Trust (IDs 24-27):
• ID 24: External Trust - Do they trust the seller/offer?
• ID 25: Internal Trust - Do they trust themselves to succeed?
• ID 26: Risk Tolerance - Are they comfortable with uncertainty?
• ID 27: ROI Ownership - Do they own the responsibility for ROI?

SCORING RULES:
- Score 1-3: Low/negative signals or NO evidence in conversation
- Score 4-6: Moderate/mixed signals
- Score 7-10: Strong/positive signals with clear evidence

PROCESS:
1. Read the conversation carefully
2. Score ALL 27 indicators based on what you find
3. Sort by score (highest first)
4. Return ONLY the TOP 5 highest-scoring indicators
5. Convert score to intensity: score × 10 = intensity (e.g., score 8 → intensity 80)

COLORS (assign based on indicator's pillar):
- P1 indicators (1-4): "from-red-500 to-orange-500"
- P2 indicators (5-8): "from-orange-500 to-amber-500"
- P3 indicators (9-12): "from-blue-500 to-cyan-500"
- P4 indicators (13-16): "from-emerald-500 to-teal-500"
- P5 indicators (17-20): "from-purple-500 to-pink-500"
- P6 indicators (21-23): "from-amber-500 to-yellow-500"
- P7 indicators (24-27): "from-cyan-500 to-teal-500"

RETURN JSON FORMAT:
{"psychologicalDials": [
  {"name": "[EXACT indicator name]", "intensity": [score×10], "color": "[pillar color]", "indicatorId": [1-27]}
]}

⚠️ The TOP 5 should be DIFFERENT each time based on what's actually in the conversation. If someone talks about money problems, money indicators (13-16) should rank high. If they mention needing partner approval, indicator 9 should rank high. ANALYZE THE ACTUAL CONVERSATION.`
          },
          {
            role: 'user',
            content: `Analyze this sales conversation and return the TOP 5 indicators that are MOST ACTIVATED based on what the prospect actually says:

${transcript}

Remember: Score all 27 indicators, then return only the TOP 5 highest-scoring ones with their intensities.`
          }
        ],
        temperature: 0.4,
        max_tokens: 600,
        response_format: { type: 'json_object' },
        streamSink,
      });
      if (!content) return [];
      
      const result = JSON.parse(content);
      return (result.psychologicalDials || []).slice(0, 5).map((dial: any) => ({
        ...dial,
        color: this.validateDialColor(dial.color),
      }));
    } catch (error) {
      console.error('[MODEL 1] Error:', error);
      return [];
    }
  }

  // ============================================================
  // MODEL 2: OBJECTIONS DETECTION (from 27 Indicator CSV)
  // Detects objections mapped to the 27 indicators - ALWAYS returns up to 5
  // ============================================================
  private async analyzeModel2_Objections(transcript: string): Promise<any[]> {
    try {
      const response = await withOpenAIPool('main', () => this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an objection detector. Find hesitations, concerns, and objections in the conversation.

RULES:
1. Extract the prospect's ACTUAL words (complete phrases, not fragments)
2. Include both explicit objections AND implied concerns
3. Each objection should be unique (no duplicates)

OBJECTION TYPES TO LOOK FOR:
- Confusion: "I'm confused", "I don't understand", "What do you mean?"
- Hesitation: "I'm not sure", "I need to think", "Maybe later"
- Money concerns: "It's expensive", "I can't afford it", "Need to check budget"
- Time concerns: "I'm busy", "Not a good time", "No rush"
- Trust concerns: "Will this work?", "What if it fails?", "I've tried before"
- Decision concerns: "Need to ask my spouse", "Not just my decision"

RETURN JSON:
{"objections": [
  {"id": "obj1", "text": "what they said", "probability": 0, "indicator": 11}
]}

Return empty array if NO objections found: {"objections": []}`
          },
          {
            role: 'user',
            content: `Analyze this conversation and find 3-5 objections or concerns:\n\n${transcript}`
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      }));

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.log('[MODEL 2] No content from GPT');
        return [];
      }
      
      const result = JSON.parse(content);
      let objections = result.objections || [];
      console.log(`[MODEL 2] GPT returned ${objections.length} raw objections`);
      
      // Step 1: Filter out objections that are too short (less than 3 words)
      objections = objections.filter((obj: any) => {
        const text = (obj.text || '').trim();
        const wordCount = text.split(/\s+/).filter((w: string) => w.length > 0).length;
        if (wordCount < 3) {
          console.log(`[MODEL 2] Filtering too short: "${text}" (${wordCount} words)`);
          return false;
        }
        return true;
      });
      
      // Step 2: Remove objections that are substrings of other objections
      const afterLengthFilter = [...objections];
      objections = objections.filter((obj: any, index: number) => {
        const text = (obj.text || '').toLowerCase().trim();
        for (let i = 0; i < afterLengthFilter.length; i++) {
          if (i !== index) {
            const otherText = (afterLengthFilter[i].text || '').toLowerCase().trim();
            // If this text is contained within a longer objection, filter it out
            if (otherText.length > text.length + 5 && otherText.includes(text)) {
              console.log(`[MODEL 2] Filtering substring: "${obj.text}" is part of "${afterLengthFilter[i].text}"`);
              return false;
            }
          }
        }
        return true;
      });
      
      // Step 3: Remove near-identical objections (>90% overlap)
      const uniqueObjections: any[] = [];
      for (const obj of objections) {
        const text = (obj.text || '').toLowerCase().trim();
        const isDuplicate = uniqueObjections.some(existing => {
          const existingText = (existing.text || '').toLowerCase().trim();
          // Check if texts are nearly identical
          const textWords = new Set(text.split(/\s+/).filter((w: string) => w.length > 1));
          const existingWords = new Set(existingText.split(/\s+/).filter((w: string) => w.length > 1));
          const intersection = [...textWords].filter(w => existingWords.has(w)).length;
          const minSize = Math.min(textWords.size, existingWords.size);
          const similarity = minSize > 0 ? intersection / minSize : 0;
          if (similarity > 0.9) {
            console.log(`[MODEL 2] Filtering near-duplicate (${(similarity * 100).toFixed(0)}%): "${obj.text}"`);
            return true;
          }
          return false;
        });
        if (!isDuplicate) {
          uniqueObjections.push(obj);
        }
      }
      objections = uniqueObjections;
      
      // Step 4: Assign stable IDs
      objections = objections.slice(0, 5).map((obj: any, index: number) => ({
        ...obj,
        id: `obj${index + 1}` // Ensure consistent IDs: obj1, obj2, obj3, obj4, obj5
      }));

      // Step 5: Normalize probabilities; if GPT returns all-zero/invalid probabilities, apply deterministic fallback
      const clampProb = (v: any) => {
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(100, Math.round(n)));
      };

      objections = objections.map((obj: any) => ({
        ...obj,
        probability: clampProb(obj.probability),
      }));

      const hasAnyNonZeroProb = objections.some((o: any) => (o.probability || 0) > 0);
      if (!hasAnyNonZeroProb && objections.length > 0) {
        // Provide a stable, meaningful distribution so UI progress bars aren't all 0%
        const fallback = [80, 70, 60, 50, 40];
        objections = objections.map((obj: any, i: number) => ({
          ...obj,
          probability: fallback[i] ?? 30,
        }));
      }
      
      console.log(`[MODEL 2] Final ${objections.length} unique objections:`, objections.map((o: any) => o.text));
      return objections;
    } catch (error) {
      console.error('[MODEL 2] Error:', error);
      return [];
    }
  }

  // ============================================================
  // MODEL 3: PERSONALIZED HANDLING SCRIPTS
  // Generates 1 script per objection - CACHED
  // ============================================================
  private async analyzeModel3_Scripts(transcript: string, objections: any[], customPrompt?: string): Promise<Record<string, any>> {
    return this.generateObjectionScriptsModel(transcript, objections, customPrompt);
  }

  // ============================================================
  // PILLAR SCORERS: 7 ultra-fast parallel AI models
  // Minimal prompts + low tokens for maximum speed
  // ============================================================
  
  private async scorePillar1(transcript: string, streamSink?: (event: 'start' | 'delta' | 'done', delta?: string) => void): Promise<any[]> {
    const t = Date.now();
    try {
      const txt = streamSink
        ? await this.streamChatCompletionToText({
            pool: 'main',
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: `Score 4 indicators (1-10). Return JSON: {"i":[{"id":1,"s":N},{"id":2,"s":N},{"id":3,"s":N},{"id":4,"s":N}]}
1=Pain Awareness 2=Desire Clarity 3=Desire Priority 4=Duration of Problem` },
              { role: 'user', content: transcript },
            ],
            temperature: 0.1,
            max_tokens: 80,
            response_format: { type: 'json_object' },
            streamSink,
          })
        : (await withOpenAIPool('main', () =>
            this.openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: `Score 4 indicators (1-10). Return JSON: {"i":[{"id":1,"s":N},{"id":2,"s":N},{"id":3,"s":N},{"id":4,"s":N}]}
1=Pain Awareness 2=Desire Clarity 3=Desire Priority 4=Duration of Problem` },
                { role: 'user', content: transcript },
              ],
              temperature: 0.1,
              max_tokens: 80,
              response_format: { type: 'json_object' },
            })
          )).choices[0]?.message?.content || '';

      const r = JSON.parse(txt || '{}');
      console.log(`[P1] ${Date.now()-t}ms`);
      return (r.i || r.indicators || []).map((x: any) => ({ id: x.id, name: ['','Pain Awareness','Desire Clarity','Desire Priority','Duration'][x.id], score: x.s || x.score || 5, pillarId: 'P1' }));
    } catch (e) { console.error('[P1] err'); return [{id:1,name:'Pain Awareness',score:5,pillarId:'P1'},{id:2,name:'Desire Clarity',score:5,pillarId:'P1'},{id:3,name:'Desire Priority',score:5,pillarId:'P1'},{id:4,name:'Duration',score:5,pillarId:'P1'}]; }
  }

  private async scorePillar2(transcript: string, streamSink?: (event: 'start' | 'delta' | 'done', delta?: string) => void): Promise<any[]> {
    const t = Date.now();
    try {
      const txt = streamSink
        ? await this.streamChatCompletionToText({
            pool: 'main',
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: `Score 4 indicators (1-10). Return JSON: {"i":[{"id":5,"s":N},{"id":6,"s":N},{"id":7,"s":N},{"id":8,"s":N}]}
5=Time Pressure 6=Cost of Delay 7=Internal Timing 8=Availability` },
              { role: 'user', content: transcript },
            ],
            temperature: 0.1,
            max_tokens: 80,
            response_format: { type: 'json_object' },
            streamSink,
          })
        : (await withOpenAIPool('main', () =>
            this.openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: `Score 4 indicators (1-10). Return JSON: {"i":[{"id":5,"s":N},{"id":6,"s":N},{"id":7,"s":N},{"id":8,"s":N}]}
5=Time Pressure 6=Cost of Delay 7=Internal Timing 8=Availability` },
                { role: 'user', content: transcript },
              ],
              temperature: 0.1,
              max_tokens: 80,
              response_format: { type: 'json_object' },
            })
          )).choices[0]?.message?.content || '';

      const r = JSON.parse(txt || '{}');
      console.log(`[P2] ${Date.now()-t}ms`);
      return (r.i || r.indicators || []).map((x: any) => ({ id: x.id, name: ['','','','','','Time Pressure','Cost of Delay','Internal Timing','Availability'][x.id], score: x.s || x.score || 5, pillarId: 'P2' }));
    } catch (e) { console.error('[P2] err'); return [{id:5,name:'Time Pressure',score:5,pillarId:'P2'},{id:6,name:'Cost of Delay',score:5,pillarId:'P2'},{id:7,name:'Internal Timing',score:5,pillarId:'P2'},{id:8,name:'Availability',score:5,pillarId:'P2'}]; }
  }

  private async scorePillar3(transcript: string, streamSink?: (event: 'start' | 'delta' | 'done', delta?: string) => void): Promise<any[]> {
    const t = Date.now();
    try {
      const txt = streamSink
        ? await this.streamChatCompletionToText({
            pool: 'main',
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: `Score 4 indicators (1-10). Return JSON: {"i":[{"id":9,"s":N},{"id":10,"s":N},{"id":11,"s":N},{"id":12,"s":N}]}
9=Decision Authority 10=Decision Style 11=Commitment 12=Self-Permission` },
              { role: 'user', content: transcript },
            ],
            temperature: 0.1,
            max_tokens: 80,
            response_format: { type: 'json_object' },
            streamSink,
          })
        : (await withOpenAIPool('main', () =>
            this.openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: `Score 4 indicators (1-10). Return JSON: {"i":[{"id":9,"s":N},{"id":10,"s":N},{"id":11,"s":N},{"id":12,"s":N}]}
9=Decision Authority 10=Decision Style 11=Commitment 12=Self-Permission` },
                { role: 'user', content: transcript },
              ],
              temperature: 0.1,
              max_tokens: 80,
              response_format: { type: 'json_object' },
            })
          )).choices[0]?.message?.content || '';

      const r = JSON.parse(txt || '{}');
      console.log(`[P3] ${Date.now()-t}ms`);
      return (r.i || r.indicators || []).map((x: any) => ({ id: x.id, name: ['','','','','','','','','','Decision Authority','Decision Style','Commitment','Self-Permission'][x.id], score: x.s || x.score || 5, pillarId: 'P3' }));
    } catch (e) { console.error('[P3] err'); return [{id:9,name:'Decision Authority',score:5,pillarId:'P3'},{id:10,name:'Decision Style',score:5,pillarId:'P3'},{id:11,name:'Commitment',score:5,pillarId:'P3'},{id:12,name:'Self-Permission',score:5,pillarId:'P3'}]; }
  }

  private async scorePillar4(transcript: string, streamSink?: (event: 'start' | 'delta' | 'done', delta?: string) => void): Promise<any[]> {
    const t = Date.now();
    try {
      const txt = streamSink
        ? await this.streamChatCompletionToText({
            pool: 'main',
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: `Score 4 indicators (1-10). Return JSON: {"i":[{"id":13,"s":N},{"id":14,"s":N},{"id":15,"s":N},{"id":16,"s":N}]}
13=Resource Access 14=Resource Fluidity 15=Investment Mindset 16=Resourcefulness` },
              { role: 'user', content: transcript },
            ],
            temperature: 0.1,
            max_tokens: 80,
            response_format: { type: 'json_object' },
            streamSink,
          })
        : (await withOpenAIPool('main', () =>
            this.openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: `Score 4 indicators (1-10). Return JSON: {"i":[{"id":13,"s":N},{"id":14,"s":N},{"id":15,"s":N},{"id":16,"s":N}]}
13=Resource Access 14=Resource Fluidity 15=Investment Mindset 16=Resourcefulness` },
                { role: 'user', content: transcript },
              ],
              temperature: 0.1,
              max_tokens: 80,
              response_format: { type: 'json_object' },
            })
          )).choices[0]?.message?.content || '';

      const r = JSON.parse(txt || '{}');
      console.log(`[P4] ${Date.now()-t}ms`);
      return (r.i || r.indicators || []).map((x: any) => ({ id: x.id, name: ['','','','','','','','','','','','','','Resource Access','Resource Fluidity','Investment Mindset','Resourcefulness'][x.id], score: x.s || x.score || 5, pillarId: 'P4' }));
    } catch (e) { console.error('[P4] err'); return [{id:13,name:'Resource Access',score:5,pillarId:'P4'},{id:14,name:'Resource Fluidity',score:5,pillarId:'P4'},{id:15,name:'Investment Mindset',score:5,pillarId:'P4'},{id:16,name:'Resourcefulness',score:5,pillarId:'P4'}]; }
  }

  private async scorePillar5(transcript: string, streamSink?: (event: 'start' | 'delta' | 'done', delta?: string) => void): Promise<any[]> {
    const t = Date.now();
    try {
      const txt = streamSink
        ? await this.streamChatCompletionToText({
            pool: 'main',
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: `Score 4 indicators (1-10). Return JSON: {"i":[{"id":17,"s":N},{"id":18,"s":N},{"id":19,"s":N},{"id":20,"s":N}]}
17=Problem Recognition 18=Solution Ownership 19=Locus of Control 20=Integrity` },
              { role: 'user', content: transcript },
            ],
            temperature: 0.1,
            max_tokens: 80,
            response_format: { type: 'json_object' },
            streamSink,
          })
        : (await withOpenAIPool('main', () =>
            this.openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: `Score 4 indicators (1-10). Return JSON: {"i":[{"id":17,"s":N},{"id":18,"s":N},{"id":19,"s":N},{"id":20,"s":N}]}
17=Problem Recognition 18=Solution Ownership 19=Locus of Control 20=Integrity` },
                { role: 'user', content: transcript },
              ],
              temperature: 0.1,
              max_tokens: 80,
              response_format: { type: 'json_object' },
            })
          )).choices[0]?.message?.content || '';

      const r = JSON.parse(txt || '{}');
      console.log(`[P5] ${Date.now()-t}ms`);
      return (r.i || r.indicators || []).map((x: any) => ({ id: x.id, name: ['','','','','','','','','','','','','','','','','','Problem Recognition','Solution Ownership','Locus of Control','Integrity'][x.id], score: x.s || x.score || 5, pillarId: 'P5' }));
    } catch (e) { console.error('[P5] err'); return [{id:17,name:'Problem Recognition',score:5,pillarId:'P5'},{id:18,name:'Solution Ownership',score:5,pillarId:'P5'},{id:19,name:'Locus of Control',score:5,pillarId:'P5'},{id:20,name:'Integrity',score:5,pillarId:'P5'}]; }
  }

  private async scorePillar6(transcript: string, streamSink?: (event: 'start' | 'delta' | 'done', delta?: string) => void): Promise<any[]> {
    const t = Date.now();
    try {
      const txt = streamSink
        ? await this.streamChatCompletionToText({
            pool: 'main',
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: `Score 3 price sensitivity indicators (1-10, high=more sensitive). Return JSON: {"i":[{"id":21,"s":N},{"id":22,"s":N},{"id":23,"s":N}]}
21=Emotional Spending 22=Negotiation Reflex 23=Structural Rigidity` },
              { role: 'user', content: transcript },
            ],
            temperature: 0.1,
            max_tokens: 60,
            response_format: { type: 'json_object' },
            streamSink,
          })
        : (await withOpenAIPool('main', () =>
            this.openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: `Score 3 price sensitivity indicators (1-10, high=more sensitive). Return JSON: {"i":[{"id":21,"s":N},{"id":22,"s":N},{"id":23,"s":N}]}
21=Emotional Spending 22=Negotiation Reflex 23=Structural Rigidity` },
                { role: 'user', content: transcript },
              ],
              temperature: 0.1,
              max_tokens: 60,
              response_format: { type: 'json_object' },
            })
          )).choices[0]?.message?.content || '';

      const r = JSON.parse(txt || '{}');
      console.log(`[P6] ${Date.now()-t}ms`);
      return (r.i || r.indicators || []).map((x: any) => ({ id: x.id, name: ['','','','','','','','','','','','','','','','','','','','','','Emotional Spending','Negotiation Reflex','Structural Rigidity'][x.id], score: x.s || x.score || 5, pillarId: 'P6' }));
    } catch (e) { console.error('[P6] err'); return [{id:21,name:'Emotional Spending',score:5,pillarId:'P6'},{id:22,name:'Negotiation Reflex',score:5,pillarId:'P6'},{id:23,name:'Structural Rigidity',score:5,pillarId:'P6'}]; }
  }

  private async scorePillar7(transcript: string, streamSink?: (event: 'start' | 'delta' | 'done', delta?: string) => void): Promise<any[]> {
    const t = Date.now();
    try {
      const txt = streamSink
        ? await this.streamChatCompletionToText({
            pool: 'main',
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: `Score 4 trust indicators (1-10). Return JSON: {"i":[{"id":24,"s":N},{"id":25,"s":N},{"id":26,"s":N},{"id":27,"s":N}]}
24=External Trust 25=Internal Trust 26=Risk Tolerance 27=ROI Ownership` },
              { role: 'user', content: transcript },
            ],
            temperature: 0.1,
            max_tokens: 80,
            response_format: { type: 'json_object' },
            streamSink,
          })
        : (await withOpenAIPool('main', () =>
            this.openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: `Score 4 trust indicators (1-10). Return JSON: {"i":[{"id":24,"s":N},{"id":25,"s":N},{"id":26,"s":N},{"id":27,"s":N}]}
24=External Trust 25=Internal Trust 26=Risk Tolerance 27=ROI Ownership` },
                { role: 'user', content: transcript },
              ],
              temperature: 0.1,
              max_tokens: 80,
              response_format: { type: 'json_object' },
            })
          )).choices[0]?.message?.content || '';

      const r = JSON.parse(txt || '{}');
      console.log(`[P7] ${Date.now()-t}ms`);
      return (r.i || r.indicators || []).map((x: any) => ({ id: x.id, name: ['','','','','','','','','','','','','','','','','','','','','','','','','External Trust','Internal Trust','Risk Tolerance','ROI Ownership'][x.id], score: x.s || x.score || 5, pillarId: 'P7' }));
    } catch (e) { console.error('[P7] err'); return [{id:24,name:'External Trust',score:5,pillarId:'P7'},{id:25,name:'Internal Trust',score:5,pillarId:'P7'},{id:26,name:'Risk Tolerance',score:5,pillarId:'P7'},{id:27,name:'ROI Ownership',score:5,pillarId:'P7'}]; }
  }

  // ============================================================
  // MODEL 4: LUBOMETER (Buying Readiness)
  // Uses 7 PARALLEL AI models - one per pillar for faster scoring
  // Self-contained: scores its own indicators, then calculates
  // ============================================================
  private async analyzeModel4_Lubometer(
    transcript: string,
    customWeights?: { id: string; weight: number }[],
    sendStream?: (scope: string, event: 'start' | 'delta' | 'done', delta?: string) => void
  ): Promise<any> {
    try {
      const startTime = Date.now();
      
      // Build weight map from custom weights or use defaults
      const defaultWeights: Record<string, number> = { P1: 1.5, P2: 1.0, P3: 1.0, P4: 1.5, P5: 1.0, P6: 1.5, P7: 1.5 };
      const weightMap: Record<string, number> = { ...defaultWeights };
      if (customWeights && Array.isArray(customWeights)) {
        customWeights.forEach(w => {
          if (w.id && typeof w.weight === 'number') {
            weightMap[w.id] = w.weight;
          }
        });
      }
      console.log(`[MODEL 4] Using weights:`, Object.entries(weightMap).map(([k, v]) => `${k}:${v}`).join(', '));
      
      // Step 1: Score indicators using 7 PARALLEL AI models (one per pillar)
      console.log(`[MODEL 4] Starting 7 parallel pillar scorers...`);

      const [ind1, ind2, ind3, ind4, ind5, ind6, ind7] = await Promise.all([
        this.scorePillar1(transcript, this.makeStreamSink(sendStream, 'lubometer_p1')),
        this.scorePillar2(transcript, this.makeStreamSink(sendStream, 'lubometer_p2')),
        this.scorePillar3(transcript, this.makeStreamSink(sendStream, 'lubometer_p3')),
        this.scorePillar4(transcript, this.makeStreamSink(sendStream, 'lubometer_p4')),
        this.scorePillar5(transcript, this.makeStreamSink(sendStream, 'lubometer_p5')),
        this.scorePillar6(transcript, this.makeStreamSink(sendStream, 'lubometer_p6')),
        this.scorePillar7(transcript, this.makeStreamSink(sendStream, 'lubometer_p7')),
      ]);
      
      console.log(`[MODEL 4] All 7 pillar scorers completed in ${Date.now() - startTime}ms`);
      
      // Combine all indicators from the 7 models
      const allIndicators = [...ind1, ...ind2, ...ind3, ...ind4, ...ind5, ...ind6, ...ind7];
      const indicators = this.validateIndicators(allIndicators);
      console.log(`[MODEL 4] Validated ${indicators.length} indicators from parallel scoring`);

      // Step 2: Calculate pillars with custom weights
      const pillarCalculator = getPillarCalculator();
      const truthIndexCalculator = getTruthIndexCalculator();
      const lubometerCalculator = getLubometerCalculator();

      // Calculate pillars with dynamic weights
      const pillars = await pillarCalculator.calculatePillarsWithWeights(indicators, weightMap);
      console.log(`[MODEL 4] Calculated ${pillars.length} pillars:`, pillars.map(p => `${p.id}=${p.averageScore.toFixed(1)}`).join(', '));
      
      const truthIndex = await truthIndexCalculator.calculate(pillars, indicators);
      console.log(`[MODEL 4] Truth Index: ${truthIndex.score}, penalties: ${truthIndex.penalties.length}`);
      
      const lubometer = lubometerCalculator.calculate(pillars, truthIndex);
      console.log(`[MODEL 4] Lubometer: raw=${lubometer.rawScore.toFixed(1)}, final=${lubometer.finalScore.toFixed(1)}, tiers:`, lubometer.priceTiers.map(t => `${t.label}=${t.readiness}%`).join(', '));

      // Check close blockers
      const p1 = pillars.find(p => p.id === 'P1');
      const p2 = pillars.find(p => p.id === 'P2');
      const p4 = pillars.find(p => p.id === 'P4');
      const p6 = pillars.find(p => p.id === 'P6');

      const closeBlockers: string[] = [];
      if (p1 && p2 && p1.averageScore <= 6 && p2.averageScore <= 5) {
        closeBlockers.push('Not enough pain or urgency');
      }
      const p6Raw = p6 ? 11 - p6.averageScore : 5;
      if (p6Raw >= 7 && p4 && p4.averageScore <= 5) {
        closeBlockers.push('High price sensitivity + low money');
      }

      // Determine readiness zone
      let readinessZone: string;
      if (closeBlockers.length > 0) {
        readinessZone = 'no-go';
      } else if (lubometer.finalScore >= 70) {
        readinessZone = 'green';
      } else if (lubometer.finalScore >= 50) {
        readinessZone = 'yellow';
      } else if (lubometer.finalScore >= 30) {
        readinessZone = 'red';
      } else {
        readinessZone = 'no-go';
      }

      const totalPenalty = truthIndex.penalties.reduce((sum, p) => sum + (p.triggered ? p.penalty : 0), 0);

      return {
        rawScore: Math.round(lubometer.rawScore),
        penalties: totalPenalty,
        penaltyList: truthIndex.penalties.filter(p => p.triggered).map(p => ({
          rule: p.ruleId,
          description: p.description,
          points: -p.penalty
        })),
        finalScore: Math.round(lubometer.finalScore),
        readinessZone,
        priceTiers: lubometer.priceTiers,
        closeBlockers,
        pillars: pillars.map(p => ({
          id: p.id,
          name: p.name,
          score: p.averageScore,
          weight: weightMap[p.id] ?? 1.0
        })),
        indicators
      };
    } catch (error) {
      console.error('[MODEL 4] Error:', error);
      return {
        rawScore: 0, penalties: 0, penaltyList: [], finalScore: 0,
        readinessZone: 'no-go',
        priceTiers: [
          { price: 2997, readiness: 0, label: 'Starter' },
          { price: 7997, readiness: 0, label: 'Professional' },
          { price: 15997, readiness: 0, label: 'Elite' }
        ],
        closeBlockers: [], pillars: [], indicators: []
      };
    }
  }

  // ============================================================
  // MODEL 5: TRUTH INDEX (Incoherence Detection - CSV Rules)
  // Detects contradictions and calculates truth/authenticity score
  // ============================================================
  private async analyzeModel5_TruthIndex(
    transcript: string,
    sendStream?: (scope: string, event: 'start' | 'delta' | 'done', delta?: string) => void
  ): Promise<any> {
    try {
      const streamSink = this.makeStreamSink(sendStream, 'truth_index');
      const content = await this.streamChatCompletionToText({
        pool: 'main',
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a truth/authenticity analyzer for SALES CONVERSATIONS.

CONTEXT: This is a conversation between a CLOSER (salesperson) and a PROSPECT (potential buyer). 
Analyze the PROSPECT's responses for authenticity and coherence.

⚠️ SCORING RULE: START AT 70, THEN ADJUST UP OR DOWN

CALCULATION METHOD:
1. Start with BASE SCORE = 70
2. Add points for positive signals (can go UP to 100)
3. Subtract points for negative signals (can go DOWN to 0)

POSITIVE SIGNALS (INCREASE score from 70):
- Specific details and real examples: +5 to +15
- Admits challenges, fears, or concerns: +5 to +10
- Consistent answers throughout: +3 to +8
- Shows genuine emotion: +3 to +8
- Takes ownership of their situation: +5 to +10
- Asks thoughtful questions: +2 to +5

NEGATIVE SIGNALS (DECREASE score from 70):
- Vague, generic answers: -5 to -15
- Contradicts earlier statements: -10 to -20
- People-pleasing "yes" without substance: -5 to -10
- Blames external factors: -5 to -10
- Avoids direct questions: -5 to -10

INCOHERENCE PENALTIES (major contradictions):
- High PAIN but no URGENCY: -15
- Wants CHANGE but won't DECIDE: -15  
- Has MONEY but resists PRICE: -10
- Claims AUTHORITY but needs approval: -10
- Wants RESULTS but avoids RESPONSIBILITY: -15

SCORE INTERPRETATION:
- 85-100: Very authentic, honest prospect
- 70-84: Mostly honest, some areas unclear
- 50-69: Mixed signals, needs more probing
- 30-49: Defensive or evasive
- 0-29: Highly inconsistent, likely not genuine

RETURN JSON:
{
  "score": 70,
  "adjustment": "+5 for specific details, -8 for vague timeline = net -3",
  "penalties": [],
  "positiveSignals": ["List actual positive things they said"],
  "negativeSignals": ["List actual concerning things"],
  "explanation": "Brief summary of their authenticity"
}`
          },
          {
            role: 'user',
            content: `Analyze the PROSPECT's authenticity in this sales conversation between a closer and prospect:\n\n${transcript}`
          }
        ],
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        streamSink,
      });
      if (!content) return { score: 70, penalties: [], explanation: 'No analysis' };
      
      const result = JSON.parse(content);
      
      // Use the AI-calculated score directly (it already accounts for penalties)
      const score = Math.max(0, Math.min(100, result.score || 70));
      
      return {
        score,
        penalties: result.penalties || [],
        explanation: result.explanation || '',
        positiveSignals: result.positiveSignals || [],
        negativeSignals: result.negativeSignals || []
      };
    } catch (error) {
      console.error('[MODEL 5] Error:', error);
      return { score: 70, penalties: [], explanation: 'Analysis error' };
    }
  }

  // ============================================================
  // MODEL 6: RED FLAGS (Warning Signs - CSV Rules)
  // Detects close blockers and warning signs from CSV
  // ============================================================
  private async analyzeModel6_RedFlags(transcript: string): Promise<any[]> {
    try {
      const response = await withOpenAIPool('main', () => this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a red flag detector for SALES CONVERSATIONS.

CONTEXT: This is a conversation between a CLOSER (salesperson) and a PROSPECT (potential buyer).
Your job is to find WARNING SIGNS in what the PROSPECT actually says.

⚠️ CRITICAL: Only flag things the PROSPECT ACTUALLY SAID in the transcript. 
DO NOT invent or assume red flags. If something wasn't said, don't flag it.

RED FLAG CATEGORIES:

1. CLOSE BLOCKERS (serious - may prevent sale):
   - Prospect shows no real pain or problem to solve
   - Prospect has no urgency or timeline
   - Prospect can't afford it AND is price sensitive
   - Quote their actual words as evidence

2. INCOHERENCE (contradictions in what they say):
   - Says they have big pain but "no rush" to fix it
   - Says they want change but won't make a decision
   - Says they have money but keeps objecting on price
   - Claims to be the decision maker but mentions needing approval
   - Quote the contradiction as evidence

3. BEHAVIORAL (warning patterns):
   - Uses procrastination language ("maybe later", "someday", "I'll think about it")
   - Avoids answering direct questions
   - Blames others/external factors repeatedly
   - Quote their actual words

RULES:
- ONLY include red flags with EVIDENCE from the transcript
- If the prospect hasn't said anything concerning, return empty array
- Maximum 3 red flags (most important ones only)
- Include their actual quote as evidence

RETURN JSON:
{
  "redFlags": [
    {"text": "Prospect said 'I'll think about it' - procrastination signal", "severity": "medium", "evidence": "I'll think about it"}
  ]
}

Return empty array if NO red flags: {"redFlags": []}`
          },
          {
            role: 'user',
            content: `Analyze this sales conversation for red flags. ONLY flag things the prospect ACTUALLY said:\n\n${transcript}`
          }
        ],
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: 'json_object' }
      }));

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const result = JSON.parse(content);
      const flags = result.redFlags || [];
      
      // Only return flags that have actual evidence
      return flags.slice(0, 3).map((flag: any) => ({
        text: flag.text,
        severity: flag.severity || 'medium',
        evidence: flag.evidence || ''
      }));
    } catch (error) {
      console.error('[MODEL 6] Error:', error);
      return [];
    }
  }

  // Model 3: Generate Personalized Handling Scripts (separate model)
  // Generates 1 script per detected objection - CACHED to avoid regeneration
  private async generateObjectionScriptsModel(transcript: string, objections: any[], customPrompt?: string): Promise<Record<string, any>> {
    // If no objections, return empty
    if (!objections || objections.length === 0) {
      return {};
    }

    // Check cache first - return cached scripts for objections we've already seen
    const cachedScripts: Record<string, any> = {};
    const newObjections: any[] = [];
    
    for (const obj of objections) {
      const hash = this.getObjectionHash(obj);
      const cached = this.scriptCache.get(hash);
      
      if (cached && typeof cached === 'object' && cached.scripts) {
        console.log(`[CACHE HIT] Scripts for "${obj.text?.substring(0, 30)}..." → mapping to ${obj.id}`);
        
        // RE-KEY cached scripts to match current objection ID
        const originalScripts = cached.scripts;
        
        // Generate new keys based on current objection ID
        let scriptIndex = 1;
        for (const [_, script] of Object.entries(originalScripts)) {
          const newKey = `${obj.id}_${scriptIndex}`;
          cachedScripts[newKey] = script;
          scriptIndex++;
        }
      } else {
        newObjections.push(obj);
      }
    }

    // If all objections are cached, return cached scripts immediately
    if (newObjections.length === 0) {
      console.log(`[CACHE] All ${objections.length} objections have cached scripts, returning cached`);
      console.log(`[CACHE] Returning scripts:`, Object.keys(cachedScripts));
      return cachedScripts;
    }

    console.log(`[CACHE] ${objections.length - newObjections.length} cached, ${newObjections.length} new objections need scripts`);

    // Build custom prompt addition if provided
    const customPromptSection = customPrompt && customPrompt.trim() 
      ? `\n\n⭐ ADDITIONAL CONTEXT FROM ADMIN: ${customPrompt.trim()}\n`
      : '';

    try {
      const response = await withOpenAIPool('main', () => this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert sales script writer. Generate personalized handling scripts for SPECIFIC objections.

⚠️ CRITICAL RULE: You will receive a list of DETECTED OBJECTIONS. You MUST generate scripts for THOSE EXACT OBJECTIONS.
- Use the EXACT objection text as the title
- Do NOT substitute with different objections
- Do NOT use examples from training - use the ACTUAL objections passed to you
${customPromptSection}
SCRIPT WRITING TECHNIQUES (use as inspiration, write YOUR OWN notes):
- Open-ended questions that guide self-discovery
- Questions that help them realize the answer themselves  
- Challenge their patterns/thinking when appropriate
- Direct, bold statements when needed

For EACH DETECTED OBJECTION, create a script with:
1. Title: The EXACT objection text in quotes (copy from input)
2. Dial Trigger: Which psychological patterns triggered this
3. Steps: EXACTLY 2 conversation steps with:
   - step: Sequential number (1, 2)
   - text: What to say - PERSONALIZE based on conversation
   - pause: Optional ("1s", "2s")

Script requirements:
- Title MUST match the exact objection text passed to you
- Reference what the prospect actually said
- Personalize based on conversation context
- Guide through objection to resolution
- Do NOT invent or assume names - only use names if explicitly mentioned in conversation

RETURN JSON:
{
  "objectionScripts": {
    "[objectionId]_1": {
      "title": "[EXACT objection text from input]",
      "dialTrigger": "...",
      "steps": [...]
    }
  }
}

Generate EXACTLY 1 script per objection. Key must be: objId_1.`
          },
          {
            role: 'user',
            content: `⚠️ THESE ARE THE EXACT OBJECTIONS - use these exact texts as titles:\n${newObjections.map(o => `- ID: ${o.id}, TEXT: "${o.text}"`).join('\n')}\n\n---\nCONVERSATION CONTEXT:\n${transcript}\n---\n\nGENERATE SCRIPTS FOR THESE EXACT OBJECTIONS:
${newObjections.map(o => `• "${o.text}" → Generate script: ${o.id}_1`).join('\n')}

CRITICAL:
- The script TITLE must be the EXACT objection text from above
- Do NOT invent different objections - use EXACTLY what was detected
- 1 script per objection
- Personalize based on conversation context`
          }
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      }));

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error('No content in script generation model response');
        return cachedScripts; // Return cached even on error
      }

      const result = JSON.parse(content);
      const newScripts = result.objectionScripts || {};

      // Cache new scripts by objection hash - store scripts as array for easy re-keying
      for (const obj of newObjections) {
        const hash = this.getObjectionHash(obj);
        // Collect all scripts for this objection (obj1_1, obj1_2, etc.)
        const objScriptsArray: any[] = [];
        for (const [scriptId, script] of Object.entries(newScripts)) {
          if (scriptId.startsWith(`${obj.id}_`)) {
            objScriptsArray.push(script);
          }
        }
        // Cache scripts as array for easy re-keying later
        if (objScriptsArray.length > 0) {
          this.scriptCache.set(hash, { 
            scripts: Object.fromEntries(objScriptsArray.map((s, i) => [`_${i+1}`, s])),
          });
          // Cap cache size (Map preserves insertion order)
          while (this.scriptCache.size > GPTConversationAnalyzer.MAX_SCRIPT_CACHE_ITEMS) {
            const oldestKey = this.scriptCache.keys().next().value;
            if (!oldestKey) break;
            this.scriptCache.delete(oldestKey);
          }
          if (GPTConversationAnalyzer.DEBUG) {
            console.log(`[CACHE SET] Cached ${objScriptsArray.length} scripts for "${obj.text?.substring(0, 30)}..." (${obj.id})`);
          }
        }
      }

      // Merge cached + new scripts and return
      const allScripts = { ...cachedScripts, ...newScripts };
      if (GPTConversationAnalyzer.DEBUG) {
        console.log(`[SCRIPTS] Returning ${Object.keys(allScripts).length} total scripts:`, Object.keys(allScripts));
      }
      return allScripts;
    } catch (error) {
      console.error('Error in script generation model:', error);
      return {};
    }
  }

  // Generate scripts ONLY for objections we haven't seen before (CACHED) - Legacy method, kept for backward compatibility
  private async generateScriptsForNewObjections(transcript: string, objections: any[]): Promise<Record<string, any>> {
    if (!objections || objections.length === 0) {
      return {};
    }

    const scripts: Record<string, any> = {};
    const newObjections: any[] = [];

    // Check cache for existing scripts
    for (const obj of objections) {
      const hash = this.getObjectionHash(obj);
      const cached = this.scriptCache.get(hash);
      
      if (cached) {
        if (GPTConversationAnalyzer.DEBUG) console.log(`[Cache HIT] Script for "${obj.text?.substring(0, 30)}..."`);
        scripts[obj.id] = cached;
      } else {
        newObjections.push(obj);
      }
    }

    // Only generate scripts for NEW objections
    if (newObjections.length > 0) {
      if (GPTConversationAnalyzer.DEBUG) console.log(`[Cache MISS] Generating ${newObjections.length} new script(s)...`);
      const newScripts = await this.generateObjectionScripts(transcript, newObjections);
      
      // Add to cache and results
      for (const obj of newObjections) {
        const hash = this.getObjectionHash(obj);
        if (newScripts[obj.id]) {
          this.scriptCache.set(hash, newScripts[obj.id]);
          while (this.scriptCache.size > GPTConversationAnalyzer.MAX_SCRIPT_CACHE_ITEMS) {
            const oldestKey = this.scriptCache.keys().next().value;
            if (!oldestKey) break;
            this.scriptCache.delete(oldestKey);
          }
          scripts[obj.id] = newScripts[obj.id];
        }
      }
    }

    return scripts;
  }

  // Model 2: Generate objection scripts (runs in parallel after Model 1)
  private async generateObjectionScripts(transcript: string, objections: any[]): Promise<Record<string, any>> {
    if (!objections || objections.length === 0) {
      return {};
    }

    try {
      const SCRIPT_PROMPT = `You are an expert sales script writer. Generate personalized objection handling scripts based on the conversation and detected objections.

OBJECTION HANDLING APPROACHES (use as inspiration, but generate YOUR OWN natural descriptions):
- Use open-ended questions that guide self-discovery
- Ask questions that help them realize the answer themselves
- Challenge their patterns/thinking when appropriate
- Use direct, bold statements that cut through when needed

IMPORTANT: DO NOT copy technique names like "PEARL Prompt" or "David (Self-led Insight)" into your notes. Generate YOUR OWN natural, descriptive notes.

For EACH objection provided, create a script with:
1. Title: The objection text in quotes
2. Dial Trigger: Which psychological patterns triggered this (e.g., "Commitment to Decide + Validation Seeker")
3. Steps: EXACTLY 2 conversation steps with step number, text (what to say), optional pause, optional note

Script style:
- Reference specific things the prospect said
- Use the CSV technique APPROACHES as inspiration, but write YOUR OWN natural, descriptive notes
- Personalize to conversation context
- Guide through objection to resolution
- End with clear close
- Notes should describe WHAT the step does in natural language (e.g., "Open up the conversation", "Help them see the value themselves", "Wait for their response"), NOT technique names

Return ONLY a JSON object with objectionScripts field:
{
  "objectionScripts": {
    "obj1": {
      "title": "\\"Objection text\\"",
      "dialTrigger": "Pattern names",
      "steps": [
        { "step": 1, "text": "...", "pause": "1s", "note": "..." },
        ...
      ]
    },
    ...
  }
}`;

      const response = await withOpenAIPool('main', () => this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: SCRIPT_PROMPT
          },
          {
            role: 'user',
            content: `Generate scripts for these objections:\n\n${JSON.stringify(objections, null, 2)}\n\n---\nCONVERSATION:\n${transcript}\n---\n\nGenerate personalized scripts:`
          }
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      }));

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error('No content in script generation response');
        return {};
      }

      const result = JSON.parse(content);
      return result.objectionScripts || {};
    } catch (error) {
      console.error('Error generating scripts (Model 2):', error);
      return {};
    }
  }

  // Validate dial color - replace black/grey with vibrant alternatives
  private validateDialColor(color: string): string {
    if (!color) {
      return 'from-cyan-500 to-blue-500'; // Default vibrant color
    }
    
    // Replace any black/grey/slate colors with vibrant alternatives
    const badColors = [
      /from-gray-\d+/i,
      /from-grey-\d+/i,
      /from-black-\d+/i,
      /from-slate-\d+/i,
      /to-gray-\d+/i,
      /to-grey-\d+/i,
      /to-black-\d+/i,
      /to-slate-\d+/i,
    ];
    
    let cleanedColor = color;
    for (const pattern of badColors) {
      if (pattern.test(cleanedColor)) {
        // Replace with vibrant cyan/blue gradient
        cleanedColor = cleanedColor.replace(pattern, cleanedColor.includes('from-') ? 'from-cyan-500' : 'to-blue-500');
      }
    }
    
    return cleanedColor;
  }

  // Compute calculations (pillars, lubometer, truth index, red flags) - can run in parallel
  private async computeCalculations(indicators: IndicatorScore[]): Promise<{
    pillars: any[];
    truthIndex: any;
    lubometer: any;
    redFlags: any[];
  }> {
    const pillarCalculator = getPillarCalculator();
    const truthIndexCalculator = getTruthIndexCalculator();
    const lubometerCalculator = getLubometerCalculator();
    const redFlagsDetector = getRedFlagsDetector();

    // Calculate pillars
    const pillars = await pillarCalculator.calculatePillars(indicators);

    // Calculate truth index
    const truthIndex = await truthIndexCalculator.calculate(pillars, indicators);

    // Calculate lubometer
    const lubometer = lubometerCalculator.calculate(pillars, truthIndex);

    // Detect red flags
    const redFlags = await redFlagsDetector.detect(indicators, pillars, truthIndex);

    return {
      pillars,
      truthIndex,
      lubometer,
      redFlags,
    };
  }

  // Combine all results into final AnalysisResult
  private async combineResults(
    analysisResult: { indicators: IndicatorScore[]; objections?: any[]; psychologicalDials?: any[]; objectionScripts?: any },
    calculationResult: { pillars: any[]; truthIndex: any; lubometer: any; redFlags: any[] }
  ): Promise<AnalysisResult> {
    const { indicators, objections: gptObjections, psychologicalDials: gptDials, objectionScripts: gptScripts } = analysisResult;
    const { pillars, truthIndex, lubometer, redFlags } = calculationResult;

    // Process objections
    const objectionDetector = getObjectionDetector();
    let objections;
    if (gptObjections && gptObjections.length > 0) {
      objections = gptObjections.slice(0, 5).map(obj => ({
        id: obj.id || `obj-${Math.random().toString(36).substring(7)}`,
        text: obj.text,
        probability: Math.max(0, Math.min(100, obj.probability || 50)),
        relatedIndicators: obj.indicator ? [obj.indicator] : [],
      }));
    } else {
      const detected = await objectionDetector.detectObjections(indicators);
      objections = detected.slice(0, 5);
    }

    // Process psychological dials (with color validation)
    const psychologicalDialsAnalyzer = getPsychologicalDialsAnalyzer();
    let psychologicalDials;
    if (gptDials && gptDials.length > 0) {
      psychologicalDials = gptDials.slice(0, 5).map(dial => ({
        name: dial.name,
        intensity: Math.max(0, Math.min(100, dial.intensity || 50)),
        color: this.validateDialColor(dial.color), // Ensure no black/grey
      }));
    } else {
      const analyzed = await psychologicalDialsAnalyzer.analyze(indicators);
      psychologicalDials = analyzed.map(dial => ({
        name: dial.name,
        intensity: dial.intensity,
        color: this.validateDialColor(dial.color), // Ensure no black/grey
      }));
    }

    return {
      timestamp: Date.now(),
      conversationLength: this.conversationHistory.length,
      indicators,
      pillars,
      lubometer,
      truthIndex,
      objections,
      psychologicalDials,
      redFlags: redFlags.map(flag => ({
        text: flag.text,
        severity: flag.severity,
      })),
      objectionScripts: gptScripts || {},
    };
  }


  private validateIndicators(gptIndicators: any[]): IndicatorScore[] {
    const defaultIndicators = this.getDefaultIndicators();
    const indicatorMap = new Map<number, IndicatorScore>();
    
    // First, create map from defaults
    defaultIndicators.forEach(ind => indicatorMap.set(ind.id, ind));
    
    // Then update with GPT results
    gptIndicators.forEach(gptInd => {
      if (gptInd.id >= 1 && gptInd.id <= 27) {
        indicatorMap.set(gptInd.id, {
          id: gptInd.id,
          name: gptInd.name || defaultIndicators[gptInd.id - 1].name,
          score: Math.max(1, Math.min(10, gptInd.score || 5)),
          pillarId: gptInd.pillarId || defaultIndicators[gptInd.id - 1].pillarId,
          evidence: Array.isArray(gptInd.evidence) ? gptInd.evidence : [],
        });
      }
    });
    
    return Array.from(indicatorMap.values()).sort((a, b) => a.id - b.id);
  }

  private getDefaultResult(): AnalysisResult {
    const defaultIndicators = this.getDefaultIndicators();
    
    // Use calculators even for defaults to ensure correct structure
    return {
      timestamp: Date.now(),
      conversationLength: 0,
      indicators: defaultIndicators,
      pillars: [],
      lubometer: {
        rawScore: 0,
        penalties: 0,
        finalScore: 0,
        readinessZone: 'no-go',
        priceTiers: [
          { price: 2997, readiness: 0, label: 'Starter' },
          { price: 7997, readiness: 0, label: 'Professional' },
          { price: 15997, readiness: 0, label: 'Elite' }
        ],
      },
      truthIndex: {
        score: 70,
        penalties: [],
        explanation: 'Starting score - awaiting conversation data',
      },
      objections: [],
      psychologicalDials: [],
      redFlags: [],
      objectionScripts: {},
    };
  }

  private getDefaultIndicators(): IndicatorScore[] {
    const indicatorNames = [
      'Pain Awareness', 'Desire Clarity', 'Desire Priority', 'Duration of Dissatisfaction',
      'Time Pressure', 'Perceived Cost of Delay', 'Internal Timing Activation', 'Environmental Availability',
      'Decision-Making Authority', 'Decision-Making Style', 'Commitment to Decide', 'Self-Permission to Choose',
      'Resource Access', 'Resource Fluidity', 'Investment Mindset', 'Resourcefulness',
      'Problem Recognition', 'Solution Ownership', 'Locus of Control', 'Integrity: Desire vs Action',
      'Emotional Response to Spending', 'Negotiation Reflex', 'Structural Rigidity',
      'External Trust', 'Internal Trust', 'Risk Tolerance', 'ROI Ownership Framing'
    ];
    
    const pillarMapping = ['P1','P1','P1','P1', 'P2','P2','P2','P2', 'P3','P3','P3','P3', 
                          'P4','P4','P4','P4', 'P5','P5','P5','P5', 'P6','P6','P6', 'P7','P7','P7','P7'];
    
    return indicatorNames.map((name, index) => ({
      id: index + 1,
      name,
      score: 5,
      pillarId: pillarMapping[index],
      evidence: []
    }));
  }
}

// Singleton instance
let analyzerInstance: GPTConversationAnalyzer | null = null;

export function getGPTAnalyzer(apiKey: string): GPTConversationAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new GPTConversationAnalyzer(apiKey);
  }
  return analyzerInstance;
}
