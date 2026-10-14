import rules from '../data/recovery-rules.json';
import type { MetricResult, RecoverySnapshot } from './types';
import { selectHrv } from './hrv';
import { selectRestingHr } from './restingHr';
import { selectSleep } from './sleep';

export type ReadinessStatus = 'insufficient_data' | 'caution' | 'consider_reducing_intensity' | 'usual_training_may_be_reasonable';
export interface ReadinessResult { value: ReadinessStatus; unit: null; source: string; recordedAt: string | null; completeness: 'complete' | 'partial'; limitation: string; explanation: string; missingInputs: string[]; inputsUsed: string[]; firedRuleId: string; disclaimer: string }

export function selectReadiness(snapshot: RecoverySnapshot, trainingHistoryAvailable: boolean, sorenessMax: number | null): ReadinessResult {
  const sleep = selectSleep(snapshot); const stress = snapshot.today?.stress ?? null; const hrv = selectHrv(snapshot); const restingHr = selectRestingHr(snapshot);
  const inputsUsed: string[] = []; const missingInputs: string[] = [];
  if (sleep.value != null) inputsUsed.push('sleep_hours'); else missingInputs.push('sleep_hours');
  if (stress != null) inputsUsed.push('stress'); else missingInputs.push('stress');
  if (sorenessMax != null) inputsUsed.push('soreness_max'); else missingInputs.push('soreness_max');
  if (hrv.completeness === 'complete') inputsUsed.push('hrv_with_baseline'); else missingInputs.push('hrv_with_baseline');
  if (restingHr.completeness === 'complete') inputsUsed.push('resting_hr_with_baseline'); else missingInputs.push('resting_hr_with_baseline');
  if (trainingHistoryAvailable) inputsUsed.push('training_load_with_history'); else missingInputs.push('training_load_with_history');
  const lowSleep = sleep.value != null && sleep.value < 5; const highStress = stress != null && stress >= 8; const highSoreness = sorenessMax != null && sorenessMax >= 4;
  const status: ReadinessStatus = lowSleep && highStress ? 'consider_reducing_intensity' : lowSleep || highStress || highSoreness ? 'caution' : inputsUsed.length < 3 ? 'insufficient_data' : 'usual_training_may_be_reasonable';
  const firedRuleId = status === 'consider_reducing_intensity' ? 'R1' : status === 'caution' ? 'R2' : status === 'insufficient_data' ? 'R3' : 'R4';
  return { value: status, unit: null, source: 'saved check-ins and dated training records', recordedAt: snapshot.today?.checkin_date ?? null, completeness: inputsUsed.length >= 3 ? 'complete' : 'partial', limitation: missingInputs.length ? 'Some independent inputs are missing or lack a personal baseline.' : 'Rules-based interpretation only.', explanation: rules.readiness.uiLabels[status], missingInputs, inputsUsed, firedRuleId, disclaimer: rules.readiness.disclaimer };
}

export function readinessLabel(result: ReadinessResult): string { return rules.readiness.uiLabels[result.value]; }
export type ReadinessMetric = MetricResult<ReadinessStatus>;
