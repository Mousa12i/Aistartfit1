// Loads what the week manager needs for one athlete. Everything goes through the coach read policies
// (the database only returns rows of athletes linked to this coach).
import { supabase } from '../supabase';
import { computeMuscleRecovery, type ExerciseMuscleMapping, type MuscleRecoveryState, type SetLogForRecovery, type SleepEntry, type SorenessEntry } from '../recovery/engine';
import { RECOVERY_MUSCLES, type RecoveryMuscle } from '../recovery/muscles';
import { hasRecentHighStress, localDateKey, mappingForExercise } from '../recovery/store';
import type { Exercise } from '../types';
import type { GoalMode, Sex } from '../nutrition/engine';
import { athleteSignals, type RosterRow } from './insights';
import { buildAthleteWeek, type AthleteWeek, type LoggedSet, type PlanInfo, type PlanRow } from './autopilot';

const PAGE = 1000;
const isMuscle = (m: string): m is RecoveryMuscle => (RECOVERY_MUSCLES as string[]).includes(m);

/** Exercise → muscles, shared across athletes so each exercise is fetched once. */
export class MappingCache {
  private map = new Map<string, ExerciseMuscleMapping>();

  get all(): Map<string, ExerciseMuscleMapping> { return this.map; }

  async ensure(ids: string[]): Promise<void> {
    const missing = [...new Set(ids)].filter((id) => !this.map.has(id));
    if (!missing.length) return;
    const exercises: Exercise[] = [];
    for (let i = 0; i < missing.length; i += 150) {
      const { data, error } = await supabase.from('exercises').select('*').in('id', missing.slice(i, i + 150));
      if (error) throw error;
      exercises.push(...((data ?? []) as Exercise[]));
    }
    const needPersisted = exercises.filter((ex) => !(ex.muscles_primary?.length || ex.muscles_secondary?.length)).map((ex) => ex.id);
    const persisted = new Map<string, { muscle: RecoveryMuscle; contribution: number }[]>();
    for (let i = 0; i < needPersisted.length; i += 150) {
      const { data, error } = await supabase.from('exercise_muscles').select('exercise_id, muscle, contribution').in('exercise_id', needPersisted.slice(i, i + 150));
      if (error) break;
      for (const row of (data ?? []) as { exercise_id: string; muscle: string; contribution: number }[]) {
        if (!isMuscle(row.muscle)) continue;
        const list = persisted.get(row.exercise_id) ?? [];
        list.push({ muscle: row.muscle, contribution: Number(row.contribution) });
        persisted.set(row.exercise_id, list);
      }
    }
    for (const ex of exercises) this.map.set(ex.id, mappingForExercise(ex, persisted.get(ex.id)));
  }
}

export interface AthleteWeekData {
  week: AthleteWeek;
  recovery: MuscleRecoveryState[];
  /** Has any finished workout in the last 60 days (otherwise the map has nothing to show). */
  trained: boolean;
}

interface SessionRow { id: string; completed_at: string; status: string | null }
interface SetRow { exercise_id: string; exercise_name: string; set_type: string | null; rir: number | null; weight: number | null; reps: number | null; completed: boolean; session_id: string }

async function setLogs(sessionIds: string[]): Promise<SetRow[]> {
  const out: SetRow[] = [];
  for (let i = 0; i < sessionIds.length; i += 60) {
    const chunk = sessionIds.slice(i, i + 60);
    for (let from = 0; from < PAGE * 10; from += PAGE) {
      const { data, error } = await supabase.from('workout_set_logs')
        .select('exercise_id, exercise_name, set_type, rir, weight, reps, completed, session_id')
        .in('session_id', chunk).order('id').range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as SetRow[];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
  }
  return out;
}

export async function loadAthleteWeek(row: RosterRow, cache: MappingCache, now = new Date()): Promise<AthleteWeekData> {
  const id = row.athlete_id;
  const today = localDateKey(now);
  const ago = (d: number) => new Date(now.getTime() - d * 86400000);
  const [sessRes, dailyRes, soreRes, profRes, weightRes, mealRes, settingsRes, assignRes] = await Promise.all([
    supabase.from('workout_sessions').select('id, completed_at, status').eq('user_id', id).not('completed_at', 'is', null)
      .gte('completed_at', ago(60).toISOString()).order('completed_at', { ascending: false }).limit(200),
    supabase.from('daily_checkins').select('checkin_date, sleep_hours, stress, wellness_stress, soreness').eq('user_id', id)
      .gte('checkin_date', localDateKey(ago(14))).order('checkin_date', { ascending: false }),
    supabase.from('soreness_logs').select('muscle, soreness_score, recorded_at').eq('user_id', id).gte('recorded_at', ago(7).toISOString()),
    supabase.from('recovery_profile').select('muscle, personal_multiplier').eq('user_id', id),
    supabase.from('body_measurements').select('weight_kg, recorded_at').eq('user_id', id).not('weight_kg', 'is', null)
      .gte('recorded_at', ago(28).toISOString()).order('recorded_at', { ascending: true }).limit(200),
    supabase.from('meal_logs').select('logged_date, kcal').eq('user_id', id).gte('logged_date', localDateKey(ago(15))).limit(1500),
    supabase.from('nutrition_settings').select('goal_mode, rate_pct, kcal_override, protein_g_per_kg, mode_started_at, sex').eq('user_id', id).maybeSingle(),
    supabase.from('user_plan_assignments').select('plan_id').eq('user_id', id).is('completed_at', null).order('assigned_at', { ascending: false }).limit(1),
  ]);

  const sessions = ((sessRes.data ?? []) as SessionRow[]).filter((s) => s.status !== 'abandoned');
  const at = new Map(sessions.map((s) => [s.id, s.completed_at]));
  const logs = sessions.length ? await setLogs(sessions.map((s) => s.id)) : [];

  let plan: PlanInfo | null = null;
  const planId = ((assignRes.data ?? []) as { plan_id: string }[])[0]?.plan_id;
  if (planId) {
    const [{ data: p }, { data: ex }] = await Promise.all([
      supabase.from('workout_plans').select('id, sessions_per_week').eq('id', planId).maybeSingle(),
      supabase.from('workout_plan_exercises').select('id, exercise_id, sets, reps, rest_seconds, notes, day_index, exercise:exercises(name)')
        .eq('plan_id', planId).order('day_index').order('exercise_order'),
    ]);
    if (p) {
      plan = {
        sessionsPerWeek: (p as { sessions_per_week: number | null }).sessions_per_week ?? null,
        rows: ((ex ?? []) as (Omit<PlanRow, 'name'> & { exercise: { name?: string } | null })[]).map((e) => ({
          id: e.id, exercise_id: e.exercise_id, sets: e.sets, reps: e.reps, rest_seconds: e.rest_seconds, notes: e.notes, day_index: e.day_index,
          name: e.exercise?.name ?? '—',
        })),
      };
    }
  }

  await cache.ensure([...logs.map((l) => l.exercise_id), ...(plan?.rows.map((r) => r.exercise_id) ?? [])]);

  const recoveryLogs: SetLogForRecovery[] = logs.map((l) => ({
    exercise_id: l.exercise_id, exercise_name: l.exercise_name, set_type: l.set_type, rir: l.rir, weight: l.weight,
    reps: l.reps ?? 0, completed: l.completed, session_id: l.session_id, session_completed_at: at.get(l.session_id) ?? null,
  }));

  type Daily = { checkin_date: string; sleep_hours: number | null; stress: number | null; wellness_stress: number | null; soreness: Record<string, number> | null };
  const daily = (dailyRes.data ?? []) as Daily[];
  const soreness: SorenessEntry[] = ((soreRes.data ?? []) as { muscle: string; soreness_score: number; recorded_at: string }[])
    .filter((s) => isMuscle(s.muscle)).map((s) => ({ muscle: s.muscle as RecoveryMuscle, score: s.soreness_score, recordedAt: s.recorded_at }));
  for (const c of daily) {
    for (const [m, score] of Object.entries(c.soreness ?? {})) if (isMuscle(m)) soreness.push({ muscle: m, score, recordedAt: `${c.checkin_date}T08:00:00` });
  }
  const sleep: SleepEntry[] = daily.filter((c) => c.sleep_hours != null).map((c) => ({ date: c.checkin_date, sleepHours: Number(c.sleep_hours) }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const personal: Record<string, number> = {};
  for (const r of (profRes.data ?? []) as { muscle: string; personal_multiplier: number }[]) personal[r.muscle] = Number(r.personal_multiplier);

  const recovery = computeMuscleRecovery({
    setLogs: recoveryLogs, exerciseMappings: cache.all, soreness, sleep, personalMultipliers: personal, now,
    highStress: hasRecentHighStress(daily, now),
  });

  const intakeByDate: Record<string, number> = {};
  for (const m of (mealRes.data ?? []) as { logged_date: string; kcal: number | null }[]) intakeByDate[m.logged_date] = (intakeByDate[m.logged_date] ?? 0) + Number(m.kcal ?? 0);

  const settings = settingsRes.data as { goal_mode: GoalMode | null; rate_pct: number | null; kcal_override: number | null; protein_g_per_kg: number | null; mode_started_at: string | null; sex: Sex | null } | null;
  const loggedSets: LoggedSet[] = recoveryLogs.filter((l) => l.session_completed_at).map((l) => ({
    exercise_id: l.exercise_id, session_id: l.session_id, completed_at: l.session_completed_at as string, set_type: l.set_type, weight: l.weight, reps: l.reps, completed: l.completed,
  }));
  const since14 = ago(14).getTime();
  const signals = athleteSignals(row, now);
  const noWorkout = signals.reasons.find((r) => r.code === 'no_workout' || r.code === 'never_trained');
  const noFood = signals.reasons.find((r) => r.code === 'no_food');

  const week = buildAthleteWeek({
    athleteId: id,
    nutrition: {
      mode: settings?.goal_mode ?? null,
      ratePct: settings?.rate_pct != null ? Number(settings.rate_pct) : null,
      kcalOverride: settings?.kcal_override ?? null,
      proteinPerKg: settings?.protein_g_per_kg != null ? Number(settings.protein_g_per_kg) : null,
      modeStartedAt: settings?.mode_started_at ?? null,
      weighIns: ((weightRes.data ?? []) as { weight_kg: number; recorded_at: string }[]).map((w) => ({ date: localDateKey(new Date(w.recorded_at)), kg: Number(w.weight_kg) })),
      intakeByDate,
      today,
      sex: settings?.sex ?? null,
      heightCm: row.height_cm != null ? Number(row.height_cm) : null,
      age: row.age,
    },
    volume: { plan, mappings: cache.all, sessions14d: sessions.filter((s) => new Date(s.completed_at).getTime() >= since14).length, sleep: null },
    logs: loggedSets,
    sleepNights: sleep.map((s) => ({ date: s.date, hours: s.sleepHours })),
    noWorkoutDays: noWorkout ? noWorkout.days : null,
    noFoodDays: noFood ? noFood.days : null,
  });

  return { week, recovery, trained: sessions.length > 0 };
}

/** Runs `fn` over items with at most `limit` in flight, reporting progress. */
export async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, onDone?: (done: number) => void): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i]); } catch { out[i] = null; }
      onDone?.(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
