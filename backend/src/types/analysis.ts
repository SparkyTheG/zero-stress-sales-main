export interface IndicatorScore {
  id: number;
  name: string;
  score: number; // 1-10
  pillarId: string;
  evidence?: string[];
}

export interface PillarScore {
  id: string;
  name: string;
  averageScore: number;
  weightedScore: number;
  weight: number;
  indicators: IndicatorScore[];
}

export interface LubometerResult {
  rawScore: number; // Sum of weighted pillar scores (max 90)
  penalties: number;
  finalScore: number;
  readinessZone: 'green' | 'yellow' | 'red' | 'no-go';
  priceTiers: LubometerTier[];
}

export interface LubometerTier {
  price: number;
  readiness: number; // 0-100 percentage
  label: string;
}

export interface TruthIndexResult {
  score: number; // 0-100
  penalties: TruthIndexPenalty[];
  explanation: string;
}

export interface TruthIndexPenalty {
  ruleId: string;
  description: string;
  penalty: number;
  triggered: boolean;
}

export interface Objection {
  id: string;
  text: string;
  probability: number; // 0-100
  relatedIndicators: number[];
}

export interface ObjectionScript {
  title: string;
  dialTrigger: string;
  truthLevel: number;
  moneyStyle: string;
  steps: ScriptStep[];
}

export interface ScriptStep {
  step: number;
  text: string;
  pause?: string;
  note?: string;
}

export interface PsychologicalDial {
  name: string;
  intensity: number; // 0-100
  color: string;
}

export interface RedFlag {
  text: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AnalysisResult {
  timestamp: number;
  conversationLength: number;
  indicators: IndicatorScore[];
  pillars: PillarScore[];
  lubometer: LubometerResult;
  truthIndex: TruthIndexResult;
  objections: Objection[];
  psychologicalDials: PsychologicalDial[];
  redFlags: RedFlag[];
  objectionScripts?: Record<string, ObjectionScript>;
}

export interface ConversationState {
  sessionId: string;
  transcript: TranscriptChunk[];
  currentAnalysis: AnalysisResult | null;
  startTime: number;
}

export interface TranscriptChunk {
  timestamp: number;
  speaker: 'closer' | 'prospect' | 'unknown';
  text: string;
}

