import type { IndicatorScore, PillarScore } from '../types/analysis.js';
import { getCSVParser } from '../data/csvParser.js';

export class PillarCalculator {
  async calculatePillars(indicators: IndicatorScore[]): Promise<PillarScore[]> {
    const parser = await getCSVParser();
    const pillars = parser.getPillars();
    const pillarScores: PillarScore[] = [];

    for (const pillar of pillars) {
      // Get indicators for this pillar
      const pillarIndicators = indicators.filter(ind => ind.pillarId === pillar.id);
      
      if (pillarIndicators.length === 0) continue;

      // Calculate average score
      const sum = pillarIndicators.reduce((acc, ind) => acc + ind.score, 0);
      const averageScore = sum / pillarIndicators.length;

      // Apply reverse scoring for P6 (Price Sensitivity)
      let finalAverage = averageScore;
      if (pillar.id === 'P6') {
        finalAverage = 11 - averageScore; // Reverse score
      }

      // Apply pillar weight
      const weightedScore = finalAverage * pillar.weight;

      pillarScores.push({
        id: pillar.id,
        name: pillar.name,
        averageScore: finalAverage,
        weightedScore: weightedScore,
        weight: pillar.weight,
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

