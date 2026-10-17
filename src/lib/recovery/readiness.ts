import type { RecoveryMuscle } from './muscles';
import { MUSCLE_LABELS } from './muscles';
import type { MuscleRecoveryState, SleepEntry } from './engine';

export interface CheckinInput { checkinDate?: string; sleepHours: number | null; hydrationL: number | null; stress: number | null; restingHr: number | null; hrvMs: number | null; bodyWeight: number | null; proteinG: number | null }
export interface BaselineHR { restingHr: number; hrvMs: number; sampleDays: number }
export interface PerformanceCheck { muscle: RecoveryMuscle; baselineE1RM: number | null; currentE1RM: number | null; percentDrop: number | null; isFatigued: boolean }
export interface ReadinessInput { muscleStates: MuscleRecoveryState[]; latestCheckin: CheckinInput | null; latestSoreness: { muscle: RecoveryMuscle; score: number }[]; baselineHR: BaselineHR | null; performanceChecks: PerformanceCheck[]; sleep: SleepEntry[] }
export type ReadinessStatus = 'insufficient_data' | 'caution' | 'consider_reducing_intensity' | 'usual_training_may_be_reasonable';
export interface ReadinessResult { status: ReadinessStatus; availableInputs: string[]; missingInputs: string[]; firedRuleId: string; disclaimer: string; recordDates: string[]; confidence: 'Low' | 'Moderate' | 'High'; components: { name: string; available: boolean; value: string }[] }

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const { latestCheckin, latestSoreness, baselineHR, performanceChecks, sleep } = input;
  const availableInputs: string[] = []; const missingInputs: string[] = [];
  const components: ReadinessResult['components'] = [];
  const sleepValue = latestCheckin?.sleepHours ?? null;
  if (sleepValue != null) { availableInputs.push('sleep_hours'); components.push({ name: 'Sleep', available: true, value: `${sleepValue}h` }); } else { missingInputs.push('sleep_hours'); components.push({ name: 'Sleep', available: false, value: 'No data' }); }
  const stress = latestCheckin?.stress ?? null;
  if (stress != null) { availableInputs.push('stress'); components.push({ name: 'Stress', available: true, value: `${stress}/10` }); } else { missingInputs.push('stress'); components.push({ name: 'Stress', available: false, value: 'No data' }); }
  const sorenessMax = latestSoreness.length > 0 ? Math.max(...latestSoreness.map((entry) => entry.score)) : null;
  if (sorenessMax != null) { availableInputs.push('soreness_max'); components.push({ name: 'Soreness', available: true, value: `${sorenessMax}/10` }); } else { missingInputs.push('soreness_max'); components.push({ name: 'Soreness', available: false, value: 'No data' }); }
  const baselineAvailable = baselineHR != null && latestCheckin?.restingHr != null && latestCheckin.hrvMs != null;
  if (baselineAvailable) { availableInputs.push('resting_hr_with_baseline', 'hrv_with_baseline'); components.push({ name: 'Personal baseline', available: true, value: 'Available' }); } else { missingInputs.push('resting_hr_with_baseline', 'hrv_with_baseline'); components.push({ name: 'Personal baseline', available: false, value: 'Not established' }); }
  const trainingHistoryAvailable = performanceChecks.length > 0 || input.muscleStates.some((state) => state.lastTrainedDate != null);
  if (trainingHistoryAvailable) { availableInputs.push('training_load_with_history'); components.push({ name: 'Training history', available: true, value: 'Available' }); } else { missingInputs.push('training_load_with_history'); components.push({ name: 'Training history', available: false, value: 'No data' }); }
  const status: ReadinessStatus = sleepValue != null && stress != null && sleepValue < 5 && stress >= 8 ? 'consider_reducing_intensity' : sleepValue != null && sleepValue < 5 || stress != null && stress >= 8 || sorenessMax != null && sorenessMax >= 7 ? 'caution' : availableInputs.length < 3 ? 'insufficient_data' : 'usual_training_may_be_reasonable';
  const firedRuleId = status === 'consider_reducing_intensity' ? 'R1' : status === 'caution' ? 'R2' : status === 'insufficient_data' ? 'R3' : 'R4';
  const confidence = availableInputs.length >= 5 ? 'High' : availableInputs.length >= 3 ? 'Moderate' : 'Low';
  return { status, availableInputs, missingInputs, firedRuleId, disclaimer: 'Rules-based interpretation of recorded inputs. Not a medical assessment.', recordDates: [...new Set([latestCheckin?.checkinDate, ...sleep.map((entry) => entry.date)].filter((date): date is string => Boolean(date)))], confidence, components };
}

export interface AcwrResult { acwr: number | null; acuteLoad: number; chronicLoad: number; hasEnoughData: boolean; band: 'not_enough_data' | 'undertraining' | 'steady' | 'elevated' | 'spike' }
export function computeACWR(sessionDates: { date: string; totalSets: number }[], now: Date): AcwrResult { const dayMs = 86400000; const acuteLoad = sessionDates.filter((s) => new Date(s.date).getTime() >= now.getTime() - 7 * dayMs).reduce((sum, s) => sum + s.totalSets, 0); const chronicSessions = sessionDates.filter((s) => { const time = new Date(s.date).getTime(); return time >= now.getTime() - 28 * dayMs && time < now.getTime() - 7 * dayMs; }); const weeks = new Set(sessionDates.map((s) => { const date = new Date(s.date); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - date.getDay()); return date.toISOString().slice(0, 10); })); if (weeks.size < 4) return { acwr: null, acuteLoad, chronicLoad: 0, hasEnoughData: false, band: 'not_enough_data' }; const chronicLoad = chronicSessions.reduce((sum, s) => sum + s.totalSets, 0); const ratio = chronicLoad > 0 ? acuteLoad / (chronicLoad / 21) : null; const band = ratio == null ? 'not_enough_data' : ratio < 0.8 ? 'undertraining' : ratio <= 1.3 ? 'steady' : ratio <= 1.5 ? 'elevated' : 'spike'; return { acwr: ratio, acuteLoad, chronicLoad, hasEnoughData: true, band }; }
/**
 * Estimated 1RM by Epley's formula, weight × (1 + reps / 30), with reps in reserve counted as reps.
 * A true single (1 rep, 0 in reserve) is the 1RM itself, so it returns the weight unchanged.
 */
export function estimate1RM(weight: number, reps: number, rir: number | null): number {
  const effectiveReps = reps + Math.max(0, rir ?? 0);
  if (!(effectiveReps > 0) || !(weight > 0)) return 0;
  return effectiveReps === 1 ? weight : weight * (1 + effectiveReps / 30);
}
export function formatMuscleName(muscle: RecoveryMuscle): string { return MUSCLE_LABELS[muscle] ?? muscle; }
