// "Week manager": turns each athlete's logged data into concrete suggestions the coach approves.
//
// Nothing here is a guess dressed up as a fact:
// - Every number comes from what the athlete logged (weigh-ins, food, sets, sleep).
// - Every suggestion carries its reason (the numbers) and the references behind it.
// - When there is not enough data, the outcome says so instead of suggesting anything.
// - Thresholds that are StartFit design choices (not study results) are marked as such below.
// Nothing is applied until the coach taps approve.

import {
  bmrMifflin, KCAL_PER_KG, rateFeedback, safetyFloorKcal, weightRate,
  type GoalMode, type RateEstimate, type RateStatus, type Sex, type WeighIn,
} from '../nutrition/engine';
import type { ExerciseMuscleMapping, MuscleRecoveryState } from '../recovery/engine';
import type { RecoveryMuscle } from '../recovery/muscles';
import { parseRepsText } from '../training/time-fit';

const DAY = 86400000;

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / DAY);
const round10 = (n: number) => Math.round(n / 10) * 10;

// ---------------------------------------------------------------------------
// Recovery map: 19 muscles folded into 8 groups a coach can scan across a roster
// ---------------------------------------------------------------------------

export type MuscleGroup = 'chest' | 'shoulders' | 'back' | 'arms' | 'core' | 'quads' | 'posterior' | 'calves';

export const MUSCLE_GROUPS: Record<MuscleGroup, RecoveryMuscle[]> = {
  chest: ['upper_chest', 'lower_chest'],
  shoulders: ['front_delts', 'side_delts', 'rear_delts'],
  back: ['lats', 'mid_back', 'traps', 'lower_back'],
  arms: ['biceps', 'triceps', 'forearms'],
  core: ['abs', 'obliques'],
  quads: ['quads', 'adductors'],
  posterior: ['glutes', 'hamstrings'],
  calves: ['calves'],
};

export interface GroupRecovery {
  group: MuscleGroup;
  status: MuscleRecoveryState['status'];
  /** Lowest recovery % among the group's trained muscles (the one that limits training it). */
  percent: number | null;
}

/** A group is as recovered as its least recovered muscle (same red < 50 % / orange < 90 % / green bands as the athlete sees). */
export function groupRecovery(states: MuscleRecoveryState[]): GroupRecovery[] {
  const by = new Map(states.map((s) => [s.muscle, s]));
  return (Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((group) => {
    const withData = MUSCLE_GROUPS[group].map((m) => by.get(m)).filter((s): s is MuscleRecoveryState => !!s && s.recoveryPercent != null);
    if (!withData.length) return { group, status: 'no_data', percent: null };
    const worst = withData.reduce((a, b) => ((b.recoveryPercent ?? 100) < (a.recoveryPercent ?? 100) ? b : a));
    return { group, status: worst.status, percent: Math.round(worst.recoveryPercent ?? 0) };
  });
}

// ---------------------------------------------------------------------------
// Nutrition: is the weight trend doing what the goal asks?
// ---------------------------------------------------------------------------

/** StartFit design rules for calorie changes. */
export const NUTRITION_RULES = {
  /** Weigh-in window for the trend. */
  windowDays: 21,
  /** Weigh-ins must cover this many days before calories are changed (rate feedback: "give it two weeks"). */
  minSpanForChange: 14,
  /** Days on the current goal before changing calories. */
  minDaysOnGoal: 14,
  /** Food-log window and minimum logged days to use logged intake as the starting point. */
  intakeWindow: 14,
  minLoggedDays: 10,
  /** A logged day under this is treated as incomplete. */
  minDayKcal: 800,
  /** One change moves calories by 100–200 kcal a day: weight trends are noisy, so changes stay small. */
  minStep: 100,
  maxStep: 200,
  /** Logged intake this far from the target means the plan is not being followed: talk first, do not change it. */
  offTargetShare: 0.15,
  /** Limits of the coach_set_targets function. */
  hardMin: 1200,
  hardMax: 6000,
} as const;

export interface NutritionInput {
  mode: GoalMode | null;
  ratePct: number | null;
  kcalOverride: number | null;
  modeStartedAt: string | null;
  weighIns: WeighIn[];
  /** Logged kcal per day (yyyy-mm-dd). */
  intakeByDate: Record<string, number>;
  today: string;
  sex: Sex | null;
  heightCm: number | null;
  age: number | null;
}

export type NutritionOutcome =
  | { status: 'no_goal' }
  | { status: 'need_weighins'; points: number; spanDays: number }
  | { status: 'too_early'; daysOnGoal: number }
  | { status: 'on_track'; rate: RateEstimate; feedback: RateStatus }
  | { status: 'wrong_direction'; rate: RateEstimate }
  | { status: 'need_food_logs'; rate: RateEstimate; feedback: RateStatus; loggedDays: number }
  | { status: 'off_target'; rate: RateEstimate; feedback: RateStatus; avgIntake: number; target: number; loggedDays: number }
  | { status: 'at_floor'; rate: RateEstimate; feedback: RateStatus; from: number; floor: number }
  | { status: 'adjust'; rate: RateEstimate; feedback: RateStatus; from: number; to: number; base: 'target' | 'intake'; loggedDays: number; targetPct: number };

const DEFAULT_RATE: Record<GoalMode, number> = { cut: 0.7, bulk: 0.25, maintain: 0, recomp: 0 };

/** Average logged intake over the window before today (today is not finished yet). */
export function averageIntake(intakeByDate: Record<string, number>, today: string, windowDays: number = NUTRITION_RULES.intakeWindow): { avg: number | null; loggedDays: number } {
  const start = addDays(today, -windowDays);
  const end = addDays(today, -1);
  const days = Object.entries(intakeByDate).filter(([d, kcal]) => d >= start && d <= end && kcal >= NUTRITION_RULES.minDayKcal).map(([, k]) => k);
  return { avg: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null, loggedDays: days.length };
}

export function nutritionOutcome(input: NutritionInput): NutritionOutcome {
  const R = NUTRITION_RULES;
  if (!input.mode) return { status: 'no_goal' };
  const rate = weightRate(input.weighIns, input.today, R.windowDays);
  if (!rate) {
    const start = addDays(input.today, -(R.windowDays - 1));
    const pts = [...new Set(input.weighIns.filter((w) => w.date >= start && w.date <= input.today).map((w) => w.date))].sort();
    return { status: 'need_weighins', points: pts.length, spanDays: pts.length > 1 ? daysBetween(pts[0], pts[pts.length - 1]) : 0 };
  }
  const targetPct = input.ratePct ?? DEFAULT_RATE[input.mode];
  const fb = rateFeedback(input.mode, targetPct, rate.pctPerWeek).status;
  if (fb === 'on_track' || fb === 'stable') return { status: 'on_track', rate, feedback: fb };
  if (fb === 'wrong_direction') return { status: 'wrong_direction', rate };

  const daysOnGoal = input.modeStartedAt ? daysBetween(input.modeStartedAt.slice(0, 10), input.today) : Number.POSITIVE_INFINITY;
  if (daysOnGoal < R.minDaysOnGoal) return { status: 'too_early', daysOnGoal };
  if (rate.spanDays < R.minSpanForChange) return { status: 'need_weighins', points: rate.points, spanDays: rate.spanDays };

  const { avg, loggedDays } = averageIntake(input.intakeByDate, input.today);
  let from: number;
  let base: 'target' | 'intake';
  if (input.kcalOverride) {
    from = input.kcalOverride;
    base = 'target';
    if (avg != null && loggedDays >= R.minLoggedDays && Math.abs(avg - from) / from > R.offTargetShare) {
      return { status: 'off_target', rate, feedback: fb, avgIntake: avg, target: from, loggedDays };
    }
  } else if (avg != null && loggedDays >= R.minLoggedDays) {
    from = round10(avg);
    base = 'intake';
  } else {
    return { status: 'need_food_logs', rate, feedback: fb, loggedDays };
  }

  // Energy gap implied by the difference between the real and the planned weekly change
  // (≈7700 kcal per kg of body weight, a standard approximation), spread over 7 days.
  const kg = [...input.weighIns].sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.kg ?? 0;
  const signedTarget = input.mode === 'cut' ? -targetPct : input.mode === 'bulk' ? targetPct : 0;
  const gapKcalPerDay = (((rate.pctPerWeek - signedTarget) / 100) * kg * KCAL_PER_KG) / 7;
  const direction = gapKcalPerDay > 0 ? -1 : 1; // gaining more than planned → eat less
  const step = Math.min(R.maxStep, Math.max(R.minStep, round10(Math.abs(gapKcalPerDay))));

  const bmr = input.heightCm && input.age && kg ? bmrMifflin(kg, input.heightCm, input.age, input.sex ?? 'unspecified') : 0;
  const floor = Math.max(R.hardMin, safetyFloorKcal(bmr, input.sex ?? 'unspecified'));
  let to = Math.min(R.hardMax, from + direction * step);
  if (direction < 0 && to < floor) {
    to = floor;
    if (to >= from) return { status: 'at_floor', rate, feedback: fb, from, floor };
  }
  return { status: 'adjust', rate, feedback: fb, from, to, base, loggedDays, targetPct };
}

// ---------------------------------------------------------------------------
// Training: planned weekly volume and load progression
// ---------------------------------------------------------------------------

export interface PlanRow {
  id: string;
  exercise_id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number | null;
  notes: string | null;
  day_index: number;
}

export interface PlanInfo {
  rows: PlanRow[];
  sessionsPerWeek: number | null;
}

/** Muscles the volume check looks at (folded where the library splits one muscle in two). */
export type VolumeTarget = 'chest' | 'lats' | 'upperBack' | 'quads' | 'hamstrings' | 'glutes' | 'sideDelts' | 'biceps' | 'triceps';

export const VOLUME_TARGETS: Record<VolumeTarget, RecoveryMuscle[]> = {
  chest: ['upper_chest', 'lower_chest'],
  lats: ['lats'],
  upperBack: ['mid_back'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes'],
  sideDelts: ['side_delts'],
  biceps: ['biceps'],
  triceps: ['triceps'],
};

/** Weekly sets per muscle at or above which hypertrophy outcomes were better in the meta-analysis (Schoenfeld 2017: ≥10 vs < 5 and 5–9). */
export const WEEKLY_SETS_TARGET = 10;

/** Plan cycles per week: a 4-day plan done 2× a week runs half a cycle a week. */
export function cyclesPerWeek(plan: PlanInfo): number {
  const days = new Set(plan.rows.map((r) => r.day_index)).size;
  if (!days) return 0;
  return plan.sessionsPerWeek && plan.sessionsPerWeek > 0 ? plan.sessionsPerWeek / days : 1;
}

/** Sets per week the plan prescribes for each muscle (direct work counts 1, helping muscles their share, as in the recovery engine). */
export function plannedWeeklySets(plan: PlanInfo, mappings: Map<string, ExerciseMuscleMapping>): Partial<Record<RecoveryMuscle, number>> {
  const perWeek = cyclesPerWeek(plan);
  const out: Partial<Record<RecoveryMuscle, number>> = {};
  for (const r of plan.rows) {
    for (const mc of mappings.get(r.exercise_id)?.muscles ?? []) {
      out[mc.muscle] = (out[mc.muscle] ?? 0) + r.sets * mc.contribution * perWeek;
    }
  }
  for (const k of Object.keys(out) as RecoveryMuscle[]) out[k] = Math.round((out[k] ?? 0) * 10) / 10;
  return out;
}

export interface AddSetProposal {
  target: VolumeTarget;
  row: PlanRow;
  toSets: number;
  plannedNow: number;
  plannedAfter: number;
}

export interface VolumeInput {
  plan: PlanInfo | null;
  mappings: Map<string, ExerciseMuscleMapping>;
  /** Finished sessions in the last 14 days. */
  sessions14d: number;
  sleep: { avgHours: number; nights: number } | null;
}

/** StartFit design rules around the volume check. */
export const VOLUME_RULES = {
  /** Only when at least 75 % of the planned sessions of the last 2 weeks were done: low volume from missed sessions is not fixed by adding sets. */
  minAdherence: 0.75,
  /** Not while sleep averages under 6 h (≥4 nights logged): more work on less sleep is the wrong lever. */
  minSleepHours: 6,
  maxSetsPerExercise: 10,
  /** At most this many set changes per athlete per week, one set each: small steps. */
  maxPerWeek: 2,
} as const;

export function volumeProposals(input: VolumeInput): { proposals: AddSetProposal[]; blocked: 'no_plan' | 'adherence' | 'sleep' | null; adherence: number | null } {
  const plan = input.plan;
  if (!plan || !plan.rows.length) return { proposals: [], blocked: 'no_plan', adherence: null };
  const days = new Set(plan.rows.map((r) => r.day_index)).size;
  const plannedPerWeek = plan.sessionsPerWeek && plan.sessionsPerWeek > 0 ? plan.sessionsPerWeek : days;
  const adherence = Math.min(1, input.sessions14d / (plannedPerWeek * 2));
  if (adherence < VOLUME_RULES.minAdherence) return { proposals: [], blocked: 'adherence', adherence };
  if (input.sleep && input.sleep.nights >= 4 && input.sleep.avgHours < VOLUME_RULES.minSleepHours) return { proposals: [], blocked: 'sleep', adherence };

  const planned = plannedWeeklySets(plan, input.mappings);
  const perWeek = cyclesPerWeek(plan);
  const used = new Set<string>();
  const candidates: AddSetProposal[] = [];
  for (const target of Object.keys(VOLUME_TARGETS) as VolumeTarget[]) {
    const muscles = VOLUME_TARGETS[target];
    const now = Math.max(...muscles.map((m) => planned[m] ?? 0));
    if (now >= WEEKLY_SETS_TARGET) continue;
    // Only muscles the plan trains directly: a plan without any calf work did that on purpose.
    const direct = plan.rows
      .filter((r) => r.sets < VOLUME_RULES.maxSetsPerExercise)
      .map((r) => ({ r, c: Math.max(0, ...(input.mappings.get(r.exercise_id)?.muscles ?? []).filter((mc) => muscles.includes(mc.muscle)).map((mc) => mc.contribution)) }))
      .filter((x) => x.c >= 1)
      .sort((a, b) => a.r.sets - b.r.sets);
    if (!direct.length) continue;
    const pick = direct[0].r;
    candidates.push({ target, row: pick, toSets: pick.sets + 1, plannedNow: now, plannedAfter: Math.round((now + perWeek) * 10) / 10 });
  }
  candidates.sort((a, b) => a.plannedNow - b.plannedNow);
  const proposals: AddSetProposal[] = [];
  for (const c of candidates) {
    if (used.has(c.row.id)) continue;
    used.add(c.row.id);
    proposals.push(c);
    if (proposals.length >= VOLUME_RULES.maxPerWeek) break;
  }
  return { proposals, blocked: null, adherence };
}

export interface LoggedSet {
  exercise_id: string;
  session_id: string;
  completed_at: string;
  set_type: string | null;
  weight: number | null;
  reps: number;
  completed: boolean;
}

export interface LoadUp {
  rowId: string;
  exercise: string;
  weight: number;
  topReps: number;
  /** +2 % and +5 % of the current load, rounded to 0.5 kg (ACSM: 2–10 %). */
  low: number;
  high: number;
}

const roundHalf = (n: number) => Math.round(n * 2) / 2;

/**
 * Double progression (StartFit rule): every working set reached the top of the rep range in each of the last
 * 2 sessions of the exercise, with the same load → time to add load. ACSM (2009) advises a 2–10 % load increase
 * once the current load is managed for more than the target reps; we suggest the lower end, 2–5 %.
 */
export function loadUps(plan: PlanInfo | null, logs: LoggedSet[]): LoadUp[] {
  if (!plan) return [];
  const out: LoadUp[] = [];
  const seen = new Set<string>();
  for (const row of plan.rows) {
    if (seen.has(row.exercise_id)) continue;
    seen.add(row.exercise_id);
    const reps = parseRepsText(row.reps);
    if (reps.timed || !/\d/.test(row.reps) || reps.repsMax <= reps.repsMin) continue;
    const work = logs.filter((l) => l.exercise_id === row.exercise_id && l.completed && l.set_type !== 'warm_up' && (l.weight ?? 0) > 0);
    const sessions = new Map<string, { at: string; sets: LoggedSet[] }>();
    for (const l of work) {
      const s = sessions.get(l.session_id) ?? { at: l.completed_at, sets: [] };
      s.sets.push(l);
      sessions.set(l.session_id, s);
    }
    const last2 = [...sessions.values()].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 2);
    if (last2.length < 2) continue;
    const top = last2.map((s) => Math.max(...s.sets.map((x) => x.weight ?? 0)));
    if (top[0] !== top[1]) continue;
    // Every set at the working load reached the top of the range, in both sessions.
    const ok = last2.every((s) => {
      const atLoad = s.sets.filter((x) => x.weight === top[0]);
      return atLoad.length >= 1 && atLoad.every((x) => x.reps >= reps.repsMax);
    });
    if (!ok) continue;
    const weight = top[0];
    const low = Math.max(weight + 0.5, roundHalf(weight * 1.02));
    const high = Math.max(low, roundHalf(weight * 1.05));
    out.push({ rowId: row.id, exercise: row.name, weight, topReps: reps.repsMax, low, high });
  }
  return out.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

/** Adults are advised 7 h or more a night (Watson 2015, AASM/SRS consensus). Needs ≥ 4 logged nights in the last 7 days. */
export const SLEEP_RULES = { advisedHours: 7, minNights: 4 } as const;

/** Average sleep over the last 7 nights (today and the 6 days before it). */
export function sleepSummary(nights: { date: string; hours: number }[], today: string): { avgHours: number; nights: number } | null {
  const start = addDays(today, -6);
  const recent = nights.filter((n) => n.date >= start && n.date <= today && n.hours > 0);
  if (recent.length < SLEEP_RULES.minNights) return null;
  return { avgHours: Math.round((recent.reduce((a, n) => a + n.hours, 0) / recent.length) * 10) / 10, nights: recent.length };
}

// ---------------------------------------------------------------------------
// One athlete's week
// ---------------------------------------------------------------------------

export type MessageTopic =
  | { topic: 'load_up'; items: LoadUp[] }
  | { topic: 'sleep'; avgHours: number; nights: number }
  | { topic: 'weigh_in'; points: number }
  | { topic: 'log_food' }
  | { topic: 'logging_check'; kgPerWeek: number }
  | { topic: 'off_target'; avgIntake: number; target: number }
  | { topic: 'reengage'; days: number }
  | { topic: 'food_gap'; days: number };

export type Proposal =
  | { id: string; kind: 'kcal'; from: number; to: number; mode: GoalMode; rate: number; proteinPerKg: number | null; outcome: Extract<NutritionOutcome, { status: 'adjust' }>; refs: string[] }
  | { id: string; kind: 'add_set'; add: AddSetProposal; refs: string[] }
  | { id: string; kind: 'message'; message: MessageTopic; refs: string[] };

export interface WeekInput {
  athleteId: string;
  nutrition: NutritionInput & { proteinPerKg: number | null };
  volume: VolumeInput;
  logs: LoggedSet[];
  sleepNights: { date: string; hours: number }[];
  /** From the roster signals: days without a workout (≥ 5) or without food logs (≥ 3), else null. */
  noWorkoutDays: number | null;
  noFoodDays: number | null;
}

export interface AthleteWeek {
  athleteId: string;
  nutrition: NutritionOutcome;
  volumeBlocked: 'no_plan' | 'adherence' | 'sleep' | null;
  adherence: number | null;
  sleep: { avgHours: number; nights: number } | null;
  proposals: Proposal[];
}

export function buildAthleteWeek(input: WeekInput): AthleteWeek {
  const id = (s: string) => `${input.athleteId}:${s}`;
  const proposals: Proposal[] = [];

  const n = nutritionOutcome(input.nutrition);
  const mode = input.nutrition.mode;
  const nutritionRefs = mode === 'bulk' ? ['iraki2019'] : ['ruiz2021', 'helms2014'];
  if (n.status === 'adjust' && mode) {
    proposals.push({ id: id('kcal'), kind: 'kcal', from: n.from, to: n.to, mode, rate: input.nutrition.ratePct ?? DEFAULT_RATE[mode], proteinPerKg: input.nutrition.proteinPerKg, outcome: n, refs: nutritionRefs });
  } else if (n.status === 'wrong_direction') {
    proposals.push({ id: id('logging'), kind: 'message', message: { topic: 'logging_check', kgPerWeek: n.rate.kgPerWeek }, refs: [] });
  } else if (n.status === 'off_target') {
    proposals.push({ id: id('offtarget'), kind: 'message', message: { topic: 'off_target', avgIntake: n.avgIntake, target: n.target }, refs: [] });
  } else if (n.status === 'need_food_logs') {
    proposals.push({ id: id('logfood'), kind: 'message', message: { topic: 'log_food' }, refs: [] });
  } else if (n.status === 'need_weighins' && (mode === 'cut' || mode === 'bulk')) {
    proposals.push({ id: id('weigh'), kind: 'message', message: { topic: 'weigh_in', points: n.points }, refs: [] });
  }

  const sleep = sleepSummary(input.sleepNights, input.nutrition.today);
  const vol = volumeProposals({ ...input.volume, sleep });
  for (const add of vol.proposals) proposals.push({ id: id(`set:${add.row.id}`), kind: 'add_set', add, refs: ['schoenfeld2017vol', 'pelland2026'] });

  const ups = loadUps(input.volume.plan, input.logs);
  if (ups.length) proposals.push({ id: id('loadup'), kind: 'message', message: { topic: 'load_up', items: ups }, refs: ['acsm2009', 'plotkin2022'] });

  if (sleep && sleep.avgHours < SLEEP_RULES.advisedHours) {
    proposals.push({ id: id('sleep'), kind: 'message', message: { topic: 'sleep', avgHours: sleep.avgHours, nights: sleep.nights }, refs: ['watson2015', 'knowles2018'] });
  }

  if (input.noWorkoutDays != null) proposals.push({ id: id('reengage'), kind: 'message', message: { topic: 'reengage', days: input.noWorkoutDays }, refs: [] });
  else if (input.noFoodDays != null && n.status !== 'need_food_logs') proposals.push({ id: id('foodgap'), kind: 'message', message: { topic: 'food_gap', days: input.noFoodDays }, refs: [] });

  return { athleteId: input.athleteId, nutrition: n, volumeBlocked: vol.blocked, adherence: vol.adherence, sleep, proposals };
}
