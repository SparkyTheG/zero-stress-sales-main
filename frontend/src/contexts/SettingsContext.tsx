import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface PillarWeight {
  id: string;
  name: string;
  weight: number;
}

export interface PriceTierSetting {
  label: string;
  price: number;
}

export interface AdminSettings {
  pillarWeights: PillarWeight[];
  priceTiers: PriceTierSetting[];
  customScriptPrompt: string;
}

const DEFAULT_SETTINGS: AdminSettings = {
  pillarWeights: [
    { id: 'P1', name: 'Pain & Desire', weight: 1.5 },
    { id: 'P2', name: 'Urgency', weight: 1.0 },
    { id: 'P3', name: 'Decisiveness', weight: 1.0 },
    { id: 'P4', name: 'Available Money', weight: 1.5 },
    { id: 'P5', name: 'Responsibility', weight: 1.0 },
    { id: 'P6', name: 'Price Sensitivity', weight: 1.5 },
    { id: 'P7', name: 'Trust', weight: 1.5 },
  ],
  priceTiers: [
    { label: 'Starter', price: 2997 },
    { label: 'Professional', price: 7997 },
    { label: 'Elite', price: 15997 },
  ],
  customScriptPrompt: '',
};

interface SettingsContextType {
  settings: AdminSettings;
  updatePillarWeight: (pillarId: string, weight: number) => void;
  updatePriceTier: (index: number, price: number, label?: string) => void;
  updateCustomPrompt: (prompt: string) => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const STORAGE_KEY = 'zss_admin_settings';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const mergeWithDefaults = useMemo(() => {
    return (incoming: any): AdminSettings => {
      const parsed = incoming && typeof incoming === 'object' ? incoming : {};
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        pillarWeights: Array.isArray(parsed.pillarWeights) ? parsed.pillarWeights : DEFAULT_SETTINGS.pillarWeights,
        priceTiers: Array.isArray(parsed.priceTiers) ? parsed.priceTiers : DEFAULT_SETTINGS.priceTiers,
        customScriptPrompt: typeof parsed.customScriptPrompt === 'string' ? parsed.customScriptPrompt.slice(0, 70) : DEFAULT_SETTINGS.customScriptPrompt,
      };
    };
  }, []);

  const [settings, setSettings] = useState<AdminSettings>(() => {
    // Load from localStorage on init
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          pillarWeights: parsed.pillarWeights || DEFAULT_SETTINGS.pillarWeights,
          priceTiers: parsed.priceTiers || DEFAULT_SETTINGS.priceTiers,
          customScriptPrompt: typeof parsed.customScriptPrompt === 'string'
            ? parsed.customScriptPrompt.slice(0, 70)
            : DEFAULT_SETTINGS.customScriptPrompt,
        };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  const hydratingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedUserIdRef = useRef<string | null>(null);

  // Hydrate from Supabase when the user logs in (or changes)
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    hydratingRef.current = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) {
          console.error('[settings] fetch error:', error);
          return;
        }
        if (cancelled) return;
        if (data?.settings) {
          setSettings(mergeWithDefaults(data.settings));
        }
      } finally {
        // give React one tick so the initial setSettings doesn't immediately trigger a save
        setTimeout(() => {
          hydratingRef.current = false;
        }, 0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, mergeWithDefaults]);

  // Save to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }

    // Also save to Supabase if logged in (debounced)
    if (!userId) return;
    if (hydratingRef.current) return;

    // If the user just changed (login/logout), don't write stale settings immediately.
    if (lastSavedUserIdRef.current && lastSavedUserIdRef.current !== userId) {
      // allow next change to save
    }

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const payload = {
          user_id: userId,
          settings,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from('user_settings')
          .upsert(payload);
        if (error) console.error('[settings] upsert error:', error);
        lastSavedUserIdRef.current = userId;
      } catch (err) {
        console.error('[settings] upsert exception:', err);
      }
    }, 600);
  }, [settings, userId]);

  const updatePillarWeight = (pillarId: string, weight: number) => {
    setSettings(prev => ({
      ...prev,
      pillarWeights: prev.pillarWeights.map(p =>
        p.id === pillarId ? { ...p, weight: Math.max(0.5, Math.min(3.0, weight)) } : p
      ),
    }));
  };

  const updatePriceTier = (index: number, price: number, label?: string) => {
    setSettings(prev => ({
      ...prev,
      priceTiers: prev.priceTiers.map((t, i) =>
        i === index ? { ...t, price: Math.max(0, price), ...(label !== undefined ? { label } : {}) } : t
      ),
    }));
  };

  const updateCustomPrompt = (prompt: string) => {
    setSettings(prev => ({
      ...prev,
      customScriptPrompt: prompt.slice(0, 70),
    }));
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updatePillarWeight,
        updatePriceTier,
        updateCustomPrompt,
        resetToDefaults,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
