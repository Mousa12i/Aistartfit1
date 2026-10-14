import { useState } from 'react';
import { OctagonAlert, CheckCircle2, Moon, CirclePause, SlidersHorizontal, Sun, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MUSCLE_LABELS } from '@/lib/recovery/muscles';
import type { DoctorState } from '@/lib/recovery/doctor/build';
import type { DecisionLevel } from '@/lib/recovery/doctor/decision';
import { WELLNESS_ITEMS, WELLNESS_LABELS, type WellnessItem } from '@/lib/recovery/doctor/wellness';
import { saveWellness, acceptDeload, setAdjustmentStatus } from '@/lib/recovery/doctor/api';
import { deloadWindow } from '@/lib/recovery/doctor/build';
import { SessionRpeCard } from '@/components/recovery/SessionRpeCard';
import { Panel, RecoverySources, Stat } from './ui';
import { shortDate } from './charts';

const LEVEL_STYLE: Record<DecisionLevel, { box: string; text: string; icon: JSX.Element }> = {
  go: { box: 'border-[#5fe28c]/40 bg-[#5fe28c]/10', text: 'text-[#5fe28c]', icon: <CheckCircle2 className="h-6 w-6" /> },
  adjust: { box: 'border-[#ffd34f]/40 bg-[#ffd34f]/10', text: 'text-[#ffd34f]', icon: <SlidersHorizontal className="h-6 w-6" /> },
  easy: { box: 'border-[#ff9f43]/40 bg-[#ff9f43]/10', text: 'text-[#ff9f43]', icon: <CirclePause className="h-6 w-6" /> },
  stop: { box: 'border-[#ff5964]/50 bg-[#ff5964]/10', text: 'text-[#ff5964]', icon: <OctagonAlert className="h-6 w-6" /> },
  need_checkin: { box: 'border-[#76d8ed]/40 bg-[#76d8ed]/10', text: 'text-[#8ad8f3]', icon: <Sun className="h-6 w-6" /> },
};

export function DecisionCard({ state, onCheckIn, onTriage }: { state: DoctorState; onCheckIn: () => void; onTriage: () => void }) {
  const d = state.decision;
  const s = LEVEL_STYLE[d.level];
  return (
    <section className={cn('rounded-2xl border p-4', s.box)} data-testid="today-decision" data-level={d.level}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5', s.text)}>{s.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cloud-dim">Today's decision</p>
          <h2 className={cn('text-xl font-black', s.text)}>{d.title}</h2>
          {state.nextWorkout && <p className="mt-0.5 text-[11px] text-cloud-dim">Next workout: {state.nextWorkout.planName} · {state.nextWorkout.dayLabel}</p>}
        </div>
      </div>
      {d.reasons.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {d.reasons.map((r, i) => (
            <li key={i} className="rounded-lg bg-black/20 px-3 py-2 text-xs leading-relaxed text-cloud">{r.text}</li>
          ))}
        </ul>
      )}
      {d.actions.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-cloud-dim">What to do</p>
          <ul className="space-y-1">
            {d.actions.map((a, i) => (
              <li key={i} className="text-xs leading-relaxed text-white">• {a}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {d.level === 'need_checkin' && (
          <button type="button" onClick={onCheckIn} className="rounded-lg bg-[#8ad8f3] px-3 py-2 text-xs font-black text-[#071018]" data-testid="open-checkin">
            Start check-in (30 s)
          </button>
        )}
        {d.level === 'stop' && (
          <button type="button" onClick={onTriage} className="rounded-lg bg-[#ff5964] px-3 py-2 text-xs font-black text-white">
            Open triage
          </button>
        )}
        {d.level !== 'need_checkin' && (
          <button type="button" onClick={onCheckIn} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-cloud">
            Edit check-in
          </button>
        )}
      </div>
      <RecoverySources claimIds={d.claimIds} className="mt-3" />
    </section>
  );
}

export function MorningCheckIn({ state, onClose, onSaved }: { state: DoctorState; onClose: () => void; onSaved: () => void }) {
  const todayEntry = state.wellnessEntries.find((e) => e.date === state.today);
  const [answers, setAnswers] = useState<Partial<Record<WellnessItem, number>>>(() => {
    const out: Partial<Record<WellnessItem, number>> = {};
    for (const k of WELLNESS_ITEMS) if (todayEntry?.[k] != null) out[k] = todayEntry[k]!;
    return out;
  });
  const [sleepHours, setSleepHours] = useState(todayEntry?.sleepHours != null ? String(todayEntry.sleepHours) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = WELLNESS_ITEMS.every((k) => answers[k] != null);
  const hours = sleepHours.trim() === '' ? null : Number(sleepHours);
  const hoursValid = hours == null || (Number.isFinite(hours) && hours >= 0 && hours <= 16);

  const save = async () => {
    if (!complete || !hoursValid) return;
    setSaving(true);
    setError(null);
    try {
      await saveWellness(answers as Record<WellnessItem, number>, hours);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the check-in.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Morning check-in">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#243442] bg-[#0d1820] p-5 sm:rounded-3xl" data-testid="checkin-sheet">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8ad8f3]">Morning check-in</p>
            <h2 className="text-lg font-black text-white">How are you this morning?</h2>
            <p className="text-[11px] text-cloud-dim">5 quick questions. Compared with your own usual, not with other people.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-black/30 p-2 text-cloud-dim">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          {WELLNESS_ITEMS.map((k) => (
            <div key={k}>
              <p className="mb-1.5 text-xs font-bold text-cloud">{WELLNESS_LABELS[k].title}</p>
              <div className="grid grid-cols-5 gap-1.5">
                {WELLNESS_LABELS[k].answers.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [k]: i + 1 }))}
                    aria-pressed={answers[k] === i + 1}
                    data-testid={`w-${k}-${i + 1}`}
                    className={cn(
                      'min-h-[44px] rounded-lg px-1 py-1.5 text-[10px] font-bold leading-tight transition-colors',
                      answers[k] === i + 1 ? 'bg-[#8ad8f3] text-[#071018]' : 'bg-[#172431] text-cloud-dim hover:text-cloud',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-cloud">
              <Moon className="h-3.5 w-3.5 text-[#8ad8f3]" /> Hours slept last night <span className="font-normal text-cloud-dim">(optional)</span>
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.25"
              min={0}
              max={16}
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="e.g. 7.5"
              data-testid="w-sleep-hours"
              className="w-full rounded-lg border border-transparent bg-[#172431] px-3 py-2.5 text-sm text-white placeholder:text-cloud-dim/50 focus:border-[#8ad8f3]/40 focus:outline-none"
            />
            {!hoursValid && <span className="mt-1 block text-[11px] text-[#ff5964]">Enter hours between 0 and 16.</span>}
          </label>
        </div>
        {error && <p className="mt-3 text-xs text-[#ff5964]">{error}</p>}
        <button
          type="button"
          disabled={!complete || !hoursValid || saving}
          onClick={() => void save()}
          data-testid="save-checkin"
          className="mt-4 w-full rounded-xl bg-[#8ad8f3] py-3 text-sm font-black text-[#071018] disabled:opacity-40"
        >
          {saving ? 'Saving…' : complete ? 'Save and see today’s decision' : `Answer all 5 (${Object.keys(answers).length}/5)`}
        </button>
        <RecoverySources claimIds={['wellness_subjective', 'wellness_hooper', 'wellness_scale']} className="mt-3" />
      </div>
    </div>
  );
}

export function ThisWeekCard({ state, onRated }: { state: DoctorState; onRated: () => void }) {
  const w = state.thisWeek;
  return (
    <Panel title="This week's training load" subtitle={`${shortDate(w.start)} – ${shortDate(w.end)} · session RPE × minutes`} testId="week-load">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Sessions" value={w.sessions} sub={`${w.minutes} min`} />
        <Stat label="Load" value={w.ratedSessions ? w.load : '—'} sub={w.ratedSessions < w.sessions ? `${w.sessions - w.ratedSessions} not rated` : 'all rated'} />
        <Stat label="Monotony" value={w.monotony ?? '—'} sub={w.monotony == null ? 'needs 2 rated' : state.monotonyHigh ? 'above 2.0' : 'varied'} tone={state.monotonyHigh ? 'warn' : undefined} />
        <Stat label="vs usual" value={state.change.percent == null ? '—' : `${state.change.percent > 0 ? '+' : ''}${state.change.percent}%`} sub={state.change.percent == null ? 'needs 2 earlier weeks' : `avg ${state.change.previousAverage}`} />
      </div>
      {state.unratedRecent.length > 0 && (
        <div className="mt-3 space-y-2">
          {state.unratedRecent.map((s) => {
            const sess = state.sessions.find((x) => x.id === s.id);
            return <SessionRpeCard key={s.id} sessionId={s.id} minutes={sess?.minutes ?? 0} compact title={`Rate ${s.name} (${shortDate(s.date)})`} onSaved={onRated} />;
          })}
        </div>
      )}
      <RecoverySources claimIds={['srpe_valid', 'monotony_strain', 'monotony_rule', 'acwr_caution']} className="mt-3" />
    </Panel>
  );
}

export function SleepCard({ state }: { state: DoctorState }) {
  const s = state.sleep;
  return (
    <Panel title="Sleep" subtitle="Last 7 logged nights" testId="sleep-card">
      {s.nights === 0 ? (
        <p className="text-xs text-cloud-dim">Add your hours in the morning check-in to see your sleep.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Last night" value={s.lastNight == null ? '—' : `${s.lastNight} h`} tone={s.lastNight == null ? undefined : s.lastNight >= 7 ? 'good' : 'warn'} />
          <Stat label="Average" value={s.average == null ? '—' : `${s.average} h`} sub={`${s.nights} nights`} />
          <Stat label="Under 7 h" value={s.nightsUnder7} tone={s.nightsUnder7 >= 3 ? 'warn' : undefined} />
          <Stat label="Sleep debt" value={`${s.debt} h`} sub={s.irregular ? `irregular (±${s.spread} h)` : s.spread != null ? `±${s.spread} h` : undefined} tone={s.debt >= 5 ? 'warn' : undefined} />
        </div>
      )}
      {s.lastNight != null && s.lastNight < 7 && (
        <p className="mt-3 rounded-lg bg-black/20 px-3 py-2 text-xs text-cloud">Short night: if you can, train in the morning rather than late, and don't chase personal records today.</p>
      )}
      <RecoverySources claimIds={['sleep_7h', 'sleep_loss_perf', 'sleep_strength', 'sleep_debt_rule']} className="mt-3" />
    </Panel>
  );
}

export function DeloadCard({ state, onChanged }: { state: DoctorState; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = state.activeDeload;
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
  return (
    <Panel title="Lighter-week detector" subtitle="Watches performance, check-ins, monotony and time since your last lighter week" testId="deload-card">
      {a ? (
        <div className="rounded-xl border border-[#8ad8f3]/30 bg-[#8ad8f3]/10 p-3">
          <p className="text-sm font-black text-[#8ad8f3]">Lighter week active: {shortDate(a.starts_on)} – {shortDate(a.ends_on)}</p>
          <p className="mt-1 text-xs text-cloud">About half your usual sets, the same exercises, 3–4 reps in reserve. Today's decision and your Home screen remind you.</p>
          <button type="button" disabled={busy} onClick={() => void run(() => setAdjustmentStatus(a.id, 'completed'))} className="mt-2 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-bold text-cloud">
            End lighter week now
          </button>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {state.deload.signals.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-xs">
                <span className={cn('mt-1 h-2 w-2 flex-shrink-0 rounded-full', s.met ? 'bg-[#ffd34f]' : 'bg-[#304454]')} />
                <span className={s.met ? 'text-white' : 'text-cloud-dim'}>{s.text}</span>
              </li>
            ))}
          </ul>
          {state.deload.suggest ? (
            <div className="mt-3 rounded-xl border border-[#ffd34f]/30 bg-[#ffd34f]/10 p-3" data-testid="deload-suggest">
              <p className="text-sm font-black text-[#ffd34f]">{state.deload.metCount} signs point to a lighter week</p>
              <p className="mt-1 text-xs text-cloud">For the next 7 days: about half your usual sets, same exercises, 3–4 reps in reserve.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => void run(() => acceptDeload(deloadWindow(state.today), state.deload.signals.filter((s) => s.met).map((s) => s.text)))} className="rounded-lg bg-[#ffd34f] px-3 py-1.5 text-[11px] font-black text-[#071018]" data-testid="accept-deload">
                  Start lighter week
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-cloud-dim">No lighter week needed now ({state.deload.metCount} of 2 signs).</p>
          )}
        </>
      )}
      {error && <p className="mt-2 text-xs text-[#ff5964]">{error}</p>}
      <RecoverySources claimIds={state.deload.claimIds} className="mt-3" />
    </Panel>
  );
}

export function WeeklyReportCard({ state }: { state: DoctorState }) {
  const r = state.weekly;
  return (
    <Panel title="Weekly report" subtitle={`${shortDate(r.start)} – ${shortDate(r.end)}`} testId="weekly-report" right={<Sparkles className="h-4 w-4 text-[#8ad8f3]" />}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Sessions" value={r.sessions} sub={`${r.minutes} min`} />
        <Stat label="Load / strain" value={r.ratedSessions ? r.load : '—'} sub={r.strain != null ? `strain ${r.strain}` : undefined} />
        <Stat label="Check-in avg" value={r.wellnessAverage ?? '—'} sub={r.wellnessUsual != null ? `usual ${r.wellnessUsual}` : `${r.checkins}/7 days`} />
        <Stat label="Sleep avg" value={r.sleepAverage == null ? '—' : `${r.sleepAverage} h`} sub={r.nightsUnder7 ? `${r.nightsUnder7} short nights` : undefined} />
      </div>
      {r.bestLifts.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-cloud-dim">Best lifts this week (estimated 1RM)</p>
          <ul className="space-y-1">
            {r.bestLifts.map((l) => (
              <li key={l.name} className="flex justify-between text-xs">
                <span className="text-cloud">{l.name}</span>
                <span className="text-white">
                  {l.e1rm} kg {l.changePercent != null && <span className={l.changePercent >= 0 ? 'text-[#5fe28c]' : 'text-[#ff5964]'}>({l.changePercent > 0 ? '+' : ''}{l.changePercent}%)</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3">
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-cloud-dim">Focus for next week</p>
        <ul className="space-y-1">
          {r.focus.map((f) => (
            <li key={f} className="text-xs text-white">• {f}</li>
          ))}
        </ul>
      </div>
      <RecoverySources claimIds={r.claimIds} className="mt-3" />
    </Panel>
  );
}

export function NotReadyChips({ state }: { state: DoctorState }) {
  if (!state.decision.notReady.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {state.decision.notReady.map((m) => (
        <span key={m} className="rounded-md bg-[#ff5964]/15 px-2 py-0.5 text-[10px] font-bold text-[#ff5964]">{MUSCLE_LABELS[m]}</span>
      ))}
    </div>
  );
}
