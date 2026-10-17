// The coach's own routine library: build, edit, copy StartFit's ready-made routines, then give them to athletes
// (coach_assign_plan copies the routine to the athlete, so later edits here never change an athlete's copy).
import { supabase } from '../supabase';

export interface RoutineSummary { id: string; name: string; sessions_per_week: number | null; is_public: boolean; updated_at: string | null }
export interface RoutineRow {
  id: string;
  exercise_id: string;
  name: string;
  exercise_order: number;
  sets: number;
  reps: string;
  rest_seconds: number | null;
  day_index: number;
  day_label: string | null;
  notes: string | null;
}
export interface RoutineFull { id: string; name: string; sessions_per_week: number | null; is_public: boolean; mine: boolean; rows: RoutineRow[] }
export interface ExerciseHit { id: string; name: string; primary_muscle: string | null; equipment: string | null }

async function me(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('not_signed_in');
  return data.user.id;
}

export async function listCoachRoutines(): Promise<{ mine: RoutineSummary[]; ready: RoutineSummary[] }> {
  const uid = await me();
  const [{ data: mine, error: e1 }, { data: ready, error: e2 }] = await Promise.all([
    supabase.from('workout_plans').select('id, name, sessions_per_week, is_public, updated_at').eq('created_by', uid).eq('archived', false).order('updated_at', { ascending: false }).limit(100),
    supabase.from('workout_plans').select('id, name, sessions_per_week, is_public, updated_at').eq('is_public', true).order('name').limit(80),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { mine: (mine ?? []) as RoutineSummary[], ready: (ready ?? []) as RoutineSummary[] };
}

export async function readRoutine(id: string): Promise<RoutineFull | null> {
  const uid = await me();
  const [{ data: p, error }, { data: rows, error: e2 }] = await Promise.all([
    supabase.from('workout_plans').select('id, name, sessions_per_week, is_public, created_by').eq('id', id).maybeSingle(),
    supabase.from('workout_plan_exercises').select('id, exercise_id, exercise_order, sets, reps, rest_seconds, day_index, day_label, notes, exercise:exercises!workout_plan_exercises_exercise_id_fkey(name)')
      .eq('plan_id', id).order('day_index').order('exercise_order'),
  ]);
  if (error) throw error;
  if (e2) throw e2;
  if (!p) return null;
  const plan = p as { id: string; name: string; sessions_per_week: number | null; is_public: boolean; created_by: string };
  return {
    id: plan.id, name: plan.name, sessions_per_week: plan.sessions_per_week, is_public: plan.is_public, mine: plan.created_by === uid,
    rows: ((rows ?? []) as (Omit<RoutineRow, 'name'> & { exercise: { name?: string } | null })[]).map((r) => ({ ...r, day_index: r.day_index ?? 0, name: r.exercise?.name ?? '—' })),
  };
}

export async function createCoachRoutine(name: string, sessionsPerWeek: number): Promise<string> {
  const uid = await me();
  const { data, error } = await supabase.from('workout_plans')
    .insert({ name: name.trim().slice(0, 120), description: '', goal: 'general_fitness', difficulty: 'beginner', is_public: false, created_by: uid, sessions_per_week: sessionsPerWeek, source: 'user' })
    .select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Copies a ready-made (or own) routine into the coach's library so it can be edited. */
export async function copyRoutine(sourceId: string): Promise<string> {
  const src = await readRoutine(sourceId);
  if (!src) throw new Error('plan_not_found');
  const id = await createCoachRoutine(src.name, src.sessions_per_week ?? new Set(src.rows.map((r) => r.day_index)).size);
  if (src.rows.length) {
    const { error } = await supabase.from('workout_plan_exercises').insert(src.rows.map((r) => ({
      plan_id: id, exercise_id: r.exercise_id, exercise_order: r.exercise_order, sets: r.sets, reps: r.reps, rest_seconds: r.rest_seconds,
      day_index: r.day_index, day_label: r.day_label, notes: r.notes,
    })));
    if (error) throw error;
  }
  return id;
}

export async function updateRoutineMeta(id: string, patch: { name?: string; sessions_per_week?: number }): Promise<void> {
  const { error } = await supabase.from('workout_plans').update({ ...patch, ...(patch.name ? { name: patch.name.trim().slice(0, 120) } : {}) }).eq('id', id);
  if (error) throw error;
}

export async function deleteCoachRoutine(id: string): Promise<void> {
  const { error } = await supabase.from('workout_plans').delete().eq('id', id);
  if (error) throw error;
}

export async function addRoutineRow(planId: string, ex: ExerciseHit, dayIndex: number, dayLabel: string | null, order: number): Promise<void> {
  const { error } = await supabase.from('workout_plan_exercises').insert({
    plan_id: planId, exercise_id: ex.id, exercise_order: order, sets: 3, reps: '8-12', rest_seconds: 90, day_index: dayIndex, day_label: dayLabel,
  });
  if (error) throw error;
}

export async function updateRoutineRow(id: string, patch: Partial<Pick<RoutineRow, 'sets' | 'reps' | 'rest_seconds' | 'notes' | 'day_label'>>): Promise<void> {
  const { error } = await supabase.from('workout_plan_exercises').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteRoutineRow(id: string): Promise<void> {
  const { error } = await supabase.from('workout_plan_exercises').delete().eq('id', id);
  if (error) throw error;
}

/** Library search (visible exercises, core library first). */
export async function searchExercises(q: string): Promise<ExerciseHit[]> {
  const term = q.trim().replace(/[%_,()]/g, ' ').slice(0, 60);
  if (term.length < 2) return [];
  const { data, error } = await supabase.from('exercises').select('id, name, primary_muscle, equipment, is_hidden, core_rank')
    .ilike('name', `%${term}%`).order('core_rank', { ascending: true, nullsFirst: false }).order('name').limit(40);
  if (error) throw error;
  return ((data ?? []) as (ExerciseHit & { is_hidden: boolean | null })[]).filter((e) => e.is_hidden !== true).slice(0, 20);
}
