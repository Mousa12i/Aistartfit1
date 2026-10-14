// Changes to a saved plan, from the plan screen or proposed by the AI coach. Every change is applied
// to a copy, the copy is re-checked by the validator, and only a change without errors is kept.

import { PlanLibrary, type UsableContext } from './engine-library';
import { parseTimedReps } from './engine';
import { estimateDayMinutes, validatePlan, volumeRowsFor, type PlanIssue } from './validate';
import { groupContributions, NON_VOLUME_PATTERNS } from './taxonomy';
import type { ScreeningResult } from './screening';
import type { PlannedExercise, TrainingPlan } from './plan-types';

export type PlanAction =
  | { type: 'swap_exercise'; dayIndex: number; exerciseId: string; newExerciseId: string }
  | { type: 'set_sets'; dayIndex: number; exerciseId: string; sets: number }
  | { type: 'set_reps'; dayIndex: number; exerciseId: string; repsMin: number; repsMax: number }
  | { type: 'set_rest'; dayIndex: number; exerciseId: string; restSeconds: number }
  | { type: 'remove_exercise'; dayIndex: number; exerciseId: string }
  | { type: 'add_exercise'; dayIndex: number; exerciseId: string; sets: number; repsMin: number; repsMax: number; restSeconds?: number; rir?: number }
  | { type: 'move_exercise'; dayIndex: number; exerciseId: string; toIndex: number };

export const PLAN_ACTION_TYPES = ['swap_exercise', 'set_sets', 'set_reps', 'set_rest', 'remove_exercise', 'add_exercise', 'move_exercise'] as const;

export interface ActionResult {
  ok: boolean;
  plan: TrainingPlan;
  issues: PlanIssue[];
  /** Plain-language description of what changed (or why nothing did). */
  message: string;
}

function clonePlan(plan: TrainingPlan): TrainingPlan {
  return JSON.parse(JSON.stringify(plan)) as TrainingPlan;
}

function plannedFrom(lib: PlanLibrary, exerciseId: string, base: Partial<PlannedExercise>): PlannedExercise | null {
  const ex = lib.byId.get(exerciseId);
  if (!ex) return null;
  const timed = parseTimedReps(ex.defaultReps);
  const repsMin = base.repsMin ?? timed?.[0] ?? 8;
  const repsMax = base.repsMax ?? timed?.[1] ?? 12;
  const isTimed = base.timed ?? !!timed;
  return {
    exerciseId: ex.id,
    name: ex.name,
    slot: base.slot ?? ex.coreSlot ?? null,
    pattern: ex.pattern,
    sets: base.sets ?? 3,
    reps: '',
    repsMin,
    repsMax,
    timed: isTimed,
    restSeconds: base.restSeconds ?? 90,
    rir: base.rir ?? 2,
    unilateral: ex.unilateral,
    note: base.note ?? null,
    alternatives: base.alternatives ?? [],
    contributions: NON_VOLUME_PATTERNS.includes(ex.pattern) ? {} : groupContributions(ex),
  };
}

function repsLabel(e: PlannedExercise): string {
  const r = e.repsMin === e.repsMax ? `${e.repsMin}` : `${e.repsMin}-${e.repsMax}`;
  return `${r}${e.timed ? ' s' : ''}${e.unilateral ? ' each side' : ''}`;
}

/** Recompute derived numbers after any change. */
export function refreshPlan(plan: TrainingPlan, lib: PlanLibrary): TrainingPlan {
  for (const day of plan.days) {
    for (const e of day.exercises) e.reps = repsLabel(e);
    day.estimatedMinutes = Math.round(estimateDayMinutes(day) / 5) * 5;
  }
  plan.volume = volumeRowsFor(plan, lib);
  return plan;
}

export function applyPlanAction(
  plan: TrainingPlan,
  action: PlanAction,
  lib: PlanLibrary,
  ctx: UsableContext,
  screening: ScreeningResult,
): ActionResult {
  const next = clonePlan(plan);
  const day = next.days[action.dayIndex];
  const fail = (message: string): ActionResult => ({ ok: false, plan, issues: [], message });
  if (!day) return fail('That training day does not exist in this plan.');
  const idx = day.exercises.findIndex((e) => e.exerciseId === action.exerciseId);
  if (action.type !== 'add_exercise' && idx < 0) return fail('That exercise is not on this day.');
  let message = '';

  switch (action.type) {
    case 'swap_exercise': {
      const old = day.exercises[idx];
      const replacement = plannedFrom(lib, action.newExerciseId, {
        slot: old.slot,
        sets: old.sets,
        repsMin: old.repsMin,
        repsMax: old.repsMax,
        timed: old.timed,
        restSeconds: old.restSeconds,
        rir: old.rir,
        alternatives: old.alternatives.filter((a) => a.exerciseId !== action.newExerciseId).concat({ exerciseId: old.exerciseId, name: old.name }),
      });
      if (!replacement) return fail('That exercise is not in the library.');
      day.exercises[idx] = replacement;
      message = `Swapped ${old.name} for ${replacement.name}.`;
      break;
    }
    case 'set_sets':
      day.exercises[idx].sets = action.sets;
      message = `${day.exercises[idx].name}: ${action.sets} sets.`;
      break;
    case 'set_reps':
      day.exercises[idx].repsMin = action.repsMin;
      day.exercises[idx].repsMax = action.repsMax;
      message = `${day.exercises[idx].name}: ${action.repsMin}–${action.repsMax}${day.exercises[idx].timed ? ' s' : ' reps'}.`;
      break;
    case 'set_rest':
      day.exercises[idx].restSeconds = action.restSeconds;
      message = `${day.exercises[idx].name}: rest ${action.restSeconds} s.`;
      break;
    case 'remove_exercise': {
      const [removed] = day.exercises.splice(idx, 1);
      message = `Removed ${removed.name} from ${day.label}.`;
      break;
    }
    case 'add_exercise': {
      if (day.exercises.some((e) => e.exerciseId === action.exerciseId)) return fail('That exercise is already on this day.');
      const added = plannedFrom(lib, action.exerciseId, {
        sets: action.sets,
        repsMin: action.repsMin,
        repsMax: action.repsMax,
        restSeconds: action.restSeconds,
        rir: Math.max(action.rir ?? 2, screening.minRir),
      });
      if (!added) return fail('That exercise is not in the library.');
      day.exercises.push(added);
      message = `Added ${added.name} to ${day.label}.`;
      break;
    }
    case 'move_exercise': {
      const [moved] = day.exercises.splice(idx, 1);
      const to = Math.max(0, Math.min(day.exercises.length, action.toIndex));
      day.exercises.splice(to, 0, moved);
      message = `Moved ${moved.name}.`;
      break;
    }
  }

  refreshPlan(next, lib);
  const issues = validatePlan(next, lib, ctx, screening);
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length) return { ok: false, plan, issues, message: `Not changed: ${errors[0].message}` };
  return { ok: true, plan: next, issues, message };
}

/**
 * Ready-made routines store library source ids (they are generated before the database exists);
 * map them to this database's exercise ids so swaps, checks and starting a session work.
 */
export function resolvePlanIds(plan: TrainingPlan, lib: PlanLibrary): TrainingPlan {
  const fix = (id: string | null): string | null => {
    if (!id || lib.byId.has(id)) return id;
    return lib.bySource.get(id)?.id ?? id;
  };
  const next = clonePlan(plan);
  for (const d of next.days) {
    for (const e of d.exercises) {
      e.exerciseId = fix(e.exerciseId) ?? e.exerciseId;
      e.alternatives = e.alternatives.map((a) => ({ ...a, exerciseId: fix(a.exerciseId) ?? a.exerciseId }));
    }
  }
  for (const c of next.cardio) c.exerciseId = fix(c.exerciseId);
  return next;
}
