import { useState, useEffect, useCallback, useRef } from 'react';
import { User, Settings, Users, Star } from 'lucide-react';
import WhisperEngine from './components/WhisperEngine';
import Lubometer from './components/Lubometer';
import PsychologicalDials from './components/PsychologicalDials';
import TruthIndex from './components/TruthIndex';
import RedFlags from './components/RedFlags';
import TopObjections from './components/TopObjections';
import CustomerProfile from './components/CustomerProfile';
import CloserProfileView from './components/CloserProfileView';
import SalesManagerDashboard from './components/SalesManagerDashboard';
import PricingPage from './components/PricingPage';
import FoundingMemberPage from './components/FoundingMemberPage';
import RecordingButton from './components/RecordingButton';
import {
  CUSTOMER_NAME,
  customerProfile,
} from './data/mockData';
import { closerProfile } from './data/closerData';
import { salesManagerProfile } from './data/managerData';
import { getWebSocketClient } from './lib/websocket';
import type { AnalysisResult, Objection, PsychologicalDial, RedFlag, LubometerTier } from './types';

function App() {
  const [selectedObjection, setSelectedObjection] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'profile' | 'closer-profile' | 'manager-dashboard'>('dashboard');
  const [userRole] = useState<'closer' | 'manager'>('closer');
  const [showPricing, setShowPricing] = useState(false);
  const [showFoundingMember, setShowFoundingMember] = useState(false);
  
  // Real-time analysis state - start empty, only show real AI data
  const [objections, setObjections] = useState<Objection[]>([]);
  const [psychologicalDials, setPsychologicalDials] = useState<PsychologicalDial[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  // Prevent "flapping" where one analysis finds flags and a later run returns [] and clears them.
  // We only clear after 2 consecutive empty redFlags updates.
  const redFlagsEmptyStreakRef = useRef(0);
  const [lubometerTiers, setLubometerTiers] = useState<LubometerTier[]>([]);
  const [truthIndexScore, setTruthIndexScore] = useState(0);
  const [aiObjectionScripts, setAiObjectionScripts] = useState<Record<string, any>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [wsClientRef, setWsClientRef] = useState<ReturnType<typeof getWebSocketClient> | null>(null);

  useEffect(() => {
    try {
      const wsClient = getWebSocketClient(); // URL determined automatically
      setWsClientRef(wsClient);
      
      // Handle partial updates (progressive updates - FAST)
      wsClient.onPartialUpdate((type: string, data: any) => {
        console.log(`Partial update received (${type}):`, data);
        
        if (type === 'scripts') {
          // Scripts update - MERGE with existing scripts (don't replace!)
          if (data.objectionScripts) {
            console.log('Scripts update received:', Object.keys(data.objectionScripts));
            setAiObjectionScripts(prev => {
              // Merge new scripts with existing ones
              const merged = { ...prev, ...data.objectionScripts };
              console.log('Merged scripts:', Object.keys(merged));
              return merged;
            });
          }
        } else if (type === 'partial') {
          // Progressive partial updates - update state incrementally
          if (data.psychologicalDials) {
            setPsychologicalDials(data.psychologicalDials || []);
          }
          
          if (data.objections) {
            setObjections(data.objections || []);
          }
          
          if (data.lubometer) {
            setLubometerTiers(data.lubometer.priceTiers || []);
          }
          
          if (data.truthIndex) {
            setTruthIndexScore(data.truthIndex.score ?? 0);
          }
          
          // Red flags: treat empty array as "maybe none", not an immediate clear (reduces flicker).
          if (Object.prototype.hasOwnProperty.call(data, 'redFlags') && Array.isArray(data.redFlags)) {
            const incoming: RedFlag[] = data.redFlags;
            if (incoming.length > 0) {
              redFlagsEmptyStreakRef.current = 0;
              setRedFlags(incoming);
            } else {
              redFlagsEmptyStreakRef.current += 1;
              if (redFlagsEmptyStreakRef.current >= 2) {
                setRedFlags([]);
              }
            }
          }
        }
      });
      
      // Handle full analysis (backward compatibility - fallback)
      wsClient.onAnalysis((data: AnalysisResult) => {
        console.log('Full analysis received (fallback):', data);
        
        // Fallback: Update all at once if full analysis received
        setObjections(data.objections || []);
        setPsychologicalDials(data.psychologicalDials || []);
        // Apply same "anti-flap" behavior for red flags on full analysis payloads
        if (Array.isArray(data.redFlags)) {
          if (data.redFlags.length > 0) {
            redFlagsEmptyStreakRef.current = 0;
            setRedFlags(data.redFlags);
          } else {
            redFlagsEmptyStreakRef.current += 1;
            if (redFlagsEmptyStreakRef.current >= 2) {
              setRedFlags([]);
            }
          }
        } else {
          // If backend omits redFlags, don't clear existing UI
        }
        setLubometerTiers(data.lubometer?.priceTiers || []);
        setTruthIndexScore(data.truthIndex?.score ?? 0);
        // MERGE scripts with existing (don't replace)
        if (data.objectionScripts && Object.keys(data.objectionScripts).length > 0) {
          setAiObjectionScripts(prev => ({ ...prev, ...data.objectionScripts }));
        }
      });

      wsClient.onError((error) => {
        console.error('WebSocket error:', error);
      });

      wsClient.connect();
      console.log('WebSocket client initialized');

      return () => {
        wsClient.disconnect();
      };
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
    }
  }, []);

  // Use only AI-generated scripts - no mock data fallback
  // Scripts are keyed as obj1_1, obj1_2, obj1_3 (3 per objection)
  // Find ALL scripts for the selected objection
  const currentScripts = selectedObjection 
    ? Object.entries(aiObjectionScripts)
        .filter(([key]) => key.startsWith(`${selectedObjection}_`))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([_, script]) => script)
    : [];

  // Handle transcript from speech recognition
  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    if (wsClientRef && text.trim()) {
      console.log(`Transcript (${isFinal ? 'final' : 'interim'}):`, text);
      wsClientRef.sendTranscript(text, 'prospect', isFinal);
    }
  }, [wsClientRef]);

  const handleRecordingStateChange = useCallback((recording: boolean) => {
    setIsRecording(recording);
    console.log('Recording state:', recording ? 'Started' : 'Stopped');
  }, []);

  const handleObjectionClick = (objectionId: string) => {
    // Disabled auto-scroll - user requested no scrolling on click
  };

  const handleSelectCall = (callId: string) => {
    setView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (view === 'profile') {
    return (
      <CustomerProfile
        profile={customerProfile}
        onBack={() => setView('dashboard')}
        onSelectCall={handleSelectCall}
      />
    );
  }

  if (view === 'closer-profile') {
    return (
      <CloserProfileView
        profile={closerProfile}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'manager-dashboard') {
    return (
      <SalesManagerDashboard
        profile={salesManagerProfile}
        onCloserClick={(closerId) => {
          console.log('Clicked closer:', closerId);
        }}
        onBack={() => setView('dashboard')}
      />
    );
  }

  console.log('App component rendering...');
  console.log('Objections:', objections.length);
  console.log('Dials:', psychologicalDials.length);
  console.log('Red flags:', redFlags.length);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800" style={{ minHeight: '100vh' }}>
      <nav className="border-b border-gray-800/50 backdrop-blur-xl bg-gray-900/40">
        <div className="max-w-[1800px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowPricing(true)}
                className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent hover:from-teal-300 hover:to-cyan-300 transition-all cursor-pointer"
                title="God Mode 😉"
              >
                Zero-Stress Sales™
              </button>
              <div className="text-sm text-gray-400">Closer Co-Pilot</div>
            </div>
            <div className="flex items-center gap-4">
              <RecordingButton
                onTranscript={handleTranscript}
                onRecordingStateChange={handleRecordingStateChange}
              />
              <button
                onClick={() => setView('manager-dashboard')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 rounded-lg transition-all group"
              >
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-gray-300 text-sm font-medium">Manager Dashboard</span>
              </button>
              {userRole === 'closer' && (
                <button
                  onClick={() => setView('closer-profile')}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 rounded-lg transition-all group"
                >
                  <Settings className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform duration-300" />
                  <span className="text-gray-300 text-sm font-medium">Closer Profile</span>
                </button>
              )}
              <button
                onClick={() => setView('profile')}
                className="flex items-center gap-4 hover:opacity-80 transition-opacity"
              >
                <div className="text-right">
                  <div className="text-white font-semibold">{CUSTOMER_NAME}</div>
                  <div className="text-sm text-teal-400">High Propensity Buyer</div>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 p-0.5">
                  <img
                    src={customerProfile.photo}
                    alt={CUSTOMER_NAME}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1800px] mx-auto px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-6">
            <Lubometer tiers={lubometerTiers} />
            <PsychologicalDials dials={psychologicalDials} />
          </div>

          <div id="whisper-engine" className="col-span-6">
            <WhisperEngine
              objections={objections}
              selectedObjection={selectedObjection}
              onSelectObjection={setSelectedObjection}
              scripts={currentScripts}
              onObjectionClick={handleObjectionClick}
            />
          </div>

          <div className="col-span-3 space-y-6">
            <TruthIndex score={truthIndexScore} />
            <RedFlags flags={redFlags} />
          </div>

          <div className="col-span-12">
            <TopObjections objections={objections} highlightedObjection={selectedObjection} />
          </div>
        </div>
      </div>

      {showPricing && <PricingPage onClose={() => setShowPricing(false)} />}
      {showFoundingMember && <FoundingMemberPage onClose={() => setShowFoundingMember(false)} />}

      <footer className="border-t border-gray-800/50 mt-12">
        <div className="max-w-[1800px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="text-gray-400 text-sm">
              © 2024 Zero-Stress Sales™. All rights reserved.
            </div>
            <button
              onClick={() => setShowFoundingMember(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all transform hover:scale-105"
            >
              <Star className="w-5 h-5" />
              Founding Member Beta
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
