import { MessageCircle } from 'lucide-react';
import { Objection } from '../types';
import AnimatedNumber from './AnimatedNumber';

interface TopObjectionsProps {
  objections: Objection[];
  highlightedObjection?: string | null;
}

export default function TopObjections({ objections, highlightedObjection }: TopObjectionsProps) {
  const clampPercent = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  };

  const getColorClass = (probability: number) => {
    if (probability >= 70) return 'from-cyan-500 to-blue-500';
    if (probability >= 50) return 'from-teal-500 to-cyan-500';
    return 'from-blue-500 to-indigo-500';
  };

  return (
    <div id="top-objections" className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <MessageCircle className="w-7 h-7 text-blue-400" />
          <div className="absolute inset-0 blur-md bg-blue-400/30"></div>
        </div>
        <h2 className="text-2xl font-bold text-white">Top Objections</h2>
      </div>

      {objections.length > 0 ? (
        <div className="space-y-3">
          {objections.slice(0, 5).map((objection) => {
            const probability = Math.round(clampPercent(objection.probability));
            return (
            <div
              key={objection.id}
              id={`objection-${objection.id}`}
              className={`p-4 bg-gray-800/40 border rounded-xl transition-all duration-500 ${
                highlightedObjection === objection.id
                  ? 'border-teal-400 bg-teal-500/10 scale-105 glow-teal'
                  : 'border-gray-700/40 hover:border-gray-600/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium text-sm">{objection.text}</span>
                <span className={`text-lg font-bold bg-gradient-to-r ${getColorClass(probability)} bg-clip-text text-transparent ml-3`}>
                  <AnimatedNumber value={probability} suffix="%" />
                </span>
              </div>
              <div className="w-full bg-gray-800/50 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getColorClass(probability)} transition-[width] duration-600 ease-out`}
                  style={{ width: `${probability}%` }}
                ></div>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">Start recording to detect objections</p>
        </div>
      )}
    </div>
  );
}
