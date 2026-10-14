import rules from '../data/recovery-rules.json';
import type { MetricResult } from './types';
import type { RecoverySnapshot } from './types';

export function selectSleep(snapshot: RecoverySnapshot): MetricResult<number> {
  const checkin = snapshot.today;
  if (!checkin || checkin.sleep_hours == null) return { value: null, unit: 'hours', source: null, recordedAt: null, completeness: 'missing', limitation: null, explanation: 'Sleep duration has not been recorded for the selected date.', missingInputs: ['sleep_hours'] };
  return { value: checkin.sleep_hours, unit: 'hours', source: checkin.sleep_source ?? 'manual', recordedAt: checkin.checkin_date, completeness: 'complete', limitation: null, explanation: 'Recorded sleep duration; sleep stages are not inferred.', missingInputs: [] };
}

export function selectSleepHistory(snapshot: RecoverySnapshot): MetricResult<number>[] {
  return snapshot.checkins.filter((checkin) => checkin.sleep_hours != null).map((checkin) => ({ value: checkin.sleep_hours, unit: 'hours', source: checkin.sleep_source ?? 'manual', recordedAt: checkin.checkin_date, completeness: 'complete', limitation: null, explanation: 'Recorded sleep duration.', missingInputs: [] }));
}

export const sleepRules = rules.sleep;
