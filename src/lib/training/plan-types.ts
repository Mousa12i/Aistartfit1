// Shapes shared by the plan engine, the validator, the saved-plan storage, the PDF and the AI coach.

import type { ExperienceLevel, SlotKey } from './curated';
import type { EquipTag, ExtraMuscle, MovementPattern, MuscleGroupKey, PainArea, SafetyFlag } from './taxonomy';
import type { RecoveryMuscle } from '../recovery/muscles';

export type PlanGoal = 'muscle' | 'strength' | 'fat_loss' | 'general' | 'endurance';

export const PLAN_GOAL_LABELS: Record<PlanGoal, string> = {
  muscle: 'Build muscle',
  strength: 'Get stronger',
  fat_loss: 'Lose fat',
  general: 'General fitness and health',
  endurance: 'Endurance and fitness',
};

/** How much the person exercises now ('regular' = planned exercise most weeks for the last few months). */
export type CurrentActivity = 'inactive' | 'some' | 'regular';

export type PainLevel = 'mild' | 'moderate' | 'severe';
export interface PainEntry {
  area: PainArea;
  level: PainLevel;
}

export interface HealthScreening {
  version: 'startfit-screen-1';
  /** Symptoms: any "yes" holds the plan back until a clinician has looked. */
  symptoms: {
    chestPain: boolean;
    dizzinessOrFainting: boolean;
    breathlessAtMildEffort: boolean;
    palpitationsOrSwelling: boolean;
  };
  knownDisease: {
    heart: boolean;
    metabolic: boolean;
    kidney: boolean;
    lung: boolean;
  };
  pregnancy: 'no' | 'pregnant' | 'postpartum';
  doctorSaidAvoidExercise: boolean;
  recentSurgeryOrInjury: boolean;
  uncontrolledHighBloodPressure: boolean;
  osteoporosis: boolean;
  /** The person says a clinician has looked at them and cleared exercise. */
  clearedByClinician: boolean;
  completedAt: string;
}

export interface TrainingHistorySummary {
  /** Weeks of logged data used (0 = nothing logged). */
  weeksLogged: number;
  sessionsLast4Weeks: number;
  /** Average fractional hard sets per week for each muscle group over the last 4 weeks. */
  weeklySets: Partial<Record<MuscleGroupKey, number>>;
  /** Best recent working set for exercises the person already does (library exercise id -> set). */
  bestSets: Record<string, { weightKg: number; reps: number; rir: number | null; date: string }>;
  /** Exercise ids the person has trained recently, most frequent first. */
  frequentExerciseIds: string[];
}

export interface TrainingIntake {
  goal: PlanGoal;
  /** Muscle groups the person wants to bring up (get extra weekly sets). */
  priorityMuscles: MuscleGroupKey[];
  experience: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: EquipTag[];
  age: number;
  sex: 'male' | 'female' | null;
  heightCm: number | null;
  weightKg: number | null;
  currentActivity: CurrentActivity;
  pain: PainEntry[];
  screening: HealthScreening;
  /** Library exercise ids the person never wants in a plan. */
  avoidExerciseIds: string[];
  /** Library exercise ids the person likes; used first when they fit the slot and equipment. */
  preferredExerciseIds: string[];
  cardio: 'auto' | 'none';
  cardioModes: CardioMode[];
  /** Hours of sleep per night on average, if known. */
  sleepHours: number | null;
  /** Nutrition goal from the nutrition hub, if set. */
  nutritionMode: 'cut' | 'maintain' | 'bulk' | 'recomp' | null;
  history: TrainingHistorySummary | null;
}

export type CardioMode = 'walking' | 'running' | 'cycling' | 'swimming' | 'rowing' | 'elliptical';

export const CARDIO_MODE_LABELS: Record<CardioMode, string> = {
  walking: 'Brisk or incline walking',
  running: 'Running',
  cycling: 'Cycling',
  swimming: 'Swimming',
  rowing: 'Rowing machine',
  elliptical: 'Elliptical / cross-trainer',
};

/** The exercise fields the engine reads (built from a library row). */
export interface PlanExerciseRef {
  id: string;
  /** Stable library id (dataset / catalogue / StartFit addition), used to find curated exercises. */
  sourceId: string | null;
  name: string;
  pattern: MovementPattern;
  primary: RecoveryMuscle[];
  secondary: RecoveryMuscle[];
  extra: ExtraMuscle[];
  equipment: EquipTag[];
  flags: SafetyFlag[];
  unilateral: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  coreSlot: SlotKey | null;
  coreRank: number | null;
  hidden: boolean;
  /** Instruction text: used to detect exercises done lying down. */
  instructions: string;
  /** Default rep text from the library, e.g. "30 s" for holds. */
  defaultReps: string;
}

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  slot: SlotKey | null;
  pattern: MovementPattern;
  sets: number;
  /** Rep range as text ("6-10", "30-45 s", "20 min"). */
  reps: string;
  repsMin: number;
  repsMax: number;
  /** True when the target is a time (holds, cardio) instead of repetitions. */
  timed: boolean;
  restSeconds: number;
  /** Reps in reserve to aim for on working sets. */
  rir: number;
  unilateral: boolean;
  /** Short coaching note for this exercise in this plan. */
  note: string | null;
  /** Other library exercises that fit the same slot, equipment and safety limits. */
  alternatives: { exerciseId: string; name: string }[];
  /** Fractional weekly contribution per muscle group for one set. */
  contributions: Partial<Record<MuscleGroupKey, number>>;
}

export interface PlannedCardio {
  mode: CardioMode;
  label: string;
  minutes: number;
  intensity: 'easy' | 'moderate' | 'vigorous';
  /** Library exercise to open when the person starts it, if there is one. */
  exerciseId: string | null;
  /** Suggested weekday, 0 = Monday. */
  weekday: number;
  note: string;
}

export interface PlanDay {
  index: number;
  label: string;
  focus: string;
  /** Suggested weekday, 0 = Monday. */
  weekday: number;
  exercises: PlannedExercise[];
  warmup: string;
  estimatedMinutes: number;
}

export interface VolumeRow {
  group: MuscleGroupKey;
  label: string;
  sets: number;
  low: number;
  high: number;
  status: 'low' | 'in_range' | 'high';
  priority: boolean;
}

export interface ProgressionWeek {
  week: number;
  label: string;
  setsNote: string;
  rirNote: string;
}

export interface PlanNote {
  kind: 'safety' | 'adjustment' | 'info';
  text: string;
}

export interface TrainingPlan {
  engineVersion: string;
  generatedAt: string;
  title: string;
  goal: PlanGoal;
  /** The goal the plan was actually built for (differs when safety rules changed it). */
  effectiveGoal: PlanGoal;
  level: ExperienceLevel;
  summary: string;
  daysPerWeek: number;
  strengthDays: number;
  sessionMinutes: number;
  /** Equipment the chosen exercises actually use. */
  equipmentUsed: EquipTag[];
  days: PlanDay[];
  volume: VolumeRow[];
  progression: ProgressionWeek[];
  progressionRules: string[];
  /** Weekly cardio / activity sessions (WHO guideline based), separate from the strength days. */
  cardio: PlannedCardio[];
  cardioMinutesPerWeek: number;
  cardioTargetMinutes: number;
  /** Planned cardio minutes for weeks 1..n while building up to the target. */
  cardioRamp: number[];
  notes: PlanNote[];
  /** Claim ids (see evidence.ts) that explain the design. */
  claimIds: string[];
  /** Why each key design choice was made: claim id + what it decided for this person. */
  rationale: { claimId: string; decision: string }[];
  /** A copy of what the plan was built from, so it can be rebuilt or explained later. */
  inputs: PlanInputsSnapshot;
}

export interface PlanInputsSnapshot {
  goal: PlanGoal;
  experience: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: EquipTag[];
  age: number;
  pain: PainEntry[];
  priorityMuscles: MuscleGroupKey[];
  currentActivity: CurrentActivity;
  screeningStatus: 'ok' | 'caution' | 'medical_first';
}

export type { ExperienceLevel, SlotKey, EquipTag, MuscleGroupKey, PainArea };
