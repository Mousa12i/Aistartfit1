// Nutrient model shared by the food library, the diary, reports and the coach.
// Core nutrients are columns on meal_logs; everything else lives in the
// `nutrients` jsonb column. A missing value means "not reported by the food
// source", which is different from zero.

export type MicroKey =
  | 'mufa_g'
  | 'pufa_g'
  | 'trans_fat_g'
  | 'epa_dha_g'
  | 'ala_g'
  | 'cholesterol_mg'
  | 'added_sugar_g'
  | 'potassium_mg'
  | 'calcium_mg'
  | 'iron_mg'
  | 'magnesium_mg'
  | 'zinc_mg'
  | 'phosphorus_mg'
  | 'selenium_ug'
  | 'copper_mg'
  | 'manganese_mg'
  | 'vit_a_ug'
  | 'vit_c_mg'
  | 'vit_d_ug'
  | 'vit_e_mg'
  | 'vit_k_ug'
  | 'thiamin_mg'
  | 'riboflavin_mg'
  | 'niacin_mg'
  | 'vit_b6_mg'
  | 'folate_ug'
  | 'vit_b12_ug'
  | 'choline_mg'
  | 'caffeine_mg'
  | 'alcohol_g';

export const MICRO_KEYS: MicroKey[] = [
  'mufa_g', 'pufa_g', 'trans_fat_g', 'epa_dha_g', 'ala_g', 'cholesterol_mg', 'added_sugar_g',
  'potassium_mg', 'calcium_mg', 'iron_mg', 'magnesium_mg', 'zinc_mg', 'phosphorus_mg', 'selenium_ug',
  'copper_mg', 'manganese_mg', 'vit_a_ug', 'vit_c_mg', 'vit_d_ug', 'vit_e_mg', 'vit_k_ug', 'thiamin_mg',
  'riboflavin_mg', 'niacin_mg', 'vit_b6_mg', 'folate_ug', 'vit_b12_ug', 'choline_mg', 'caffeine_mg', 'alcohol_g',
];

export type CoreKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'sugar' | 'fiber' | 'satFat' | 'sodiumMg';
export type NutrientKey = CoreKey | MicroKey;

export interface NutrientProfile {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number | null;
  fiber: number | null;
  satFat: number | null;
  sodiumMg: number | null;
  micros: Partial<Record<MicroKey, number>>;
}

export type NutrientGroup = 'energy' | 'macros' | 'fats' | 'minerals' | 'vitamins' | 'other';

export interface NutrientMeta {
  key: NutrientKey;
  label: string;
  unit: 'kcal' | 'g' | 'mg' | 'µg';
  group: NutrientGroup;
  /** FDA Daily Value for adults (2016 label rule). */
  dv?: number;
  /** True for nutrients where the reference is an upper amount to stay below. */
  limit?: boolean;
  decimals: number;
}

export const NUTRIENT_META: NutrientMeta[] = [
  { key: 'kcal', label: 'Energy', unit: 'kcal', group: 'energy', decimals: 0 },
  { key: 'protein', label: 'Protein', unit: 'g', group: 'macros', dv: 50, decimals: 1 },
  { key: 'carbs', label: 'Carbohydrate', unit: 'g', group: 'macros', dv: 275, decimals: 1 },
  { key: 'sugar', label: 'Sugars (total)', unit: 'g', group: 'macros', decimals: 1 },
  { key: 'added_sugar_g', label: 'Added sugars', unit: 'g', group: 'macros', dv: 50, limit: true, decimals: 1 },
  { key: 'fiber', label: 'Fibre', unit: 'g', group: 'macros', dv: 28, decimals: 1 },
  { key: 'fat', label: 'Fat', unit: 'g', group: 'fats', dv: 78, decimals: 1 },
  { key: 'satFat', label: 'Saturated fat', unit: 'g', group: 'fats', dv: 20, limit: true, decimals: 1 },
  { key: 'mufa_g', label: 'Monounsaturated fat', unit: 'g', group: 'fats', decimals: 1 },
  { key: 'pufa_g', label: 'Polyunsaturated fat', unit: 'g', group: 'fats', decimals: 1 },
  { key: 'trans_fat_g', label: 'Trans fat', unit: 'g', group: 'fats', limit: true, decimals: 2 },
  { key: 'epa_dha_g', label: 'Omega-3 (EPA + DHA)', unit: 'g', group: 'fats', decimals: 2 },
  { key: 'ala_g', label: 'Omega-3 (ALA)', unit: 'g', group: 'fats', decimals: 2 },
  { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg', group: 'fats', dv: 300, limit: true, decimals: 0 },
  { key: 'sodiumMg', label: 'Sodium', unit: 'mg', group: 'minerals', dv: 2300, limit: true, decimals: 0 },
  { key: 'potassium_mg', label: 'Potassium', unit: 'mg', group: 'minerals', dv: 4700, decimals: 0 },
  { key: 'calcium_mg', label: 'Calcium', unit: 'mg', group: 'minerals', dv: 1300, decimals: 0 },
  { key: 'iron_mg', label: 'Iron', unit: 'mg', group: 'minerals', dv: 18, decimals: 1 },
  { key: 'magnesium_mg', label: 'Magnesium', unit: 'mg', group: 'minerals', dv: 420, decimals: 0 },
  { key: 'zinc_mg', label: 'Zinc', unit: 'mg', group: 'minerals', dv: 11, decimals: 1 },
  { key: 'phosphorus_mg', label: 'Phosphorus', unit: 'mg', group: 'minerals', dv: 1250, decimals: 0 },
  { key: 'selenium_ug', label: 'Selenium', unit: 'µg', group: 'minerals', dv: 55, decimals: 0 },
  { key: 'copper_mg', label: 'Copper', unit: 'mg', group: 'minerals', dv: 0.9, decimals: 2 },
  { key: 'manganese_mg', label: 'Manganese', unit: 'mg', group: 'minerals', dv: 2.3, decimals: 2 },
  { key: 'vit_a_ug', label: 'Vitamin A (RAE)', unit: 'µg', group: 'vitamins', dv: 900, decimals: 0 },
  { key: 'vit_c_mg', label: 'Vitamin C', unit: 'mg', group: 'vitamins', dv: 90, decimals: 1 },
  { key: 'vit_d_ug', label: 'Vitamin D', unit: 'µg', group: 'vitamins', dv: 20, decimals: 1 },
  { key: 'vit_e_mg', label: 'Vitamin E', unit: 'mg', group: 'vitamins', dv: 15, decimals: 1 },
  { key: 'vit_k_ug', label: 'Vitamin K', unit: 'µg', group: 'vitamins', dv: 120, decimals: 0 },
  { key: 'thiamin_mg', label: 'Thiamin (B1)', unit: 'mg', group: 'vitamins', dv: 1.2, decimals: 2 },
  { key: 'riboflavin_mg', label: 'Riboflavin (B2)', unit: 'mg', group: 'vitamins', dv: 1.3, decimals: 2 },
  { key: 'niacin_mg', label: 'Niacin (B3)', unit: 'mg', group: 'vitamins', dv: 16, decimals: 1 },
  { key: 'vit_b6_mg', label: 'Vitamin B6', unit: 'mg', group: 'vitamins', dv: 1.7, decimals: 2 },
  { key: 'folate_ug', label: 'Folate (DFE)', unit: 'µg', group: 'vitamins', dv: 400, decimals: 0 },
  { key: 'vit_b12_ug', label: 'Vitamin B12', unit: 'µg', group: 'vitamins', dv: 2.4, decimals: 2 },
  { key: 'choline_mg', label: 'Choline', unit: 'mg', group: 'vitamins', dv: 550, decimals: 0 },
  { key: 'caffeine_mg', label: 'Caffeine', unit: 'mg', group: 'other', decimals: 0 },
  { key: 'alcohol_g', label: 'Alcohol', unit: 'g', group: 'other', decimals: 1 },
];

export const GROUP_LABELS: Record<NutrientGroup, string> = {
  energy: 'Energy',
  macros: 'Carbohydrates & protein',
  fats: 'Fats',
  minerals: 'Minerals',
  vitamins: 'Vitamins',
  other: 'Other',
};

export function metaFor(key: NutrientKey): NutrientMeta | undefined {
  return NUTRIENT_META.find((m) => m.key === key);
}

export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function emptyProfile(): NutrientProfile {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: null, fiber: null, satFat: null, sodiumMg: null, micros: {} };
}

const scaleNullable = (v: number | null | undefined, factor: number, decimals: number) =>
  v == null || !Number.isFinite(v) ? null : round(v * factor, decimals);

/** Multiply every nutrient by `factor` (e.g. grams / 100). */
export function scaleProfile(p: NutrientProfile, factor: number): NutrientProfile {
  const micros: Partial<Record<MicroKey, number>> = {};
  for (const key of MICRO_KEYS) {
    const v = p.micros[key];
    if (v != null && Number.isFinite(v)) micros[key] = round(v * factor, 3);
  }
  return {
    kcal: Math.round(p.kcal * factor),
    protein: round(p.protein * factor, 1),
    carbs: round(p.carbs * factor, 1),
    fat: round(p.fat * factor, 1),
    sugar: scaleNullable(p.sugar, factor, 1),
    fiber: scaleNullable(p.fiber, factor, 1),
    satFat: scaleNullable(p.satFat, factor, 1),
    sodiumMg: scaleNullable(p.sodiumMg, factor, 0),
    micros,
  };
}

export function getAmount(p: NutrientProfile, key: NutrientKey): number | null {
  switch (key) {
    case 'kcal': return p.kcal;
    case 'protein': return p.protein;
    case 'carbs': return p.carbs;
    case 'fat': return p.fat;
    case 'sugar': return p.sugar;
    case 'fiber': return p.fiber;
    case 'satFat': return p.satFat;
    case 'sodiumMg': return p.sodiumMg;
    default: {
      const v = p.micros[key];
      return v == null ? null : v;
    }
  }
}

export interface SummedNutrients {
  total: NutrientProfile;
  /** For each nutrient, the share (0-1) of logged energy whose food data reported it. */
  coverage: Partial<Record<NutrientKey, number>>;
  count: number;
}

/** Sum portions. Unknown values are skipped and reported through `coverage`. */
export function sumProfiles(list: NutrientProfile[]): SummedNutrients {
  const total = emptyProfile();
  const known: Partial<Record<NutrientKey, number>> = {};
  let weightSum = 0;
  const optional: CoreKey[] = ['sugar', 'fiber', 'satFat', 'sodiumMg'];

  for (const p of list) {
    const weight = Math.max(p.kcal, 1);
    weightSum += weight;
    total.kcal += p.kcal;
    total.protein += p.protein;
    total.carbs += p.carbs;
    total.fat += p.fat;
    for (const key of optional) {
      const v = getAmount(p, key);
      if (v == null) continue;
      known[key] = (known[key] ?? 0) + weight;
      if (key === 'sugar') total.sugar = (total.sugar ?? 0) + v;
      if (key === 'fiber') total.fiber = (total.fiber ?? 0) + v;
      if (key === 'satFat') total.satFat = (total.satFat ?? 0) + v;
      if (key === 'sodiumMg') total.sodiumMg = (total.sodiumMg ?? 0) + v;
    }
    for (const key of MICRO_KEYS) {
      const v = p.micros[key];
      if (v == null) continue;
      known[key] = (known[key] ?? 0) + weight;
      total.micros[key] = (total.micros[key] ?? 0) + v;
    }
  }

  const coverage: Partial<Record<NutrientKey, number>> = { kcal: list.length ? 1 : 0, protein: list.length ? 1 : 0, carbs: list.length ? 1 : 0, fat: list.length ? 1 : 0 };
  for (const [key, w] of Object.entries(known) as [NutrientKey, number][]) {
    coverage[key] = weightSum > 0 ? Math.min(1, w / weightSum) : 0;
  }

  total.protein = round(total.protein, 1);
  total.carbs = round(total.carbs, 1);
  total.fat = round(total.fat, 1);
  if (total.sugar != null) total.sugar = round(total.sugar, 1);
  if (total.fiber != null) total.fiber = round(total.fiber, 1);
  if (total.satFat != null) total.satFat = round(total.satFat, 1);
  if (total.sodiumMg != null) total.sodiumMg = Math.round(total.sodiumMg);
  for (const key of MICRO_KEYS) {
    const v = total.micros[key];
    if (v != null) total.micros[key] = round(v, 3);
  }
  return { total, coverage, count: list.length };
}

/** Energy from macros (Atwater 4/4/9). Used to sanity-check label data. */
export function atwaterKcal(protein: number, carbs: number, fat: number, alcohol = 0): number {
  return protein * 4 + carbs * 4 + fat * 9 + alcohol * 7;
}

export function formatAmount(value: number | null | undefined, decimals = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-GB', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

/** Clean an untrusted micros object (from jsonb or an API) into known keys with finite numbers. */
export function sanitizeMicros(input: unknown): Partial<Record<MicroKey, number>> {
  const out: Partial<Record<MicroKey, number>> = {};
  if (!input || typeof input !== 'object') return out;
  const record = input as Record<string, unknown>;
  for (const key of MICRO_KEYS) {
    const v = record[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = v;
  }
  return out;
}
