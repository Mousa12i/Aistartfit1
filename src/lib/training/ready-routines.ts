// The ready-made routines shown to everyone. Each one is built by the plan engine for a typical
// healthy adult with the listed goal, experience, schedule and equipment, so they follow exactly
// the same evidence and rules as personal plans. scripts/generate-ready-routines.mjs turns them into
// a migration.

import { EQUIPMENT_PRESETS } from './engine-library';
import type { ExperienceLevel } from './curated';
import type { PlanGoal } from './plan-types';

export interface ReadyRoutineSpec {
  slug: string;
  name: string;
  goal: PlanGoal;
  level: ExperienceLevel;
  days: number;
  minutes: number;
  equipment: keyof typeof EQUIPMENT_PRESETS;
}

export const READY_ROUTINES: ReadyRoutineSpec[] = [
  { slug: 'muscle-gym-beginner-3', name: 'Build Muscle · Full Body 3×', goal: 'muscle', level: 'beginner', days: 3, minutes: 60, equipment: 'gym' },
  { slug: 'muscle-gym-new-2', name: 'First Steps · Full Body 2×', goal: 'muscle', level: 'new', days: 2, minutes: 45, equipment: 'gym' },
  { slug: 'muscle-gym-intermediate-3', name: 'Build Muscle · Full Body 3× (Intermediate)', goal: 'muscle', level: 'intermediate', days: 3, minutes: 60, equipment: 'gym' },
  { slug: 'muscle-gym-intermediate-4', name: 'Build Muscle · Upper/Lower 4×', goal: 'muscle', level: 'intermediate', days: 4, minutes: 60, equipment: 'gym' },
  { slug: 'muscle-gym-intermediate-2', name: 'Build Muscle · Minimalist 2×', goal: 'muscle', level: 'intermediate', days: 2, minutes: 75, equipment: 'gym' },
  { slug: 'muscle-gym-advanced-4', name: 'Build Muscle · Upper/Lower 4× (Advanced)', goal: 'muscle', level: 'advanced', days: 4, minutes: 90, equipment: 'gym' },
  { slug: 'muscle-gym-advanced-5', name: 'Build Muscle · 5-Day Upper/Lower/Push/Pull/Legs', goal: 'muscle', level: 'advanced', days: 5, minutes: 75, equipment: 'gym' },
  { slug: 'muscle-home-beginner-3', name: 'Home Dumbbells · Full Body 3×', goal: 'muscle', level: 'beginner', days: 3, minutes: 45, equipment: 'home_basic' },
  { slug: 'muscle-home-intermediate-4', name: 'Home Dumbbells · Upper/Lower 4×', goal: 'muscle', level: 'intermediate', days: 4, minutes: 60, equipment: 'home_basic' },
  { slug: 'muscle-homegym-intermediate-4', name: 'Home Gym · Upper/Lower 4×', goal: 'muscle', level: 'intermediate', days: 4, minutes: 60, equipment: 'home_full' },
  { slug: 'strength-gym-new-3', name: 'Strength Foundations 3×', goal: 'strength', level: 'new', days: 3, minutes: 45, equipment: 'gym' },
  { slug: 'strength-gym-beginner-3', name: 'Get Stronger · Full Body 3×', goal: 'strength', level: 'beginner', days: 3, minutes: 60, equipment: 'gym' },
  { slug: 'strength-gym-intermediate-4', name: 'Get Stronger · Upper/Lower 4×', goal: 'strength', level: 'intermediate', days: 4, minutes: 75, equipment: 'gym' },
  { slug: 'strength-gym-advanced-4', name: 'Get Stronger · Upper/Lower 4× (Advanced)', goal: 'strength', level: 'advanced', days: 4, minutes: 90, equipment: 'gym' },
  { slug: 'strength-homegym-intermediate-3', name: 'Home Gym Strength 3×', goal: 'strength', level: 'intermediate', days: 3, minutes: 75, equipment: 'home_full' },
  { slug: 'fatloss-gym-new-3', name: 'Lose Fat · Start Here 3×', goal: 'fat_loss', level: 'new', days: 3, minutes: 45, equipment: 'gym' },
  { slug: 'fatloss-gym-beginner-3', name: 'Lose Fat · Full Body 3×', goal: 'fat_loss', level: 'beginner', days: 3, minutes: 60, equipment: 'gym' },
  { slug: 'fatloss-gym-intermediate-4', name: 'Lose Fat · Upper/Lower 4×', goal: 'fat_loss', level: 'intermediate', days: 4, minutes: 60, equipment: 'gym' },
  { slug: 'fatloss-home-beginner-3', name: 'Lose Fat at Home · Dumbbells 3×', goal: 'fat_loss', level: 'beginner', days: 3, minutes: 40, equipment: 'home_basic' },
  { slug: 'fatloss-bodyweight-new-3', name: 'Lose Fat · No Equipment 3×', goal: 'fat_loss', level: 'new', days: 3, minutes: 30, equipment: 'bodyweight' },
  { slug: 'general-gym-new-2', name: 'Fit & Healthy · 2 Days', goal: 'general', level: 'new', days: 2, minutes: 45, equipment: 'gym' },
  { slug: 'general-gym-beginner-3', name: 'Fit & Healthy · 3 Days', goal: 'general', level: 'beginner', days: 3, minutes: 45, equipment: 'gym' },
  { slug: 'general-gym-intermediate-3-quick', name: 'Quick Full Body · 30 Minutes', goal: 'general', level: 'intermediate', days: 3, minutes: 30, equipment: 'gym' },
  { slug: 'general-home-new-2', name: 'Home Basics · 2 Days', goal: 'general', level: 'new', days: 2, minutes: 30, equipment: 'home_basic' },
  { slug: 'general-home-beginner-3', name: 'Home Fitness · 3 Days', goal: 'general', level: 'beginner', days: 3, minutes: 45, equipment: 'home_basic' },
  { slug: 'general-bodyweight-new-3', name: 'No Equipment · 3 Days', goal: 'general', level: 'new', days: 3, minutes: 30, equipment: 'bodyweight' },
  { slug: 'endurance-gym-beginner-4', name: 'Endurance + Strength · 4 Days', goal: 'endurance', level: 'beginner', days: 4, minutes: 45, equipment: 'gym' },
  { slug: 'endurance-home-intermediate-5', name: 'Endurance + Strength at Home · 5 Days', goal: 'endurance', level: 'intermediate', days: 5, minutes: 45, equipment: 'home_basic' },
];
