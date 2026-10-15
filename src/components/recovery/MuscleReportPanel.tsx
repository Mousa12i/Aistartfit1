import { X } from 'lucide-react';
import type { MuscleRecoveryState } from '@/lib/recovery/engine';
import { MUSCLE_LABELS, type RecoveryMuscle } from '@/lib/recovery/muscles';
import type { SorenessLog } from '@/lib/recovery/store';
import { cn } from '@/lib/utils';

// Small report shown on top of the 3D model when a muscle is tapped.
// Every figure comes from the recovery engine or the person's own logs; nothing is invented.

const STATUS_TEXT: Record<MuscleRecoveryState['status'], string> = {
  red: 'Needs rest',
  orange: 'Recovering',
  green: 'Recovered estimate',
  no_data: 'No data yet',
};

const BAND_TEXT: Record<MuscleRecoveryState['weeklySetBand'], string> = {
  low: 'Low',
  efficient: 'Efficient',
  productive: 'Productive',
  diminishing: 'Very high',
};

function color(pct: number | null): string {
  if (pct == null) return '#7f93a3';
  return pct < 50 ? '#ff5964' : pct < 90 ? '#ffd34f' : '#5fe28c';
}

function ago(iso: string | null): string {
  if (!iso) return 'Never logged';
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function latestSoreness(logs: SorenessLog[], muscle: RecoveryMuscle): SorenessLog | null {
  return logs
    .filter((l) => l.muscle === muscle)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0] ?? null;
}

export function MuscleReportPanel({
  muscle,
  state,
  soreness,
  plannedNext,
  nextWorkoutName,
  onClose,
}: {
  muscle: RecoveryMuscle;
  state: MuscleRecoveryState | undefined;
  soreness: SorenessLog | null;
  plannedNext: boolean;
  nextWorkoutName: string | null;
  onClose: () => void;
}) {
  const pct = state?.recoveryPercent == null ? null : Math.round(state.recoveryPercent);
  const hoursLeft =
    state && state.recoveryPercent != null && state.hoursSinceLastTrained != null
      ? Math.max(0, Math.ceil(state.hoursNeeded - state.hoursSinceLastTrained))
      : null;
  const c = color(pct);
  const sorenessScore = soreness?.soreness_score ?? null;
  const sorenessRecent = soreness ? Date.now() - new Date(soreness.recorded_at).getTime() < 72 * 3_600_000 : false;

  // StartFit rule: suggest a lighter session when a muscle planned for the next workout is under 50% or very sore.
  let action: string;
  if (!state || state.status === 'no_data') action = 'Log a workout that trains this muscle to start tracking it.';
  else if (plannedNext && (pct ?? 100) < 50) action = `In your next workout${nextWorkoutName ? ` (${nextWorkoutName})` : ''}: go lighter or swap to another muscle today.`;
  else if (sorenessRecent && (sorenessScore ?? 0) >= 7) action = 'High soreness logged: keep this muscle light until it eases.';
  else if (hoursLeft === 0) action = plannedNext ? 'Ready for your next workout.' : 'Ready to train.';
  else action = `About ${hoursLeft}h until the recovered estimate.`;

  return (
    <div
      className="absolute right-2 top-16 z-10 w-[min(15rem,calc(100%-1rem))] rounded-2xl border border-white/10 bg-[#0b141b]/90 p-3 text-left shadow-xl backdrop-blur-md"
      data-testid="muscle-report"
      role="dialog"
      aria-label={`${MUSCLE_LABELS[muscle]} report`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-black uppercase tracking-wide text-white">{MUSCLE_LABELS[muscle]}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-black tabular-nums" style={{ color: c }}>{pct == null ? '—' : `${pct}%`}</span>
          <button type="button" onClick={onClose} aria-label="Close report" className="rounded-md p-0.5 text-cloud-dim hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="text-[10px]" style={{ color: c }}>{state ? STATUS_TEXT[state.status] : STATUS_TEXT.no_data}{hoursLeft != null && hoursLeft > 0 ? ` · ${hoursLeft}h left` : ''}</p>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct ?? 0}%`, background: c }} />
      </div>

      <dl className="mt-2.5 space-y-1 text-[11px]">
        <Row label="Last trained" value={ago(state?.lastTrainedDate ?? null)} />
        <Row label="Sets this week" value={state && state.weeklyEffectiveSets > 0 ? `${state.weeklyEffectiveSets.toFixed(1)} · ${BAND_TEXT[state.weeklySetBand]}` : '0'} />
        <Row
          label="Last session"
          value={state && state.sessionEffectiveSets > 0 ? `${state.sessionEffectiveSets.toFixed(1)} sets${state.hasSessionVolumeWarning ? ' · heavy' : ''}` : '—'}
          warn={state?.hasSessionVolumeWarning}
        />
        <Row
          label="Soreness"
          value={sorenessScore == null ? 'Not logged' : `${sorenessScore}/10 · ${ago(soreness!.recorded_at)}`}
          warn={sorenessRecent && (sorenessScore ?? 0) >= 6}
        />
        {state && state.modifiers.sleepMultiplier > 1.01 && <Row label="Short sleep" value={`+${Math.round((state.modifiers.sleepMultiplier - 1) * 100)}% time`} warn />}
        {plannedNext && <Row label="Next workout" value="Trains this muscle" />}
      </dl>

      <div className="mt-2.5 border-t border-white/10 pt-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cloud-dim">Action</p>
        <p className="mt-0.5 text-[11px] leading-snug text-cloud">{action}</p>
      </div>
      <p className="mt-1.5 text-[9px] text-cloud-dim/70">Estimate from your logs, not a measurement.</p>
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-cloud-dim">{label}</dt>
      <dd className={cn('text-right font-semibold', warn ? 'text-[#ff8a92]' : 'text-cloud')}>{value}</dd>
    </div>
  );
}

export function SorenessLogger({ muscle, current, onLog }: { muscle: RecoveryMuscle; current: number | null; onLog: (score: number) => void }) {
  return (
    <div className="rounded-xl border border-[#183744] bg-[#0d1820] p-3" data-testid="soreness-logger">
      <p className="text-[11px] font-bold uppercase tracking-wider text-cloud-dim">How sore is your {MUSCLE_LABELS[muscle].toLowerCase()}? (0–10)</p>
      <div className="mt-2 grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, v) => (
          <button
            key={v}
            type="button"
            onClick={() => onLog(v)}
            aria-label={`Soreness ${v}`}
            className={cn(
              'rounded-md py-1.5 text-[11px] font-bold tabular-nums',
              current === v ? (v >= 4 ? 'bg-rust text-white' : 'bg-lime text-ink-bg') : 'bg-ink-elevated text-cloud-dim',
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
