import { describe, expect, it } from 'vitest';
import {
  buildAthleteWeek, groupRecovery, loadUps, nutritionOutcome, plannedWeeklySets, sleepSummary, volumeProposals,
  type LoggedSet, type NutritionInput, type PlanInfo,
} from './autopilot';
import type { ExerciseMuscleMapping, MuscleRecoveryState } from '../recovery/engine';
import type { RecoveryMuscle } from '../recovery/muscles';

const today = '2026-10-17';
const day = (n: number) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

/** Daily weigh-ins over the last 21 days changing by `perWeek` kg a week, ending at `end` kg. */
function weights(end: number, perWeek: number, days = 21) {
  return Array.from({ length: days }, (_, i) => ({ date: day(days - 1 - i), kg: Math.round((end - (perWeek / 7) * (days - 1 - i)) * 1000) / 1000 }));
}

function nut(p: Partial<NutritionInput> = {}): NutritionInput {
  return {
    mode: 'cut', ratePct: 0.7, kcalOverride: 2200, modeStartedAt: day(40), weighIns: weights(80, -0.16), intakeByDate: {},
    today, sex: 'male', heightCm: 180, age: 30, ...p,
  };
}

function state(muscle: RecoveryMuscle, pct: number | null): MuscleRecoveryState {
  return {
    muscle, recoveryPercent: pct, hoursSinceLastTrained: null, hoursNeeded: 48,
    status: pct == null ? 'no_data' : pct < 50 ? 'red' : pct < 90 ? 'orange' : 'green',
    lastTrainedDate: null, weeklyEffectiveSets: 0, weeklySetBand: 'low', sessionEffectiveSets: 0, hasSessionVolumeWarning: false,
    personalMultiplier: 1, newExercises: [],
    modifiers: { rirExtra: 0, volumeExtra: 0, sorenessExtra: 0, noveltyExtra: 0, sleepMultiplier: 1, stressMultiplier: 1, personalMultiplier: 1 },
  };
}

const map = (id: string, muscles: [RecoveryMuscle, number][]): [string, ExerciseMuscleMapping] =>
  [id, { exerciseId: id, exerciseName: id, muscles: muscles.map(([muscle, contribution]) => ({ muscle, contribution })) }];

const mappings = new Map<string, ExerciseMuscleMapping>([
  map('bench', [['upper_chest', 1], ['lower_chest', 1], ['triceps', 0.5], ['front_delts', 0.5]]),
  map('row', [['lats', 1], ['mid_back', 1], ['biceps', 0.5]]),
  map('squat', [['quads', 1], ['glutes', 1], ['adductors', 0.5]]),
  map('curl', [['biceps', 1]]),
]);

const plan: PlanInfo = {
  sessionsPerWeek: 4,
  rows: [
    { id: 'r1', exercise_id: 'bench', name: 'Bench press', sets: 3, reps: '8-12', rest_seconds: 120, notes: null, day_index: 0 },
    { id: 'r2', exercise_id: 'row', name: 'Row', sets: 5, reps: '8-12', rest_seconds: 120, notes: null, day_index: 0 },
    { id: 'r3', exercise_id: 'squat', name: 'Squat', sets: 5, reps: '6-8', rest_seconds: 180, notes: null, day_index: 1 },
    { id: 'r4', exercise_id: 'curl', name: 'Curl', sets: 2, reps: '10-15', rest_seconds: 60, notes: null, day_index: 1 },
  ],
};

describe('recovery map', () => {
  it('a group shows its least recovered muscle', () => {
    const g = groupRecovery([state('upper_chest', 95), state('lower_chest', 40), state('quads', null)]);
    expect(g.find((x) => x.group === 'chest')).toEqual({ group: 'chest', status: 'red', percent: 40 });
    expect(g.find((x) => x.group === 'quads')).toEqual({ group: 'quads', status: 'no_data', percent: null });
    expect(g).toHaveLength(8);
  });
});

describe('nutrition', () => {
  it('needs a goal and enough weigh-ins', () => {
    expect(nutritionOutcome(nut({ mode: null })).status).toBe('no_goal');
    const few = nutritionOutcome(nut({ weighIns: [{ date: day(2), kg: 80 }, { date: day(1), kg: 79.9 }] }));
    expect(few).toEqual({ status: 'need_weighins', points: 2, spanDays: 1 });
  });

  it('leaves an on-track cut alone', () => {
    // −0.56 kg/wk at 80 kg = −0.7 %/wk
    expect(nutritionOutcome(nut({ weighIns: weights(80, -0.56) })).status).toBe('on_track');
  });

  it('slow cut on a fixed target: 2200 → 2000 kcal (gap 0.5 %/wk × 80 kg ≈ 440 kcal/day, capped at 200)', () => {
    const o = nutritionOutcome(nut());
    expect(o.status).toBe('adjust');
    if (o.status !== 'adjust') return;
    expect(o.rate.pctPerWeek).toBeCloseTo(-0.2, 1);
    expect(o.from).toBe(2200);
    expect(o.to).toBe(2000);
    expect(o.base).toBe('target');
  });

  it('a small gap moves by the gap itself, at least 100 kcal', () => {
    // Target 0.25 %/wk, real −0.125 %/wk (−0.1 kg/wk at 80 kg): gap 0.125 % × 80 kg × 7700 / 7 = 110 kcal/day
    const o = nutritionOutcome(nut({ ratePct: 0.25, weighIns: weights(80, -0.1) }));
    expect(o.status).toBe('adjust');
    if (o.status !== 'adjust') return;
    expect(o.from - o.to).toBe(110);
  });

  it('too early on a new goal, and fast loss eats more', () => {
    expect(nutritionOutcome(nut({ modeStartedAt: day(10) }))).toEqual({ status: 'too_early', daysOnGoal: 10 });
    const fast = nutritionOutcome(nut({ weighIns: weights(80, -1.2) })); // −1.5 %/wk
    expect(fast.status).toBe('adjust');
    if (fast.status === 'adjust') expect(fast.to).toBe(2400);
  });

  it('weight going up on a cut: check logging, never cut calories', () => {
    expect(nutritionOutcome(nut({ weighIns: weights(80, 0.3) })).status).toBe('wrong_direction');
  });

  it('logged intake far from the target: talk, do not change the target', () => {
    const intake: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) intake[day(i)] = 1800;
    const o = nutritionOutcome(nut({ intakeByDate: intake }));
    expect(o.status).toBe('off_target');
    if (o.status === 'off_target') { expect(o.avgIntake).toBe(1800); expect(o.loggedDays).toBe(12); }
  });

  it('without a fixed target it starts from logged intake, and asks for logs when there are too few', () => {
    const intake: Record<string, number> = {};
    for (let i = 1; i <= 11; i++) intake[day(i)] = 2500;
    intake[day(0)] = 500; // today: unfinished, ignored
    const o = nutritionOutcome(nut({ kcalOverride: null, intakeByDate: intake }));
    expect(o.status).toBe('adjust');
    if (o.status === 'adjust') { expect(o.base).toBe('intake'); expect(o.from).toBe(2500); expect(o.to).toBe(2300); }
    const few: Record<string, number> = { [day(1)]: 2500, [day(2)]: 600 };
    expect(nutritionOutcome(nut({ kcalOverride: null, intakeByDate: few })).status).toBe('need_food_logs');
  });

  it('never goes under the safety floor (BMR or 1200/1500)', () => {
    // Woman 60 kg, 165 cm, 30 y: BMR = 600 + 1031.25 − 150 − 161 = 1320 → floor 1320
    const o = nutritionOutcome(nut({ sex: 'female', heightCm: 165, age: 30, kcalOverride: 1300, weighIns: weights(60, -0.06) }));
    expect(o.status).toBe('at_floor');
    if (o.status === 'at_floor') { expect(o.from).toBe(1300); expect(o.floor).toBe(1320); }
    const o2 = nutritionOutcome(nut({ sex: 'female', heightCm: 165, age: 30, kcalOverride: 1400, weighIns: weights(60, -0.06) }));
    expect(o2.status).toBe('adjust');
    if (o2.status === 'adjust') expect(o2.to).toBe(1320);
  });

  it('slow lean gain eats a little more', () => {
    const o = nutritionOutcome(nut({ mode: 'bulk', ratePct: 0.25, weighIns: weights(80, 0) }));
    expect(o.status).toBe('adjust');
    if (o.status === 'adjust') expect(o.to).toBeGreaterThan(o.from);
  });
});

describe('training volume', () => {
  it('counts planned sets per week from the plan and how often it runs', () => {
    const p = plannedWeeklySets(plan, mappings);
    // 2 plan days run 4× a week = 2 cycles: bench 3 sets × 2
    expect(p.upper_chest).toBe(6);
    expect(p.lats).toBe(10);
    expect(p.biceps).toBe(2 * 2 + 5 * 0.5 * 2); // 9
    expect(p.triceps).toBe(3);
  });

  it('adds one set where a directly trained muscle is under 10 sets a week, lowest first, max 2', () => {
    const v = volumeProposals({ plan, mappings, sessions14d: 8, sleep: null });
    expect(v.blocked).toBeNull();
    expect(v.proposals.map((p) => [p.target, p.row.id, p.toSets, p.plannedNow, p.plannedAfter])).toEqual([
      ['chest', 'r1', 4, 6, 8],
      ['biceps', 'r4', 3, 9, 11],
    ]);
  });

  it('does not add sets when sessions were missed or sleep is short', () => {
    expect(volumeProposals({ plan, mappings, sessions14d: 4, sleep: null }).blocked).toBe('adherence');
    expect(volumeProposals({ plan, mappings, sessions14d: 8, sleep: { avgHours: 5.5, nights: 5 } }).blocked).toBe('sleep');
    expect(volumeProposals({ plan: null, mappings, sessions14d: 8, sleep: null }).blocked).toBe('no_plan');
  });
});

describe('load progression', () => {
  const set = (session: string, at: string, weight: number, reps: number, ex = 'bench'): LoggedSet =>
    ({ exercise_id: ex, session_id: session, completed_at: at, set_type: 'working', weight, reps, completed: true });

  it('top of the range on every set in the last 2 sessions → +2–5 %', () => {
    const logs = [
      set('s1', '2026-10-10T10:00:00Z', 60, 12), set('s1', '2026-10-10T10:00:00Z', 60, 12),
      set('s2', '2026-10-14T10:00:00Z', 60, 12), set('s2', '2026-10-14T10:00:00Z', 60, 12),
    ];
    expect(loadUps(plan, logs)).toEqual([{ rowId: 'r1', exercise: 'Bench press', weight: 60, topReps: 12, low: 61, high: 63 }]);
  });

  it('no suggestion when a set fell short or the load changed', () => {
    expect(loadUps(plan, [set('s1', '2026-10-10T10:00:00Z', 60, 12), set('s2', '2026-10-14T10:00:00Z', 60, 11)])).toEqual([]);
    expect(loadUps(plan, [set('s1', '2026-10-10T10:00:00Z', 57.5, 12), set('s2', '2026-10-14T10:00:00Z', 60, 12)])).toEqual([]);
    expect(loadUps(plan, [set('s2', '2026-10-14T10:00:00Z', 60, 12)])).toEqual([]);
  });
});

describe('sleep and the whole week', () => {
  it('needs 4 nights in the last 7 days', () => {
    expect(sleepSummary([{ date: day(1), hours: 6 }, { date: day(2), hours: 6 }, { date: day(3), hours: 6 }], today)).toBeNull();
    expect(sleepSummary([6, 6.5, 5.5, 6].map((h, i) => ({ date: day(i + 1), hours: h })), today)).toEqual({ avgHours: 6, nights: 4 });
  });

  it('builds one list of suggestions with reasons and references', () => {
    const w = buildAthleteWeek({
      athleteId: 'a1',
      nutrition: { ...nut(), proteinPerKg: 2 },
      volume: { plan, mappings, sessions14d: 8, sleep: null },
      logs: [],
      sleepNights: [6, 6.5, 6.5, 6].map((h, i) => ({ date: day(i + 1), hours: h })),
      noWorkoutDays: null,
      noFoodDays: 4,
    });
    expect(w.proposals.map((p) => p.id)).toEqual(['a1:kcal', 'a1:set:r1', 'a1:set:r4', 'a1:sleep', 'a1:foodgap']);
    expect(w.proposals.every((p) => p.kind === 'message' && (p.message.topic === 'food_gap') ? true : p.refs.length > 0)).toBe(true);
  });
});
