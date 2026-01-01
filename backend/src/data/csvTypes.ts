export interface PillarDefinition {
  id: string;
  name: string;
  weight: number;
  indicators: IndicatorDefinition[];
}

export interface IndicatorDefinition {
  id: number;
  name: string;
  weight: number;
  pillarId: string;
  scoringCriteria: ScoringCriterion[];
}

export interface ScoringCriterion {
  scoreLevel: 'Low (1–3)' | 'Mid (4–6)' | 'High (7–10)';
  domain: 'Personal Dev' | 'B2B' | 'Real Estate';
  sampleQuestion: string;
  exampleAnswer: string;
  keywords?: string[];
  patterns?: string[];
}

export interface LubometerFormula {
  steps: string[];
  penaltyRules: PenaltyRule[];
  readinessZones: ReadinessZone[];
  closeBlockerRules: CloseBlockerRule[];
}

export interface PenaltyRule {
  id: string;
  description: string;
  condition: string;
  penalty: number;
}

export interface ReadinessZone {
  range: string;
  label: string;
  color: string;
}

export interface CloseBlockerRule {
  id: string;
  condition: string;
  action: string;
}

export interface TruthIndexRule {
  id: string;
  condition: string;
  triggerLogic: string;
  penalty: number;
  notes: string;
}

export interface ObjectionMapping {
  id: string;
  pillar: string;
  indicator: string;
  exampleObjection: string;
  pearlPrompt: string;
  davidPrompt: string;
  calvinPrompt: string;
  caronePrompt: string;
}

export interface HotButton {
  indicatorId: number;
  pillar: string;
  indicator: string;
  isHotButton: boolean;
  smartClosingPrompt: string;
  exampleLanguage: string;
}

export interface PushDelayRule {
  id: string;
  condition: string;
  triggerLogic: string;
  recommendedAction: string;
  notes: string;
}

