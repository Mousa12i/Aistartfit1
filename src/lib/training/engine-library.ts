// The exercise pool the plan engine works from: indexes, the "can this person do it?" rules and
// the lookup of curated exercises per slot.

import { CORE_SLOTS, LEVEL_ORDER, type ExperienceLevel, type SlotCandidate, type SlotKey } from './curated';
import { CURATED_SOURCE_IDS } from './curated-index.generated';
import { groupContributions, type EquipTag, type MovementPattern, type MuscleGroupKey, type SafetyFlag } from './taxonomy';
import type { PlanExerciseRef } from './plan-types';
import type { Exercise } from '../types';
import type { RecoveryMuscle } from '../recovery/muscles';
import type { ExtraMuscle } from './taxonomy';

export const ALL_EQUIPMENT: EquipTag[] = [
  'bodyweight', 'dumbbell', 'barbell', 'ez_bar', 'rack', 'bench', 'kettlebell', 'cable', 'machine', 'smith_machine', 'band',
  'pullup_bar', 'dip_bars', 'trap_bar', 'landmine', 'medicine_ball', 'exercise_ball', 'foam_roller', 'ab_wheel', 'box',
  'rings', 'suspension', 'sled', 'strongman', 'cardio_machine', 'other',
];

export const EQUIPMENT_PRESETS: Record<'bodyweight' | 'home_basic' | 'home_full' | 'gym', { label: string; tags: EquipTag[] }> = {
  bodyweight: { label: 'No equipment', tags: ['bodyweight'] },
  home_basic: { label: 'Home: dumbbells, bands, bench', tags: ['bodyweight', 'dumbbell', 'band', 'bench', 'box'] },
  home_full: {
    label: 'Home gym: barbell, rack, bench, pull-up bar',
    tags: ['bodyweight', 'dumbbell', 'barbell', 'ez_bar', 'rack', 'bench', 'kettlebell', 'band', 'pullup_bar', 'dip_bars', 'box', 'landmine'],
  },
  gym: { label: 'Full gym', tags: ALL_EQUIPMENT },
};

const LYING = /\b(lie|lies|lying|supine|on your back|face[- ]?down|prone|flat bench)\b/i;

/** True when the exercise is done lying on the back or face down (left out in pregnancy). */
export function isLyingExercise(ex: Pick<PlanExerciseRef, 'name' | 'instructions'>): boolean {
  return LYING.test(ex.name) || LYING.test(ex.instructions.slice(0, 400));
}

const DIFFICULTY_RANK = { beginner: 1, intermediate: 2, advanced: 3 } as const;

export function exerciseContributions(ex: Pick<PlanExerciseRef, 'pattern' | 'primary' | 'secondary'>): Partial<Record<MuscleGroupKey, number>> {
  return groupContributions(ex);
}

/** Convert a database row into what the engine needs; rows without a movement pattern are not plannable. */
export function rowToRef(row: Exercise): PlanExerciseRef | null {
  if (!row.pattern) return null;
  return {
    id: row.id,
    sourceId: row.source_id ?? null,
    name: row.name,
    pattern: row.pattern as MovementPattern,
    primary: (row.muscles_primary ?? []) as RecoveryMuscle[],
    secondary: (row.muscles_secondary ?? []) as RecoveryMuscle[],
    extra: (row.muscles_extra ?? []) as ExtraMuscle[],
    equipment: (row.equipment_tags ?? []) as EquipTag[],
    flags: (row.safety_flags ?? []) as SafetyFlag[],
    unilateral: !!row.is_unilateral,
    difficulty: row.difficulty,
    coreSlot: (row.core_slot as SlotKey | null) ?? null,
    coreRank: row.core_rank ?? null,
    hidden: !!row.is_hidden,
    instructions: (row.instructions ?? []).join(' '),
    defaultReps: row.default_reps ?? '',
  };
}

export interface UsableContext {
  available: Set<EquipTag>;
  excludeFlags: Set<SafetyFlag>;
  excludeLying: boolean;
  excludeImpact: boolean;
  avoid: Set<string>;
  level: ExperienceLevel;
}

export function hasEquipment(ctx: Pick<UsableContext, 'available'>, tag: EquipTag): boolean {
  return tag === 'bodyweight' || ctx.available.has(tag);
}

export function candidateEquipmentOk(ctx: Pick<UsableContext, 'available'>, cand: SlotCandidate): boolean {
  return cand.needs.some((set) => set.every((t) => hasEquipment(ctx, t)));
}

/** Everything about an exercise that does not depend on a slot: safety, access and level. */
export function isSafeAndAllowed(ex: PlanExerciseRef, ctx: UsableContext): boolean {
  if (ex.hidden || ctx.avoid.has(ex.id)) return false;
  if (ex.flags.some((f) => ctx.excludeFlags.has(f))) return false;
  if (ctx.excludeImpact && (ex.flags.includes('impact') || ex.pattern === 'plyometric' || ex.pattern === 'conditioning')) return false;
  if (ctx.excludeLying && isLyingExercise(ex)) return false;
  return true;
}

export function levelAllows(level: ExperienceLevel, cand: SlotCandidate | null, ex: PlanExerciseRef): boolean {
  if (cand) return LEVEL_ORDER[level] >= LEVEL_ORDER[cand.minLevel];
  return DIFFICULTY_RANK[ex.difficulty] <= Math.max(1, LEVEL_ORDER[level]);
}

export class PlanLibrary {
  readonly byId = new Map<string, PlanExerciseRef>();
  readonly bySource = new Map<string, PlanExerciseRef>();
  readonly byPattern = new Map<MovementPattern, PlanExerciseRef[]>();

  constructor(refs: PlanExerciseRef[]) {
    for (const r of refs) {
      this.byId.set(r.id, r);
      if (r.sourceId) this.bySource.set(r.sourceId, r);
      const list = this.byPattern.get(r.pattern) ?? [];
      list.push(r);
      this.byPattern.set(r.pattern, list);
    }
    for (const list of this.byPattern.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  }

  get size(): number {
    return this.byId.size;
  }

  /** Curated candidates of a slot that exist in this library, in preference order. */
  slotCandidates(slot: SlotKey): { ex: PlanExerciseRef; cand: SlotCandidate }[] {
    const out: { ex: PlanExerciseRef; cand: SlotCandidate }[] = [];
    for (const cand of CORE_SLOTS[slot].candidates) {
      const sourceId = CURATED_SOURCE_IDS[cand.key];
      const ex = sourceId ? this.bySource.get(sourceId) : undefined;
      if (ex) out.push({ ex, cand });
    }
    return out;
  }

  /** Curated exercises of a slot this person can do, best first. */
  usableForSlot(slot: SlotKey, ctx: UsableContext): { ex: PlanExerciseRef; cand: SlotCandidate }[] {
    return this.slotCandidates(slot).filter(
      ({ ex, cand }) => isSafeAndAllowed(ex, ctx) && candidateEquipmentOk(ctx, cand) && levelAllows(ctx.level, cand, ex),
    );
  }

  /**
   * Other library exercises with the slot's movement pattern that the person can do, used when the
   * curated list has nothing (or too few) options. Never includes high-skill moves.
   */
  genericForSlot(slot: SlotKey, ctx: UsableContext, exclude: Set<string>): PlanExerciseRef[] {
    const patterns = CORE_SLOTS[slot].patterns;
    const out: PlanExerciseRef[] = [];
    for (const p of patterns) {
      for (const ex of this.byPattern.get(p) ?? []) {
        if (exclude.has(ex.id)) continue;
        if (!isSafeAndAllowed(ex, ctx) || ex.flags.includes('high_skill')) continue;
        if (!levelAllows(ctx.level, null, ex)) continue;
        if (!ex.equipment.every((t) => hasEquipment(ctx, t))) continue;
        out.push(ex);
      }
    }
    return out;
  }
}
