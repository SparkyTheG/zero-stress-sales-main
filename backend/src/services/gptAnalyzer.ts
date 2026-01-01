import OpenAI from 'openai';
import type { IndicatorScore } from '../types/analysis.js';
import { getPillarCalculator } from './pillarCalculator.js';
import { getTruthIndexCalculator } from './truthIndexCalculator.js';
import { getLubometerCalculator } from './lubometerCalculator.js';
import { getObjectionDetector } from './objectionDetector.js';
import { getPsychologicalDialsAnalyzer } from './psychologicalDialsAnalyzer.js';
import { getRedFlagsDetector } from './redFlagsDetector.js';
import type { AnalysisResult } from '../types/analysis.js';

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
      "truthLevel": 78,
      "moneyStyle": "Investment-minded, seeks premium solutions",
      "steps": [
        { "step": 1, "text": "I totally get that... and thank you for being honest with me.", "pause": "1s" },
        { "step": 2, "text": "Based on what you shared earlier, this isn't really about needing time to think...", "pause": "1.5s", "note": "Reference specific conversation details" },
        ... (5-8 steps total with personalized text, pauses, and notes)
      ]
    },
    ... (generate a script for EACH detected objection, keyed by objection id)
  }
}

## OBJECTION HANDLING SCRIPTS INSTRUCTIONS:
For EACH objection detected, generate a personalized handling script using the Indicators and Objection Matrix CSV approach. Each script should:

1. Title: The objection text in quotes (e.g., "\"Can I sleep on it?\"")
2. Dial Trigger: List the psychological dials/hot buttons that triggered this objection (e.g., "Commitment to Decide + Validation Seeker")
3. Truth Level: Use the Truth Index score (estimate 70-85 if not calculated, or based on indicator coherence)
4. Money Style: Based on money-related indicators (P4) - e.g., "Investment-minded", "Price-sensitive", "Resourceful", "Has capital, questions ROI"
5. Steps: 5-8 conversation steps with:
   - step: Sequential number (1, 2, 3...)
   - text: What to say - PERSONALIZE based on actual conversation context, use techniques from CSV (PEARL prompts, David/Calvin/Carone approaches)
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
      truthLevel: number;
      moneyStyle: string;
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
  }

  getFullTranscript(): string {
    return this.conversationHistory.join('\n');
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  async analyze(): Promise<AnalysisResult> {
    const transcript = this.getFullTranscript();
    
    if (!transcript || transcript.trim().length === 0) {
      return this.getDefaultResult();
    }

    try {
      const startTime = Date.now();
      console.log('[6-MODEL] Starting all 6 specialized models in parallel...');

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
        ? await this.analyzeModel3_Scripts(transcript, objections)
        : {};
      
      console.log(`[6-MODEL] All models completed in ${Date.now() - startTime}ms`);
      
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
      
      console.log(`[TOTAL] Analysis completed in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      console.error('Error analyzing with 6 models:', error);
      return this.getDefaultResult();
    }
  }

  // Progressive analysis - 6 PARALLEL AI models, each with specialized prompts
  // Each model ONLY analyzes what's relevant to its specific task for maximum speed
  async analyzeProgressive(sendPartial: (type: string, data: any) => void): Promise<void> {
    const transcript = this.getFullTranscript();
    
    if (!transcript || transcript.trim().length === 0) {
      return;
    }

    try {
      const startTime = Date.now();
      console.log('[6-MODEL PARALLEL] Starting all 6 specialized models simultaneously...');

      // ALL 6 MODELS RUN IN PARALLEL - each has its own specialized prompt
      
      // Model 1: Psychological Dials - ONLY analyzes emotional/psychological patterns
      const psychologicalDialsPromise = this.analyzeModel1_PsychologicalDials(transcript).then(result => {
        console.log(`[MODEL 1 - DIALS] ✓ Completed in ${Date.now() - startTime}ms`);
        sendPartial('analysis_partial', { psychologicalDials: result });
        return result;
      });

      // Model 2: Objections Detection - ONLY detects objections from speech
      const objectionsPromise = this.analyzeModel2_Objections(transcript).then(result => {
        console.log(`[MODEL 2 - OBJECTIONS] ✓ Completed in ${Date.now() - startTime}ms, found ${result?.length || 0}`);
        sendPartial('analysis_partial', { objections: result });
        return result;
      });

      // Model 3: Scripts - Waits for objections, then generates 5 scripts per objection
      const scriptsPromise = objectionsPromise.then(objections => {
        if (!objections || objections.length === 0) {
          console.log(`[MODEL 3 - SCRIPTS] No objections, skipping`);
          return {};
        }
        return this.analyzeModel3_Scripts(transcript, objections).then(result => {
          console.log(`[MODEL 3 - SCRIPTS] ✓ Completed in ${Date.now() - startTime}ms, ${Object.keys(result).length} scripts`);
          sendPartial('analysis_scripts', { objectionScripts: result });
          return result;
        });
      });

      // Model 4: Lubometer - ONLY analyzes indicators relevant to buying readiness
      const lubometerPromise = this.analyzeModel4_Lubometer(transcript).then(result => {
        console.log(`[MODEL 4 - LUBOMETER] ✓ Completed in ${Date.now() - startTime}ms, score: ${result.finalScore}`);
        sendPartial('analysis_partial', { 
          lubometer: result,
          pillars: result.pillars,
          indicators: result.indicators
        });
        return result;
      });

      // Model 5: Truth Index - ONLY analyzes for incoherence signals
      const truthIndexPromise = this.analyzeModel5_TruthIndex(transcript).then(result => {
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
  private async analyzeModel1_PsychologicalDials(transcript: string): Promise<any[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a sales indicator analyzer. Score ALL 27 indicators and return the TOP 5 highest-scoring ones.

THE 27 INDICATORS (from CSV) - Score each 1-10, return TOP 5:

PILLAR 1 - Perceived Spread (Pain & Desire):
1. Pain Awareness - How aware are they of their problem?
2. Desire Clarity - How clear is their vision of what they want?
3. Desire Priority - How important is solving this to them?
4. Duration of Dissatisfaction - How long have they lived with this?

PILLAR 2 - Urgency:
5. Time Pressure - Is there an external deadline?
6. Cost of Delay - What's at stake if they wait?
7. Internal Timing - Is something internal driving urgency?
8. Environmental Availability - Can they engage now?

PILLAR 3 - Decisiveness:
9. Decision Authority - Are they the decision maker?
10. Decision Style - How do they typically decide?
11. Commitment to Decide - Are they ready to commit?
12. Self-Permission - Do they give themselves permission?

PILLAR 4 - Available Money:
13. Resource Access - Do they have funds available?
14. Resource Fluidity - Can they move money around?
15. Investment Mindset - Do they see value in investing?
16. Resourcefulness - Would they find a way if motivated?

PILLAR 5 - Responsibility & Ownership:
17. Problem Recognition - Do they own the problem?
18. Solution Ownership - Do they own the solution?
19. Locus of Control - Do they believe they control outcomes?
20. Integrity (Desire vs Action) - Do they follow through?

PILLAR 6 - Price Sensitivity:
21. Emotional Spending - How do they feel about spending?
22. Negotiation Reflex - Do they try to negotiate?
23. Structural Rigidity - Do they need flexible terms?

PILLAR 7 - Trust:
24. External Trust - Do they trust you/the offer?
25. Internal Trust - Do they trust themselves?
26. Risk Tolerance - Are they comfortable with uncertainty?
27. ROI Ownership - Do they own the ROI?

SCORING: 1-3=Low, 4-6=Moderate, 7-10=High

Return TOP 5 indicators with HIGHEST intensity (convert score to 0-100 scale: score × 10).

RETURN JSON:
{"psychologicalDials": [
  {"name": "Pain Awareness", "intensity": 80, "color": "from-red-500 to-orange-500", "indicatorId": 1},
  {"name": "Commitment to Decide", "intensity": 70, "color": "from-blue-500 to-cyan-500", "indicatorId": 11}
]}

COLORS BY PILLAR:
P1 (1-4): "from-red-500 to-orange-500"
P2 (5-8): "from-orange-500 to-amber-500"
P3 (9-12): "from-blue-500 to-cyan-500"
P4 (13-16): "from-emerald-500 to-teal-500"
P5 (17-20): "from-purple-500 to-pink-500"
P6 (21-23): "from-amber-500 to-yellow-500"
P7 (24-27): "from-cyan-500 to-teal-500"`
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
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
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an objection detector. Your job is to find ALL potential objections and concerns in the conversation.

IMPORTANT: Always try to find 3-5 objections. Look for both explicit objections AND implied hesitations.

OBJECTION CATEGORIES (detect similar phrases):
1. PAIN/DESIRE OBJECTIONS:
   - "Things aren't that bad" / "It's not urgent" / "I'm managing fine"
   - "I'm not sure what I want" / "I haven't thought about it"
   - "This isn't a priority" / "Maybe later"

2. TIMING/URGENCY OBJECTIONS:
   - "I'm not in a rush" / "No deadline"
   - "I'll think about it later" / "Not the right time"
   - "It's a busy period" / "Bad timing"

3. DECISION OBJECTIONS:
   - "I need to ask my partner/spouse/boss" / "Not just my decision"
   - "I need to think about it" / "Let me sleep on it"
   - "I'm not sure" / "What if it doesn't work?"

4. MONEY OBJECTIONS:
   - "I don't have the budget" / "Too expensive" / "Can't afford it"
   - "Is there a discount?" / "Can you do better on price?"
   - "I need to check my finances"

5. TRUST/RISK OBJECTIONS:
   - "I'm not sure it'll work for me" / "I've tried things before"
   - "I need more proof" / "What's the guarantee?"
   - "What if I fail?" / "I'm worried about..."

RULES:
- Find 3-5 objections minimum (look for subtle hesitations too)
- Use their ACTUAL words when possible
- Assign probability 60-95 based on how explicit the objection is
- Map to indicator number (1-27)

RETURN JSON with 3-5 objections:
{"objections": [
  {"id": "obj1", "text": "exact words they said", "probability": 85, "indicator": 11},
  {"id": "obj2", "text": "another concern", "probability": 75, "indicator": 13},
  {"id": "obj3", "text": "implied hesitation", "probability": 65, "indicator": 9}
]}`
          },
          {
            role: 'user',
            content: `Analyze this conversation and find 3-5 objections or concerns:\n\n${transcript}`
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];
      
      const result = JSON.parse(content);
      const objections = (result.objections || []).slice(0, 5);
      console.log(`[MODEL 2] Detected ${objections.length} objections:`, objections.map((o: any) => o.text));
      return objections;
    } catch (error) {
      console.error('[MODEL 2] Error:', error);
      return [];
    }
  }

  // ============================================================
  // MODEL 3: PERSONALIZED HANDLING SCRIPTS
  // Generates 5 scripts per objection - CACHED
  // ============================================================
  private async analyzeModel3_Scripts(transcript: string, objections: any[]): Promise<Record<string, any>> {
    return this.generateObjectionScriptsModel(transcript, objections);
  }

  // ============================================================
  // MODEL 4: LUBOMETER (Buying Readiness)
  // ONLY analyzes indicators needed for Lubometer calculation
  // Self-contained: scores its own indicators, then calculates
  // ============================================================
  private async analyzeModel4_Lubometer(transcript: string): Promise<any> {
    try {
      // Step 1: Score ONLY the indicators needed for Lubometer (all 27, but focused prompt)
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a buying readiness analyzer. Score indicators to calculate LUBOMETER (buying readiness).

SCORE THESE 27 INDICATORS (1-10 scale):
PILLAR 1 - Pain/Desire (weight 1.5x):
1. Pain Awareness - How aware of their problem?
2. Desire Clarity - How clear on what they want?
3. Desire Priority - How important is this?
4. Duration - How long have they had this problem?

PILLAR 2 - Urgency:
5. Time Pressure - External deadline?
6. Cost of Delay - What's at stake if they wait?
7. Internal Timing - Internal urgency?
8. Environmental Availability - Can they engage now?

PILLAR 3 - Decisiveness:
9. Decision Authority - Are they the decision maker?
10. Decision Style - How do they decide?
11. Commitment - Ready to commit?
12. Self-Permission - Give themselves permission?

PILLAR 4 - Money (weight 1.5x):
13. Resource Access - Have funds?
14. Resource Fluidity - Can move money?
15. Investment Mindset - See value in investing?
16. Resourcefulness - Would find a way?

PILLAR 5 - Ownership:
17. Problem Recognition - Own the problem?
18. Solution Ownership - Own the solution?
19. Locus of Control - Control outcomes?
20. Integrity - Follow through?

PILLAR 6 - Price Sensitivity (REVERSED in calc):
21. Emotional Spending - How feel about spending?
22. Negotiation Reflex - Try to negotiate?
23. Structural Rigidity - Need flexible terms?

PILLAR 7 - Trust:
24. External Trust - Trust you/offer?
25. Internal Trust - Trust themselves?
26. Risk Tolerance - Comfortable with risk?
27. ROI Ownership - Own the ROI?

SCORING: 1-3=Low/Negative, 4-6=Neutral, 7-10=Strong/Positive

RETURN JSON:
{"indicators": [{"id": 1, "name": "Pain Awareness", "score": 7, "pillarId": "P1"}...]}`
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response');
      
      const result = JSON.parse(content);
      const indicators = this.validateIndicators(result.indicators || []);

      // Step 2: Calculate using local CSV-based calculators
      const pillarCalculator = getPillarCalculator();
      const truthIndexCalculator = getTruthIndexCalculator();
      const lubometerCalculator = getLubometerCalculator();

      const pillars = await pillarCalculator.calculatePillars(indicators);
      const truthIndex = await truthIndexCalculator.calculate(pillars, indicators);
      const lubometer = lubometerCalculator.calculate(pillars, truthIndex);

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
          weight: p.id === 'P1' || p.id === 'P4' ? 1.5 : 1.0
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
  private async analyzeModel5_TruthIndex(transcript: string): Promise<any> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a truth/authenticity analyzer. Analyze the conversation for honesty and coherence.

YOUR TASK: Score how authentic and coherent the prospect's responses are (0-100).

SCORING FACTORS:

POSITIVE SIGNALS (increase score):
- Specific details and examples (+5-15)
- Admitting weaknesses or concerns (+5-10)
- Consistent messaging throughout (+5-10)
- Emotional authenticity (+5-10)
- Taking ownership of problems (+5-10)

NEGATIVE SIGNALS (decrease score):
- Vague or evasive answers (-10-20)
- Contradictions in statements (-15-20)
- Says one thing, implies another (-10-15)
- External blame patterns (-10-15)
- People-pleasing responses (-5-10)

INCOHERENCE PENALTIES (from CSV):
T1: Claims HIGH PAIN but shows LOW URGENCY → -15
T2: Wants CHANGE but avoids DECISION → -15  
T3: Has MONEY but resists PRICE strongly → -10
T4: Claims AUTHORITY but needs APPROVAL → -10
T5: Desires RESULT but won't OWN responsibility → -15

BASE SCORE: Start at 70, then adjust based on signals detected.
- Very authentic: 80-100
- Mostly honest: 60-79
- Mixed signals: 40-59
- Defensive/evasive: 20-39
- Highly inconsistent: 0-19

RETURN JSON:
{
  "score": 72,
  "penalties": [
    {"rule": "T1", "description": "High Pain + Low Urgency", "points": -15, "triggered": true}
  ],
  "positiveSignals": ["Gave specific examples about their situation", "Admitted budget concerns openly"],
  "negativeSignals": ["Vague about timeline"],
  "explanation": "Mostly authentic with some hesitation around commitment"
}`
          },
          {
            role: 'user',
            content: `Analyze the authenticity and coherence of this conversation:\n\n${transcript}`
          }
        ],
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
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
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a red flag detector. Identify warning signs using CSV rules.

Score the relevant pillars (1-10) then apply rules.

CLOSE BLOCKER RULES (from Lubometer CSV):

Rule 1: Not Enough Pain or Urgency
- Condition: P1 (Pain/Desire) ≤ 6 AND P2 (Urgency) ≤ 5
- Severity: HIGH
- Result: Do not attempt to close

Rule 2: High Price Sensitivity + Low Money
- Condition: P6 raw (Price Sensitivity) ≥ 7 AND P4 (Money) ≤ 5
- Severity: HIGH
- Result: Do not push on price

INCOHERENCE RED FLAGS (from Truth Index CSV):

- High Pain but Low Urgency: Says things are bad but shows no rush
- High Desire but Avoids Decision: Wants change but won't commit
- Has Money but Resists Price: Can afford it but keeps objecting on price
- Claims Authority but Needs Approval: Says they decide, then mentions others
- Wants Results but Won't Own It: Desires outcome but blames externally

BEHAVIORAL RED FLAGS:

- Repeated objections without resolution
- Avoids direct questions
- Procrastination language ("later", "maybe", "someday")
- Price shopping/comparison signals
- External blame patterns

RETURN JSON:
{
  "redFlags": [
    {"text": "Not enough pain or urgency to close", "severity": "high", "category": "close_blocker", "rule": "P1 ≤ 6 AND P2 ≤ 5"},
    {"text": "Says they decide but mentioned checking with partner", "severity": "medium", "category": "incoherence"}
  ]
}

Maximum 5 red flags. Empty array if none detected.`
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const result = JSON.parse(content);
      return (result.redFlags || []).slice(0, 5).map((flag: any) => ({
        text: flag.text,
        severity: flag.severity || 'medium',
        category: flag.category || 'behavioral'
      }));
    } catch (error) {
      console.error('[MODEL 6] Error:', error);
      return [];
    }
  }

  // Model 3: Generate Personalized Handling Scripts (separate model)
  // Generates 5 scripts per detected objection - CACHED to avoid regeneration
  private async generateObjectionScriptsModel(transcript: string, objections: any[]): Promise<Record<string, any>> {
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
        // Original might be obj1_1, obj1_2... but current obj.id might be obj2
        const originalScripts = cached.scripts;
        const originalObjId = cached.originalObjId || 'obj1'; // Store original ID when caching
        
        for (const [scriptKey, script] of Object.entries(originalScripts)) {
          // Replace original objId with current objId in the key
          // e.g., obj1_1 → obj2_1 if current objection is obj2
          const suffix = scriptKey.replace(originalObjId, ''); // Gets "_1", "_2", etc.
          const newKey = `${obj.id}${suffix}`;
          cachedScripts[newKey] = script;
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

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert sales script writer. Analyze the conversation and generate personalized objection handling scripts based on objection patterns that appear or are likely to appear.

OBJECTION HANDLING TECHNIQUES (use these APPROACHES as inspiration, but generate YOUR OWN natural descriptions):
- Use open-ended questions that guide self-discovery (inspired by PEARL approach)
- Ask questions that help them realize the answer themselves (inspired by Self-led Insight approach)
- Challenge their patterns/thinking when appropriate (inspired by Pattern Interrupt approach)
- Use direct, bold statements that cut through when needed (inspired by Direct Challenge approach)

IMPORTANT: DO NOT copy technique names like "PEARL Prompt" or "David (Self-led Insight)" into your notes. Instead, generate YOUR OWN natural, descriptive notes that explain what the step accomplishes (e.g., "Open up the conversation with a thoughtful question", "Guide them to discover the solution themselves", "Challenge their limiting belief", "Pause and wait for their response").

COMMON OBJECTIONS (from CSV - generate scripts for objections that appear in conversation):
1. "Things aren't that bad right now" (Pain Awareness - Indicator 1)
2. "I'm not even sure what I'd want instead" (Desire Clarity - Indicator 2)
3. "This is on the back burner for now" (Desire Priority - Indicator 3)
4. "I've lived with it for years" (Duration - Indicator 4)
5. "I'm not on a deadline" (Time Pressure - Indicator 5)
6. "I'll revisit this later" (Cost of Delay - Indicator 6)
7. "I'm not ready to decide" (Internal Timing - Indicator 7)
8. "It's a crazy time" (Environmental Availability - Indicator 8)
9. "I need to check with my partner" (Decision Authority - Indicator 9)
10. "I usually take time to reflect" (Decision Style - Indicator 10)
11. "Can I sleep on it?" (Commitment - Indicator 11)
12. "What if I fail?" (Self-Permission - Indicator 12)
13. "I don't have the funds" (Resource Access - Indicator 13)
14. "Our budget's frozen" (Resource Fluidity - Indicator 14)
15. "Not sure it's worth it" (Investment Mindset - Indicator 15)
16. "I can't make this work" (Resourcefulness - Indicator 16)
17. "It's not really my fault" (Problem Recognition - Indicator 17)
18. "Will this really work for me?" (Solution Ownership - Indicator 18)
19. "If I get lucky, maybe" (Locus of Control - Indicator 19)
20. "I want it, but..." (Integrity - Indicator 20)
21. "I'm anxious about spending this" (Emotional Spending - Indicator 21)
22. "Can you discount this?" (Negotiation - Indicator 22)
23. "I want it my way" (Structural Rigidity - Indicator 23)
24. "This should pay for itself, right?" (ROI Ownership - Indicator 24)
25. "I haven't seen enough proof" (External Trust - Indicator 25)
26. "I'm not sure I can follow through" (Internal Trust - Indicator 26)
27. "I don't want to make a mistake" (Risk Tolerance - Indicator 27)

For EACH objection that appears in the conversation (or is strongly implied), create a personalized script with:
1. Title: The objection text in quotes
2. Dial Trigger: Which psychological patterns/hot buttons triggered this (e.g., "Commitment to Decide + Validation Seeker")
3. Truth Level: Estimate 70-85 based on conversation authenticity
4. Money Style: Based on money-related patterns - "Investment-minded", "Price-sensitive", "Resourceful", "Has capital, questions ROI"
5. Steps: 5-8 conversation steps with:
   - step: Sequential number (1, 2, 3...)
   - text: What to say - PERSONALIZE based on actual conversation context, reference specific things the prospect said
   - pause: Optional pause time (e.g., "1s", "2s", "1.5s") - use strategically
   - note: Optional coaching note - Write YOUR OWN natural description (e.g., "Wait for response", "This is the pivot moment", "Let them answer", "Open up the conversation", "Guide them to discover the solution"). DO NOT copy technique names from CSV.

Script requirements:
- Reference specific things the prospect said in the conversation
- Use the CSV technique APPROACHES as inspiration, but write YOUR OWN natural, descriptive notes
- Be personalized and contextual
- Guide through objection to resolution
- End with a clear close or next step
- Notes should describe WHAT the step does, not name the technique (e.g., write "Help them see the value themselves" instead of "David (Self-led Insight)")

Return ONLY a JSON object:
{
  "objectionScripts": {
    "obj1_1": {
      "title": "\\"Can I sleep on it?\\"",
      "dialTrigger": "Commitment to Decide + Validation Seeker",
      "truthLevel": 78,
      "moneyStyle": "Investment-minded, seeks premium solutions",
      "steps": [
        { "step": 1, "text": "I totally get that... and thank you for being honest with me.", "pause": "1s" },
        { "step": 2, "text": "Based on what you shared earlier about [specific detail], this isn't really about needing time to think...", "pause": "1.5s", "note": "Reference specific conversation details and wait for their response" },
        ...
      ]
    },
    "obj1_2": { ... },
    "obj1_3": { ... },
    "obj1_4": { ... },
    "obj1_5": { ... },
    "obj2_1": { ... },
    ...
  }
}

Generate scripts for objections that appear in the conversation. 

CRITICAL: For EACH objection, generate EXACTLY 5 different personalized handling script variations (5 scripts per objection). 

Key naming: For objection "obj1", generate keys "obj1_1", "obj1_2", "obj1_3", "obj1_4", "obj1_5". For objection "obj2", generate "obj2_1", "obj2_2", "obj2_3", "obj2_4", "obj2_5", etc.

Each script variation should use a different approach/technique to handle the same objection - vary the steps, tone, and strategy. If there are 3 objections, you should generate 15 scripts total (5 per objection).`
          },
          {
            role: 'user',
            content: `DETECTED OBJECTIONS:\n${JSON.stringify(newObjections, null, 2)}\n\n---\nCONVERSATION:\n${transcript}\n---\n\nGenerate personalized objection handling scripts for the detected objections above. For EACH objection, generate EXACTLY 5 different script variations.

IMPORTANT: 
- Use the CSV techniques as INSPIRATION for your approach
- Generate YOUR OWN natural, descriptive notes - do NOT copy technique names like "PEARL Prompt" or "David (Self-led Insight)"
- Write notes that explain what each step accomplishes in natural language
- Personalize based on what the prospect actually said
- Generate 5 scripts per objection using the key naming: obj1_1, obj1_2, obj1_3, obj1_4, obj1_5, obj2_1, obj2_2, etc.`
          }
        ],
        temperature: 0.3,
        max_tokens: 6000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error('No content in script generation model response');
        return cachedScripts; // Return cached even on error
      }

      const result = JSON.parse(content);
      const newScripts = result.objectionScripts || {};

      // Cache new scripts by objection hash (include original objId for re-keying later)
      for (const obj of newObjections) {
        const hash = this.getObjectionHash(obj);
        // Collect all scripts for this objection (obj1_1, obj1_2, etc.)
        const objScripts: Record<string, any> = {};
        for (const [scriptId, script] of Object.entries(newScripts)) {
          if (scriptId.startsWith(obj.id)) {
            objScripts[scriptId] = script;
          }
        }
        // Cache all scripts WITH the original objection ID for re-keying
        this.scriptCache.set(hash, { 
          scripts: objScripts, 
          originalObjId: obj.id  // Store original ID for re-keying
        });
        console.log(`[CACHE SET] Cached ${Object.keys(objScripts).length} scripts for "${obj.text?.substring(0, 30)}..." (${obj.id})`);
      }

      // Merge cached + new scripts and return
      console.log(`[SCRIPTS] Returning ${Object.keys(cachedScripts).length} cached + ${Object.keys(newScripts).length} new scripts`);
      return { ...cachedScripts, ...newScripts };
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
        console.log(`[Cache HIT] Script for "${obj.text?.substring(0, 30)}..."`);
        scripts[obj.id] = cached;
      } else {
        newObjections.push(obj);
      }
    }

    // Only generate scripts for NEW objections
    if (newObjections.length > 0) {
      console.log(`[Cache MISS] Generating ${newObjections.length} new script(s)...`);
      const newScripts = await this.generateObjectionScripts(transcript, newObjections);
      
      // Add to cache and results
      for (const obj of newObjections) {
        const hash = this.getObjectionHash(obj);
        if (newScripts[obj.id]) {
          this.scriptCache.set(hash, newScripts[obj.id]);
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
3. Truth Level: Estimate 70-85 based on conversation authenticity
4. Money Style: Based on money-related indicators - "Investment-minded", "Price-sensitive", "Resourceful", etc.
5. Steps: 5-8 conversation steps with step number, text (what to say), optional pause, optional note

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
      "truthLevel": 78,
      "moneyStyle": "Style description",
      "steps": [
        { "step": 1, "text": "...", "pause": "1s", "note": "..." },
        ...
      ]
    },
    ...
  }
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
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
        max_tokens: 6000, // More tokens for script generation
        response_format: { type: 'json_object' }
      });

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
        score: 100,
        penalties: [],
        explanation: 'Awaiting conversation data',
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
