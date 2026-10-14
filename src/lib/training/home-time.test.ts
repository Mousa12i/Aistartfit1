import { describe, expect, it } from 'vitest';
import { generatePlan } from './engine';
import { EQUIPMENT_PRESETS } from './engine-library';
import { routineRowsFromPlan } from './routine';
import { adaptRoutineForHome } from './home';
import { estimateMinutes, fitSessionToTime, parseRepsText, type FitItem } from './time-fit';
import { groupContributions } from './taxonomy';
import { CLAIMS } from './evidence';
import { baseIntake, testLibrary } from './test-fixtures';

const lib = testLibrary();
const NOW = new Date('2026-10-14T09:00:00Z');

function gymRows() {
  const r = generatePlan(baseIntake({ goal: 'muscle', experience: 'intermediate', daysPerWeek: 4, sessionMinutes: 75, equipment: EQUIPMENT_PRESETS.gym.tags }), lib, { now: NOW });
  if (r.status !== 'ready') throw new Error('expected a plan');
  return routineRowsFromPlan(r.plan);
}

describe('training at home', () => {
  const rows = gymRows();

  it('keeps every exercise usable with the home equipment and keeps days and sets', () => {
    const a = adaptRoutineForHome(rows, lib, ['dumbbell', 'bench', 'band', 'pullup_bar'], { level: 'intermediate' });
    const avail = new Set(['bodyweight', 'dumbbell', 'bench', 'band', 'pullup_bar']);
    for (const r of a.rows) {
      const ex = lib.byId.get(r.exercise_id)!;
      expect(ex.equipment.every((t) => avail.has(t))).toBe(true);
    }
    expect(new Set(a.rows.map((r) => r.day_index))).toEqual(new Set(rows.map((r) => r.day_index)));
    expect(a.counts.swapped > 0).toBe(true);
    // swaps train at least one of the same main muscle groups and keep the sets
    for (const c of a.changes.filter((x) => x.kind === 'swapped')) expect(c.shared.length > 0).toBe(true);
    expect(a.rows.reduce((s, r) => s + r.sets, 0)).toBe(rows.reduce((s, r) => s + r.sets, 0) - a.changes.filter((c) => c.kind === 'removed').reduce((s, c) => s + (rows.find((r) => r.exercise_id === c.from.id)?.sets ?? 0), 0));
  });

  it('keeps most of the weekly volume per muscle group with a basic home setup', () => {
    const a = adaptRoutineForHome(rows, lib, ['dumbbell', 'bench', 'band', 'pullup_bar'], { level: 'intermediate' });
    const before = a.volume.reduce((s, v) => s + v.before, 0);
    const after = a.volume.reduce((s, v) => s + v.after, 0);
    expect(after / before > 0.85).toBe(true);
  });

  it('raises reps and effort when the swap is much lighter (body weight only)', () => {
    const a = adaptRoutineForHome(rows, lib, [], { level: 'intermediate' });
    const lighter = a.changes.filter((c) => c.lighter);
    expect(lighter.length > 0).toBe(true);
    for (const c of lighter) {
      const out = a.rows.find((r) => r.exercise_id === c.to!.id)!;
      expect(parseRepsText(out.reps).repsMax >= 20).toBe(true);
      expect((out.rir_target ?? 9) <= 1).toBe(true);
    }
    expect(a.claimIds).toContain('load_range');
  });

  it('changes nothing when the home gym has everything', () => {
    const a = adaptRoutineForHome(rows, lib, EQUIPMENT_PRESETS.gym.tags, { level: 'intermediate' });
    expect(a.counts.swapped + a.counts.removed).toBe(0);
  });

  it('never puts the same exercise twice on one day', () => {
    const a = adaptRoutineForHome(rows, lib, ['band'], { level: 'intermediate' });
    const seen = new Set<string>();
    for (const r of a.rows) {
      const k = `${r.day_index}:${r.exercise_id}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
});

describe('short on time', () => {
  const rows = gymRows().filter((r) => r.day_index === 0);
  const items: FitItem[] = rows.map((r) => {
    const ex = lib.byId.get(r.exercise_id)!;
    const reps = parseRepsText(r.reps);
    return { key: r.exercise_id, exerciseId: r.exercise_id, name: ex.name, pattern: ex.pattern, groups: groupContributions(ex), sets: r.sets, ...reps, unilateral: ex.unilateral, restSeconds: r.rest_seconds };
  });

  it('parses rep text', () => {
    expect(parseRepsText('8-12')).toEqual({ repsMin: 8, repsMax: 12, timed: false });
    expect(parseRepsText('30-45 s')).toEqual({ repsMin: 30, repsMax: 45, timed: true });
    expect(parseRepsText('10 each side')).toEqual({ repsMin: 10, repsMax: 10, timed: false });
  });

  it('leaves a session that already fits alone', () => {
    const r = fitSessionToTime(items, 300);
    expect(r.steps).toEqual([]);
    expect(r.items.length).toBe(items.length);
  });

  it('fits 30 minutes, keeps the first main lift and uses supersets before removing exercises', () => {
    const before = estimateMinutes(items);
    expect(before > 45).toBe(true);
    const r = fitSessionToTime(items, 30);
    expect(r.fits).toBe(true);
    expect(r.minutesAfter <= 30).toBe(true);
    expect(r.items[0].exerciseId).toBe(items[0].exerciseId);
    expect(r.items[0].pairKey).toBeNull();
    expect(r.items.some((i) => i.pairLabel === 'A1')).toBe(true);
    // pairs never share a directly trained muscle group
    for (const i of r.items.filter((x) => x.pairKey)) {
      const p = r.items.find((x) => x.key === i.pairKey)!;
      const direct = (g: Record<string, number>) => Object.keys(g).filter((k) => g[k] >= 1);
      expect(direct(i.groups).some((g) => (p.groups as Record<string, number>)[g] >= 1)).toBe(false);
    }
  });

  it('still keeps the first lift at 15 minutes and reports what was lost', () => {
    const r = fitSessionToTime(items, 15);
    expect(r.items[0].exerciseId).toBe(items[0].exerciseId);
    expect(r.items.length >= 1).toBe(true);
    expect(r.removed.length > 0).toBe(true);
    expect(r.lostSets.length > 0).toBe(true);
    expect(r.claimIds).toContain('vol_minimum');
  });

  it('never removes or shortens an exercise already started', () => {
    const locked = items.map((i, idx) => (idx === items.length - 1 ? { ...i, locked: true } : i));
    const r = fitSessionToTime(locked, 15);
    const last = r.items.find((i) => i.key === items[items.length - 1].key);
    expect(last?.sets).toBe(items[items.length - 1].sets);
  });

  it('cites only known claims', () => {
    for (const id of fitSessionToTime(items, 15).claimIds) expect(!!CLAIMS[id]).toBe(true);
  });
});
