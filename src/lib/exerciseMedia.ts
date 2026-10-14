/**
 * Exercise media and muscle mapping helpers.
 *
 * The old hardcoded name-keyed registries (EXERCISE_MEDIA, EXERCISE_MUSCLE_MAPPINGS)
 * have been removed. Exercise media and muscle data now come from the database
 * exercises table, populated by the free-exercise-db dataset import.
 *
 * See data/free-exercise-db.json for the source dataset.
 * Source: https://github.com/yuhonas/free-exercise-db
 */

export type ExerciseMediaType = 'real_video' | 'realistic_3d' | 'static_fallback';

export interface ExerciseMedia {
  url: string;
  type: ExerciseMediaType;
  angle: 'front' | 'side' | 'back';
  verified: boolean;
  source: string;
  photographer: string;
  licenseNote: string;
  alt: string;
}
