import type { CheckinSnapshot, ProfileSnapshot, RecoverySnapshot, WorkoutSnapshot } from './types';

export function normalizeRecoverySnapshot(input: { checkins: CheckinSnapshot[]; workouts: WorkoutSnapshot[]; profile: ProfileSnapshot }): RecoverySnapshot {
  const checkins = [...input.checkins].sort((a, b) => b.checkin_date.localeCompare(a.checkin_date));
  return { today: checkins[0] ?? null, checkins, workouts: input.workouts, profile: input.profile };
}
