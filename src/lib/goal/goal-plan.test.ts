import { describe, expect, it } from 'vitest';
import { buildGoalPlan, checkTargetWeight, paceRate, projectWeight, weeksToTarget } from './goal-plan';
import type { BodyStats, PlanSettings } from '../nutrition/engine';

const stats: BodyStats = { weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'moderate', experience: 'intermediate', bodyFatPct: null };
const current: PlanSettings = {
  mode: 'maintain', ratePct: 0, proteinPerKg: null, fatPct: null, mealsPerDay: 4, carbShift: false, kcalOverride: 2000, adaptiveTdee: null, dietBreakUntil: null,
};
const base = { stats, targetKg: null, current, trainingDaysPerWeek: 4, today: '2026-10-16', noDeficit: false, noWeightGoals: false };

describe('goal plan', () => {
  it('keeps every pace inside the evidence-based ranges', () => {
    expect(paceRate('cut', 'gentle', 'intermediate')).toBe(0.5);
    expect(paceRate('cut', 'standard', 'intermediate')).toBe(0.7);
    expect(paceRate('cut', 'faster', 'intermediate')).toBe(1);
    expect(paceRate('bulk', 'standard', 'beginner')).toBe(0.35);
    expect(paceRate('bulk', 'faster', 'beginner')).toBe(0.5);
    expect(paceRate('bulk', 'gentle', 'advanced')).toBe(0.1);
    expect(paceRate('recomp', 'faster', null)).toBe(0);
  });

  it('builds a cut from the nutrition engine: ~0.7%/wk deficit, high protein, old manual kcal dropped', () => {
    const p = buildGoalPlan({ ...base, goal: 'cut', pace: 'standard' });
    // Mifflin: 10*80 + 6.25*180 - 5*30 + 5 = 1780; x1.55 = 2759 maintenance.
    expect(p.trainingDay.maintenance).toBe(2760);
    // 0.7% of 80 kg = 0.56 kg/wk -> 0.56*7700/7 = 616 kcal/day deficit.
    expect(p.trainingDay.kcal).toBe(2140);
    expect(p.trainingDay.protein).toBe(176); // 2.2 g/kg
    expect(p.settings.kcalOverride).toBeNull();
    expect(p.ratePct).toBeCloseTo(0.7, 1);
    expect(p.mapping.trainingGoal).toBe('muscle');
    expect(p.timeline[1].kg).toBeCloseTo(79.4, 1);
  });

  it('weight loss adds aerobic work on the training side', () => {
    const p = buildGoalPlan({ ...base, goal: 'lose_weight', pace: 'gentle' });
    expect(p.mapping).toEqual({ nutritionMode: 'cut', trainingGoal: 'fat_loss' });
    expect(p.refs).toContain('who2020');
  });

  it('reports the real rate when a safety cap makes it slower than chosen', () => {
    const small: BodyStats = { ...stats, weightKg: 120, heightCm: 160, age: 60, sex: 'female', activity: 'sedentary' };
    const p = buildGoalPlan({ ...base, stats: small, goal: 'cut', pace: 'faster' });
    expect(p.trainingDay.notes.some((n) => n.kind === 'warning')).toBe(true);
    expect(p.ratePct).toBeLessThan(1);
  });

  it('plans no deficit when one is not allowed', () => {
    const p = buildGoalPlan({ ...base, goal: 'cut', pace: 'standard', noDeficit: true });
    expect(p.trainingDay.mode).toBe('maintain');
    expect(p.ratePct).toBe(0);
  });

  it('timeline and weeks to target', () => {
    expect(projectWeight(100, 1, -1, 2).map((p) => p.kg)).toEqual([100, 99, 98]);
    expect(weeksToTarget(80, 75, 0.7, -1)).toBe(10);
    expect(weeksToTarget(80, 85, 0.7, -1)).toBeNull();
  });

  it('refuses an underweight target and wrong-side targets', () => {
    expect(checkTargetWeight('cut', 60, 55, 180, 15).issue).toBe('underweight');
    expect(checkTargetWeight('cut', 80, 82, 180, null).issue).toBe('not_below');
    expect(checkTargetWeight('bulk', 80, 78, 180, null).issue).toBe('not_above');
    expect(checkTargetWeight('cut', 100, 75, 180, 40).issue).toBe('long');
    expect(checkTargetWeight('cut', 100, 75, 180, 40).ok).toBe(true);
  });
});
