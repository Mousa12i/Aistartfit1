// Deterministic nutrition maths. The AI coach explains and personalises, but
// every number shown in the app comes from these functions so it is
// reproducible and testable. Evidence for each rule is listed in evidence.ts.

import type { ActivityLevel, ExperienceLevel, Profile } from '@/lib/types';
import { addDays, daysBetween } from './dates';

export type GoalMode = 'cut' | 'maintain' | 'bulk' | 'recomp';
export type Sex = 'male' | 'female' | 'unspecified';

export const GOAL_LABELS: Record<GoalMode, string> = {
  cut: 'Fat loss',
  maintain: 'Maintain',
  bulk: 'Lean gain',
  recomp: 'Recomposition',
};

/** Standard physical-activity multipliers applied to resting energy expenditure. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly active',
  moderate: 'Moderately active',
  active: 'Very active',
  very_active: 'Extremely active',
};

/** Approximate energy in 1 kg of body-weight change (mostly fat tissue). */
export const KCAL_PER_KG = 7700;

/** Weekly change as % of body weight. Cut: 0.5–1 %/wk (Ruiz-Castellano 2021); gain: 0.25–0.5 %/wk (Iraki 2019). */
export const RATE_RANGES: Record<GoalMode, { min: number; max: number; step: number }> = {
  cut: { min: 0.25, max: 1, step: 0.05 },
  bulk: { min: 0.1, max: 0.5, step: 0.05 },
  maintain: { min: 0, max: 0, step: 0.05 },
  recomp: { min: 0, max: 0, step: 0.05 },
};

/** Protein in g per kg body weight (Morton 2018; Jäger 2017; Helms 2014; Ruiz-Castellano 2021; Iraki 2019). */
export const PROTEIN_RANGES: Record<GoalMode, { min: number; max: number; default: number }> = {
  cut: { min: 1.8, max: 3, default: 2.2 },
  maintain: { min: 1.4, max: 2.2, default: 1.8 },
  bulk: { min: 1.6, max: 2.2, default: 1.8 },
  recomp: { min: 1.6, max: 2.6, default: 2.2 },
};

/** Fat as % of energy: Acceptable Macronutrient Distribution Range for adults (IOM 2005). */
export const FAT_PCT_RANGE = { min: 20, max: 35, default: 25 };

/** Largest deficit / surplus the app will plan, as a share of maintenance (app safety rule). */
export const MAX_DEFICIT_SHARE = 0.25;
export const MAX_SURPLUS_SHARE = 0.15;

export interface BodyStats {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activity: ActivityLevel;
  experience: ExperienceLevel | null;
  bodyFatPct: number | null;
}

export interface PlanSettings {
  mode: GoalMode;
  ratePct: number;
  proteinPerKg: number | null;
  fatPct: number | null;
  mealsPerDay: number;
  carbShift: boolean;
  kcalOverride: number | null;
  adaptiveTdee: number | null;
  dietBreakUntil: string | null;
}

export interface TargetContext {
  today: string;
  /** The date the targets are for. */
  date: string;
  trainingDay: boolean;
  trainingDaysPerWeek: number;
  /** Under 18 or pregnant: no deficit. */
  noDeficit: boolean;
  /** Positive eating-habits screen: no weight-change goals at all. */
  noWeightGoals: boolean;
}

export interface TargetNote {
  kind: 'info' | 'warning';
  text: string;
}

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
  satFatMax: number;
  freeSugarMax: number;
  sodiumMax: number;
  bmr: number;
  maintenance: number;
  maintenanceSource: 'formula' | 'adaptive';
  dailyDelta: number;
  expectedWeeklyChangeKg: number;
  /** The mode actually applied (can differ from the chosen one during a break or a safety restriction). */
  mode: GoalMode;
  proteinPerKg: number;
  proteinRefWeightKg: number;
  proteinPerMeal: { target: number; low: number; high: number };
  fatPct: number;
  carbShiftKcal: number;
  floorKcal: number;
  notes: TargetNote[];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const round10 = (v: number) => Math.round(v / 10) * 10;

/** Mifflin–St Jeor resting energy expenditure (Mifflin 1990). */
export function bmrMifflin(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  // Sex not given: midpoint of the two published constants.
  return base - 78;
}

export function safetyFloorKcal(bmr: number, sex: Sex): number {
  const sexFloor = sex === 'female' ? 1200 : sex === 'male' ? 1500 : 1350;
  return round10(Math.max(bmr, sexFloor));
}

export function defaultRate(mode: GoalMode, experience: ExperienceLevel | null): number {
  if (mode === 'cut') return 0.7;
  if (mode === 'bulk') {
    if (experience === 'advanced') return 0.15;
    if (experience === 'intermediate') return 0.25;
    return 0.35;
  }
  return 0;
}

export function bodyStatsFromProfile(
  profile: Profile | null,
  sex: Sex | null,
  latestWeightKg?: number | null,
): { stats: BodyStats; missing: string[] } {
  const missing: string[] = [];
  let weightKg = latestWeightKg ?? profile?.weight_kg ?? null;
  if (!weightKg || weightKg <= 0) {
    missing.push('weight');
    weightKg = 70;
  }
  let heightCm = profile?.height_cm ?? null;
  if (!heightCm || heightCm <= 0) {
    missing.push('height');
    heightCm = 170;
  }
  let age = profile?.age ?? null;
  if (!age || age <= 0) {
    missing.push('age');
    age = 30;
  }
  let activity = profile?.activity_level ?? null;
  if (!activity) {
    missing.push('activity');
    activity = 'light';
  }
  return {
    stats: {
      weightKg,
      heightCm,
      age,
      sex: sex ?? 'unspecified',
      activity,
      experience: profile?.experience_level ?? null,
      bodyFatPct: profile?.body_fat_pct ?? null,
    },
    missing,
  };
}

export function formulaMaintenance(stats: BodyStats): { bmr: number; tdee: number } {
  const bmr = bmrMifflin(stats.weightKg, stats.heightCm, stats.age, stats.sex);
  return { bmr, tdee: bmr * ACTIVITY_FACTORS[stats.activity] };
}

/** Body mass index. */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function computeTargets(stats: BodyStats, settings: PlanSettings, ctx: TargetContext): Targets {
  const notes: TargetNote[] = [];
  const { bmr, tdee } = formulaMaintenance(stats);
  const adaptive = settings.adaptiveTdee != null && settings.adaptiveTdee > 0 ? settings.adaptiveTdee : null;
  const maintenance = adaptive ?? tdee;

  let mode: GoalMode = settings.mode;
  if (ctx.noWeightGoals && mode !== 'maintain') {
    mode = 'maintain';
    notes.push({ kind: 'warning', text: 'Weight-change goals are paused based on your check-in. Targets are set to maintenance.' });
  } else if (ctx.noDeficit && mode === 'cut') {
    mode = 'maintain';
    notes.push({ kind: 'warning', text: 'A calorie deficit is not planned for under-18s or during pregnancy. Targets are set to maintenance.' });
  }
  if (mode === 'cut' && settings.dietBreakUntil && settings.dietBreakUntil >= ctx.date) {
    mode = 'maintain';
    notes.push({ kind: 'info', text: `Maintenance break until ${settings.dietBreakUntil}. Your fat-loss targets resume afterwards.` });
  }

  const weight = stats.weightKg;
  let delta = 0;
  if (mode === 'cut' || mode === 'bulk') {
    const range = RATE_RANGES[mode];
    const rate = clamp(settings.ratePct || defaultRate(mode, stats.experience), range.min, range.max);
    const weeklyKg = (weight * rate) / 100;
    delta = (weeklyKg * KCAL_PER_KG) / 7;
    if (mode === 'cut') {
      delta = -delta;
      if (-delta > maintenance * MAX_DEFICIT_SHARE) {
        delta = -maintenance * MAX_DEFICIT_SHARE;
        notes.push({ kind: 'warning', text: 'Your chosen rate needs a very large deficit, so it was capped at 25% below maintenance.' });
      }
    } else if (delta > maintenance * MAX_SURPLUS_SHARE) {
      delta = maintenance * MAX_SURPLUS_SHARE;
      notes.push({ kind: 'info', text: 'Surplus capped at 15% above maintenance — bigger surpluses mostly add fat.' });
    }
  }

  let kcal = maintenance + delta;
  if (settings.kcalOverride != null && settings.kcalOverride > 0 && !ctx.noWeightGoals) {
    kcal = settings.kcalOverride;
    notes.push({ kind: 'info', text: 'Using the calorie target you set yourself.' });
  }

  const floorKcal = safetyFloorKcal(bmr, stats.sex);
  if (kcal < floorKcal) {
    kcal = floorKcal;
    notes.push({ kind: 'warning', text: `Raised to the app's safety floor (${floorKcal} kcal). Going lower should only happen with a clinician.` });
  }
  kcal = round10(kcal);

  // Protein: per kg of body weight; above BMI 30 a reference weight (BMI 25) avoids overshooting.
  const pRange = PROTEIN_RANGES[mode];
  const proteinPerKg = clamp(settings.proteinPerKg ?? pRange.default, pRange.min, pRange.max);
  const heightM = stats.heightCm / 100;
  const currentBmi = bmi(weight, stats.heightCm);
  const proteinRefWeightKg = currentBmi > 30 ? 25 * heightM * heightM : weight;
  if (currentBmi > 30) {
    notes.push({ kind: 'info', text: 'Protein is calculated from a reference weight (BMI 25 for your height) so it is not overestimated.' });
  }
  let protein = Math.round(proteinPerKg * proteinRefWeightKg);

  let fatPct = clamp(settings.fatPct ?? FAT_PCT_RANGE.default, FAT_PCT_RANGE.min, FAT_PCT_RANGE.max);
  let fat = Math.round((kcal * fatPct) / 100 / 9);
  let carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
  if (carbs < 0) {
    fatPct = FAT_PCT_RANGE.min;
    fat = Math.round((kcal * fatPct) / 100 / 9);
    carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
    if (carbs < 0) {
      protein = Math.max(0, Math.round((kcal - fat * 9) / 4));
      carbs = 0;
      notes.push({ kind: 'warning', text: 'Your calories are too low for the chosen protein and fat, so protein was reduced to fit.' });
    }
  }

  // Optional: move carbohydrate from rest days to training days; the weekly total stays the same.
  let carbShiftKcal = 0;
  const n = Math.round(ctx.trainingDaysPerWeek);
  if (settings.carbShift && n >= 1 && n <= 6 && carbs > 0) {
    const shiftG = Math.round(carbs * 0.15);
    if (ctx.trainingDay) {
      carbs += shiftG;
      carbShiftKcal = shiftG * 4;
    } else {
      const restCut = Math.round((shiftG * n) / (7 - n));
      const applied = Math.min(restCut, carbs);
      carbs -= applied;
      carbShiftKcal = -applied * 4;
    }
    kcal += carbShiftKcal;
  }

  const meals = clamp(Math.round(settings.mealsPerDay || 4), 2, 6);
  const fiber = Math.round((kcal / 1000) * 14);
  const waterMl = Math.round((weight * 35) / 100) * 100;

  return {
    kcal,
    protein,
    carbs,
    fat,
    fiber,
    waterMl,
    satFatMax: Math.round((kcal * 0.1) / 9),
    freeSugarMax: Math.round((kcal * 0.1) / 4),
    sodiumMax: 2300,
    bmr: Math.round(bmr),
    maintenance: round10(maintenance),
    maintenanceSource: adaptive ? 'adaptive' : 'formula',
    dailyDelta: Math.round(kcal - maintenance),
    expectedWeeklyChangeKg: Math.round((((kcal - carbShiftKcal - maintenance) * 7) / KCAL_PER_KG) * 100) / 100,
    mode,
    proteinPerKg,
    proteinRefWeightKg: Math.round(proteinRefWeightKg * 10) / 10,
    proteinPerMeal: {
      target: Math.round(protein / meals),
      low: Math.round(0.4 * proteinRefWeightKg),
      high: Math.round(0.55 * proteinRefWeightKg),
    },
    fatPct,
    carbShiftKcal,
    floorKcal,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Weight trend
// ---------------------------------------------------------------------------

export interface WeighIn {
  date: string;
  kg: number;
}

export interface TrendPoint extends WeighIn {
  trend: number;
}

/** Average same-day readings and sort by date. */
export function dailyWeights(weighIns: WeighIn[]): WeighIn[] {
  const byDate = new Map<string, number[]>();
  for (const w of weighIns) {
    if (!Number.isFinite(w.kg) || w.kg <= 0) continue;
    const list = byDate.get(w.date) ?? [];
    list.push(w.kg);
    byDate.set(w.date, list);
  }
  return [...byDate.entries()]
    .map(([date, list]) => ({ date, kg: list.reduce((a, b) => a + b, 0) / list.length }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Exponentially smoothed trend weight. Gaps between weigh-ins are handled by
 * compounding the daily smoothing factor over the number of days elapsed.
 */
export function computeTrend(weighIns: WeighIn[], alpha = 0.1): TrendPoint[] {
  const days = dailyWeights(weighIns);
  const out: TrendPoint[] = [];
  let prev: TrendPoint | null = null;
  for (const d of days) {
    if (!prev) {
      prev = { ...d, trend: d.kg };
    } else {
      const gap = Math.max(1, daysBetween(prev.date, d.date));
      const a = 1 - Math.pow(1 - alpha, gap);
      prev = { ...d, trend: prev.trend + a * (d.kg - prev.trend) };
    }
    out.push({ ...prev, trend: Math.round(prev.trend * 100) / 100 });
  }
  return out;
}

/** Least-squares slope of weight against day number. */
function slopePerDay(points: WeighIn[], originKey: string): number | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => daysBetween(originKey, p.date));
  const ys = points.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

export interface RateEstimate {
  kgPerWeek: number;
  pctPerWeek: number;
  points: number;
  spanDays: number;
}

/** Rate of change over the last `windowDays`, from at least 4 weigh-ins spanning a week or more. */
export function weightRate(weighIns: WeighIn[], asOf: string, windowDays = 14): RateEstimate | null {
  const start = addDays(asOf, -(windowDays - 1));
  const points = dailyWeights(weighIns).filter((p) => p.date >= start && p.date <= asOf);
  if (points.length < 4) return null;
  const spanDays = daysBetween(points[0].date, points[points.length - 1].date);
  if (spanDays < 7) return null;
  const slope = slopePerDay(points, start);
  if (slope == null) return null;
  const meanKg = points.reduce((a, p) => a + p.kg, 0) / points.length;
  const kgPerWeek = slope * 7;
  return {
    kgPerWeek: Math.round(kgPerWeek * 100) / 100,
    pctPerWeek: Math.round((kgPerWeek / meanKg) * 10000) / 100,
    points: points.length,
    spanDays,
  };
}

export type RateStatus = 'on_track' | 'too_fast' | 'too_slow' | 'wrong_direction' | 'stable' | 'drifting';

export function rateFeedback(mode: GoalMode, targetPct: number, pctPerWeek: number): { status: RateStatus; message: string } {
  if (mode === 'cut') {
    const loss = -pctPerWeek;
    if (loss < -0.1) return { status: 'wrong_direction', message: 'Your trend is going up while the goal is fat loss. Check logging accuracy before cutting calories further.' };
    if (loss > 1) return { status: 'too_fast', message: 'You are losing more than 1% of body weight a week. Faster loss raises the risk of losing muscle — consider eating a little more.' };
    if (loss < Math.max(0.2, targetPct - 0.35)) return { status: 'too_slow', message: 'Loss is slower than planned. Give it two weeks of consistent logging before adjusting.' };
    return { status: 'on_track', message: 'Your rate of loss is inside the evidence-based range (0.5–1% per week).' };
  }
  if (mode === 'bulk') {
    if (pctPerWeek < -0.1) return { status: 'wrong_direction', message: 'Your trend is going down while the goal is lean gain. You probably need more food.' };
    if (pctPerWeek > 0.5) return { status: 'too_fast', message: 'Gaining faster than 0.5% a week mostly adds fat, not muscle. Consider a smaller surplus.' };
    if (pctPerWeek < Math.max(0.05, targetPct - 0.2)) return { status: 'too_slow', message: 'Gain is slower than planned. A small increase (100–150 kcal) is usually enough.' };
    return { status: 'on_track', message: 'Your rate of gain is inside the recommended range.' };
  }
  if (Math.abs(pctPerWeek) <= 0.25) return { status: 'stable', message: 'Your weight is stable — right where maintenance should be.' };
  return { status: 'drifting', message: `Your weight is drifting ${pctPerWeek > 0 ? 'up' : 'down'}. A small adjustment can bring it back to stable.` };
}

// ---------------------------------------------------------------------------
// Adaptive maintenance estimate (energy balance from logged intake + trend)
// ---------------------------------------------------------------------------

export interface AdaptiveInput {
  intakeByDate: Record<string, number>;
  weighIns: WeighIn[];
  today: string;
  bmr: number;
  currentTarget: number;
  windowDays?: number;
}

export type AdaptiveResult =
  | {
      ok: true;
      tdee: number;
      avgIntake: number;
      loggedDays: number;
      weighInCount: number;
      kgPerWeek: number;
      windowDays: number;
      confidence: 'medium' | 'high';
    }
  | { ok: false; reason: string; loggedDays: number; weighInCount: number; windowDays: number };

/**
 * Estimates real maintenance calories: average logged intake minus the energy
 * implied by the weight trend (≈7700 kcal per kg). Days with very low logged
 * intake (< 40% of target) are treated as incomplete and excluded.
 */
export function estimateAdaptiveTdee(input: AdaptiveInput): AdaptiveResult {
  const windowDays = input.windowDays ?? 21;
  const end = addDays(input.today, -1);
  const start = addDays(end, -(windowDays - 1));
  const minIntake = input.currentTarget * 0.4;

  const intakes: number[] = [];
  for (const [date, kcal] of Object.entries(input.intakeByDate)) {
    if (date < start || date > end) continue;
    if (kcal >= minIntake) intakes.push(kcal);
  }
  const weights = dailyWeights(input.weighIns).filter((w) => w.date >= start && w.date <= end);
  const loggedDays = intakes.length;
  const weighInCount = weights.length;
  const minLogged = Math.ceil(windowDays * 0.66);

  if (loggedDays < minLogged) {
    return { ok: false, reason: `Log your food on at least ${minLogged} of the last ${windowDays} days.`, loggedDays, weighInCount, windowDays };
  }
  if (weighInCount < 6) {
    return { ok: false, reason: 'Weigh in at least 6 times across the last 3 weeks.', loggedDays, weighInCount, windowDays };
  }
  const span = daysBetween(weights[0].date, weights[weights.length - 1].date);
  if (span < 14) {
    return { ok: false, reason: 'Weigh-ins need to cover at least two weeks.', loggedDays, weighInCount, windowDays };
  }
  const slope = slopePerDay(weights, start);
  if (slope == null) return { ok: false, reason: 'Not enough weight data.', loggedDays, weighInCount, windowDays };

  const avgIntake = intakes.reduce((a, b) => a + b, 0) / intakes.length;
  const tdee = avgIntake - slope * KCAL_PER_KG;
  if (tdee < input.bmr * 1.05 || tdee > input.bmr * 2.6) {
    return {
      ok: false,
      reason: 'The estimate came out outside a realistic range — this usually means some food was not logged. Keep logging and it will settle.',
      loggedDays,
      weighInCount,
      windowDays,
    };
  }
  return {
    ok: true,
    tdee: round10(tdee),
    avgIntake: Math.round(avgIntake),
    loggedDays,
    weighInCount,
    kgPerWeek: Math.round(slope * 7 * 100) / 100,
    windowDays,
    confidence: loggedDays >= windowDays - 2 && weighInCount >= 12 ? 'high' : 'medium',
  };
}

/** Move gradually: at most ±250 kcal per check-in. */
export function stepTowards(current: number, proposed: number, maxStep = 250): number {
  const diff = proposed - current;
  if (Math.abs(diff) <= maxStep) return round10(proposed);
  return round10(current + Math.sign(diff) * maxStep);
}

// ---------------------------------------------------------------------------
// Training days
// ---------------------------------------------------------------------------

export function trainingDaysPerWeek(preferredDays: string[] | null | undefined, completedDates: string[], today: string): number {
  const recentStart = addDays(today, -27);
  const recent = new Set(completedDates.filter((d) => d >= recentStart && d <= today));
  if (recent.size >= 2) return clamp(Math.round((recent.size / 28) * 7), 1, 7);
  return clamp(preferredDays?.length ?? 3, 0, 7);
}
