// Helpers for routines stored in workout_plans / workout_plan_exercises (pure, no network).

import { NON_VOLUME_PATTERNS, groupContributions, MUSCLE_GROUPS, type MovementPattern, type MuscleGroupKey } from './taxonomy';
import type { RecoveryMuscle } from '../recovery/muscles';
import type { Exercise, WorkoutPlanExercise } from '../types';
import type { TrainingPlan } from './plan-types';

/** Group a routine's exercises into its training days (older routines are one day). */
export function routineDays(rows: WorkoutPlanExercise[]): { index: number; label: string; exercises: WorkoutPlanExercise[] }[] {
  const byDay = new Map<number, WorkoutPlanExercise[]>();
  for (const r of [...rows].sort((a, b) => (a.day_index ?? 0) - (b.day_index ?? 0) || a.exercise_order - b.exercise_order)) {
    const d = r.day_index ?? 0;
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }
  return [...byDay.entries()].map(([index, exercises]) => ({ index, label: exercises[0]?.day_label ?? `Day ${index + 1}`, exercises }));
}

/** Fractional weekly sets of one exercise row: 1 per set for direct muscles, ½ for helpers. */
export function exerciseGroupContributions(ex: Pick<Exercise, 'pattern' | 'muscles_primary' | 'muscles_secondary'> | undefined | null): Partial<Record<MuscleGroupKey, number>> {
  if (!ex?.pattern || NON_VOLUME_PATTERNS.includes(ex.pattern as MovementPattern)) return {};
  return groupContributions({
    pattern: ex.pattern as MovementPattern,
    primary: (ex.muscles_primary ?? []) as RecoveryMuscle[],
    secondary: (ex.muscles_secondary ?? []) as RecoveryMuscle[],
  });
}

/**
 * Weekly sets per muscle group, counted the same way as the plan engine (fractional). A routine
 * with several days is done once per day each week; a single-day routine is repeated
 * `sessionsPerWeek` times. Rows without muscle data (older custom exercises) are skipped.
 */
export function routineWeeklySets(rows: WorkoutPlanExercise[], sessionsPerWeek = 1): { group: MuscleGroupKey; label: string; sets: number }[] {
  const repeat = routineDays(rows).length > 1 ? 1 : Math.max(1, Math.min(7, Math.round(sessionsPerWeek)));
  const totals: Partial<Record<MuscleGroupKey, number>> = {};
  for (const r of rows) {
    for (const [g, c] of Object.entries(exerciseGroupContributions(r.exercise)) as [MuscleGroupKey, number][]) {
      totals[g] = (totals[g] ?? 0) + c * r.sets * repeat;
    }
  }
  return (Object.entries(totals) as [MuscleGroupKey, number][])
    .map(([group, sets]) => ({ group, label: MUSCLE_GROUPS[group].label, sets: Math.round(sets * 10) / 10 }))
    .sort((a, b) => b.sets - a.sets);
}

/** Rows for workout_plan_exercises from an engine plan (one block of orders per day). */
export function routineRowsFromPlan(plan: TrainingPlan) {
  return plan.days.flatMap((day) =>
    day.exercises.map((e, i) => ({
      exercise_id: e.exerciseId,
      day_index: day.index,
      day_label: day.label,
      exercise_order: day.index * 100 + i,
      sets: e.sets,
      reps: e.reps,
      rest_seconds: e.restSeconds,
      rir_target: e.timed ? null : e.rir,
      notes: e.note,
    })),
  );
}
