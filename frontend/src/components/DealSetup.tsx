import { ArrowLeft, DollarSign, Percent, Users, Target } from 'lucide-react';
import { useState } from 'react';

interface DealSetupProps {
  onBack: () => void;
}

export function DealSetup({ onBack }: DealSetupProps) {
  const [dealInfo, setDealInfo] = useState({
    productName: '',
    basePrice: '',
    commission: '',
    closeRate: '',
    avgDealSize: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Deal setup saved:', dealInfo);
    // Here you would typically save to backend/state management
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800">
      <nav className="border-b border-gray-800/50 backdrop-blur-xl bg-gray-900/40">
        <div className="max-w-[1400px] mx-auto px-8 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Deal Setup</h1>
          <p className="text-gray-400">Configure your product and deal parameters</p>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  Product/Service Name
                </div>
              </label>
              <input
                type="text"
                value={dealInfo.productName}
                onChange={(e) => setDealInfo({ ...dealInfo, productName: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                placeholder="e.g., Premium Coaching Package"
              />
            </div>

            {/* Base Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Base Price ($)
                </div>
              </label>
              <input
                type="number"
                value={dealInfo.basePrice}
                onChange={(e) => setDealInfo({ ...dealInfo, basePrice: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 transition-all"
                placeholder="e.g., 5000"
              />
            </div>

            {/* Commission Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-yellow-400" />
                  Commission Rate (%)
                </div>
              </label>
              <input
                type="number"
                step="0.1"
                value={dealInfo.commission}
                onChange={(e) => setDealInfo({ ...dealInfo, commission: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 transition-all"
                placeholder="e.g., 15"
              />
            </div>

            {/* Expected Close Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  Expected Close Rate (%)
                </div>
              </label>
              <input
                type="number"
                step="0.1"
                value={dealInfo.closeRate}
                onChange={(e) => setDealInfo({ ...dealInfo, closeRate: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                placeholder="e.g., 25"
              />
            </div>

            {/* Average Deal Size */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-cyan-400" />
                  Average Deal Size ($)
                </div>
              </label>
              <input
                type="number"
                value={dealInfo.avgDealSize}
                onChange={(e) => setDealInfo({ ...dealInfo, avgDealSize: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                placeholder="e.g., 7500"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                className="w-full px-6 py-4 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02]"
              >
                Save Deal Configuration
              </button>
            </div>
          </form>

          {/* Deal Summary */}
          {dealInfo.basePrice && dealInfo.commission && (
            <div className="mt-8 pt-8 border-t border-gray-800/50">
              <h3 className="text-xl font-semibold text-white mb-4">Deal Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Your Commission</div>
                  <div className="text-2xl font-bold text-green-400">
                    ${((parseFloat(dealInfo.basePrice) || 0) * (parseFloat(dealInfo.commission) || 0) / 100).toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Expected Monthly (10 deals)</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    ${((parseFloat(dealInfo.basePrice) || 0) * (parseFloat(dealInfo.commission) || 0) / 100 * 10).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
