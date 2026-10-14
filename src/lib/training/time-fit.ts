// "Short on time": fit one session into the minutes the person has (claims: time_efficient, time_fit_rule,
// vol_minimum, estimate_time). Pure, so it can be tested and shown as a preview before anything changes.

import { parseTimedReps } from './engine';
import { RAMP_SECONDS, SECONDS_PER_REP, TRANSITION_SECONDS, WARMUP_MINUTES } from './engine-config';
import { MUSCLE_GROUPS, type MovementPattern, type MuscleGroupKey } from './taxonomy';

export interface FitItem {
  key: string;
  exerciseId: string;
  name: string;
  pattern: MovementPattern | null;
  /** Fractional sets per group for one set (1 direct, 0.5 helping). */
  groups: Partial<Record<MuscleGroupKey, number>>;
  sets: number;
  repsMin: number;
  repsMax: number;
  timed: boolean;
  unilateral: boolean;
  restSeconds: number;
  /** Already started this session: never removed or shortened. */
  locked?: boolean;
}

export interface FittedItem extends FitItem {
  /** Superset partner (key) and label such as "A1"/"A2". */
  pairKey: string | null;
  pairLabel: string | null;
}

export interface FitResult {
  fits: boolean;
  minutesBefore: number;
  minutesAfter: number;
  target: number;
  items: FittedItem[];
  removed: FitItem[];
  setsCut: { name: string; from: number; to: number }[];
  steps: string[];
  /** Sets per muscle group that today's session no longer covers. */
  lostSets: { group: MuscleGroupKey; label: string; sets: number }[];
  claimIds: string[];
}

/** Session notes start with this when a workout was shortened (read by the coaches; keep in sync with _shared/training-context.ts). */
export const SHORT_ON_TIME_PREFIX = 'Short on time:';

export const SPECIFIC_WARMUP_MINUTES = 3;
const PAIR_TRANSITION_SECONDS = 15;
const MAIN_PATTERNS: MovementPattern[] = ['squat', 'hinge', 'lunge', 'horizontal_push', 'incline_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'];

export function isMain(item: Pick<FitItem, 'pattern' | 'timed'>): boolean {
  return !item.timed && !!item.pattern && MAIN_PATTERNS.includes(item.pattern);
}

/** Rep text from a routine row ("8-12", "10", "30-45 s", "12 each side") → numbers. */
export function parseRepsText(text: string): { repsMin: number; repsMax: number; timed: boolean } {
  const timed = parseTimedReps(text);
  if (timed) return { repsMin: timed[0], repsMax: timed[1], timed: true };
  const nums = (text.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n < 1000);
  if (!nums.length) return { repsMin: 8, repsMax: 12, timed: false };
  return { repsMin: nums[0], repsMax: nums[1] ?? nums[0], timed: false };
}

const work = (i: FitItem) => (i.timed ? (i.repsMin + i.repsMax) / 2 : ((i.repsMin + i.repsMax) / 2) * SECONDS_PER_REP) * (i.unilateral ? 2 : 1);

/** Estimated minutes, counting supersets as rounds of both exercises followed by one rest. */
export function estimateMinutes(items: (FitItem & { pairKey?: string | null })[], warmupMinutes = WARMUP_MINUTES): number {
  let total = warmupMinutes * 60;
  let rampDone = false;
  const done = new Set<string>();
  for (const it of items) {
    if (done.has(it.key)) continue;
    const partner = it.pairKey ? items.find((x) => x.key === it.pairKey) : undefined;
    if (partner && !done.has(partner.key)) {
      const rounds = Math.max(it.sets, partner.sets);
      for (let r = 0; r < rounds; r++) {
        if (r < it.sets) total += work(it);
        if (r < partner.sets) total += work(partner);
        total += PAIR_TRANSITION_SECONDS + Math.max(it.restSeconds, partner.restSeconds);
      }
      total += TRANSITION_SECONDS;
      done.add(it.key).add(partner.key);
    } else {
      total += it.sets * (work(it) + it.restSeconds) + TRANSITION_SECONDS;
      done.add(it.key);
    }
    if (!rampDone && (isMain(it) || (partner && isMain(partner)))) {
      rampDone = true;
      total += RAMP_SECONDS;
    }
  }
  return total / 60;
}

function groupSets(items: FitItem[]): Partial<Record<MuscleGroupKey, number>> {
  const out: Partial<Record<MuscleGroupKey, number>> = {};
  for (const it of items) for (const [g, v] of Object.entries(it.groups) as [MuscleGroupKey, number][]) out[g] = (out[g] ?? 0) + v * it.sets;
  return out;
}

const directGroups = (i: FitItem) => (Object.entries(i.groups) as [MuscleGroupKey, number][]).filter(([, v]) => v >= 1).map(([g]) => g);
const overlaps = (a: FitItem, b: FitItem) => {
  const ga = Object.keys(a.groups);
  return Object.keys(b.groups).some((g) => ga.includes(g) && ((a.groups as Record<string, number>)[g] >= 1 || (b.groups as Record<string, number>)[g] >= 1));
};

export function fitSessionToTime(input: FitItem[], targetMinutes: number): FitResult {
  const minutesBefore = estimateMinutes(input);
  const claimIds = ['time_efficient', 'time_fit_rule', 'estimate_time'];
  const base = (items: FitItem[]): FittedItem[] => items.map((i) => ({ ...i, pairKey: null, pairLabel: null }));
  if (minutesBefore <= targetMinutes || input.length === 0) {
    return { fits: true, minutesBefore, minutesAfter: minutesBefore, target: targetMinutes, items: base(input), removed: [], setsCut: [], steps: [], lostSets: [], claimIds };
  }

  let items: FittedItem[] = base(input.map((i) => ({ ...i })));
  const removed: FitItem[] = [];
  const setsCut = new Map<string, { name: string; from: number; to: number }>();
  const steps: string[] = [];
  const minutes = () => estimateMinutes(items, SPECIFIC_WARMUP_MINUTES);
  const fits = () => minutes() <= targetMinutes;
  const firstKey = items[0].key;

  // 1. exercise-specific warm-up only
  steps.push(`Warm-up shortened to ${SPECIFIC_WARMUP_MINUTES} minutes of warm-up sets for your first exercise.`);

  // 2. supersets for exercises that train different muscles (never the first main lift, never started ones)
  if (!fits()) {
    const free = items.filter((i) => i.key !== firstKey && !i.locked);
    let letter = 0;
    const paired = new Set<string>();
    for (const a of free) {
      if (paired.has(a.key)) continue;
      const b = free.find((x) => x.key !== a.key && !paired.has(x.key) && !overlaps(a, x));
      if (!b) continue;
      paired.add(a.key).add(b.key);
      const L = String.fromCharCode(65 + letter++);
      a.pairKey = b.key;
      a.pairLabel = `${L}1`;
      b.pairKey = a.key;
      b.pairLabel = `${L}2`;
      // keep the pair together: move b right after a
      items = items.filter((x) => x.key !== b.key);
      items.splice(items.findIndex((x) => x.key === a.key) + 1, 0, b);
      if (fits()) break;
    }
  }

  const cut = (it: FittedItem, to: number) => {
    const prev = setsCut.get(it.key)?.from ?? it.sets;
    setsCut.set(it.key, { name: it.name, from: prev, to });
    it.sets = to;
  };

  // 3. accessories down to 2 sets, from the end
  if (!fits()) {
    for (const it of [...items].reverse()) {
      if (it.locked || it.key === firstKey || isMain(it) || it.sets <= 2) continue;
      cut(it, 2);
      if (fits()) break;
    }
  }

  // 4. leave out accessories, from the end
  if (!fits()) {
    for (const it of [...items].reverse()) {
      if (fits()) break;
      if (it.locked || it.key === firstKey || isMain(it)) continue;
      removed.push(input.find((x) => x.key === it.key)!);
      items = items.filter((x) => x.key !== it.key);
      for (const x of items) if (x.pairKey === it.key) {
        x.pairKey = null;
        x.pairLabel = null;
      }
    }
  }

  // 5. main lifts (except the first) down to 2 sets, then leave out the last ones
  if (!fits()) {
    for (const it of [...items].reverse()) {
      if (it.locked || it.key === firstKey || it.sets <= 2) continue;
      cut(it, 2);
      if (fits()) break;
    }
  }
  if (!fits()) {
    for (const it of [...items].reverse()) {
      if (fits()) break;
      if (it.locked || it.key === firstKey) continue;
      removed.push(input.find((x) => x.key === it.key)!);
      items = items.filter((x) => x.key !== it.key);
      for (const x of items) if (x.pairKey === it.key) {
        x.pairKey = null;
        x.pairLabel = null;
      }
    }
  }
  if (!fits() && items[0] && !items[0].locked && items[0].sets > 2) cut(items[0], 2);

  // 6. refill: removing a whole exercise can overshoot, so put back what still fits (main lifts first, 2 sets)
  const order = new Map(input.map((x, i) => [x.key, i]));
  // prefer exercises that bring back muscle groups the session no longer trains, then main lifts
  for (;;) {
    const covered = new Set(items.flatMap(directGroups));
    const candidates = [...removed]
      .map((r) => ({ r, fresh: directGroups(r).filter((g) => !covered.has(g)).length }))
      .sort((a, b) => b.fresh - a.fresh || Number(isMain(b.r)) - Number(isMain(a.r)) || order.get(a.r.key)! - order.get(b.r.key)!);
    let added = false;
    for (const { r } of candidates) {
      const back: FittedItem = { ...r, sets: Math.min(r.sets, 2), pairKey: null, pairLabel: null };
      let at = items.findIndex((x) => order.get(x.key)! > order.get(r.key)!);
      if (at >= 0 && items[at].pairLabel?.endsWith('2')) at += 1; // never split a superset
      const trial = [...items];
      trial.splice(at < 0 ? trial.length : at, 0, back);
      if (estimateMinutes(trial, SPECIFIC_WARMUP_MINUTES) <= targetMinutes) {
        items = trial;
        removed.splice(removed.indexOf(r), 1);
        if (back.sets < r.sets) setsCut.set(r.key, { name: r.name, from: r.sets, to: back.sets });
        else setsCut.delete(r.key);
        added = true;
        break;
      }
    }
    if (!added) break;
  }

  const present = new Set(items.map((i) => i.key));
  const cuts = [...setsCut.entries()].filter(([k]) => present.has(k)).map(([, v]) => v);
  const pairCount = items.filter((i) => i.pairLabel?.endsWith('1') && present.has(i.pairKey ?? '')).length;
  if (pairCount) steps.push(`${pairCount} superset${pairCount > 1 ? 's' : ''}: do one set of each exercise back to back, then rest.`);
  if (cuts.length) steps.push(`Fewer sets: ${cuts.map((c) => `${c.name} ${c.from}→${c.to}`).join(', ')}.`);
  if (removed.length) steps.push(`Left out today: ${removed.map((r) => r.name).join(', ')}.`);

  // re-label pairs in final order
  let letter = 0;
  for (const it of items) {
    if (it.pairLabel?.endsWith('1') && items.some((x) => x.key === it.pairKey)) {
      const L = String.fromCharCode(65 + letter++);
      it.pairLabel = `${L}1`;
      const p = items.find((x) => x.key === it.pairKey)!;
      p.pairLabel = `${L}2`;
    }
  }

  const before = groupSets(input);
  const after = groupSets(items);
  const lostSets = (Object.keys(before) as MuscleGroupKey[])
    .map((g) => ({ group: g, label: MUSCLE_GROUPS[g]?.label ?? g, sets: Math.round(((before[g] ?? 0) - (after[g] ?? 0)) * 2) / 2 }))
    .filter((l) => l.sets > 0)
    .sort((a, b) => b.sets - a.sets);
  if (lostSets.length) claimIds.push('vol_minimum');

  const minutesAfter = minutes();
  return {
    fits: minutesAfter <= targetMinutes,
    minutesBefore,
    minutesAfter,
    target: targetMinutes,
    items,
    removed,
    setsCut: cuts,
    steps,
    lostSets,
    claimIds,
  };
}

/** Direct muscle groups of an item, for display. */
export function itemGroupsLabel(i: FitItem): string {
  return directGroups(i).map((g) => MUSCLE_GROUPS[g]?.label ?? g).join(', ');
}
