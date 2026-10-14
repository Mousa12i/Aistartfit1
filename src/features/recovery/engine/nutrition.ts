import rules from '../data/recovery-rules.json';
import type { MetricResult, RecoverySnapshot } from './types';

export function selectProteinTarget(snapshot: RecoverySnapshot): MetricResult<number> {
  const weight = snapshot.profile.body_weight_kg;
  if (weight == null) return { value: null, unit: 'g/day', source: null, recordedAt: null, completeness: 'missing', limitation: rules.nutrition.whenMissing, explanation: 'Protein target uses body weight multiplied by the guideline value.', missingInputs: ['profile.body_weight_kg'] };
  return { value: weight * rules.nutrition.proteinGramsPerKg, unit: 'g/day', source: 'profile.body_weight_kg × 1.6', recordedAt: null, completeness: 'complete', limitation: 'General guideline; user-adjustable.', explanation: `${weight} kg × ${rules.nutrition.proteinGramsPerKg} g/kg/day.`, missingInputs: [] };
}
