// Personal insights: "what works for you" (n-of-1 comparisons), the recovery fingerprint and the weekly report.
// Claims: nof1_rule, wellness_scale, srpe_valid, monotony_strain, sleep_7h, cycle_trivial.

import type { RecoveryProfileEntry } from '../store';
import { MUSCLE_LABELS, type RecoveryMuscle, RECOVERY_MUSCLES } from '../muscles';
import { addDays, mean, sd, round1 } from './dates';
import { wellnessScore, wellnessBaseline, type WellnessEntry } from './wellness';
import { sessionLoad, weekLoad, weeklySeries, loadChange, typicalWeeklyLoad, type LoadSession } from './load';
import { sessionBests, sleepSummary, type PerfSet } from './trends';
import { isPeriodDay } from './cycle';
import { MODALITIES } from './modalities';

export const NOF1_MIN = 5;

export interface Comparison {
  id: string;
  title: string;
  outcome: string;
  labelA: string;
  labelB: string;
  nA: number;
  nB: number;
  meanA: number | null;
  meanB: number | null;
  diff: number | null;
  /** Your usual day-to-day spread of the outcome. */
  spread: number | null;
  result: 'pattern' | 'no_clear_difference' | 'not_enough_data';
  /** Higher outcome = better for every comparison here. */
  summary: string;
}

function compare(id: string, title: string, outcome: string, labelA: string, labelB: string, a: number[], b: number[], unit = ''): Comparison {
  const nA = a.length;
  const nB = b.length;
  const all = [...a, ...b];
  const spread = all.length >= 3 ? Math.max(round1(sd(all)!), 0.1) : null;
  if (nA < NOF1_MIN || nB < NOF1_MIN) {
    return {
      id, title, outcome, labelA, labelB, nA, nB, meanA: null, meanB: null, diff: null, spread,
      result: 'not_enough_data',
      summary: `Needs at least ${NOF1_MIN} days of each (now ${nA} and ${nB}).`,
    };
  }
  const meanA = round1(mean(a)!);
  const meanB = round1(mean(b)!);
  const diff = round1(meanA - meanB);
  const isPattern = spread != null && Math.abs(diff) >= 0.5 * spread;
  const better = diff > 0 ? labelA : labelB;
  return {
    id, title, outcome, labelA, labelB, nA, nB, meanA, meanB, diff, spread,
    result: isPattern ? 'pattern' : 'no_clear_difference',
    summary: isPattern
      ? `${outcome} was ${Math.abs(diff)}${unit} better ${better.charAt(0).toLowerCase() + better.slice(1)} (${meanA}${unit} vs ${meanB}${unit}).`
      : `No clear difference so far (${meanA}${unit} vs ${meanB}${unit}).`,
  };
}

export interface ModalityLog {
  date: string;
  modality: string;
}

export interface InsightInput {
  today: string;
  wellness: WellnessEntry[];
  sessions: LoadSession[];
  sets: PerfSet[];
  modalityLogs: ModalityLog[];
  bodyWeightKg: number | null;
  /** Only when cycle insights are switched on. */
  cycleStarts: string[] | null;
}

const restScore = (e: WellnessEntry) =>
  e.energy != null && e.soreness != null && e.stress != null && e.mood != null ? e.energy + e.soreness + e.stress + e.mood : null;

export function whatWorks(input: InsightInput, days = 120): Comparison[] {
  const from = addDays(input.today, -days);
  const w = input.wellness.filter((e) => e.date >= from && e.date <= input.today);
  const byDate = new Map(w.map((e) => [e.date, e]));
  const out: Comparison[] = [];

  // 1. sleep ≥7 h vs <7 h → same-morning check-in without the sleep question
  const sleepA: number[] = [];
  const sleepB: number[] = [];
  for (const e of w) {
    const s = restScore(e);
    if (s == null || e.sleepHours == null) continue;
    (e.sleepHours >= 7 ? sleepA : sleepB).push(s);
  }
  out.push(compare('sleep', 'Sleep and how you feel', 'Your check-in (energy, soreness, stress, mood; 4–20)', 'After 7+ hours', 'After less than 7 hours', sleepA, sleepB));

  // 2. hard vs moderate session → next-morning check-in
  const sessionsByDate = new Map<string, number>();
  for (const s of input.sessions) if (s.rpe != null) sessionsByDate.set(s.date, Math.max(sessionsByDate.get(s.date) ?? 0, s.rpe));
  const hardA: number[] = [];
  const hardB: number[] = [];
  for (const [date, rpe] of sessionsByDate) {
    const next = byDate.get(addDays(date, 1));
    const score = next ? wellnessScore(next) : null;
    if (score == null) continue;
    if (rpe >= 8) hardA.push(score);
    else if (rpe <= 6) hardB.push(score);
  }
  out.push(compare('session_rpe', 'Hard vs moderate sessions', 'Next-morning check-in (5–25)', 'After a moderate session (RPE ≤ 6)', 'After a hard session (RPE ≥ 8)', hardB, hardA));

  // 3. recovery methods after training → next-morning soreness answer
  const trainingDays = new Set(input.sessions.map((s) => s.date));
  const methodsByDate = new Map<string, Set<string>>();
  for (const l of input.modalityLogs) {
    const set = methodsByDate.get(l.date) ?? new Set();
    set.add(l.modality);
    methodsByDate.set(l.date, set);
  }
  for (const m of MODALITIES.filter((x) => !['sleep', 'protein'].includes(x.id))) {
    const a: number[] = [];
    const b: number[] = [];
    for (const d of trainingDays) {
      const next = byDate.get(addDays(d, 1));
      if (next?.soreness == null) continue;
      const used = methodsByDate.get(d);
      if (used?.has(m.id)) a.push(next.soreness);
      else if (!used || used.size === 0) b.push(next.soreness);
    }
    if (a.length === 0) continue;
    out.push(compare(`method_${m.id}`, `${m.name} after training`, 'Next-morning soreness answer (1–5, 5 = not sore)', `With ${m.name.toLowerCase()}`, 'With no recovery method', a, b));
  }

  // 4. protein on training days → next-morning soreness answer
  if (input.bodyWeightKg && input.bodyWeightKg > 0) {
    const a: number[] = [];
    const b: number[] = [];
    for (const d of trainingDays) {
      const day = byDate.get(d);
      const next = byDate.get(addDays(d, 1));
      if (day?.proteinG == null || next?.soreness == null) continue;
      (day.proteinG / input.bodyWeightKg >= 1.6 ? a : b).push(next.soreness);
    }
    out.push(compare('protein', 'Protein on training days', 'Next-morning soreness answer (1–5, 5 = not sore)', 'With 1.6+ g/kg protein', 'With less', a, b));
  }

  // 5. sleep and strength: session e1RM vs that exercise's own average
  const bests = sessionBests(input.sets.filter((s) => s.date >= from));
  const relBySession = new Map<string, { date: string; rel: number[] }>();
  for (const points of bests.values()) {
    if (points.length < 3) continue;
    const avg = mean(points.map((p) => p.e1rm))!;
    for (const p of points) {
      const r = relBySession.get(p.sessionId) ?? { date: p.date, rel: [] };
      r.rel.push(((p.e1rm - avg) / avg) * 100);
      relBySession.set(p.sessionId, r);
    }
  }
  const perfA: number[] = [];
  const perfB: number[] = [];
  for (const { date, rel } of relBySession.values()) {
    const hours = byDate.get(date)?.sleepHours;
    if (hours == null) continue;
    (hours >= 7 ? perfA : perfB).push(round1(mean(rel)!));
  }
  out.push(compare('sleep_strength', 'Sleep and strength', 'Strength vs your average for the same lifts', 'After 7+ hours', 'After less than 7 hours', perfA, perfB, '%'));

  // 6. cycle (only when switched on)
  if (input.cycleStarts && input.cycleStarts.length) {
    const a: number[] = [];
    const b: number[] = [];
    for (const e of w) {
      const s = wellnessScore(e);
      if (s == null) continue;
      (isPeriodDay(input.cycleStarts, e.date) ? b : a).push(s);
    }
    out.push(compare('cycle', 'Cycle and how you feel', 'Check-in (5–25)', 'Other days', 'Period days (1–5)', a, b));
  }
  return out;
}

// ---------------- recovery fingerprint ----------------

export interface Fingerprint {
  checkins: number;
  wellness: { mean: number; sd: number; n: number } | null;
  sleep: { average: number | null; spread: number | null; nights: number };
  typicalWeeklyLoad: number | null;
  avgSessionRpe: number | null;
  sessionsPerWeek: number | null;
  slower: { muscle: RecoveryMuscle; multiplier: number; samples: number }[];
  faster: { muscle: RecoveryMuscle; multiplier: number; samples: number }[];
  hardSessionCost: number | null;
  /** How many more days of data until the fingerprint is complete (0 = complete). */
  missing: string[];
}

export function recoveryFingerprint(input: InsightInput, profile: RecoveryProfileEntry[]): Fingerprint {
  const from28 = addDays(input.today, -27);
  const baseline = wellnessBaseline(input.wellness, addDays(input.today, 1));
  const nights = input.wellness.filter((e) => e.date >= from28 && e.sleepHours != null).map((e) => e.sleepHours!);
  const series = weeklySeries(input.sessions, input.today, 8);
  const rated = input.sessions.filter((s) => s.date >= addDays(input.today, -55) && sessionLoad(s) != null);
  const activeWeeks = series.filter((w) => w.sessions > 0);
  const known = profile.filter((p) => p.confidence !== 'Low' && RECOVERY_MUSCLES.includes(p.muscle as RecoveryMuscle));
  const hard = whatWorks(input).find((c) => c.id === 'session_rpe');
  const missing: string[] = [];
  if (!baseline) missing.push('7 morning check-ins');
  if (nights.length < 7) missing.push('7 nights of sleep');
  if (rated.length < 6) missing.push('6 rated sessions');
  return {
    checkins: input.wellness.filter((e) => wellnessScore(e) != null).length,
    wellness: baseline,
    sleep: { average: nights.length ? round1(mean(nights)!) : null, spread: nights.length >= 3 ? round1(sd(nights)!) : null, nights: nights.length },
    typicalWeeklyLoad: typicalWeeklyLoad(series),
    avgSessionRpe: rated.length ? round1(mean(rated.map((s) => s.rpe!))!) : null,
    sessionsPerWeek: activeWeeks.length ? round1(series.reduce((s, w) => s + w.sessions, 0) / series.length) : null,
    slower: known.filter((p) => p.personal_multiplier >= 1.1).map((p) => ({ muscle: p.muscle as RecoveryMuscle, multiplier: p.personal_multiplier, samples: p.sample_size })),
    faster: known.filter((p) => p.personal_multiplier <= 0.9).map((p) => ({ muscle: p.muscle as RecoveryMuscle, multiplier: p.personal_multiplier, samples: p.sample_size })),
    hardSessionCost: hard && hard.result !== 'not_enough_data' ? hard.diff : null,
    missing,
  };
}

export function fingerprintLines(f: Fingerprint): string[] {
  const lines: string[] = [];
  if (f.wellness) lines.push(`Usual morning check-in: ${f.wellness.mean}/25 (±${f.wellness.sd}, ${f.wellness.n} days).`);
  if (f.sleep.average != null) lines.push(`Sleep: ${f.sleep.average} h on average over ${f.sleep.nights} nights${f.sleep.spread != null ? `, varying by ±${f.sleep.spread} h` : ''}.`);
  if (f.typicalWeeklyLoad != null) lines.push(`Typical week: ${f.typicalWeeklyLoad} load units${f.avgSessionRpe != null ? `, sessions feel ${f.avgSessionRpe}/10 on average` : ''}.`);
  if (f.slower.length) lines.push(`Recovers slower than the default: ${f.slower.map((s) => MUSCLE_LABELS[s.muscle]).join(', ')}.`);
  if (f.faster.length) lines.push(`Recovers faster than the default: ${f.faster.map((s) => MUSCLE_LABELS[s.muscle]).join(', ')}.`);
  if (f.hardSessionCost != null) lines.push(`After hard sessions your next-morning check-in is ${Math.abs(f.hardSessionCost)} points ${f.hardSessionCost >= 0 ? 'lower' : 'higher'} than after moderate ones.`);
  return lines;
}

// ---------------- weekly report ----------------

export interface WeeklyReport {
  start: string;
  end: string;
  sessions: number;
  minutes: number;
  load: number;
  ratedSessions: number;
  monotony: number | null;
  strain: number | null;
  loadChangePercent: number | null;
  avgRpe: number | null;
  checkins: number;
  wellnessAverage: number | null;
  wellnessUsual: number | null;
  sleepAverage: number | null;
  nightsUnder7: number;
  sleepDebt: number;
  bestLifts: { name: string; e1rm: number; changePercent: number | null }[];
  focus: string[];
  claimIds: string[];
}

export function weeklyReport(input: InsightInput, end = input.today): WeeklyReport {
  const week = weekLoad(input.sessions, end);
  const series = weeklySeries(input.sessions, end, 5);
  const change = loadChange(series);
  const inWeek = input.wellness.filter((e) => e.date >= week.start && e.date <= end);
  const scores = inWeek.map(wellnessScore).filter((s): s is number => s != null);
  const usual = wellnessBaseline(input.wellness, week.start);
  const sleep = sleepSummary(inWeek.filter((e) => e.sleepHours != null).map((e) => ({ date: e.date, hours: e.sleepHours! })), end);

  const bests = sessionBests(input.sets.filter((s) => s.date <= end && s.date >= addDays(end, -27)));
  const names = new Map(input.sets.map((s) => [s.exerciseId, s.exerciseName]));
  const bestLifts: WeeklyReport['bestLifts'] = [];
  for (const [id, pts] of bests) {
    const thisWeek = pts.filter((p) => p.date >= week.start);
    const before = pts.filter((p) => p.date < week.start);
    if (!thisWeek.length) continue;
    const now = Math.max(...thisWeek.map((p) => p.e1rm));
    const prev = before.length ? Math.max(...before.map((p) => p.e1rm)) : null;
    bestLifts.push({ name: names.get(id) ?? 'Exercise', e1rm: round1(now), changePercent: prev ? round1(((now - prev) / prev) * 100) : null });
  }
  bestLifts.sort((a, b) => (b.changePercent ?? -999) - (a.changePercent ?? -999));

  const focus: string[] = [];
  if (week.sessions > 0 && week.ratedSessions < week.sessions) focus.push(`Rate every session (${week.sessions - week.ratedSessions} of ${week.sessions} were not rated), so your load is complete.`);
  if (scores.length < 5) focus.push(`Do the morning check-in more days (${scores.length}/7 this week).`);
  if (sleep.nights > 0 && sleep.nightsUnder7 >= 3) focus.push(`${sleep.nightsUnder7} nights under 7 hours: make sleep the first recovery priority next week.`);
  if (week.monotony != null && week.monotony > 2 && week.sessions >= 3) focus.push('Monotony was above 2.0: plan at least one clearly easier day next week.');
  if (change.percent != null && change.percent >= 30) focus.push(`Load was ${change.percent}% above your recent average: watch how you feel in the next check-ins.`);
  if (!focus.length && week.sessions > 0) focus.push('Steady week: keep the same routine and keep logging.');

  return {
    start: week.start,
    end,
    sessions: week.sessions,
    minutes: week.minutes,
    load: week.load,
    ratedSessions: week.ratedSessions,
    monotony: week.monotony,
    strain: week.strain,
    loadChangePercent: change.percent,
    avgRpe: week.avgRpe,
    checkins: scores.length,
    wellnessAverage: scores.length ? round1(mean(scores)!) : null,
    wellnessUsual: usual?.mean ?? null,
    sleepAverage: sleep.average,
    nightsUnder7: sleep.nightsUnder7,
    sleepDebt: sleep.debt,
    bestLifts: bestLifts.slice(0, 5),
    focus,
    claimIds: ['srpe_valid', 'monotony_strain', 'monotony_rule', 'wellness_scale', 'sleep_7h', 'sleep_debt_rule'],
  };
}
