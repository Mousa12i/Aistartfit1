// Numbers and templates used by the plan engine. Values that come from a study are explained by
// the claim they cite in evidence.ts; the rest are StartFit design choices and are labelled so.

import type { ExperienceLevel, SlotKey } from './curated';
import type { MuscleGroupKey } from './taxonomy';
import type { PlanGoal } from './plan-types';

export const ENGINE_VERSION = 'startfit-plan-1';

/** Strength days per week the plan will schedule (claim acsm_days); extra requested days become cardio. */
export const MAX_STRENGTH_DAYS: Record<ExperienceLevel, number> = { new: 3, beginner: 3, intermediate: 4, advanced: 5 };

/** Weekly fractional sets per muscle group (design choice inside the range the studies support). */
export const BASE_RANGE: Record<ExperienceLevel, [number, number]> = {
  new: [6, 10],
  beginner: [8, 12],
  intermediate: [10, 16],
  advanced: [12, 20],
};

/** For health and general fitness the lower bound is the time-efficient minimum of about 4 sets (claim vol_minimum). */
export const GENERAL_RANGE: Record<ExperienceLevel, [number, number]> = {
  new: [4, 8],
  beginner: [4, 10],
  intermediate: [6, 12],
  advanced: [6, 12],
};

/** Groups that get a weekly target, and how much of the full range they need (small groups need less). */
export const TARGET_GROUPS: Partial<Record<MuscleGroupKey, number>> = {
  chest: 1,
  back: 1,
  shoulders: 1,
  quads: 1,
  hamstrings: 0.9,
  glutes: 0.9,
  biceps: 0.9,
  triceps: 0.9,
  calves: 0.7,
  abs: 0.7,
};

/** Effective sets for one muscle in one session (claim vol_session_cap). */
export const SESSION_GROUP_CAP = 10;

export type SlotKind = 'main' | 'secondary' | 'isolation' | 'core' | 'carry' | 'balance' | 'cardio';

export const SLOT_KIND: Record<SlotKey, SlotKind> = {
  quad_compound: 'main',
  hinge: 'main',
  chest_press: 'main',
  shoulder_press: 'main',
  vertical_pull: 'main',
  horizontal_pull: 'main',
  quad_unilateral: 'secondary',
  incline_press: 'secondary',
  glute_bridge: 'secondary',
  quad_isolation: 'isolation',
  hamstring_curl: 'isolation',
  hip_abduction: 'isolation',
  hip_adduction: 'isolation',
  calves: 'isolation',
  chest_fly: 'isolation',
  lateral_raise: 'isolation',
  rear_delt: 'isolation',
  biceps: 'isolation',
  triceps: 'isolation',
  traps: 'isolation',
  lower_back: 'isolation',
  abs: 'core',
  obliques: 'core',
  carry: 'carry',
  balance: 'balance',
  cardio: 'cardio',
};

/** Order inside a session: big multi-joint lifts first (claim exercise_order). */
export const SLOT_ORDER: SlotKey[] = [
  'quad_compound', 'hinge', 'chest_press', 'incline_press', 'shoulder_press', 'vertical_pull', 'horizontal_pull',
  'quad_unilateral', 'glute_bridge', 'hamstring_curl', 'quad_isolation', 'chest_fly', 'lateral_raise', 'rear_delt',
  'triceps', 'biceps', 'hip_abduction', 'hip_adduction', 'traps', 'lower_back', 'calves', 'abs', 'obliques', 'carry', 'balance',
];

/** Slots that can add volume to a muscle group, best first. */
export const GROUP_FILL_SLOTS: Record<MuscleGroupKey, SlotKey[]> = {
  chest: ['chest_press', 'incline_press', 'chest_fly'],
  back: ['horizontal_pull', 'vertical_pull'],
  shoulders: ['lateral_raise', 'rear_delt', 'shoulder_press'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  quads: ['quad_compound', 'quad_unilateral', 'quad_isolation'],
  hamstrings: ['hamstring_curl', 'hinge'],
  glutes: ['glute_bridge', 'hinge', 'quad_unilateral'],
  calves: ['calves'],
  abs: ['abs', 'obliques'],
  traps: ['traps'],
  lower_back: ['lower_back'],
  forearms: [],
  adductors: ['hip_adduction'],
};

export interface DayTemplate {
  label: string;
  focus: string;
  allowed: MuscleGroupKey[];
  /** Slots in priority order: later ones are dropped first when time is short. */
  core: SlotKey[];
}

const UPPER: MuscleGroupKey[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'abs', 'traps'];
const LOWER: MuscleGroupKey[] = ['quads', 'hamstrings', 'glutes', 'calves', 'abs', 'lower_back', 'adductors'];
const ALL: MuscleGroupKey[] = [...new Set([...UPPER, ...LOWER])];

export const SPLITS: Record<number, DayTemplate[]> = {
  1: [{ label: 'Full body', focus: 'Whole body', allowed: ALL, core: ['quad_compound', 'chest_press', 'horizontal_pull', 'hinge', 'shoulder_press', 'abs'] }],
  2: [
    { label: 'Full body A', focus: 'Whole body: squat, push, pull', allowed: ALL, core: ['quad_compound', 'chest_press', 'horizontal_pull', 'hamstring_curl', 'abs'] },
    { label: 'Full body B', focus: 'Whole body: hinge, overhead press, pulldown', allowed: ALL, core: ['hinge', 'shoulder_press', 'vertical_pull', 'quad_unilateral', 'calves'] },
  ],
  3: [
    { label: 'Full body A', focus: 'Whole body: squat, push, pull', allowed: ALL, core: ['quad_compound', 'chest_press', 'horizontal_pull', 'hamstring_curl', 'abs'] },
    { label: 'Full body B', focus: 'Whole body: hinge, overhead press, pulldown', allowed: ALL, core: ['hinge', 'shoulder_press', 'vertical_pull', 'quad_unilateral', 'calves'] },
    { label: 'Full body C', focus: 'Whole body: legs, incline press, row', allowed: ALL, core: ['quad_compound', 'incline_press', 'horizontal_pull', 'glute_bridge', 'lateral_raise'] },
  ],
  4: [
    { label: 'Upper A', focus: 'Chest, back, shoulders, arms', allowed: UPPER, core: ['chest_press', 'horizontal_pull', 'shoulder_press', 'vertical_pull', 'triceps', 'biceps'] },
    { label: 'Lower A', focus: 'Quads, hamstrings, glutes, calves', allowed: LOWER, core: ['quad_compound', 'hinge', 'hamstring_curl', 'calves', 'abs'] },
    { label: 'Upper B', focus: 'Chest, back, shoulders, arms', allowed: UPPER, core: ['incline_press', 'vertical_pull', 'horizontal_pull', 'lateral_raise', 'biceps', 'triceps'] },
    { label: 'Lower B', focus: 'Quads, hamstrings, glutes, calves', allowed: LOWER, core: ['hinge', 'quad_unilateral', 'glute_bridge', 'quad_isolation', 'calves'] },
  ],
  5: [
    { label: 'Upper', focus: 'Chest, back, shoulders, arms', allowed: UPPER, core: ['chest_press', 'horizontal_pull', 'shoulder_press', 'vertical_pull', 'biceps', 'triceps'] },
    { label: 'Lower', focus: 'Quads, hamstrings, glutes, calves', allowed: LOWER, core: ['quad_compound', 'hinge', 'hamstring_curl', 'calves', 'abs'] },
    { label: 'Push', focus: 'Chest, shoulders, triceps', allowed: ['chest', 'shoulders', 'triceps', 'abs'], core: ['incline_press', 'shoulder_press', 'chest_fly', 'lateral_raise', 'triceps'] },
    { label: 'Pull', focus: 'Back, rear delts, biceps', allowed: ['back', 'shoulders', 'biceps', 'traps', 'abs'], core: ['vertical_pull', 'horizontal_pull', 'rear_delt', 'biceps', 'traps'] },
    { label: 'Legs', focus: 'Quads, hamstrings, glutes, calves', allowed: LOWER, core: ['quad_compound', 'quad_unilateral', 'glute_bridge', 'hamstring_curl', 'calves'] },
  ],
};

/** Mondays = 0. Preferred weekdays for strength days so there is rest between hard days. */
export const STRENGTH_WEEKDAYS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 3, 4, 5],
};

export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---------- prescription ----------

/** Rep range for a kind of exercise. Heavier for strength (claim load_range); 6-15 reps covers most work (claim vol_minimum). */
export function repRange(goal: PlanGoal, kind: SlotKind, level: ExperienceLevel): [number, number] {
  const novice = level === 'new' || level === 'beginner';
  if (kind === 'main') {
    if (goal === 'strength') return novice ? [5, 8] : [3, 6];
    if (goal === 'endurance') return [10, 15];
    if (goal === 'general') return [8, 12];
    return novice ? [8, 12] : [6, 10];
  }
  if (kind === 'secondary') {
    if (goal === 'strength') return [6, 10];
    if (goal === 'endurance') return [10, 15];
    return [8, 12];
  }
  if (kind === 'core') return [10, 15];
  if (goal === 'strength') return [8, 12];
  if (goal === 'endurance') return [12, 20];
  return [10, 15];
}

/** Reps in reserve to aim for (claims failure_optional, failure_proximity, rir_start_easier). */
export const BASE_RIR: Record<ExperienceLevel, Record<'main' | 'secondary' | 'isolation' | 'core', number>> = {
  new: { main: 3, secondary: 3, isolation: 3, core: 3 },
  beginner: { main: 3, secondary: 2, isolation: 2, core: 3 },
  intermediate: { main: 2, secondary: 2, isolation: 1, core: 2 },
  advanced: { main: 2, secondary: 1, isolation: 1, core: 2 },
};

/** Rest between sets in seconds (claims rest_intervals, rest_hypertrophy). */
export function restSeconds(goal: PlanGoal, kind: SlotKind, level: ExperienceLevel): number {
  if (kind === 'main') {
    if (level === 'new') return 90;
    if (level === 'beginner') return 120;
    return goal === 'strength' ? 180 : 150;
  }
  if (kind === 'secondary') return level === 'new' ? 75 : 90;
  return level === 'new' ? 60 : 75;
}

export function baseSets(kind: SlotKind, level: ExperienceLevel, goal: PlanGoal): number {
  if (kind === 'main') return level === 'new' ? 2 : goal === 'strength' && level !== 'beginner' ? 4 : 3;
  if (kind === 'secondary') return level === 'new' || level === 'beginner' ? 2 : 3;
  if (kind === 'isolation') return level === 'advanced' ? 3 : 2;
  return level === 'new' || level === 'beginner' ? 2 : 3;
}

export function maxSetsFor(kind: SlotKind, goal: PlanGoal): number {
  if (kind === 'main') return goal === 'strength' ? 6 : 5;
  if (kind === 'secondary') return 4;
  if (kind === 'isolation') return 4;
  return 3;
}

export const WARMUP_MINUTES = 6;
export const WARMUP_MINUTES_CAREFUL = 8;
export const TRANSITION_SECONDS = 45;
export const RAMP_SECONDS = 120;
export const SECONDS_PER_REP = 3;
