import rules from '../data/recovery-rules.json';
import type { RecoveryCatalogMuscle } from '../data/loader';
import type { RecoverySnapshot } from './types';
import { selectMuscleActivity } from './muscleActivity';

export type MuscleState = 'no_history' | 'insufficient_data' | 'recently_trained' | 'recovering_estimate' | 'recovered_estimate' | 'soreness_reported' | 'needs_attention';
export interface DerivedMuscleState { muscleId: string; state: MuscleState; lastTrainedAt: string | null; workingSets: number; limitation: string | null; missingInputs: string[] }

export function selectMuscleStates(snapshot: RecoverySnapshot, catalog: RecoveryCatalogMuscle[], now = new Date()): DerivedMuscleState[] {
  const activity = selectMuscleActivity(snapshot, catalog);
  return activity.map((item) => {
    const history = snapshot.checkins.map((checkin) => checkin.soreness[item.muscleId]).filter((score): score is number => score != null);
    const latestSoreness = history[0] ?? null;
    const state: MuscleState = history.length >= 2 && history[0] >= 4 && history[1] >= 4 ? 'needs_attention' : latestSoreness != null && latestSoreness >= 1 ? 'soreness_reported' : item.incompleteMapping || (item.workingSets > 0 && !item.lastTrainedAt) ? 'insufficient_data' : item.lastTrainedAt && now.getTime() - new Date(item.lastTrainedAt).getTime() < 48 * 60 * 60 * 1000 ? 'recently_trained' : item.workingSets === 0 ? 'no_history' : 'insufficient_data';
    return { muscleId: item.muscleId, state, lastTrainedAt: item.lastTrainedAt, workingSets: item.workingSets, limitation: rules.muscleStates.forbiddenLabels.includes('Recovery time needed 48h') ? 'Individual recovery duration is not estimated by this ruleset.' : null, missingInputs: state === 'no_history' ? ['mapped_workout_set'] : [] };
  });
}
