import { useState } from 'react';
import { Fingerprint as FingerprintIcon, FlaskConical, Lock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DoctorState } from '@/lib/recovery/doctor/build';
import { fingerprintLines } from '@/lib/recovery/doctor/insights';
import { addPeriodStart, deleteCycleData, setCycleTracking } from '@/lib/recovery/doctor/api';
import { Panel, RecoverySources, Stat } from './ui';
import { shortDate } from './charts';

export function FingerprintCard({ state }: { state: DoctorState }) {
  const f = state.fingerprint;
  const lines = fingerprintLines(f);
  return (
    <Panel title="Your recovery fingerprint" subtitle="Learned from your own check-ins, sleep, sessions and recovery history" right={<FingerprintIcon className="h-5 w-5 text-[#8ad8f3]" />} testId="fingerprint">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Usual check-in" value={f.wellness ? `${f.wellness.mean}/25` : '—'} sub={f.wellness ? `±${f.wellness.sd}` : 'needs 7 days'} />
        <Stat label="Usual sleep" value={f.sleep.average != null ? `${f.sleep.average} h` : '—'} sub={f.sleep.spread != null ? `±${f.sleep.spread} h` : undefined} />
        <Stat label="Typical week" value={f.typicalWeeklyLoad ?? '—'} sub={f.sessionsPerWeek != null ? `${f.sessionsPerWeek} sessions/wk` : undefined} />
        <Stat label="Session feel" value={f.avgSessionRpe != null ? `${f.avgSessionRpe}/10` : '—'} sub="avg RPE" />
      </div>
      {lines.length > 0 && (
        <ul className="mt-3 space-y-1">
          {lines.map((l) => (
            <li key={l} className="text-xs text-white">• {l}</li>
          ))}
        </ul>
      )}
      {f.missing.length > 0 && <p className="mt-3 rounded-lg bg-black/20 px-3 py-2 text-[11px] text-cloud-dim">Still learning — needs {f.missing.join(', ')}.</p>}
      <RecoverySources claimIds={['wellness_scale', 'recovery_estimate', 'srpe_valid']} className="mt-3" />
    </Panel>
  );
}

export function WhatWorksCard({ state }: { state: DoctorState }) {
  const items = state.whatWorks;
  const ready = items.filter((c) => c.result !== 'not_enough_data');
  return (
    <Panel title="What works for you" subtitle="Comparisons of your own days. Observations, not proof of cause." right={<FlaskConical className="h-5 w-5 text-[#5fe28c]" />} testId="what-works">
      {ready.length === 0 && <p className="mb-3 text-xs text-cloud-dim">Keep doing the morning check-in and rating sessions — each comparison appears once both sides have 5 days.</p>}
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className={cn('rounded-xl border px-3 py-2.5', c.result === 'pattern' ? 'border-[#5fe28c]/30 bg-[#5fe28c]/5' : 'border-[#243442] bg-[#172431]')}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-white">{c.title}</p>
              <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black uppercase', c.result === 'pattern' ? 'bg-[#5fe28c]/20 text-[#5fe28c]' : c.result === 'no_clear_difference' ? 'bg-white/10 text-cloud' : 'bg-white/5 text-cloud-dim')}>
                {c.result === 'pattern' ? 'Pattern' : c.result === 'no_clear_difference' ? 'No clear difference' : `${c.nA}/${5} · ${c.nB}/${5}`}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-cloud-dim">{c.outcome}: {c.labelA} vs {c.labelB}</p>
            <p className="mt-1 text-xs text-cloud">{c.summary}</p>
          </li>
        ))}
      </ul>
      <RecoverySources claimIds={['nof1_rule', ...(items.some((c) => c.id === 'cycle') ? ['cycle_trivial'] : [])]} className="mt-3" />
    </Panel>
  );
}

export function CycleCard({ state, onChanged }: { state: DoctorState; onChanged: () => void }) {
  const [date, setDate] = useState(state.today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };
  const c = state.cycle;
  return (
    <Panel title="Cycle insights (optional)" subtitle="Private to you. Off unless you switch it on; only period start dates are stored." right={<Lock className="h-4 w-4 text-cloud-dim" />} testId="cycle-card">
      {!c ? (
        <button type="button" disabled={busy} onClick={() => void run(() => setCycleTracking(true))} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-cloud">
          Switch on cycle insights
        </button>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Cycle day" value={c.cycleDay ?? '—'} sub={c.onPeriodDays ? 'period days' : undefined} />
            <Stat label="Typical length" value={c.typicalLength ? `${c.typicalLength} d` : '—'} sub={c.typicalLength ? undefined : 'needs 2 starts'} />
            <Stat label="Next start (est.)" value={c.nextStartEstimate ? shortDate(c.nextStartEstimate) : '—'} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input type="date" value={date} max={state.today} onChange={(e) => setDate(e.target.value)} className="rounded-lg bg-[#172431] px-2.5 py-1.5 text-xs text-white" />
            <button type="button" disabled={busy || !date} onClick={() => void run(() => addPeriodStart(date))} className="rounded-lg bg-[#8ad8f3] px-3 py-1.5 text-[11px] font-black text-[#071018]">
              Log period start
            </button>
            <button type="button" disabled={busy} onClick={() => void run(deleteCycleData)} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-[#ff5964]">
              <Trash2 className="h-3.5 w-3.5" /> Delete all cycle data
            </button>
          </div>
          <p className="mt-3 rounded-lg bg-black/20 px-3 py-2 text-[11px] text-cloud">
            Research finds only trivial average differences in performance across the cycle, so StartFit does not change your plan by phase. Instead, "What works for you" (Pro+) compares your own check-ins on period days and other days.
          </p>
        </>
      )}
      {error && <p className="mt-2 text-xs text-[#ff5964]">{error}</p>}
      <RecoverySources claimIds={['cycle_trivial']} className="mt-3" />
    </Panel>
  );
}
