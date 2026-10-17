// Habit strength and if-then plans.
//
// SRBAI: Gardner B, Abraham C, Lally P, de Bruijn GJ. Towards parsimony in habit measurement. Int J Behav Nutr Phys
// Act 2012;9:102 (doi:10.1186/1479-5868-9-102). Four items, each completing "Behaviour X is something...":
// "I do automatically", "I do without having to consciously remember", "I do without thinking",
// "I start doing before I realise I'm doing it", rated 1-7. We show the mean (1-7) and its change; there is no
// validated cut-off for "a habit is formed", so we never claim one.
// Time course: Lally P et al. How are habits formed. Eur J Soc Psychol 2010;40(6):998-1009: median 66 days to
// reach 95 % of the modelled plateau (range 18-254 days, 39 of 96 participants), and missing one day did not
// materially disrupt the process. So a single missed day never resets anything here.
//
// If-then plans (implementation intentions): Gollwitzer PM, Sheeran P. Adv Exp Soc Psychol 2006;38:69-119 (94 studies,
// d = 0.65 on goal attainment). For physical activity: Bélanger-Gravel A, Godin G, Amireault S. Health Psychol Rev
// 2013;7(1):23-54 (26 studies, d = 0.31 after the intervention, 0.24 at follow-up), larger when the plan covers barriers.

export const SRBAI_ITEMS = ['automatic', 'no_remember', 'no_thinking', 'before_realise'] as const;

export function srbaiScore(items: readonly number[]): number | null {
  if (items.length !== 4 || items.some((n) => !Number.isInteger(n) || n < 1 || n > 7)) return null;
  return Math.round((items.reduce((a, b) => a + b, 0) / 4) * 100) / 100;
}

export interface HabitRating { habit_id: string; rated_on: string; items: number[] }

/** Ratings of one habit, oldest first, with the change since the first rating. */
export function habitTrend(ratings: HabitRating[], habitId: string): { points: { date: string; score: number }[]; change: number | null } {
  const points = ratings
    .filter((r) => r.habit_id === habitId)
    .map((r) => ({ date: r.rated_on, score: srbaiScore(r.items) }))
    .filter((p): p is { date: string; score: number } => p.score != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { points, change: points.length >= 2 ? Math.round((points[points.length - 1].score - points[0].score) * 100) / 100 : null };
}

/** A rating is due every 14 days (StartFit rule; the SRBAI has no fixed schedule). */
export const RATING_EVERY_DAYS = 14;

export function ratingDue(lastRatedOn: string | null, today: string, habitCreatedAt: string): boolean {
  const [y, m, d] = today.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const since = (ymd: string) => { const [a, b, c] = ymd.split('-').map(Number); return Math.round((t - Date.UTC(a, b - 1, c)) / 86400000); };
  if (!lastRatedOn) return since(habitCreatedAt.slice(0, 10)) >= 7;
  return since(lastRatedOn) >= RATING_EVERY_DAYS;
}

/** Days a habit was done in the last 14, with misses counted but never resetting anything (Lally 2010). */
export function consistency(doneDays: string[], today: string, windowDays = 14): { done: number; of: number } {
  const [y, m, d] = today.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const n = new Set(doneDays.filter((x) => { const [a, b, c] = x.split('-').map(Number); const k = Math.round((t - Date.UTC(a, b - 1, c)) / 86400000); return k >= 0 && k < windowDays; })).size;
  return { done: n, of: windowDays };
}

export type PlanKind = 'when' | 'if';
export interface IfThenPlan { kind: PlanKind; cue: string; action: string }

/** Up to 5 plans, each part 3 to 200 characters. "when" = when/where I will train; "if" = an obstacle and my response. */
export function cleanPlans(list: readonly IfThenPlan[]): IfThenPlan[] {
  return list
    .map((p) => ({ kind: p.kind === 'if' ? 'if' as const : 'when' as const, cue: p.cue.replace(/\s+/g, ' ').trim().slice(0, 200), action: p.action.replace(/\s+/g, ' ').trim().slice(0, 200) }))
    .filter((p) => p.cue.length >= 3 && p.action.length >= 3)
    .slice(0, 5);
}
