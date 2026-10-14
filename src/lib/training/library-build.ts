// Builds the reviewed exercise library from its three sources (open dataset, app
// catalogue, StartFit additions). Used by scripts/generate-training-library.mjs to
// write the library migration, and by the library tests to check every entry.

import type { RecoveryMuscle } from '@/lib/recovery/muscles';
import {
  classifyExercise,
  normalizeName,
  NON_VOLUME_PATTERNS,
  type EquipTag,
  type ExerciseProfile,
  type MovementPattern,
} from './taxonomy';
import { DUPLICATES, EXTRA_ALIASES, PROFILE_OVERRIDES } from './library-overrides';
import { LIBRARY_ADDITIONS } from './library-additions';
import { coreRanks, type SlotKey } from './curated';

export interface DatasetExercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

export interface CatalogExercise {
  name: string;
  description: string | null;
  primary_muscle: string;
  secondary_muscles: string[] | null;
  equipment: string;
  difficulty: string;
  movement_pattern: string | null;
  exercise_type: string | null;
  category: string | null;
  instructions?: string[];
}

export interface Prescription {
  sets: number;
  reps: string;
  restSeconds: number;
}

export interface LibraryEntry {
  key: string;
  sourceId: string;
  origin: 'dataset' | 'catalog' | 'startfit';
  name: string;
  description: string | null;
  instructions: string[];
  safetyNotes: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  coarsePrimary: string;
  coarseSecondary: string[];
  legacyEquipment: string;
  forceType: string | null;
  rawPrimary: string[] | null;
  rawSecondary: string[] | null;
  imageUrls: string[];
  profile: ExerciseProfile;
  hidden: boolean;
  canonicalKey: string | null;
  aliases: string[];
  coreSlot: SlotKey | null;
  coreRank: number | null;
  prescription: Prescription;
}

export const DATASET_IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export function slugify(name: string): string {
  return normalizeName(name).replace(/ /g, '-');
}

const FINE_TO_COARSE: Record<RecoveryMuscle, string> = {
  upper_chest: 'chest',
  lower_chest: 'chest',
  front_delts: 'shoulders',
  side_delts: 'shoulders',
  rear_delts: 'shoulders',
  traps: 'shoulders',
  lats: 'back',
  mid_back: 'back',
  lower_back: 'back',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  abs: 'core',
  obliques: 'core',
  quads: 'legs',
  hamstrings: 'legs',
  calves: 'legs',
  adductors: 'legs',
  glutes: 'glutes',
};

/** Legacy single-value muscle group (still used by older screens and functions). */
export function coarseGroups(profile: Pick<ExerciseProfile, 'pattern' | 'primary' | 'secondary'>): { primary: string; secondary: string[] } {
  if (profile.pattern === 'cardio') return { primary: 'cardio', secondary: [] };
  const primaryFine = profile.primary[0];
  const primary = primaryFine ? FINE_TO_COARSE[primaryFine] : profile.pattern === 'mobility' || profile.pattern === 'balance' ? 'full_body' : 'full_body';
  const secondary = [...new Set([...profile.primary.slice(1), ...profile.secondary].map((m) => FINE_TO_COARSE[m]))].filter((g) => g !== primary);
  return { primary, secondary };
}

const LEGACY_EQUIPMENT_ORDER: [EquipTag, string][] = [
  ['barbell', 'barbell'],
  ['ez_bar', 'barbell'],
  ['trap_bar', 'barbell'],
  ['smith_machine', 'machine'],
  ['machine', 'machine'],
  ['cable', 'machine'],
  ['cardio_machine', 'machine'],
  ['dumbbell', 'dumbbells'],
  ['kettlebell', 'kettlebell'],
  ['band', 'resistance_bands'],
  ['pullup_bar', 'pull_up_bar'],
  ['bench', 'bench'],
  ['bodyweight', 'none'],
];

export function legacyEquipment(tags: EquipTag[]): string {
  for (const [tag, legacy] of LEGACY_EQUIPMENT_ORDER) if (tags.includes(tag)) return legacy;
  return 'other';
}

const HOLD = /\b(planks?|hold|holds|hollow|l sit|v sit|wall sits?|dead hang|horse stance|squat hold|levers?|planche|crucifix|side bridge|isometric|single leg stand)\b/;

/** Multi-joint patterns (prescribed like compound lifts) and single-joint patterns (like accessories). */
export const COMPOUND_LIFT_PATTERNS: MovementPattern[] = ['squat', 'hinge', 'lunge', 'horizontal_push', 'incline_push', 'vertical_push', 'dip', 'horizontal_pull', 'vertical_pull'];

/** Hip thrusts and bridges are loaded like compound lifts; kickbacks and leg lifts are accessories. */
function isHeavyHipExtension(profile: ExerciseProfile, name: string): boolean {
  return profile.pattern === 'hip_thrust' && /\b(thrusts?|bridges?|butt lift|hip lift)\b/.test(normalizeName(name));
}
export const ISOLATION_LIFT_PATTERNS: MovementPattern[] = [
  'knee_extension',
  'knee_flexion',
  'calf_raise',
  'hip_adduction',
  'hip_abduction',
  'chest_fly',
  'pullover',
  'shoulder_abduction',
  'front_raise',
  'rear_delt',
  'shrug',
  'elbow_flexion',
  'elbow_extension',
  'wrist',
  'back_extension',
];

/**
 * A sensible starting prescription for an exercise shown on its page. Strength work follows the
 * ACSM 2009 position stand (8–12 repetitions for multi-joint lifts with 2–3 min rest, lighter
 * assistance work with 1–2 min rest); flexibility holds follow ACSM 2011 (10–30 s); power and
 * Olympic lifts use 3–6 repetitions (ACSM 2009). Plans built by the engine replace these with
 * goal-specific numbers.
 */
export function defaultPrescription(profile: ExerciseProfile, name: string): Prescription {
  const n = normalizeName(name);
  const side = profile.unilateral && !/\b(alternating|alternate)\b/.test(n) ? ' each side' : '';
  // "21s" is a fixed scheme: 7 lower-half, 7 upper-half and 7 full repetitions.
  if (/\b21s\b/.test(n)) return { sets: 3, reps: '21', restSeconds: 90 };
  switch (profile.pattern) {
    case 'cardio':
      return { sets: 1, reps: /\b(sprints?|hiit)\b/.test(n) ? '15-20 min' : '20-30 min', restSeconds: 0 };
    case 'mobility':
      return { sets: 2, reps: '10-30 s', restSeconds: 15 };
    case 'balance':
      return { sets: 2, reps: '30 s' + side, restSeconds: 30 };
    case 'plyometric':
    case 'olympic':
      return { sets: 3, reps: '3-6' + side, restSeconds: 150 };
    case 'conditioning':
      return { sets: 3, reps: '30 s', restSeconds: 60 };
    case 'carry':
      return { sets: 3, reps: '20-40 s', restSeconds: 90 };
    default:
      break;
  }
  if (HOLD.test(n) && !/\b(press|row|curl|raise|thrust)\b/.test(n)) return { sets: 3, reps: '20-40 s' + side, restSeconds: 60 };
  if (['core_flexion', 'core_anti_extension', 'core_rotation', 'core_lateral', 'hip_flexion', 'neck', 'rotator_cuff', 'scapular'].includes(profile.pattern)) {
    return { sets: 3, reps: '10-15' + side, restSeconds: 60 };
  }
  if (COMPOUND_LIFT_PATTERNS.includes(profile.pattern) || isHeavyHipExtension(profile, name)) return { sets: 3, reps: '8-12' + side, restSeconds: 120 };
  return { sets: 3, reps: '10-15' + side, restSeconds: 90 };
}

/** Single- vs multi-joint follows the movement pattern; the sources are inconsistent (e.g. flyes marked compound). */
function normaliseMechanic(profile: ExerciseProfile): ExerciseProfile {
  if (COMPOUND_LIFT_PATTERNS.includes(profile.pattern) || profile.pattern === 'olympic' || profile.pattern === 'carry') return { ...profile, mechanic: 'compound' };
  if (ISOLATION_LIFT_PATTERNS.includes(profile.pattern) || profile.pattern === 'hip_thrust') return { ...profile, mechanic: 'isolation' };
  return profile;
}

function applyOverride(
  key: string,
  profile: ExerciseProfile,
): { profile: ExerciseProfile; instructions?: string[]; hidden: boolean; name?: string; difficulty?: LibraryEntry['difficulty'] } {
  const o = PROFILE_OVERRIDES[key];
  if (!o) return { profile: normaliseMechanic(profile), hidden: false };
  const { instructions, hidden, name, difficulty, ...rest } = o;
  const merged: ExerciseProfile = normaliseMechanic({ ...profile, ...rest, confidence: 'verified' });
  return { profile: merged, instructions, hidden: !!hidden, name, difficulty };
}

function datasetLevel(level: string): LibraryEntry['difficulty'] {
  return level === 'expert' ? 'advanced' : level === 'intermediate' ? 'intermediate' : 'beginner';
}

function catalogLevel(level: string): LibraryEntry['difficulty'] {
  return level === 'advanced' || level === 'intermediate' ? level : 'beginner';
}

export interface BuildResult {
  entries: LibraryEntry[];
  byKey: Map<string, LibraryEntry>;
}

/** Build every library entry and check that all hand-written references resolve. Throws on any problem. */
export function buildLibrary(dataset: DatasetExercise[], catalog: CatalogExercise[]): BuildResult {
  const entries: LibraryEntry[] = [];
  const byKey = new Map<string, LibraryEntry>();
  const add = (e: LibraryEntry) => {
    if (byKey.has(e.key)) throw new Error(`Duplicate library key ${e.key}`);
    byKey.set(e.key, e);
    entries.push(e);
  };

  for (const d of dataset) {
    const key = `D:${d.name}`;
    const auto = classifyExercise({
      name: d.name,
      rawPrimary: d.primaryMuscles,
      rawSecondary: d.secondaryMuscles,
      equipment: d.equipment,
      category: d.category,
      mechanic: d.mechanic,
      force: d.force,
    });
    const { profile, instructions, hidden, name, difficulty } = applyOverride(key, auto);
    const coarse = coarseGroups(profile);
    const steps = (instructions ?? d.instructions).map((s) => s.trim()).filter(Boolean);
    add({
      key,
      sourceId: d.id,
      origin: 'dataset',
      name: name ?? d.name,
      description: steps[0] ? (steps[0].length > 200 ? steps[0].slice(0, 197).trimEnd() + '…' : steps[0]) : null,
      instructions: steps,
      safetyNotes: null,
      difficulty: difficulty ?? datasetLevel(d.level),
      category: d.category,
      coarsePrimary: coarse.primary,
      coarseSecondary: coarse.secondary,
      legacyEquipment: legacyEquipment(profile.equipment),
      forceType: d.force,
      rawPrimary: d.primaryMuscles,
      rawSecondary: d.secondaryMuscles,
      imageUrls: d.images.map((p) => DATASET_IMAGE_BASE + p),
      profile,
      hidden: hidden || steps.length === 0,
      canonicalKey: null,
      aliases: [],
      coreSlot: null,
      coreRank: null,
      prescription: defaultPrescription(profile, d.name),
    });
  }

  // Catalogue names that differ only in case or punctuation ("Chin-Up" / "Chin-up") share a slug,
  // so later ones get a numeric suffix (the snapshot is sorted by name, which keeps this stable).
  const catalogSlugs = new Map<string, number>();
  const catalogSourceId = (name: string) => {
    const slug = slugify(name);
    const seen = catalogSlugs.get(slug) ?? 0;
    catalogSlugs.set(slug, seen + 1);
    return `catalog:${slug}${seen ? `-${seen + 1}` : ''}`;
  };

  for (const c of [...catalog].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const key = `C:${c.name}`;
    const auto = classifyExercise({
      name: c.name,
      coarsePrimary: c.primary_muscle,
      coarseSecondary: c.secondary_muscles,
      equipment: c.equipment,
      mechanic: c.exercise_type,
      patternHint: c.movement_pattern,
      category: c.category,
      description: c.description,
    });
    const { profile, instructions, hidden, name, difficulty } = applyOverride(key, auto);
    const coarse = coarseGroups(profile);
    add({
      key,
      sourceId: catalogSourceId(c.name),
      origin: 'catalog',
      name: name ?? c.name,
      description: c.description,
      instructions: (instructions ?? c.instructions ?? []).map((x) => x.trim()).filter(Boolean),
      safetyNotes: null,
      difficulty: difficulty ?? catalogLevel(c.difficulty),
      category: profile.pattern === 'cardio' ? 'cardio' : profile.pattern === 'mobility' ? 'stretching' : c.category ?? 'strength',
      coarsePrimary: coarse.primary,
      coarseSecondary: coarse.secondary,
      legacyEquipment: legacyEquipment(profile.equipment),
      forceType: null,
      rawPrimary: null,
      rawSecondary: null,
      imageUrls: [],
      profile,
      hidden,
      canonicalKey: null,
      aliases: [],
      coreSlot: null,
      coreRank: null,
      prescription: defaultPrescription(profile, c.name),
    });
  }

  for (const a of LIBRARY_ADDITIONS) {
    const profile: ExerciseProfile = { ...a.profile, confidence: 'verified' };
    const coarse = coarseGroups(profile);
    add({
      key: `N:${a.slug}`,
      sourceId: `startfit:${a.slug}`,
      origin: 'startfit',
      name: a.name,
      description: a.description,
      instructions: a.instructions,
      safetyNotes: a.safetyNotes,
      difficulty: a.difficulty,
      category: a.category,
      coarsePrimary: coarse.primary,
      coarseSecondary: coarse.secondary,
      legacyEquipment: legacyEquipment(profile.equipment),
      forceType: null,
      rawPrimary: null,
      rawSecondary: null,
      imageUrls: [],
      profile,
      hidden: false,
      canonicalKey: null,
      aliases: [...(a.aliases ?? [])],
      coreSlot: null,
      coreRank: null,
      prescription: defaultPrescription(profile, a.name),
    });
  }

  const problems: string[] = [];
  const sourceIds = new Set<string>();
  for (const e of entries) {
    if (sourceIds.has(e.sourceId)) problems.push(`Source id ${e.sourceId} is used twice`);
    sourceIds.add(e.sourceId);
  }
  for (const key of Object.keys(PROFILE_OVERRIDES)) if (!byKey.has(key)) problems.push(`Override for unknown exercise ${key}`);
  for (const [dupKey, canonKey] of Object.entries(DUPLICATES)) {
    const dup = byKey.get(dupKey);
    const canon = byKey.get(canonKey);
    if (!dup) problems.push(`Duplicate entry ${dupKey} not found`);
    if (!canon) problems.push(`Canonical entry ${canonKey} (for ${dupKey}) not found`);
    if (!dup || !canon) continue;
    if (DUPLICATES[canonKey]) problems.push(`Canonical entry ${canonKey} is itself marked as a duplicate`);
    if (canon.hidden) problems.push(`Canonical entry ${canonKey} is hidden`);
    dup.hidden = true;
    dup.canonicalKey = canonKey;
    const alias = dup.name;
    if (normalizeName(alias) !== normalizeName(canon.name) && !canon.aliases.some((a) => normalizeName(a) === normalizeName(alias))) canon.aliases.push(alias);
  }
  for (const [key, aliases] of Object.entries(EXTRA_ALIASES)) {
    const entry = byKey.get(key);
    if (!entry) {
      problems.push(`Alias target ${key} not found`);
      continue;
    }
    for (const alias of aliases) if (!entry.aliases.some((a) => normalizeName(a) === normalizeName(alias))) entry.aliases.push(alias);
  }
  for (const [key, { slot, rank }] of coreRanks()) {
    const entry = byKey.get(key);
    if (!entry) {
      problems.push(`Curated exercise ${key} (${slot}) not found`);
      continue;
    }
    if (entry.hidden) problems.push(`Curated exercise ${key} (${slot}) is hidden`);
    entry.coreSlot = slot;
    entry.coreRank = rank;
  }
  // A visible name must not collide with another visible exercise's name.
  const visibleNames = new Map<string, string>();
  for (const e of entries) {
    if (e.hidden) continue;
    const n = normalizeName(e.name);
    const prev = visibleNames.get(n);
    if (prev) problems.push(`Two visible exercises are both called "${e.name}" (${prev} and ${e.key})`);
    else visibleNames.set(n, e.key);
  }
  if (problems.length) throw new Error('Library problems:\n' + problems.join('\n'));
  return { entries, byKey };
}

/** Patterns whose sets count toward weekly muscle volume. */
export function isVolumePattern(pattern: MovementPattern): boolean {
  return !NON_VOLUME_PATTERNS.includes(pattern);
}
