// The curated core of the exercise library: for every training "slot" the plan engine
// fills (a quad compound, a horizontal pull, a calf exercise, ...), an ordered list of
// well-known exercises with the equipment each one needs and the minimum experience
// level it suits. The engine walks the list in order and takes the first exercise the
// person can do with their equipment, level and current aches (see engine.ts).
//
// Keys refer to library entries: "D:" open dataset, "C:" app catalogue, "N:" StartFit
// additions (library-additions.ts). Every key is checked by the library tests.

import type { EquipTag, MovementPattern } from './taxonomy';

export type ExperienceLevel = 'new' | 'beginner' | 'intermediate' | 'advanced';

export const LEVEL_ORDER: Record<ExperienceLevel, number> = { new: 0, beginner: 1, intermediate: 2, advanced: 3 };

export type SlotKey =
  | 'quad_compound'
  | 'quad_unilateral'
  | 'quad_isolation'
  | 'hinge'
  | 'hamstring_curl'
  | 'glute_bridge'
  | 'hip_abduction'
  | 'hip_adduction'
  | 'calves'
  | 'chest_press'
  | 'incline_press'
  | 'chest_fly'
  | 'shoulder_press'
  | 'lateral_raise'
  | 'rear_delt'
  | 'vertical_pull'
  | 'horizontal_pull'
  | 'biceps'
  | 'triceps'
  | 'abs'
  | 'obliques'
  | 'lower_back'
  | 'traps'
  | 'carry'
  | 'cardio'
  | 'balance';

export interface SlotCandidate {
  key: string;
  /** Alternative equipment sets: the person needs every item of at least one set. */
  needs: EquipTag[][];
  /** Lowest experience level the exercise is offered at. */
  minLevel: ExperienceLevel;
}

export interface SlotDef {
  label: string;
  /** Patterns an exercise must have to be swapped into this slot. */
  patterns: MovementPattern[];
  candidates: SlotCandidate[];
}

const BW: EquipTag[][] = [['bodyweight']];
const c = (key: string, needs: EquipTag[][], minLevel: ExperienceLevel = 'new'): SlotCandidate => ({ key, needs, minLevel });

export const CORE_SLOTS: Record<SlotKey, SlotDef> = {
  quad_compound: {
    label: 'Squat pattern',
    patterns: ['squat'],
    candidates: [
      c('D:Barbell Squat', [['barbell', 'rack']], 'beginner'),
      c('D:Leg Press', [['machine']]),
      c('D:Hack Squat', [['machine']], 'beginner'),
      c('N:pendulum-squat', [['machine']]),
      c('D:Smith Machine Squat', [['smith_machine']], 'beginner'),
      c('C:Goblet Squat', [['dumbbell']]),
      c('D:Goblet Squat', [['kettlebell']]),
      c('D:Front Barbell Squat', [['barbell', 'rack']], 'intermediate'),
      c('D:Bodyweight Squat', BW),
      c('N:sit-to-stand', BW),
    ],
  },
  quad_unilateral: {
    label: 'Single-leg squat or lunge',
    patterns: ['lunge'],
    candidates: [
      c('C:Bulgarian Split Squat', [['dumbbell', 'bench'], ['bodyweight', 'bench']], 'beginner'),
      c('D:Dumbbell Rear Lunge', [['dumbbell']]),
      c('D:Split Squat with Dumbbells', [['dumbbell']]),
      c('D:Dumbbell Step Ups', [['dumbbell', 'box'], ['dumbbell', 'bench']]),
      c('D:Barbell Lunge', [['barbell', 'rack']], 'intermediate'),
      c('D:Smith Single-Leg Split Squat', [['smith_machine']], 'beginner'),
      c('D:Bodyweight Walking Lunge', BW, 'beginner'),
      c('D:Step-up with Knee Raise', [['box'], ['bench']]),
    ],
  },
  quad_isolation: {
    label: 'Knee extension',
    patterns: ['knee_extension'],
    candidates: [c('D:Leg Extensions', [['machine']]), c('D:Single-Leg Leg Extension', [['machine']]), c('C:Sissy Squat', BW, 'advanced')],
  },
  hinge: {
    label: 'Hip hinge',
    patterns: ['hinge'],
    candidates: [
      c('D:Romanian Deadlift', [['barbell']], 'beginner'),
      c('N:dumbbell-romanian-deadlift', [['dumbbell']]),
      c('D:Trap Bar Deadlift', [['trap_bar']], 'beginner'),
      c('D:Barbell Deadlift', [['barbell']], 'intermediate'),
      c('D:Smith Machine Stiff-Legged Deadlift', [['smith_machine']], 'beginner'),
      c('D:Pull Through', [['cable']]),
      c('C:Kettlebell Deadlift', [['kettlebell'], ['dumbbell']]),
      c('C:Single-Leg RDL', [['dumbbell'], ['bodyweight']], 'beginner'),
      c('D:Band Good Morning', [['band']]),
    ],
  },
  hamstring_curl: {
    label: 'Leg curl',
    patterns: ['knee_flexion'],
    candidates: [
      c('D:Seated Leg Curl', [['machine']]),
      c('D:Lying Leg Curls', [['machine']]),
      c('D:Ball Leg Curl', [['exercise_ball']]),
      c('C:Slider Hamstring Curl', BW, 'beginner'),
      c('D:Seated Band Hamstring Curl', [['band']]),
      c('C:Nordic Hamstring Curl', BW, 'advanced'),
    ],
  },
  glute_bridge: {
    label: 'Hip thrust or bridge',
    patterns: ['hip_thrust'],
    candidates: [
      c('D:Barbell Hip Thrust', [['barbell', 'bench']], 'beginner'),
      c('D:Barbell Glute Bridge', [['barbell']], 'beginner'),
      c('D:Single Leg Glute Bridge', BW, 'beginner'),
      c('D:Butt Lift (Bridge)', BW),
      c('D:One-Legged Cable Kickback', [['cable']]),
    ],
  },
  hip_abduction: {
    label: 'Hip abduction',
    patterns: ['hip_abduction'],
    candidates: [c('D:Thigh Abductor', [['machine']]), c('C:Cable Hip Abduction', [['cable']]), c('C:Banded Lateral Walk', [['band']]), c('C:Fire Hydrant', BW)],
  },
  hip_adduction: {
    label: 'Hip adduction',
    patterns: ['hip_adduction'],
    candidates: [c('D:Thigh Adductor', [['machine']]), c('D:Cable Hip Adduction', [['cable']]), c('C:Copenhagen Plank', [['bench']], 'intermediate')],
  },
  calves: {
    label: 'Calf raise',
    patterns: ['calf_raise'],
    candidates: [
      c('D:Standing Calf Raises', [['machine']]),
      c('D:Seated Calf Raise', [['machine']]),
      c('D:Calf Press On The Leg Press Machine', [['machine']]),
      c('D:Smith Machine Calf Raise', [['smith_machine']]),
      c('D:Standing Dumbbell Calf Raise', [['dumbbell']]),
      c('C:Single-Leg Calf Raise', BW),
      c('C:Calf Raise', BW),
    ],
  },
  chest_press: {
    label: 'Chest press',
    patterns: ['horizontal_push'],
    candidates: [
      c('D:Barbell Bench Press - Medium Grip', [['barbell', 'bench', 'rack']], 'beginner'),
      c('D:Dumbbell Bench Press', [['dumbbell', 'bench']]),
      c('D:Machine Bench Press', [['machine']]),
      c('D:Leverage Chest Press', [['machine']]),
      c('D:Smith Machine Bench Press', [['smith_machine', 'bench']]),
      c('D:Cable Chest Press', [['cable']]),
      c('D:Pushups', BW, 'beginner'),
      c('N:kneeling-push-up', BW),
      c('D:Incline Push-Up', BW),
      c('N:wall-push-up', BW),
    ],
  },
  incline_press: {
    label: 'Incline press',
    patterns: ['incline_push'],
    candidates: [
      c('D:Incline Dumbbell Press', [['dumbbell', 'bench']]),
      c('D:Barbell Incline Bench Press - Medium Grip', [['barbell', 'bench', 'rack']], 'beginner'),
      c('D:Leverage Incline Chest Press', [['machine']]),
      c('D:Smith Machine Incline Bench Press', [['smith_machine', 'bench']]),
      c('D:Incline Cable Chest Press', [['cable', 'bench']]),
    ],
  },
  chest_fly: {
    label: 'Chest fly',
    patterns: ['chest_fly'],
    candidates: [
      c('D:Butterfly', [['machine']]),
      c('D:Cable Crossover', [['cable']]),
      c('D:Low Cable Crossover', [['cable']]),
      c('D:Dumbbell Flyes', [['dumbbell', 'bench']]),
      c('D:Incline Dumbbell Flyes', [['dumbbell', 'bench']]),
      c('D:Cross Over - With Bands', [['band']]),
    ],
  },
  shoulder_press: {
    label: 'Overhead press',
    patterns: ['vertical_push'],
    candidates: [
      c('D:Seated Dumbbell Press', [['dumbbell', 'bench']]),
      c('D:Dumbbell Shoulder Press', [['dumbbell']]),
      c('D:Machine Shoulder (Military) Press', [['machine']]),
      c('D:Standing Military Press', [['barbell', 'rack']], 'beginner'),
      c('D:Smith Machine Overhead Shoulder Press', [['smith_machine']]),
      c('C:Landmine Press', [['landmine'], ['barbell']], 'beginner'),
      c('D:Shoulder Press - With Bands', [['band']]),
      c('C:Pike Push-up', BW, 'intermediate'),
    ],
  },
  lateral_raise: {
    label: 'Lateral raise',
    patterns: ['shoulder_abduction'],
    candidates: [
      c('D:Side Lateral Raise', [['dumbbell']]),
      c('D:Standing Low-Pulley Deltoid Raise', [['cable']]),
      c('N:machine-lateral-raise', [['machine']]),
      c('D:Seated Side Lateral Raise', [['dumbbell', 'bench']]),
      c('D:Lateral Raise - With Bands', [['band']]),
    ],
  },
  rear_delt: {
    label: 'Rear delt',
    patterns: ['rear_delt'],
    candidates: [
      c('D:Face Pull', [['cable']]),
      c('D:Reverse Machine Flyes', [['machine']]),
      c('D:Reverse Flyes', [['dumbbell']]),
      c('D:Band Pull Apart', [['band']]),
      c('D:Cable Rear Delt Fly', [['cable']]),
      c('C:Prone Y-Raise', BW, 'beginner'),
    ],
  },
  vertical_pull: {
    label: 'Pull-up or pulldown',
    patterns: ['vertical_pull'],
    candidates: [
      c('D:Wide-Grip Lat Pulldown', [['cable']]),
      c('D:Close-Grip Front Lat Pulldown', [['cable']]),
      c('N:assisted-pull-up-machine', [['machine']]),
      c('D:Pullups', [['pullup_bar']], 'intermediate'),
      c('D:Chin-Up', [['pullup_bar']], 'intermediate'),
      c('D:Band Assisted Pull-Up', [['pullup_bar', 'band']], 'beginner'),
      c('D:Underhand Cable Pulldowns', [['cable']]),
    ],
  },
  horizontal_pull: {
    label: 'Row',
    patterns: ['horizontal_pull'],
    candidates: [
      c('D:Seated Cable Rows', [['cable']]),
      c('D:One-Arm Dumbbell Row', [['dumbbell', 'bench'], ['dumbbell']]),
      c('D:Dumbbell Incline Row', [['dumbbell', 'bench']]),
      c('D:Leverage Iso Row', [['machine']]),
      c('D:Bent Over Barbell Row', [['barbell']], 'intermediate'),
      c('D:T-Bar Row with Handle', [['barbell', 'landmine'], ['barbell']], 'intermediate'),
      c('D:Bent Over Two-Dumbbell Row', [['dumbbell']], 'beginner'),
      c('D:Inverted Row', [['rack'], ['smith_machine']], 'beginner'),
      c('D:Suspended Row', [['suspension'], ['rings']]),
      c('N:band-row', [['band']]),
    ],
  },
  biceps: {
    label: 'Biceps curl',
    patterns: ['elbow_flexion'],
    candidates: [
      c('D:Dumbbell Bicep Curl', [['dumbbell']]),
      c('D:Incline Dumbbell Curl', [['dumbbell', 'bench']]),
      c('D:Barbell Curl', [['barbell'], ['ez_bar']]),
      c('D:Standing Biceps Cable Curl', [['cable']]),
      c('D:Hammer Curls', [['dumbbell']]),
      c('D:Preacher Curl', [['barbell', 'bench'], ['ez_bar', 'bench']]),
      c('D:Machine Bicep Curl', [['machine']]),
      c('C:Band Bicep Curl', [['band']]),
    ],
  },
  triceps: {
    label: 'Triceps extension',
    patterns: ['elbow_extension', 'dip'],
    candidates: [
      c('D:Triceps Pushdown - Rope Attachment', [['cable']]),
      c('D:Cable Rope Overhead Triceps Extension', [['cable']]),
      c('D:Triceps Pushdown', [['cable']]),
      c('D:Standing Dumbbell Triceps Extension', [['dumbbell']]),
      c('D:Seated Triceps Press', [['dumbbell', 'bench']]),
      c('D:EZ-Bar Skullcrusher', [['ez_bar', 'bench'], ['barbell', 'bench']], 'beginner'),
      c('D:Machine Triceps Extension', [['machine']]),
      c('C:Band Triceps Extension', [['band']]),
      c('D:Bench Dips', [['bench']], 'beginner'),
    ],
  },
  abs: {
    label: 'Abs',
    patterns: ['core_flexion', 'core_anti_extension', 'hip_flexion'],
    candidates: [
      c('D:Cable Crunch', [['cable']]),
      c('D:Plank', BW),
      c('D:Dead Bug', BW),
      c('D:Reverse Crunch', BW),
      c('D:Hanging Leg Raise', [['pullup_bar']], 'intermediate'),
      c('D:Ab Roller', [['ab_wheel']], 'intermediate'),
      c('D:Crunches', BW),
      c('D:Ab Crunch Machine', [['machine']]),
    ],
  },
  obliques: {
    label: 'Side core',
    patterns: ['core_rotation', 'core_lateral'],
    candidates: [
      c('D:Pallof Press', [['cable']]),
      c('D:Side Bridge', BW),
      c('D:Standing Cable Wood Chop', [['cable']]),
      c('D:Dumbbell Side Bend', [['dumbbell']]),
      c('C:Half-Kneeling Pallof Press', [['cable'], ['band']]),
    ],
  },
  lower_back: {
    label: 'Back extension',
    patterns: ['back_extension'],
    candidates: [c('C:45-Degree Back Extension', [['machine']]), c('D:Hyperextensions (Back Extensions)', [['machine']]), c('D:Superman', BW), c('C:Bird Dog', BW)],
  },
  traps: {
    label: 'Shrug',
    patterns: ['shrug'],
    candidates: [c('D:Dumbbell Shrug', [['dumbbell']]), c('D:Barbell Shrug', [['barbell']]), c('D:Cable Shrugs', [['cable']]), c('D:Smith Machine Behind the Back Shrug', [['smith_machine']])],
  },
  carry: {
    label: 'Loaded carry',
    patterns: ['carry'],
    candidates: [c("D:Farmer's Walk", [['dumbbell'], ['kettlebell'], ['strongman']]), c('C:Suitcase Carry', [['dumbbell'], ['kettlebell']])],
  },
  cardio: {
    label: 'Cardio',
    patterns: ['cardio'],
    candidates: [
      c('N:brisk-walking', BW),
      c('N:incline-treadmill-walking', [['cardio_machine']]),
      c('D:Bicycling, Stationary', [['cardio_machine']]),
      c('D:Elliptical Trainer', [['cardio_machine']]),
      c('D:Rowing, Stationary', [['cardio_machine']]),
      c('D:Recumbent Bike', [['cardio_machine']]),
      c('N:swimming', [['other']]),
      c('D:Jogging, Treadmill', [['cardio_machine']], 'beginner'),
    ],
  },
  balance: {
    label: 'Balance',
    patterns: ['balance'],
    candidates: [c('N:single-leg-stand', BW), c('N:heel-to-toe-walk', BW)],
  },
};

/** Rank of each curated exercise inside its first slot (1 = first choice), written to the library. */
export function coreRanks(): Map<string, { slot: SlotKey; rank: number }> {
  const out = new Map<string, { slot: SlotKey; rank: number }>();
  for (const [slot, def] of Object.entries(CORE_SLOTS) as [SlotKey, SlotDef][]) {
    def.candidates.forEach((cand, i) => {
      if (!out.has(cand.key)) out.set(cand.key, { slot, rank: i + 1 });
    });
  }
  return out;
}
