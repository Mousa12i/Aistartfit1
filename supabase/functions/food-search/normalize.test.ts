import { describe, expect, it } from 'vitest';
import { dedupeFoods, energyLooksWrong, normalizeOffProduct, normalizeUsdaFood, titleCase } from './normalize';

describe('normalizeUsdaFood', () => {
  it('maps SR Legacy search results (nutrientNumber + nutrientId fields)', () => {
    const food = normalizeUsdaFood({
      fdcId: 171477,
      description: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
      dataType: 'SR Legacy',
      foodCategory: 'Poultry Products',
      foodNutrients: [
        { nutrientId: 1008, nutrientNumber: '208', nutrientName: 'Energy', unitName: 'KCAL', value: 165 },
        { nutrientId: 1062, nutrientNumber: '268', nutrientName: 'Energy', unitName: 'kJ', value: 690 },
        { nutrientId: 1003, nutrientNumber: '203', nutrientName: 'Protein', unitName: 'G', value: 31.02 },
        { nutrientId: 1004, nutrientNumber: '204', nutrientName: 'Total lipid (fat)', unitName: 'G', value: 3.57 },
        { nutrientId: 1005, nutrientNumber: '205', nutrientName: 'Carbohydrate, by difference', unitName: 'G', value: 0 },
        { nutrientId: 1093, nutrientNumber: '307', nutrientName: 'Sodium, Na', unitName: 'MG', value: 74 },
        { nutrientId: 1258, nutrientNumber: '606', nutrientName: 'Fatty acids, total saturated', unitName: 'G', value: 1.01 },
        { nutrientId: 1089, nutrientNumber: '303', nutrientName: 'Iron, Fe', unitName: 'MG', value: 1.04 },
        { nutrientId: 1114, nutrientNumber: '328', nutrientName: 'Vitamin D (D2 + D3)', unitName: 'UG', value: 0.1 },
        { nutrientId: 1110, nutrientNumber: '324', nutrientName: 'Vitamin D (D2 + D3), International Units', unitName: 'IU', value: 4 },
        { nutrientId: 1278, nutrientNumber: '629', nutrientName: 'PUFA 20:5 n-3 (EPA)', unitName: 'G', value: 0.01 },
        { nutrientId: 1272, nutrientNumber: '621', nutrientName: 'PUFA 22:6 n-3 (DHA)', unitName: 'G', value: 0.02 },
      ],
    });
    expect(food).not.toBeNull();
    expect(food?.ref).toBe('usda:171477');
    expect(food?.per100.kcal).toBe(165);
    expect(food?.per100.protein).toBe(31.02);
    expect(food?.per100.sodiumMg).toBe(74);
    expect(food?.per100.satFat).toBe(1.01);
    expect(food?.per100.sugar).toBeNull();
    expect(food?.per100.micros.iron_mg).toBe(1.04);
    expect(food?.per100.micros.vit_d_ug).toBe(0.1);
    expect(food?.per100.micros.epa_dha_g).toBe(0.03);
    expect(food?.sourceLabel).toBe('USDA SR Legacy');
    expect(food?.brand).toBeNull();
  });

  it('uses Atwater energy for Foundation foods without nutrient 208', () => {
    const food = normalizeUsdaFood({
      fdcId: 1,
      description: 'Hummus, commercial',
      dataType: 'Foundation',
      foodNutrients: [
        { nutrientId: 2047, nutrientNumber: '957', unitName: 'KCAL', value: 240 },
        { nutrientId: 2048, nutrientNumber: '958', unitName: 'KCAL', value: 229 },
        { nutrientId: 1003, nutrientNumber: '203', unitName: 'G', value: 7.35 },
        { nutrientId: 1063, nutrientNumber: '269.3', unitName: 'G', value: 0.34 },
        { nutrientId: 1050, nutrientNumber: '205.2', unitName: 'G', value: 13.2 },
      ],
    });
    expect(food?.per100.kcal).toBe(229);
    expect(food?.per100.sugar).toBe(0.34);
    expect(food?.per100.carbs).toBe(13.2);
  });

  it('handles branded serving sizes and title-cases names', () => {
    const food = normalizeUsdaFood({
      fdcId: 2,
      description: 'PROTEIN BAR, CHOCOLATE',
      dataType: 'Branded',
      brandOwner: 'ACME FOODS INC.',
      servingSize: 60,
      servingSizeUnit: 'g',
      householdServingFullText: '1 bar',
      foodNutrients: [
        { nutrientId: 1008, nutrientNumber: '208', unitName: 'KCAL', value: 367 },
        { nutrientId: 1003, nutrientNumber: '203', unitName: 'G', value: 33.3 },
        { nutrientId: 1093, nutrientNumber: '307', unitName: 'MG', value: 250 },
      ],
    });
    expect(food?.name).toBe('Protein Bar, Chocolate');
    expect(food?.brand).toBe('Acme Foods Inc.');
    expect(food?.servings).toContainEqual({ label: '1 bar', grams: 60 });
    expect(food?.defaultGrams).toBe(60);
  });

  it('falls back to kJ, then to macros, and rejects empty records', () => {
    expect(normalizeUsdaFood({ fdcId: 3, description: 'x', foodNutrients: [{ nutrientNumber: '268', unitName: 'kJ', value: 418.4 }] })?.per100.kcal).toBe(100);
    const fromMacros = normalizeUsdaFood({ fdcId: 4, description: 'y', foodNutrients: [{ nutrientNumber: '203', unitName: 'G', value: 10 }, { nutrientNumber: '204', unitName: 'G', value: 10 }] });
    expect(fromMacros?.per100.kcal).toBe(130);
    expect(fromMacros?.dataNote).toMatch(/calculated/);
    expect(normalizeUsdaFood({ fdcId: 5, description: 'z', foodNutrients: [] })).toBeNull();
  });

  it('accepts the alternative nutrient shape (nested nutrient + amount)', () => {
    const food = normalizeUsdaFood({
      fdcId: 6,
      description: 'Oats',
      dataType: 'SR Legacy',
      foodNutrients: [
        { nutrient: { id: 1008, number: '208', unitName: 'kcal' }, amount: 389 },
        { nutrient: { id: 1003, number: '203', unitName: 'g' }, amount: 16.9 },
        { nutrient: { id: 1079, number: '291', unitName: 'g' }, amount: 10.6 },
      ],
    });
    expect(food?.per100.kcal).toBe(389);
    expect(food?.per100.fiber).toBe(10.6);
  });
});

describe('normalizeOffProduct', () => {
  it('maps Open Food Facts nutriments and salt to sodium', () => {
    const food = normalizeOffProduct('5000159407236', {
      product_name: 'Example oat drink',
      brands: 'Brand A, Brand B',
      serving_quantity: '250',
      serving_size: '250 ml',
      nutriments: {
        'energy-kcal_100g': 46,
        proteins_100g: 1,
        carbohydrates_100g: 6.6,
        sugars_100g: 4,
        fat_100g: 1.5,
        'saturated-fat_100g': 0.2,
        fiber_100g: 0.8,
        salt_100g: 0.1,
      },
    });
    expect(food?.ref).toBe('off:5000159407236');
    expect(food?.brand).toBe('Brand A');
    expect(food?.per100.sodiumMg).toBe(40);
    expect(food?.servings).toContainEqual({ label: '250 ml', grams: 250 });
  });

  it('uses kJ when kcal is missing and returns null without nutrition', () => {
    expect(normalizeOffProduct('123456', { product_name: 'A', nutriments: { energy_100g: 418.4, proteins_100g: 1 } })?.per100.kcal).toBe(100);
    expect(normalizeOffProduct('123456', { product_name: 'B', nutriments: {} })).toBeNull();
  });
});

describe('helpers', () => {
  it('title-cases only all-caps text', () => {
    expect(titleCase('GREEK YOGURT, PLAIN')).toBe('Greek Yogurt, Plain');
    expect(titleCase('Greek yogurt')).toBe('Greek yogurt');
  });

  it('dedupes by name and brand', () => {
    const a = normalizeOffProduct('111111', { product_name: 'Same', nutriments: { 'energy-kcal_100g': 1 } });
    const b = normalizeOffProduct('222222', { product_name: 'Same', nutriments: { 'energy-kcal_100g': 2 } });
    expect(dedupeFoods([a!, b!])).toHaveLength(1);
  });
});

describe('energy consistency check', () => {
  it('accepts labels whose energy matches 4/4/9', () => {
    expect(energyLooksWrong({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 })).toBe(false); // chicken breast
    expect(energyLooksWrong({ kcal: 69, protein: 0, carbs: 0, fat: 0 }, 10)).toBe(false); // wine-like, alcohol 7 kcal/g
  });
  it('flags labels that cannot be right', () => {
    expect(energyLooksWrong({ kcal: 500, protein: 10, carbs: 10, fat: 1 })).toBe(true);
    expect(energyLooksWrong({ kcal: 20, protein: 20, carbs: 30, fat: 10 })).toBe(true);
  });
});
