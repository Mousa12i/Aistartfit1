// The coach's nutrition plan for one athlete: day targets, meals built from real foods, guidance.
// All numbers are computed here from the food database values (per 100 g, or per serving for serving-only foods);
// calories come from macros with Atwater factors (4/4/9 kcal per g), so targets and meals always add up.
import { supabase } from '../supabase';
import type { Targets } from '../nutrition/engine';

export interface Per100 { kcal: number; protein: number; carbs: number; fat: number; fiber: number | null }
export interface PlanItem {
  name: string;
  ref: string | null;
  /** Grams, or number of servings when servingOnly. */
  amount: number;
  servingOnly?: boolean;
  servingLabel?: string | null;
  per100: Per100;
}
export interface MealOption { id: string; label: string; items: PlanItem[] }
export interface PlanMeal { id: string; name: string; time: string | null; options: MealOption[] }
export interface Guidance { eat?: string; limit?: string; notes?: string }

export interface NutritionPlan {
  id?: string;
  coach_id: string;
  athlete_id: string;
  protein_g: number;
  carbs_train_g: number;
  fat_train_g: number;
  carbs_rest_g: number;
  fat_rest_g: number;
  fiber_g: number | null;
  water_ml: number | null;
  meals: PlanMeal[];
  guidance: Guidance;
  updated_at?: string;
}

export interface Macros { kcal: number; protein: number; carbs: number; fat: number; fiber: number }

const r1 = (n: number) => Math.round(n * 10) / 10;

/** kcal from macros (Atwater general factors). */
export function kcalFrom(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

export function itemMacros(it: PlanItem): Macros {
  const f = it.servingOnly ? it.amount : it.amount / 100;
  return {
    kcal: Math.round(it.per100.kcal * f),
    protein: r1(it.per100.protein * f),
    carbs: r1(it.per100.carbs * f),
    fat: r1(it.per100.fat * f),
    fiber: r1((it.per100.fiber ?? 0) * f),
  };
}

export function sumMacros(list: Macros[]): Macros {
  const s = list.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat, fiber: a.fiber + m.fiber }), { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  return { kcal: Math.round(s.kcal), protein: r1(s.protein), carbs: r1(s.carbs), fat: r1(s.fat), fiber: r1(s.fiber) };
}

export const optionMacros = (o: MealOption) => sumMacros(o.items.map(itemMacros));

/** The day as planned with the first option of every meal. */
export function planDayMacros(plan: Pick<NutritionPlan, 'meals'>): Macros {
  return sumMacros(plan.meals.map((m) => (m.options[0] ? optionMacros(m.options[0]) : { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })));
}

export function dayTargets(plan: Pick<NutritionPlan, 'protein_g' | 'carbs_train_g' | 'fat_train_g' | 'carbs_rest_g' | 'fat_rest_g' | 'fiber_g'>, trainingDay: boolean): Macros {
  const carbs = trainingDay ? plan.carbs_train_g : plan.carbs_rest_g;
  const fat = trainingDay ? plan.fat_train_g : plan.fat_rest_g;
  return { kcal: kcalFrom(plan.protein_g, carbs, fat), protein: plan.protein_g, carbs, fat, fiber: plan.fiber_g ?? 0 };
}

/** Database limits (same as coach_set_targets). */
export const KCAL_MIN = 1200;
export const KCAL_MAX = 6000;

export function planErrors(plan: NutritionPlan): ('kcal_train' | 'kcal_rest')[] {
  const out: ('kcal_train' | 'kcal_rest')[] = [];
  const t = dayTargets(plan, true).kcal;
  const r = dayTargets(plan, false).kcal;
  if (t < KCAL_MIN || t > KCAL_MAX) out.push('kcal_train');
  if (r < KCAL_MIN || r > KCAL_MAX) out.push('kcal_rest');
  return out;
}

/**
 * The athlete's targets for a day with the coach's plan applied. The app's safety rules still win:
 * - never below the safety floor (BMR or 1200/1500 kcal), carbohydrate is added to reach it;
 * - no deficit for under-18s or in pregnancy, and no weight-change targets after a positive eating screen:
 *   then calories are not set below the app's own (maintenance) value.
 */
export function applyCoachPlan(app: Targets, plan: NutritionPlan | null, trainingDay: boolean, safety: { noDeficit: boolean; noWeightGoals: boolean }): Targets & { coach: boolean } {
  if (!plan) return { ...app, coach: false };
  const d = dayTargets(plan, trainingDay);
  let { protein, carbs, fat } = d;
  let kcal = d.kcal;
  const notes = [...app.notes.filter((n) => !n.text.startsWith('Using a fixed calorie target')), { kind: 'info' as const, text: 'Targets set by your coach.' }];
  const minKcal = safety.noDeficit || safety.noWeightGoals ? Math.max(app.floorKcal, app.kcal) : app.floorKcal;
  if (kcal < minKcal) {
    carbs = Math.round(carbs + (minKcal - kcal) / 4);
    kcal = kcalFrom(protein, carbs, fat);
    notes.push({ kind: 'warning', text: `Raised to ${kcal} kcal: the app's safety rules apply to coach plans too.` });
  }
  return {
    ...app,
    kcal,
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber: plan.fiber_g ?? app.fiber,
    waterMl: plan.water_ml ?? app.waterMl,
    fatPct: kcal > 0 ? Math.round(((fat * 9) / kcal) * 100) : app.fatPct,
    dailyDelta: Math.round(kcal - app.maintenance),
    notes,
    coach: true,
  };
}

/** Weekly shopping list from the first option of every meal (grams per food, rounded up to 10 g). */
export function shoppingList(plan: Pick<NutritionPlan, 'meals'>, days = 7): { name: string; amount: number; unit: 'g' | 'serving' }[] {
  const by = new Map<string, { name: string; amount: number; unit: 'g' | 'serving' }>();
  for (const m of plan.meals) {
    const o = m.options[0];
    if (!o) continue;
    for (const it of o.items) {
      const key = `${it.ref ?? it.name}|${it.servingOnly ? 's' : 'g'}`;
      const cur = by.get(key) ?? { name: it.name, amount: 0, unit: it.servingOnly ? 'serving' : 'g' };
      cur.amount += it.amount * days;
      by.set(key, cur);
    }
  }
  return [...by.values()]
    .map((x) => ({ ...x, amount: x.unit === 'g' ? Math.ceil(x.amount / 10) * 10 : Math.round(x.amount * 10) / 10 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const newId = () => Math.random().toString(36).slice(2, 10);

// ---------------- data ----------------

export async function loadNutritionPlan(athleteId: string): Promise<NutritionPlan | null> {
  const { data, error } = await supabase.from('coach_nutrition_plans').select('*').eq('athlete_id', athleteId).eq('active', true)
    .order('updated_at', { ascending: false }).limit(1);
  if (error) throw error;
  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) return null;
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    id: String(row.id), coach_id: String(row.coach_id), athlete_id: String(row.athlete_id),
    protein_g: Number(row.protein_g), carbs_train_g: Number(row.carbs_train_g), fat_train_g: Number(row.fat_train_g),
    carbs_rest_g: Number(row.carbs_rest_g), fat_rest_g: Number(row.fat_rest_g), fiber_g: num(row.fiber_g), water_ml: num(row.water_ml),
    meals: Array.isArray(row.meals) ? (row.meals as PlanMeal[]) : [],
    guidance: (row.guidance as Guidance) ?? {},
    updated_at: String(row.updated_at ?? ''),
  };
}

export async function saveNutritionPlan(plan: NutritionPlan): Promise<void> {
  const { id: _id, updated_at: _u, ...rest } = plan;
  void _id; void _u;
  const { error } = await supabase.from('coach_nutrition_plans').upsert({ ...rest, active: true, updated_at: new Date().toISOString() }, { onConflict: 'coach_id,athlete_id' });
  if (error) throw error;
}
