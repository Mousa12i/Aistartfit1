// One goal ("cut", "bulk", "lose weight", "recomp") turned into the nutrition and training settings the
// app's two engines already use, plus an honest timeline. Every number here comes from those engines
// (nutrition/engine.ts and training/engine.ts) or from the evidence files they cite; nothing is new science.

import {
  RATE_RANGES,
  computeTargets,
  defaultRate,
  clamp,
  type BodyStats,
  type GoalMode,
  type PlanSettings,
  type Targets,
} from '../nutrition/engine';
import type { PlanGoal } from '../training/plan-types';

export type BodyGoal = 'cut' | 'lose_weight' | 'bulk' | 'recomp';
export type Pace = 'gentle' | 'standard' | 'faster';

export interface GoalMapping {
  nutritionMode: GoalMode;
  trainingGoal: PlanGoal;
}

/** What each goal means for the two engines. */
export const GOAL_MAPPING: Record<BodyGoal, GoalMapping> = {
  // Cut: lose fat while keeping as much muscle as possible -> hypertrophy-style lifting, deficit.
  cut: { nutritionMode: 'cut', trainingGoal: 'muscle' },
  // Lose weight: same deficit; lifting stays the core and the plan adds more aerobic work.
  lose_weight: { nutritionMode: 'cut', trainingGoal: 'fat_loss' },
  // Bulk: small surplus, hypertrophy training.
  bulk: { nutritionMode: 'bulk', trainingGoal: 'muscle' },
  // Recomp: eat at maintenance, high protein, hypertrophy training.
  recomp: { nutritionMode: 'recomp', trainingGoal: 'muscle' },
};

/**
 * Weekly change as % of body weight for each pace. Stays inside RATE_RANGES:
 * cut 0.5–1 %/wk (Ruiz-Castellano 2021; slower keeps more muscle, Helms 2014),
 * gain 0.25–0.5 %/wk for novices/intermediates and slower for advanced lifters (Iraki 2019; Helms 2023).
 */
export function paceRate(goal: BodyGoal, pace: Pace, experience: BodyStats['experience']): number {
  const mode = GOAL_MAPPING[goal].nutritionMode;
  const range = RATE_RANGES[mode];
  if (range.max === 0) return 0;
  let rate: number;
  if (mode === 'cut') {
    rate = pace === 'gentle' ? 0.5 : pace === 'faster' ? 1 : defaultRate('cut', experience);
  } else {
    const base = defaultRate('bulk', experience);
    rate = pace === 'gentle' ? base - 0.1 : pace === 'faster' ? base + 0.15 : base;
  }
  return Math.round(clamp(rate, range.min, range.max) * 100) / 100;
}

export interface TimelinePoint {
  week: number;
  kg: number;
}

/**
 * Expected body weight week by week at a constant % of the current weight per week. This is an estimate:
 * real change is not linear (water, glycogen, and the body adapting to a deficit), so the app checks the
 * real weigh-in trend every week and adjusts.
 */
export function projectWeight(startKg: number, pctPerWeek: number, direction: -1 | 0 | 1, weeks: number): TimelinePoint[] {
  const out: TimelinePoint[] = [];
  let kg = startKg;
  for (let w = 0; w <= weeks; w++) {
    out.push({ week: w, kg: Math.round(kg * 10) / 10 });
    kg = kg * (1 + (direction * pctPerWeek) / 100);
  }
  return out;
}

/** Weeks needed to reach a target weight at the chosen rate, or null if the target is on the wrong side. */
export function weeksToTarget(startKg: number, targetKg: number, pctPerWeek: number, direction: -1 | 1): number | null {
  if (pctPerWeek <= 0) return null;
  if (direction === -1 && targetKg >= startKg) return null;
  if (direction === 1 && targetKg <= startKg) return null;
  const weekly = 1 + (direction * pctPerWeek) / 100;
  return Math.ceil(Math.log(targetKg / startKg) / Math.log(weekly));
}

export type TargetIssue = 'not_below' | 'not_above' | 'underweight' | 'long';

export interface TargetCheck {
  ok: boolean;
  /** Why the target is refused (ok = false) or needs a word of advice (ok = true, 'long'). */
  issue: TargetIssue | null;
  bmi: number | null;
}

/** Refuses to plan a cut to an underweight BMI (WHO cut-off 18.5) and flags very long phases. */
export function checkTargetWeight(goal: BodyGoal, startKg: number, targetKg: number | null, heightCm: number, weeks: number | null): TargetCheck {
  if (targetKg == null) return { ok: true, issue: null, bmi: null };
  const bmi = Math.round((targetKg / (heightCm / 100) ** 2) * 10) / 10;
  const mode = GOAL_MAPPING[goal].nutritionMode;
  if (mode === 'cut' && targetKg >= startKg) return { ok: false, issue: 'not_below', bmi };
  if (mode === 'bulk' && targetKg <= startKg) return { ok: false, issue: 'not_above', bmi };
  if (mode === 'cut' && bmi < 18.5) return { ok: false, issue: 'underweight', bmi };
  if (weeks != null && weeks > 26) return { ok: true, issue: 'long', bmi };
  return { ok: true, issue: null, bmi };
}

export interface GoalPlanInput {
  goal: BodyGoal;
  pace: Pace;
  stats: BodyStats;
  targetKg: number | null;
  /** The person's current nutrition settings, so their own protein, fat and meal choices are kept. */
  current: PlanSettings;
  trainingDaysPerWeek: number;
  today: string;
  noDeficit: boolean;
  noWeightGoals: boolean;
}

export interface GoalPlan {
  goal: BodyGoal;
  mapping: GoalMapping;
  ratePct: number;
  settings: PlanSettings;
  trainingDay: Targets;
  restDay: Targets;
  weeklyChangeKg: number;
  weeks: number | null;
  timeline: TimelinePoint[];
  target: TargetCheck;
  /** Reference ids (nutrition and training evidence files) behind the plan. */
  refs: string[];
}

export function buildGoalPlan(input: GoalPlanInput): GoalPlan {
  const mapping = GOAL_MAPPING[input.goal];
  const ratePct = paceRate(input.goal, input.pace, input.stats.experience);
  const settings: PlanSettings = {
    ...input.current,
    mode: mapping.nutritionMode,
    ratePct,
    // A new goal starts from the engine's evidence-based defaults, not an old manual calorie number.
    kcalOverride: null,
    proteinPerKg: null,
    dietBreakUntil: null,
  };
  const ctx = {
    today: input.today,
    date: input.today,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    noDeficit: input.noDeficit,
    noWeightGoals: input.noWeightGoals,
  };
  const trainingDay = computeTargets(input.stats, settings, { ...ctx, trainingDay: true });
  const restDay = computeTargets(input.stats, settings, { ...ctx, trainingDay: false });
  const direction: -1 | 0 | 1 = trainingDay.mode === 'cut' ? -1 : trainingDay.mode === 'bulk' ? 1 : 0;
  // The rate the calories really give (safety caps and floors can make it slower than the chosen pace).
  const appliedRate = direction === 0
    ? 0
    : Math.round((Math.abs(trainingDay.expectedWeeklyChangeKg) / input.stats.weightKg) * 10000) / 100;
  const weeks = input.targetKg != null && direction !== 0 ? weeksToTarget(input.stats.weightKg, input.targetKg, appliedRate, direction) : null;
  const horizon = Math.min(Math.max(weeks ?? 12, 4), 26);
  const refs = mapping.nutritionMode === 'cut'
    ? ['ruiz2021', 'helms2014', 'mifflin1990', 'morton2018', 'schoenfeld2017vol', 'wewege2022']
    : mapping.nutritionMode === 'bulk'
      ? ['iraki2019', 'helms2023', 'mifflin1990', 'morton2018', 'schoenfeld2017vol']
      : ['aragon2017', 'mifflin1990', 'morton2018', 'schoenfeld2017vol'];
  if (input.goal === 'lose_weight') refs.push('wewege2017', 'who2020');
  return {
    goal: input.goal,
    mapping,
    ratePct: appliedRate,
    settings,
    trainingDay,
    restDay,
    weeklyChangeKg: trainingDay.expectedWeeklyChangeKg,
    weeks,
    timeline: projectWeight(input.stats.weightKg, appliedRate, direction, horizon),
    target: checkTargetWeight(input.goal, input.stats.weightKg, input.targetKg, input.stats.heightCm, weeks),
    refs,
  };
}
