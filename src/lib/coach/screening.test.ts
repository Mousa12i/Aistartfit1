import { describe, expect, it } from 'vitest';
import { cleanQuestions, screeningOutcome } from './screening';
import { checkinGlance, addDaysYmd } from './checkin-glance';
import { athleteSignals, daysBetween, plannedPerWeek, triage, type RosterRow } from './insights';

describe('ACSM 2015 pre-participation screening', () => {
  it('follows the four branches of the algorithm', () => {
    // Not exercising regularly
    expect(screeningOutcome({ exercisesRegularly: false, knownDisease: false, symptoms: [] })).toBe('no_clearance');
    expect(screeningOutcome({ exercisesRegularly: false, knownDisease: true, symptoms: [] })).toBe('clearance');
    expect(screeningOutcome({ exercisesRegularly: false, knownDisease: false, symptoms: ['dizziness'] })).toBe('clearance');
    // Exercising regularly
    expect(screeningOutcome({ exercisesRegularly: true, knownDisease: false, symptoms: [] })).toBe('no_clearance');
    expect(screeningOutcome({ exercisesRegularly: true, knownDisease: true, symptoms: [] })).toBe('clearance_before_vigorous');
    expect(screeningOutcome({ exercisesRegularly: true, knownDisease: true, symptoms: ['chest_pain'] })).toBe('stop_and_clearance');
    expect(screeningOutcome({ exercisesRegularly: true, knownDisease: false, symptoms: ['palpitations'] })).toBe('stop_and_clearance');
  });

  it('cleans the coach questions', () => {
    expect(cleanQuestions(['  How   many steps? ', 'how many steps?', 'ok', ...Array(12).fill(0).map((_, i) => `Question ${i}`)])).toHaveLength(10);
    expect(cleanQuestions(['  How   many steps? '])).toEqual(['How many steps?']);
  });
});

describe('check-in week at a glance', () => {
  const sub = new Date(2026, 9, 18, 19, 0).toISOString(); // Sunday 18 Oct, 19:00 local
  const base = {
    submittedAt: sub, weightKg: 72.1, waistCm: 74, prev: { weightKg: 72.8, waistCm: 75, submittedAt: new Date(2026, 9, 11, 9, 0).toISOString() },
    plannedPerWeek: 4, kcalTarget: 1850, habits: { done: 10, possible: 14 }, dataFrom: '2026-10-05',
  };
  it('counts only the 7 days up to the check-in', () => {
    const g = checkinGlance({
      ...base,
      sessions: [new Date(2026, 9, 12, 7).toISOString(), new Date(2026, 9, 14, 7).toISOString(), new Date(2026, 9, 11, 23, 30).toISOString(), new Date(2026, 9, 19, 7).toISOString()],
      meals: [{ date: '2026-10-12', kcal: 1800, protein: 120 }, { date: '2026-10-12', kcal: 200, protein: 10 }, { date: '2026-10-13', kcal: 1700, protein: 110 }, { date: '2026-10-11', kcal: 3000, protein: 50 }],
      sleep: [{ date: '2026-10-12', hours: 7 }, { date: '2026-10-13', hours: 6 }, { date: '2026-10-10', hours: 4 }, { date: '2026-10-14', hours: null }],
    });
    expect(g.from).toBe('2026-10-12');
    expect(g.to).toBe('2026-10-18');
    expect(g.sessions).toBe(2);
    expect(g.foodDays).toBe(2);
    expect(g.avgKcal).toBe(1850); // (2000 + 1700) / 2
    expect(g.avgProtein).toBe(120); // (130 + 110) / 2
    expect(g.kcalVsTargetPct).toBe(0);
    expect(g.sleepAvg).toBe(6.5);
    expect(g.sleepNights).toBe(2);
    expect(g.weightDelta).toBe(-0.7);
    expect(g.waistDelta).toBe(-1);
    expect(g.daysSincePrev).toBe(7);
    expect(g.habitPct).toBe(71);
    expect(g.complete).toBe(true);
  });
  it('marks old windows incomplete and leaves missing data empty', () => {
    const g = checkinGlance({ ...base, prev: null, weightKg: null, sessions: [], meals: [], sleep: [], habits: null, dataFrom: '2026-10-15', kcalTarget: null });
    expect(g.complete).toBe(false);
    expect(g.avgKcal).toBeNull();
    expect(g.weightDelta).toBeNull();
    expect(g.daysSincePrev).toBeNull();
    expect(g.habitPct).toBeNull();
  });
  it('date helper crosses month ends', () => {
    expect(addDaysYmd('2026-11-01', -6)).toBe('2026-10-26');
    expect(addDaysYmd('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('coach insights with the plan and calendar days', () => {
  const now = new Date(2026, 9, 16, 8, 0);
  const row = (p: Partial<RosterRow>): RosterRow => ({
    athlete_id: 'a', display_name: 'Sam', avatar_url: null, joined_at: new Date(2026, 6, 1).toISOString(),
    fitness_goal: null, experience_level: null, age: null, height_cm: null, profile_weight_kg: null, limitations: null,
    last_workout_at: new Date(2026, 9, 15, 7).toISOString(), workouts_7d: 3, workouts_28d: 12, food_days_7d: 7, last_food_date: '2026-10-16',
    kcal_today: 0, protein_today: 0, goal_mode: null, rate_pct: null, kcal_override: null, unread: 0, pending_checkins: 0,
    last_checkin_at: new Date(2026, 9, 13).toISOString(), ...p,
  });
  it('yesterday late evening is one calendar day ago', () => {
    expect(daysBetween(new Date(2026, 9, 15, 23, 30).toISOString(), now)).toBe(1);
    expect(daysBetween(new Date(2026, 9, 16, 0, 5).toISOString(), now)).toBe(0);
  });
  it('training consistency uses the sessions the plan asks for', () => {
    expect(plannedPerWeek({ planned_per_week: null })).toBe(3);
    expect(plannedPerWeek({ planned_per_week: 5 })).toBe(5);
    expect(athleteSignals(row({ planned_per_week: 6 }), now).trainingConsistency).toBe(0.5);
    expect(athleteSignals(row({}), now).trainingConsistency).toBe(1);
    // 5 a week planned, 8 sessions in 4 weeks: fewer than half (10) -> flagged
    expect(athleteSignals(row({ planned_per_week: 5, workouts_28d: 8 }), now).reasons.map((r) => r.code)).toContain('low_consistency');
    expect(athleteSignals(row({ planned_per_week: 3, workouts_28d: 8 }), now).reasons.map((r) => r.code)).not.toContain('low_consistency');
  });
  it('screening comes first, longest-waiting message next, missing intake for new athletes', () => {
    const items = triage([
      row({ athlete_id: 'm1', display_name: 'A', unread: 1, last_message_from_athlete: true, last_message_at: new Date(2026, 9, 16, 6).toISOString() }),
      row({ athlete_id: 'm2', display_name: 'B', unread: 1, last_message_from_athlete: true, last_message_at: new Date(2026, 9, 14, 8).toISOString() }),
      row({ athlete_id: 's', display_name: 'C', intake_outcome: 'stop_and_clearance' }),
      row({ athlete_id: 'n', display_name: 'D', joined_at: new Date(2026, 9, 14).toISOString(), intake_outcome: null }),
    ], now);
    expect(items.map((i) => i.athleteId)).toEqual(['s', 'm2', 'm1', 'n']);
    expect(items[1].waitingHours).toBe(48);
    expect(items[3].kind).toBe('intake');
  });
});
