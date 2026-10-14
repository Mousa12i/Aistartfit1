// Collecting what the plan engine needs, asking only for what the app does not already know.
// Sources, in order: the last saved training answers, the app profile, the nutrition settings.

import { EQUIPMENT_PRESETS } from './engine-library';
import type { ExperienceLevel } from './curated';
import type { EquipTag, MuscleGroupKey } from './taxonomy';
import type { CardioMode, CurrentActivity, HealthScreening, PainEntry, PlanGoal, TrainingHistorySummary, TrainingIntake } from './plan-types';
import type { Profile } from '../types';

export interface IntakeDraft {
  goal?: PlanGoal;
  priorityMuscles?: MuscleGroupKey[];
  experience?: ExperienceLevel;
  daysPerWeek?: number;
  sessionMinutes?: number;
  equipment?: EquipTag[];
  age?: number;
  sex?: 'male' | 'female' | null;
  /** True once the person has answered the sex question (an answer of "prefer not to say" is null). */
  sexAnswered?: boolean;
  heightCm?: number | null;
  weightKg?: number | null;
  currentActivity?: CurrentActivity;
  pain?: PainEntry[];
  screening?: HealthScreening | null;
  avoidExerciseIds?: string[];
  preferredExerciseIds?: string[];
  cardio?: 'auto' | 'none';
  cardioModes?: CardioMode[];
  sleepHours?: number | null;
  nutritionMode?: TrainingIntake['nutritionMode'];
}

export type IntakeField = 'goal' | 'experience' | 'schedule' | 'equipment' | 'age' | 'sex' | 'activity' | 'screening' | 'pain';

export const INTAKE_FIELD_LABELS: Record<IntakeField, string> = {
  goal: 'Your main goal',
  experience: 'Your training experience',
  schedule: 'Days per week and minutes per session',
  equipment: 'Equipment you can use',
  age: 'Your age',
  sex: 'Sex (only used for the pregnancy question)',
  activity: 'How much you exercise now',
  screening: 'Health check',
  pain: 'Pain or injuries',
};

/** Health answers are asked again after this many days. */
export const SCREENING_VALID_DAYS = 180;

const GOAL_FROM_PROFILE: Record<string, PlanGoal> = {
  fat_loss: 'fat_loss',
  muscle_gain: 'muscle',
  hypertrophy: 'muscle',
  recomposition: 'muscle',
  strength: 'strength',
  powerlifting: 'strength',
  endurance: 'endurance',
  general_fitness: 'general',
  general: 'general',
};

const EQUIPMENT_FROM_PROFILE: Record<string, EquipTag[]> = {
  none: ['bodyweight'],
  dumbbells: ['dumbbell'],
  barbell: ['barbell', 'rack'],
  kettlebell: ['kettlebell'],
  resistance_bands: ['band'],
  pull_up_bar: ['pullup_bar'],
  bench: ['bench'],
  machine: ['machine', 'cable'],
};

export function draftFromSources(input: {
  saved: Partial<IntakeDraft> | null;
  profile: Profile | null;
  nutrition: { sex: 'male' | 'female' | 'unspecified' | null; goalMode: TrainingIntake['nutritionMode'] } | null;
}): IntakeDraft {
  const { saved, profile, nutrition } = input;
  const d: IntakeDraft = { ...(saved ?? {}) };
  if (profile) {
    if (!d.goal) d.goal = GOAL_FROM_PROFILE[profile.physique_goal ?? ''] ?? GOAL_FROM_PROFILE[profile.fitness_goal ?? ''];
    if (!d.experience && (profile.experience_level === 'intermediate' || profile.experience_level === 'advanced')) d.experience = profile.experience_level;
    if (d.daysPerWeek == null && profile.preferred_days && profile.preferred_days.length >= 1 && profile.preferred_days.length <= 7) d.daysPerWeek = profile.preferred_days.length;
    if (d.sessionMinutes == null && profile.session_duration_min && profile.session_duration_min >= 15) d.sessionMinutes = profile.session_duration_min;
    if (!d.equipment) {
      if (profile.training_location === 'gym') d.equipment = EQUIPMENT_PRESETS.gym.tags;
      else if (profile.preferred_equipment && profile.preferred_equipment.length) {
        const tags = new Set<EquipTag>(['bodyweight']);
        for (const e of profile.preferred_equipment) for (const t of EQUIPMENT_FROM_PROFILE[e] ?? []) tags.add(t);
        d.equipment = [...tags];
      }
    }
    if (d.age == null && profile.age && profile.age > 0) d.age = profile.age;
    if (d.heightCm == null) d.heightCm = profile.height_cm;
    if (d.weightKg == null) d.weightKg = profile.weight_kg;
  }
  if (nutrition) {
    if (!d.sexAnswered && (nutrition.sex === 'male' || nutrition.sex === 'female')) {
      d.sex = nutrition.sex;
      d.sexAnswered = true;
    }
    if (d.nutritionMode == null) d.nutritionMode = nutrition.goalMode;
  }
  return d;
}

export function screeningIsCurrent(s: HealthScreening | null | undefined, now = new Date()): boolean {
  if (!s) return false;
  const at = Date.parse(s.completedAt);
  return Number.isFinite(at) && now.getTime() - at <= SCREENING_VALID_DAYS * 24 * 60 * 60 * 1000;
}

/** What still has to be asked, in the order to ask it. */
export function missingFields(d: IntakeDraft, now = new Date()): IntakeField[] {
  const out: IntakeField[] = [];
  if (!d.goal) out.push('goal');
  if (!d.experience) out.push('experience');
  if (d.daysPerWeek == null || d.sessionMinutes == null) out.push('schedule');
  if (!d.equipment || d.equipment.length === 0) out.push('equipment');
  if (d.age == null || d.age <= 0) out.push('age');
  if (!d.sexAnswered) out.push('sex');
  if (!d.currentActivity) out.push('activity');
  if (!screeningIsCurrent(d.screening, now)) out.push('screening');
  if (!d.pain) out.push('pain');
  return out;
}

export function completeIntake(d: IntakeDraft, history: TrainingHistorySummary | null, now = new Date()): TrainingIntake | null {
  if (missingFields(d, now).length > 0) return null;
  return {
    goal: d.goal!,
    priorityMuscles: d.priorityMuscles ?? [],
    experience: d.experience!,
    daysPerWeek: d.daysPerWeek!,
    sessionMinutes: d.sessionMinutes!,
    equipment: d.equipment!,
    age: d.age!,
    sex: d.sex ?? null,
    heightCm: d.heightCm ?? null,
    weightKg: d.weightKg ?? null,
    currentActivity: d.currentActivity!,
    pain: d.pain ?? [],
    screening: d.screening!,
    avoidExerciseIds: d.avoidExerciseIds ?? [],
    preferredExerciseIds: d.preferredExerciseIds ?? [],
    cardio: d.cardio ?? 'auto',
    cardioModes: d.cardioModes ?? [],
    sleepHours: d.sleepHours ?? null,
    nutritionMode: d.nutritionMode ?? null,
    history,
  };
}

/** Only the fields worth saving between visits (no history, which is always recomputed). */
export function draftForStorage(d: IntakeDraft): IntakeDraft {
  const { screening: _s, ...rest } = d;
  void _s;
  return rest;
}
