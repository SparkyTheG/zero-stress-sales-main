import { Shield, TrendingUp, TrendingDown } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';

interface TruthIndexProps {
  score: number;
}

export default function TruthIndex({ score }: TruthIndexProps) {
  const getColorClass = () => {
    if (score === 0) return 'from-gray-500 to-gray-400';
    if (score >= 80) return 'from-emerald-500 to-green-400';
    if (score >= 60) return 'from-cyan-500 to-teal-400';
    if (score >= 40) return 'from-amber-500 to-yellow-400';
    return 'from-red-500 to-orange-400';
  };

  const getBorderColor = () => {
    if (score === 0) return 'border-gray-500/30';
    if (score >= 80) return 'border-emerald-500/30';
    if (score >= 60) return 'border-cyan-500/30';
    if (score >= 40) return 'border-amber-500/30';
    return 'border-red-500/30';
  };

  const getLabel = () => {
    if (score === 0) return 'Awaiting Analysis';
    if (score >= 80) return 'High Authenticity';
    if (score >= 60) return 'Good Authenticity';
    if (score >= 40) return 'Mixed Signals';
    return 'Low Authenticity';
  };

  const getExplanation = () => {
    if (score === 0)
      return 'Start recording to analyze conversation authenticity.';
    if (score >= 80)
      return 'Authentic, vulnerable responses. Consistent messaging with specific details.';
    if (score >= 60)
      return 'Mostly authentic with minor hesitations. Good engagement signals.';
    if (score >= 40)
      return 'Some inconsistencies detected. Watch for evasive patterns.';
    return 'Defensive patterns detected. Vague responses and contradictions.';
  };

  const getIcon = () => {
    if (score >= 60) return <TrendingUp className="w-5 h-5 text-emerald-400" />;
    if (score >= 40) return <Shield className="w-5 h-5 text-amber-400" />;
    return <TrendingDown className="w-5 h-5 text-red-400" />;
  };

  return (
    <div className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <Shield className="w-7 h-7 text-emerald-400" />
          <div className="absolute inset-0 blur-md bg-emerald-400/30"></div>
        </div>
        <h2 className="text-2xl font-bold text-white">Truth Index™</h2>
      </div>

      <div className="text-center mb-6">
        <div className={`text-6xl font-bold bg-gradient-to-r ${getColorClass()} bg-clip-text text-transparent mb-2 transition-all duration-500`}>
          <AnimatedNumber value={score} suffix="%" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          {score > 0 && getIcon()}
          <span className="text-xl text-white font-semibold">{getLabel()}</span>
        </div>
        <div className="w-full bg-gray-800/50 rounded-full h-4 overflow-hidden mb-4">
          <div
            className={`h-full bg-gradient-to-r ${getColorClass()} transition-[width] duration-700 ease-out`}
            style={{ width: `${score}%` }}
          ></div>
        </div>
      </div>

      <div className={`bg-gray-800/30 border ${getBorderColor()} rounded-xl p-4`}>
        <p className={`text-sm leading-relaxed ${score >= 60 ? 'text-emerald-300' : score >= 40 ? 'text-amber-300' : score > 0 ? 'text-red-300' : 'text-gray-400'}`}>
          {getExplanation()}
        </p>
      </div>
    </div>
  );
}
