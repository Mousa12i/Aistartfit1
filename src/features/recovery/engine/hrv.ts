import rules from '../data/recovery-rules.json';
import type { MetricResult, RecoverySnapshot } from './types';

export function selectHrv(snapshot: RecoverySnapshot): MetricResult<number> {
  const checkin = snapshot.today;
  if (!checkin || checkin.hrv_ms == null) return { value: null, unit: 'ms', source: null, recordedAt: null, completeness: 'missing', limitation: rules.hrv.whenBaselineMissing, explanation: 'HRV has not been recorded for the selected date.', missingInputs: ['hrv_ms'] };
  if (checkin.hrv_source === 'wearable' && checkin.hrv_ms < rules.inputLimits.hrv_ms.verifyBelow) return { value: null, unit: 'ms', source: checkin.hrv_source, recordedAt: checkin.checkin_date, completeness: 'unverified', limitation: 'This reading needs explicit verification before it can be used.', explanation: 'HRV is outside the verification range.', missingInputs: ['hr_verified'] };
  const baselineValues = snapshot.checkins.slice(1, 15).filter((entry) => entry.hrv_ms != null && entry.hrv_source != null && entry.hr_verified !== false).map((entry) => entry.hrv_ms as number);
  const limitation = baselineValues.length < rules.hrv.minMeasurementsForBaseline ? rules.hrv.whenBaselineMissing : null;
  return { value: checkin.hrv_ms, unit: 'ms', source: checkin.hrv_source ?? 'manual', recordedAt: checkin.checkin_date, completeness: 'complete', limitation, explanation: 'Recorded HRV with source and date; no above/below baseline label is shown.', missingInputs: limitation ? ['hrv_baseline'] : [] };
}
