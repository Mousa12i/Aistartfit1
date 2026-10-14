// Supabase calls for the training brain: library, saved answers, history, routines, memory, coach.

import { supabase } from '../supabase';
import { fetchExercises } from '../data';
import { callFunction, isSchemaError } from '../nutrition/api';
import { PlanLibrary, rowToRef } from './engine-library';
import { summarizeHistory } from './history';
import { EQUIP_LABELS } from './taxonomy';
import type { IntakeDraft } from './intake';
import type { PlanAction } from './plan-actions';
import type { HealthScreening, PlanGoal, TrainingHistorySummary, TrainingPlan } from './plan-types';
import type { Exercise, WorkoutPlan, WorkoutSession, WorkoutSetLog } from '../types';

// ---------------- library ----------------

let libraryPromise: Promise<{ lib: PlanLibrary; rows: Exercise[] }> | null = null;

/** The whole library (including hidden duplicates, so old logs still resolve), loaded once per visit. */
export function loadPlanLibrary(force = false): Promise<{ lib: PlanLibrary; rows: Exercise[] }> {
  if (!libraryPromise || force) {
    libraryPromise = fetchExercises({ includeHidden: true })
      .then((rows) => ({ rows, lib: new PlanLibrary(rows.map(rowToRef).filter((r): r is NonNullable<typeof r> => r !== null)) }))
      .catch((e) => {
        libraryPromise = null;
        throw e;
      });
  }
  return libraryPromise;
}

// ---------------- saved answers ----------------

export interface SavedTrainingProfile {
  draft: IntakeDraft;
  screening: HealthScreening | null;
  updatedAt: string | null;
  /** False when the database has not been updated for the training brain yet. */
  available: boolean;
}

export async function loadTrainingProfile(): Promise<SavedTrainingProfile> {
  const { data, error } = await supabase.from('training_profiles').select('*').maybeSingle();
  if (error) {
    if (isSchemaError(error)) return { draft: {}, screening: null, updatedAt: null, available: false };
    throw error;
  }
  return {
    draft: ((data?.intake as IntakeDraft | undefined) ?? {}) as IntakeDraft,
    screening: (data?.screening as HealthScreening | null | undefined) ?? null,
    updatedAt: (data?.updated_at as string | undefined) ?? null,
    available: true,
  };
}

export async function saveTrainingProfile(draft: IntakeDraft, screening: HealthScreening | null): Promise<void> {
  const { screening: _ignored, ...intake } = draft;
  void _ignored;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Sign in to save your answers.');
  const { error } = await supabase
    .from('training_profiles')
    .upsert({ user_id: auth.user.id, intake, screening }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ---------------- history ----------------

export async function loadTrainingHistory(lib: PlanLibrary, now = new Date()): Promise<TrainingHistorySummary> {
  const since = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const list = (sessions as WorkoutSession[]) ?? [];
  const logs: WorkoutSetLog[] = [];
  for (let i = 0; i < list.length; i += 100) {
    const ids = list.slice(i, i + 100).map((s) => s.id);
    const { data, error: e2 } = await supabase.from('workout_set_logs').select('*').in('session_id', ids);
    if (e2) throw e2;
    logs.push(...((data as WorkoutSetLog[]) ?? []));
  }
  return summarizeHistory(list, logs, lib, now);
}

// ---------------- routines ----------------

const DB_GOAL: Record<PlanGoal, WorkoutPlan['goal']> = {
  muscle: 'muscle_gain',
  strength: 'strength',
  fat_loss: 'fat_loss',
  general: 'general_fitness',
  endurance: 'endurance',
};

export async function savePlanAsRoutine(
  plan: TrainingPlan,
  opts: { name?: string; replacePlanId?: string | null; activate?: boolean; source?: 'engine' | 'coach' | 'user' } = {},
): Promise<string> {
  const { data, error } = await supabase.rpc('save_training_plan', {
    p_name: (opts.name ?? plan.title).slice(0, 120),
    p_description: plan.summary,
    p_goal: DB_GOAL[plan.effectiveGoal],
    p_difficulty: plan.level === 'new' ? 'beginner' : plan.level,
    p_sessions_per_week: plan.strengthDays,
    p_session_minutes: plan.sessionMinutes,
    p_duration_weeks: 6,
    p_equipment: plan.equipmentUsed ?? plan.inputs.equipment,
    p_details: plan,
    p_source: opts.source ?? 'engine',
    p_exercises: routineRowsFromPlan(plan),
    p_replace_plan_id: opts.replacePlanId ?? null,
    p_activate: opts.activate ?? true,
  });
  if (error) throw error;
  return data as string;
}

export async function listMyRoutines(): Promise<WorkoutPlan[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('created_by', auth.user.id)
    .eq('is_public', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as WorkoutPlan[]) ?? []).filter((p) => !p.archived);
}

export async function deleteRoutine(planId: string): Promise<void> {
  const { error } = await supabase.from('workout_plans').delete().eq('id', planId);
  if (error) throw error;
}

export async function renameRoutine(planId: string, name: string): Promise<void> {
  const { error } = await supabase.from('workout_plans').update({ name: name.slice(0, 120) }).eq('id', planId);
  if (error) throw error;
}

/** The routine the person is following now (most recent open assignment). */
export async function fetchActiveRoutine(): Promise<WorkoutPlan | null> {
  const { data, error } = await supabase
    .from('user_plan_assignments')
    .select('plan_id, assigned_at, plan:workout_plans(*)')
    .is('completed_at', null)
    .order('assigned_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data as unknown as { plan: WorkoutPlan | null }[] | null)?.[0];
  return row?.plan ?? null;
}

export async function setActiveRoutine(planId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Sign in first.');
  const { error: e1 } = await supabase
    .from('user_plan_assignments')
    .update({ completed_at: new Date().toISOString() })
    .is('completed_at', null)
    .neq('plan_id', planId);
  if (e1) throw e1;
  const { data: open } = await supabase.from('user_plan_assignments').select('id').eq('plan_id', planId).is('completed_at', null).limit(1);
  if (!open || open.length === 0) {
    const { error } = await supabase.from('user_plan_assignments').insert({ plan_id: planId });
    if (error) throw error;
  }
}

export { routineDays, routineRowsFromPlan } from './routine';
import { routineRowsFromPlan } from './routine';

/** Append an exercise to one day of the person's own routine, using the library's starting prescription. */
export async function addExerciseToRoutine(planId: string, exercise: Exercise, dayIndex: number, dayLabel: string | null): Promise<void> {
  const { data: rows, error: e1 } = await supabase
    .from('workout_plan_exercises')
    .select('exercise_order, day_index, exercise_id')
    .eq('plan_id', planId);
  if (e1) throw e1;
  const list = (rows ?? []) as { exercise_order: number; day_index?: number; exercise_id: string }[];
  if (list.some((r) => (r.day_index ?? 0) === dayIndex && r.exercise_id === exercise.id)) throw new Error('That exercise is already on this day.');
  const order = list.reduce((m, r) => Math.max(m, r.exercise_order), -1) + 1;
  const row: Record<string, unknown> = {
    plan_id: planId,
    exercise_id: exercise.id,
    exercise_order: order,
    sets: Math.min(10, Math.max(1, exercise.default_sets || 3)),
    reps: exercise.default_reps || '8-12',
    rest_seconds: exercise.default_rest_seconds || 90,
  };
  if (dayIndex !== 0 || dayLabel) {
    row.day_index = dayIndex;
    row.day_label = dayLabel;
  }
  const { error } = await supabase.from('workout_plan_exercises').insert(row);
  if (error) throw error;
}

/** Create an empty routine of the person's own (a name and one day) and return its id. */
export async function createEmptyRoutine(name: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Sign in first.');
  const { data, error } = await supabase
    .from('workout_plans')
    .insert({ name: name.slice(0, 120), description: '', goal: 'general_fitness', difficulty: 'beginner', is_public: false, created_by: auth.user.id })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

// ---------------- memory ----------------

export type MemoryCategory = 'goal' | 'health' | 'injury' | 'equipment' | 'schedule' | 'preference' | 'training' | 'nutrition' | 'recovery' | 'other';

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  goal: 'Goals',
  health: 'Health',
  injury: 'Injuries and pain',
  equipment: 'Equipment',
  schedule: 'Schedule',
  preference: 'Preferences',
  training: 'Training',
  nutrition: 'Nutrition',
  recovery: 'Recovery',
  other: 'Other',
};

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  content: string;
  source: 'user' | 'training_coach' | 'nutrition_coach' | 'ai_coach' | 'app';
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export async function listMemory(): Promise<{ entries: MemoryEntry[]; available: boolean }> {
  const { data, error } = await supabase.from('user_memory').select('*').order('pinned', { ascending: false }).order('updated_at', { ascending: false });
  if (error) {
    if (isSchemaError(error)) return { entries: [], available: false };
    throw error;
  }
  return { entries: (data as MemoryEntry[]) ?? [], available: true };
}

export async function addMemory(category: MemoryCategory, content: string): Promise<MemoryEntry> {
  const { data, error } = await supabase.from('user_memory').insert({ category, content: content.trim().slice(0, 500) }).select('*').single();
  if (error) throw error;
  return data as MemoryEntry;
}

export async function updateMemory(id: string, patch: Partial<Pick<MemoryEntry, 'category' | 'content' | 'pinned'>>): Promise<void> {
  const clean = { ...patch, ...(patch.content != null ? { content: patch.content.trim().slice(0, 500) } : {}) };
  const { error } = await supabase.from('user_memory').update(clean).eq('id', id);
  if (error) throw error;
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from('user_memory').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllMemory(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase.from('user_memory').delete().eq('user_id', auth.user.id);
  if (error) throw error;
}

// ---------------- training coach ----------------

export interface CoachBlock {
  text: string;
  basis: 'evidence' | 'library' | 'plan' | 'user_data' | 'general';
  claimIds: string[];
  exerciseIds: string[];
}

export interface CoachReply {
  blocks: CoachBlock[];
  /** Plan changes the coach proposes; the app applies them through the validator after the person agrees. */
  actions: PlanAction[];
  /** Questions about missing intake fields. */
  ask: string[];
  memorySaved: { category: MemoryCategory; content: string }[];
  remaining: number | null;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data: CoachReply | null;
  created_at: string;
}

export async function listCoachMessages(limit = 60): Promise<{ messages: CoachMessage[]; available: boolean }> {
  const { data, error } = await supabase.from('training_coach_messages').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) {
    if (isSchemaError(error)) return { messages: [], available: false };
    throw error;
  }
  return { messages: ((data as CoachMessage[]) ?? []).reverse(), available: true };
}

export async function clearCoachMessages(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase.from('training_coach_messages').delete().eq('user_id', auth.user.id);
  if (error) throw error;
}

export async function sendCoachMessage(input: {
  message: string;
  plan: TrainingPlan | null;
  draft: IntakeDraft;
  missing: string[];
  history: TrainingHistorySummary | null;
}): Promise<CoachReply> {
  return callFunction<CoachReply>('training-coach', input);
}

// ---------------- home version of a routine ----------------

export interface RoutineVariant {
  kind: 'home';
  sourcePlanId: string;
  sourceName: string;
  equipment: string[];
  createdAt: string;
  counts: { kept: number; swapped: number; removed: number; unknown: number };
}

/** The variant info stored with a home version (null for ordinary routines). */
export function routineVariant(plan: Pick<WorkoutPlan, 'details'> | null | undefined): RoutineVariant | null {
  const v = (plan?.details as { variant?: RoutineVariant } | null | undefined)?.variant;
  return v && v.kind === 'home' && typeof v.sourcePlanId === 'string' ? v : null;
}

/** The person's existing home version of a routine, if any. */
export async function findHomeVersion(sourcePlanId: string): Promise<WorkoutPlan | null> {
  const mine = await listMyRoutines().catch(() => [] as WorkoutPlan[]);
  return mine.find((p) => routineVariant(p)?.sourcePlanId === sourcePlanId) ?? null;
}

/** Save (or refresh) the home version of a routine and make it the active routine. */
export async function saveHomeVersion(
  source: WorkoutPlan,
  rows: { exercise_id: string; exercise_order: number; sets: number; reps: string; rest_seconds: number; day_index: number; day_label: string | null; rir_target: number | null; notes: string | null }[],
  info: { equipment: string[]; counts: RoutineVariant['counts'] },
): Promise<string> {
  const existing = await findHomeVersion(source.id);
  const variant: RoutineVariant = { kind: 'home', sourcePlanId: source.id, sourceName: source.name, equipment: info.equipment, createdAt: new Date().toISOString(), counts: info.counts };
  const { data, error } = await supabase.rpc('save_training_plan', {
    p_name: `${source.name} · Home`.slice(0, 120),
    p_description: `Home version of "${source.name}" for: ${info.equipment.map((e) => (EQUIP_LABELS as Record<string, string>)[e] ?? e).join(', ').toLowerCase()}.`,
    p_goal: source.goal,
    p_difficulty: source.difficulty,
    p_sessions_per_week: source.sessions_per_week,
    p_session_minutes: source.session_duration_min,
    p_duration_weeks: source.duration_weeks,
    p_equipment: info.equipment,
    p_details: { variant },
    p_source: 'user',
    p_exercises: rows,
    p_replace_plan_id: existing?.id ?? null,
    p_activate: true,
  });
  if (error) throw error;
  return data as string;
}

/** Ids of the other version (gym ↔ home) of a routine, for carrying on with the next day. */
export async function relatedRoutineIds(plan: Pick<WorkoutPlan, 'id' | 'details'> | null): Promise<string[]> {
  if (!plan) return [];
  const v = routineVariant(plan);
  if (v) return [v.sourcePlanId];
  const home = await findHomeVersion(plan.id).catch(() => null);
  return home ? [home.id] : [];
}
