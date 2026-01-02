import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, Settings, DollarSign, Scale, MessageSquare, RotateCcw } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';

// Separate component for price tier input with local state for smooth editing
function PriceTierInput({ 
  index, 
  label, 
  price, 
  onUpdate 
}: { 
  index: number; 
  label: string; 
  price: number; 
  onUpdate: (index: number, price: number, label?: string) => void;
}) {
  const [localLabel, setLocalLabel] = useState(label);
  const [localPrice, setLocalPrice] = useState(String(price));

  // Sync from parent when props change (e.g., reset to defaults)
  useEffect(() => {
    setLocalLabel(label);
    setLocalPrice(String(price));
  }, [label, price]);

  const handleLabelBlur = () => {
    onUpdate(index, price, localLabel);
  };

  const handlePriceBlur = () => {
    const parsed = parseInt(localPrice) || 0;
    setLocalPrice(String(parsed)); // Normalize display
    onUpdate(index, parsed, undefined);
  };

  return (
    <div className="p-4 bg-gray-800/40 border border-gray-700/40 rounded-xl">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1">Label</label>
          <input
            type="text"
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={handleLabelBlur}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1">Price ($)</label>
          <input
            type="text"
            inputMode="numeric"
            value={localPrice}
            onChange={(e) => setLocalPrice(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={handlePriceBlur}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-3 text-right">
        <span className="text-emerald-400 font-bold text-lg">
          ${(parseInt(localPrice) || 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const { settings, updatePillarWeight, updatePriceTier, updateCustomPrompt, resetToDefaults } = useSettings();
  const { user, loading, signInWithPassword, signUpWithPassword, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const calculateMaxScore = () => {
    return settings.pillarWeights.reduce((sum, p) => sum + p.weight * 10, 0);
  };

  const authStatusLabel = useMemo(() => {
    if (loading) return 'Checking session...';
    if (user?.email) return `Signed in as ${user.email}`;
    return 'Not signed in';
  }, [loading, user?.email]);

  const handleAuth = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      const emailTrimmed = email.trim();
      if (!emailTrimmed) {
        setAuthError('Email is required.');
        return;
      }
      if (!password) {
        setAuthError('Password is required.');
        return;
      }
      const result = authMode === 'signin'
        ? await signInWithPassword(emailTrimmed, password)
        : await signUpWithPassword(emailTrimmed, password);
      if (result.error) setAuthError(result.error);
      if (!result.error) setPassword('');
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800">
      {/* Header */}
      <nav className="border-b border-gray-800/50 backdrop-blur-xl bg-gray-900/40">
        <div className="max-w-[1400px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800/60 hover:bg-gray-700 border border-gray-700/50 rounded-lg transition-all"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400" />
                <span className="text-gray-300 text-sm font-medium">Back to Dashboard</span>
              </button>
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 text-cyan-400" />
                <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-300">
                <span className="text-gray-400">Auth:</span> {authStatusLabel}
              </div>
              {user ? (
                <button
                  onClick={() => signOut()}
                  className="px-4 py-2 bg-gray-800/60 hover:bg-gray-700 border border-gray-700/50 rounded-lg transition-all text-gray-200 text-sm font-medium"
                >
                  Sign out
                </button>
              ) : null}
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg transition-all"
              >
                <RotateCcw className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-sm font-medium">Reset to Defaults</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-8 py-8">
        {!user && (
          <div className="mb-8 backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-2">Sign in to save settings</h2>
            <p className="text-sm text-gray-400 mb-4">
              When you sign in, your Admin Panel settings will be saved to Supabase and automatically loaded next time.
            </p>

            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setAuthMode('signin')}
                className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                  authMode === 'signin'
                    ? 'bg-cyan-600/30 border-cyan-500/60 text-white'
                    : 'bg-gray-800/40 border-gray-700/50 text-gray-300 hover:bg-gray-800/60'
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => setAuthMode('signup')}
                className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                  authMode === 'signup'
                    ? 'bg-purple-600/30 border-purple-500/60 text-white'
                    : 'bg-gray-800/40 border-gray-700/50 text-gray-300 hover:bg-gray-800/60'
                }`}
              >
                Create account
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAuth}
                  disabled={authBusy || loading}
                  className="w-full px-4 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-60 disabled:cursor-not-allowed border border-cyan-500/40 rounded-lg transition-all text-white text-sm font-semibold"
                >
                  {authMode === 'signin' ? 'Sign in' : 'Sign up'}
                </button>
              </div>
            </div>

            {authError && (
              <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                {authError}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pillar Weights Section */}
          <div className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <Scale className="w-7 h-7 text-purple-400" />
                <div className="absolute inset-0 blur-md bg-purple-400/30" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Lubometer Pillar Weights</h2>
                <p className="text-sm text-gray-400">Adjust weights for each pillar (0.5 - 3.0)</p>
              </div>
            </div>

            <div className="space-y-4">
              {settings.pillarWeights.map((pillar) => (
                <div
                  key={pillar.id}
                  className="p-4 bg-gray-800/40 border border-gray-700/40 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400 font-mono text-sm">{pillar.id}</span>
                      <span className="text-white font-medium">{pillar.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.5"
                        max="3.0"
                        step="0.1"
                        value={pillar.weight}
                        onChange={(e) => updatePillarWeight(pillar.id, parseFloat(e.target.value) || 1.0)}
                        className="w-20 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-center font-mono focus:border-cyan-500 focus:outline-none"
                      />
                      <span className="text-gray-400 text-sm">×</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={pillar.weight}
                    onChange={(e) => updatePillarWeight(pillar.id, parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Maximum Lubometer Score:</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  {calculateMaxScore().toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Price Tiers Section */}
          <div className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <DollarSign className="w-7 h-7 text-emerald-400" />
                <div className="absolute inset-0 blur-md bg-emerald-400/30" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Price Tiers</h2>
                <p className="text-sm text-gray-400">Configure your Lubometer price tiers</p>
              </div>
            </div>

            <div className="space-y-4">
              {settings.priceTiers.map((tier, index) => (
                <PriceTierInput
                  key={index}
                  index={index}
                  label={tier.label}
                  price={tier.price}
                  onUpdate={updatePriceTier}
                />
              ))}
            </div>
          </div>

          {/* Custom Script Prompt Section */}
          <div className="lg:col-span-2 backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <MessageSquare className="w-7 h-7 text-amber-400" />
                <div className="absolute inset-0 blur-md bg-amber-400/30" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Custom Script Prompt</h2>
                <p className="text-sm text-gray-400">
                  Add custom context for personalized handling scripts (max 70 characters)
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <textarea
                value={settings.customScriptPrompt}
                onChange={(e) => updateCustomPrompt(e.target.value)}
                maxLength={70}
                placeholder="e.g., Focus on building trust before presenting price..."
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none resize-none h-24"
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  This text will be included in AI script generation prompts
                </span>
                <span className={`text-sm font-mono ${
                  settings.customScriptPrompt.length >= 60 ? 'text-amber-400' : 'text-gray-400'
                }`}>
                  {settings.customScriptPrompt.length}/70
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Summary */}
        <div className="mt-8 backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Current Configuration Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-800/40 rounded-xl">
              <div className="text-sm text-gray-400 mb-1">Pillar Weights</div>
              <div className="text-white font-mono text-sm">
                {settings.pillarWeights.map(p => `${p.id}:${p.weight}`).join(' | ')}
              </div>
            </div>
            <div className="p-4 bg-gray-800/40 rounded-xl">
              <div className="text-sm text-gray-400 mb-1">Price Tiers</div>
              <div className="text-emerald-400 font-mono text-sm">
                {settings.priceTiers.map(t => `$${t.price.toLocaleString()}`).join(' | ')}
              </div>
            </div>
            <div className="p-4 bg-gray-800/40 rounded-xl">
              <div className="text-sm text-gray-400 mb-1">Custom Prompt</div>
              <div className="text-amber-400 text-sm truncate">
                {settings.customScriptPrompt || '(Not set)'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
