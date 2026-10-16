import { describe, expect, it } from 'vitest';
import { athleteSignals, coachTierNow, normalizeCode, summarize, triage, weekOf, type RosterRow } from './insights';

const now = new Date('2026-10-16T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

function row(p: Partial<RosterRow> = {}): RosterRow {
  return {
    athlete_id: 'a', display_name: 'Sam', avatar_url: null, joined_at: daysAgo(60),
    fitness_goal: null, experience_level: null, age: null, height_cm: null, profile_weight_kg: null, limitations: null,
    last_workout_at: daysAgo(1), workouts_7d: 3, workouts_28d: 12, food_days_7d: 7, last_food_date: daysAgo(0).slice(0, 10),
    kcal_today: 0, protein_today: 0, goal_mode: null, rate_pct: null, kcal_override: null,
    unread: 0, pending_checkins: 0, last_checkin_at: daysAgo(3), ...p,
  };
}

describe('coach insights', () => {
  it('a consistent athlete is fine', () => {
    const s = athleteSignals(row(), now);
    expect(s.level).toBe('ok');
    expect(s.reasons).toEqual([]);
    expect(s.trainingConsistency).toBe(1);
  });

  it('flags a training gap with its reason', () => {
    expect(athleteSignals(row({ last_workout_at: daysAgo(6) }), now).level).toBe('watch');
    const s = athleteSignals(row({ last_workout_at: daysAgo(12), last_food_date: daysAgo(4).slice(0, 10) }), now);
    expect(s.level).toBe('at_risk');
    expect(s.reasons.map((r) => r.code)).toEqual(['no_workout', 'no_food']);
  });

  it('does not flag food logging for athletes who never logged food', () => {
    const s = athleteSignals(row({ last_food_date: null, food_days_7d: 0 }), now);
    expect(s.reasons.some((r) => r.code === 'no_food')).toBe(false);
  });

  it('new athletes are not flagged for missing history', () => {
    const s = athleteSignals(row({ joined_at: daysAgo(2), last_workout_at: null, last_checkin_at: null, workouts_28d: 0 }), now);
    expect(s.level).toBe('ok');
  });

  it('triage puts messages first, then check-ins, then risk, then new joiners', () => {
    const items = triage([
      row({ athlete_id: 'r', display_name: 'Risky', last_workout_at: daysAgo(15) }),
      row({ athlete_id: 'n', display_name: 'New', joined_at: daysAgo(1), last_checkin_at: null }),
      row({ athlete_id: 'c', display_name: 'Checkin', pending_checkins: 1 }),
      row({ athlete_id: 'm', display_name: 'Msg', unread: 2 }),
    ], now);
    expect(items.map((i) => i.kind)).toEqual(['message', 'checkin', 'at_risk', 'new']);
    const sum = summarize([row(), row({ unread: 2 })], now);
    expect(sum.athletes).toBe(2);
    expect(sum.unread).toBe(2);
  });

  it('coach tier, week and code helpers', () => {
    expect(coachTierNow('coach_pro', '2026-11-01T00:00:00Z', now)).toBe('coach_pro');
    expect(coachTierNow('coach_pro', '2026-10-01T00:00:00Z', now)).toBe('free');
    expect(weekOf(new Date(2026, 9, 18))).toBe('2026-10-12');
    expect(normalizeCode(' sf 7k2qxm ')).toBe('SF-7K2QXM');
    expect(normalizeCode('7k2qxm')).toBe('SF-7K2QXM');
  });
});
