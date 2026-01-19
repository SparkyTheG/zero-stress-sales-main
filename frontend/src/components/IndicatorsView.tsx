import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Indicator {
  id: number;
  name: string;
  score: number;
  pillar: string;
}

// Mock indicators data - in real app, this would come from props or API
const mockIndicators: Indicator[] = [
  { id: 1, name: 'Pain Awareness', score: 7, pillar: 'P1' },
  { id: 2, name: 'Desire Clarity', score: 8, pillar: 'P1' },
  { id: 3, name: 'Desire Priority', score: 6, pillar: 'P1' },
  { id: 4, name: 'Duration of Dissatisfaction', score: 9, pillar: 'P1' },
  { id: 5, name: 'Time Pressure', score: 5, pillar: 'P2' },
  { id: 6, name: 'Cost of Delay', score: 7, pillar: 'P2' },
  { id: 7, name: 'Internal Timing', score: 6, pillar: 'P2' },
  { id: 8, name: 'Environmental Availability', score: 8, pillar: 'P2' },
  { id: 9, name: 'Decision Authority', score: 9, pillar: 'P3' },
  { id: 10, name: 'Decision Style', score: 7, pillar: 'P3' },
  { id: 11, name: 'Commitment to Decide', score: 6, pillar: 'P3' },
  { id: 12, name: 'Self-Permission', score: 8, pillar: 'P3' },
  { id: 13, name: 'Resource Access', score: 9, pillar: 'P4' },
  { id: 14, name: 'Resource Fluidity', score: 7, pillar: 'P4' },
  { id: 15, name: 'Investment Mindset', score: 8, pillar: 'P4' },
  { id: 16, name: 'Resourcefulness', score: 9, pillar: 'P4' },
  { id: 17, name: 'Problem Recognition', score: 7, pillar: 'P5' },
  { id: 18, name: 'Solution Ownership', score: 8, pillar: 'P5' },
  { id: 19, name: 'Locus of Control', score: 9, pillar: 'P5' },
  { id: 20, name: 'Integrity', score: 8, pillar: 'P5' },
  { id: 21, name: 'Emotional Spending', score: 4, pillar: 'P6' },
  { id: 22, name: 'Negotiation Reflex', score: 3, pillar: 'P6' },
  { id: 23, name: 'Structural Rigidity', score: 5, pillar: 'P6' },
  { id: 24, name: 'External Trust', score: 8, pillar: 'P7' },
  { id: 25, name: 'Internal Trust', score: 9, pillar: 'P7' },
  { id: 26, name: 'Risk Tolerance', score: 7, pillar: 'P7' },
  { id: 27, name: 'ROI Ownership', score: 8, pillar: 'P7' },
];

interface IndicatorsViewProps {
  indicators?: Indicator[];
}

export function IndicatorsView({ indicators = mockIndicators }: IndicatorsViewProps) {
  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-green-400';
    if (score >= 4) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 7) return <TrendingUp className="w-4 h-4" />;
    if (score >= 4) return <Minus className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const pillarGroups = indicators.reduce((acc, indicator) => {
    if (!acc[indicator.pillar]) {
      acc[indicator.pillar] = [];
    }
    acc[indicator.pillar].push(indicator);
    return acc;
  }, {} as Record<string, Indicator[]>);

  const pillarNames: Record<string, string> = {
    P1: 'Perceived Spread (Pain & Desire)',
    P2: 'Urgency',
    P3: 'Decisiveness',
    P4: 'Available Money',
    P5: 'Responsibility & Ownership',
    P6: 'Price Sensitivity',
    P7: 'Trust',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">All 27 Sales Indicators</h2>
        <p className="text-gray-400">Real-time scoring of prospect readiness across 7 pillars</p>
      </div>

      <div className="space-y-6">
        {Object.entries(pillarGroups).map(([pillar, pillarIndicators]) => (
          <div
            key={pillar}
            className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {pillar}: {pillarNames[pillar]}
              </h3>
              <div className="text-sm text-gray-400">
                Avg: {(pillarIndicators.reduce((sum, ind) => sum + ind.score, 0) / pillarIndicators.length).toFixed(1)}/10
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pillarIndicators.map((indicator) => (
                <div
                  key={indicator.id}
                  className="flex items-center justify-between p-4 bg-gray-800/40 rounded-lg hover:bg-gray-800/60 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`${getScoreColor(indicator.score)}`}>
                      {getScoreIcon(indicator.score)}
                    </div>
                    <div>
                      <div className="text-white font-medium">{indicator.name}</div>
                      <div className="text-xs text-gray-500">Indicator #{indicator.id}</div>
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${getScoreColor(indicator.score)}`}>
                    {indicator.score}
                    <span className="text-sm text-gray-500">/10</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Scoring Legend</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300">7-10: Strong Positive Signal</span>
          </div>
          <div className="flex items-center gap-2">
            <Minus className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-gray-300">4-6: Neutral/Mixed</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-sm text-gray-300">1-3: Red Flag/Concern</span>
          </div>
        </div>
      </div>
    </div>
  );
}
