import { useEffect, useState } from 'react';
import { ChevronRight, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchFullRecoveryData } from '@/lib/recovery/store';
import { buildDoctor, type DoctorState } from '@/lib/recovery/doctor/build';
import { fetchDoctorExtras, fetchNextWorkout } from '@/lib/recovery/doctor/api';
import type { DecisionLevel } from '@/lib/recovery/doctor/decision';

const STYLE: Record<DecisionLevel, string> = {
  go: 'border-lime/30 bg-lime/10 text-lime',
  adjust: 'border-gold/30 bg-gold/10 text-gold',
  easy: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
  stop: 'border-rust/40 bg-rust/10 text-rust',
  need_checkin: 'border-sky/30 bg-sky/10 text-sky',
};

/** Home-screen card: today's recovery decision (same engine as the Recovery Doctor). */
export function TodayDecisionCard({ bodyWeightKg, onOpen }: { bodyWeightKg: number | null; onOpen: () => void }) {
  const [state, setState] = useState<DoctorState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    Promise.all([fetchFullRecoveryData(now), fetchDoctorExtras(now).catch(() => null), fetchNextWorkout().catch(() => null)])
      .then(([full, extras, next]) => {
        if (cancelled) return;
        setState(buildDoctor({ full, extras: extras ?? { adjustments: [], rtt: [], cycleTracking: false, cycleStarts: [], modalityLogs: [] }, now, nextWorkout: next, bodyWeightKg }));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [bodyWeightKg]);

  if (failed) return null;
  if (!state) return <div className="h-[84px] animate-pulse rounded-2xl border border-ink-border bg-ink-surface" aria-label="Loading today's recovery decision" />;
  const d = state.decision;
  return (
    <button type="button" onClick={onOpen} className={cn('flex w-full items-center gap-3 rounded-2xl border p-4 text-left', STYLE[d.level])} data-testid="home-decision" data-level={d.level}>
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-black/20">
        <Stethoscope className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-cloud-dim">Recovery Doctor · today</span>
        <span className="block text-sm font-bold">{d.title}</span>
        <span className="block truncate text-[11px] text-cloud-dim">
          {state.activeDeload ? 'Lighter week active · ' : ''}
          {d.level === 'need_checkin' ? '5 quick questions to get your decision' : d.reasons[0]?.text ?? 'Everything looks in order.'}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-cloud-dim" />
    </button>
  );
}
