import type { PillarScore, IndicatorScore, TruthIndexResult, TruthIndexPenalty } from '../types/analysis.js';

export class TruthIndexCalculator {
  async calculate(pillars: PillarScore[], indicators: IndicatorScore[]): Promise<TruthIndexResult> {
    const penalties: TruthIndexPenalty[] = [];

    // Get pillar averages for calculations
    const p1 = pillars.find(p => p.id === 'P1');
    const p2 = pillars.find(p => p.id === 'P2');
    const p3 = pillars.find(p => p.id === 'P3');
    const p4 = pillars.find(p => p.id === 'P4');
    const p5 = pillars.find(p => p.id === 'P5');
    const p6 = pillars.find(p => p.id === 'P6');

    // Get specific indicator scores
    const painIntensity = indicators.find(ind => ind.id === 1);
    const desireClarity = indicators.find(ind => ind.id === 3);
    const desirePriority = indicators.find(ind => ind.id === 4);
    const decisionAuthority = indicators.find(ind => ind.id === 9);

    // T1: High Pain + Low Urgency
    // Pain Intensity (P1) ≥ 7 AND Urgency (P2) ≤ 4
    if (painIntensity && painIntensity.score >= 7 && p2 && p2.averageScore <= 4) {
      penalties.push({
        ruleId: 'T1',
        description: 'High Pain + Low Urgency',
        penalty: 15,
        triggered: true,
      });
    }

    // T2: High Desire + Low Decisiveness
    // Desire Clarity or Priority ≥ 7 AND Decisiveness (P3) ≤ 4
    const highDesire = (desireClarity && desireClarity.score >= 7) || 
                       (desirePriority && desirePriority.score >= 7);
    if (highDesire && p3 && p3.averageScore <= 4) {
      penalties.push({
        ruleId: 'T2',
        description: 'High Desire + Low Decisiveness',
        penalty: 15,
        triggered: true,
      });
    }

    // T3: High Money Access + High Price Sensitivity
    // Available Money (P4) ≥ 7 AND Price Sensitivity raw (P6) ≥ 8
    // Note: P6 is reversed, so raw = 11 - averageScore
    const p6Raw = p6 ? 11 - p6.averageScore : 5;
    if (p4 && p4.averageScore >= 7 && p6Raw >= 8) {
      penalties.push({
        ruleId: 'T3',
        description: 'High Money Access + High Price Sensitivity',
        penalty: 10,
        triggered: true,
      });
    }

    // T4: Claims Authority + Reveals Need for Approval
    // Decision Authority = "Yes" but later mentions needing external approval
    // This requires conversation analysis - simplified check for now
    // In real implementation, would track conversation for contradictions
    if (decisionAuthority && decisionAuthority.score >= 7) {
      // Check if there are indicators suggesting need for approval (simplified)
      const approvalIndicators = indicators.filter(ind => 
        [9, 10, 11].includes(ind.id) && ind.score < 5
      );
      if (approvalIndicators.length > 0) {
        penalties.push({
          ruleId: 'T4',
          description: 'Claims Authority + Reveals Need for Approval',
          penalty: 10,
          triggered: true,
        });
      }
    }

    // T5: High Desire + Low Responsibility
    // Desire Clarity or Priority ≥ 7 AND Responsibility & Ownership (P5) ≤ 5
    if (highDesire && p5 && p5.averageScore <= 5) {
      penalties.push({
        ruleId: 'T5',
        description: 'High Desire + Low Responsibility',
        penalty: 15,
        triggered: true,
      });
    }

    // Calculate total penalty percentage
    const totalPenalty = penalties.reduce((sum, p) => sum + p.penalty, 0);
    const truthIndexScore = Math.max(0, 100 - totalPenalty);

    // Generate explanation
    const explanation = this.generateExplanation(truthIndexScore, penalties);

    return {
      score: truthIndexScore,
      penalties,
      explanation,
    };
  }

  private generateExplanation(score: number, penalties: TruthIndexPenalty[]): string {
    if (penalties.length === 0) {
      return 'Authentic, vulnerable responses. Low people-pleasing.';
    }

    if (score >= 75) {
      return 'Mostly honest with some guarded responses.';
    }

    if (score >= 50) {
      return 'Some inconsistency detected. Mixed signals present.';
    }

    return 'Defensive patterns detected. Surface-level responses. Multiple contradictions found.';
  }
}

let calculatorInstance: TruthIndexCalculator | null = null;

export function getTruthIndexCalculator(): TruthIndexCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new TruthIndexCalculator();
  }
  return calculatorInstance;
}

