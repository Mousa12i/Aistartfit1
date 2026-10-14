// Turns the person's logged workouts into the short summary the plan engine and the coach use.
// Only completed, non-warm-up sets count. Nothing is estimated that was not logged.

import { NON_VOLUME_PATTERNS, groupContributions, type MuscleGroupKey } from './taxonomy';
import type { PlanLibrary } from './engine-library';
import type { TrainingHistorySummary } from './plan-types';
import type { WorkoutSession, WorkoutSetLog } from '../types';

const DAY = 24 * 60 * 60 * 1000;

export function summarizeHistory(sessions: WorkoutSession[], logs: WorkoutSetLog[], lib: PlanLibrary, now = new Date()): TrainingHistorySummary {
  const done = sessions.filter((s) => s.status === 'completed' || (s.completed_at && s.status !== 'abandoned'));
  const sessionDate = new Map(done.map((s) => [s.id, new Date(s.completed_at ?? s.started_at).getTime()]));
  const t = now.getTime();
  const last28 = done.filter((s) => t - (sessionDate.get(s.id) ?? 0) <= 28 * DAY);
  const recent = done.filter((s) => t - (sessionDate.get(s.id) ?? 0) <= 84 * DAY);
  const earliest = recent.reduce((m, s) => Math.min(m, sessionDate.get(s.id) ?? t), t);
  const weeksLogged = recent.length ? Math.min(12, Math.max(1, Math.round((t - earliest) / (7 * DAY)))) : 0;

  const weekly: Partial<Record<MuscleGroupKey, number>> = {};
  const bestSets: TrainingHistorySummary['bestSets'] = {};
  const counts = new Map<string, number>();

  for (const log of logs) {
    const when = sessionDate.get(log.session_id);
    if (when == null || !log.completed || log.set_type === 'warm_up') continue;
    const age = t - when;
    const ex = lib.byId.get(log.exercise_id);
    if (age <= 56 * DAY) counts.set(log.exercise_id, (counts.get(log.exercise_id) ?? 0) + 1);
    if (ex && age <= 28 * DAY && !NON_VOLUME_PATTERNS.includes(ex.pattern)) {
      for (const [g, c] of Object.entries(groupContributions(ex)) as [MuscleGroupKey, number][]) weekly[g] = (weekly[g] ?? 0) + c / 4;
    }
    if (age <= 56 * DAY && log.weight != null && log.weight > 0 && log.reps > 0) {
      const prev = bestSets[log.exercise_id];
      if (!prev || log.weight > prev.weightKg || (log.weight === prev.weightKg && log.reps > prev.reps)) {
        bestSets[log.exercise_id] = { weightKg: Number(log.weight), reps: log.reps, rir: log.rir ?? null, date: new Date(when).toISOString().slice(0, 10) };
      }
    }
  }
  for (const g of Object.keys(weekly) as MuscleGroupKey[]) weekly[g] = Math.round((weekly[g] ?? 0) * 10) / 10;

  const frequentExerciseIds = [...counts.entries()]
    .filter(([id]) => lib.byId.has(id))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id);

  return { weeksLogged, sessionsLast4Weeks: last28.length, weeklySets: weekly, bestSets, frequentExerciseIds };
}
