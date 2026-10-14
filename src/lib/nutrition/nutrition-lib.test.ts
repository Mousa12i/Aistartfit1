import { describe, expect, it } from 'vitest';
import { scaleEntryValues, type FoodEntry } from './api';
import { addDays, daysBetween, formatDayLabel, isValidDateKey, toDateKey } from './dates';
import { foodFromEntry, LOCAL_FOODS, matchesQuery, searchLocalFoods } from './foods';
import { buildInsights, loggingStreak, summarizeDay } from './insights';
import { NUTRIENT_META, scaleProfile, sumProfiles, type NutrientProfile } from './nutrients';
import { buildPdf } from './pdf';
import { deriveSafety, scoreScoff } from './screening';
import { computeTargets } from './engine';

const profile = (p: Partial<NutrientProfile>): NutrientProfile => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: null, fiber: null, satFat: null, sodiumMg: null, micros: {}, ...p });

const entry = (e: Partial<FoodEntry>): FoodEntry => ({
  id: Math.random().toString(36).slice(2),
  name: 'Food',
  kcal: 0,
  protein: 0,
  carbs_g: 0,
  fat_g: 0,
  logged_date: '2026-10-13',
  created_at: '2026-10-13T08:00:00Z',
  meal_slot: 'breakfast',
  grams: null,
  servings: null,
  serving_label: null,
  food_ref: null,
  source: null,
  sugar_g: null,
  fiber_g: null,
  sat_fat_g: null,
  sodium_mg: null,
  nutrients: {},
  ...e,
});

describe('dates', () => {
  it('builds zero-padded local keys and does day maths', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28');
    expect(daysBetween('2026-03-25', '2026-04-01')).toBe(7); // across the UK clock change
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-10-13')).toBe(true);
    expect(formatDayLabel('2026-10-12', '2026-10-13')).toBe('Yesterday');
  });
});

describe('nutrients', () => {
  it('scales per-100 g values, keeping unknowns unknown', () => {
    const p = scaleProfile(profile({ kcal: 165, protein: 31, fat: 3.6, sodiumMg: 74, micros: { iron_mg: 1 } }), 1.5);
    expect(p.kcal).toBe(248);
    expect(p.protein).toBe(46.5);
    expect(p.fat).toBe(5.4);
    expect(p.sugar).toBeNull();
    expect(p.sodiumMg).toBe(111);
    expect(p.micros.iron_mg).toBe(1.5);
  });

  it('sums with coverage weighted by energy', () => {
    const { total, coverage } = sumProfiles([profile({ kcal: 300, fiber: 6 }), profile({ kcal: 100 })]);
    expect(total.kcal).toBe(400);
    expect(total.fiber).toBe(6);
    expect(coverage.fiber).toBeCloseTo(0.75, 5);
    expect(coverage.sodiumMg).toBeUndefined();
  });
});

describe('foods', () => {
  it('finds common foods, including regional ones', () => {
    expect(searchLocalFoods('hummus')[0]?.name).toBe('Hummus');
    expect(searchLocalFoods('dates').length).toBeGreaterThanOrEqual(2);
    expect(matchesQuery('Crème fraîche', 'creme')).toBe(true);
    expect(searchLocalFoods('')).toEqual([]);
  });

  it('built-in foods carry USDA SR Legacy values with full nutrient data', () => {
    const ids = LOCAL_FOODS.map((f) => f.ref);
    expect(new Set(ids).size).toBe(ids.length);
    const microKeys = new Set(NUTRIENT_META.map((m) => m.key as string));
    for (const f of LOCAL_FOODS) {
      expect(f.fdcId, f.name).toBeGreaterThan(100000);
      expect(f.sourceLabel).toContain(`FDC ${f.fdcId}`);
      expect(f.per100.kcal).toBeGreaterThanOrEqual(0);
      expect(Object.keys(f.per100.micros).length, f.name).toBeGreaterThanOrEqual(14);
      for (const [k, v] of Object.entries(f.per100.micros)) {
        expect(microKeys.has(k), `${f.name}: ${k}`).toBe(true);
        expect(v, `${f.name}: ${k}`).toBeGreaterThanOrEqual(0);
      }
      for (const s of f.servings) expect(s.grams).toBeGreaterThan(0);
      // Energy should agree with the macros (general Atwater factors) within 15% for foods with meaningful energy.
      if (f.per100.kcal > 50) {
        const atwater = f.per100.protein * 4 + f.per100.carbs * 4 + f.per100.fat * 9;
        expect(Math.abs(atwater - f.per100.kcal) / f.per100.kcal, f.name).toBeLessThan(0.15);
      }
    }
    // Same record as the USDA search result for FDC 171477 (see normalize.test.ts).
    const chicken = LOCAL_FOODS.find((f) => f.fdcId === 171477);
    expect(chicken?.per100.kcal).toBe(165);
    expect(chicken?.per100.protein).toBe(31.02);
    expect(chicken?.per100.sodiumMg).toBe(74);
    expect(chicken?.per100.micros.iron_mg).toBe(1.04);
    expect(chicken?.per100.micros.vit_d_ug).toBe(0.1);
    expect(chicken?.per100.micros.epa_dha_g).toBe(0.03);
  });

  it('turns a logged entry back into a per-100 g food', () => {
    const food = foodFromEntry({ name: 'Rice', grams: 200, profile: profile({ kcal: 260, carbs: 56, protein: 5.4 }) });
    expect(food?.per100.kcal).toBe(130);
    expect(food?.per100.carbs).toBe(28);
    expect(food?.defaultGrams).toBe(200);
    const portion = foodFromEntry({ name: 'Wrap', servings: 2, profile: profile({ kcal: 900 }) });
    expect(portion?.servingOnly).toBe(true);
    expect(portion?.per100.kcal).toBe(450);
  });
});

describe('diary maths', () => {
  it('scales an entry for a new portion', () => {
    const e = entry({ kcal: 248, protein: 46.5, carbs_g: 0, fat_g: 5.4, grams: 150, sodium_mg: 111, nutrients: { iron_mg: 1.5 } });
    const s = scaleEntryValues(e, 2 / 3);
    expect(s.grams).toBe(100);
    expect(s.kcal).toBe(165);
    expect(s.protein).toBe(31);
    expect(s.sodium_mg).toBe(74);
    expect(s.nutrients.iron_mg).toBe(1);
  });

  it('summarises a day by meal', () => {
    const day = summarizeDay(
      '2026-10-13',
      [entry({ kcal: 400, protein: 35, meal_slot: 'breakfast' }), entry({ kcal: 600, protein: 40, meal_slot: 'lunch' }), entry({ kcal: 100, protein: 2, logged_date: '2026-10-12' })],
      [{ id: 'w', ml: 500, logged_date: '2026-10-13', created_at: '' }],
    );
    expect(day.total.kcal).toBe(1000);
    expect(day.entryCount).toBe(2);
    expect(day.slotProtein.lunch).toBe(40);
    expect(day.waterMl).toBe(500);
  });

  it('counts a logging streak', () => {
    expect(loggingStreak(new Set(['2026-10-13', '2026-10-12', '2026-10-10']), '2026-10-13')).toBe(2);
    expect(loggingStreak(new Set(['2026-10-12', '2026-10-11']), '2026-10-13')).toBe(2);
  });

  it('flags repeated very low intake without numbers in balanced mode', () => {
    const targets = computeTargets(
      { weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'moderate', experience: null, bodyFatPct: null },
      { mode: 'maintain', ratePct: 0, proteinPerKg: null, fatPct: null, mealsPerDay: 4, carbShift: false, kcalOverride: null, adaptiveTdee: null, dietBreakUntil: null },
      { today: '2026-10-13', date: '2026-10-13', trainingDay: false, trainingDaysPerWeek: 3, noDeficit: false, noWeightGoals: false },
    );
    const low = ['2026-10-10', '2026-10-11', '2026-10-12'].map((d) =>
      summarizeDay(d, [entry({ logged_date: d, kcal: 500, protein: 20 }), entry({ logged_date: d, kcal: 300, protein: 10 })], []),
    );
    const today = summarizeDay('2026-10-13', [], []);
    const insights = buildInsights({ today, recent: low, targets, noNumbers: true, trainingDay: false, hour: 9, streak: 0 });
    const warn = insights.find((i) => i.id === 'low-intake');
    expect(warn?.tone).toBe('warn');
    expect(/\d/.test(warn?.body ?? '')).toBe(false);
  });
});

describe('screening', () => {
  it('scores SCOFF (2+ yes = positive)', () => {
    expect(scoreScoff({ sick: true, control: false, one_stone: false, fat: false, food: false })).toEqual({ score: 1, positive: false });
    expect(scoreScoff({ sick: true, control: true })).toEqual({ score: 2, positive: true });
  });

  it('derives safety restrictions', () => {
    expect(deriveSafety(null, 16).noDeficit).toBe(true);
    const positive = deriveSafety({ version: 'scoff-1999', answers: {}, score: 3, positive: true, under18: false, pregnant: false, conditions: [], completedAt: '' }, 30);
    expect(positive.noWeightGoals).toBe(true);
    expect(positive.showSupport).toBe(true);
    const kidney = deriveSafety({ version: 'scoff-1999', answers: {}, score: 0, positive: false, under18: false, pregnant: false, conditions: ['kidney'], completedAt: '' }, 40);
    expect(kidney.clinicianAdvised).toBe(true);
    expect(kidney.noDeficit).toBe(false);
  });
});

describe('pdf writer', () => {
  it('writes a valid PDF structure with correct xref offsets', () => {
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const bytes = buildPdf([
      { bytes: fakeJpeg, width: 10, height: 14 },
      { bytes: fakeJpeg, width: 10, height: 14 },
    ]);
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Count 2');
    const startxref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = text.slice(startxref).split('\n').slice(2, 10);
    entries.slice(1).forEach((line, i) => {
      const offset = Number(line.slice(0, 10));
      expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });
});

describe('day keys stay consistent', () => {
  it('addDays round-trips', () => {
    expect(addDays(addDays('2026-10-13', 30), -30)).toBe('2026-10-13');
  });
});
