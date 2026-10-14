import { describe, expect, it } from 'vitest';
import { buildContext, buildSystemPrompt, deriveFlags, summarizeMeals, type MealRow } from './context';

const meals: MealRow[] = [
  { logged_date: '2026-10-13', meal_slot: 'breakfast', name: 'Oats', kcal: 228, protein: '7.9', carbs_g: 40.6, fat_g: 3.9, grams: 60, fiber_g: 6.1, sugar_g: null, sodium_mg: null },
  { logged_date: '2026-10-13', meal_slot: 'lunch', name: 'Chicken breast', kcal: 248, protein: 46.5, carbs_g: 0, fat_g: 5.4, grams: 150, sodium_mg: 111 },
  { logged_date: '2026-10-12', meal_slot: 'dinner', name: 'Wrap', kcal: 650, protein: 35, carbs_g: 60, fat_g: 25, servings: 1, serving_label: '1 portion' },
];

describe('deriveFlags', () => {
  it('reads balanced mode, screening and age', () => {
    const flags = deriveFlags({ age: 16 }, { no_numbers: true, screening: { positive: true, conditions: ['kidney'] } });
    expect(flags).toEqual({ noNumbers: true, screenPositive: true, under18: true, pregnant: false, conditions: ['kidney'] });
    expect(deriveFlags(null, null)).toEqual({ noNumbers: false, screenPositive: false, under18: false, pregnant: false, conditions: [] });
  });
});

describe('buildSystemPrompt', () => {
  it('adds safety rules for each flag and the evidence list', () => {
    const prompt = buildSystemPrompt({ noNumbers: true, screenPositive: true, under18: true, pregnant: true, conditions: ['kidney', 'diabetes_meds'] }, 'plan');
    expect(prompt).toContain('BALANCED MODE IS ON');
    expect(prompt).toContain('Do not set or support any weight-loss');
    expect(prompt).toContain('under 18');
    expect(prompt).toContain('pregnant');
    expect(prompt).toContain('kidney disease');
    expect(prompt).toContain('diabetes medication');
    expect(prompt).toContain('BUILD A MEAL PLAN');
    expect(prompt).toContain('[morton2018]');
    expect(prompt).toContain('0808 801 0677');
  });

  it('stays lean for normal chat', () => {
    const prompt = buildSystemPrompt({ noNumbers: false, screenPositive: false, under18: false, pregnant: false, conditions: [] }, 'chat');
    expect(prompt).not.toContain('BALANCED MODE');
    expect(prompt).not.toContain('BUILD A MEAL PLAN');
  });
});

describe('summarizeMeals / buildContext', () => {
  it('summarises days and today by meal', () => {
    const s = summarizeMeals(meals, '2026-10-13', false);
    expect(s.days[0]).toContain('2026-10-13: 476 kcal');
    expect(s.days[0]).toContain('fibre 6 g');
    expect(s.days[0]).toContain('sodium 111 mg');
    expect(s.today.join('\n')).toContain('Lunch: Chicken breast 150 g (248 kcal, 47 g protein)');
  });

  it('hides numbers in balanced mode', () => {
    const s = summarizeMeals(meals, '2026-10-13', true);
    expect(s.today.join(' ')).not.toMatch(/kcal/);
    const ctx = buildContext({
      today: '2026-10-13',
      profile: { age: 30, weight_kg: 80 },
      settings: { no_numbers: true, allergies: ['peanuts'] },
      targets: { kcal: 2500, protein: 160 },
      meals,
      waterByDate: { '2026-10-13': 750 },
      weights: [{ date: '2026-10-10', kg: 80 }],
      workouts: [],
      checkins: [],
      flags: deriveFlags({ age: 30 }, { no_numbers: true }),
    });
    expect(ctx).toContain('Allergies / avoid: peanuts');
    expect(ctx).toContain('3 glasses');
    expect(ctx).not.toContain('2,500');
    expect(ctx).not.toContain('80 kg');
  });

  it('includes targets, weight and training when numbers are on', () => {
    const ctx = buildContext({
      today: '2026-10-13',
      profile: { age: 30, weight_kg: 80 },
      settings: { goal_mode: 'cut', rate_pct: 0.7, diet_prefs: ['halal'] },
      targets: { kcal: 2140, protein: 176, carbs: 220, fat: 60, fiber: 30, waterMl: 2800, proteinPerMeal: 44, maintenance: 2760, trainingDay: true },
      meals,
      waterByDate: {},
      weights: [
        { date: '2026-10-01', kg: 81 },
        { date: '2026-10-05', kg: 80.6 },
        { date: '2026-10-09', kg: 80.2 },
        { date: '2026-10-13', kg: 79.9 },
      ],
      workouts: [{ date: '2026-10-12', name: 'Push', minutes: 55 }],
      checkins: [{ date: '2026-10-13', sleep_hours: 7, stress: 4, soreness_count: 2 }],
      flags: deriveFlags({ age: 30 }, {}),
    });
    expect(ctx).toContain('Calories 2,140 kcal (maintenance 2,760)');
    expect(ctx).toContain('Diet preferences: halal');
    expect(ctx).toContain('Training day today: yes');
    expect(ctx).toContain('2026-10-12: Push (55 min)');
    expect(ctx).toContain('sleep 7 h');
  });
});
