import { describe, expect, it } from 'vitest';
import { strengthProgress } from './progress';

const set = (exercise_name: string, weight: number, reps: number, rir: number | null = null, completed = true) =>
  ({ exercise_id: null, exercise_name, weight, reps, rir, completed, set_number: 1, set_type: 'working' });

describe('strength progress', () => {
  it('best estimated max per session, change first → last (Epley with reps in reserve)', () => {
    const rows = strengthProgress([
      { completed_at: '2026-10-14T10:00:00Z', sets: [set('Squat', 100, 5, 1), set('Squat', 90, 8)] },
      { completed_at: '2026-10-07T10:00:00Z', sets: [set('Squat', 95, 5, 1), set('Bench', 60, 8)] },
    ]);
    expect(rows).toHaveLength(1); // bench has one session only
    const sq = rows[0];
    // 95 × (1 + 6/30) = 114; 100 × (1 + 6/30) = 120 (vs 90 × 1.2667 = 114)
    expect(sq.points).toEqual([114, 120]);
    expect(sq.best).toEqual({ weight: 100, reps: 5 });
    expect(sq.changePct).toBe(5.3);
  });

  it('ignores warm-up-like empty, uncompleted and weightless sets', () => {
    const rows = strengthProgress([
      { completed_at: '2026-10-01T10:00:00Z', sets: [set('Row', 0, 10), set('Row', 50, 10, null, false)] },
      { completed_at: '2026-10-08T10:00:00Z', sets: [set('Row', 50, 10)] },
    ]);
    expect(rows).toEqual([]);
  });
});

describe('estimate1RM (Epley)', () => {
  it('a true single is the 1RM itself; more reps or reps in reserve raise the estimate', async () => {
    const { estimate1RM } = await import('../recovery/readiness');
    expect(estimate1RM(100, 1, 0)).toBe(100);
    expect(estimate1RM(100, 1, null)).toBe(100);
    expect(Math.round(estimate1RM(100, 5, 0) * 10) / 10).toBe(116.7); // 100 × (1 + 5/30)
    expect(Math.round(estimate1RM(100, 3, 2) * 10) / 10).toBe(116.7); // 3 reps + 2 in reserve = 5
    expect(estimate1RM(0, 5, 0)).toBe(0);
  });
});
