import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type SummaryStatus = 'progressive' | 'final';

type CallSessionSummaryRow = {
  id: string;
  session_id: string;
  status: SummaryStatus;
  title: string | null;
  preview: string | null;
  summary: any;
  duration_seconds: number | null;
  created_at: string;
};

function formatMinutes(durationSeconds: number | null): string {
  const mins = Math.max(0, Math.round(((durationSeconds ?? 0) / 60) * 10) / 10);
  return `${mins} minutes`;
}

function safeArray(value: any): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string' && v.trim());
  return [];
}

export default function ConversationSummaries({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<CallSessionSummaryRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('call_session_summaries')
        .select('id,session_id,status,title,preview,summary,duration_seconds,created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      const list = (data ?? []) as CallSessionSummaryRow[];
      setRows(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      } else if (selectedId && list.length > 0 && !list.some((r) => r.id === selectedId)) {
        setSelectedId(list[0].id);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load summaries');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  const summary = selected?.summary ?? {};
  const title = (selected?.title || (summary?.title as string) || 'conversation').toString();
  const executiveSummary = (summary?.executiveSummary as string) || '';
  const prospectSituation = (summary?.prospectSituation as string) || '';
  const keyPoints = safeArray(summary?.keyPoints);
  const objectionsRaised = safeArray(summary?.objectionsRaised);
  const objectionsResolved = safeArray(summary?.objectionsResolved);
  const nextSteps = safeArray(summary?.nextSteps);
  const closerPerformance = (summary?.closerPerformance as string) || '';
  const prospectReadiness = (summary?.prospectReadiness as string) || '';
  const recommendations = (summary?.recommendations as string) || '';

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800/60 hover:bg-gray-700 border border-gray-700/50 rounded-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span className="text-gray-300 text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-white">Conversation Summaries</h2>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 rounded-lg transition-all text-cyan-200 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left list */}
        <div className="lg:col-span-1">
          <div className="text-white font-semibold mb-3">All Summaries</div>
          <div className="space-y-3">
            {rows.length === 0 ? (
              <div className="p-4 bg-gray-900/40 border border-gray-700/40 rounded-xl text-gray-400 text-sm">
                {loading ? 'Loading...' : 'No summaries yet. Start a call while logged in, then end the session.'}
              </div>
            ) : (
              rows.map((r) => {
                const isSelected = r.id === selectedId;
                const statusLabel = r.status === 'final' ? 'Final' : 'Progressive';
                const statusClasses =
                  r.status === 'final'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300';
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40'
                        : 'bg-gray-900/30 border-gray-700/40 hover:bg-gray-900/45'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusClasses}`}>{statusLabel}</span>
                      <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-white font-semibold">{(r.title || 'conversation').toString()}</div>
                    <div className="text-gray-400 text-sm">{formatMinutes(r.duration_seconds)}</div>
                    <div className="text-gray-400 text-sm mt-2 line-clamp-2">{r.preview || ''}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right detail */}
        <div className="lg:col-span-2">
          <div className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl p-6">
            {!selected ? (
              <div className="text-gray-400">Select a summary on the left.</div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="text-xl font-bold text-white">Conversation Summary</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {new Date(selected.created_at).toLocaleString()} • {title} •{' '}
                    <span className={selected.status === 'final' ? 'text-emerald-300' : 'text-amber-300'}>
                      {selected.status === 'final' ? 'Final Summary' : 'Progressive Summary'}
                    </span>
                  </div>
                </div>

                {executiveSummary && (
                  <section className="mb-6">
                    <div className="text-cyan-300 font-semibold mb-2">Executive Summary</div>
                    <div className="text-gray-200 leading-relaxed">{executiveSummary}</div>
                  </section>
                )}

                {prospectSituation && (
                  <section className="mb-6">
                    <div className="text-cyan-300 font-semibold mb-2">Prospect Situation</div>
                    <div className="text-gray-200 leading-relaxed">{prospectSituation}</div>
                  </section>
                )}

                {keyPoints.length > 0 && (
                  <section className="mb-6">
                    <div className="text-cyan-300 font-semibold mb-2">Key Points</div>
                    <ul className="list-disc pl-5 space-y-2 text-gray-200">
                      {keyPoints.map((p, idx) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {objectionsRaised.length > 0 && (
                  <section className="mb-6">
                    <div className="text-amber-300 font-semibold mb-2">Objections Raised</div>
                    <ul className="list-disc pl-5 space-y-2 text-gray-200">
                      {objectionsRaised.map((p, idx) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {objectionsResolved.length > 0 && (
                  <section className="mb-6">
                    <div className="text-emerald-300 font-semibold mb-2">Objections Resolved</div>
                    <ul className="list-disc pl-5 space-y-2 text-gray-200">
                      {objectionsResolved.map((p, idx) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {nextSteps.length > 0 && (
                  <section className="mb-6">
                    <div className="text-purple-300 font-semibold mb-2">Next Steps</div>
                    <ul className="list-disc pl-5 space-y-2 text-gray-200">
                      {nextSteps.map((p, idx) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {closerPerformance && (
                  <section className="mb-6">
                    <div className="text-cyan-300 font-semibold mb-2">Closer Performance</div>
                    <div className="text-gray-200 leading-relaxed">{closerPerformance}</div>
                  </section>
                )}

                {prospectReadiness && (
                  <section className="mb-6">
                    <div className="text-cyan-300 font-semibold mb-2">Prospect Readiness</div>
                    <div className="text-gray-200 font-mono">{prospectReadiness}</div>
                  </section>
                )}

                {recommendations && (
                  <section>
                    <div className="text-cyan-300 font-semibold mb-2">Recommendations</div>
                    <div className="text-gray-200 leading-relaxed">{recommendations}</div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

