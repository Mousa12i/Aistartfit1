import { useMemo, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { estimateMinutes, fitSessionToTime, parseRepsText, type FitItem, type FitResult } from '@/lib/training/time-fit';
import { exerciseGroupContributions } from '@/lib/training/routine';
import type { MovementPattern } from '@/lib/training/taxonomy';
import type { WorkoutPlanExercise } from '@/lib/types';
import { ClaimSources } from './coach/PlanView';

export function rowsToFitItems(rows: WorkoutPlanExercise[], startedIdx: Set<number>): FitItem[] {
  return rows.map((r, i) => {
    const reps = parseRepsText(r.reps);
    return {
      key: r.id,
      exerciseId: r.exercise_id,
      name: r.exercise?.name ?? 'Exercise',
      pattern: (r.exercise?.pattern as MovementPattern | null | undefined) ?? null,
      groups: exerciseGroupContributions(r.exercise),
      sets: r.sets,
      ...reps,
      unilateral: !!r.exercise?.is_unilateral,
      restSeconds: r.rest_seconds,
      locked: startedIdx.has(i),
    };
  });
}

export interface PairInfo {
  label: string;
  partnerId: string;
  partnerName: string;
}

/** Apply a fit result to the workout rows: new order, fewer sets, supersets (short rest inside a pair). */
export function applyFit(rows: WorkoutPlanExercise[], result: FitResult): { rows: WorkoutPlanExercise[]; pairs: Record<string, PairInfo> } {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const pairs: Record<string, PairInfo> = {};
  const out: WorkoutPlanExercise[] = [];
  for (const it of result.items) {
    const r = byId.get(it.key);
    if (!r) continue;
    const partner = it.pairKey ? result.items.find((x) => x.key === it.pairKey) : undefined;
    const first = !!it.pairLabel?.endsWith('1');
    out.push({ ...r, sets: it.sets, rest_seconds: partner && first ? 15 : partner ? Math.max(it.restSeconds, partner.restSeconds) : r.rest_seconds });
    if (partner && it.pairLabel) pairs[r.id] = { label: it.pairLabel, partnerId: partner.key, partnerName: partner.name };
  }
  return { rows: out, pairs };
}

const OPTIONS = [15, 20, 30, 45];

export function TimeFitSheet({ rows, startedIdx, onClose, onApply }: { rows: WorkoutPlanExercise[]; startedIdx: Set<number>; onClose: () => void; onApply: (result: FitResult) => void }) {
  const items = useMemo(() => rowsToFitItems(rows, startedIdx), [rows, startedIdx]);
  const now = useMemo(() => Math.round(estimateMinutes(items)), [items]);
  const choices = OPTIONS.filter((m) => m < now);
  const [target, setTarget] = useState<number>(choices.includes(30) ? 30 : choices[choices.length - 1] ?? 30);
  const result = useMemo(() => fitSessionToTime(items, target), [items, target]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Short on time">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-ink-border bg-ink-surface p-5 sm:rounded-3xl" data-testid="time-fit">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-lime"><Clock className="h-3.5 w-3.5" /> Short on time</p>
            <h2 className="text-lg font-bold text-cloud">How long do you have?</h2>
            <p className="text-[11px] text-cloud-dim">Today's session is about {now} minutes. A shorter session still counts.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-ink-elevated p-2 text-cloud-dim">
            <X className="h-4 w-4" />
          </button>
        </div>

        {choices.length === 0 ? (
          <p className="rounded-xl bg-ink-elevated p-3 text-xs text-cloud">This session already fits in about {now} minutes.</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-4 gap-2">
              {choices.map((m) => (
                <button key={m} type="button" onClick={() => setTarget(m)} aria-pressed={target === m} data-testid={`fit-${m}`} className={cn('rounded-xl py-2.5 text-sm font-bold', target === m ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud')}>
                  {m} min
                </button>
              ))}
            </div>

            <div className="mb-3 rounded-xl border border-lime/25 bg-lime/5 p-3">
              <p className="text-sm font-semibold text-cloud">About {Math.round(result.minutesAfter)} minutes {result.fits ? '' : '(as short as it can go)'}</p>
              <ul className="mt-1.5 space-y-1">
                {result.steps.map((s) => (
                  <li key={s} className="text-[11px] text-cloud-dim">• {s}</li>
                ))}
              </ul>
            </div>

            <p className="mb-1.5 text-xs font-semibold text-cloud">Today's session</p>
            <ul className="mb-3 space-y-1" data-testid="fit-list">
              {result.items.map((it) => (
                <li key={it.key} className="flex items-center gap-2 rounded-lg bg-ink-elevated/60 px-2.5 py-1.5 text-[11px]">
                  <span className={cn('w-7 flex-shrink-0 text-center font-bold', it.pairLabel ? 'text-sky' : 'text-cloud-dim')}>{it.pairLabel ?? '•'}</span>
                  <span className="min-w-0 flex-1 truncate text-cloud">{it.name}</span>
                  <span className="text-cloud-dim">{it.sets} sets</span>
                </li>
              ))}
            </ul>

            {result.lostSets.length > 0 && (
              <p className="mb-3 rounded-lg bg-gold/5 px-3 py-2 text-[11px] text-cloud">
                Not trained as much today: {result.lostSets.map((l) => `${l.label} −${l.sets}`).join(', ')} sets. Weekly sets matter more than any one session, so add a set or two to these in your next sessions if you can.
              </p>
            )}
            <ClaimSources claimIds={result.claimIds} className="mb-4" />

            <button type="button" onClick={() => onApply(result)} data-testid="apply-fit" className="w-full rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg">
              Fit it in {target} minutes
            </button>
          </>
        )}
      </div>
    </div>
  );
}
