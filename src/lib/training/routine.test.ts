import { describe, expect, it } from 'vitest';
import { routineDays, routineWeeklySets } from './routine';
import type { Exercise, WorkoutPlanExercise } from '../types';

const ex = (pattern: string, primary: string[], secondary: string[]) => ({ pattern, muscles_primary: primary, muscles_secondary: secondary }) as unknown as Exercise;
const row = (id: string, day: number, sets: number, e: Exercise, label?: string): WorkoutPlanExercise => ({ id, plan_id: 'p', exercise_id: id, exercise_order: 0, sets, reps: '8-12', rest_seconds: 90, day_index: day, day_label: label ?? null, exercise: e });

describe('routine helpers', () => {
  const bench = ex('horizontal_push', ['upper_chest', 'lower_chest'], ['front_delts', 'triceps']);
  const row1 = ex('horizontal_pull', ['lats', 'mid_back'], ['biceps', 'rear_delts']);
  const walk = ex('cardio', [], []);

  it('groups exercises into days with labels', () => {
    const days = routineDays([row('b', 1, 3, bench, 'Day 2'), row('a', 0, 3, row1, 'Day 1')]);
    expect(days.map((d) => d.label)).toEqual(['Day 1', 'Day 2']);
  });

  it('counts direct sets as 1 and helping sets as half, ignoring cardio', () => {
    const w = routineWeeklySets([row('b', 0, 3, bench), row('r', 1, 4, row1), row('w', 1, 1, walk)]);
    const get = (g: string) => w.find((x) => x.group === g)?.sets;
    expect(get('chest')).toBe(3);
    expect(get('triceps')).toBe(1.5);
    expect(get('back')).toBe(4);
    expect(get('biceps')).toBe(2);
    expect(get('shoulders')).toBe(2); // rear delts helping from rows; front delts have no target group
  });

  it('repeats a single-day routine by its sessions per week', () => {
    const w = routineWeeklySets([row('b', 0, 3, bench)], 3);
    expect(w.find((x) => x.group === 'chest')?.sets).toBe(9);
  });
});
