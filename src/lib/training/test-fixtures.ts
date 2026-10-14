// Test helpers: the full exercise library as the plan engine sees it, built from the source data
// exactly like the migration does. Only imported by tests.

import datasetJson from '../../../data/free-exercise-db.json';
import catalogJson from '../../../data/startfit-catalog.json';
import { buildLibrary, type CatalogExercise, type DatasetExercise, type LibraryEntry } from './library-build';
import { PlanLibrary } from './engine-library';
import { emptyScreening } from './screening';
import type { PlanExerciseRef, TrainingIntake } from './plan-types';

export function entryToRef(e: LibraryEntry): PlanExerciseRef {
  return {
    id: e.sourceId,
    sourceId: e.sourceId,
    name: e.name,
    pattern: e.profile.pattern,
    primary: e.profile.primary,
    secondary: e.profile.secondary,
    extra: e.profile.extra,
    equipment: e.profile.equipment,
    flags: e.profile.flags,
    unilateral: e.profile.unilateral,
    difficulty: e.difficulty,
    coreSlot: e.coreSlot,
    coreRank: e.coreRank,
    hidden: e.hidden,
    instructions: e.instructions.join(' '),
    defaultReps: e.prescription.reps,
  };
}

let cached: PlanLibrary | null = null;
export function testLibrary(): PlanLibrary {
  if (!cached) {
    const { entries } = buildLibrary(datasetJson as unknown as DatasetExercise[], catalogJson as unknown as CatalogExercise[]);
    cached = new PlanLibrary(entries.map(entryToRef));
  }
  return cached;
}

export function baseIntake(over: Partial<TrainingIntake> = {}): TrainingIntake {
  return {
    goal: 'muscle',
    priorityMuscles: [],
    experience: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 60,
    equipment: ['bodyweight', 'dumbbell', 'barbell', 'ez_bar', 'rack', 'bench', 'cable', 'machine', 'smith_machine', 'band', 'pullup_bar', 'cardio_machine'],
    age: 30,
    sex: 'male',
    heightCm: 178,
    weightKg: 80,
    currentActivity: 'regular',
    pain: [],
    screening: emptyScreening(new Date('2026-10-14T00:00:00Z')),
    avoidExerciseIds: [],
    preferredExerciseIds: [],
    cardio: 'auto',
    cardioModes: [],
    sleepHours: null,
    nutritionMode: null,
    history: null,
    ...over,
  };
}
