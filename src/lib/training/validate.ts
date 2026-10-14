// Checks a training plan against the library, the person's safety limits and the engine's rules.
// Used on every plan before it is saved, and on every change the AI coach proposes: a change that
// produces an error is rejected.

import { CLAIMS } from './evidence';
import { PlanLibrary, candidateEquipmentOk, isSafeAndAllowed, hasEquipment, type UsableContext } from './engine-library';
import { CORE_SLOTS, type SlotCandidate } from './curated';
import { CURATED_SOURCE_IDS } from './curated-index.generated';
import { SECONDS_PER_REP, TRANSITION_SECONDS, WARMUP_MINUTES, RAMP_SECONDS, TARGET_GROUPS } from './engine-config';
import { groupContributions, MUSCLE_GROUPS, NON_VOLUME_PATTERNS, type MuscleGroupKey } from './taxonomy';
import type { ScreeningResult } from './screening';
import type { PlanDay, TrainingIntake, TrainingPlan, VolumeRow } from './plan-types';

export interface PlanIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  dayIndex?: number;
  exerciseId?: string;
}

export function usableContextFor(intake: Pick<TrainingIntake, 'equipment' | 'avoidExerciseIds' | 'experience'>, screening: ScreeningResult): UsableContext {
  const available = new Set(intake.equipment);
  available.add('bodyweight');
  return {
    available,
    excludeFlags: new Set(screening.excludeFlags),
    excludeLying: screening.excludeLying,
    excludeImpact: screening.excludeImpact,
    avoid: new Set(intake.avoidExerciseIds),
    level: intake.experience,
  };
}

/** Estimated minutes for a day, same model the engine uses. */
export function estimateDayMinutes(day: Pick<PlanDay, 'exercises'>, warmup = WARMUP_MINUTES): number {
  let firstMainSeen = false;
  let total = warmup * 60;
  for (const e of day.exercises) {
    const work = e.timed ? (e.repsMin + e.repsMax) / 2 : ((e.repsMin + e.repsMax) / 2) * SECONDS_PER_REP;
    total += e.sets * (work * (e.unilateral ? 2 : 1) + e.restSeconds) + TRANSITION_SECONDS;
    const main = !e.timed && ['squat', 'hinge', 'horizontal_push', 'incline_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'].includes(e.pattern);
    if (main && !firstMainSeen) {
      firstMainSeen = true;
      total += RAMP_SECONDS;
    }
  }
  return total / 60;
}

/** Weekly fractional sets per group, computed from the library (never trusted from the plan itself). */
export function weeklySetsFromLibrary(plan: Pick<TrainingPlan, 'days'>, lib: PlanLibrary): Partial<Record<MuscleGroupKey, number>> {
  const v: Partial<Record<MuscleGroupKey, number>> = {};
  for (const day of plan.days) {
    for (const e of day.exercises) {
      const ex = lib.byId.get(e.exerciseId);
      if (!ex || NON_VOLUME_PATTERNS.includes(ex.pattern)) continue;
      for (const [g, c] of Object.entries(groupContributions(ex)) as [MuscleGroupKey, number][]) v[g] = (v[g] ?? 0) + c * e.sets;
    }
  }
  return v;
}

export function volumeRowsFor(plan: Pick<TrainingPlan, 'days' | 'volume'>, lib: PlanLibrary): VolumeRow[] {
  const v = weeklySetsFromLibrary(plan, lib);
  const prior = new Map(plan.volume.map((r) => [r.group, r]));
  return (Object.keys(MUSCLE_GROUPS) as MuscleGroupKey[])
    .filter((g) => prior.has(g) || (v[g] ?? 0) > 0)
    .map((g) => {
      const p = prior.get(g);
      const sets = Math.round((v[g] ?? 0) * 10) / 10;
      const low = p?.low ?? 0;
      const high = p?.high ?? 0;
      const targeted = high > 0;
      return {
        group: g,
        label: MUSCLE_GROUPS[g].label,
        sets,
        low,
        high,
        status: !targeted ? 'in_range' : sets < low - 0.01 ? 'low' : sets > high + 0.01 ? 'high' : 'in_range',
        priority: !!p?.priority,
      } as VolumeRow;
    });
}

export function validatePlan(plan: TrainingPlan, lib: PlanLibrary, ctx: UsableContext, screening: ScreeningResult): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const err = (code: string, message: string, extra: Partial<PlanIssue> = {}) => issues.push({ level: 'error', code, message, ...extra });
  const warn = (code: string, message: string, extra: Partial<PlanIssue> = {}) => issues.push({ level: 'warning', code, message, ...extra });

  if (plan.days.length < 1 || plan.days.length > 6) err('day_count', `A plan needs 1–6 strength days (this one has ${plan.days.length}).`);

  plan.days.forEach((day, di) => {
    if (day.exercises.length === 0) err('empty_day', `${day.label} has no exercises.`, { dayIndex: di });
    if (day.exercises.length > 12) err('too_many_exercises', `${day.label} has more than 12 exercises.`, { dayIndex: di });
    const seen = new Set<string>();
    for (const e of day.exercises) {
      const at = { dayIndex: di, exerciseId: e.exerciseId };
      if (seen.has(e.exerciseId)) err('duplicate', `${e.name} appears twice in ${day.label}.`, at);
      seen.add(e.exerciseId);
      const ex = lib.byId.get(e.exerciseId);
      if (!ex) {
        err('unknown_exercise', `${e.name} is not in the exercise library.`, at);
        continue;
      }
      if (!isSafeAndAllowed(ex, ctx)) err('not_allowed', `${ex.name} is not allowed with your current safety limits or exclusions.`, at);
      if (!ex.equipment.every((t) => hasEquipment(ctx, t)) && !curatedEquipmentOk(ex.sourceId, ctx)) {
        err('equipment', `${ex.name} needs equipment you have not listed.`, at);
      }
      if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 6) err('sets', `${ex.name}: sets must be a whole number from 1 to 6.`, at);
      if (e.repsMin > e.repsMax) err('reps_order', `${ex.name}: the rep range is reversed.`, at);
      if (e.timed ? e.repsMin < 5 || e.repsMax > 600 : e.repsMin < 1 || e.repsMax > 30) err('reps_range', `${ex.name}: the repetition target is outside the allowed range.`, at);
      if (e.restSeconds < 15 || e.restSeconds > 300) err('rest', `${ex.name}: rest must be 15–300 seconds.`, at);
      if (!e.timed && (e.rir < 0 || e.rir > 5)) err('rir', `${ex.name}: reps in reserve must be 0–5.`, at);
      if (!e.timed && e.rir < screening.minRir && ex.pattern !== 'balance') err('rir_floor', `${ex.name}: your safety settings keep at least ${screening.minRir} repetitions in reserve.`, at);
    }
    const minutes = estimateDayMinutes(day);
    if (minutes > plan.sessionMinutes + 10) warn('time', `${day.label} is estimated at ${Math.round(minutes)} minutes, more than your ${plan.sessionMinutes}.`, { dayIndex: di });
  });

  const v = weeklySetsFromLibrary(plan, lib);
  for (const row of plan.volume) {
    if (!TARGET_GROUPS[row.group] || row.high <= 0) continue;
    const sets = v[row.group] ?? 0;
    if (sets < row.low - 0.01) warn('volume_low', `${row.label}: ${round1(sets)} weekly sets, below the target of ${row.low}–${row.high}.`);
    if (sets > row.high + 2.01) warn('volume_high', `${row.label}: ${round1(sets)} weekly sets, above the target of ${row.low}–${row.high}.`);
  }

  for (const c of plan.cardio) {
    if (c.minutes < 5 || c.minutes > 120) err('cardio_minutes', `${c.label}: cardio sessions must be 5–120 minutes.`);
    if (c.intensity === 'vigorous' && screening.maxCardioIntensity !== 'vigorous') err('cardio_intensity', `${c.label}: your safety settings keep cardio at a moderate effort.`);
    if (c.exerciseId && !lib.byId.has(c.exerciseId)) err('unknown_exercise', `${c.label} links to an exercise that is not in the library.`);
  }

  for (const id of plan.claimIds) if (!CLAIMS[id]) err('unknown_claim', `The plan cites "${id}", which is not in the evidence list.`);
  for (const r of plan.rationale) if (!CLAIMS[r.claimId]) err('unknown_claim', `A reason cites "${r.claimId}", which is not in the evidence list.`);

  return issues;
}

let curatedNeeds: Map<string, SlotCandidate[]> | null = null;

/** Curated exercises can list other ways to do them (a split squat with dumbbells or bodyweight). */
function curatedEquipmentOk(sourceId: string | null, ctx: UsableContext): boolean {
  if (!sourceId) return false;
  if (!curatedNeeds) {
    curatedNeeds = new Map();
    for (const slot of Object.values(CORE_SLOTS)) {
      for (const cand of slot.candidates) {
        const sid = CURATED_SOURCE_IDS[cand.key];
        if (!sid) continue;
        const list = curatedNeeds.get(sid) ?? [];
        list.push(cand);
        curatedNeeds.set(sid, list);
      }
    }
  }
  return (curatedNeeds.get(sourceId) ?? []).some((cand) => candidateEquipmentOk(ctx, cand));
}

const round1 = (n: number) => Math.round(n * 10) / 10;
