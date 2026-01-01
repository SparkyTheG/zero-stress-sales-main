import type { IndicatorScore, PsychologicalDial } from '../types/analysis.js';
import { getCSVParser } from '../data/csvParser.js';

export class PsychologicalDialsAnalyzer {
  async analyze(indicators: IndicatorScore[]): Promise<PsychologicalDial[]> {
    const parser = await getCSVParser();
    const hotButtons = parser.getHotButtons();
    
    // Map indicators to psychological patterns
    const dialPatterns: Map<string, { indicatorIds: number[]; color: string }> = new Map([
      ['Validation Seeker', { indicatorIds: [11, 12, 26], color: 'from-fuchsia-500 to-pink-500' }],
      ['Status Conscious', { indicatorIds: [15, 21, 24], color: 'from-cyan-500 to-blue-500' }],
      ['Fear of Missing Out', { indicatorIds: [5, 6, 7], color: 'from-rose-500 to-pink-500' }],
      ['Control Oriented', { indicatorIds: [10, 23, 27], color: 'from-blue-500 to-indigo-500' }],
      ['Analytical Thinker', { indicatorIds: [10, 19, 27], color: 'from-emerald-500 to-teal-500' }],
      ['Procrastination Pattern', { indicatorIds: [5, 7, 11], color: 'from-orange-500 to-red-500' }],
    ]);

    const dials: PsychologicalDial[] = [];

    for (const [patternName, config] of dialPatterns) {
      // Calculate intensity based on related indicator scores
      const relatedScores = config.indicatorIds
        .map(id => indicators.find(ind => ind.id === id)?.score || 5)
        .filter(score => score !== undefined) as number[];

      if (relatedScores.length === 0) continue;

      const avgScore = relatedScores.reduce((a, b) => a + b, 0) / relatedScores.length;
      
      // Convert to intensity (0-100)
      // Higher scores = higher intensity for most patterns
      let intensity = Math.round((avgScore / 10) * 100);

      // Check if this is a hot button
      const isHotButton = hotButtons.some(
        hb => hb.isHotButton && config.indicatorIds.includes(hb.indicatorId)
      );

      if (isHotButton) {
        intensity = Math.min(100, intensity + 10); // Boost for hot buttons
      }

      dials.push({
        name: patternName,
        intensity: Math.max(0, Math.min(100, intensity)),
        color: config.color,
      });
    }

    // Sort by intensity and return top 5
    dials.sort((a, b) => b.intensity - a.intensity);
    
    return dials.slice(0, 5);
  }
}

let analyzerInstance: PsychologicalDialsAnalyzer | null = null;

export function getPsychologicalDialsAnalyzer(): PsychologicalDialsAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new PsychologicalDialsAnalyzer();
  }
  return analyzerInstance;
}

