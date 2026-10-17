// Coach programming: the coach's routine library and the athlete's own program copy.
// Library routines belong to the coach; a routine given to an athlete is copied (coach_assign_plan), and the
// coach edits that copy through checked database functions (coach_plan_*), so edits never leak between athletes.
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
  rir_target: number | null;
  tempo: string | null;
  group_label: string | null;
  alt_exercise_id: string | null;
  alt_name: string | null;
}
export type RoutineAccess = 'own' | 'athlete' | 'readonly';
export interface RoutineFull {
  id: string;
  name: string;
  sessions_per_week: number | null;
  duration_weeks: number | null;
  progression: string | null;
  is_public: boolean;
  access: RoutineAccess;
  owner: string;
  rows: RoutineRow[];
}
export interface ExerciseHit { id: string; name: string; primary_muscle: string | null; equipment: string | null }

const fail = (e: { message?: string } | null) => { if (e) throw new Error(e.message ?? 'failed'); };

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
  fail(e1); fail(e2);
  return { mine: (mine ?? []) as RoutineSummary[], ready: (ready ?? []) as RoutineSummary[] };
}

/** The athlete's current program (their own copy), if any. */
export async function athleteActivePlanId(athleteId: string): Promise<string | null> {
  const { data, error } = await supabase.from('user_plan_assignments').select('plan_id').eq('user_id', athleteId).is('completed_at', null)
    .order('assigned_at', { ascending: false }).limit(1);
  fail(error);
  return ((data ?? []) as { plan_id: string }[])[0]?.plan_id ?? null;
}

export async function readRoutine(id: string): Promise<RoutineFull | null> {
  const uid = await me();
  const [{ data: p, error }, { data: rows, error: e2 }] = await Promise.all([
    supabase.from('workout_plans').select('id, name, sessions_per_week, duration_weeks, details, is_public, created_by').eq('id', id).maybeSingle(),
    supabase.from('workout_plan_exercises')
      .select('id, exercise_id, exercise_order, sets, reps, rest_seconds, day_index, day_label, notes, rir_target, tempo, group_label, alt_exercise_id, exercise:exercises!workout_plan_exercises_exercise_id_fkey(name)')
      .eq('plan_id', id).order('day_index').order('exercise_order'),
  ]);
  fail(error); fail(e2);
  if (!p) return null;
  const plan = p as { id: string; name: string; sessions_per_week: number | null; duration_weeks: number | null; details: Record<string, unknown> | null; is_public: boolean; created_by: string };
  type Raw = Omit<RoutineRow, 'name' | 'alt_name'> & { exercise: { name?: string } | null };
  const list = (rows ?? []) as Raw[];
  const altIds = [...new Set(list.map((r) => r.alt_exercise_id).filter((x): x is string => !!x))];
  const altNames = new Map<string, string>();
  if (altIds.length) {
    const { data: alts } = await supabase.from('exercises').select('id, name').in('id', altIds);
    for (const a of (alts ?? []) as { id: string; name: string }[]) altNames.set(a.id, a.name);
  }
  return {
    id: plan.id,
    name: plan.name,
    sessions_per_week: plan.sessions_per_week,
    duration_weeks: plan.duration_weeks,
    progression: typeof plan.details?.progression === 'string' ? (plan.details.progression as string) : null,
    is_public: plan.is_public,
    owner: plan.created_by,
    access: plan.created_by === uid ? 'own' : plan.is_public ? 'readonly' : 'athlete',
    rows: list.map((r) => ({ ...r, day_index: r.day_index ?? 0, name: r.exercise?.name ?? '—', alt_name: r.alt_exercise_id ? altNames.get(r.alt_exercise_id) ?? null : null })),
  };
}

export async function createCoachRoutine(name: string, sessionsPerWeek: number): Promise<string> {
  const uid = await me();
  const { data, error } = await supabase.from('workout_plans')
    .insert({ name: name.trim().slice(0, 120), description: '', goal: 'general_fitness', difficulty: 'beginner', is_public: false, created_by: uid, sessions_per_week: sessionsPerWeek, source: 'user' })
    .select('id').single();
  fail(error);
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
      day_index: r.day_index, day_label: r.day_label, notes: r.notes, rir_target: r.rir_target, tempo: r.tempo, group_label: r.group_label, alt_exercise_id: r.alt_exercise_id,
    })));
    fail(error);
  }
  if (src.duration_weeks || src.progression) await updateRoutineMeta(id, { weeks: src.duration_weeks, progression: src.progression });
  return id;
}

export async function updateRoutineMeta(id: string, patch: { name?: string; sessions_per_week?: number; weeks?: number | null; progression?: string | null }): Promise<void> {
  const { error } = await supabase.rpc('coach_plan_meta', {
    p: id, new_name: patch.name ?? null, weeks: patch.weeks ?? null, per_week: patch.sessions_per_week ?? null,
    progression: patch.progression === undefined ? null : patch.progression ?? '',
  });
  fail(error);
}

export async function deleteCoachRoutine(id: string): Promise<void> {
  const { error } = await supabase.from('workout_plans').delete().eq('id', id);
  fail(error);
}

export async function addRoutineRow(planId: string, ex: ExerciseHit, dayIndex: number, dayLabel: string | null): Promise<void> {
  const { error } = await supabase.rpc('coach_plan_add_exercise', { p: planId, ex: ex.id, day: dayIndex, label: dayLabel, new_sets: 3, new_reps: '8-12', new_rest: 90 });
  fail(error);
}

export type RowPatch = Partial<Pick<RoutineRow, 'sets' | 'reps' | 'rest_seconds' | 'notes' | 'rir_target' | 'tempo' | 'group_label' | 'alt_exercise_id' | 'exercise_order' | 'day_index' | 'day_label'>>;

export async function updateRoutineRow(id: string, patch: RowPatch): Promise<void> {
  const { error } = await supabase.rpc('coach_plan_update_row', { row_id: id, patch });
  fail(error);
}

export async function deleteRoutineRow(id: string): Promise<void> {
  const { error } = await supabase.from('workout_plan_exercises').delete().eq('id', id);
  fail(error);
}

/** Renames a day (every row of it carries the label). */
export async function renameDay(rows: RoutineRow[], dayIndex: number, label: string): Promise<void> {
  for (const r of rows.filter((x) => x.day_index === dayIndex)) await updateRoutineRow(r.id, { day_label: label });
}

/** Copies a day's exercises into a new day at the end. */
export async function duplicateDay(planId: string, rows: RoutineRow[], dayIndex: number, newIndex: number, label: string | null): Promise<void> {
  for (const r of rows.filter((x) => x.day_index === dayIndex).sort((a, b) => a.exercise_order - b.exercise_order)) {
    const { data, error } = await supabase.rpc('coach_plan_add_exercise', { p: planId, ex: r.exercise_id, day: newIndex, label, new_sets: r.sets, new_reps: r.reps, new_rest: r.rest_seconds ?? 90 });
    fail(error);
    await updateRoutineRow(data as string, { rir_target: r.rir_target, tempo: r.tempo, group_label: r.group_label, notes: r.notes, alt_exercise_id: r.alt_exercise_id });
  }
}

export async function deleteDay(rows: RoutineRow[], dayIndex: number): Promise<void> {
  for (const r of rows.filter((x) => x.day_index === dayIndex)) await deleteRoutineRow(r.id);
}

/** Swap two neighbouring rows of the same day. */
export async function moveRow(rows: RoutineRow[], id: string, dir: -1 | 1): Promise<void> {
  const row = rows.find((r) => r.id === id);
  if (!row) return;
  const day = rows.filter((r) => r.day_index === row.day_index).sort((a, b) => a.exercise_order - b.exercise_order);
  const i = day.findIndex((r) => r.id === id);
  const other = day[i + dir];
  if (!other) return;
  await updateRoutineRow(row.id, { exercise_order: other.exercise_order });
  await updateRoutineRow(other.id, { exercise_order: row.exercise_order === other.exercise_order ? row.exercise_order + dir : row.exercise_order });
}

/** Library search (visible exercises, core library first). */
export async function searchExercises(q: string): Promise<ExerciseHit[]> {
  const term = q.trim().replace(/[%_,()]/g, ' ').slice(0, 60);
  if (term.length < 2) return [];
  const { data, error } = await supabase.from('exercises').select('id, name, primary_muscle, equipment, is_hidden, core_rank')
    .ilike('name', `%${term}%`).order('core_rank', { ascending: true, nullsFirst: false }).order('name').limit(40);
  fail(error);
  return ((data ?? []) as (ExerciseHit & { is_hidden: boolean | null })[]).filter((e) => e.is_hidden !== true).slice(0, 20);
}

/** Tempo as eccentric-pause-concentric(-pause) seconds, e.g. 3-1-1 or 3-0-1-0; X means explosive. */
export function validTempo(t: string): boolean {
  return /^[0-9X]{1,2}(-[0-9X]{1,2}){1,3}$/.test(t.trim().toUpperCase());
}
