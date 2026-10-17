import { describe, expect, it } from 'vitest';
import { radarFor, radarList, type EngagementRow } from './engagement';
import { reviewSession, type ReviewPlanRow, type ReviewSet } from './session-review';
import { cleanPlans, consistency, habitTrend, ratingDue, srbaiScore } from './habit-science';

const base = (p: Partial<EngagementRow> = {}): EngagementRow => ({
  athlete_id: 'a', active_dates: [], last_active_at: null, last_coach_message_at: '2026-10-16T10:00:00', coach_messages_14d: 2,
  checkin_lengths: [], paused_until: null, pause_reason: null, plan_ends_on: null, ...p,
});
const days = (...ds: string[]) => ds;

describe('dropout radar', () => {
  const joined = '2026-08-01T10:00:00';
  it('levels follow calendar days of inactivity (7 / 14 / 21)', () => {
    expect(radarFor(base({ active_dates: days('2026-10-16') }), '2026-10-17', joined).level).toBe('ok');
    expect(radarFor(base({ active_dates: days('2026-10-10') }), '2026-10-17', joined).level).toBe('quiet');
    expect(radarFor(base({ active_dates: [], last_active_at: '2026-10-03T09:00:00' }), '2026-10-17', joined).level).toBe('high');
    const c = radarFor(base({ active_dates: [], last_active_at: '2026-09-20T09:00:00' }), '2026-10-17', joined);
    expect(c.level).toBe('critical');
    expect(c.inactiveDays).toBe(27);
  });
  it('flags a fading week against the usual weeks', () => {
    // 3 usual weeks with 4 active days each, this week only 1
    const usual = ['2026-09-20', '2026-09-22', '2026-09-24', '2026-09-26', '2026-09-27', '2026-09-29', '2026-10-01', '2026-10-03', '2026-10-04', '2026-10-06', '2026-10-08', '2026-10-10'];
    const r = radarFor(base({ active_dates: [...usual, '2026-10-15'] }), '2026-10-17', joined);
    expect(r.usualPerWeek).toBe(4);
    expect(r.last7).toBe(1);
    expect(r.reasons.map((x) => x.code)).toContain('fading');
    expect(r.level).toBe('quiet');
  });
  it('shorter check-ins and coach silence are reasons; a pause silences everything', () => {
    const r = radarFor(base({ active_dates: days('2026-10-17'), checkin_lengths: [30, 20, 200, 180, 220], last_coach_message_at: '2026-10-05T10:00:00' }), '2026-10-17', joined);
    expect(r.reasons.map((x) => x.code)).toEqual(['short_checkins', 'coach_silent']);
    const p = radarFor(base({ active_dates: [], last_active_at: '2026-09-01T09:00:00', paused_until: '2026-10-20' }), '2026-10-17', joined);
    expect(p.level).toBe('paused');
    expect(p.reasons).toEqual([]);
  });
  it('a new athlete is not compared with empty weeks; programme end is counted', () => {
    const r = radarFor(base({ active_dates: days('2026-10-15'), plan_ends_on: '2026-10-21' }), '2026-10-17', '2026-10-12T09:00:00');
    expect(r.usualPerWeek).toBe(0);
    expect(r.reasons.some((x) => x.code === 'fading')).toBe(false);
    expect(r.programEndsIn).toBe(4);
  });
  it('lists the most urgent first and leaves out the fine ones', () => {
    const mk = (name: string, d: string) => ({ name, radar: radarFor(base({ active_dates: [], last_active_at: d }), '2026-10-17', joined) });
    const list = radarList([mk('A', '2026-10-16T09:00:00'), mk('B', '2026-10-08T09:00:00'), mk('C', '2026-09-20T09:00:00')]);
    expect(list.map((x) => x.name)).toEqual(['C', 'B']);
  });
});

describe('planned vs done', () => {
  const rows: ReviewPlanRow[] = [
    { exercise_id: 'sq', name: 'Squat', sets: 3, reps: '6-8', rir_target: 2, day_index: 0 },
    { exercise_id: 'rdl', name: 'RDL', sets: 3, reps: '8-10', rir_target: 2, day_index: 0 },
    { exercise_id: 'curl', name: 'Curl', sets: 2, reps: '10-12', rir_target: 1, day_index: 0 },
    { exercise_id: 'bp', name: 'Bench', sets: 3, reps: '5', rir_target: 2, day_index: 1 },
  ];
  const s = (id: string, reps: number, rir: number | null, w = 50, type: string | null = 'working'): ReviewSet => ({ exercise_id: id, exercise_name: id, set_type: type, reps, weight: w, rir, completed: true });
  it('compares each exercise with the plan and computes completion', () => {
    const sets = [
      s('sq', 5, 2, 20, 'warm_up'),
      s('sq', 8, 4), s('sq', 8, 4), s('sq', 8, 3), // top of range, RIR 3.7 vs 2 -> too easy
      s('rdl', 9, 2), s('rdl', 9, 2), // 2 of 3 sets
      s('pull', 10, 2), // extra
    ];
    const r = reviewSession(rows, sets, 0);
    expect(r.day).toBe(0);
    const by = Object.fromEntries(r.exercises.map((e) => [e.exerciseId, e]));
    expect(by.sq.verdict).toBe('too_easy');
    expect(by.sq.done.sets).toBe(3);
    expect(by.sq.avgRir).toBe(3.7);
    expect(by.rdl.verdict).toBe('fewer_sets');
    expect(by.curl.verdict).toBe('skipped');
    expect(by.pull.verdict).toBe('extra');
    expect(r.completion).toBe(63); // (3 + 2 + 0) / 8
  });
  it('too hard, below range, and day inferred when plan_day is missing', () => {
    const r = reviewSession(rows, [s('bp', 5, 0), s('bp', 5, 0), s('bp', 4, 0)], null);
    expect(r.day).toBe(1);
    expect(r.exercises[0].verdict).toBe('below_range');
    const r2 = reviewSession(rows, [s('bp', 5, 0), s('bp', 5, 0), s('bp', 5, 0)], 1);
    expect(r2.exercises[0].verdict).toBe('too_hard');
  });
});

describe('habit science', () => {
  it('SRBAI mean of 4 items on 1-7', () => {
    expect(srbaiScore([5, 4, 6, 3])).toBe(4.5);
    expect(srbaiScore([8, 4, 6, 3])).toBeNull();
    expect(srbaiScore([5, 4, 6])).toBeNull();
    const t = habitTrend([{ habit_id: 'h', rated_on: '2026-10-15', items: [6, 6, 5, 5] }, { habit_id: 'h', rated_on: '2026-10-01', items: [2, 3, 2, 1] }], 'h');
    expect(t.points.map((p) => p.score)).toEqual([2, 5.5]);
    expect(t.change).toBe(3.5);
  });
  it('rating due every 14 days, first after a week', () => {
    expect(ratingDue(null, '2026-10-17', '2026-10-12T10:00:00')).toBe(false);
    expect(ratingDue(null, '2026-10-17', '2026-10-10T10:00:00')).toBe(true);
    expect(ratingDue('2026-10-04', '2026-10-17', '2026-09-01')).toBe(false);
    expect(ratingDue('2026-10-03', '2026-10-17', '2026-09-01')).toBe(true);
  });
  it('consistency never resets on a miss; plans are cleaned', () => {
    expect(consistency(['2026-10-17', '2026-10-15', '2026-10-15', '2026-10-01'], '2026-10-17')).toEqual({ done: 2, of: 14 });
    expect(cleanPlans([{ kind: 'when', cue: ' Mon 7am  gym ', action: 'Lower A' }, { kind: 'if', cue: 'x', action: 'y' }])).toEqual([{ kind: 'when', cue: 'Mon 7am gym', action: 'Lower A' }]);
  });
});

import { csvCell, toCsv } from './export-csv';
describe('CSV export', () => {
  it('quotes, escapes and blocks formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(-2.5)).toBe('-2.5');
    expect(csvCell(null)).toBe('');
    expect(csvCell('سكوات')).toBe('سكوات');
    expect(toCsv(['a', 'b'], [[1, 'x\ny']])).toBe('a,b\r\n1,"x\ny"\r\n');
  });
});
