import { Brain, Zap, Target, AlertTriangle } from 'lucide-react';
import { IndicatorsView } from './IndicatorsView';

export function IntelligenceLayer() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <Brain className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Intelligence Layer</h1>
            <p className="text-purple-300">AI-powered deep analysis and pattern recognition</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Real-time Analysis</span>
            </div>
            <div className="text-2xl font-bold text-white">Active</div>
            <div className="text-xs text-green-400 mt-1">6 AI models running</div>
          </div>

          <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-cyan-400" />
              <span className="text-sm text-gray-400">Confidence Score</span>
            </div>
            <div className="text-2xl font-bold text-cyan-400">87%</div>
            <div className="text-xs text-gray-400 mt-1">High accuracy</div>
          </div>

          <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-gray-400">Patterns Detected</span>
            </div>
            <div className="text-2xl font-bold text-white">14</div>
            <div className="text-xs text-gray-400 mt-1">Behavioral signals</div>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Pattern Recognition
          </h3>
          <div className="space-y-3">
            <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
              <div className="text-sm font-medium text-purple-300 mb-1">High Decision Authority</div>
              <div className="text-xs text-gray-400">
                Prospect uses first-person language ("I decide", "I'll make the call")
              </div>
            </div>
            <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="text-sm font-medium text-green-300 mb-1">Strong Pain Awareness</div>
              <div className="text-xs text-gray-400">
                Multiple references to current challenges and frustrations
              </div>
            </div>
            <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <div className="text-sm font-medium text-yellow-300 mb-1">Price Sensitivity Detected</div>
              <div className="text-xs text-gray-400">
                Asked about payment plans and compared to competitors
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Recommended Actions
          </h3>
          <div className="space-y-3">
            <div className="p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
              <div className="text-sm font-medium text-cyan-300 mb-1">Emphasize ROI & Timeline</div>
              <div className="text-xs text-gray-400">
                Prospect shows high urgency - frame investment in terms of cost of delay
              </div>
            </div>
            <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="text-sm font-medium text-blue-300 mb-1">Address Trust Gaps</div>
              <div className="text-xs text-gray-400">
                Provide case studies and testimonials from similar clients
              </div>
            </div>
            <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
              <div className="text-sm font-medium text-purple-300 mb-1">Close Soon</div>
              <div className="text-xs text-gray-400">
                All green lights - lubometer at 76%. Move to close within 48hrs
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Indicators */}
      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Target className="w-6 h-6 text-cyan-400" />
          Detailed Indicator Analysis
        </h3>
        <IndicatorsView />
      </div>

      {/* AI Model Status */}
      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">AI Models Active</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-gray-800/40 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Psychological Dials</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-white font-medium">Running</span>
            </div>
          </div>
          <div className="p-3 bg-gray-800/40 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Objection Detector</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-white font-medium">Running</span>
            </div>
          </div>
          <div className="p-3 bg-gray-800/40 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Script Generator</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-white font-medium">Running</span>
            </div>
          </div>
          <div className="p-3 bg-gray-800/40 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Lubometer</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-white font-medium">Running</span>
            </div>
          </div>
          <div className="p-3 bg-gray-800/40 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Truth Index</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-white font-medium">Running</span>
            </div>
          </div>
          <div className="p-3 bg-gray-800/40 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Red Flags</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-white font-medium">Running</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
