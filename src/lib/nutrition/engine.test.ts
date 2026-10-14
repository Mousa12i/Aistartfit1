import { describe, expect, it } from 'vitest';
import {
  bmrMifflin,
  computeTargets,
  computeTrend,
  estimateAdaptiveTdee,
  rateFeedback,
  stepTowards,
  trainingDaysPerWeek,
  weightRate,
  type BodyStats,
  type PlanSettings,
  type TargetContext,
} from './engine';
import { addDays } from './dates';

const male80: BodyStats = { weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'moderate', experience: 'intermediate', bodyFatPct: null };
const plan = (p: Partial<PlanSettings> = {}): PlanSettings => ({
  mode: 'maintain',
  ratePct: 0,
  proteinPerKg: null,
  fatPct: null,
  mealsPerDay: 4,
  carbShift: false,
  kcalOverride: null,
  adaptiveTdee: null,
  dietBreakUntil: null,
  ...p,
});
const ctx = (c: Partial<TargetContext> = {}): TargetContext => ({
  today: '2026-10-13',
  date: '2026-10-13',
  trainingDay: false,
  trainingDaysPerWeek: 3,
  noDeficit: false,
  noWeightGoals: false,
  ...c,
});

describe('bmrMifflin', () => {
  it('matches the published equation', () => {
    expect(bmrMifflin(80, 180, 30, 'male')).toBe(1780);
    expect(bmrMifflin(80, 180, 30, 'female')).toBe(1614);
    expect(bmrMifflin(80, 180, 30, 'unspecified')).toBe(1697);
  });
});

describe('computeTargets', () => {
  it('maintenance targets from formula and macro split', () => {
    const t = computeTargets(male80, plan(), ctx());
    expect(t.maintenance).toBe(2760);
    expect(t.kcal).toBe(2760);
    expect(t.protein).toBe(144); // 1.8 g/kg
    expect(t.fat).toBe(77); // 25% of energy
    expect(t.carbs).toBe(373);
    expect(t.fiber).toBe(39); // 14 g / 1000 kcal
    expect(t.waterMl).toBe(2800);
    expect(t.proteinPerMeal).toEqual({ target: 36, low: 32, high: 44 });
  });

  it('fat loss uses the weekly rate and higher protein', () => {
    const t = computeTargets(male80, plan({ mode: 'cut', ratePct: 0.7 }), ctx());
    expect(t.kcal).toBe(2140);
    expect(t.dailyDelta).toBeLessThan(0);
    expect(t.protein).toBe(176); // 2.2 g/kg
    expect(t.expectedWeeklyChangeKg).toBeCloseTo(-0.56, 1);
  });

  it('never goes below the safety floor', () => {
    const small: BodyStats = { weightKg: 50, heightCm: 160, age: 30, sex: 'female', activity: 'sedentary', experience: null, bodyFatPct: null };
    const t = computeTargets(small, plan({ mode: 'cut', ratePct: 1 }), ctx());
    expect(t.kcal).toBe(1200);
    expect(t.notes.some((n) => n.kind === 'warning')).toBe(true);
  });

  it('caps an aggressive deficit at 25% of maintenance', () => {
    const t = computeTargets(male80, plan({ mode: 'cut', ratePct: 1, adaptiveTdee: 2000 }), ctx());
    expect(t.kcal).toBe(1780); // 1500 after the cap, raised to the BMR floor
    expect(t.notes.some((n) => n.text.includes('capped'))).toBe(true);
  });

  it('pauses weight goals after a positive check-in', () => {
    const t = computeTargets(male80, plan({ mode: 'cut', ratePct: 0.7 }), ctx({ noWeightGoals: true }));
    expect(t.mode).toBe('maintain');
    expect(t.kcal).toBe(2760);
  });

  it('blocks a deficit for under-18s but allows a surplus', () => {
    expect(computeTargets(male80, plan({ mode: 'cut', ratePct: 0.7 }), ctx({ noDeficit: true })).mode).toBe('maintain');
    expect(computeTargets(male80, plan({ mode: 'bulk', ratePct: 0.25 }), ctx({ noDeficit: true })).mode).toBe('bulk');
  });

  it('applies a diet break until its end date', () => {
    const during = computeTargets(male80, plan({ mode: 'cut', ratePct: 0.7, dietBreakUntil: '2026-10-20' }), ctx());
    const after = computeTargets(male80, plan({ mode: 'cut', ratePct: 0.7, dietBreakUntil: '2026-10-10' }), ctx());
    expect(during.mode).toBe('maintain');
    expect(after.mode).toBe('cut');
  });

  it('uses a reference weight for protein above BMI 30', () => {
    const heavy: BodyStats = { ...male80, weightKg: 120, heightCm: 175 };
    const t = computeTargets(heavy, plan(), ctx());
    expect(t.proteinRefWeightKg).toBeCloseTo(76.6, 1);
    expect(t.protein).toBe(138);
  });

  it('carb shift keeps the weekly total', () => {
    const base = computeTargets(male80, plan({ carbShift: false }), ctx());
    const training = computeTargets(male80, plan({ carbShift: true }), ctx({ trainingDay: true, trainingDaysPerWeek: 3 }));
    const rest = computeTargets(male80, plan({ carbShift: true }), ctx({ trainingDay: false, trainingDaysPerWeek: 3 }));
    expect(training.carbs).toBeGreaterThan(base.carbs);
    expect(rest.carbs).toBeLessThan(base.carbs);
    const weekly = training.carbs * 3 + rest.carbs * 4;
    expect(Math.abs(weekly - base.carbs * 7)).toBeLessThanOrEqual(4);
  });

  it('caps a lean-gain surplus at 15%', () => {
    const t = computeTargets(male80, plan({ mode: 'bulk', ratePct: 0.5 }), ctx());
    expect(t.dailyDelta).toBeGreaterThan(0);
    expect(t.dailyDelta).toBeLessThanOrEqual(Math.round(t.maintenance * 0.15) + 10);
  });
});

describe('trend and rate', () => {
  it('smooths weights with gap-aware EWMA', () => {
    const t = computeTrend([
      { date: '2026-10-01', kg: 80 },
      { date: '2026-10-02', kg: 81 },
      { date: '2026-10-03', kg: 79 },
    ]);
    expect(t.map((p) => p.trend)).toEqual([80, 80.1, 79.99]);
    const gap = computeTrend([
      { date: '2026-10-01', kg: 80 },
      { date: '2026-10-03', kg: 82 },
    ]);
    expect(gap[1].trend).toBeCloseTo(80.38, 2);
  });

  it('averages several readings on the same day', () => {
    const t = computeTrend([
      { date: '2026-10-01', kg: 80 },
      { date: '2026-10-01', kg: 81 },
    ]);
    expect(t).toHaveLength(1);
    expect(t[0].kg).toBe(80.5);
  });

  it('estimates weekly rate by regression', () => {
    const today = '2026-10-14';
    const weights = Array.from({ length: 14 }, (_, i) => ({ date: addDays(today, -13 + i), kg: 80 - 0.1 * i }));
    const rate = weightRate(weights, today, 14);
    expect(rate?.kgPerWeek).toBeCloseTo(-0.7, 5);
    expect(rate?.pctPerWeek).toBeCloseTo(-0.9, 1);
    expect(weightRate(weights.slice(0, 3), today, 14)).toBeNull();
  });

  it('gives rate feedback', () => {
    expect(rateFeedback('cut', 0.7, -0.7).status).toBe('on_track');
    expect(rateFeedback('cut', 0.7, -1.3).status).toBe('too_fast');
    expect(rateFeedback('cut', 0.7, 0.3).status).toBe('wrong_direction');
    expect(rateFeedback('bulk', 0.25, 0.8).status).toBe('too_fast');
    expect(rateFeedback('maintain', 0, 0.1).status).toBe('stable');
  });
});

describe('adaptive maintenance', () => {
  const today = '2026-10-22';
  const intake: Record<string, number> = {};
  const weights: { date: string; kg: number }[] = [];
  for (let i = 1; i <= 21; i++) {
    const d = addDays(today, -i);
    intake[d] = 2500;
    weights.push({ date: d, kg: 80 + 0.05 * i });
  }

  it('estimates maintenance from intake and trend', () => {
    const res = estimateAdaptiveTdee({ intakeByDate: intake, weighIns: weights, today, bmr: 1780, currentTarget: 2500 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.tdee).toBe(2890); // 2500 + 0.05 kg/day × 7700
      expect(res.confidence).toBe('high');
      expect(res.kgPerWeek).toBeCloseTo(-0.35, 2);
    }
  });

  it('refuses with too little logging', () => {
    const sparse = Object.fromEntries(Object.entries(intake).slice(0, 10));
    const res = estimateAdaptiveTdee({ intakeByDate: sparse, weighIns: weights, today, bmr: 1780, currentTarget: 2500 });
    expect(res.ok).toBe(false);
  });

  it('treats very low days as incomplete', () => {
    const withGaps = { ...intake };
    for (const key of Object.keys(withGaps).slice(0, 10)) withGaps[key] = 300;
    const res = estimateAdaptiveTdee({ intakeByDate: withGaps, weighIns: weights, today, bmr: 1780, currentTarget: 2500 });
    expect(res.ok).toBe(false);
  });

  it('moves gradually', () => {
    expect(stepTowards(2500, 2900)).toBe(2750);
    expect(stepTowards(2500, 2600)).toBe(2600);
    expect(stepTowards(2500, 2100)).toBe(2250);
  });
});

describe('training days per week', () => {
  it('uses real sessions when there are enough', () => {
    const today = '2026-10-28';
    const dates = Array.from({ length: 8 }, (_, i) => addDays(today, -i * 3));
    expect(trainingDaysPerWeek(['Mon', 'Wed', 'Fri', 'Sat'], dates, today)).toBe(2);
  });
  it('falls back to planned days', () => {
    expect(trainingDaysPerWeek(['Mon', 'Wed', 'Fri', 'Sat'], [], '2026-10-28')).toBe(4);
  });
});
