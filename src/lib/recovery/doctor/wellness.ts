// Morning wellness check-in (claims: wellness_subjective, wellness_hooper, wellness_scale).

import { addDays, mean, sd, round1 } from './dates';

export const WELLNESS_ITEMS = ['sleep', 'energy', 'soreness', 'stress', 'mood'] as const;
export type WellnessItem = (typeof WELLNESS_ITEMS)[number];

/** Answer labels, 1 → 5 (5 = best for every item). */
export const WELLNESS_LABELS: Record<WellnessItem, { title: string; answers: [string, string, string, string, string] }> = {
  sleep: { title: 'Sleep quality', answers: ['Very poor', 'Poor', 'OK', 'Good', 'Very good'] },
  energy: { title: 'Energy', answers: ['Exhausted', 'Tired', 'Normal', 'Fresh', 'Very fresh'] },
  soreness: { title: 'Muscle soreness', answers: ['Very sore', 'Sore', 'A bit sore', 'Hardly sore', 'Not sore'] },
  stress: { title: 'Stress', answers: ['Very stressed', 'Stressed', 'Normal', 'Relaxed', 'Very relaxed'] },
  mood: { title: 'Mood', answers: ['Very low', 'Low', 'OK', 'Good', 'Very good'] },
};

export interface WellnessEntry {
  date: string;
  sleep: number | null;
  energy: number | null;
  soreness: number | null;
  stress: number | null;
  mood: number | null;
  /** Hours slept last night, if logged. */
  sleepHours: number | null;
  /** Protein eaten that day (g), if logged. */
  proteinG?: number | null;
}

export const BASELINE_DAYS = 28;
export const BASELINE_MIN_ENTRIES = 7;

/** Sum of the five answers (5–25), or null when any answer is missing. */
export function wellnessScore(e: Pick<WellnessEntry, WellnessItem>): number | null {
  let total = 0;
  for (const k of WELLNESS_ITEMS) {
    const v = e[k];
    if (v == null || v < 1 || v > 5) return null;
    total += v;
  }
  return total;
}

export interface WellnessBaseline {
  mean: number;
  sd: number;
  n: number;
}

/** Your own average and spread over the 28 days before `date` (needs 7 complete check-ins). */
export function wellnessBaseline(entries: WellnessEntry[], date: string): WellnessBaseline | null {
  const from = addDays(date, -BASELINE_DAYS);
  const scores = entries.filter((e) => e.date >= from && e.date < date).map(wellnessScore).filter((s): s is number => s != null);
  if (scores.length < BASELINE_MIN_ENTRIES) return null;
  const m = mean(scores)!;
  // a spread of 0 (identical answers every day) would make any change look huge: use at least 1 point
  const spread = Math.max(1, sd(scores) ?? 1);
  return { mean: round1(m), sd: round1(spread), n: scores.length };
}

export type WellnessStatus = 'better' | 'usual' | 'lower' | 'much_lower' | 'no_baseline';

export interface WellnessToday {
  date: string;
  score: number;
  baseline: WellnessBaseline | null;
  /** (score − your average) / your spread; null without a baseline. */
  z: number | null;
  status: WellnessStatus;
  /** Items answered 1 or 2 today. */
  lowItems: WellnessItem[];
}

export function assessWellness(entries: WellnessEntry[], date: string): WellnessToday | null {
  const today = entries.find((e) => e.date === date);
  if (!today) return null;
  const score = wellnessScore(today);
  if (score == null) return null;
  const baseline = wellnessBaseline(entries, date);
  const lowItems = WELLNESS_ITEMS.filter((k) => (today[k] ?? 5) <= 2);
  if (!baseline) return { date, score, baseline: null, z: null, status: 'no_baseline', lowItems };
  const z = round1((score - baseline.mean) / baseline.sd);
  const status: WellnessStatus = z <= -2 ? 'much_lower' : z <= -1 ? 'lower' : z >= 1 ? 'better' : 'usual';
  return { date, score, baseline, z, status, lowItems };
}

/** Status of each of the last `count` complete check-ins up to `date` (each against its own prior baseline). */
export function recentWellnessStatuses(entries: WellnessEntry[], date: string, count = 5): WellnessStatus[] {
  return entries
    .filter((e) => e.date <= date && wellnessScore(e) != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, count)
    .map((e) => assessWellness(entries, e.date)?.status ?? 'no_baseline');
}
