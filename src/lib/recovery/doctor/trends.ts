// Performance trends from logged sets and the sleep summary (claims: sleep_7h, sleep_debt_rule, sleep_loss_perf).

import { estimate1RM } from '../readiness';
import { addDays, mean, sd, round1 } from './dates';

export interface PerfSet {
  sessionId: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  rir: number | null;
  setType: string | null;
  completed: boolean;
}

export interface ExerciseTrend {
  exerciseId: string;
  name: string;
  /** Best estimated 1RM of each session, oldest first. */
  points: { date: string; e1rm: number }[];
  /** Mean of the last 2 sessions vs the first 2 in the window, in %. */
  changePercent: number | null;
  latest: number;
}

const isWorking = (s: PerfSet) => s.completed && s.setType !== 'warm_up' && s.setType !== 'warmup' && s.weight > 0 && s.reps > 0 && s.reps <= 20;

export function sessionBests(sets: PerfSet[]): Map<string, { date: string; sessionId: string; e1rm: number }[]> {
  const best = new Map<string, Map<string, { date: string; e1rm: number }>>();
  for (const s of sets) {
    if (!isWorking(s)) continue;
    const e = estimate1RM(s.weight, s.reps, s.rir);
    if (!(e > 0)) continue;
    const byExercise = best.get(s.exerciseId) ?? new Map();
    const prev = byExercise.get(s.sessionId);
    if (!prev || e > prev.e1rm) byExercise.set(s.sessionId, { date: s.date, e1rm: e });
    best.set(s.exerciseId, byExercise);
  }
  const out = new Map<string, { date: string; sessionId: string; e1rm: number }[]>();
  for (const [id, m] of best) {
    out.set(
      id,
      [...m.entries()].map(([sessionId, v]) => ({ sessionId, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
    );
  }
  return out;
}

/** The most-logged exercises in the last `days` days (3+ sessions each), with their e1RM trend. */
export function performanceTrends(sets: PerfSet[], today: string, days = 56, limit = 5): ExerciseTrend[] {
  const from = addDays(today, -days + 1);
  const recent = sets.filter((s) => s.date >= from && s.date <= today);
  const names = new Map(recent.map((s) => [s.exerciseId, s.exerciseName]));
  const trends: ExerciseTrend[] = [];
  for (const [id, points] of sessionBests(recent)) {
    if (points.length < 3) continue;
    const first = mean(points.slice(0, 2).map((p) => p.e1rm))!;
    const last = mean(points.slice(-2).map((p) => p.e1rm))!;
    trends.push({
      exerciseId: id,
      name: names.get(id) ?? 'Exercise',
      points: points.map((p) => ({ date: p.date, e1rm: round1(p.e1rm) })),
      changePercent: first > 0 ? round1(((last - first) / first) * 100) : null,
      latest: round1(points[points.length - 1].e1rm),
    });
  }
  return trends.sort((a, b) => b.points.length - a.points.length).slice(0, limit);
}

export interface SleepNight {
  date: string;
  hours: number;
}

export interface SleepSummary {
  nights: number;
  lastNight: number | null;
  average: number | null;
  nightsUnder7: number;
  /** Sum of hours below 7 over the logged nights. */
  debt: number;
  /** Spread (SD) of hours; null with fewer than 3 nights. */
  spread: number | null;
  irregular: boolean;
}

/** The last 7 logged nights within the last 14 days. */
export function sleepSummary(nights: SleepNight[], today: string): SleepSummary {
  const from = addDays(today, -13);
  const recent = nights
    .filter((n) => n.date >= from && n.date <= today && n.hours > 0 && n.hours <= 16)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  const hours = recent.map((n) => n.hours);
  const spread = hours.length >= 3 ? round1(sd(hours)!) : null;
  return {
    nights: recent.length,
    lastNight: recent.find((n) => n.date === today)?.hours ?? null,
    average: hours.length ? round1(mean(hours)!) : null,
    nightsUnder7: hours.filter((h) => h < 7).length,
    debt: round1(hours.reduce((s, h) => s + Math.max(0, 7 - h), 0)),
    spread,
    irregular: spread != null && spread > 1,
  };
}
