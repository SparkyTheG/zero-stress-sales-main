import type { AnalysisResult, TranscriptChunk } from '../types/analysis.js';
import { getIndicatorScorer } from './indicatorScorer.js';
import { getPillarCalculator } from './pillarCalculator.js';
import { getLubometerCalculator } from './lubometerCalculator.js';
import { getTruthIndexCalculator } from './truthIndexCalculator.js';
import { getObjectionDetector } from './objectionDetector.js';
import { getPsychologicalDialsAnalyzer } from './psychologicalDialsAnalyzer.js';
import { getRedFlagsDetector } from './redFlagsDetector.js';

export class AnalysisEngine {
  private indicatorScorer = getIndicatorScorer();
  private pillarCalculator = getPillarCalculator();
  private lubometerCalculator = getLubometerCalculator();
  private truthIndexCalculator = getTruthIndexCalculator();
  private objectionDetector = getObjectionDetector();
  private psychologicalDialsAnalyzer = getPsychologicalDialsAnalyzer();
  private redFlagsDetector = getRedFlagsDetector();

  async analyze(transcript: TranscriptChunk[]): Promise<AnalysisResult> {
    // Update conversation history
    this.indicatorScorer.updateConversation(transcript);

    // Step 1: Score all indicators
    const indicators = await this.indicatorScorer.scoreAllIndicators();

    // Step 2: Calculate pillar scores
    const pillars = await this.pillarCalculator.calculatePillars(indicators);

    // Step 3: Calculate Truth Index
    const truthIndex = await this.truthIndexCalculator.calculate(pillars, indicators);

    // Step 4: Calculate Lubometer
    const lubometer = this.lubometerCalculator.calculate(pillars, truthIndex);

    // Step 5: Detect objections
    const objections = await this.objectionDetector.detectObjections(indicators);

    // Step 6: Analyze psychological dials
    const psychologicalDials = await this.psychologicalDialsAnalyzer.analyze(indicators);

    // Step 7: Detect red flags
    const redFlags = await this.redFlagsDetector.detect(indicators, pillars, truthIndex);

    return {
      timestamp: Date.now(),
      conversationLength: transcript.length,
      indicators,
      pillars,
      lubometer,
      truthIndex,
      objections,
      psychologicalDials,
      redFlags,
    };
  }

  // Analyze incrementally as conversation progresses
  async analyzeIncremental(transcript: TranscriptChunk[]): Promise<AnalysisResult> {
    // Only analyze if we have substantial conversation
    if (transcript.length < 3) {
      // Return default/minimal analysis for early conversation
      return this.getDefaultAnalysis();
    }

    return this.analyze(transcript);
  }

  private getDefaultAnalysis(): AnalysisResult {
    // Return a baseline analysis for early conversation
    return {
      timestamp: Date.now(),
      conversationLength: 0,
      indicators: [],
      pillars: [],
      lubometer: {
        rawScore: 0,
        penalties: 0,
        finalScore: 0,
        readinessZone: 'no-go',
        priceTiers: [
          { price: 2997, readiness: 0, label: 'Starter' },
          { price: 7997, readiness: 0, label: 'Professional' },
          { price: 15997, readiness: 0, label: 'Elite' },
        ],
      },
      truthIndex: {
        score: 100,
        penalties: [],
        explanation: 'Analysis pending - insufficient conversation data',
      },
      objections: [],
      psychologicalDials: [],
      redFlags: [],
    };
  }
}

let engineInstance: AnalysisEngine | null = null;

export function getAnalysisEngine(): AnalysisEngine {
  if (!engineInstance) {
    engineInstance = new AnalysisEngine();
  }
  return engineInstance;
}

