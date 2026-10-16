// What a coach needs to see first. Pure functions over the roster the database returns (coach_roster()).
//
// The risk rules below are StartFit design rules, not study results: they turn the warning signs coaching
// guides describe (gaps in training, logging stopping, missed check-ins, falling consistency) into a score
// the coach can sort by. Every flag carries its reason, so the coach always sees why.

export interface RosterRow {
  athlete_id: string;
  display_name: string | null;
  avatar_url: string | null;
  joined_at: string;
  fitness_goal: string | null;
  experience_level: string | null;
  age: number | null;
  height_cm: number | null;
  profile_weight_kg: number | null;
  limitations: string | null;
  last_workout_at: string | null;
  workouts_7d: number;
  workouts_28d: number;
  food_days_7d: number;
  last_food_date: string | null;
  kcal_today: number;
  protein_today: number;
  goal_mode: string | null;
  rate_pct: number | null;
  kcal_override: number | null;
  unread: number;
  pending_checkins: number;
  last_checkin_at: string | null;
}

export type RiskLevel = 'ok' | 'watch' | 'at_risk';

export type Reason =
  | { code: 'no_workout'; days: number }
  | { code: 'never_trained'; days: number }
  | { code: 'no_food'; days: number }
  | { code: 'checkin_overdue'; days: number }
  | { code: 'low_consistency'; sessions: number };

export interface Signals {
  level: RiskLevel;
  score: number;
  reasons: Reason[];
  /** Days since the last finished workout (null if never). */
  daysSinceWorkout: number | null;
  /** Share of the last 7 days with food logged (0–1). */
  foodConsistency: number;
  /** Sessions in the last 7 days against the sessions planned per week (0–1, capped). */
  trainingConsistency: number;
}

const DAY = 86400000;

export function daysBetween(fromIso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY));
}

/** StartFit rule thresholds. */
export const RULES = {
  noWorkoutWatch: 5,
  noWorkoutRisk: 10,
  noFoodDays: 3,
  checkinDueDays: 9,
  minSessions28d: 4,
  newAthleteDays: 3,
} as const;

export function athleteSignals(row: RosterRow, now: Date, plannedPerWeek = 3): Signals {
  const reasons: Reason[] = [];
  let score = 0;
  const memberDays = daysBetween(row.joined_at, now);

  const daysSinceWorkout = row.last_workout_at ? daysBetween(row.last_workout_at, now) : null;
  if (daysSinceWorkout == null) {
    if (memberDays >= RULES.noWorkoutWatch) {
      reasons.push({ code: 'never_trained', days: memberDays });
      score += memberDays >= RULES.noWorkoutRisk ? 50 : 35;
    }
  } else if (daysSinceWorkout >= RULES.noWorkoutWatch) {
    reasons.push({ code: 'no_workout', days: daysSinceWorkout });
    score += daysSinceWorkout >= RULES.noWorkoutRisk ? 50 : 35;
  }

  // Logging stopped (only flagged for people who logged before: some coaches do not use food tracking).
  if (row.last_food_date) {
    const foodGap = daysBetween(`${row.last_food_date}T12:00:00`, now);
    if (foodGap >= RULES.noFoodDays) {
      reasons.push({ code: 'no_food', days: foodGap });
      score += 20;
    }
  }

  const sinceCheckin = row.last_checkin_at ? daysBetween(row.last_checkin_at, now) : memberDays;
  if (sinceCheckin >= RULES.checkinDueDays && memberDays >= RULES.checkinDueDays) {
    reasons.push({ code: 'checkin_overdue', days: sinceCheckin });
    score += 15;
  }

  if (memberDays >= 28 && row.workouts_28d < RULES.minSessions28d) {
    reasons.push({ code: 'low_consistency', sessions: row.workouts_28d });
    score += 15;
  }

  score = Math.min(100, score);
  const level: RiskLevel = score >= 50 ? 'at_risk' : score >= 25 ? 'watch' : 'ok';
  return {
    level,
    score,
    reasons,
    daysSinceWorkout,
    foodConsistency: Math.min(1, row.food_days_7d / 7),
    trainingConsistency: plannedPerWeek > 0 ? Math.min(1, row.workouts_7d / plannedPerWeek) : 0,
  };
}

export type TriageKind = 'message' | 'checkin' | 'at_risk' | 'new';

export interface TriageItem {
  kind: TriageKind;
  athleteId: string;
  name: string;
  count?: number;
  reasons?: Reason[];
}

const ORDER: Record<TriageKind, number> = { message: 0, checkin: 1, at_risk: 2, new: 3 };

/** The "needs you today" list: unread messages, check-ins to review, athletes at risk, new joiners. */
export function triage(rows: RosterRow[], now: Date): TriageItem[] {
  const items: TriageItem[] = [];
  for (const r of rows) {
    const name = r.display_name?.trim() || '—';
    if (r.unread > 0) items.push({ kind: 'message', athleteId: r.athlete_id, name, count: r.unread });
    if (r.pending_checkins > 0) items.push({ kind: 'checkin', athleteId: r.athlete_id, name, count: r.pending_checkins });
    const s = athleteSignals(r, now);
    if (s.level === 'at_risk') items.push({ kind: 'at_risk', athleteId: r.athlete_id, name, reasons: s.reasons });
    if (daysBetween(r.joined_at, now) < RULES.newAthleteDays) items.push({ kind: 'new', athleteId: r.athlete_id, name });
  }
  return items.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.name.localeCompare(b.name));
}

export interface RosterSummary {
  athletes: number;
  atRisk: number;
  watch: number;
  pendingCheckins: number;
  unread: number;
  /** Average share of planned sessions done in the last 7 days (0–1). */
  avgTraining: number;
  /** Average share of the last 7 days with food logged (0–1). */
  avgFood: number;
}

export function summarize(rows: RosterRow[], now: Date): RosterSummary {
  let atRisk = 0;
  let watch = 0;
  let t = 0;
  let f = 0;
  for (const r of rows) {
    const s = athleteSignals(r, now);
    if (s.level === 'at_risk') atRisk++;
    else if (s.level === 'watch') watch++;
    t += s.trainingConsistency;
    f += s.foodConsistency;
  }
  const n = rows.length || 1;
  return {
    athletes: rows.length,
    atRisk,
    watch,
    pendingCheckins: rows.reduce((a, r) => a + r.pending_checkins, 0),
    unread: rows.reduce((a, r) => a + r.unread, 0),
    avgTraining: rows.length ? t / n : 0,
    avgFood: rows.length ? f / n : 0,
  };
}

/** Athletes a coach plan allows (mirrors coach_tier_limit() in the database). */
export const COACH_LIMITS = { free: 8, coach: 25, coach_pro: 60, studio: 150 } as const;
export type CoachTier = keyof typeof COACH_LIMITS;

export function coachTierNow(tier: string | null | undefined, periodEnd: string | null | undefined, now = new Date()): CoachTier {
  if (tier === 'coach' || tier === 'coach_pro' || tier === 'studio') {
    if (!periodEnd || new Date(periodEnd).getTime() > now.getTime()) return tier;
  }
  return 'free';
}

/** The Monday-to-Sunday week a check-in belongs to (date of its Monday, local time). */
export function weekOf(d: Date): string {
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${monday.getFullYear()}-${m}-${dd}`;
}

/** A shareable join link (opens the app with the code filled in). */
export function joinLink(origin: string, code: string): string {
  return `${origin}/#/join/${encodeURIComponent(code)}`;
}

/** Codes look like SF-7K2QXM; people type them in many ways. */
export function normalizeCode(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = s.startsWith('SF') ? s.slice(2) : s;
  return `SF-${body}`;
}
