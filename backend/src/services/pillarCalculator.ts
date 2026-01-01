import type { IndicatorScore, PillarScore } from '../types/analysis.js';

// Hardcoded pillar definitions - these are fixed and don't need CSV
const PILLAR_DEFINITIONS = [
  { id: 'P1', name: 'Perceived Spread (Pain & Desire Gap)', weight: 1.5, indicatorIds: [1, 2, 3, 4] },
  { id: 'P2', name: 'Urgency', weight: 1.0, indicatorIds: [5, 6, 7, 8] },
  { id: 'P3', name: 'Decisiveness', weight: 1.0, indicatorIds: [9, 10, 11, 12] },
  { id: 'P4', name: 'Available Money', weight: 1.5, indicatorIds: [13, 14, 15, 16] },
  { id: 'P5', name: 'Responsibility & Ownership', weight: 1.0, indicatorIds: [17, 18, 19, 20] },
  { id: 'P6', name: 'Price Sensitivity', weight: 1.0, indicatorIds: [21, 22, 23] },
  { id: 'P7', name: 'Trust', weight: 1.0, indicatorIds: [24, 25, 26, 27] },
];

export class PillarCalculator {
  async calculatePillars(indicators: IndicatorScore[]): Promise<PillarScore[]> {
    const pillarScores: PillarScore[] = [];

    for (const pillarDef of PILLAR_DEFINITIONS) {
      // Get indicators for this pillar by ID
      const pillarIndicators = indicators.filter(ind => 
        pillarDef.indicatorIds.includes(ind.id) || ind.pillarId === pillarDef.id
      );
      
      if (pillarIndicators.length === 0) {
        // Create default score if no indicators found
        pillarScores.push({
          id: pillarDef.id,
          name: pillarDef.name,
          averageScore: 5, // Default neutral score
          weightedScore: 5 * pillarDef.weight,
          weight: pillarDef.weight,
          indicators: [],
        });
        continue;
      }

      // Calculate average score
      const sum = pillarIndicators.reduce((acc, ind) => acc + ind.score, 0);
      const averageScore = sum / pillarIndicators.length;

      // Apply reverse scoring for P6 (Price Sensitivity)
      // Higher raw score = more price sensitive = LESS ready to buy
      // So we reverse it: 11 - score (score 10 becomes 1, score 1 becomes 10)
      let finalAverage = averageScore;
      if (pillarDef.id === 'P6') {
        finalAverage = 11 - averageScore; // Reverse score
      }

      // Apply pillar weight
      const weightedScore = finalAverage * pillarDef.weight;

      pillarScores.push({
        id: pillarDef.id,
        name: pillarDef.name,
        averageScore: finalAverage,
        weightedScore: weightedScore,
        weight: pillarDef.weight,
        indicators: pillarIndicators,
      });
    }

    return pillarScores;
  }

  getPillarScore(pillars: PillarScore[], pillarId: string): PillarScore | undefined {
    return pillars.find(p => p.id === pillarId);
  }

  getRawScore(pillars: PillarScore[]): number {
    // Sum of all weighted pillar scores (max is typically 90)
    return pillars.reduce((sum, pillar) => sum + pillar.weightedScore, 0);
  }
}

let calculatorInstance: PillarCalculator | null = null;

export function getPillarCalculator(): PillarCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new PillarCalculator();
  }
  return calculatorInstance;
}

