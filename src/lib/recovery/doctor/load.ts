// Training load from session RPE (claims: srpe_valid, monotony_strain, monotony_rule, acwr_caution).
// Session load = RPE (0–10, the whole session) × minutes. Monotony = mean daily load / SD of daily load over
// 7 days (rest days count as 0). Strain = weekly load × monotony.

import { addDays, mean, sd, median, round1 } from './dates';

export interface LoadSession {
  id: string;
  /** Local date of the session ('YYYY-MM-DD'). */
  date: string;
  minutes: number;
  rpe: number | null;
}

export const MONOTONY_FLAG = 2.0;

export function sessionLoad(s: LoadSession): number | null {
  if (s.rpe == null || s.rpe < 0 || s.rpe > 10 || !(s.minutes > 0)) return null;
  return Math.round(s.rpe * Math.min(s.minutes, 300));
}

export interface WeekLoad {
  /** First and last day of the 7-day block. */
  start: string;
  end: string;
  sessions: number;
  ratedSessions: number;
  minutes: number;
  /** Sum of rated session loads (arbitrary units). */
  load: number;
  dailyLoads: number[];
  monotony: number | null;
  strain: number | null;
  avgRpe: number | null;
}

/** The 7 days ending on `end` (inclusive). */
export function weekLoad(sessions: LoadSession[], end: string): WeekLoad {
  const start = addDays(end, -6);
  const inWeek = sessions.filter((s) => s.date >= start && s.date <= end);
  const daily = Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) =>
    inWeek.filter((s) => s.date === d).reduce((sum, s) => sum + (sessionLoad(s) ?? 0), 0),
  );
  const rated = inWeek.filter((s) => sessionLoad(s) != null);
  const load = daily.reduce((a, b) => a + b, 0);
  let monotony: number | null = null;
  if (rated.length >= 2) {
    const spread = sd(daily);
    if (spread && spread > 0) monotony = round1(mean(daily)! / spread);
  }
  return {
    start,
    end,
    sessions: inWeek.length,
    ratedSessions: rated.length,
    minutes: Math.round(inWeek.reduce((s, x) => s + x.minutes, 0)),
    load,
    dailyLoads: daily,
    monotony,
    strain: monotony == null ? null : Math.round(load * monotony),
    avgRpe: rated.length ? round1(mean(rated.map((s) => s.rpe!))!) : null,
  };
}

/** `weeks` consecutive 7-day blocks ending on `today`, oldest first. */
export function weeklySeries(sessions: LoadSession[], today: string, weeks = 8): WeekLoad[] {
  return Array.from({ length: weeks }, (_, i) => weekLoad(sessions, addDays(today, -7 * (weeks - 1 - i))));
}

export interface LoadChange {
  /** This week's load as a % change from the average of the previous (up to 4) weeks that had rated sessions. */
  percent: number | null;
  previousAverage: number | null;
  weeksCompared: number;
}

export function loadChange(series: WeekLoad[]): LoadChange {
  if (series.length < 2) return { percent: null, previousAverage: null, weeksCompared: 0 };
  const current = series[series.length - 1];
  const previous = series.slice(-5, -1).filter((w) => w.ratedSessions > 0);
  if (previous.length < 2 || current.ratedSessions === 0) return { percent: null, previousAverage: null, weeksCompared: previous.length };
  const avg = mean(previous.map((w) => w.load))!;
  if (avg <= 0) return { percent: null, previousAverage: null, weeksCompared: previous.length };
  return { percent: Math.round(((current.load - avg) / avg) * 100), previousAverage: Math.round(avg), weeksCompared: previous.length };
}

/** Typical weekly load: median of the weeks that had rated sessions. */
export function typicalWeeklyLoad(series: WeekLoad[]): number | null {
  const v = median(series.filter((w) => w.ratedSessions > 0).map((w) => w.load));
  return v == null ? null : Math.round(v);
}

export function monotonyFlag(week: WeekLoad): boolean {
  return week.monotony != null && week.monotony > MONOTONY_FLAG && week.sessions >= 3;
}
