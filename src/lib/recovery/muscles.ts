/**
 * Recovery muscle taxonomy: 19 fine-grained muscles.
 * Each maps to a body-highlighter muscle identifier.
 */
export type RecoveryMuscle =
  | 'upper_chest'
  | 'lower_chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'traps'
  | 'lats'
  | 'mid_back'
  | 'lower_back'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export const RECOVERY_MUSCLES: RecoveryMuscle[] = [
  'upper_chest', 'lower_chest',
  'front_delts', 'side_delts', 'rear_delts',
  'biceps', 'triceps', 'forearms',
  'abs', 'obliques',
  'traps', 'lats', 'mid_back', 'lower_back',
  'glutes', 'quads', 'hamstrings', 'adductors', 'calves',
];

export const MUSCLE_LABELS: Record<RecoveryMuscle, string> = {
  upper_chest: 'Upper Chest',
  lower_chest: 'Lower Chest',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  traps: 'Trapezius',
  lats: 'Lats',
  mid_back: 'Mid Back',
  lower_back: 'Lower Back',
  glutes: 'Glutes',
  quads: 'Quadriceps',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
};

export const MUSCLE_BODY_VIEW: Record<RecoveryMuscle, { front: string | null; back: string | null }> = {
  upper_chest: { front: 'chest', back: null },
  lower_chest: { front: 'chest', back: null },
  front_delts: { front: 'front-deltoids', back: null },
  side_delts: { front: 'front-deltoids', back: 'back-deltoids' },
  rear_delts: { front: null, back: 'back-deltoids' },
  biceps: { front: 'biceps', back: null },
  triceps: { front: null, back: 'triceps' },
  forearms: { front: 'forearm', back: 'forearm' },
  abs: { front: 'abs', back: null },
  obliques: { front: 'obliques', back: null },
  traps: { front: 'trapezius', back: 'trapezius' },
  lats: { front: null, back: 'upper-back' },
  mid_back: { front: null, back: 'upper-back' },
  lower_back: { front: null, back: 'lower-back' },
  glutes: { front: null, back: 'gluteal' },
  quads: { front: 'quadriceps', back: null },
  hamstrings: { front: null, back: 'hamstring' },
  adductors: { front: 'adductor', back: null },
  calves: { front: null, back: 'calves' },
};

/** Base recovery hours per muscle group */
export const BASE_RECOVERY_HOURS: Record<RecoveryMuscle, number> = {
  upper_chest: 48,
  lower_chest: 48,
  front_delts: 48,
  side_delts: 48,
  rear_delts: 48,
  biceps: 36,
  triceps: 36,
  forearms: 36,
  abs: 36,
  obliques: 36,
  traps: 48,
  lats: 72,
  mid_back: 72,
  lower_back: 72,
  glutes: 72,
  quads: 72,
  hamstrings: 72,
  adductors: 48,
  calves: 36,
};

/** Large muscle groups (72h base) */
export const LARGE_MUSCLES: RecoveryMuscle[] = ['lats', 'mid_back', 'lower_back', 'glutes', 'quads', 'hamstrings'];
/** Medium muscle groups (48h base) */
export const MEDIUM_MUSCLES: RecoveryMuscle[] = ['upper_chest', 'lower_chest', 'front_delts', 'side_delts', 'rear_delts', 'traps', 'adductors'];
/** Small muscle groups (36h base) */
export const SMALL_MUSCLES: RecoveryMuscle[] = ['biceps', 'triceps', 'forearms', 'abs', 'obliques', 'calves'];

/** Maps a coarse MuscleGroup to fine-grained recovery muscles */
export const COARSE_TO_FINE: Record<string, RecoveryMuscle[]> = {
  chest: ['upper_chest', 'lower_chest'],
  shoulders: ['front_delts', 'side_delts', 'rear_delts'],
  arms: ['biceps', 'triceps', 'forearms'],
  back: ['traps', 'lats', 'mid_back', 'lower_back'],
  legs: ['quads', 'hamstrings', 'adductors', 'calves'],
  glutes: ['glutes'],
  core: ['abs', 'obliques'],
  full_body: ['quads', 'hamstrings', 'upper_chest', 'lats', 'abs', 'front_delts'],
  cardio: ['calves', 'quads', 'hamstrings'],
};

/** Default contribution when mapping from coarse primary_muscle to fine muscles */
export const DEFAULT_PRIMARY_CONTRIBUTION = 1.0;
export const DEFAULT_SECONDARY_CONTRIBUTION = 0.5;
