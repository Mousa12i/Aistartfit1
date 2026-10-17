// "Week at a glance" for one check-in: the athlete's own logs for the 7 days up to the day the check-in was sent
// (that day and the 6 before it, in the coach's local calendar). Every number is a count or an average of rows
// the athlete logged; nothing is estimated. Missing data stays null so the screen can say "no data".

export interface GlanceInput {
  /** When the check-in was sent (ISO). */
  submittedAt: string;
  weightKg: number | null;
  waistCm: number | null;
  prev: { weightKg: number | null; waistCm: number | null; submittedAt: string } | null;
  /** Finished workouts (ISO completion times). */
  sessions: string[];
  plannedPerWeek: number;
  meals: { date: string; kcal: number; protein: number }[];
  /** Calorie target the coach set (kcal_override); null when the app calculates it. */
  kcalTarget: number | null;
  sleep: { date: string; hours: number | null }[];
  habits: { done: number; possible: number } | null;
  /** First date (YYYY-MM-DD) the loaded logs cover; windows that start earlier are marked incomplete. */
  dataFrom: string;
}

export interface Glance {
  from: string;
  to: string;
  /** False when the loaded logs do not cover the whole window (older check-ins). */
  complete: boolean;
  weightDelta: number | null;
  waistDelta: number | null;
  /** Days between this check-in and the previous one (for the weight change). */
  daysSincePrev: number | null;
  sessions: number;
  planned: number;
  foodDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
  kcalTarget: number | null;
  /** Average intake minus target, as a percentage of the target. */
  kcalVsTargetPct: number | null;
  sleepAvg: number | null;
  sleepNights: number;
  habitPct: number | null;
}

export const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return ymdLocal(new Date(y, m - 1, d + n));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function checkinGlance(i: GlanceInput): Glance {
  const to = ymdLocal(new Date(i.submittedAt));
  const from = addDaysYmd(to, -6);
  const inWindow = (ymd: string) => ymd >= from && ymd <= to;

  const sessions = i.sessions.filter((s) => inWindow(ymdLocal(new Date(s)))).length;

  const byDay = new Map<string, { kcal: number; protein: number }>();
  for (const m of i.meals) {
    if (!inWindow(m.date)) continue;
    const d = byDay.get(m.date) ?? { kcal: 0, protein: 0 };
    d.kcal += Number(m.kcal) || 0;
    d.protein += Number(m.protein) || 0;
    byDay.set(m.date, d);
  }
  const foodDays = byDay.size;
  const avgKcal = foodDays ? Math.round([...byDay.values()].reduce((a, d) => a + d.kcal, 0) / foodDays) : null;
  const avgProtein = foodDays ? Math.round([...byDay.values()].reduce((a, d) => a + d.protein, 0) / foodDays) : null;
  const kcalVsTargetPct = avgKcal != null && i.kcalTarget ? round1(((avgKcal - i.kcalTarget) / i.kcalTarget) * 100) : null;

  const nights = i.sleep.filter((s) => inWindow(s.date) && s.hours != null && s.hours > 0);
  const sleepAvg = nights.length ? round1(nights.reduce((a, s) => a + (s.hours ?? 0), 0) / nights.length) : null;

  const weightDelta = i.weightKg != null && i.prev?.weightKg != null ? round1(Number(i.weightKg) - Number(i.prev.weightKg)) : null;
  const waistDelta = i.waistCm != null && i.prev?.waistCm != null ? round1(Number(i.waistCm) - Number(i.prev.waistCm)) : null;
  const daysSincePrev = i.prev ? Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${ymdLocal(new Date(i.prev.submittedAt))}T12:00:00`)) / 86400000) : null;

  return {
    from, to,
    complete: from >= i.dataFrom,
    weightDelta, waistDelta, daysSincePrev,
    sessions, planned: i.plannedPerWeek,
    foodDays, avgKcal, avgProtein, kcalTarget: i.kcalTarget, kcalVsTargetPct,
    sleepAvg, sleepNights: nights.length,
    habitPct: i.habits && i.habits.possible > 0 ? Math.round((i.habits.done / i.habits.possible) * 100) : null,
  };
}
