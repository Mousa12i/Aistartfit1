import type { RecoveryMuscle } from '@/lib/recovery/muscles';
import { COARSE_TO_FINE, RECOVERY_MUSCLES } from '@/lib/recovery/muscles';

export interface PlannedExercise {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  primary_muscle: string;
  secondary_muscles: string[];
}

export interface WorkoutPlan {
  id: string;
  name: string;
  exercises: PlannedExercise[];
}

export interface MusclePlannedSummary {
  plannedSets: number;
  routines: { id: string; name: string }[];
  exercises: string[];
  primarySets: number;
  secondarySets: number;
}

export interface MuscleComparisonEntry {
  plannedSets: number;
  lastDoneAt: string | null;
  lastSessionDate: string | null;
  daysSinceLastDone: number | null;
  needsAttention: boolean;
  recoveryMuscles: RecoveryMuscle[];
}

export interface UnmappedExercise {
  exercise_id: string;
  name: string;
  primary_muscle: string;
}

function coarseToFine(coarse: string): RecoveryMuscle[] {
  return COARSE_TO_FINE[coarse] ?? [];
}

export function plannedSetsByMuscle(plans: WorkoutPlan[]): Record<string, MusclePlannedSummary> {
  const muscleMap: Record<string, MusclePlannedSummary> = {};

  const ensure = (muscle: string): MusclePlannedSummary => {
    if (!muscleMap[muscle]) {
      muscleMap[muscle] = { plannedSets: 0, routines: [], exercises: [], primarySets: 0, secondarySets: 0 };
    }
    return muscleMap[muscle];
  };

  plans.forEach((plan) => {
    plan.exercises.forEach((ex) => {
      if (ex.primary_muscle && COARSE_TO_FINE[ex.primary_muscle]) {
        ensure(ex.primary_muscle);
        muscleMap[ex.primary_muscle].plannedSets += ex.sets * 1.0;
        muscleMap[ex.primary_muscle].primarySets += ex.sets;
        if (!muscleMap[ex.primary_muscle].routines.some((r) => r.id === plan.id)) {
          muscleMap[ex.primary_muscle].routines.push({ id: plan.id, name: plan.name });
        }
        if (!muscleMap[ex.primary_muscle].exercises.includes(ex.exercise_name)) {
          muscleMap[ex.primary_muscle].exercises.push(ex.exercise_name);
        }
      }
      (ex.secondary_muscles ?? []).forEach((muscle) => {
        if (!COARSE_TO_FINE[muscle]) return;
        ensure(muscle);
        muscleMap[muscle].plannedSets += ex.sets * 0.5;
        muscleMap[muscle].secondarySets += ex.sets * 0.5;
        if (!muscleMap[muscle].routines.some((r) => r.id === plan.id)) {
          muscleMap[muscle].routines.push({ id: plan.id, name: plan.name });
        }
        if (!muscleMap[muscle].exercises.includes(ex.exercise_name)) {
          muscleMap[muscle].exercises.push(ex.exercise_name);
        }
      });
    });
  });

  return muscleMap;
}

export function unmappedExercises(plans: WorkoutPlan[]): UnmappedExercise[] {
  const unmapped: UnmappedExercise[] = [];
  plans.forEach((plan) => {
    plan.exercises.forEach((ex) => {
      if (!COARSE_TO_FINE[ex.primary_muscle] && !unmapped.some((u) => u.exercise_id === ex.exercise_id)) {
        unmapped.push({ exercise_id: ex.exercise_id, name: ex.exercise_name, primary_muscle: ex.primary_muscle });
      }
    });
  });
  return unmapped;
}

export interface DoneExerciseState {
  lastDoneAt: string | null;
  lastSessionDate: string | null;
}

export function plannedVsDone(
  plannedMap: Record<string, MusclePlannedSummary>,
  doneStates: Record<string, DoneExerciseState>,
): Record<string, MuscleComparisonEntry> {
  const result: Record<string, MuscleComparisonEntry> = {};
  const now = Date.now();

  Object.keys(plannedMap).forEach((coarseMuscle) => {
    const plannedSets = plannedMap[coarseMuscle].plannedSets;
    const fineMuscles = coarseToFine(coarseMuscle);

    let earliestLastDone: string | null = null;
    let earliestSessionDate: string | null = null;

    for (const fine of fineMuscles) {
      const done = doneStates[fine];
      if (!done?.lastDoneAt) continue;
      if (!earliestLastDone || new Date(done.lastDoneAt) < new Date(earliestLastDone)) {
        earliestLastDone = done.lastDoneAt;
      }
      if (done.lastSessionDate && (!earliestSessionDate || new Date(done.lastSessionDate) < new Date(earliestSessionDate))) {
        earliestSessionDate = done.lastSessionDate;
      }
    }

    let daysSinceLastDone: number | null = null;
    if (earliestLastDone) {
      daysSinceLastDone = Math.ceil(Math.abs(now - new Date(earliestLastDone).getTime()) / 86400000);
    }

    result[coarseMuscle] = {
      plannedSets,
      lastDoneAt: earliestLastDone,
      lastSessionDate: earliestSessionDate,
      daysSinceLastDone,
      needsAttention: plannedSets > 0 && (daysSinceLastDone === null || daysSinceLastDone > 14),
      recoveryMuscles: fineMuscles,
    };
  });

  return result;
}

export function allRecoveryMuscles(): RecoveryMuscle[] {
  return RECOVERY_MUSCLES;
}
