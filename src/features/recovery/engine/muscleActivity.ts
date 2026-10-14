import type { RecoveryCatalogMuscle } from '../data/loader';
import type { RecoverySnapshot } from './types';

export interface MuscleActivity { muscleId: string; lastTrainedAt: string | null; workingSets: number; exerciseIds: string[]; incompleteMapping: boolean }

export function selectMuscleActivity(snapshot: RecoverySnapshot, catalog: RecoveryCatalogMuscle[]): MuscleActivity[] {
  return catalog.map((muscle) => {
    const ids = new Set([...muscle.exerciseMapping.primary, ...muscle.exerciseMapping.secondary]);
    const rows = snapshot.workouts.filter((workout) => ids.has(workout.exercise_id) && workout.completed && workout.set_type !== 'warm_up');
    const dated = rows.filter((row) => row.session_completed_at).sort((a, b) => (b.session_completed_at ?? '').localeCompare(a.session_completed_at ?? ''));
    return { muscleId: muscle.id, lastTrainedAt: dated[0]?.session_completed_at ?? null, workingSets: rows.length, exerciseIds: [...new Set(rows.map((row) => row.exercise_id))], incompleteMapping: muscle.exerciseMapping.primary.length === 0 && muscle.exerciseMapping.secondary.length === 0 };
  });
}
