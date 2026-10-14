import rules from '../data/recovery-rules.json';
import type { MetricResult, RecoverySnapshot } from './types';
import type { RecoveryCatalogMuscle } from '../data/loader';

export function selectTrainingLoad(snapshot: RecoverySnapshot, catalog: RecoveryCatalogMuscle[]): MetricResult<Record<string, number>> {
  const mapped = new Map<string, RecoveryCatalogMuscle>();
  for (const muscle of catalog) mapped.set(muscle.id, muscle);
  const rows = snapshot.workouts.filter((workout) => workout.completed && workout.set_type !== 'warm_up' && workout.session_completed_at && mapped.size > 0);
  if (rows.length === 0) return { value: null, unit: 'working sets', source: null, recordedAt: null, completeness: 'missing', limitation: rules.trainingLoad.whenMissing, explanation: 'No completed, dated working sets are available.', missingInputs: ['workouts'] };
  const values: Record<string, number> = {};
  for (const workout of rows) values[workout.exercise_id] = (values[workout.exercise_id] ?? 0) + 1;
  return { value: values, unit: 'working sets', source: rules.trainingLoad.label, recordedAt: rows[0].session_completed_at, completeness: 'partial', limitation: 'Per-muscle catalog mapping is required for interpretation.', explanation: rules.trainingLoad.formula, missingInputs: ['four_distinct_training_weeks'] };
}
