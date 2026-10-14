import { useState } from 'react';
import { ArrowLeftRight, ChevronDown, ChevronUp, Clock, Dumbbell, HeartPulse, Info, Play, ShieldAlert, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notice, Section } from '@/screens/nutrition/ui';
import { CLAIMS, TRAINING_REFERENCES } from '@/lib/training/evidence';
import { WEEKDAY_NAMES } from '@/lib/training/engine-config';
import { PLAN_GOAL_LABELS, type PlannedExercise, type TrainingPlan } from '@/lib/training/plan-types';
import type { PlanAction } from '@/lib/training/plan-actions';

export function ClaimSources({ claimIds, className }: { claimIds: string[]; className?: string }) {
  const refs = [...new Set(claimIds.flatMap((id) => CLAIMS[id]?.refs ?? []))].map((r) => TRAINING_REFERENCES[r]).filter(Boolean);
  const design = claimIds.some((id) => CLAIMS[id]?.kind === 'design');
  if (!refs.length && !design) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {refs.map((r) => (
        <a key={r.id} href={r.url} target="_blank" rel="noreferrer" title={r.citation} className="rounded-md bg-ink-elevated px-2 py-0.5 text-[10px] text-cloud-dim transition-colors hover:text-lime">
          {r.short}
        </a>
      ))}
      {design && <span className="rounded-md bg-ink-elevated px-2 py-0.5 text-[10px] text-gold">StartFit rule</span>}
    </div>
  );
}

const LEVEL_LABELS = { new: 'New', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

export function PlanView({
  plan,
  onAction,
  onStartDay,
  onOpenExercise,
}: {
  plan: TrainingPlan;
  onAction: (a: PlanAction) => string | null;
  /** Present once the plan is saved as a routine. */
  onStartDay?: (dayIndex: number) => void;
  onOpenExercise: (exerciseId: string) => void;
}) {
  const [openDay, setOpenDay] = useState<number | null>(0);
  const [showWhy, setShowWhy] = useState(false);
  const safety = plan.notes.filter((n) => n.kind === 'safety');
  const other = plan.notes.filter((n) => n.kind !== 'safety');

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-lime/25 bg-gradient-to-br from-lime/10 to-transparent p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-lime">{PLAN_GOAL_LABELS[plan.effectiveGoal]} · {LEVEL_LABELS[plan.level]}</p>
        <h2 className="mt-0.5 text-lg font-bold text-cloud">{plan.title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-cloud-dim">{plan.summary}</p>
      </div>

      {safety.length > 0 && (
        <div className="mb-4 space-y-2">
          {safety.map((n, i) => (
            <Notice key={i} tone="warn">{n.text}</Notice>
          ))}
        </div>
      )}
      {other.length > 0 && (
        <div className="mb-4 space-y-2">
          {other.map((n, i) => (
            <Notice key={i} tone="info">{n.text}</Notice>
          ))}
        </div>
      )}

      <Section title="Your week">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_NAMES.map((d, i) => {
            const s = plan.days.find((x) => x.weekday === i);
            const c = plan.cardio.filter((x) => x.weekday === i);
            return (
              <div key={d} className={cn('rounded-xl border px-1 py-2 text-center', s ? 'border-lime/40 bg-lime/10' : c.length ? 'border-sky/30 bg-sky/5' : 'border-ink-border bg-ink-surface')}>
                <p className="text-[10px] font-semibold text-cloud-dim">{d}</p>
                <p className="mt-1 text-[9px] leading-tight text-cloud">{s ? s.label.replace(/^Day \d+ · /, '') : c.length ? 'Cardio' : 'Rest'}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Sessions">
        <div className="space-y-2.5">
          {plan.days.map((day) => {
            const open = openDay === day.index;
            return (
              <div key={day.index} className="overflow-hidden rounded-2xl border border-ink-border bg-ink-surface">
                <button type="button" onClick={() => setOpenDay(open ? null : day.index)} className="flex w-full items-center gap-3 p-3.5 text-left">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-lime/10 text-lime">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-cloud">{day.label}</p>
                    <p className="text-[11px] text-cloud-dim">
                      {WEEKDAY_NAMES[day.weekday]} · {day.exercises.length} exercises · <Clock className="inline h-3 w-3" /> ~{day.estimatedMinutes} min
                    </p>
                  </div>
                  {open ? <ChevronUp className="h-4 w-4 text-cloud-dim" /> : <ChevronDown className="h-4 w-4 text-cloud-dim" />}
                </button>
                {open && (
                  <div className="border-t border-ink-border/60 px-3.5 pb-3.5 pt-2">
                    <p className="mb-2 text-[11px] text-cloud-dim">{day.warmup}</p>
                    <div className="space-y-2">
                      {day.exercises.map((e) => (
                        <ExerciseRow key={e.exerciseId} e={e} dayIndex={day.index} onAction={onAction} onOpen={() => onOpenExercise(e.exerciseId)} />
                      ))}
                    </div>
                    {onStartDay && (
                      <button
                        type="button"
                        onClick={() => onStartDay(day.index)}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-2.5 text-sm font-bold text-ink-bg"
                      >
                        <Play className="h-4 w-4" fill="currentColor" /> Start this session
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {plan.cardio.length > 0 && (
        <Section title="Cardio">
          <div className="space-y-2">
            {plan.cardio.map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-ink-border bg-ink-surface p-3">
                <HeartPulse className="h-5 w-5 flex-shrink-0 text-sky" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-cloud">{WEEKDAY_NAMES[c.weekday]} · {c.label}</p>
                  <p className="text-[11px] text-cloud-dim">{c.minutes} min · {c.intensity} · {c.note}</p>
                </div>
              </div>
            ))}
          </div>
          {plan.cardioRamp.length > 0 && plan.cardioRamp[0] < plan.cardioTargetMinutes && (
            <p className="mt-2 text-[11px] text-cloud-dim">Weekly minutes, weeks 1–{plan.cardioRamp.length}: {plan.cardioRamp.join(' → ')}</p>
          )}
          <ClaimSources claimIds={['who_activity']} className="mt-2" />
        </Section>
      )}

      <Section title="Weekly sets per muscle group">
        <p className="mb-2 text-[11px] text-cloud-dim">1 set for the main muscle, ½ for helpers. The bar shows the target range.</p>
        <div className="space-y-2">
          {plan.volume.filter((v) => v.high > 0).map((v) => {
            const max = Math.max(v.high + 4, v.sets + 2);
            return (
              <div key={v.group}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-cloud">{v.label}{v.priority ? ' ★' : ''}</span>
                  <span className={cn('font-semibold tabular-nums', v.status === 'in_range' ? 'text-lime' : v.status === 'low' ? 'text-gold' : 'text-sky')}>
                    {v.sets} <span className="font-normal text-cloud-dim">/ {v.low}–{v.high}</span>
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-ink-elevated">
                  <div className="absolute h-2 rounded-full bg-lime/20" style={{ left: `${(v.low / max) * 100}%`, width: `${((v.high - v.low) / max) * 100}%` }} />
                  <div className="absolute top-[-2px] h-3 w-1 rounded bg-lime" style={{ left: `calc(${Math.min(100, (v.sets / max) * 100)}% - 2px)` }} />
                </div>
              </div>
            );
          })}
        </div>
        <ClaimSources claimIds={['vol_fractional', 'vol_dose', 'vol_targets_design']} className="mt-3" />
      </Section>

      <Section title="How to progress">
        <ul className="space-y-1.5">
          {plan.progressionRules.map((r, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-cloud-dim">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-lime" />
              {r}
            </li>
          ))}
        </ul>
        <div className="mt-3 overflow-hidden rounded-xl border border-ink-border">
          {plan.progression.map((w) => (
            <div key={w.week} className="flex gap-3 border-b border-ink-border/60 px-3 py-2 last:border-b-0">
              <span className="w-12 flex-shrink-0 text-xs font-semibold text-lime">Week {w.week}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-cloud">{w.label}</p>
                <p className="text-[11px] text-cloud-dim">{w.setsNote}. {w.rirNote}.</p>
              </div>
            </div>
          ))}
        </div>
        <ClaimSources claimIds={['progress_both', 'progress_increase', 'deload_concept', 'deload_rule']} className="mt-3" />
      </Section>

      <Section
        title="Why the plan looks like this"
        action={
          <button type="button" onClick={() => setShowWhy(!showWhy)} className="text-xs font-semibold text-lime">
            {showWhy ? 'Hide' : 'Show'}
          </button>
        }
      >
        {showWhy ? (
          <div className="space-y-3">
            {plan.rationale.map((r, i) => (
              <div key={i} className="rounded-xl border border-ink-border bg-ink-surface p-3">
                <p className="text-xs font-semibold text-cloud">{r.decision}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-cloud-dim">{CLAIMS[r.claimId]?.text}</p>
                <ClaimSources claimIds={[r.claimId]} className="mt-2" />
              </div>
            ))}
          </div>
        ) : (
          <p className="flex items-start gap-2 text-xs text-cloud-dim">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky" />
            Every choice is tied to a study or marked as a StartFit rule. {plan.rationale.length} reasons.
          </p>
        )}
      </Section>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-cloud-dim">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gold" />
        General guidance from your answers, not medical advice. Stop for chest pain, fainting, unusual breathlessness, or sharp or worsening pain.
      </p>
    </div>
  );
}

function ExerciseRow({ e, dayIndex, onAction, onOpen }: { e: PlannedExercise; dayIndex: number; onAction: (a: PlanAction) => string | null; onOpen: () => void }) {
  const [swapOpen, setSwapOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="rounded-xl bg-ink-elevated/60 p-3">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-cloud">{e.name}</p>
          <p className="text-[11px] text-cloud-dim">
            {e.sets} × {e.reps} · {e.timed ? '' : `${e.rir} in reserve · `}rest {e.restSeconds}s
          </p>
          {e.note && <p className="mt-0.5 text-[11px] text-cloud-dim/80">{e.note}</p>}
        </button>
        {e.alternatives.length > 0 && (
          <button type="button" aria-label={`Swap ${e.name}`} onClick={() => setSwapOpen(!swapOpen)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ink-surface text-cloud-dim hover:text-lime">
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {swapOpen && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {e.alternatives.map((a) => (
            <button
              key={a.exerciseId}
              type="button"
              onClick={() => {
                const m = onAction({ type: 'swap_exercise', dayIndex, exerciseId: e.exerciseId, newExerciseId: a.exerciseId });
                setMsg(m);
                if (!m) setSwapOpen(false);
              }}
              className="rounded-lg border border-ink-border bg-ink-surface px-2.5 py-1.5 text-[11px] text-cloud hover:border-lime/40"
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
      {msg && <p className="mt-1.5 text-[11px] text-rust">{msg}</p>}
    </div>
  );
}
