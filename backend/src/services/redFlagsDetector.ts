import type { IndicatorScore, PillarScore, TruthIndexResult, RedFlag } from '../types/analysis.js';
import { getCSVParser } from '../data/csvParser.js';

export class RedFlagsDetector {
  async detect(
    indicators: IndicatorScore[],
    pillars: PillarScore[],
    truthIndex: TruthIndexResult
  ): Promise<RedFlag[]> {
    const parser = await getCSVParser();
    const pushDelayRules = parser.getPushDelayRules();
    const flags: RedFlag[] = [];

    // Check Truth Index penalties for red flags
    for (const penalty of truthIndex.penalties) {
      if (penalty.triggered) {
        let severity: 'low' | 'medium' | 'high' = 'medium';
        
        if (penalty.penalty >= 15) {
          severity = 'high';
        } else if (penalty.penalty >= 10) {
          severity = 'medium';
        } else {
          severity = 'low';
        }

        flags.push({
          text: `Truth Index: ${penalty.description}`,
          severity,
        });
      }
    }

    // Check push/delay rules
    const p1 = pillars.find(p => p.id === 'P1');
    const p2 = pillars.find(p => p.id === 'P2');
    const p3 = pillars.find(p => p.id === 'P3');
    const p4 = pillars.find(p => p.id === 'P4');
    const p5 = pillars.find(p => p.id === 'P5');
    const p6 = pillars.find(p => p.id === 'P6');

    // Rule C5: No Pain + No Urgency
    if (p1 && p2 && p1.averageScore <= 6 && p2.averageScore <= 5) {
      flags.push({
        text: 'Not enough pain or urgency detected - prospect may not be ready',
        severity: 'high',
      });
    }

    // Rule C6: High Price Sensitivity + Low Money
    const p6Raw = p6 ? 11 - p6.averageScore : 5;
    if (p6Raw >= 7 && p4 && p4.averageScore <= 5) {
      flags.push({
        text: 'High price sensitivity combined with low money availability',
        severity: 'high',
      });
    }

    // Check for low responsibility/ownership
    if (p5 && p5.averageScore <= 4) {
      flags.push({
        text: 'Low responsibility and ownership - prospect may not follow through',
        severity: 'medium',
      });
    }

    // Check for high desire but low commitment (from truth index T2 or T5)
    const desireIndicator = indicators.find(ind => ind.id === 3 || ind.id === 4);
    if (desireIndicator && desireIndicator.score >= 7 && p3 && p3.averageScore <= 4) {
      flags.push({
        text: 'High desire but low decisiveness - may need more coaching',
        severity: 'medium',
      });
    }

    // Remove duplicates and sort by severity
    const uniqueFlags = Array.from(
      new Map(flags.map(flag => [flag.text, flag])).values()
    );

    uniqueFlags.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    return uniqueFlags;
  }
}

let detectorInstance: RedFlagsDetector | null = null;

export function getRedFlagsDetector(): RedFlagsDetector {
  if (!detectorInstance) {
    detectorInstance = new RedFlagsDetector();
  }
  return detectorInstance;
}

