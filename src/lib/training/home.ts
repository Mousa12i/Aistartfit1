// "Training at home": rebuild a routine for the equipment the person has at home, exercise by exercise,
// keeping days, order and sets. Claims: home_swap_rule, load_range, failure_proximity.

import { hasEquipment, isSafeAndAllowed, levelAllows, PlanLibrary, type UsableContext } from './engine-library';
import { groupContributions, MUSCLE_GROUPS, NON_VOLUME_PATTERNS, type EquipTag, type MuscleGroupKey } from './taxonomy';
import type { ExperienceLevel } from './curated';
import type { PlanExerciseRef } from './plan-types';
import { parseRepsText } from './time-fit';
import { parseTimedReps } from './engine';

export interface RoutineRowInput {
  exercise_id: string;
  exercise_order: number;
  sets: number;
  reps: string;
  rest_seconds: number;
  day_index?: number | null;
  day_label?: string | null;
  rir_target?: number | null;
  notes?: string | null;
}

export interface RoutineRowOutput {
  exercise_id: string;
  exercise_order: number;
  sets: number;
  reps: string;
  rest_seconds: number;
  day_index: number;
  day_label: string | null;
  rir_target: number | null;
  notes: string | null;
}

export type HomeChangeKind = 'kept' | 'swapped' | 'removed' | 'unknown';

export interface HomeChange {
  dayIndex: number;
  dayLabel: string | null;
  kind: HomeChangeKind;
  from: { id: string; name: string };
  to: { id: string; name: string } | null;
  /** Muscle groups trained directly by both. */
  shared: string[];
  lighter: boolean;
  repsBefore: string;
  repsAfter: string | null;
}

export interface HomeAdaptation {
  rows: RoutineRowOutput[];
  changes: HomeChange[];
  counts: Record<HomeChangeKind, number>;
  volume: { group: MuscleGroupKey; label: string; before: number; after: number }[];
  equipment: EquipTag[];
  claimIds: string[];
}

const HEAVY: EquipTag[] = ['barbell', 'ez_bar', 'rack', 'trap_bar', 'cable', 'machine', 'smith_machine', 'landmine', 'sled', 'dumbbell', 'kettlebell'];
const LIGHT_ONLY: EquipTag[] = ['bodyweight', 'band', 'exercise_ball', 'box', 'bench', 'foam_roller'];

export const HOME_EQUIPMENT_CHOICES: EquipTag[] = [
  'dumbbell', 'kettlebell', 'band', 'bench', 'pullup_bar', 'dip_bars', 'barbell', 'rack', 'box', 'suspension', 'rings', 'ab_wheel', 'exercise_ball',
];

function homeContext(equipment: EquipTag[], level: ExperienceLevel): UsableContext {
  return { available: new Set<EquipTag>(['bodyweight', ...equipment]), excludeFlags: new Set(), excludeLying: false, excludeImpact: false, avoid: new Set(), level };
}

const canDo = (ex: PlanExerciseRef, ctx: UsableContext) => ex.equipment.every((t) => hasEquipment(ctx, t));

function isLighter(from: PlanExerciseRef, to: PlanExerciseRef): boolean {
  if (to.pattern === 'vertical_pull' || to.pattern === 'dip') return false;
  return from.equipment.some((t) => HEAVY.includes(t)) && to.equipment.every((t) => LIGHT_ONLY.includes(t));
}

const NAME_NOISE = new Set(['barbell', 'dumbbell', 'dumbbells', 'cable', 'machine', 'smith', 'seated', 'standing', 'lying', 'band', 'banded', 'bodyweight', 'single', 'leg', 'arm', 'one', 'two', 'with', 'the', 'and', 'grip', 'medium', 'wide', 'close', 'rope', 'attachment', 'weighted', 'kettlebell']);
const nameWords = (n: string) => new Set(n.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter((w) => w.length > 2 && !NAME_NOISE.has(w)));

const LOADED: EquipTag[] = ['dumbbell', 'kettlebell', 'barbell', 'ez_bar', 'trap_bar', 'landmine'];
const LEVEL_RANK = { new: 0, beginner: 1, intermediate: 2, advanced: 3 } as const;

function score(from: PlanExerciseRef, c: PlanExerciseRef, level: ExperienceLevel): number {
  const fp = new Set(from.primary);
  const fs = new Set([...from.primary, ...from.secondary]);
  const primaryHits = c.primary.filter((m) => fp.has(m)).length;
  if (primaryHits === 0) return -1;
  let s = primaryHits * 3 + c.secondary.filter((m) => fs.has(m)).length;
  s -= c.primary.filter((m) => !fs.has(m)).length; // trains other things instead
  if (c.pattern === from.pattern) s += 3;
  if (from.coreSlot && c.coreSlot === from.coreSlot) s += 2;
  if (c.coreRank != null) s += Math.max(0, 2 - c.coreRank * 0.5);
  if (c.unilateral === from.unilateral) s += 0.5;
  if (c.flags.includes('high_skill')) s -= 4;
  // same exercise family by name ("hip thrust", "bench press", "calf raise")
  const fw = nameWords(from.name);
  s += Math.min(3, [...nameWords(c.name)].filter((w) => fw.has(w)).length * 1.5);
  // a loaded exercise stays loaded when the home equipment allows it
  if (from.equipment.some((t) => HEAVY.includes(t)) && c.equipment.some((t) => LOADED.includes(t))) s += c.pattern === from.pattern ? 2.5 : 0.5;
  // a static hold is not a swap for an exercise done in repetitions
  if (parseTimedReps(c.defaultReps) && !parseTimedReps(from.defaultReps)) s -= 3;
  // experienced lifters get the harder variants (e.g. split squats rather than sit-to-stand)
  if (LEVEL_RANK[level] >= 2 && c.difficulty === 'beginner' && c.equipment.every((t) => LIGHT_ONLY.includes(t))) s -= 1.5;
  if (LEVEL_RANK[level] >= 2 && c.unilateral && c.equipment.every((t) => LIGHT_ONLY.includes(t))) s += 1;
  return s;
}

/** The best home replacement for one exercise, or null when nothing trains the same muscles. */
export function bestHomeSwap(from: PlanExerciseRef, lib: PlanLibrary, ctx: UsableContext, usedToday: Set<string>): PlanExerciseRef | null {
  let best: PlanExerciseRef | null = null;
  let bestScore = 0;
  for (const c of lib.byId.values()) {
    if (c.id === from.id || usedToday.has(c.id) || NON_VOLUME_PATTERNS.includes(c.pattern)) continue;
    if (!canDo(c, ctx) || !isSafeAndAllowed(c, ctx) || !levelAllows(ctx.level, null, c)) continue;
    const s = score(from, c, ctx.level);
    if (s > bestScore || (s === bestScore && best && c.name.length < best.name.length)) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

function weekly(rows: { exercise_id: string; sets: number }[], lib: PlanLibrary, sessionsPerWeek: number, days: number): Partial<Record<MuscleGroupKey, number>> {
  const out: Partial<Record<MuscleGroupKey, number>> = {};
  const factor = days <= 1 ? Math.max(1, sessionsPerWeek) : 1;
  for (const r of rows) {
    const ex = lib.byId.get(r.exercise_id);
    if (!ex) continue;
    for (const [g, v] of Object.entries(groupContributions(ex)) as [MuscleGroupKey, number][]) out[g] = (out[g] ?? 0) + v * r.sets * factor;
  }
  return out;
}

export function adaptRoutineForHome(
  input: RoutineRowInput[],
  lib: PlanLibrary,
  equipment: EquipTag[],
  opts: { level: ExperienceLevel; sessionsPerWeek?: number; names?: Map<string, string> },
): HomeAdaptation {
  const ctx = homeContext(equipment, opts.level);
  const rows = [...input].sort((a, b) => (a.day_index ?? 0) - (b.day_index ?? 0) || a.exercise_order - b.exercise_order);
  const out: RoutineRowOutput[] = [];
  const changes: HomeChange[] = [];
  const usedByDay = new Map<number, Set<string>>();
  for (const r of rows) {
    const day = r.day_index ?? 0;
    const used = usedByDay.get(day) ?? new Set<string>();
    usedByDay.set(day, used);
    const from = lib.byId.get(r.exercise_id);
    const name = from?.name ?? opts.names?.get(r.exercise_id) ?? 'Exercise';
    const base: RoutineRowOutput = {
      exercise_id: r.exercise_id,
      exercise_order: out.length,
      sets: r.sets,
      reps: r.reps,
      rest_seconds: r.rest_seconds,
      day_index: day,
      day_label: r.day_label ?? null,
      rir_target: r.rir_target ?? null,
      notes: r.notes ?? null,
    };
    if (!from) {
      // custom exercise without library details: keep it, the person knows what it needs
      out.push(base);
      used.add(r.exercise_id);
      changes.push({ dayIndex: day, dayLabel: base.day_label, kind: 'unknown', from: { id: r.exercise_id, name }, to: null, shared: [], lighter: false, repsBefore: r.reps, repsAfter: r.reps });
      continue;
    }
    if (canDo(from, ctx)) {
      out.push(base);
      used.add(from.id);
      changes.push({ dayIndex: day, dayLabel: base.day_label, kind: 'kept', from: { id: from.id, name }, to: { id: from.id, name }, shared: [], lighter: false, repsBefore: r.reps, repsAfter: r.reps });
      continue;
    }
    const to = bestHomeSwap(from, lib, ctx, used);
    if (!to) {
      changes.push({ dayIndex: day, dayLabel: base.day_label, kind: 'removed', from: { id: from.id, name }, to: null, shared: [], lighter: false, repsBefore: r.reps, repsAfter: null });
      continue;
    }
    used.add(to.id);
    const lighter = isLighter(from, to);
    let reps = r.reps;
    let rir = r.rir_target ?? null;
    const parsed = parseRepsText(r.reps);
    if (lighter && !parsed.timed) {
      const min = Math.max(parsed.repsMin, 12);
      const max = Math.max(parsed.repsMax, 20, min);
      reps = `${min}-${max}`;
      rir = Math.min(rir ?? 2, 1);
    }
    const fromGroups = Object.entries(groupContributions(from)).filter(([, v]) => v >= 1).map(([g]) => g);
    const toGroups = new Set(Object.entries(groupContributions(to)).filter(([, v]) => v >= 1).map(([g]) => g));
    out.push({
      ...base,
      exercise_id: to.id,
      reps,
      rir_target: rir,
      notes: lighter ? 'Home swap: lighter load, so take each set close to failure.' : base.notes,
    });
    changes.push({
      dayIndex: day,
      dayLabel: base.day_label,
      kind: 'swapped',
      from: { id: from.id, name },
      to: { id: to.id, name: to.name },
      shared: fromGroups.filter((g) => toGroups.has(g)).map((g) => MUSCLE_GROUPS[g as MuscleGroupKey]?.label ?? g),
      lighter,
      repsBefore: r.reps,
      repsAfter: reps,
    });
  }

  // re-number the order inside each day
  const byDay = new Map<number, number>();
  for (const r of out) {
    const n = byDay.get(r.day_index) ?? 0;
    r.exercise_order = n;
    byDay.set(r.day_index, n + 1);
  }

  const days = new Set(rows.map((r) => r.day_index ?? 0)).size;
  const before = weekly(rows, lib, opts.sessionsPerWeek ?? 1, days);
  const after = weekly(out, lib, opts.sessionsPerWeek ?? 1, days);
  const volume = (Object.keys(MUSCLE_GROUPS) as MuscleGroupKey[])
    .filter((g) => (before[g] ?? 0) > 0 || (after[g] ?? 0) > 0)
    .map((g) => ({ group: g, label: MUSCLE_GROUPS[g].label, before: Math.round((before[g] ?? 0) * 2) / 2, after: Math.round((after[g] ?? 0) * 2) / 2 }));

  const counts: Record<HomeChangeKind, number> = { kept: 0, swapped: 0, removed: 0, unknown: 0 };
  for (const c of changes) counts[c.kind]++;
  const claimIds = ['home_swap_rule'];
  if (changes.some((c) => c.lighter)) claimIds.push('load_range', 'failure_proximity');
  return { rows: out, changes, counts, volume, equipment: ['bodyweight', ...equipment.filter((e) => e !== 'bodyweight')], claimIds };
}

/** The one extra piece of home equipment that would keep the most exercises (for the "add a band" tip). */
export function suggestEquipment(
  input: RoutineRowInput[],
  lib: PlanLibrary,
  equipment: EquipTag[],
  level: ExperienceLevel,
): { tag: EquipTag; restored: number } | null {
  const base = adaptRoutineForHome(input, lib, equipment, { level });
  if (base.counts.removed === 0) return null;
  let best: { tag: EquipTag; restored: number } | null = null;
  for (const tag of ['band', 'pullup_bar', 'dumbbell', 'kettlebell', 'suspension'] as EquipTag[]) {
    if (equipment.includes(tag)) continue;
    const a = adaptRoutineForHome(input, lib, [...equipment, tag], { level });
    const restored = base.counts.removed - a.counts.removed;
    if (restored > 0 && (!best || restored > best.restored)) best = { tag, restored };
  }
  return best;
}
