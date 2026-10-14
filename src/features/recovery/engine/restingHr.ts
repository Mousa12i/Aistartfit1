import rules from '../data/recovery-rules.json';
import type { MetricResult, RecoverySnapshot } from './types';

export function selectRestingHr(snapshot: RecoverySnapshot): MetricResult<number> {
  const checkin = snapshot.today;
  const value = checkin?.resting_hr_bpm ?? checkin?.resting_hr ?? null;
  if (value == null) return { value: null, unit: 'bpm', source: null, recordedAt: null, completeness: 'missing', limitation: rules.restingHr.whenBaselineMissing, explanation: 'Resting heart rate has not been recorded.', missingInputs: ['resting_hr_bpm'] };
  if (!checkin?.hr_verified && (value < rules.inputLimits.resting_hr_bpm.verifyBelow || value > rules.inputLimits.resting_hr_bpm.verifyAbove)) return { value: null, unit: 'bpm', source: 'manual', recordedAt: checkin?.checkin_date ?? null, completeness: 'unverified', limitation: 'Explicit confirmation is required before this reading is used.', explanation: 'Resting heart rate is outside the verification range.', missingInputs: ['hr_verified'] };
  return { value, unit: 'bpm', source: 'manual', recordedAt: checkin?.checkin_date ?? null, completeness: 'complete', limitation: rules.restingHr.whenBaselineMissing, explanation: 'Recorded measurement only; interpretation requires seven measurements.', missingInputs: [] };
}
