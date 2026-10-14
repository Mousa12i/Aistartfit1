// Exercise taxonomy shared by the exercise library, the plan engine, recovery
// and the AI coach. One classifier turns any exercise (from the open dataset,
// the app's catalogue or a user's custom exercise) into precise muscles, a
// movement pattern, equipment and safety tags. Library exercises are classified
// once when the library is generated (see scripts/generate-training-library.mjs)
// and reviewed by hand through src/lib/training/overrides.ts; the same rules
// classify exercises that users create themselves.

import type { RecoveryMuscle } from '@/lib/recovery/muscles';

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'hip_thrust'
  | 'knee_extension'
  | 'knee_flexion'
  | 'calf_raise'
  | 'hip_adduction'
  | 'hip_abduction'
  | 'horizontal_push'
  | 'incline_push'
  | 'vertical_push'
  | 'chest_fly'
  | 'dip'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'pullover'
  | 'shoulder_abduction'
  | 'front_raise'
  | 'rear_delt'
  | 'rotator_cuff'
  | 'scapular'
  | 'shrug'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'wrist'
  | 'core_flexion'
  | 'core_anti_extension'
  | 'core_rotation'
  | 'core_lateral'
  | 'hip_flexion'
  | 'back_extension'
  | 'carry'
  | 'olympic'
  | 'plyometric'
  | 'conditioning'
  | 'cardio'
  | 'mobility'
  | 'balance'
  | 'neck'
  | 'other';

export const PATTERN_LABELS: Record<MovementPattern, string> = {
  squat: 'Squat',
  hinge: 'Hip hinge',
  lunge: 'Lunge / single leg',
  hip_thrust: 'Hip extension (glutes)',
  knee_extension: 'Knee extension',
  knee_flexion: 'Leg curl',
  calf_raise: 'Calf raise',
  hip_adduction: 'Hip adduction',
  hip_abduction: 'Hip abduction',
  horizontal_push: 'Horizontal press',
  incline_push: 'Incline press',
  vertical_push: 'Overhead press',
  chest_fly: 'Chest fly',
  dip: 'Dip',
  horizontal_pull: 'Row',
  vertical_pull: 'Pull-up / pulldown',
  pullover: 'Straight-arm pull',
  shoulder_abduction: 'Lateral raise',
  front_raise: 'Front raise',
  rear_delt: 'Rear delt',
  rotator_cuff: 'Rotator cuff',
  scapular: 'Shoulder-blade control',
  shrug: 'Shrug',
  elbow_flexion: 'Curl',
  elbow_extension: 'Triceps extension',
  wrist: 'Forearm / grip',
  core_flexion: 'Core flexion',
  core_anti_extension: 'Core bracing',
  core_rotation: 'Core rotation',
  core_lateral: 'Side core',
  hip_flexion: 'Leg raise',
  back_extension: 'Back extension',
  carry: 'Loaded carry',
  olympic: 'Olympic / power lift',
  plyometric: 'Jump / throw',
  conditioning: 'Conditioning',
  cardio: 'Cardio',
  mobility: 'Mobility / stretch',
  balance: 'Balance',
  neck: 'Neck',
  other: 'Other',
};

/** Patterns whose sets are not counted as resistance-training volume for a muscle group. */
export const NON_VOLUME_PATTERNS: readonly MovementPattern[] = ['cardio', 'mobility', 'balance', 'conditioning', 'plyometric', 'other'];

/** Muscles shown on an exercise that the recovery model does not track separately. */
export type ExtraMuscle = 'rotator_cuff' | 'serratus' | 'hip_flexors' | 'tibialis' | 'neck';

export const EXTRA_MUSCLE_LABELS: Record<ExtraMuscle, string> = {
  rotator_cuff: 'Rotator cuff',
  serratus: 'Serratus anterior',
  hip_flexors: 'Hip flexors',
  tibialis: 'Shin (tibialis anterior)',
  neck: 'Neck muscles',
};

export type EquipTag =
  | 'bodyweight'
  | 'dumbbell'
  | 'barbell'
  | 'ez_bar'
  | 'rack'
  | 'bench'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'smith_machine'
  | 'band'
  | 'pullup_bar'
  | 'dip_bars'
  | 'trap_bar'
  | 'landmine'
  | 'medicine_ball'
  | 'exercise_ball'
  | 'foam_roller'
  | 'ab_wheel'
  | 'box'
  | 'rings'
  | 'suspension'
  | 'sled'
  | 'strongman'
  | 'cardio_machine'
  | 'other';

export const EQUIP_LABELS: Record<EquipTag, string> = {
  bodyweight: 'Bodyweight',
  dumbbell: 'Dumbbells',
  barbell: 'Barbell',
  ez_bar: 'EZ bar',
  rack: 'Squat rack',
  bench: 'Bench',
  kettlebell: 'Kettlebell',
  cable: 'Cable machine',
  machine: 'Machine',
  smith_machine: 'Smith machine',
  band: 'Resistance band',
  pullup_bar: 'Pull-up bar',
  dip_bars: 'Dip bars',
  trap_bar: 'Trap bar',
  landmine: 'Landmine',
  medicine_ball: 'Medicine ball',
  exercise_ball: 'Exercise ball',
  foam_roller: 'Foam roller',
  ab_wheel: 'Ab wheel',
  box: 'Box / step',
  rings: 'Gymnastic rings',
  suspension: 'Suspension trainer',
  sled: 'Sled',
  strongman: 'Strongman implement',
  cardio_machine: 'Cardio machine',
  other: 'Other',
};

/** Movement features that matter when something hurts. Used as precautions, not diagnoses. */
export type SafetyFlag =
  | 'knee_loaded_flexion'
  | 'deep_hip_flexion'
  | 'impact'
  | 'spinal_load'
  | 'loaded_spinal_flexion'
  | 'overhead'
  | 'hanging'
  | 'dip'
  | 'behind_neck'
  | 'upright_row'
  | 'wrist_loaded_extension'
  | 'elbow_stress'
  | 'neck_load'
  | 'fall_risk'
  | 'high_skill';

export const SAFETY_FLAG_LABELS: Record<SafetyFlag, string> = {
  knee_loaded_flexion: 'Loaded knee bending',
  deep_hip_flexion: 'Deep hip bending',
  impact: 'Jumping or impact',
  spinal_load: 'Heavy load on the spine',
  loaded_spinal_flexion: 'Repeated or loaded spine bending',
  overhead: 'Arms overhead',
  hanging: 'Hanging from a bar',
  dip: 'Deep shoulder extension (dips)',
  behind_neck: 'Bar behind the neck',
  upright_row: 'Upright-row position',
  wrist_loaded_extension: 'Weight on bent-back wrists',
  elbow_stress: 'High elbow stress',
  neck_load: 'Load on the neck',
  fall_risk: 'Fall risk',
  high_skill: 'Needs coaching / high skill',
};

export type PainArea = 'shoulder' | 'elbow' | 'wrist' | 'neck' | 'upper_back' | 'lower_back' | 'hip' | 'knee' | 'ankle';

export const PAIN_AREA_LABELS: Record<PainArea, string> = {
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  wrist: 'Wrist / hand',
  neck: 'Neck',
  upper_back: 'Upper back',
  lower_back: 'Lower back',
  hip: 'Hip',
  knee: 'Knee',
  ankle: 'Ankle / foot',
};

/** Movement features avoided while an area hurts (conservative precautions, not treatment). */
export const PAIN_AREA_FLAGS: Record<PainArea, SafetyFlag[]> = {
  shoulder: ['overhead', 'dip', 'behind_neck', 'upright_row', 'hanging'],
  elbow: ['elbow_stress', 'dip'],
  wrist: ['wrist_loaded_extension'],
  neck: ['neck_load', 'behind_neck', 'spinal_load'],
  upper_back: ['spinal_load', 'neck_load'],
  lower_back: ['spinal_load', 'loaded_spinal_flexion', 'impact'],
  hip: ['deep_hip_flexion', 'impact'],
  knee: ['knee_loaded_flexion', 'impact'],
  ankle: ['impact'],
};

/** Muscle groups used for weekly volume targets (fine muscles roll up into these). */
export type MuscleGroupKey =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'traps'
  | 'lower_back'
  | 'forearms'
  | 'adductors';

export const MUSCLE_GROUPS: Record<MuscleGroupKey, { label: string; muscles: RecoveryMuscle[] }> = {
  chest: { label: 'Chest', muscles: ['upper_chest', 'lower_chest'] },
  back: { label: 'Back (lats & mid-back)', muscles: ['lats', 'mid_back'] },
  shoulders: { label: 'Shoulders (side & rear)', muscles: ['side_delts', 'rear_delts'] },
  biceps: { label: 'Biceps', muscles: ['biceps'] },
  triceps: { label: 'Triceps', muscles: ['triceps'] },
  quads: { label: 'Quadriceps', muscles: ['quads'] },
  hamstrings: { label: 'Hamstrings', muscles: ['hamstrings'] },
  glutes: { label: 'Glutes', muscles: ['glutes'] },
  calves: { label: 'Calves', muscles: ['calves'] },
  abs: { label: 'Abs & obliques', muscles: ['abs', 'obliques'] },
  traps: { label: 'Traps', muscles: ['traps'] },
  lower_back: { label: 'Lower back', muscles: ['lower_back'] },
  forearms: { label: 'Forearms', muscles: ['forearms'] },
  adductors: { label: 'Adductors', muscles: ['adductors'] },
};

/**
 * Fine muscle -> volume group. Front delts are trained by every press, so they are
 * tracked for recovery but not given their own weekly target.
 */
export const FINE_TO_GROUP: Partial<Record<RecoveryMuscle, MuscleGroupKey>> = {
  upper_chest: 'chest',
  lower_chest: 'chest',
  lats: 'back',
  mid_back: 'back',
  side_delts: 'shoulders',
  rear_delts: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  abs: 'abs',
  obliques: 'abs',
  traps: 'traps',
  lower_back: 'lower_back',
  forearms: 'forearms',
  adductors: 'adductors',
};

export interface ExerciseProfile {
  pattern: MovementPattern;
  primary: RecoveryMuscle[];
  secondary: RecoveryMuscle[];
  extra: ExtraMuscle[];
  equipment: EquipTag[];
  flags: SafetyFlag[];
  mechanic: 'compound' | 'isolation' | null;
  unilateral: boolean;
  /** How the classification was obtained: 'verified' = reviewed by hand, otherwise rule confidence. */
  confidence: 'verified' | 'high' | 'medium' | 'low';
}

export interface ClassifyInput {
  name: string;
  /** Muscles as reported by the open dataset (e.g. 'quadriceps', 'middle back'). */
  rawPrimary?: string[] | null;
  rawSecondary?: string[] | null;
  /** Coarse groups used by the app catalogue (e.g. 'legs', 'arms'). */
  coarsePrimary?: string | null;
  coarseSecondary?: string[] | null;
  equipment?: string | null;
  category?: string | null;
  mechanic?: string | null;
  force?: string | null;
  /** Pattern stored by the catalogue (e.g. 'hip_hinge'); used only when the name gives no answer. */
  patternHint?: string | null;
  /** Short description; only used to tell cable exercises from machines in the app catalogue. */
  description?: string | null;
}

// ---------------------------------------------------------------------------
// Pattern detection
// ---------------------------------------------------------------------------

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const has = (n: string, re: RegExp) => re.test(n);

function rawHas(list: string[] | null | undefined, muscle: string): boolean {
  return !!list && list.some((m) => m.toLowerCase() === muscle);
}

interface RuleCtx {
  n: string;
  category: string;
  rawPrimary: string[] | null;
  coarse: string;
  isolation: boolean;
}

interface Rule {
  re: RegExp;
  pattern: MovementPattern;
  /** Skip the rule when the name also matches this. */
  not?: RegExp;
  when?: (c: RuleCtx) => boolean;
}

const absPrimary = (c: RuleCtx) => rawHas(c.rawPrimary, 'abdominals') || (!c.rawPrimary && (c.coarse === 'core' || c.coarse === ''));

/**
 * Ordered rules: the first match wins, so specific movements come before generic words
 * ("snatch balance" before "balance", "neck press" before "neck", "leg press" before "press").
 */
const RULES: Rule[] = [
  // Stretching and mobility first: names like "Quad Stretch" mention muscles and other patterns.
  { re: /./, pattern: 'mobility', when: (c) => c.category === 'stretching' },
  { re: /\b(stretch|stretches|stretching|mobility|foam roll|smr|yoga|cat cow|worlds greatest|childs pose|cobra|downward dog|hip circles?|arm circles?|leg swings?|ankle circles?|thread the needle|90 90|pigeon|halo)\b/, pattern: 'mobility', not: /\bextension\b/ },

  // Olympic lifts and their drills (before "balance", "press", "squat", "deadlift").
  { re: /\b(snatch|clean|jerk|thrusters?|high pull|rack delivery|tire flip|muscle snatch|long cycle)\b/, pattern: 'olympic', not: /\b(clean grip|close grip|deadlifts?)\b/ },

  // Strongman events
  { re: /\b(atlas stones?|atlas stone trainer|atlas stone lift|keg load|sandbag load|power stairs|axle deadlift|car deadlift|rickshaw deadlift)\b/, pattern: 'hinge' },
  { re: /\b(conans wheel|yoke walk|farmers? walk|farmers|farmer s|carry|carries|suitcase walk|waiters? walk|rickshaw carry)\b/, pattern: 'carry' },
  { re: /\b(log lift|circus bell)\b/, pattern: 'vertical_push' },
  { re: /\b(sled overhead triceps|sled triceps)\b/, pattern: 'elbow_extension' },
  { re: /\bsled reverse fly/, pattern: 'rear_delt' },
  { re: /\bsled row\b/, pattern: 'horizontal_pull' },

  { re: /\b(balance board|downward facing balance|single leg balance|balance pad|stork stand|bosu balance|hip airplanes?)\b/, pattern: 'balance' },

  // Shoulder health
  { re: /\b(external rotation|internal rotation|cuban press|cuban rotation|rotator cuff|band dislocates?|arm bar|l fly)\b/, pattern: 'rotator_cuff', not: /\breverse fly/ },
  { re: /\b(incline shoulder raise|shoulder raise|scapular pull ups?|scap pull ups?|scapular push ups?|scap push ups?|serratus|wall slides?|scapular|scap retractions?)\b/, pattern: 'scapular' },

  // Cardio machines and locomotion (unless the dataset says it is ab work, e.g. hanging "Wind Sprints")
  { re: /./, pattern: 'cardio', when: (c) => c.category === 'cardio' && !rawHas(c.rawPrimary, 'abdominals') },
  {
    re: /\b(treadmill|jogging|jog|running|run|sprints?|cycling|bicycling|stationary bike|recumbent bike|assault bike|air bike machine|elliptical|stairmaster|stair climber|step mill|rowing stationary|rowing machine|rower|swim|swimming|walking|rope jumping|jump rope|skipping rope|trail running|hiking)\b/,
    pattern: 'cardio',
    not: /\b(lunges?|carry|farmer|sled|prowler|wind sprints?|lunge sprint|bench sprint|walking lunge|backward walk)\b/,
    when: (c) => !rawHas(c.rawPrimary, 'abdominals'),
  },

  { re: /\bshrugs?\b/, pattern: 'shrug' },

  // Hip hinge
  { re: /\b(deadlifts?|rdl|romanian|good mornings?|rack pulls?|stiff legged|stiff leg|stiff legs|pull throughs?|pullthrough|hip hinge)\b/, pattern: 'hinge' },
  { re: /\b(kettlebell swings?|swings?)\b/, pattern: 'hinge', not: /\b(sledgehammer|leg swings?|arm swings?)\b/ },

  // Conditioning
  {
    re: /\b(burpees?|jumping jacks?|mountain climbers?|high knees|bear crawl|spider crawl|crab walk|battle ropes?|battling ropes?|sled push|sled drags?|backward drag|forward drag|prowler|sprawls?|star jumps?|shadow box|shadow boxing|inchworms?|sledgehammer|man makers?|devil press|wall balls?|turkish get ups?|get ups?|kettlebell figure 8|pass between the legs|bear walk|backward walk|plank jacks?|sled pulls?)\b/,
    pattern: 'conditioning',
  },

  // Throws and jumps
  { re: /\b(medicine ball (slam|throw|toss|chest pass)|ball slams?|slams?|chest pass|overhead throw|scoop toss|side throw|rotational throw)\b/, pattern: 'plyometric' },
  { re: /./, pattern: 'plyometric', when: (c) => c.category === 'plyometrics' && !/\b(push ups?|leg raises?)\b/.test(c.n) && !(c.rawPrimary && rawHas(c.rawPrimary, 'abdominals') && /\btwist|rotation|chop/.test(c.n)) },
  { re: /\b(jumps?|jumping|hops?|hopping|bounds?|bounding|plyo|plyometrics?|depth jump|clap push|tuck jump|skater jumps?|box jump|broad jump|split jump|skips?|power skips?|depth drops?)\b/, pattern: 'plyometric' },

  { re: /\bneck\b/, pattern: 'neck', not: /\b(behind (the )?neck|to neck|neck press|neck smr)\b/ },

  // Core
  { re: /\bpush ups? to side plank\b/, pattern: 'horizontal_push' },
  { re: /\bcopenhagen\b/, pattern: 'hip_adduction' },
  { re: /\b(side planks?|side bridges?|side bends?|windmills?|suitcase crunch|side jackknife|oblique crunch(es)? side|heel touch|heel touches|heel touchers?)\b/, pattern: 'core_lateral' },
  {
    re: /\b(russian twists?|twists?|wood ?chops?|woodchoppers?|pallof|obliques?|cross body crunch|bicycle crunch|air bike|chops?|windshield wipers?|landmine 180s?|landmine rotations?|judo flip|cable lift|spell caster|torso rotation|rotational|cable rotations?|seated barbell twist|figure 8 rotation|crunch with rotation)\b/,
    pattern: 'core_rotation',
    not: /\b(wrist|shoulder|external rotation|internal rotation|push up|lunge|fly|flye|flyes)\b/,
  },
  { re: /\b(planks?|rollouts?|roll outs?|ab roller|ab wheel|dead bugs?|bird dogs?|hollow (hold|body|rock)|body saw|stir the pot|fallouts?|bear plank|ab rollout)\b/, pattern: 'core_anti_extension', not: /\b(push up to side plank|plank jacks?)\b/ },
  {
    re: /\b(leg raises?|knee raises?|hip raises?|toes to bar|toe to bar|l sits?|v ups?|jackknife|pikes?|leg pull ins?|pull ins?|knee tucks?|tuck crunch|reverse crunch|flutter kicks?|scissor kicks?|scissors|leg tucks?|butt ups?|bottoms ups?|wind sprints?|dragon flags?|captains chair|hanging knee|leg lowers?|knee ups?|tuck ups?|v sits?|v sit hold)\b/,
    pattern: 'hip_flexion',
    not: /\b(push ups?|press|squat|clean)\b/,
    when: (c) => absPrimary(c) || !c.rawPrimary,
  },
  { re: /\b(crunch|crunches|sit ups?|situps?|cocoons|otis ups?|elbow to knee|frog sit ups?|ab crunch machine|toe touchers?|toe touch|janda)\b/, pattern: 'core_flexion' },

  // Lower body
  { re: /\b(tibialis raises?|tib raises?|tibialis)\b/, pattern: 'other' },
  { re: /\b(calf|calves|heel raises?|donkey calf)\b/, pattern: 'calf_raise', not: /\bheel raise squat\b/ },
  { re: /\b(adductors?|adductions?|adduction)\b/, pattern: 'hip_adduction' },
  { re: /\b(abductors?|abductions?|abduction|monster walks?|band walks?|lateral band walk|lateral walk|clamshells?|clams|fire hydrants?|side lying leg raises?|side leg raises?|hip hike)\b/, pattern: 'hip_abduction' },
  { re: /\b(leg curls?|hamstring curls?|nordic|nordics|glute ham raise|natural glute ham|glute ham|ghr|ball leg curls?|slider curls?|hamstring slides?|manual hamstring|sliding leg curl)\b/, pattern: 'knee_flexion', not: /\breverse nordic\b/ },
  { re: /\b(leg extensions?|sissy squats?|reverse nordics?|spanish squat|terminal knee extensions?|knee extensions?)\b/, pattern: 'knee_extension' },
  { re: /\b(hyperextensions?|back extensions?|reverse hyper|reverse hyperextensions?|supermans?|prone back extension)\b/, pattern: 'back_extension' },
  {
    re: /\b(hip thrusts?|glute bridges?|bridges?|butt lift|hip lift|hip extensions?|glute kickbacks?|donkey kicks?|cable kickbacks?|kickbacks?|leg lift|frog pumps?|single leg glute bridge|flutter kicks?|reverse leg raise)\b/,
    pattern: 'hip_thrust',
    not: /\b(london bridges?|triceps?|tricep|wrestler|neck)\b/,
    when: (c) => !rawHas(c.rawPrimary, 'triceps') && !rawHas(c.rawPrimary, 'abdominals'),
  },
  {
    re: /\b(lunges?|lunging|split squats?|step ups?|stepups?|pistol|pistols|bulgarian|single leg( \w+)* squats?|one leg( \w+)* squats?|skater squat|shrimp squat|cossack|side split squat|lateral squat|step downs?|reverse lunge|curtsy|curtsey)\b/,
    pattern: 'lunge',
  },
  { re: /\b(squats?|squatting|leg press|hack squat|wall sits?|belt squat|pendulum squat|horse stance|sit to stand)\b/, pattern: 'squat' },

  // Upper body
  { re: /\b(straight arm|pullovers?|pull overs?)\b/, pattern: 'pullover', not: /\braise\b/ },
  { re: /\b(pushdowns?|push downs?|extensions?)\b/, pattern: 'pullover', when: (c) => rawHas(c.rawPrimary, 'lats') },
  {
    re: /\b(rear delt|rear deltoid|reverse fly|reverse flye|reverse flyes|reverse flys|reverse machine fly|reverse machine flyes|reverse pec deck|back flyes?|face pulls?|rear lateral|pull aparts?|ytw|y raise|t raise|prone raise|bent over low pulley side lateral|row to neck|swimmer raise|trap raise)\b/,
    pattern: 'rear_delt',
  },
  { re: /\bbent over\b.*\b(raise|lateral|laterals|fly|flye|flyes)\b/, pattern: 'rear_delt' },
  { re: /\b(car drivers|pirate ships|single dumbbell raise|straight raises on incline bench|plate raise|front delt raise above head)\b/, pattern: 'front_raise' },
  {
    re: /\b(upright( \w+)* rows?|lateral raises?|side lateral|side laterals|side raises?|lateral raise|deltoid raise|lu raises?|power partials|crucifix|scaption|lateral holds?|dumbbell raise|empty can)\b/,
    pattern: 'shoulder_abduction',
    not: /\bfront\b/,
  },
  { re: /\bfront\b.*\b(raises?|delt raise)\b/, pattern: 'front_raise', not: /\blever\b/ },
  { re: /\b(dips?|dip machine|dip assist)\b/, pattern: 'dip', not: /\b(jerk dip|hip dips?)\b/ },
  {
    re: /\b(wrist|wrists|finger curls?|grip|grippers?|wrist roller|pinch|plate hand squeeze|pronation|supination|forearm|dead hangs?|bar hang)\b/,
    pattern: 'wrist',
    not: /\b(close grip|wide grip|medium grip|neutral grip|reverse grip|underhand grip|overhand grip|v grip|mixed grip|narrow grip|hammer grip|parallel grip|pronated grip|supinated grip|snatch grip|rows?)\b/,
  },
  { re: /\bcurls?\b/, pattern: 'elbow_flexion', not: /\b(leg curls?|hamstring curl|wrist curl|nordic)\b/ },
  { re: /\b(jm press|tate press|french press|skull ?crushers?|skullcrushers?|body ups?|triceps press|tricep press|california press)\b/, pattern: 'elbow_extension' },
  {
    re: /\b(triceps?|pushdowns?|push downs?|kickbacks?|overhead extensions?|extension)\b/,
    pattern: 'elbow_extension',
    not: /\b(bench press|push ups?|pushups?|leg extension|back extension|hip extension)\b/,
    when: (c) => !(/\bpress\b/.test(c.n) && !c.isolation),
  },
  { re: /\b(flyes?|flys?|fly|crossovers?|cross overs?|pec deck|butterfly|chest squeeze|around the worlds|iron cross)\b/, pattern: 'chest_fly', not: /\b(reverse|rear|back fly)\b/ },
  {
    re: /\b(overhead press|military|shoulder press|arnold|push press|landmine press|pike push ups?|handstand push ups?|z press|bradford|behind the neck press|press behind neck|bent press|jammer|seesaw press|see saw press|viking press|wall walks?|anti gravity press)\b/,
    pattern: 'vertical_push',
  },
  { re: /\b(board press|pin press|pin presses|floor press|press from floor|neck press|guillotine press|spoto press|chest press|chain press|svend|push ups?|pushups?|press ups?|isometric wipers|planche|planches|planche lean)\b/, pattern: 'horizontal_push' },
  { re: /\bincline\b.*\b(press|bench)\b/, pattern: 'incline_push', not: /\b(pull|row|curl|fly|flye|raise)\b/ },
  { re: /\bbench press\b/, pattern: 'horizontal_push' },
  {
    re: /\b(pull ups?|pullups?|chin ups?|chinups?|chins|pulldowns?|pull downs?|lat pull|muscle ups?|rope climb|front lever|back lever|london bridges?|high pulley row|kneeling high pulley|chin|ring transition)\b/,
    not: /\bchin tucks?\b/,
    pattern: 'vertical_pull',
  },
  { re: /\b(rows?|rowing|seal row|t bar|meadows|pendlay|renegade|incline bench pull|bench pull|inverted row)\b/, pattern: 'horizontal_pull' },
  // Any other press: the reported primary muscle decides the direction.
  { re: /\b(press|presses)\b/, pattern: 'vertical_push', when: (c) => rawHas(c.rawPrimary, 'shoulders') || (!c.rawPrimary && c.coarse === 'shoulders') },
  { re: /\bincline\b.*\b(press|presses)\b/, pattern: 'incline_push', when: (c) => rawHas(c.rawPrimary, 'chest') || (!c.rawPrimary && c.coarse === 'chest') },
  { re: /\b(press|presses)\b/, pattern: 'horizontal_push', when: (c) => rawHas(c.rawPrimary, 'chest') || rawHas(c.rawPrimary, 'triceps') || (!c.rawPrimary && (c.coarse === 'chest' || c.coarse === 'arms')) },
];

const HINT_TO_PATTERN: Record<string, MovementPattern> = {
  hip_hinge: 'hinge',
  hinge: 'hinge',
  knee_dominant: 'squat',
  squat: 'squat',
  lunge: 'lunge',
  vertical_push: 'vertical_push',
  horizontal_pull: 'horizontal_pull',
  vertical_pull: 'vertical_pull',
  elbow_flexion: 'elbow_flexion',
  elbow_extension: 'elbow_extension',
  anti_extension: 'core_anti_extension',
  anti_flexion: 'core_anti_extension',
  isometric: 'core_anti_extension',
  trunk_rotation: 'core_rotation',
  rotation: 'core_rotation',
  anti_rotation: 'core_rotation',
  anti_lateral_flexion: 'core_lateral',
  trunk_flexion: 'core_flexion',
  flexion: 'core_flexion',
  mobility: 'mobility',
  cardio: 'cardio',
  carry: 'carry',
  calf_raise: 'calf_raise',
  shrug: 'shrug',
  knee_flexion: 'knee_flexion',
  knee_extension: 'knee_extension',
  hip_abduction: 'hip_abduction',
  wrist_extension: 'wrist',
  wrist_flexion: 'wrist',
};

const MUSCLE_FALLBACK: Record<string, MovementPattern> = {
  chest: 'horizontal_push',
  shoulders: 'vertical_push',
  lats: 'vertical_pull',
  'middle back': 'horizontal_pull',
  back: 'horizontal_pull',
  'lower back': 'back_extension',
  traps: 'shrug',
  biceps: 'elbow_flexion',
  triceps: 'elbow_extension',
  forearms: 'wrist',
  abdominals: 'core_flexion',
  core: 'core_flexion',
  quadriceps: 'squat',
  legs: 'squat',
  hamstrings: 'knee_flexion',
  glutes: 'hip_thrust',
  calves: 'calf_raise',
  adductors: 'hip_adduction',
  abductors: 'hip_abduction',
  neck: 'neck',
  cardio: 'cardio',
  full_body: 'conditioning',
};

/** Detect the movement pattern from the name, then fall back to catalogue hints and reported muscles. */
export function detectPattern(input: ClassifyInput): { pattern: MovementPattern; confidence: 'high' | 'medium' | 'low' } {
  const ctx: RuleCtx = {
    n: normalizeName(input.name),
    category: (input.category ?? '').toLowerCase(),
    rawPrimary: input.rawPrimary && input.rawPrimary.length ? input.rawPrimary : null,
    coarse: (input.coarsePrimary ?? '').toLowerCase(),
    isolation: (input.mechanic ?? '').toLowerCase() === 'isolation',
  };
  for (const rule of RULES) {
    if (!rule.re.test(ctx.n)) continue;
    if (rule.not && rule.not.test(ctx.n)) continue;
    if (rule.when && !rule.when(ctx)) continue;
    // An incline chest press is its own pattern (upper-chest emphasis), except incline push-ups,
    // where the hands are raised and the angle is not an incline press.
    if (rule.pattern === 'horizontal_push' && /\bincline\b/.test(ctx.n) && !/\b(push ups?|pushups?)\b/.test(ctx.n)) {
      return { pattern: 'incline_push', confidence: 'high' };
    }
    return { pattern: rule.pattern, confidence: 'high' };
  }
  const hint = (input.patternHint ?? '').toLowerCase();
  // The catalogue column defaulted to 'horizontal_push', so that hint is only trusted for chest work.
  if (hint === 'horizontal_push' && ctx.coarse === 'chest') return { pattern: 'horizontal_push', confidence: 'medium' };
  if (hint && HINT_TO_PATTERN[hint]) return { pattern: HINT_TO_PATTERN[hint], confidence: 'medium' };
  if (hint === 'abduction') return { pattern: ctx.coarse === 'shoulders' ? 'shoulder_abduction' : 'hip_abduction', confidence: 'medium' };
  const primary = (ctx.rawPrimary?.[0] ?? ctx.coarse).toLowerCase();
  if (MUSCLE_FALLBACK[primary]) return { pattern: MUSCLE_FALLBACK[primary], confidence: 'low' };
  return { pattern: 'other', confidence: 'low' };
}

// ---------------------------------------------------------------------------
// Muscles
// ---------------------------------------------------------------------------

/** Canonical muscles for each pattern, used when the source only gives coarse groups. */
export const PATTERN_MUSCLES: Record<MovementPattern, { primary: RecoveryMuscle[]; secondary: RecoveryMuscle[]; extra?: ExtraMuscle[] }> = {
  squat: { primary: ['quads', 'glutes'], secondary: ['adductors', 'lower_back'] },
  hinge: { primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'forearms'] },
  lunge: { primary: ['quads', 'glutes'], secondary: ['adductors'] },
  hip_thrust: { primary: ['glutes'], secondary: ['hamstrings'] },
  knee_extension: { primary: ['quads'], secondary: [] },
  knee_flexion: { primary: ['hamstrings'], secondary: [] },
  calf_raise: { primary: ['calves'], secondary: [] },
  hip_adduction: { primary: ['adductors'], secondary: [] },
  hip_abduction: { primary: ['glutes'], secondary: [] },
  horizontal_push: { primary: ['upper_chest', 'lower_chest'], secondary: ['front_delts', 'triceps'] },
  incline_push: { primary: ['upper_chest'], secondary: ['front_delts', 'triceps'] },
  vertical_push: { primary: ['front_delts'], secondary: ['side_delts', 'triceps'] },
  chest_fly: { primary: ['upper_chest', 'lower_chest'], secondary: ['front_delts'] },
  dip: { primary: ['lower_chest', 'triceps'], secondary: ['front_delts'] },
  horizontal_pull: { primary: ['mid_back', 'lats'], secondary: ['biceps', 'rear_delts'] },
  vertical_pull: { primary: ['lats'], secondary: ['biceps', 'mid_back'] },
  pullover: { primary: ['lats'], secondary: [] },
  shoulder_abduction: { primary: ['side_delts'], secondary: ['traps'] },
  front_raise: { primary: ['front_delts'], secondary: [] },
  rear_delt: { primary: ['rear_delts'], secondary: ['mid_back', 'traps'] },
  rotator_cuff: { primary: [], secondary: [], extra: ['rotator_cuff'] },
  scapular: { primary: [], secondary: [], extra: ['serratus'] },
  shrug: { primary: ['traps'], secondary: [] },
  elbow_flexion: { primary: ['biceps'], secondary: ['forearms'] },
  elbow_extension: { primary: ['triceps'], secondary: [] },
  wrist: { primary: ['forearms'], secondary: [] },
  core_flexion: { primary: ['abs'], secondary: [] },
  core_anti_extension: { primary: ['abs'], secondary: ['obliques'] },
  core_rotation: { primary: ['obliques'], secondary: ['abs'] },
  core_lateral: { primary: ['obliques'], secondary: ['abs'] },
  hip_flexion: { primary: ['abs'], secondary: ['obliques'], extra: ['hip_flexors'] },
  back_extension: { primary: ['lower_back'], secondary: ['glutes', 'hamstrings'] },
  carry: { primary: ['forearms', 'traps'], secondary: ['obliques', 'abs'] },
  olympic: { primary: ['quads', 'glutes', 'hamstrings'], secondary: ['traps', 'front_delts', 'lower_back'] },
  plyometric: { primary: ['quads', 'glutes'], secondary: ['calves', 'hamstrings'] },
  conditioning: { primary: [], secondary: [] },
  cardio: { primary: [], secondary: [] },
  mobility: { primary: [], secondary: [] },
  balance: { primary: [], secondary: [] },
  neck: { primary: [], secondary: [], extra: ['neck'] },
  other: { primary: [], secondary: [] },
};

const CHEST_PATTERNS: MovementPattern[] = ['horizontal_push', 'incline_push', 'chest_fly', 'dip'];
const PUSH_UP = /\b(push ups?|pushups?|press ups?)\b/;

/** Map one dataset muscle name to fine recovery muscles, using the pattern for ambiguous groups. */
export function rawMuscleToFine(raw: string, pattern: MovementPattern, name: string): RecoveryMuscle[] {
  const n = normalizeName(name);
  switch (raw.toLowerCase()) {
    case 'chest':
      // Push-up angle (hands or feet raised) is not the same thing as an incline/decline press,
      // so push-ups are credited to the whole chest.
      if (PUSH_UP.test(n)) return ['upper_chest', 'lower_chest'];
      if (pattern === 'incline_push' || has(n, /\bincline\b/)) return ['upper_chest'];
      if (pattern === 'dip' || has(n, /\bdecline\b/)) return ['lower_chest'];
      return ['upper_chest', 'lower_chest'];
    case 'shoulders':
      if (pattern === 'shoulder_abduction') return ['side_delts'];
      if (pattern === 'rear_delt' || pattern === 'horizontal_pull' || pattern === 'vertical_pull' || pattern === 'pullover') return ['rear_delts'];
      if (pattern === 'vertical_push' || pattern === 'front_raise' || CHEST_PATTERNS.includes(pattern)) return ['front_delts'];
      if (pattern === 'rotator_cuff' || pattern === 'scapular') return [];
      return ['front_delts'];
    case 'lats':
      return ['lats'];
    case 'middle back':
      return ['mid_back'];
    case 'lower back':
      return ['lower_back'];
    case 'traps':
      return ['traps'];
    case 'neck':
      return [];
    case 'biceps':
      return ['biceps'];
    case 'triceps':
      return ['triceps'];
    case 'forearms':
      return ['forearms'];
    case 'abdominals':
      return pattern === 'core_rotation' || pattern === 'core_lateral' ? ['obliques'] : ['abs'];
    case 'quadriceps':
      return ['quads'];
    case 'hamstrings':
      return ['hamstrings'];
    case 'glutes':
    case 'abductors':
      return ['glutes'];
    case 'calves':
      return ['calves'];
    case 'adductors':
      return ['adductors'];
    default:
      return [];
  }
}

function uniq<T>(list: T[]): T[] {
  return [...new Set(list)];
}

/** Fine muscles from the dataset's reported muscles, or from the pattern when only coarse groups exist. */
export function resolveMuscles(input: ClassifyInput, pattern: MovementPattern): { primary: RecoveryMuscle[]; secondary: RecoveryMuscle[]; extra: ExtraMuscle[] } {
  const base = PATTERN_MUSCLES[pattern];
  const extra: ExtraMuscle[] = [...(base.extra ?? [])];
  const n = normalizeName(input.name);
  if (has(n, /\b(tibialis|tib raises?)\b/)) return { primary: [], secondary: [], extra: ['tibialis'] };
  if (input.rawPrimary && input.rawPrimary.length > 0) {
    let primary = uniq(input.rawPrimary.flatMap((m) => rawMuscleToFine(m, pattern, input.name)));
    let secondary = uniq((input.rawSecondary ?? []).flatMap((m) => rawMuscleToFine(m, pattern, input.name))).filter((m) => !primary.includes(m));
    if (input.rawPrimary.some((m) => m.toLowerCase() === 'neck') && !extra.includes('neck')) extra.push('neck');
    if (pattern === 'vertical_push' && !primary.includes('side_delts') && !secondary.includes('side_delts')) secondary.push('side_delts');
    if (pattern === 'rotator_cuff' || pattern === 'scapular') {
      // The dataset lists "shoulders"; the working muscles here are the cuff / serratus.
      primary = [];
      secondary = secondary.filter((m) => m === 'traps' || m === 'mid_back' || m === 'rear_delts');
    }
    // The dataset tags calves (and, for squats, hamstrings) on many lower-body lifts. They only
    // stabilise there and squats do not grow the hamstrings (Kubo et al. 2019), so they are not
    // credited with training volume.
    if (pattern === 'squat' || pattern === 'lunge' || pattern === 'hinge' || pattern === 'hip_thrust') secondary = secondary.filter((m) => m !== 'calves');
    if (pattern === 'squat') secondary = secondary.filter((m) => m !== 'hamstrings');
    return { primary, secondary, extra };
  }
  let primary = [...base.primary];
  let secondary = [...base.secondary];
  if (pattern === 'horizontal_push' && has(n, /\bdecline\b/) && !PUSH_UP.test(n)) primary = ['lower_chest'];
  if (pattern === 'horizontal_push' && has(n, /\b(close grip|narrow|diamond|triceps)\b/)) {
    primary = ['triceps', 'lower_chest'];
    secondary = ['upper_chest', 'front_delts'];
  }
  if (pattern === 'hinge' && has(n, /\b(deadlifts?|rack pulls?)\b/) && !has(n, /\b(romanian|rdl|stiff|single leg|one leg)\b/)) {
    primary = ['glutes', 'hamstrings', 'lower_back'];
    secondary = ['quads', 'traps', 'forearms'];
  }
  if (pattern === 'squat' && has(n, /\b(front squat|goblet|leg press|hack)\b/)) secondary = ['adductors'];
  if (pattern === 'elbow_flexion' && has(n, /\b(hammer|reverse|zottman)\b/)) secondary = ['forearms'];
  if (pattern === 'core_anti_extension' && has(n, /\b(rollout|roll out|ab wheel|ab roller)\b/)) secondary = ['obliques', 'lats'];
  if (pattern === 'plyometric') {
    if (has(n, /\b(push ups?|pushups?|chest pass|chest push|chest throw)\b/)) {
      primary = ['upper_chest', 'lower_chest'];
      secondary = ['front_delts', 'triceps'];
    } else if (has(n, /\b(slams?|overhead throw)\b/)) {
      primary = ['lats', 'abs'];
      secondary = ['front_delts', 'triceps'];
    } else if (has(n, /\b(rotational|side throw|scoop)\b/)) {
      primary = ['obliques'];
      secondary = ['abs', 'glutes'];
    }
  }
  return { primary, secondary: secondary.filter((m) => !primary.includes(m)), extra };
}

// ---------------------------------------------------------------------------
// Equipment and safety
// ---------------------------------------------------------------------------

const SOURCE_EQUIP: Record<string, EquipTag> = {
  'body only': 'bodyweight',
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  kettlebells: 'kettlebell',
  bands: 'band',
  cable: 'cable',
  machine: 'machine',
  'e-z curl bar': 'ez_bar',
  'exercise ball': 'exercise_ball',
  'medicine ball': 'medicine_ball',
  'foam roll': 'foam_roller',
  // App catalogue values
  none: 'bodyweight',
  dumbbells: 'dumbbell',
  kettlebell: 'kettlebell',
  pull_up_bar: 'pullup_bar',
  resistance_bands: 'band',
  bench: 'bench',
};

const CABLE_WORDS = /\b(cable|cables|pulley|rope attachment|lat pulldown|pulldowns?|face pulls?|pushdowns?|push downs?|pallof|woodchoppers?|wood chops?)\b/;

export function resolveEquipment(input: ClassifyInput, pattern: MovementPattern): EquipTag[] {
  const n = normalizeName(input.name);
  const tags = new Set<EquipTag>();
  const sourceEquip = (input.equipment ?? '').toLowerCase();
  const base = SOURCE_EQUIP[sourceEquip];
  if (base) tags.add(base);

  if (has(n, /\bsmith\b/)) {
    tags.delete('machine');
    tags.delete('barbell');
    tags.add('smith_machine');
  }
  const cableByName =
    CABLE_WORDS.test(n) ||
    (has(n, /\bv bar\b/) && has(n, /\b(pulldowns?|pushdowns?|rows?)\b/)) ||
    (pattern === 'chest_fly' && has(n, /\b(crossovers?|cross overs?)\b/));
  // The app catalogue had no "cable" option, so its cable exercises were stored as "machine".
  const cableByDescription = sourceEquip === 'machine' && /\bcable\b/i.test(input.description ?? '');
  if ((cableByName || cableByDescription) && !has(n, /\bbands?\b/)) {
    tags.delete('machine');
    tags.add('cable');
  }
  if (
    has(n, /\b(leverage|machine|leg press|hack squat|pec deck|butterfly|leg extensions?|leg curls?|seated calf raise|thigh abductor|thigh adductor|pendulum squat|belt squat|assisted)\b/) &&
    !has(n, /\b(barbell|dumbbell|bands?|banded|ball|slider|nordic|stability)\b/) &&
    !tags.has('smith_machine') &&
    !tags.has('cable')
  ) {
    tags.add('machine');
  }
  if (has(n, /\bdumbbells?\b/)) tags.add('dumbbell');
  if (has(n, /\bbarbell\b/) && !tags.has('smith_machine')) tags.add('barbell');
  if (has(n, /\b(ez bar|e z bar|ez curl|ez barbell)\b/)) {
    tags.delete('barbell');
    tags.add('ez_bar');
  }
  if (has(n, /\bkettlebells?\b/)) tags.add('kettlebell');
  if (has(n, /\b(bands?|banded)\b/)) {
    tags.add('band');
    if (has(n, /\bassisted\b/)) tags.delete('machine');
  }
  if (has(n, /\b(trap bar|hex bar)\b/)) {
    tags.delete('barbell');
    tags.add('trap_bar');
  }
  if (has(n, /\b(landmine|meadows row|t bar row)\b/)) tags.add('landmine');
  if (has(n, /\b(medicine ball|med ball|wall balls?)\b/)) tags.add('medicine_ball');
  if (has(n, /\b(exercise ball|stability ball|swiss ball|physioball|on ball|ball crunch|ball pull ins?|ball leg curl)\b/)) tags.add('exercise_ball');
  if (has(n, /\b(ab roller|ab wheel)\b/)) tags.add('ab_wheel');
  if (has(n, /\brings?\b/)) tags.add('rings');
  if (has(n, /\b(suspended|suspension|trx)\b/)) tags.add('suspension');
  if (has(n, /\b(sled|prowler|backward drag|forward drag)\b/)) {
    tags.delete('other');
    tags.delete('bodyweight');
    tags.add('sled');
  }
  if (has(n, /\b(atlas stones?|keg|sandbag|yoke|log|conans wheel|tire flip|circus bell|axle|power stairs|car deadlift|rickshaw)\b/)) {
    tags.delete('other');
    tags.delete('bodyweight');
    tags.add('strongman');
  }
  if (has(n, /\b(box jumps?|box squat|step ups?|box skip|box jump|step downs?)\b/) && !tags.has('barbell')) tags.add('box');
  if (pattern === 'vertical_pull' && !tags.has('cable') && !tags.has('machine')) {
    tags.delete('other');
    tags.add('pullup_bar');
  }
  if (has(n, /\b(hanging|toes to bar|toe to bar|front lever|back lever|muscle ups?|dead hangs?|gorilla chin|windshield wipers?)\b/) && !has(n, /\bhanging bar\b/)) tags.add('pullup_bar');
  if (pattern === 'dip' && !has(n, /\b(bench dips?|dips? on bench|machine|assisted|rings?)\b/)) tags.add('dip_bars');
  if (pattern === 'dip' && has(n, /\b(bench dips?|dips? on bench|bench dip)\b/)) tags.add('bench');
  if (pattern === 'cardio' && has(n, /\b(treadmill|stationary|recumbent|elliptical|stairmaster|step mill|rowing|rower|assault)\b/)) {
    tags.delete('machine');
    tags.add('cardio_machine');
  }

  const usesBar = tags.has('barbell') || tags.has('ez_bar');
  if (tags.has('barbell') && (pattern === 'squat' || pattern === 'lunge' || pattern === 'vertical_push') && !has(n, /\b(landmine|jammer|from floor|hack squat|anti gravity)\b/)) tags.add('rack');
  if (
    has(n, /\b(bench press|incline|decline|preacher|lying|flat bench|on a bench|over a bench|bench|seated|spider curl)\b/) &&
    (usesBar || tags.has('dumbbell') || tags.has('kettlebell')) &&
    !tags.has('machine') &&
    !tags.has('smith_machine') &&
    !tags.has('cable') &&
    !has(n, /\b(lying on the floor|floor press|bench pull)\b/)
  ) {
    tags.add('bench');
  }
  if (has(n, /\bbench press\b/)) {
    tags.add('bench');
    if (tags.has('barbell')) tags.add('rack');
  }
  if (has(n, /\b(board press|spoto press|pin press|pin presses|guillotine)\b/)) {
    tags.add('bench');
    tags.add('rack');
  }
  if (pattern === 'chest_fly' && tags.has('dumbbell') && !has(n, /\bstanding\b/)) tags.add('bench');
  if (pattern === 'hip_thrust' && tags.has('barbell') && has(n, /\bthrusts?\b/)) tags.add('bench');
  if (tags.has('rings')) tags.delete('dip_bars');

  if (tags.size > 1) tags.delete('bodyweight');
  if (tags.size > 1) tags.delete('other');
  if (tags.size === 0) tags.add(pattern === 'cardio' || pattern === 'mobility' || pattern === 'balance' || pattern === 'conditioning' || pattern === 'plyometric' ? 'bodyweight' : 'other');
  return [...tags];
}

const LOWER_BODY: RecoveryMuscle[] = ['quads', 'hamstrings', 'glutes', 'calves', 'adductors'];

export function resolveFlags(
  input: ClassifyInput,
  pattern: MovementPattern,
  equipment: EquipTag[],
  muscles: { primary: RecoveryMuscle[]; secondary: RecoveryMuscle[] } = { primary: [], secondary: [] },
): SafetyFlag[] {
  const n = normalizeName(input.name);
  const flags = new Set<SafetyFlag>();
  const heavyBar = equipment.includes('barbell') || equipment.includes('trap_bar') || equipment.includes('smith_machine') || equipment.includes('strongman');
  const lowerBodyWork = [...muscles.primary, ...muscles.secondary].some((m) => LOWER_BODY.includes(m));

  if (pattern === 'squat' || pattern === 'lunge' || has(n, /\b(sissy squat|pistol|spanish squat)\b/)) {
    flags.add('knee_loaded_flexion');
    if (!has(n, /\b(wall sits?|step ups?|leg extension|sissy squat|sit to stand)\b/)) flags.add('deep_hip_flexion');
  }
  if (pattern === 'olympic') {
    flags.add('knee_loaded_flexion');
    flags.add('spinal_load');
    flags.add('high_skill');
  }
  // Impact: jumps, bounds and running. Throws, passes and plyometric push-ups do not land on the legs.
  if (pattern === 'plyometric' && lowerBodyWork && !has(n, /\b(push ups?|pushups?|chest pass|chest push|throw|toss|slams?|medicine ball)\b/)) flags.add('impact');
  if (pattern === 'conditioning' && has(n, /\b(burpees?|jumping jacks?|high knees|star jumps?|sprawls?|man makers?|devil press|wall balls?|plank jacks?)\b/)) flags.add('impact');
  if (pattern === 'cardio' && has(n, /\b(running|run|jog|jogging|sprints?|rope jumping|jump rope|skipping)\b/) && !has(n, /\b(bike|cycling|rowing|rower|elliptical|prowler)\b/)) flags.add('impact');
  if (pattern === 'plyometric' && has(n, /\b(box|depth|hurdle)\b/)) flags.add('fall_risk');

  if (heavyBar && (pattern === 'squat' || pattern === 'hinge' || pattern === 'lunge' || pattern === 'carry') && !has(n, /\bleg press\b/)) flags.add('spinal_load');
  if (pattern === 'hinge' && equipment.includes('machine') && has(n, /\bdeadlifts?\b/)) flags.add('spinal_load');
  if (pattern === 'horizontal_pull' && heavyBar && !has(n, /\b(lying|seal|inverted|bench|chest supported|incline|smith machine)\b/) && has(n, /\b(bent over|pendlay|yates|barbell row|rows? from hang|complex row|underhand barbell|long bar)\b/)) flags.add('spinal_load');
  if (pattern === 'vertical_push' && heavyBar && (has(n, /\b(standing|push press|log|circus)\b/) || (has(n, /\bmilitary\b/) && !has(n, /\bseated\b/)))) flags.add('spinal_load');
  if (has(n, /\b(sit ups?|situps?|v ups?|jackknife|toe touch|decline crunch|weighted crunch)\b/) || (has(n, /\brussian twists?\b/) && !equipment.includes('cable'))) flags.add('loaded_spinal_flexion');

  const overheadByName =
    has(n, /\b(overhead|over head|french press|behind the head|handstand|jerk|thrusters?|turkish get ups?|halo|wall balls?)\b/) ||
    (has(n, /\bsnatch\b/) && !has(n, /\b(deadlift|pull|shrug)\b/)) ||
    (pattern === 'olympic' && has(n, /\bpress\b/));
  if (pattern === 'vertical_push' || (pattern === 'pullover' && !has(n, /\bpulldowns?\b/)) || (overheadByName && pattern !== 'elbow_flexion')) flags.add('overhead');
  if (pattern === 'vertical_pull' && !equipment.includes('cable') && !equipment.includes('machine')) flags.add('hanging');
  if (has(n, /\b(hanging|toes to bar|toe to bar|front lever|back lever|muscle ups?|dead hangs?|wind sprints?|gorilla chin|windshield wipers?)\b/) && !has(n, /\bhanging bar\b/)) flags.add('hanging');
  if (pattern === 'dip') flags.add('dip');
  if (has(n, /\b(behind the neck|behind neck)\b/)) flags.add('behind_neck');
  if (has(n, /\b(upright( \w+)* rows?|high pull|cuban press|dumbbell raise)\b/) && !has(n, /\b(front|single dumbbell raise)\b/)) flags.add('upright_row');
  if (
    has(n, /\b(push ups?|pushups?|press ups?|handstand|planche|crawl|mountain climbers?|burpees?|plank jacks?|bear plank|man makers?|devil press|renegade|isometric wipers|shoulder taps?|up downs?|plank reach|high plank)\b/) ||
    (has(n, /\bfront squat\b/) && equipment.includes('barbell'))
  ) {
    flags.add('wrist_loaded_extension');
  }
  if ((pattern === 'elbow_extension' && has(n, /\b(skull ?crushers?|skullcrushers?|lying|french press|jm press)\b/)) || pattern === 'dip') flags.add('elbow_stress');
  if (pattern === 'neck' || has(n, /\b(headstand|wrestler bridge|neck bridge)\b/)) flags.add('neck_load');
  if (
    has(n, /\b(handstand|planche|front lever|back lever|muscle ups?|pistol|one arm push|single arm push|one arm chin|archer|human flag|dragon flag|snatch|clean and jerk|turkish get ups?|bent press|atlas|keg|log|circus bell|tire flip|conans wheel|yoke|power stairs|depth jump)\b/) ||
    (has(n, /\biron cross\b/) && !equipment.includes('cable'))
  ) {
    flags.add('high_skill');
  }
  if (has(n, /\b(handstand|box jumps?|depth jump|bosu|single leg high box|hurdle|wall walks?)\b/)) flags.add('fall_risk');
  return [...flags];
}

const COMPOUND_PATTERNS: MovementPattern[] = [
  'squat',
  'hinge',
  'lunge',
  'horizontal_push',
  'incline_push',
  'vertical_push',
  'dip',
  'horizontal_pull',
  'vertical_pull',
  'olympic',
  'carry',
];

export function isUnilateral(name: string): boolean {
  return has(normalizeName(name), /\b(one arm|single arm|one leg|one legged|single leg|alternating|alternate|unilateral|split squats?|lunges?|step ups?|step downs?|pistols?|bulgarian|kneeling single|single|suitcase)\b/);
}

/** Full classification of any exercise from its name and source fields. */
export function classifyExercise(input: ClassifyInput): ExerciseProfile {
  const { pattern, confidence } = detectPattern(input);
  const muscles = resolveMuscles(input, pattern);
  const equipment = resolveEquipment(input, pattern);
  const flags = resolveFlags(input, pattern, equipment, muscles);
  const mech = (input.mechanic ?? '').toLowerCase();
  const mechanic: ExerciseProfile['mechanic'] =
    mech === 'compound' || mech === 'isolation'
      ? (mech as 'compound' | 'isolation')
      : COMPOUND_PATTERNS.includes(pattern)
        ? 'compound'
        : NON_VOLUME_PATTERNS.includes(pattern)
          ? null
          : 'isolation';
  return {
    pattern,
    primary: muscles.primary,
    secondary: muscles.secondary,
    extra: muscles.extra,
    equipment,
    flags,
    mechanic,
    unilateral: isUnilateral(input.name),
    confidence,
  };
}

/**
 * Weekly-volume contribution of one set to each muscle group: 1 for a muscle trained directly
 * (primary), 0.5 for a muscle trained indirectly (secondary). This "fractional" way of counting
 * sets is the one that best explained hypertrophy and strength outcomes in Pelland et al. 2026.
 */
export function groupContributions(profile: Pick<ExerciseProfile, 'pattern' | 'primary' | 'secondary'>): Partial<Record<MuscleGroupKey, number>> {
  if (NON_VOLUME_PATTERNS.includes(profile.pattern)) return {};
  const out: Partial<Record<MuscleGroupKey, number>> = {};
  for (const m of profile.primary) {
    const g = FINE_TO_GROUP[m];
    if (g) out[g] = 1;
  }
  for (const m of profile.secondary) {
    const g = FINE_TO_GROUP[m];
    if (g && out[g] === undefined) out[g] = 0.5;
  }
  return out;
}
