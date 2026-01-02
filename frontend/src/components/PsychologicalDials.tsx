import { Brain } from 'lucide-react';
import { PsychologicalDial } from '../types';

interface PsychologicalDialsProps {
  dials: PsychologicalDial[];
}

// Vibrant gradient colors for each dial position
const DIAL_COLORS = [
  'from-emerald-400 to-cyan-400',
  'from-rose-400 to-pink-400',
  'from-sky-400 to-blue-400',
  'from-yellow-400 to-orange-400',
  'from-violet-400 to-fuchsia-400',
];

function getDialColor(index: number): string {
  return DIAL_COLORS[index % DIAL_COLORS.length];
}

function clampIntensity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function PsychologicalDials({ dials }: PsychologicalDialsProps) {
  // Take only first 5 dials
  const displayDials = dials.slice(0, 5);

  return (
    <div className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <Brain className="w-7 h-7 text-purple-400" />
          <div className="absolute inset-0 blur-md bg-purple-400/30" />
        </div>
        <h2 className="text-2xl font-bold text-white">Top 5 Psychological Dials</h2>
      </div>

      {/* Dials List */}
      {displayDials.length > 0 ? (
        <div className="space-y-4">
          {displayDials.map((dial, index) => {
            const color = getDialColor(index);
            const intensity = clampIntensity(dial.intensity);

            return (
              <div
                key={`dial-${index}-${dial.name}`}
                className="p-4 bg-gray-800/40 border border-gray-700/40 rounded-xl hover:border-gray-600/60 transition-all"
              >
                {/* Dial Header: Rank, Name, Intensity */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-white/50 font-bold text-lg">#{index + 1}</span>
                    <span className="text-white font-medium">{dial.name}</span>
                  </div>
                  <span className={`text-xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                    {intensity}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-800/50 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${color} transition-all duration-500`}
                    style={{ width: `${intensity}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">Start recording to analyze psychological patterns</p>
        </div>
      )}
    </div>
  );
}
