import { describe, expect, it } from 'vitest';
import { addDays, averageSleep, daysBetween, deloadSets, deloadState, planErrors, type RecoveryPlan } from './recovery-plan';

const base: RecoveryPlan = {
  coach_id: 'c', athlete_id: 'a', sleep_hours: 8, steps: 8000, rest_days: [0], mobility: [], mobility_days: [],
  deload_start: null, deload_days: null, deload_set_pct: null, deload_note: null, notes: null,
};

describe('recovery plan', () => {
  it('counts calendar days across months and leap years', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('knows when the deload is upcoming, active and over', () => {
    const p = { deload_start: '2026-10-19', deload_days: 7, deload_set_pct: 50 };
    expect(deloadState(p, '2026-10-17')).toEqual({ kind: 'upcoming', inDays: 2, start: '2026-10-19', end: '2026-10-25' });
    expect(deloadState(p, '2026-10-19')).toEqual({ kind: 'active', day: 1, of: 7, end: '2026-10-25', pct: 50 });
    expect(deloadState(p, '2026-10-25')).toEqual({ kind: 'active', day: 7, of: 7, end: '2026-10-25', pct: 50 });
    expect(deloadState(p, '2026-10-26')).toEqual({ kind: 'none' });
    expect(deloadState(p, '2026-09-01')).toEqual({ kind: 'none' });
    expect(deloadState(null, '2026-10-19')).toEqual({ kind: 'none' });
  });

  it('cuts sets by the percentage, rounding up, never below one', () => {
    expect(deloadSets(4, 50)).toBe(2);
    expect(deloadSets(3, 50)).toBe(2);
    expect(deloadSets(5, 60)).toBe(3);
    expect(deloadSets(1, 30)).toBe(1);
  });

  it('averages the last 7 nights only', () => {
    const e = [
      { date: '2026-10-17', sleepHours: 7 }, { date: '2026-10-16', sleepHours: 6 }, { date: '2026-10-11', sleepHours: 8 },
      { date: '2026-10-10', sleepHours: 4 }, { date: '2026-10-18', sleepHours: 9 },
    ];
    expect(averageSleep(e, '2026-10-17')).toEqual({ avg: 7, nights: 3 });
    expect(averageSleep([], '2026-10-17')).toBeNull();
  });

  it('checks the same limits as the database', () => {
    expect(planErrors(base)).toEqual([]);
    expect(planErrors({ ...base, sleep_hours: 4, steps: 40000 })).toEqual(['sleep', 'steps']);
    expect(planErrors({ ...base, deload_start: '2026-10-19', deload_days: 2, deload_set_pct: 95 })).toEqual(['deload_days', 'deload_pct']);
  });
});
