import type { PillarScore, LubometerResult, LubometerTier, TruthIndexResult } from '../types/analysis.js';
import { getPillarCalculator } from './pillarCalculator.js';

export class LubometerCalculator {
  // Price tiers for readiness calculation
  private readonly PRICE_TIERS = [
    { price: 2997, label: 'Starter' },
    { price: 7997, label: 'Professional' },
    { price: 15997, label: 'Elite' },
  ];

  calculate(
    pillars: PillarScore[],
    truthIndex: TruthIndexResult
  ): LubometerResult {
    const calculator = getPillarCalculator();
    
    // Step 1-5: Get raw score (sum of weighted pillar scores)
    const rawScore = calculator.getRawScore(pillars);

    // Step 6: Apply Truth Index penalties
    const penalties = this.calculatePenalties(pillars, truthIndex);
    const totalPenalties = penalties.reduce((sum, p) => sum + p.penalty, 0);

    // Step 7: Calculate final score
    const finalScore = Math.max(0, rawScore - totalPenalties);

    // Step 8: Determine readiness zone
    const readinessZone = this.determineReadinessZone(finalScore);

    // Calculate readiness percentages for each price tier
    const priceTiers = this.calculatePriceTierReadiness(finalScore, pillars);

    return {
      rawScore,
      penalties: totalPenalties,
      finalScore,
      readinessZone,
      priceTiers,
    };
  }

  private calculatePenalties(
    pillars: PillarScore[],
    truthIndex: TruthIndexResult
  ): Array<{ ruleId: string; penalty: number }> {
    const penalties: Array<{ ruleId: string; penalty: number }> = [];

    // Truth Index penalties are already calculated, extract from triggered rules
    for (const penaltyRule of truthIndex.penalties) {
      if (penaltyRule.triggered) {
        penalties.push({
          ruleId: penaltyRule.ruleId,
          penalty: penaltyRule.penalty,
        });
      }
    }

    return penalties;
  }

  private determineReadinessZone(score: number): 'green' | 'yellow' | 'red' | 'no-go' {
    if (score >= 70) return 'green';
    if (score >= 50) return 'yellow';
    if (score >= 30) return 'red';
    return 'no-go';
  }

  private calculatePriceTierReadiness(
    finalScore: number,
    pillars: PillarScore[]
  ): LubometerTier[] {
    // Base readiness calculation - higher score means higher readiness
    // Adjust based on pillar scores, especially P4 (Available Money)
    const p4 = pillars.find(p => p.id === 'P4');
    const p6 = pillars.find(p => p.id === 'P6');
    
    // Money availability affects higher tiers more
    const moneyScore = p4?.averageScore || 5;
    const priceSensitivity = p6?.averageScore || 5; // Already reversed

    const baseReadiness = Math.min(100, (finalScore / 90) * 100);

    return this.PRICE_TIERS.map(tier => {
      let readiness = baseReadiness;

      // Adjust based on tier price
      if (tier.price === 2997) {
        // Starter tier - more accessible
        readiness = Math.min(100, baseReadiness * 1.1);
      } else if (tier.price === 7997) {
        // Professional tier - moderate adjustment
        readiness = baseReadiness;
        if (moneyScore < 6) {
          readiness *= 0.85; // Lower money availability reduces readiness
        }
      } else if (tier.price === 15997) {
        // Elite tier - requires high money availability
        readiness = baseReadiness;
        if (moneyScore < 7) {
          readiness *= 0.7; // Significant reduction if money is low
        }
        if (priceSensitivity > 7) {
          readiness *= 0.8; // High price sensitivity reduces readiness
        }
      }

      // Ensure readiness is reasonable (between 0-100)
      readiness = Math.max(0, Math.min(100, Math.round(readiness)));

      return {
        price: tier.price,
        readiness,
        label: tier.label,
      };
    });
  }

  // Check close blocker rules
  checkCloseBlockers(pillars: PillarScore[]): { canClose: boolean; reason?: string } {
    const p1 = pillars.find(p => p.id === 'P1');
    const p2 = pillars.find(p => p.id === 'P2');
    const p4 = pillars.find(p => p.id === 'P4');
    const p6 = pillars.find(p => p.id === 'P6');

    // Rule 1: P1 ≤ 6 AND P2 ≤ 5 → Not enough pain or urgency
    if (p1 && p2 && p1.averageScore <= 6 && p2.averageScore <= 5) {
      return {
        canClose: false,
        reason: 'Not enough pain or urgency',
      };
    }

    // Rule 2: P6 raw ≥ 7 AND P4 ≤ 5 → High price sensitivity + low money
    // Note: P6 is already reversed in pillar calculator, so we check the original
    // For this check, we need the raw (unreversed) score
    const p6Raw = p6 ? 11 - p6.averageScore : 5;
    if (p6Raw >= 7 && p4 && p4.averageScore <= 5) {
      return {
        canClose: false,
        reason: 'High price sensitivity with low money availability',
      };
    }

    return { canClose: true };
  }
}

let calculatorInstance: LubometerCalculator | null = null;

export function getLubometerCalculator(): LubometerCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new LubometerCalculator();
  }
  return calculatorInstance;
}

