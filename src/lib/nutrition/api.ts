import { supabase } from '@/lib/supabase';
import { reportIfAiConsentMissing } from '../consent-events';
import { dateKeyFromISO, middayISO, todayKey } from './dates';
import type { GoalMode, Sex } from './engine';
import type { FoodItem, FoodSource, ServingOption } from './foods';
import { emptyProfile, round, sanitizeMicros, type MicroKey, type NutrientProfile } from './nutrients';
import type { ScreeningRecord } from './screening';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

interface PgError {
  code?: string;
  message?: string;
  details?: string;
}

/** True when the database has not been migrated yet (missing table or column). */
export function isSchemaError(error: unknown): boolean {
  const e = error as PgError | null;
  if (!e) return false;
  if (e.code && ['PGRST204', 'PGRST205', '42P01', '42703'].includes(e.code)) return true;
  return /does not exist|schema cache|could not find/i.test(`${e.message ?? ''} ${e.details ?? ''}`);
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  const e = error as PgError;
  return e.message || fallback;
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

// ---------------------------------------------------------------------------
// Diary entries (meal_logs)
// ---------------------------------------------------------------------------

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout';

export const MEAL_SLOTS: { id: MealSlot; label: string; workoutOnly?: boolean }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
  { id: 'pre_workout', label: 'Pre-workout', workoutOnly: true },
  { id: 'post_workout', label: 'Post-workout', workoutOnly: true },
];

export function isMealSlot(v: unknown): v is MealSlot {
  return typeof v === 'string' && MEAL_SLOTS.some((s) => s.id === v);
}

export function slotLabel(slot: MealSlot | null | undefined): string {
  return MEAL_SLOTS.find((s) => s.id === slot)?.label ?? 'Other';
}

/** Best guess of the meal being eaten right now. */
export function slotForTime(date: Date = new Date()): MealSlot {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 10.5) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 17.5) return 'snack';
  return 'dinner';
}

export interface FoodEntry {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs_g: number;
  fat_g: number;
  logged_date: string;
  created_at: string;
  meal_slot: MealSlot | null;
  grams: number | null;
  servings: number | null;
  serving_label: string | null;
  food_ref: string | null;
  source: string | null;
  sugar_g: number | null;
  fiber_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
  nutrients: Partial<Record<MicroKey, number>>;
}

export function normalizeEntry(raw: Record<string, unknown>): FoodEntry {
  const date = typeof raw.logged_date === 'string' ? raw.logged_date.slice(0, 10) : todayKey();
  return {
    id: String(raw.id),
    name: typeof raw.name === 'string' ? raw.name : 'Food',
    kcal: num(raw.kcal),
    protein: num(raw.protein),
    carbs_g: num(raw.carbs_g),
    fat_g: num(raw.fat_g),
    logged_date: date,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
    meal_slot: isMealSlot(raw.meal_slot) ? raw.meal_slot : null,
    grams: numOrNull(raw.grams),
    servings: numOrNull(raw.servings),
    serving_label: strOrNull(raw.serving_label),
    food_ref: strOrNull(raw.food_ref),
    source: strOrNull(raw.source),
    sugar_g: numOrNull(raw.sugar_g),
    fiber_g: numOrNull(raw.fiber_g),
    sat_fat_g: numOrNull(raw.sat_fat_g),
    sodium_mg: numOrNull(raw.sodium_mg),
    nutrients: sanitizeMicros(raw.nutrients),
  };
}

export function entryProfile(e: FoodEntry): NutrientProfile {
  return {
    kcal: e.kcal,
    protein: e.protein,
    carbs: e.carbs_g,
    fat: e.fat_g,
    sugar: e.sugar_g,
    fiber: e.fiber_g,
    satFat: e.sat_fat_g,
    sodiumMg: e.sodium_mg,
    micros: e.nutrients,
  };
}

export interface NewEntry {
  date: string;
  slot: MealSlot;
  name: string;
  amounts: NutrientProfile;
  grams?: number | null;
  servings?: number | null;
  servingLabel?: string | null;
  foodRef?: string | null;
  source?: FoodSource | null;
}

let legacyMealLogs = false;
/** True after a write had to fall back to the old meal_logs columns (database not migrated). */
export function usingLegacyMealLogs(): boolean {
  return legacyMealLogs;
}

function fullRow(e: NewEntry) {
  const a = e.amounts;
  const micros = sanitizeMicros(a.micros);
  return {
    name: e.name.slice(0, 200),
    kcal: Math.max(0, Math.round(a.kcal)),
    protein: Math.max(0, round(a.protein, 1)),
    carbs_g: Math.max(0, round(a.carbs, 1)),
    fat_g: Math.max(0, round(a.fat, 1)),
    logged_date: e.date,
    meal_slot: e.slot,
    grams: e.grams && e.grams > 0 ? round(e.grams, 1) : null,
    servings: e.servings && e.servings > 0 ? round(e.servings, 2) : null,
    serving_label: e.servingLabel ?? null,
    food_ref: e.foodRef ?? null,
    source: e.source ?? null,
    sugar_g: a.sugar == null ? null : round(a.sugar, 1),
    fiber_g: a.fiber == null ? null : round(a.fiber, 1),
    sat_fat_g: a.satFat == null ? null : round(a.satFat, 1),
    sodium_mg: a.sodiumMg == null ? null : Math.round(a.sodiumMg),
    nutrients: Object.keys(micros).length > 0 ? micros : null,
  };
}

function legacyRow(e: NewEntry) {
  const a = e.amounts;
  return {
    name: e.name.slice(0, 200),
    kcal: Math.max(0, Math.round(a.kcal)),
    protein: Math.max(0, Math.round(a.protein)),
    carbs_g: Math.max(0, Math.round(a.carbs)),
    fat_g: Math.max(0, Math.round(a.fat)),
    logged_date: e.date,
  };
}

export async function addEntries(list: NewEntry[]): Promise<FoodEntry[]> {
  if (list.length === 0) return [];
  if (!legacyMealLogs) {
    const { data, error } = await supabase.from('meal_logs').insert(list.map(fullRow)).select('*');
    if (!error) return ((data as Record<string, unknown>[]) ?? []).map(normalizeEntry);
    if (!isSchemaError(error)) throw error;
    legacyMealLogs = true;
  }
  const { data, error } = await supabase.from('meal_logs').insert(list.map(legacyRow)).select('*');
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? []).map((row, i) => ({
    ...normalizeEntry(row),
    // Keep the slot in memory so the diary still groups the entry until the page reloads.
    meal_slot: list[i]?.slot ?? null,
  }));
}

export async function addEntry(entry: NewEntry): Promise<FoodEntry> {
  const [created] = await addEntries([entry]);
  if (!created) throw new Error('The entry was not saved.');
  return created;
}

export async function fetchEntries(fromKey: string, toKey: string): Promise<FoodEntry[]> {
  const { data, error } = await supabase
    .from('meal_logs')
    .select('*')
    .gte('logged_date', fromKey)
    .lte('logged_date', toKey)
    .order('logged_date', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? []).map(normalizeEntry);
}

/** Scale an entry (new portion) and/or move it to another meal. */
export async function updateEntry(entry: FoodEntry, change: { factor?: number; slot?: MealSlot }): Promise<FoodEntry> {
  const factor = change.factor && change.factor > 0 ? change.factor : 1;
  const scaled = scaleEntryValues(entry, factor);
  const patch: Record<string, unknown> = legacyMealLogs
    ? { kcal: scaled.kcal, protein: Math.round(scaled.protein), carbs_g: Math.round(scaled.carbs_g), fat_g: Math.round(scaled.fat_g) }
    : {
        kcal: scaled.kcal,
        protein: scaled.protein,
        carbs_g: scaled.carbs_g,
        fat_g: scaled.fat_g,
        grams: scaled.grams,
        servings: scaled.servings,
        sugar_g: scaled.sugar_g,
        fiber_g: scaled.fiber_g,
        sat_fat_g: scaled.sat_fat_g,
        sodium_mg: scaled.sodium_mg,
        nutrients: Object.keys(scaled.nutrients).length ? scaled.nutrients : null,
        meal_slot: change.slot ?? entry.meal_slot,
      };
  const { data, error } = await supabase.from('meal_logs').update(patch).eq('id', entry.id).select('*').single();
  if (error) throw error;
  const updated = normalizeEntry(data as Record<string, unknown>);
  return legacyMealLogs ? { ...updated, meal_slot: change.slot ?? entry.meal_slot } : updated;
}

export function scaleEntryValues(entry: FoodEntry, factor: number): FoodEntry {
  const nutrients: Partial<Record<MicroKey, number>> = {};
  for (const [key, value] of Object.entries(entry.nutrients)) {
    if (typeof value === 'number') nutrients[key as MicroKey] = round(value * factor, 3);
  }
  const s = (v: number | null, d = 1) => (v == null ? null : round(v * factor, d));
  return {
    ...entry,
    kcal: Math.round(entry.kcal * factor),
    protein: round(entry.protein * factor, 1),
    carbs_g: round(entry.carbs_g * factor, 1),
    fat_g: round(entry.fat_g * factor, 1),
    grams: entry.grams == null ? null : round(entry.grams * factor, 1),
    servings: entry.servings == null ? (entry.grams == null && factor !== 1 ? round(factor, 2) : null) : round(entry.servings * factor, 2),
    sugar_g: s(entry.sugar_g),
    fiber_g: s(entry.fiber_g),
    sat_fat_g: s(entry.sat_fat_g),
    sodium_mg: s(entry.sodium_mg, 0),
    nutrients,
  };
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('meal_logs').delete().eq('id', id);
  if (error) throw error;
}

/** Copy every entry from one day to another (keeps meals and amounts). */
export async function copyDay(fromKey: string, toKey: string): Promise<FoodEntry[]> {
  const source = await fetchEntries(fromKey, fromKey);
  return addEntries(
    source.map((e) => ({
      date: toKey,
      slot: e.meal_slot ?? 'snack',
      name: e.name,
      amounts: entryProfile(e),
      grams: e.grams,
      servings: e.servings,
      servingLabel: e.serving_label,
      foodRef: e.food_ref,
      source: (e.source as FoodSource | null) ?? null,
    })),
  );
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

export interface WaterEntry {
  id: string;
  ml: number;
  logged_date: string;
  created_at: string;
}

const normalizeWater = (raw: Record<string, unknown>): WaterEntry => ({
  id: String(raw.id),
  ml: num(raw.ml),
  logged_date: typeof raw.logged_date === 'string' ? raw.logged_date.slice(0, 10) : todayKey(),
  created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
});

export async function fetchWater(fromKey: string, toKey: string): Promise<WaterEntry[]> {
  const { data, error } = await supabase
    .from('water_logs')
    .select('*')
    .gte('logged_date', fromKey)
    .lte('logged_date', toKey)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? []).map(normalizeWater);
}

export async function addWater(ml: number, dateKey: string): Promise<WaterEntry> {
  const { data, error } = await supabase.from('water_logs').insert({ ml: Math.round(ml), logged_date: dateKey }).select('*').single();
  if (error) throw error;
  return normalizeWater(data as Record<string, unknown>);
}

export async function deleteWater(id: string): Promise<void> {
  const { error } = await supabase.from('water_logs').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Weight (stored in body_measurements so Progress sees it too)
// ---------------------------------------------------------------------------

export interface WeightEntry {
  id: string;
  kg: number;
  date: string;
  recorded_at: string;
}

export async function fetchWeights(sinceKey: string): Promise<WeightEntry[]> {
  const since = new Date(`${sinceKey}T00:00:00`);
  const { data, error } = await supabase
    .from('body_measurements')
    .select('id, weight_kg, recorded_at')
    .not('weight_kg', 'is', null)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true });
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? [])
    .map((row) => ({
      id: String(row.id),
      kg: num(row.weight_kg),
      recorded_at: String(row.recorded_at),
      date: dateKeyFromISO(String(row.recorded_at)),
    }))
    .filter((w) => w.kg > 0);
}

export async function addWeight(kg: number, dateKey: string): Promise<WeightEntry> {
  const recordedAt = dateKey === todayKey() ? new Date().toISOString() : middayISO(dateKey);
  const { data, error } = await supabase
    .from('body_measurements')
    .insert({ weight_kg: round(kg, 2), recorded_at: recordedAt })
    .select('id, weight_kg, recorded_at')
    .single();
  if (error) throw error;
  const row = data as Record<string, unknown>;
  return { id: String(row.id), kg: num(row.weight_kg), recorded_at: String(row.recorded_at), date: dateKeyFromISO(String(row.recorded_at)) };
}

export async function deleteWeight(id: string): Promise<void> {
  const { error } = await supabase.from('body_measurements').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Training days (completed workouts)
// ---------------------------------------------------------------------------

export async function fetchCompletedWorkoutDates(sinceKey: string): Promise<string[]> {
  const since = new Date(`${sinceKey}T00:00:00`);
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('completed_at, status')
    .eq('status', 'completed')
    .gte('completed_at', since.toISOString());
  if (error) throw error;
  const dates = new Set<string>();
  for (const row of (data as Record<string, unknown>[]) ?? []) {
    if (typeof row.completed_at === 'string') dates.add(dateKeyFromISO(row.completed_at));
  }
  return [...dates].sort();
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface NutritionSettings {
  goal_mode: GoalMode;
  rate_pct: number;
  sex: Sex | null;
  protein_g_per_kg: number | null;
  fat_pct: number | null;
  meals_per_day: number;
  carb_shift: boolean;
  kcal_override: number | null;
  adaptive_tdee: number | null;
  adaptive_updated_at: string | null;
  mode_started_at: string | null;
  diet_break_until: string | null;
  no_numbers: boolean;
  screening: ScreeningRecord | null;
  diet_prefs: string[];
  allergies: string[];
  favorites: FoodItem[];
}

export const DEFAULT_SETTINGS: NutritionSettings = {
  goal_mode: 'maintain',
  rate_pct: 0,
  sex: null,
  protein_g_per_kg: null,
  fat_pct: null,
  meals_per_day: 4,
  carb_shift: false,
  kcal_override: null,
  adaptive_tdee: null,
  adaptive_updated_at: null,
  mode_started_at: null,
  diet_break_until: null,
  no_numbers: false,
  screening: null,
  diet_prefs: [],
  allergies: [],
  favorites: [],
};

const GOALS: GoalMode[] = ['cut', 'maintain', 'bulk', 'recomp'];
const SEXES: Sex[] = ['male', 'female', 'unspecified'];

export function normalizeSettings(raw: Record<string, unknown> | null): NutritionSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  const favorites = Array.isArray(raw.favorites) ? (raw.favorites as unknown[]).map(parseFoodItem).filter((f): f is FoodItem => f != null) : [];
  const screening = raw.screening && typeof raw.screening === 'object' ? (raw.screening as ScreeningRecord) : null;
  return {
    goal_mode: GOALS.includes(raw.goal_mode as GoalMode) ? (raw.goal_mode as GoalMode) : 'maintain',
    rate_pct: num(raw.rate_pct),
    sex: SEXES.includes(raw.sex as Sex) ? (raw.sex as Sex) : null,
    protein_g_per_kg: numOrNull(raw.protein_g_per_kg),
    fat_pct: numOrNull(raw.fat_pct),
    meals_per_day: Math.round(num(raw.meals_per_day, 4)) || 4,
    carb_shift: raw.carb_shift === true,
    kcal_override: numOrNull(raw.kcal_override),
    adaptive_tdee: numOrNull(raw.adaptive_tdee),
    adaptive_updated_at: strOrNull(raw.adaptive_updated_at),
    mode_started_at: strOrNull(raw.mode_started_at),
    diet_break_until: strOrNull(raw.diet_break_until),
    no_numbers: raw.no_numbers === true,
    screening,
    diet_prefs: Array.isArray(raw.diet_prefs) ? (raw.diet_prefs as unknown[]).filter((v): v is string => typeof v === 'string') : [],
    allergies: Array.isArray(raw.allergies) ? (raw.allergies as unknown[]).filter((v): v is string => typeof v === 'string') : [],
    favorites,
  };
}

export async function fetchSettings(): Promise<{ settings: NutritionSettings | null; available: boolean }> {
  const { data, error } = await supabase.from('nutrition_settings').select('*').maybeSingle();
  if (error) {
    if (isSchemaError(error)) return { settings: null, available: false };
    throw error;
  }
  return { settings: data ? normalizeSettings(data as Record<string, unknown>) : null, available: true };
}

export async function saveSettings(userId: string, next: NutritionSettings): Promise<NutritionSettings> {
  const row = {
    user_id: userId,
    ...next,
    favorites: next.favorites.slice(0, 40),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('nutrition_settings').upsert(row, { onConflict: 'user_id' }).select('*').single();
  if (error) throw error;
  return normalizeSettings(data as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Custom foods
// ---------------------------------------------------------------------------

export interface CustomFood {
  id: string;
  name: string;
  brand: string | null;
  serving_label: string | null;
  serving_grams: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number | null;
  fiber: number | null;
  sat_fat: number | null;
  sodium_mg: number | null;
  barcode: string | null;
}

const normalizeCustom = (raw: Record<string, unknown>): CustomFood => ({
  id: String(raw.id),
  name: typeof raw.name === 'string' ? raw.name : 'My food',
  brand: strOrNull(raw.brand),
  serving_label: strOrNull(raw.serving_label),
  serving_grams: numOrNull(raw.serving_grams),
  kcal: num(raw.kcal),
  protein: num(raw.protein),
  carbs: num(raw.carbs),
  fat: num(raw.fat),
  sugar: numOrNull(raw.sugar),
  fiber: numOrNull(raw.fiber),
  sat_fat: numOrNull(raw.sat_fat),
  sodium_mg: numOrNull(raw.sodium_mg),
  barcode: strOrNull(raw.barcode),
});

export function customToFood(c: CustomFood): FoodItem {
  const servings: ServingOption[] = [{ label: '100 g', grams: 100 }];
  if (c.serving_grams && c.serving_grams > 0) servings.push({ label: c.serving_label || `1 serving (${round(c.serving_grams, 1)} g)`, grams: c.serving_grams });
  return {
    ref: `custom:${c.id}`,
    source: 'custom',
    name: c.name,
    brand: c.brand,
    per100: {
      kcal: c.kcal,
      protein: c.protein,
      carbs: c.carbs,
      fat: c.fat,
      sugar: c.sugar,
      fiber: c.fiber,
      satFat: c.sat_fat,
      sodiumMg: c.sodium_mg,
      micros: {},
    },
    servings,
    defaultGrams: c.serving_grams && c.serving_grams > 0 ? c.serving_grams : 100,
    sourceLabel: 'Your food',
  };
}

export async function fetchCustomFoods(): Promise<{ foods: CustomFood[]; available: boolean }> {
  const { data, error } = await supabase.from('custom_foods').select('*').order('name', { ascending: true });
  if (error) {
    if (isSchemaError(error)) return { foods: [], available: false };
    throw error;
  }
  return { foods: ((data as Record<string, unknown>[]) ?? []).map(normalizeCustom), available: true };
}

export type CustomFoodInput = Omit<CustomFood, 'id'> & { id?: string };

export async function saveCustomFood(input: CustomFoodInput): Promise<CustomFood> {
  const row = {
    name: input.name.trim().slice(0, 120),
    brand: input.brand?.trim() || null,
    serving_label: input.serving_label?.trim() || null,
    serving_grams: input.serving_grams && input.serving_grams > 0 ? input.serving_grams : null,
    kcal: input.kcal,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    sugar: input.sugar,
    fiber: input.fiber,
    sat_fat: input.sat_fat,
    sodium_mg: input.sodium_mg,
    barcode: input.barcode?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  const query = input.id
    ? supabase.from('custom_foods').update(row).eq('id', input.id).select('*').single()
    : supabase.from('custom_foods').insert(row).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return normalizeCustom(data as Record<string, unknown>);
}

export async function deleteCustomFood(id: string): Promise<void> {
  const { error } = await supabase.from('custom_foods').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Edge functions
// ---------------------------------------------------------------------------

export class FunctionCallError extends Error {
  status: number;
  payload: Record<string, unknown>;
  constructor(message: string, status: number, payload: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!baseUrl) throw new FunctionCallError('The app is not connected to its backend.', 0, {});
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new FunctionCallError('No connection. Check your internet and try again.', 0, {});
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    reportIfAiConsentMissing(response.status, payload);
    // Our functions never answer 404 themselves: a 404 means the function has not been deployed.
    if (response.status === 404) {
      throw new FunctionCallError(`This feature is not switched on yet — the "${name}" server function has not been deployed.`, 404, payload);
    }
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : typeof payload.error === 'string'
          ? payload.error
          : `Request failed (${response.status}).`;
    throw new FunctionCallError(message, response.status, payload);
  }
  return payload as T;
}

/** Validate a food item coming from the server or from stored favourites. */
export function parseFoodItem(raw: unknown): FoodItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const p = (r.per100 ?? {}) as Record<string, unknown>;
  if (typeof r.name !== 'string' || typeof r.ref !== 'string') return null;
  const kcal = numOrNull(p.kcal);
  if (kcal == null) return null;
  const source = (['usda', 'off', 'custom', 'local', 'recipe', 'manual'] as FoodSource[]).includes(r.source as FoodSource)
    ? (r.source as FoodSource)
    : 'manual';
  const servings = Array.isArray(r.servings)
    ? (r.servings as unknown[])
        .map((s) => {
          const o = s as Record<string, unknown>;
          const grams = numOrNull(o?.grams);
          return typeof o?.label === 'string' && grams && grams > 0 ? { label: o.label, grams } : null;
        })
        .filter((s): s is ServingOption => s != null)
    : [];
  const profile: NutrientProfile = {
    ...emptyProfile(),
    kcal,
    protein: num(p.protein),
    carbs: num(p.carbs),
    fat: num(p.fat),
    sugar: numOrNull(p.sugar),
    fiber: numOrNull(p.fiber),
    satFat: numOrNull(p.satFat),
    sodiumMg: numOrNull(p.sodiumMg),
    micros: sanitizeMicros(p.micros),
  };
  const servingOnly = r.servingOnly === true;
  return {
    ref: r.ref,
    source,
    name: r.name.slice(0, 200),
    brand: strOrNull(r.brand),
    per100: profile,
    servings: servings.length ? servings : servingOnly ? [{ label: '1 serving', grams: 1 }] : [{ label: '100 g', grams: 100 }],
    defaultGrams: numOrNull(r.defaultGrams) ?? (servingOnly ? 1 : 100),
    servingOnly,
    sourceLabel: typeof r.sourceLabel === 'string' ? r.sourceLabel : 'Food',
    dataNote: typeof r.dataNote === 'string' ? r.dataNote : undefined,
    category: typeof r.category === 'string' ? r.category : undefined,
  };
}

export async function searchFoodDatabase(query: string): Promise<{ foods: FoodItem[]; notice: string | null }> {
  const result = await callFunction<{ foods?: unknown[]; notice?: string }>('food-search', { query });
  const foods = (result.foods ?? []).map(parseFoodItem).filter((f): f is FoodItem => f != null);
  return { foods, notice: typeof result.notice === 'string' ? result.notice : null };
}

export async function lookupBarcode(barcode: string): Promise<FoodItem | null> {
  const result = await callFunction<{ food?: unknown }>('food-search', { barcode });
  return parseFoodItem(result.food);
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export async function fetchCoachMessages(): Promise<{ messages: CoachMessage[]; available: boolean }> {
  const { data, error } = await supabase
    .from('nutrition_coach_messages')
    .select('id, role, content, created_at')
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    if (isSchemaError(error)) return { messages: [], available: false };
    throw error;
  }
  const messages = ((data as Record<string, unknown>[]) ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ id: String(m.id), role: m.role as 'user' | 'assistant', content: String(m.content ?? ''), created_at: String(m.created_at) }));
  return { messages, available: true };
}

export interface CoachTargetsSnapshot {
  date: string;
  mode: GoalMode;
  ratePct: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
  proteinPerMeal: number;
  maintenance: number;
  trainingDay: boolean;
}

export type CoachReply =
  | { ok: true; reply: string }
  | { ok: false; limitReached: true; message: string; upgradeText: string | null };

export async function sendCoachMessage(input: { message: string; mode: 'chat' | 'plan'; targets: CoachTargetsSnapshot | null; today: string }): Promise<CoachReply> {
  try {
    const result = await callFunction<{ reply?: string }>('nutrition-coach', input);
    if (!result.reply) throw new FunctionCallError('The coach did not reply. Please try again.', 502, {});
    return { ok: true, reply: result.reply };
  } catch (err) {
    if (err instanceof FunctionCallError && err.status === 429 && err.payload.error === 'daily_limit_reached') {
      return {
        ok: false,
        limitReached: true,
        message: typeof err.payload.message === 'string' ? err.payload.message : 'Daily coach limit reached.',
        upgradeText: typeof err.payload.upgrade_text === 'string' ? err.payload.upgrade_text : null,
      };
    }
    throw err;
  }
}

export async function clearCoachMessages(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return;
  const { error } = await supabase.from('nutrition_coach_messages').delete().eq('user_id', userId);
  if (error) throw error;
}
