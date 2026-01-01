import { Brain } from 'lucide-react';
import { PsychologicalDial } from '../types';

interface PsychologicalDialsProps {
  dials: PsychologicalDial[];
}

// ALWAYS use these bright, high-contrast colors (ignore AI colors completely)
const BRIGHT_COLORS = [
  'from-emerald-400 to-cyan-400',    // Bright green to cyan
  'from-rose-400 to-pink-400',       // Bright rose to pink  
  'from-sky-400 to-blue-400',        // Bright sky to blue
  'from-yellow-400 to-orange-400',   // Bright yellow to orange
  'from-violet-400 to-fuchsia-400',  // Bright violet to fuchsia
];

// ALWAYS use predefined bright colors - ignore AI colors
function getBrightColor(_color: string | undefined, index: number): string {
  return BRIGHT_COLORS[index % BRIGHT_COLORS.length];
}

export default function PsychologicalDials({ dials }: PsychologicalDialsProps) {
  return (
    <div className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <Brain className="w-7 h-7 text-purple-400" />
          <div className="absolute inset-0 blur-md bg-purple-400/30"></div>
        </div>
        <h2 className="text-2xl font-bold text-white">Top 5 Psychological Dials</h2>
      </div>

      {dials.length > 0 ? (
        <div className="space-y-4">
          {dials.map((dial, index) => {
            const brightColor = getBrightColor(dial.color, index);
            return (
              <div
                key={dial.name}
                className="p-4 bg-gray-800/40 border border-gray-700/40 rounded-xl hover:border-gray-600/60 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-white/50 font-bold text-lg">#{index + 1}</span>
                    <span className="text-white font-medium">{dial.name}</span>
                  </div>
                  <span className={`text-xl font-bold bg-gradient-to-r ${brightColor} bg-clip-text text-transparent`}>
                    {dial.intensity}%
                  </span>
                </div>

                <div className="w-full bg-gray-800/50 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${brightColor} transition-all duration-500`}
                    style={{ width: `${dial.intensity}%` }}
                  ></div>
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
