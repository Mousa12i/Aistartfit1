import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, Brain, Download, FileText, RefreshCw, Stethoscope, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useEntitlements } from '@/lib/entitlements-context';
import { TIERS } from '@/lib/entitlements';
import { supabase } from '@/lib/supabase';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { StripeUpgradeModal } from '@/components/ui/StripeUpgradeModal';
import { cn } from '@/lib/utils';
import type { RecoveryMuscle } from '@/lib/recovery/muscles';
import { MUSCLE_LABELS } from '@/lib/recovery/muscles';
import type { MuscleRecoveryState } from '@/lib/recovery/engine';
import { fetchFullRecoveryData, createSorenessLog, localDateKey, type FullRecoveryData } from '@/lib/recovery/store';
import { buildDoctor, type DoctorExtras, type NextWorkout } from '@/lib/recovery/doctor/build';
import { fetchDoctorExtras, fetchNextWorkout } from '@/lib/recovery/doctor/api';
import { coachSnapshot, type RecoveryCoachLink } from '@/lib/recovery/doctor/coach-api';
import { renderRecoveryPdf, recoveryPdfFilename, type RecoveryPdfKind } from '@/lib/recovery/doctor/pdf';
import { downloadBlob } from '@/lib/nutrition/pdf';
import { CheckInCard } from '@/components/recovery/CheckInCard';
import { Gate } from '@/components/recovery/Gate';
import { useLiveRoutineMap } from '@/features/recovery/hooks/useLiveRoutineMap';
import { RecoveryBodyModel } from '@/components/recovery/RecoveryBodyModel';
import { MuscleReportPanel, RecoveryFeedback, SorenessLogger, latestSoreness } from '@/components/recovery/MuscleReportPanel';
import { DecisionCard, DeloadCard, MorningCheckIn, SleepCard, ThisWeekCard, WeeklyReportCard } from './doctor/TodayPanels';
import { TrendsPanel } from './doctor/TrendsPanel';
import { CycleCard, FingerprintCard, WhatWorksCard } from './doctor/InsightsPanel';
import { MethodsPanel } from './doctor/MethodsPanel';
import { InjuryPanel } from './doctor/InjuryPanel';
import { RecoveryCoachChat } from './doctor/RecoveryCoachChat';
import { AiConsentGate } from '@/components/privacy/AiConsentGate';
import { RecoverySources } from './doctor/ui';
import { CoachNoteCard, TonightCard } from './doctor/CoachCards';

interface RecoveryProps {
  onBack: () => void;
}

interface DisplayMuscle {
  muscle: RecoveryMuscle;
  label: string;
}

const DISPLAY_MUSCLES: DisplayMuscle[] = [
  { muscle: 'upper_chest', label: 'UPPER CHEST' },
  { muscle: 'lower_chest', label: 'LOWER CHEST' },
  { muscle: 'front_delts', label: 'FRONT DELTS' },
  { muscle: 'side_delts', label: 'SIDE DELTS' },
  { muscle: 'rear_delts', label: 'REAR DELTS' },
  { muscle: 'biceps', label: 'BICEPS' },
  { muscle: 'triceps', label: 'TRICEPS' },
  { muscle: 'forearms', label: 'FOREARMS' },
  { muscle: 'abs', label: 'ABS' },
  { muscle: 'obliques', label: 'OBLIQUES' },
  { muscle: 'traps', label: 'TRAPEZIUS' },
  { muscle: 'lats', label: 'LATS' },
  { muscle: 'mid_back', label: 'MID BACK' },
  { muscle: 'lower_back', label: 'LOWER BACK' },
  { muscle: 'glutes', label: 'GLUTES' },
  { muscle: 'quads', label: 'QUADRICEPS' },
  { muscle: 'hamstrings', label: 'HAMSTRINGS' },
  { muscle: 'adductors', label: 'ADDUCTORS' },
  { muscle: 'calves', label: 'CALVES' },
];

type Tab = 'today' | 'trends' | 'you' | 'methods' | 'injury' | 'coach';
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'trends', label: 'Trends' },
  { id: 'you', label: 'You' },
  { id: 'methods', label: 'Methods' },
  { id: 'injury', label: 'Pain & injury' },
  { id: 'coach', label: 'Coach' },
];

const EMPTY_EXTRAS: DoctorExtras = { adjustments: [], rtt: [], cycleTracking: false, cycleStarts: [], modalityLogs: [] };

export function Recovery({ onBack }: RecoveryProps) {
  const { user, profile } = useAuth();
  const { tier, hasRecovery } = useEntitlements();
  const [data, setData] = useState<FullRecoveryData | null>(null);
  const [extras, setExtras] = useState<DoctorExtras>(EMPTY_EXTRAS);
  const [nextWorkout, setNextWorkout] = useState<NextWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<RecoveryMuscle | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [lastDataRefresh, setLastDataRefresh] = useState<Date>(new Date());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const routineMap = useLiveRoutineMap();
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const now = new Date();
      const [full, ex, next] = await Promise.all([
        fetchFullRecoveryData(now),
        fetchDoctorExtras(now).catch(() => EMPTY_EXTRAS),
        fetchNextWorkout().catch(() => null),
      ]);
      setData(full);
      setExtras(ex);
      setNextWorkout(next);
      setLastDataRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load recovery data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    const reload = () => { void loadData(); };
    const channel = supabase
      .channel('recovery_muscle_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_sessions' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_set_logs' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_checkins' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'soreness_logs' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recovery_logs' }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const state = useMemo(
    () => (data ? buildDoctor({ full: data, extras, now: new Date(), nextWorkout, bodyWeightKg: profile?.weight_kg ?? null }) : null),
    [data, extras, nextWorkout, profile?.weight_kg],
  );

  const muscleStates = data?.muscleStates ?? [];
  const todayKeyLocal = localDateKey(new Date());
  const sleepLastNight = data?.sleepHistory.find((e) => e.date === todayKeyLocal)?.sleepHours ?? null;
  const trainedToday = (data?.sessions ?? []).some((s) => localDateKey(new Date(s.completed_at)) === todayKeyLocal);
  const coachNextWorkout = useMemo(
    () => (state?.nextWorkout ? { name: `${state.nextWorkout.planName} · ${state.nextWorkout.dayLabel}`, muscles: state.nextWorkout.muscles } : null),
    [state?.nextWorkout],
  );
  const stateByMuscle = useMemo(() => new Map(muscleStates.map((s) => [s.muscle, s])), [muscleStates]);
  const userName = (profile?.display_name || user?.email?.split('@')[0] || 'ATHLETE').toUpperCase();
  const totalMusclesWithData = DISPLAY_MUSCLES.filter((m) => stateByMuscle.get(m.muscle)?.recoveryPercent != null).length;
  const lowest = DISPLAY_MUSCLES
    .map((item) => ({ item, value: stateByMuscle.get(item.muscle)?.recoveryPercent ?? null }))
    .filter((e): e is { item: DisplayMuscle; value: number } => e.value != null)
    .sort((a, b) => a.value - b.value)[0] ?? null;
  const avgRecovery = (() => {
    const values = DISPLAY_MUSCLES.map((m) => stateByMuscle.get(m.muscle)?.recoveryPercent).filter((v): v is number => v != null);
    return values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  })();

  const downloadPdf = (kind: RecoveryPdfKind) => {
    setPdfError(null);
    if (!hasRecovery('recoveryPdf')) {
      setShowUpgrade(true);
      return;
    }
    if (!state || !data) return;
    try {
      const bytes = renderRecoveryPdf({ kind, state, muscles: data.muscleStates, painLogs: data.painLogs, personName: profile?.display_name ?? null });
      downloadBlob(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }), recoveryPdfFilename(kind, state.today));
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'Could not create the PDF.');
    }
  };

  const onCoachLink = (l: RecoveryCoachLink) => {
    if (l === 'checkin') { setTab('today'); setShowCheckIn(true); }
    else if (l === 'rate_session' || l === 'sleep' || l === 'deload') setTab('today');
    else if (l === 'triage' || l === 'return_to_training') setTab('injury');
    else if (l === 'methods') setTab('methods');
    else if (l === 'report_pdf') downloadPdf('personal');
    else if (l === 'nutrition') navigate('/nutrition');
  };

  if (loading) return <div className="px-5 pt-12"><LoadingState label="Loading Recovery Doctor..." /></div>;
  if (error && !data) return <ErrorState message={error} onRetry={() => { setLoading(true); void loadData(); }} />;

  return (
    <div className="min-h-screen bg-[#071018] pb-28 text-white animate-fade-in">
      <header className="sticky top-0 z-30 border-b border-[#243442] bg-[#111c27]/95 px-5 pb-3 pt-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={onBack} aria-label="Back" className="mr-1 rounded-full bg-black/20 p-2 text-cloud-dim hover:text-white"><X className="h-5 w-5" /></button>
            <h1 className="text-[20px] font-black tracking-tight">RECOVERY DOCTOR</h1>
            <span className="rounded-md bg-[#4ee18d] px-2 py-0.5 text-[11px] font-black text-[#082016]">{TIERS[tier].label}</span>
          </div>
          <div className="flex items-center gap-2 text-right">
            <span className="hidden max-w-[110px] truncate text-[11px] font-bold leading-tight text-cloud sm:block">{userName}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#4ee18d]/70 bg-[#102f2d] text-[#4ee18d]"><Brain className="h-4 w-4" /></div>
          </div>
        </div>
        <nav className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-0.5" aria-label="Recovery sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              data-testid={`tab-${t.id}`}
              className={cn('flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors', tab === t.id ? 'bg-[#8ad8f3] text-[#071018]' : 'bg-[#172431] text-cloud-dim hover:text-white')}
            >
              {t.id === 'coach' && <Stethoscope className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />}
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-5 py-5">
        {error && <div className="rounded-xl border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-rust">{error}</div>}

        {tab === 'today' && state && (
          <>
            <CoachNoteCard muscles={muscleStates} sleepLastNight={sleepLastNight} nextWorkout={coachNextWorkout} onAsk={() => setTab('coach')} />
            <DecisionCard state={state} onCheckIn={() => setShowCheckIn(true)} onTriage={() => setTab('injury')} />

            <section className="space-y-3">
              <div className="relative">
                <RecoveryBodyModel muscleStates={muscleStates} selectedMuscle={selectedMuscle} onSelectMuscle={(m) => setSelectedMuscle(m)} />
                {selectedMuscle && (
                  <MuscleReportPanel
                    muscle={selectedMuscle}
                    state={stateByMuscle.get(selectedMuscle)}
                    soreness={latestSoreness(data?.sorenessLogs ?? [], selectedMuscle)}
                    plannedNext={state.nextWorkout?.muscles.includes(selectedMuscle) ?? false}
                    nextWorkoutName={state.nextWorkout ? `${state.nextWorkout.planName} · ${state.nextWorkout.dayLabel}` : null}
                    onClose={() => setSelectedMuscle(null)}
                  />
                )}
              </div>
              {selectedMuscle && (
                <SorenessLogger
                  muscle={selectedMuscle}
                  current={latestSoreness(data?.sorenessLogs ?? [], selectedMuscle)?.soreness_score ?? null}
                  onLog={(score) => { void createSorenessLog(selectedMuscle, score).then(() => loadData()); }}
                />
              )}
              {selectedMuscle && (
                <RecoveryFeedback
                  key={selectedMuscle}
                  muscle={selectedMuscle}
                  state={stateByMuscle.get(selectedMuscle)}
                  currentMultiplier={data?.recoveryProfile.find((p) => p.muscle === selectedMuscle)?.personal_multiplier ?? 1}
                  sampleSize={data?.recoveryProfile.find((p) => p.muscle === selectedMuscle)?.sample_size ?? 0}
                  onSaved={() => void loadData()}
                />
              )}
            </section>

            <section>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-[15px] font-black tracking-wide">MUSCLE RECOVERY</p>
                  <p className="text-[12px] text-cloud-dim">Estimates from your logged training · updated {lastDataRefresh.toLocaleTimeString()}</p>
                </div>
                <button onClick={() => void loadData()} aria-label="Refresh" className="rounded-full border border-cloud-dim/60 p-1 text-cloud-dim hover:text-white"><RefreshCw className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#183744] bg-[#0d1820] px-3 py-2">
                <div className="flex items-center gap-4">
                  <div><span className="block text-[10px] text-cloud-dim">MUSCLES TRACKED</span><span className="text-sm font-black text-cloud">{totalMusclesWithData}/19</span></div>
                  {avgRecovery != null && <div><span className="block text-[10px] text-cloud-dim">AVG RECOVERY</span><span className="text-sm font-black" style={{ color: recoveryColor(avgRecovery) }}>{avgRecovery}%</span></div>}
                  {lowest && <div><span className="block text-[10px] text-cloud-dim">LOWEST</span><span className="text-sm font-black" style={{ color: recoveryColor(lowest.value) }}>{MUSCLE_LABELS[lowest.item.muscle]}</span></div>}
                </div>
                <span className="text-[10px] text-cloud-dim">{totalMusclesWithData > 0 ? 'Live data' : 'No workouts yet'}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {DISPLAY_MUSCLES.map((item) => {
                  const s = stateByMuscle.get(item.muscle);
                  const v = getRecoveryValue(s);
                  const planned = state.nextWorkout?.muscles.includes(item.muscle);
                  return (
                    <button
                      key={item.muscle}
                      onClick={() => setSelectedMuscle(item.muscle)}
                      className={cn('flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all hover:border-[#76d8ed]', selectedMuscle === item.muscle ? 'border-[#76d8ed] bg-[#12303b] ring-1 ring-[#76d8ed]/30' : 'border-[#304454] bg-[#172431]')}
                    >
                      <span>
                        <span className="block text-xs font-black">{item.label}</span>
                        <span className="text-[11px] text-cloud-dim">{planned ? 'In your next workout' : s?.lastTrainedDate ? `Trained ${new Date(s.lastTrainedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Not trained recently'}</span>
                      </span>
                      <span className="text-right">
                        {v == null ? <span className="block text-sm font-black text-cloud-dim">No data</span> : <><span className="block text-sm font-black" style={{ color: recoveryColor(v) }}>{v}%</span><span className="text-[10px] text-cloud-dim">{getHoursLeft(s)}h left</span></>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-cloud-dim">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#ff5964]" />Recovering</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#ffd34f]" />Almost ready</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#5fe28c]" />Recovered</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[#8aa0b5]" />No data</span>
              </div>
              <RecoverySources claimIds={['recovery_estimate', 'failure_recovery']} className="mt-2" />
            </section>

            <ThisWeekCard state={state} onRated={() => void loadData()} />
            <SleepCard state={state} />
            <TonightCard sleepLastNight={sleepLastNight} trainedToday={trainedToday} />
            <section className="rounded-2xl border border-[#243442] bg-[#0d1820] p-4">
              <button type="button" aria-label="Open recovery check-in" aria-expanded={showDetails} onClick={() => setShowDetails((v) => !v)} className="flex w-full items-center justify-between text-left">
                <span>
                  <span className="block text-[14px] font-black">Body & fuel log</span>
                  <span className="text-[11px] text-cloud-dim">Water, protein, resting heart rate, HRV — protein and water come from your Nutrition diary</span>
                </span>
                <span className="text-xs font-bold text-[#8ad8f3]">{showDetails ? 'Close' : 'Open'}</span>
              </button>
              {showDetails && data && (
                <div className="mt-3">
                  <CheckInCard checkin={data.todayCheckin} weightKg={profile?.weight_kg ?? null} onSaved={() => { setShowDetails(false); void loadData(); }} onError={setError} />
                </div>
              )}
            </section>
            <Gate feature="recoveryDeload" label="Lighter-week detector">
              <DeloadCard state={state} onChanged={() => void loadData()} />
            </Gate>
            <Gate feature="recoveryWeeklyReport" label="Weekly recovery report">
              <WeeklyReportCard state={state} />
            </Gate>

            <PlannedVsDone routineMap={routineMap} stateByMuscle={stateByMuscle} />

            <section className="grid gap-3 sm:grid-cols-2" data-testid="pdf-buttons">
              <button onClick={() => downloadPdf('personal')} className="flex min-h-[84px] items-center justify-between rounded-xl border border-[#304454] bg-[#172431] px-4 text-left transition-colors hover:border-[#76d8ed]">
                <span><span className="block text-[14px] font-black">RECOVERY REPORT (PDF)</span><span className="text-[11px] text-cloud-dim">Your decision, trends, patterns and sources</span></span>
                <Download className="h-6 w-6 text-[#8ad8f3]" />
              </button>
              <button onClick={() => downloadPdf('clinician')} className="flex min-h-[84px] items-center justify-between rounded-xl border border-[#304454] bg-[#172431] px-4 text-left transition-colors hover:border-[#76d8ed]">
                <span><span className="block text-[14px] font-black">RECORD FOR YOUR CLINICIAN</span><span className="text-[11px] text-cloud-dim">Pain reports, return-to-training, load and check-ins</span></span>
                <FileText className="h-6 w-6 text-[#8ad8f3]" />
              </button>
            </section>
            {!hasRecovery('recoveryPdf') && <p className="-mt-3 text-[10px] text-cloud-dim">PDF reports are part of Pro+.</p>}
            {pdfError && <p className="text-xs text-rust">{pdfError}</p>}
          </>
        )}

        {tab === 'trends' && state && (
          <Gate feature="recoveryAnalytics" label="8-week recovery trends">
            <TrendsPanel state={state} />
          </Gate>
        )}

        {tab === 'you' && state && (
          <div className="space-y-4">
            <Gate feature="recoveryFingerprint" label="Your recovery fingerprint">
              <FingerprintCard state={state} />
            </Gate>
            <Gate feature="recoveryWhatWorks" label="What works for you">
              <WhatWorksCard state={state} />
            </Gate>
            <CycleCard state={state} onChanged={() => void loadData()} />
          </div>
        )}

        {tab === 'methods' && <MethodsPanel onLogged={() => void loadData()} />}

        {tab === 'injury' && state && data && <InjuryPanel state={state} painLogs={data.painLogs} onChanged={() => void loadData()} />}

        {tab === 'coach' && state && (
          <AiConsentGate>
            <RecoveryCoachChat getSnapshot={() => coachSnapshot(state, muscleStates)} onLink={onCoachLink} />
          </AiConsentGate>
        )}
      </main>

      {showCheckIn && state && <MorningCheckIn state={state} onClose={() => setShowCheckIn(false)} onSaved={() => { setShowCheckIn(false); void loadData(); }} />}
      <StripeUpgradeModal open={showUpgrade} currentTier={tier} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}

function PlannedVsDone({ routineMap, stateByMuscle }: { routineMap: ReturnType<typeof useLiveRoutineMap>; stateByMuscle: Map<RecoveryMuscle, MuscleRecoveryState> }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div><h2 className="text-[15px] font-black">PLANNED vs DONE</h2><p className="text-[12px] text-cloud-dim">Your assigned workout plans</p></div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${routineMap.liveConnected ? 'animate-pulse bg-[#4ee18d]' : 'bg-rust'}`} />
          <span className="text-[10px] text-cloud-dim">{routineMap.liveConnected ? 'Live' : 'Offline'}</span>
          <button onClick={() => void routineMap.refresh()} aria-label="Refresh plans" className="rounded-full border border-cloud-dim/60 p-1 text-cloud-dim hover:text-white"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {routineMap.error && <div className="mb-3 flex items-center gap-2 rounded-xl border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-rust"><AlertCircle className="h-4 w-4 shrink-0" /><span>{routineMap.error}</span></div>}
      {routineMap.loading && <div className="rounded-xl border border-[#304454] bg-[#172431] px-3 py-4 text-xs text-cloud-dim">Loading your training plan...</div>}
      {!routineMap.loading && routineMap.plans.length === 0 && !routineMap.error && <div className="rounded-xl border border-[#304454] bg-[#172431] px-3 py-4 text-xs text-cloud-dim">No assigned workout plans yet. Assign a plan from the Training tab to see planned vs done.</div>}
      {routineMap.plans.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(routineMap.comparison).sort(([, a], [, b]) => Number(b.needsAttention) - Number(a.needsAttention)).map(([muscle, entry]) => (
            <div key={muscle} className={`rounded-xl border px-3 py-2.5 ${entry.needsAttention ? 'border-rust/40 bg-rust/5' : 'border-[#304454] bg-[#172431]'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-cloud">{muscle}</span>
                {entry.needsAttention && <span className="rounded-full bg-rust/20 px-2 py-0.5 text-[9px] font-bold text-rust">NEEDS ATTENTION</span>}
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-cloud-dim">
                <span><b className="text-white">{entry.plannedSets.toFixed(0)}</b> planned sets</span>
                <span>{entry.daysSinceLastDone == null ? <span className="text-[#ffd34f]">Never trained</span> : <><b className="text-white">{entry.daysSinceLastDone}d</b> since last</>}</span>
              </div>
              {entry.recoveryMuscles.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {entry.recoveryMuscles.map((fine) => { const v = getRecoveryValue(stateByMuscle.get(fine)); return <span key={fine} className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ color: v == null ? '#8aa0b5' : recoveryColor(v), backgroundColor: (v == null ? '#8aa0b5' : recoveryColor(v)) + '15' }}>{MUSCLE_LABELS[fine]} {v == null ? '—' : `${v}%`}</span>; })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 flex items-center gap-1 text-[10px] text-cloud-dim"><Activity className="h-3 w-3" /> Planned sets come from your routine; recovery from your logged sessions.</p>
    </section>
  );
}

function getRecoveryValue(state: MuscleRecoveryState | undefined): number | null { return state?.recoveryPercent == null ? null : Math.round(state.recoveryPercent); }
function getHoursLeft(state: MuscleRecoveryState | undefined): number | null { if (!state || state.recoveryPercent == null || state.hoursSinceLastTrained == null) return null; return Math.max(0, Math.ceil(state.hoursNeeded - state.hoursSinceLastTrained)); }
function recoveryColor(value: number): string { return value < 50 ? '#ff5964' : value < 90 ? '#ffd34f' : '#5fe28c'; }
