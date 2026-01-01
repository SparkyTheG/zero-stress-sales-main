import type { IndicatorScore, Objection, ObjectionScript, ScriptStep } from '../types/analysis.js';
import { getCSVParser } from '../data/csvParser.js';

export class ObjectionDetector {
  async detectObjections(indicators: IndicatorScore[]): Promise<Objection[]> {
    const parser = await getCSVParser();
    const mappings = parser.getObjectionMappings();
    const objections: Objection[] = [];

    // Common objections to check
    const objectionTemplates = [
      { id: '1', text: 'I need to think about it', relatedIndicators: [11, 10] }, // Commitment to Decide, Decision-Making Style
      { id: '2', text: "It's too expensive", relatedIndicators: [21, 22, 23] }, // Emotional Response to Spending, Negotiation Reflex, Structural Rigidity
      { id: '3', text: 'I need to talk to my therapist first', relatedIndicators: [9, 11] }, // Decision-Making Authority, Commitment to Decide
      { id: '4', text: "What if it doesn't work for me?", relatedIndicators: [19, 26, 27] }, // Belief in Ability to Solve, Internal Trust, Risk Tolerance
      { id: '5', text: 'Can I start next month instead?', relatedIndicators: [5, 6, 7] }, // Time Pressure, Cost of Delay, Internal Timing Activation
    ];

    for (const template of objectionTemplates) {
      // Calculate probability based on related indicator scores
      const relatedScores = template.relatedIndicators
        .map(indId => indicators.find(ind => ind.id === indId)?.score || 5)
        .filter(score => score !== undefined) as number[];

      if (relatedScores.length === 0) continue;

      // Higher scores in related indicators = higher objection probability
      // But we invert it: low scores in positive indicators (like commitment) = high objection probability
      // For negative indicators (like price sensitivity), high scores = high objection probability
      
      let probability = 0;
      if (template.id === '2') {
        // Price-related objection - higher scores in price sensitivity indicators = higher probability
        probability = Math.round((relatedScores.reduce((a, b) => a + b, 0) / relatedScores.length) * 10);
      } else {
        // Other objections - lower scores in commitment/trust indicators = higher probability
        const avgScore = relatedScores.reduce((a, b) => a + b, 0) / relatedScores.length;
        probability = Math.round((10 - avgScore) * 10);
      }

      // Ensure probability is between 0-100
      probability = Math.max(0, Math.min(100, probability));

      // Only include objections with probability >= 30
      if (probability >= 30) {
        objections.push({
          id: template.id,
          text: template.text,
          probability,
          relatedIndicators: template.relatedIndicators,
        });
      }
    }

    // Sort by probability descending
    objections.sort((a, b) => b.probability - a.probability);

    return objections.slice(0, 5); // Top 5 objections
  }

  async generateScript(
    objectionId: string,
    indicators: IndicatorScore[],
    customerName: string = 'Customer'
  ): Promise<ObjectionScript | null> {
    // Generate script based on objection ID and indicator scores
    // This is a simplified version - in production, would use GPT to generate personalized scripts

    const scripts: Record<string, Omit<ObjectionScript, 'steps'> & { stepsFactory: (name: string) => ScriptStep[] }> = {
      '1': {
        title: '"I need to think about it"',
        dialTrigger: 'Validation Seeker + Status Conscious',
        truthLevel: 78,
        moneyStyle: 'Investment-minded, seeks premium solutions',
        stepsFactory: (name) => [
          {
            step: 1,
            text: `${name}, I totally get that… and thank you for being honest with me.`,
            pause: '1s',
          },
          {
            step: 2,
            text: `Based on what you shared earlier, this isn't really about needing time to think. It's about whether you truly believe this is the solution that will finally break that cycle.`,
            pause: '1.5s',
          },
          {
            step: 3,
            text: `So let me ask you this directly… if that fear of repeating the past wasn't there, would this be the right solution for you?`,
            pause: '2s',
            note: 'Wait for response - this is the pivot moment',
          },
        ],
      },
      '2': {
        title: '"It\'s too expensive"',
        dialTrigger: 'Status Conscious + Investment-minded',
        truthLevel: 78,
        moneyStyle: 'Has capital, questions ROI',
        stepsFactory: (name) => [
          {
            step: 1,
            text: `I appreciate you being direct about that, ${name}.`,
            pause: '1s',
          },
          {
            step: 2,
            text: `And you know what? You're right — it is expensive. It's supposed to be. Because what we're talking about isn't a cost… it's an investment in the version of yourself who doesn't have to worry about money anymore.`,
            pause: '1.5s',
          },
          {
            step: 3,
            text: `So the real question isn't "can I afford this?" The real question is: "can I afford not to do this?"`,
            pause: '2s',
          },
        ],
      },
      // Add more scripts as needed
    };

    const scriptTemplate = scripts[objectionId];
    if (!scriptTemplate) return null;

    return {
      title: scriptTemplate.title,
      dialTrigger: scriptTemplate.dialTrigger,
      truthLevel: scriptTemplate.truthLevel,
      moneyStyle: scriptTemplate.moneyStyle,
      steps: scriptTemplate.stepsFactory(customerName),
    };
  }
}

let detectorInstance: ObjectionDetector | null = null;

export function getObjectionDetector(): ObjectionDetector {
  if (!detectorInstance) {
    detectorInstance = new ObjectionDetector();
  }
  return detectorInstance;
}

