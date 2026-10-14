// Pure helpers that turn USDA FoodData Central and Open Food Facts responses
// into the app's FoodItem shape (nutrients per 100 g). No Deno APIs here so it
// can be unit-tested with Node.

export type MicroKey =
  | 'mufa_g' | 'pufa_g' | 'trans_fat_g' | 'epa_dha_g' | 'ala_g' | 'cholesterol_mg' | 'added_sugar_g'
  | 'potassium_mg' | 'calcium_mg' | 'iron_mg' | 'magnesium_mg' | 'zinc_mg' | 'phosphorus_mg' | 'selenium_ug'
  | 'copper_mg' | 'manganese_mg' | 'vit_a_ug' | 'vit_c_mg' | 'vit_d_ug' | 'vit_e_mg' | 'vit_k_ug' | 'thiamin_mg'
  | 'riboflavin_mg' | 'niacin_mg' | 'vit_b6_mg' | 'folate_ug' | 'vit_b12_ug' | 'choline_mg' | 'caffeine_mg' | 'alcohol_g';

type CoreKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'sugar' | 'fiber' | 'satFat' | 'sodiumMg';
type Unit = 'G' | 'MG' | 'UG' | 'KCAL';

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

export interface NormalizedFood {
  ref: string;
  source: 'usda' | 'off';
  name: string;
  brand: string | null;
  per100: NutrientProfile;
  servings: { label: string; grams: number }[];
  defaultGrams: number;
  sourceLabel: string;
  dataNote?: string;
  category?: string;
}

interface Target {
  key: CoreKey | MicroKey;
  unit: Unit;
  /** Lower number wins when several FDC nutrients map to the same key. */
  priority: number;
}

// FDC "nutrientNumber" (legacy SR numbers) — present in search results.
const BY_NUMBER: Record<string, Target> = {
  '208': { key: 'kcal', unit: 'KCAL', priority: 0 },
  '958': { key: 'kcal', unit: 'KCAL', priority: 1 }, // Atwater specific factors
  '957': { key: 'kcal', unit: 'KCAL', priority: 2 }, // Atwater general factors
  '203': { key: 'protein', unit: 'G', priority: 0 },
  '204': { key: 'fat', unit: 'G', priority: 0 },
  '205': { key: 'carbs', unit: 'G', priority: 0 },
  '205.2': { key: 'carbs', unit: 'G', priority: 1 }, // carbohydrate by summation
  '269': { key: 'sugar', unit: 'G', priority: 0 },
  '269.3': { key: 'sugar', unit: 'G', priority: 1 },
  '291': { key: 'fiber', unit: 'G', priority: 0 },
  '606': { key: 'satFat', unit: 'G', priority: 0 },
  '307': { key: 'sodiumMg', unit: 'MG', priority: 0 },
  '645': { key: 'mufa_g', unit: 'G', priority: 0 },
  '646': { key: 'pufa_g', unit: 'G', priority: 0 },
  '605': { key: 'trans_fat_g', unit: 'G', priority: 0 },
  '601': { key: 'cholesterol_mg', unit: 'MG', priority: 0 },
  '539': { key: 'added_sugar_g', unit: 'G', priority: 0 },
  '306': { key: 'potassium_mg', unit: 'MG', priority: 0 },
  '301': { key: 'calcium_mg', unit: 'MG', priority: 0 },
  '303': { key: 'iron_mg', unit: 'MG', priority: 0 },
  '304': { key: 'magnesium_mg', unit: 'MG', priority: 0 },
  '309': { key: 'zinc_mg', unit: 'MG', priority: 0 },
  '305': { key: 'phosphorus_mg', unit: 'MG', priority: 0 },
  '317': { key: 'selenium_ug', unit: 'UG', priority: 0 },
  '312': { key: 'copper_mg', unit: 'MG', priority: 0 },
  '315': { key: 'manganese_mg', unit: 'MG', priority: 0 },
  '320': { key: 'vit_a_ug', unit: 'UG', priority: 0 },
  '401': { key: 'vit_c_mg', unit: 'MG', priority: 0 },
  '328': { key: 'vit_d_ug', unit: 'UG', priority: 0 },
  '323': { key: 'vit_e_mg', unit: 'MG', priority: 0 },
  '430': { key: 'vit_k_ug', unit: 'UG', priority: 0 },
  '404': { key: 'thiamin_mg', unit: 'MG', priority: 0 },
  '405': { key: 'riboflavin_mg', unit: 'MG', priority: 0 },
  '406': { key: 'niacin_mg', unit: 'MG', priority: 0 },
  '415': { key: 'vit_b6_mg', unit: 'MG', priority: 0 },
  '435': { key: 'folate_ug', unit: 'UG', priority: 0 }, // folate, DFE
  '417': { key: 'folate_ug', unit: 'UG', priority: 1 }, // folate, total
  '418': { key: 'vit_b12_ug', unit: 'UG', priority: 0 },
  '421': { key: 'choline_mg', unit: 'MG', priority: 0 },
  '262': { key: 'caffeine_mg', unit: 'MG', priority: 0 },
  '221': { key: 'alcohol_g', unit: 'G', priority: 0 },
  '851': { key: 'ala_g', unit: 'G', priority: 0 },
  '619': { key: 'ala_g', unit: 'G', priority: 1 },
};

// FDC nutrient ids, used when a record has no nutrientNumber.
const BY_ID: Record<number, Target> = {
  1008: BY_NUMBER['208'],
  2048: BY_NUMBER['958'],
  2047: BY_NUMBER['957'],
  1003: BY_NUMBER['203'],
  1004: BY_NUMBER['204'],
  1005: BY_NUMBER['205'],
  1050: BY_NUMBER['205.2'],
  2000: BY_NUMBER['269'],
  1063: BY_NUMBER['269.3'],
  1079: BY_NUMBER['291'],
  1258: BY_NUMBER['606'],
  1093: BY_NUMBER['307'],
  1292: BY_NUMBER['645'],
  1293: BY_NUMBER['646'],
  1257: BY_NUMBER['605'],
  1253: BY_NUMBER['601'],
  1235: BY_NUMBER['539'],
  1092: BY_NUMBER['306'],
  1087: BY_NUMBER['301'],
  1089: BY_NUMBER['303'],
  1090: BY_NUMBER['304'],
  1095: BY_NUMBER['309'],
  1091: BY_NUMBER['305'],
  1103: BY_NUMBER['317'],
  1098: BY_NUMBER['312'],
  1101: BY_NUMBER['315'],
  1106: BY_NUMBER['320'],
  1162: BY_NUMBER['401'],
  1114: BY_NUMBER['328'],
  1109: BY_NUMBER['323'],
  1185: BY_NUMBER['430'],
  1165: BY_NUMBER['404'],
  1166: BY_NUMBER['405'],
  1167: BY_NUMBER['406'],
  1175: BY_NUMBER['415'],
  1190: BY_NUMBER['435'],
  1177: BY_NUMBER['417'],
  1178: BY_NUMBER['418'],
  1180: BY_NUMBER['421'],
  1057: BY_NUMBER['262'],
  1018: BY_NUMBER['221'],
  1404: BY_NUMBER['851'],
  1270: BY_NUMBER['619'],
};

// EPA (20:5 n-3) and DHA (22:6 n-3) are summed into one value.
const EPA_DHA_NUMBERS = new Set(['629', '621']);
const EPA_DHA_IDS = new Set([1278, 1272]);

const KJ_NUMBER = '268';
const KJ_ID = 1062;

function normUnit(raw: unknown): string {
  const u = String(raw ?? '').toUpperCase();
  if (u === 'µG' || u === 'MCG') return 'UG';
  return u;
}

function convert(value: number, from: string, to: Unit): number | null {
  if (from === to) return value;
  const grams: Record<string, number> = { G: 1, MG: 1e-3, UG: 1e-6 };
  if (to === 'KCAL') return from === 'KJ' ? value / 4.184 : null;
  if (!(from in grams) || !(to in grams)) return null;
  return (value * grams[from]) / grams[to];
}

const r = (v: number, d: number) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

export function titleCase(text: string): string {
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|[\s,(/-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

interface UsdaNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number;
  amount?: number;
  number?: string;
  name?: string;
  nutrient?: { id?: number; number?: string; name?: string; unitName?: string };
}

export interface UsdaSearchFood {
  fdcId?: number;
  description?: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  foodCategory?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
  foodMeasures?: { disseminationText?: string; gramWeight?: number; rank?: number }[];
}

const DATA_TYPE_LABEL: Record<string, string> = {
  Foundation: 'USDA Foundation',
  'SR Legacy': 'USDA SR Legacy',
  'Survey (FNDDS)': 'USDA Survey (FNDDS)',
  Branded: 'USDA Branded (label)',
};

export function normalizeUsdaFood(food: UsdaSearchFood): NormalizedFood | null {
  if (!food?.fdcId || !food.description) return null;
  const best: Partial<Record<CoreKey | MicroKey, { value: number; priority: number }>> = {};
  let epaDha = 0;
  let hasEpaDha = false;
  let kj: number | null = null;

  for (const raw of food.foodNutrients ?? []) {
    const number = String(raw.nutrientNumber ?? raw.number ?? raw.nutrient?.number ?? '');
    const id = Number(raw.nutrientId ?? raw.nutrient?.id ?? NaN);
    const unit = normUnit(raw.unitName ?? raw.nutrient?.unitName);
    const value = Number(raw.value ?? raw.amount);
    if (!Number.isFinite(value) || value < 0) continue;

    if (number === KJ_NUMBER || id === KJ_ID || (unit === 'KJ' && (number === '208' || id === 1008))) {
      kj = value;
      continue;
    }
    if (EPA_DHA_NUMBERS.has(number) || EPA_DHA_IDS.has(id)) {
      const g = convert(value, unit, 'G');
      if (g != null) {
        epaDha += g;
        hasEpaDha = true;
      }
      continue;
    }
    const target = BY_NUMBER[number] ?? (Number.isFinite(id) ? BY_ID[id] : undefined);
    if (!target) continue;
    const converted = convert(value, unit, target.unit);
    if (converted == null) continue;
    const current = best[target.key];
    if (!current || target.priority < current.priority) best[target.key] = { value: converted, priority: target.priority };
  }

  const protein = best.protein?.value ?? null;
  const carbs = best.carbs?.value ?? null;
  const fat = best.fat?.value ?? null;
  let kcal = best.kcal?.value ?? (kj != null ? kj / 4.184 : null);
  let dataNote: string | undefined;
  if (kcal == null) {
    if (protein == null && carbs == null && fat == null) return null;
    kcal = (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9;
    dataNote = 'Energy was calculated from protein, carbohydrate and fat (4/4/9 kcal per gram).';
  }

  const micros: Partial<Record<MicroKey, number>> = {};
  for (const [key, entry] of Object.entries(best) as [CoreKey | MicroKey, { value: number }][]) {
    if (['kcal', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'satFat', 'sodiumMg'].includes(key)) continue;
    micros[key as MicroKey] = r(entry.value, 3);
  }
  if (hasEpaDha) micros.epa_dha_g = r(epaDha, 3);

  const servings: { label: string; grams: number }[] = [{ label: '100 g', grams: 100 }];
  const unit = String(food.servingSizeUnit ?? '').toLowerCase();
  if (food.servingSize && food.servingSize > 0 && ['g', 'grm', 'ml', 'mlt'].includes(unit)) {
    const household = food.householdServingFullText?.trim();
    const isMl = unit === 'ml' || unit === 'mlt';
    servings.push({ label: household ? `${household}` : isMl ? '1 serving (ml)' : '1 serving', grams: r(food.servingSize, 1) });
  }
  for (const m of (food.foodMeasures ?? []).slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))) {
    if (servings.length >= 5) break;
    const text = m.disseminationText?.trim();
    if (!text || !m.gramWeight || m.gramWeight <= 0 || /quantity not specified/i.test(text)) continue;
    servings.push({ label: text, grams: r(m.gramWeight, 1) });
  }

  const dataType = food.dataType ?? '';
  const branded = dataType === 'Branded';
  const brand = branded ? (food.brandName || food.brandOwner || '').trim() || null : null;
  return {
    ref: `usda:${food.fdcId}`,
    source: 'usda',
    name: titleCase(food.description.trim()).slice(0, 200),
    brand: brand ? titleCase(brand) : null,
    per100: {
      kcal: r(kcal, 1),
      protein: r(protein ?? 0, 2),
      carbs: r(carbs ?? 0, 2),
      fat: r(fat ?? 0, 2),
      sugar: best.sugar ? r(best.sugar.value, 2) : null,
      fiber: best.fiber ? r(best.fiber.value, 2) : null,
      satFat: best.satFat ? r(best.satFat.value, 2) : null,
      sodiumMg: best.sodiumMg ? r(best.sodiumMg.value, 1) : null,
      micros,
    },
    servings,
    defaultGrams: servings[1]?.grams ?? 100,
    sourceLabel: DATA_TYPE_LABEL[dataType] ?? 'USDA FoodData Central',
    dataNote:
      dataNote ??
      (branded
        ? 'Values from the label the manufacturer submitted to USDA. Check your pack — recipes change.'
        : 'USDA reference values for this food. Choose raw or cooked to match how you weighed it.'),
    category: food.foodCategory ?? undefined,
  };
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function normalizeOffProduct(code: string, product: Record<string, unknown> | null | undefined): NormalizedFood | null {
  if (!product) return null;
  const n = (product.nutriments ?? {}) as Record<string, unknown>;
  let kcal = num(n['energy-kcal_100g']);
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
  if (kcal == null && kj != null) kcal = kj / 4.184;
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  if (kcal == null && protein == null && carbs == null && fat == null) return null;
  const sodiumG = num(n['sodium_100g']);
  const saltG = num(n['salt_100g']);
  const sodiumMg = sodiumG != null ? sodiumG * 1000 : saltG != null ? saltG * 400 : null;

  const name =
    [product.product_name, product.product_name_en, product.generic_name, product.product_name_ar]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find(Boolean) || `Product ${code}`;
  const brand = typeof product.brands === 'string' ? product.brands.split(',')[0]?.trim() || null : null;

  const servings: { label: string; grams: number }[] = [{ label: '100 g', grams: 100 }];
  const sq = num(product.serving_quantity);
  if (sq && sq > 0) {
    const label = typeof product.serving_size === 'string' && product.serving_size.trim() ? product.serving_size.trim() : '1 serving';
    servings.push({ label, grams: r(sq, 1) });
  }

  return {
    ref: `off:${code}`,
    source: 'off',
    name: name.slice(0, 200),
    brand,
    per100: {
      kcal: r(kcal ?? (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9, 1),
      protein: r(protein ?? 0, 2),
      carbs: r(carbs ?? 0, 2),
      fat: r(fat ?? 0, 2),
      sugar: num(n['sugars_100g']) == null ? null : r(num(n['sugars_100g']) as number, 2),
      fiber: num(n['fiber_100g']) == null ? null : r(num(n['fiber_100g']) as number, 2),
      satFat: num(n['saturated-fat_100g']) == null ? null : r(num(n['saturated-fat_100g']) as number, 2),
      sodiumMg: sodiumMg == null ? null : r(sodiumMg, 1),
      micros: {},
    },
    servings,
    defaultGrams: servings[1]?.grams ?? 100,
    sourceLabel: 'Open Food Facts (label data)',
    dataNote: 'Label data entered by Open Food Facts contributors. Check it against your pack.',
  };
}

/** Remove duplicate names (keeps the first, which comes from the most authoritative source). */
export function dedupeFoods(foods: NormalizedFood[]): NormalizedFood[] {
  const seen = new Set<string>();
  const out: NormalizedFood[] = [];
  for (const f of foods) {
    const key = `${f.name.toLowerCase()}|${(f.brand ?? '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
