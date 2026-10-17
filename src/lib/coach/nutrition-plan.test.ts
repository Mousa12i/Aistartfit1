import { describe, expect, it } from 'vitest';
import { applyCoachPlan, dayTargets, itemMacros, kcalFrom, planDayMacros, planErrors, shoppingList, type NutritionPlan } from './nutrition-plan';
import type { Targets } from '../nutrition/engine';

const rice = { name: 'Rice, white, cooked', ref: 'usda:1', amount: 200, per100: { kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4 } };
const chicken = { name: 'Chicken breast, cooked', ref: 'usda:2', amount: 150, per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 } };
const bar = { name: 'Protein bar', ref: 'off:3', amount: 1, servingOnly: true, servingLabel: '1 bar', per100: { kcal: 200, protein: 20, carbs: 22, fat: 6, fiber: 3 } };

function plan(p: Partial<NutritionPlan> = {}): NutritionPlan {
  return {
    coach_id: 'c', athlete_id: 'a', protein_g: 160, carbs_train_g: 250, fat_train_g: 70, carbs_rest_g: 180, fat_rest_g: 70, fiber_g: 30, water_ml: 3000,
    meals: [
      { id: 'm1', name: 'Lunch', time: '13:00', options: [{ id: 'o1', label: 'A', items: [rice, chicken] }, { id: 'o2', label: 'B', items: [bar] }] },
      { id: 'm2', name: 'Snack', time: null, options: [{ id: 'o3', label: 'A', items: [bar] }] },
    ],
    guidance: {},
    ...p,
  };
}

const app: Targets = {
  kcal: 2400, protein: 150, carbs: 280, fat: 70, fiber: 34, waterMl: 2800, satFatMax: 27, freeSugarMax: 60, sodiumMax: 2300, bmr: 1800,
  maintenance: 2700, maintenanceSource: 'formula', dailyDelta: -300, expectedWeeklyChangeKg: -0.27, mode: 'cut', proteinPerKg: 2, proteinRefWeightKg: 80,
  proteinPerMeal: { target: 40, low: 32, high: 44 }, fatPct: 26, carbShiftKcal: 0, floorKcal: 1800, notes: [],
};

describe('coach nutrition plan', () => {
  it('kcal from macros with Atwater 4/4/9', () => {
    expect(kcalFrom(160, 250, 70)).toBe(2270);
    expect(dayTargets(plan(), true)).toEqual({ kcal: 2270, protein: 160, carbs: 250, fat: 70, fiber: 30 });
    expect(dayTargets(plan(), false).kcal).toBe(1990);
  });

  it('food amounts per 100 g or per serving', () => {
    expect(itemMacros(rice)).toEqual({ kcal: 260, protein: 5.4, carbs: 56.4, fat: 0.6, fiber: 0.8 });
    expect(itemMacros(chicken)).toEqual({ kcal: 248, protein: 46.5, carbs: 0, fat: 5.4, fiber: 0 });
    expect(itemMacros({ ...bar, amount: 2 }).kcal).toBe(400);
    // first option of each meal: rice + chicken + bar
    expect(planDayMacros(plan())).toEqual({ kcal: 708, protein: 71.9, carbs: 78.4, fat: 12, fiber: 3.8 });
  });

  it('flags days outside 1200–6000 kcal', () => {
    expect(planErrors(plan())).toEqual([]);
    expect(planErrors(plan({ carbs_rest_g: 20, fat_rest_g: 20 }))).toEqual(['kcal_rest']); // 640 + 80 + 180 = 900
  });

  it('applies the plan but keeps the safety floor and the under-18 / screening rules', () => {
    const t = applyCoachPlan(app, plan(), true, { noDeficit: false, noWeightGoals: false });
    expect([t.kcal, t.protein, t.carbs, t.fat, t.coach]).toEqual([2270, 160, 250, 70, true]);
    // rest day 1990 is above the 1800 floor
    expect(applyCoachPlan(app, plan(), false, { noDeficit: false, noWeightGoals: false }).kcal).toBe(1990);
    // floor 2100: carbs raised by (2100-1990)/4 = 27.5 → 208 g → 2102 kcal (rounding up to whole grams)
    const floored = applyCoachPlan({ ...app, floorKcal: 2100 }, plan(), false, { noDeficit: false, noWeightGoals: false });
    expect(floored.carbs).toBe(208);
    expect(floored.kcal).toBe(2102);
    // under 18: not below the app's own value (2400)
    expect(applyCoachPlan(app, plan(), true, { noDeficit: true, noWeightGoals: false }).kcal).toBeGreaterThanOrEqual(2400);
    expect(applyCoachPlan(app, null, true, { noDeficit: false, noWeightGoals: false }).coach).toBe(false);
  });

  it('weekly shopping list from the first options', () => {
    expect(shoppingList(plan())).toEqual([
      { name: 'Chicken breast, cooked', amount: 1050, unit: 'g' },
      { name: 'Protein bar', amount: 7, unit: 'serving' },
      { name: 'Rice, white, cooked', amount: 1400, unit: 'g' },
    ]);
  });
});
