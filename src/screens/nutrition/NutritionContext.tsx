import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { Profile } from '@/lib/types';
import {
  addEntries as apiAddEntries,
  addWater as apiAddWater,
  addWeight as apiAddWeight,
  DEFAULT_SETTINGS,
  deleteCustomFood as apiDeleteCustomFood,
  deleteEntry as apiDeleteEntry,
  deleteWater as apiDeleteWater,
  deleteWeight as apiDeleteWeight,
  errorMessage,
  fetchCompletedWorkoutDates,
  fetchCustomFoods,
  fetchEntries,
  fetchSettings,
  fetchWater,
  fetchWeights,
  saveCustomFood as apiSaveCustomFood,
  saveSettings as apiSaveSettings,
  updateEntry as apiUpdateEntry,
  usingLegacyMealLogs,
  type CustomFood,
  type CustomFoodInput,
  type FoodEntry,
  type MealSlot,
  type NewEntry,
  type NutritionSettings,
  type WaterEntry,
  type WeightEntry,
} from '@/lib/nutrition/api';
import { addDays, dateKeysBetween, todayKey, weekdayShort } from '@/lib/nutrition/dates';
import {
  bodyStatsFromProfile,
  computeTargets,
  computeTrend,
  trainingDaysPerWeek as estimateTrainingDays,
  type BodyStats,
  type PlanSettings,
  type Targets,
  type TrendPoint,
} from '@/lib/nutrition/engine';
import type { FoodItem } from '@/lib/nutrition/foods';
import { deriveSafety, type SafetyState } from '@/lib/nutrition/screening';
import { applyCoachPlan, loadNutritionPlan, type NutritionPlan } from '@/lib/coach/nutrition-plan';

export interface DayData {
  entries: FoodEntry[];
  water: WaterEntry[];
}

interface NutritionContextValue {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  profile: Profile | null;
  today: string;

  settings: NutritionSettings;
  hasSettingsRow: boolean;
  /** True once the user has saved a plan on the Plan page (or the check-in set one for safety). */
  planConfirmed: boolean;
  settingsAvailable: boolean;
  saveSettings: (patch: Partial<NutritionSettings>) => Promise<NutritionSettings>;
  noNumbers: boolean;
  safety: SafetyState;

  stats: BodyStats;
  statsMissing: string[];
  planSettings: PlanSettings;
  targetsFor: (date: string) => Targets;
  /** The coach's nutrition plan, when the athlete has a coach who made one. */
  coachPlan: NutritionPlan | null;
  isTrainingDay: (date: string) => boolean;
  trainingDaysPerWeek: number;
  workoutDates: string[];

  weights: WeightEntry[];
  trend: TrendPoint[];
  latestTrendKg: number | null;
  addWeight: (kg: number, date: string) => Promise<void>;
  deleteWeight: (id: string) => Promise<void>;

  days: Record<string, DayData>;
  loadRange: (from: string, to: string, force?: boolean) => Promise<void>;
  addEntries: (entries: NewEntry[]) => Promise<FoodEntry[]>;
  updateEntry: (entry: FoodEntry, change: { factor?: number; slot?: MealSlot }) => Promise<void>;
  deleteEntry: (entry: FoodEntry) => Promise<void>;
  addWater: (ml: number, date: string) => Promise<void>;
  deleteWater: (entry: WaterEntry) => Promise<void>;
  legacyDiary: boolean;

  customFoods: CustomFood[];
  customAvailable: boolean;
  saveCustomFood: (input: CustomFoodInput) => Promise<CustomFood>;
  deleteCustomFood: (id: string) => Promise<void>;
  isFavorite: (ref: string) => boolean;
  toggleFavorite: (food: FoodItem) => Promise<void>;
}

const NutritionContext = createContext<NutritionContextValue | null>(null);

export function useNutrition(): NutritionContextValue {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutrition must be used inside NutritionProvider');
  return ctx;
}

function sortEntries(list: FoodEntry[]): FoodEntry[] {
  return [...list].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

export function NutritionProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [coachPlan, setCoachPlan] = useState<NutritionPlan | null>(null);
  useEffect(() => {
    if (!user || profile?.account_type === 'coach') { setCoachPlan(null); return; }
    loadNutritionPlan(user.id).then(setCoachPlan).catch(() => setCoachPlan(null));
  }, [user, profile?.account_type]);
  const userId = user?.id ?? null;
  const [today, setToday] = useState(todayKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<NutritionSettings>(DEFAULT_SETTINGS);
  const [hasSettingsRow, setHasSettingsRow] = useState(false);
  const [settingsAvailable, setSettingsAvailable] = useState(true);
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([]);
  const [customAvailable, setCustomAvailable] = useState(true);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);
  const [days, setDays] = useState<Record<string, DayData>>({});
  const [legacyDiary, setLegacyDiary] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const daysRef = useRef(days);
  daysRef.current = days;

  // Keep "today" correct if the app stays open past midnight.
  useEffect(() => {
    const tick = () => setToday((prev) => {
      const now = todayKey();
      return now === prev ? prev : now;
    });
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const start = todayKey();
      const [settingsRes, customRes, weightsRes, workoutsRes] = await Promise.allSettled([
        fetchSettings(),
        fetchCustomFoods(),
        fetchWeights(addDays(start, -180)),
        fetchCompletedWorkoutDates(addDays(start, -60)),
      ]);
      if (cancelled) return;
      const problems: string[] = [];
      if (settingsRes.status === 'fulfilled') {
        setSettingsAvailable(settingsRes.value.available);
        setHasSettingsRow(!!settingsRes.value.settings);
        if (settingsRes.value.settings) setSettings(settingsRes.value.settings);
      } else problems.push(errorMessage(settingsRes.reason));
      if (customRes.status === 'fulfilled') {
        setCustomFoods(customRes.value.foods);
        setCustomAvailable(customRes.value.available);
      } else problems.push(errorMessage(customRes.reason));
      if (weightsRes.status === 'fulfilled') setWeights(weightsRes.value);
      else problems.push(errorMessage(weightsRes.reason));
      if (workoutsRes.status === 'fulfilled') setWorkoutDates(workoutsRes.value);
      setError(problems.length ? problems[0] : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const loadRange = useCallback(async (from: string, to: string, force = false) => {
    const keys = dateKeysBetween(from, to);
    if (!force && keys.every((k) => daysRef.current[k])) return;
    const [entries, water] = await Promise.all([fetchEntries(from, to), fetchWater(from, to)]);
    setDays((prev) => {
      const next = { ...prev };
      for (const key of keys) {
        next[key] = {
          entries: sortEntries(entries.filter((e) => e.logged_date === key)),
          water: water.filter((w) => w.logged_date === key),
        };
      }
      return next;
    });
  }, []);

  const putEntries = useCallback((list: FoodEntry[]) => {
    setDays((prev) => {
      const next = { ...prev };
      for (const e of list) {
        const day = next[e.logged_date] ?? { entries: [], water: [] };
        next[e.logged_date] = { ...day, entries: sortEntries([...day.entries.filter((x) => x.id !== e.id), e]) };
      }
      return next;
    });
  }, []);

  const addEntries = useCallback(
    async (list: NewEntry[]) => {
      const created = await apiAddEntries(list);
      putEntries(created);
      setLegacyDiary(usingLegacyMealLogs());
      return created;
    },
    [putEntries],
  );

  const updateEntry = useCallback(
    async (entry: FoodEntry, change: { factor?: number; slot?: MealSlot }) => {
      const updated = await apiUpdateEntry(entry, change);
      putEntries([{ ...updated, logged_date: entry.logged_date }]);
    },
    [putEntries],
  );

  const deleteEntry = useCallback(async (entry: FoodEntry) => {
    await apiDeleteEntry(entry.id);
    setDays((prev) => {
      const day = prev[entry.logged_date];
      if (!day) return prev;
      return { ...prev, [entry.logged_date]: { ...day, entries: day.entries.filter((e) => e.id !== entry.id) } };
    });
  }, []);

  const addWater = useCallback(async (ml: number, date: string) => {
    const created = await apiAddWater(ml, date);
    setDays((prev) => {
      const day = prev[date] ?? { entries: [], water: [] };
      return { ...prev, [date]: { ...day, water: [...day.water, created] } };
    });
  }, []);

  const deleteWater = useCallback(async (entry: WaterEntry) => {
    await apiDeleteWater(entry.id);
    setDays((prev) => {
      const day = prev[entry.logged_date];
      if (!day) return prev;
      return { ...prev, [entry.logged_date]: { ...day, water: day.water.filter((w) => w.id !== entry.id) } };
    });
  }, []);

  const addWeight = useCallback(async (kg: number, date: string) => {
    const created = await apiAddWeight(kg, date);
    setWeights((prev) => [...prev, created].sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1)));
  }, []);

  const deleteWeight = useCallback(async (id: string) => {
    await apiDeleteWeight(id);
    setWeights((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const saveSettings = useCallback(
    async (patch: Partial<NutritionSettings>) => {
      if (!userId) throw new Error('You need to be signed in.');
      const next = { ...settingsRef.current, ...patch };
      const saved = await apiSaveSettings(userId, next);
      setSettings(saved);
      setHasSettingsRow(true);
      setSettingsAvailable(true);
      return saved;
    },
    [userId],
  );

  const saveCustomFood = useCallback(async (input: CustomFoodInput) => {
    const saved = await apiSaveCustomFood(input);
    setCustomFoods((prev) => [...prev.filter((f) => f.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
    setCustomAvailable(true);
    return saved;
  }, []);

  const deleteCustomFood = useCallback(async (id: string) => {
    await apiDeleteCustomFood(id);
    setCustomFoods((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const isFavorite = useCallback((ref: string) => settings.favorites.some((f) => f.ref === ref), [settings.favorites]);

  const toggleFavorite = useCallback(
    async (food: FoodItem) => {
      const current = settingsRef.current.favorites;
      const exists = current.some((f) => f.ref === food.ref);
      const favorites = exists ? current.filter((f) => f.ref !== food.ref) : [food, ...current].slice(0, 40);
      await saveSettings({ favorites });
    },
    [saveSettings],
  );

  const trend = useMemo(() => computeTrend(weights.map((w) => ({ date: w.date, kg: w.kg }))), [weights]);
  const latestTrendKg = trend.length ? trend[trend.length - 1].trend : null;

  const { stats, missing: statsMissing } = useMemo(
    () => bodyStatsFromProfile(profile, settings.sex, latestTrendKg),
    [profile, settings.sex, latestTrendKg],
  );

  const safety = useMemo(() => deriveSafety(settings.screening, profile?.age), [settings.screening, profile?.age]);

  const planSettings = useMemo<PlanSettings>(
    () => ({
      mode: settings.goal_mode,
      ratePct: settings.rate_pct,
      proteinPerKg: settings.protein_g_per_kg,
      fatPct: settings.fat_pct,
      mealsPerDay: settings.meals_per_day,
      carbShift: settings.carb_shift,
      kcalOverride: settings.kcal_override,
      adaptiveTdee: settings.adaptive_tdee,
      dietBreakUntil: settings.diet_break_until,
    }),
    [settings],
  );

  const plannedDays = profile?.preferred_days ?? null;
  const isTrainingDay = useCallback(
    (date: string) => {
      if (workoutDates.includes(date)) return true;
      if (date < today) return false;
      return !!plannedDays?.includes(weekdayShort(date));
    },
    [workoutDates, plannedDays, today],
  );

  const trainingDaysPerWeek = useMemo(() => estimateTrainingDays(plannedDays, workoutDates, today), [plannedDays, workoutDates, today]);

  const targetsFor = useCallback(
    (date: string) =>
      applyCoachPlan(
        computeTargets(stats, planSettings, {
          today,
          date,
          trainingDay: isTrainingDay(date),
          trainingDaysPerWeek,
          noDeficit: safety.noDeficit,
          noWeightGoals: safety.noWeightGoals,
        }),
        coachPlan,
        isTrainingDay(date),
        { noDeficit: safety.noDeficit, noWeightGoals: safety.noWeightGoals },
      ),
    [stats, planSettings, today, isTrainingDay, trainingDaysPerWeek, safety.noDeficit, safety.noWeightGoals, coachPlan],
  );

  const value: NutritionContextValue = {
    loading,
    error,
    clearError: () => setError(null),
    profile,
    today,
    settings,
    hasSettingsRow,
    planConfirmed: hasSettingsRow && !!settings.mode_started_at,
    settingsAvailable,
    saveSettings,
    noNumbers: settings.no_numbers,
    safety,
    stats,
    statsMissing,
    planSettings,
    targetsFor,
    coachPlan,
    isTrainingDay,
    trainingDaysPerWeek,
    workoutDates,
    weights,
    trend,
    latestTrendKg,
    addWeight,
    deleteWeight,
    days,
    loadRange,
    addEntries,
    updateEntry,
    deleteEntry,
    addWater,
    deleteWater,
    legacyDiary,
    customFoods,
    customAvailable,
    saveCustomFood,
    deleteCustomFood,
    isFavorite,
    toggleFavorite,
  };

  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>;
}
