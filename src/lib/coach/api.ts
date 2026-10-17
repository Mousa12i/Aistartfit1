// Coach mode data. Every read and write is checked by the database (RLS and security-definer functions
// that require an active coach-athlete link), so these helpers only shape the calls.

import { supabase } from '../supabase';
import type { RosterRow } from './insights';

const BUCKET = 'coach-media';

function fail(error: { message?: string } | null | undefined): never {
  throw new Error(error?.message ?? 'Something went wrong');
}

/** Turns a database error code into a key the screens translate. */
export function coachErrorKey(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  for (const code of ['code_not_found', 'own_code', 'already_has_coach', 'coach_full', 'not_your_athlete', 'kcal_out_of_range', 'protein_out_of_range', 'coach_not_ready']) {
    if (m.includes(code)) return code;
  }
  return 'generic';
}

// ---------------- roles ----------------

export async function becomeCoach(): Promise<string> {
  const { data, error } = await supabase.rpc('become_coach');
  if (error) fail(error);
  return data as string;
}

export async function setAthleteRole(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ account_type: 'athlete' }).eq('id', userId);
  if (error) fail(error);
}

export async function saveCoachBrand(userId: string, patch: { coach_brand_name?: string | null; coach_bio?: string | null; coach_checkin_day?: number }): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) fail(error);
}

// ---------------- public profile and code of conduct ----------------

/** Must match coach_terms_current() in the database; changing the rules means a new version every coach accepts again. */
export const COACH_TERMS_VERSION = '2026-10-17';

export interface Certification { name: string; issuer: string | null; year: number | null }

export interface CoachProfile {
  coach_id: string;
  display_name: string | null;
  brand_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  headline: string | null;
  specialties: string[];
  years: number | null;
  languages: string[];
  format: 'online' | 'in_person' | 'hybrid' | null;
  location: string | null;
  philosophy: string | null;
  certifications: Certification[];
  insured: boolean | null;
  dietitian: boolean | null;
  checkin_day: number | null;
  terms_ok: boolean;
  terms_accepted_at: string | null;
}

export interface CoachProfilePatch {
  display_name?: string | null;
  coach_brand_name?: string | null;
  coach_bio?: string | null;
  coach_headline?: string | null;
  coach_specialties?: string[];
  coach_years?: number | null;
  coach_languages?: string[];
  coach_format?: 'online' | 'in_person' | 'hybrid' | null;
  coach_location?: string | null;
  coach_philosophy?: string | null;
  coach_certifications?: Certification[];
  coach_insured?: boolean | null;
  coach_dietitian?: boolean | null;
}

export async function saveCoachProfile(userId: string, patch: CoachProfilePatch): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) fail(error);
}

export async function acceptCoachTerms(): Promise<void> {
  const { error } = await supabase.rpc('accept_coach_terms', { version: COACH_TERMS_VERSION });
  if (error) fail(error);
}

export async function coachProfileByCode(code: string): Promise<CoachProfile | null> {
  const { data, error } = await supabase.rpc('coach_profile_by_code', { code });
  if (error) fail(error);
  return (data as CoachProfile | null) ?? null;
}

export async function myCoachProfile(): Promise<CoachProfile | null> {
  const { data, error } = await supabase.rpc('my_coach_profile');
  if (error) fail(error);
  return (data as CoachProfile | null) ?? null;
}

// ---------------- coaching settings (welcome, reply hours, check-in questions) ----------------

export interface CoachHours { hours_start: number | null; hours_end: number | null; hours_tz: string | null; questions: string[] }

export async function saveCoachSettings(userId: string, patch: {
  coach_welcome_message?: string | null; coach_hours_start?: number | null; coach_hours_end?: number | null; coach_hours_tz?: string | null; coach_checkin_questions?: string[];
}): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) fail(error);
}

export async function myCoachHours(): Promise<CoachHours | null> {
  const { data, error } = await supabase.rpc('my_coach_hours');
  if (error) fail(error);
  const row = ((data ?? []) as { hours_start: number | null; hours_end: number | null; hours_tz: string | null; questions: unknown }[])[0];
  if (!row) return null;
  return { ...row, questions: Array.isArray(row.questions) ? (row.questions as unknown[]).map(String) : [] };
}

// ---------------- habits ----------------

export interface Habit { id: string; coach_id: string; athlete_id: string; title: string; active: boolean; created_at: string }
export interface HabitLog { habit_id: string; day: string; done: boolean }

export async function listHabits(athleteId: string): Promise<{ habits: Habit[]; logs: HabitLog[] }> {
  const since = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from('coach_habits').select('*').eq('athlete_id', athleteId).eq('active', true).order('created_at');
  if (error) fail(error);
  const habits = (data ?? []) as Habit[];
  if (!habits.length) return { habits, logs: [] };
  const { data: logs, error: e2 } = await supabase.from('coach_habit_logs').select('habit_id, day, done').in('habit_id', habits.map((h) => h.id)).gte('day', since);
  if (e2) fail(e2);
  return { habits, logs: (logs ?? []) as HabitLog[] };
}

export async function addHabit(coachId: string, athleteId: string, title: string): Promise<void> {
  const { error } = await supabase.from('coach_habits').insert({ coach_id: coachId, athlete_id: athleteId, title: title.trim().slice(0, 80), active: true });
  if (error) fail(error);
}

export async function archiveHabit(id: string): Promise<void> {
  const { error } = await supabase.from('coach_habits').update({ active: false }).eq('id', id);
  if (error) fail(error);
}

export async function setHabitDone(habitId: string, athleteId: string, day: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('coach_habit_logs').upsert({ habit_id: habitId, athlete_id: athleteId, day, done, updated_at: new Date().toISOString() }, { onConflict: 'habit_id,day' });
  if (error) fail(error);
}

// ---------------- links ----------------

export interface CoachCard {
  coach_id: string;
  display_name: string | null;
  brand_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export async function coachPreview(code: string): Promise<CoachCard | null> {
  const { data, error } = await supabase.rpc('coach_preview', { code });
  if (error) fail(error);
  return ((data as CoachCard[] | null) ?? [])[0] ?? null;
}

export async function joinCoach(code: string): Promise<void> {
  const { error } = await supabase.rpc('join_coach', { code });
  if (error) fail(error);
}

/** The athlete leaves (other = null) or the coach removes an athlete (other = athlete id). */
export async function endCoachLink(other: string | null): Promise<void> {
  const { error } = await supabase.rpc('end_coach_link', { other });
  if (error) fail(error);
}

export interface MyCoach extends CoachCard {
  joined_at: string;
  unread: number;
  checkin_day: number;
}

export async function fetchMyCoach(): Promise<MyCoach | null> {
  const { data, error } = await supabase.rpc('my_coach_info');
  if (error) fail(error);
  return ((data as MyCoach[] | null) ?? [])[0] ?? null;
}

export async function fetchRoster(): Promise<RosterRow[]> {
  const { data, error } = await supabase.rpc('coach_roster');
  if (error) fail(error);
  return ((data as RosterRow[] | null) ?? []).map((r) => ({
    ...r,
    workouts_7d: Number(r.workouts_7d ?? 0),
    workouts_28d: Number(r.workouts_28d ?? 0),
    food_days_7d: Number(r.food_days_7d ?? 0),
    kcal_today: Number(r.kcal_today ?? 0),
    protein_today: Number(r.protein_today ?? 0),
    unread: Number(r.unread ?? 0),
    pending_checkins: Number(r.pending_checkins ?? 0),
  }));
}

// ---------------- one athlete (coach side) ----------------

export interface SetLog { exercise_name: string | null; set_number: number; reps: number | null; weight: number | null; completed: boolean; rir: number | null }
export interface SessionRow { id: string; plan_name: string | null; completed_at: string | null; duration_seconds: number | null; total_sets: number | null; total_volume: number | null; session_rpe: number | null; notes: string | null; status: string; sets: SetLog[] }
export interface MealRow { id: string; name: string; kcal: number; protein: number; carbs_g: number | null; fat_g: number | null; logged_date: string; meal_slot: string | null }
export interface WeightRow { date: string; kg: number }
export interface PlanExerciseRow { id: string; exercise_id: string; exercise_order: number; sets: number; reps: string; rest_seconds: number | null; day_index: number; day_label: string | null; notes: string | null; rir_target: number | null; name: string }
export interface ActivePlan { id: string; name: string; source: string | null; assigned_at: string; exercises: PlanExerciseRow[] }
export interface DailyCheckinRow { date: string; sleep_hours: number | null; stress: number | null; energy: number | null; mood: number | null; hrv: number | null }

export interface AthleteDetail {
  sessions: SessionRow[];
  meals: MealRow[];
  weights: WeightRow[];
  settings: Record<string, unknown> | null;
  plan: ActivePlan | null;
  daily: DailyCheckinRow[];
}

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function loadAthleteDetail(athleteId: string, now = new Date()): Promise<AthleteDetail> {
  const since28 = new Date(now.getTime() - 28 * 86400000).toISOString();
  const since14 = isoDate(new Date(now.getTime() - 13 * 86400000));
  const since120 = new Date(now.getTime() - 120 * 86400000).toISOString();
  const [sessRes, mealRes, weightRes, settingsRes, assignRes, dailyRes] = await Promise.all([
    supabase.from('workout_sessions').select('id, plan_name, completed_at, duration_seconds, total_sets, total_volume, session_rpe, notes, status')
      .eq('user_id', athleteId).eq('status', 'completed').gte('completed_at', since28).order('completed_at', { ascending: false }).limit(40),
    supabase.from('meal_logs').select('id, name, kcal, protein, carbs_g, fat_g, logged_date, meal_slot').eq('user_id', athleteId).gte('logged_date', since14).order('logged_date', { ascending: false }).limit(400),
    supabase.from('body_measurements').select('weight_kg, recorded_at').eq('user_id', athleteId).gte('recorded_at', since120).order('recorded_at', { ascending: true }).limit(200),
    supabase.from('nutrition_settings').select('*').eq('user_id', athleteId).maybeSingle(),
    supabase.from('user_plan_assignments').select('plan_id, assigned_at').eq('user_id', athleteId).is('completed_at', null).order('assigned_at', { ascending: false }).limit(1),
    supabase.from('daily_checkins').select('checkin_date, sleep_hours, stress, wellness_energy, wellness_mood, hrv_ms').eq('user_id', athleteId).gte('checkin_date', since14).order('checkin_date', { ascending: false }).limit(14),
  ]);

  const sessions = ((sessRes.data ?? []) as Omit<SessionRow, 'sets'>[]).map((s) => ({ ...s, sets: [] as SetLog[] }));
  if (sessions.length) {
    const { data: logs } = await supabase.from('workout_set_logs').select('session_id, exercise_name, set_number, reps, weight, completed, rir')
      .in('session_id', sessions.slice(0, 12).map((s) => s.id)).order('set_number');
    for (const l of (logs ?? []) as (SetLog & { session_id: string })[]) sessions.find((s) => s.id === l.session_id)?.sets.push(l);
  }

  let plan: ActivePlan | null = null;
  const assign = ((assignRes.data ?? []) as { plan_id: string; assigned_at: string }[])[0];
  if (assign) {
    const [{ data: p }, { data: ex }] = await Promise.all([
      supabase.from('workout_plans').select('id, name, source').eq('id', assign.plan_id).maybeSingle(),
      supabase.from('workout_plan_exercises').select('id, exercise_id, exercise_order, sets, reps, rest_seconds, day_index, day_label, notes, rir_target, exercise:exercises(name)')
        .eq('plan_id', assign.plan_id).order('day_index').order('exercise_order'),
    ]);
    if (p) {
      plan = {
        id: (p as { id: string }).id,
        name: (p as { name: string }).name,
        source: (p as { source: string | null }).source,
        assigned_at: assign.assigned_at,
        exercises: ((ex ?? []) as (Omit<PlanExerciseRow, 'name'> & { exercise: { name?: string } | null })[]).map((e) => ({ ...e, name: e.exercise?.name ?? '—' })),
      };
    }
  }

  const daily = ((dailyRes.data ?? []) as Record<string, unknown>[]).map((d) => ({
    date: String(d.checkin_date ?? ''),
    sleep_hours: d.sleep_hours != null ? Number(d.sleep_hours) : null,
    stress: (d.stress as number | null) ?? null,
    energy: (d.wellness_energy as number | null) ?? null,
    mood: (d.wellness_mood as number | null) ?? null,
    hrv: (d.hrv_ms as number | null) ?? null,
  }));

  return {
    sessions,
    meals: (mealRes.data ?? []) as MealRow[],
    weights: ((weightRes.data ?? []) as { weight_kg: number | null; recorded_at: string }[])
      .filter((w) => w.weight_kg != null)
      .map((w) => ({ date: w.recorded_at.slice(0, 10), kg: Number(w.weight_kg) })),
    settings: (settingsRes.data as Record<string, unknown> | null) ?? null,
    plan,
    daily,
  };
}

export async function setAthleteTargets(athlete: string, t: { mode: string; rate: number; kcal: number | null; proteinPerKg: number | null }): Promise<void> {
  const { error } = await supabase.rpc('coach_set_targets', { athlete, mode: t.mode, rate: t.rate, kcal: t.kcal, protein_per_kg: t.proteinPerKg });
  if (error) fail(error);
}

export async function assignPlan(athlete: string, sourcePlan: string): Promise<void> {
  const { error } = await supabase.rpc('coach_assign_plan', { athlete, source_plan: sourcePlan });
  if (error) fail(error);
}

export async function updatePlanExercise(rowId: string, p: { sets: number | null; reps: string | null; rest: number | null; notes: string | null }): Promise<void> {
  const { error } = await supabase.rpc('coach_update_plan_exercise', { row_id: rowId, new_sets: p.sets, new_reps: p.reps, new_rest: p.rest, new_notes: p.notes });
  if (error) fail(error);
}

export interface RoutineOption { id: string; name: string; sessions_per_week: number | null; is_public: boolean }

/** Routines the coach can give: their own, plus StartFit's ready-made ones. */
export async function listGivableRoutines(coachId: string): Promise<RoutineOption[]> {
  const [{ data: mine }, { data: ready }] = await Promise.all([
    supabase.from('workout_plans').select('id, name, sessions_per_week, is_public').eq('created_by', coachId).eq('archived', false).order('updated_at', { ascending: false }).limit(50),
    supabase.from('workout_plans').select('id, name, sessions_per_week, is_public').eq('is_public', true).order('name').limit(60),
  ]);
  return [...((mine ?? []) as RoutineOption[]), ...((ready ?? []) as RoutineOption[])];
}

// ---------------- chat ----------------

export interface ChatMessage {
  id: string;
  coach_id: string;
  athlete_id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  audio_path?: string | null;
  audio_seconds?: number | null;
  broadcast_id?: string | null;
  created_at: string;
  read_at: string | null;
}

export async function listMessages(coachId: string, athleteId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase.from('coach_messages').select('*').eq('coach_id', coachId).eq('athlete_id', athleteId)
    .order('created_at', { ascending: false }).limit(150);
  if (error) fail(error);
  return ((data ?? []) as ChatMessage[]).reverse();
}

/** Resizes a photo in the browser (longest side 1600 px, JPEG) so uploads stay small and fast. */
async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

export async function uploadCoachPhoto(coachId: string, athleteId: string, file: File, folder = 'chat'): Promise<string> {
  const blob = await shrinkImage(file);
  const path = `${coachId}/${athleteId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) fail(error);
  return path;
}

export async function sendMessage(m: { coachId: string; athleteId: string; senderId: string; body?: string | null; file?: File | null }): Promise<void> {
  const image_path = m.file ? await uploadCoachPhoto(m.coachId, m.athleteId, m.file) : null;
  const body = m.body?.trim() || null;
  if (!body && !image_path) return;
  const { error } = await supabase.from('coach_messages').insert({ coach_id: m.coachId, athlete_id: m.athleteId, sender_id: m.senderId, body, image_path });
  if (error) fail(error);
}

/** Voice note: uploaded to the private bucket; the body carries a short label so previews and notifications read well. */
export async function sendVoiceNote(m: { coachId: string; athleteId: string; senderId: string; blob: Blob; seconds: number }): Promise<void> {
  const type = m.blob.type.split(';')[0] || 'audio/webm';
  const ext = type.includes('mp4') || type.includes('aac') || type.includes('m4a') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('mpeg') ? 'mp3' : 'webm';
  const path = `${m.coachId}/${m.athleteId}/voice/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, m.blob, { contentType: type, upsert: false });
  if (upErr) fail(upErr);
  const secs = Math.max(1, Math.min(180, Math.round(m.seconds)));
  const label = `🎤 ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const { error } = await supabase.from('coach_messages').insert({ coach_id: m.coachId, athlete_id: m.athleteId, sender_id: m.senderId, body: label, audio_path: path, audio_seconds: secs });
  if (error) fail(error);
}

/** One message to all athletes (athletes = null) or to the chosen ones. Returns how many were sent. */
export async function broadcast(body: string, athletes: string[] | null): Promise<number> {
  const { data, error } = await supabase.rpc('coach_broadcast', { body, athletes });
  if (error) fail(error);
  return Number(data ?? 0);
}

export async function markRead(coachId: string, athleteId: string, me: string): Promise<void> {
  await supabase.from('coach_messages').update({ read_at: new Date().toISOString() })
    .eq('coach_id', coachId).eq('athlete_id', athleteId).neq('sender_id', me).is('read_at', null);
}

const urlCache = new Map<string, { url: string; until: number }>();

/** Private photos are shown through short-lived signed links. */
export async function photoUrl(path: string): Promise<string | null> {
  const hit = urlCache.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const bucket = supabase.storage.from(BUCKET) as unknown as { createSignedUrl?: (p: string, s: number) => Promise<{ data: { signedUrl: string } | null }> };
  if (!bucket.createSignedUrl) return null;
  const { data } = await bucket.createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60000 });
  return data.signedUrl;
}

// ---------------- weekly check-ins ----------------

export interface Checkin {
  id: string;
  coach_id: string;
  athlete_id: string;
  week_of: string;
  sleep: number | null;
  energy: number | null;
  stress: number | null;
  hunger: number | null;
  training_adherence: number | null;
  nutrition_adherence: number | null;
  weight_kg: number | null;
  waist_cm: number | null;
  win: string | null;
  struggle: string | null;
  question: string | null;
  photo_paths: string[];
  /** Answers to the coach's own questions. */
  answers?: { q: string; a: string }[];
  submitted_at: string;
  coach_reply: string | null;
  reviewed_at: string | null;
}

export type CheckinInput = Pick<Checkin, 'sleep' | 'energy' | 'stress' | 'hunger' | 'training_adherence' | 'nutrition_adherence' | 'weight_kg' | 'waist_cm' | 'win' | 'struggle' | 'question' | 'answers'>;

export async function listCheckins(coachId: string, athleteId: string): Promise<Checkin[]> {
  const { data, error } = await supabase.from('coach_checkins').select('*').eq('coach_id', coachId).eq('athlete_id', athleteId)
    .order('week_of', { ascending: false }).limit(26);
  if (error) fail(error);
  return (data ?? []) as Checkin[];
}

export async function submitCheckin(coachId: string, athleteId: string, weekOf: string, input: CheckinInput, photos: File[]): Promise<void> {
  const photo_paths: string[] = [];
  for (const f of photos.slice(0, 3)) photo_paths.push(await uploadCoachPhoto(coachId, athleteId, f, 'checkins'));
  // Editing without new photos keeps the ones already sent.
  const { error } = await supabase.from('coach_checkins').upsert(
    { coach_id: coachId, athlete_id: athleteId, week_of: weekOf, ...input, ...(photo_paths.length ? { photo_paths } : {}), submitted_at: new Date().toISOString() },
    { onConflict: 'athlete_id,coach_id,week_of' },
  );
  if (error) fail(error);
}

export async function reviewCheckin(id: string, reply: string): Promise<void> {
  const { error } = await supabase.rpc('coach_review_checkin', { checkin: id, reply });
  if (error) fail(error);
}

// ---------------- notes and quick replies ----------------

export async function loadNote(coachId: string, athleteId: string): Promise<string> {
  const { data } = await supabase.from('coach_notes').select('body').eq('coach_id', coachId).eq('athlete_id', athleteId).maybeSingle();
  return (data as { body?: string } | null)?.body ?? '';
}

export async function saveNote(coachId: string, athleteId: string, body: string): Promise<void> {
  const { error } = await supabase.from('coach_notes').upsert({ coach_id: coachId, athlete_id: athleteId, body, updated_at: new Date().toISOString() }, { onConflict: 'coach_id,athlete_id' });
  if (error) fail(error);
}

export interface QuickReply { id: string; title: string; body: string }

export async function listReplies(coachId: string): Promise<QuickReply[]> {
  const { data } = await supabase.from('coach_replies').select('id, title, body').eq('coach_id', coachId).order('created_at');
  return (data ?? []) as QuickReply[];
}

export async function addReply(coachId: string, title: string, body: string): Promise<void> {
  const { error } = await supabase.from('coach_replies').insert({ coach_id: coachId, title, body });
  if (error) fail(error);
}

export async function deleteReply(id: string): Promise<void> {
  const { error } = await supabase.from('coach_replies').delete().eq('id', id);
  if (error) fail(error);
}

// ---------------- billing ----------------

export async function startCoachCheckout(tier: 'coach' | 'coach_pro' | 'studio', billing: 'monthly' | 'annual'): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in first.');
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ type: 'coach', tier, billing }),
  });
  const body = await response.json().catch(() => ({})) as { url?: unknown; error?: unknown };
  if (!response.ok || typeof body.url !== 'string') throw new Error(typeof body.error === 'string' ? body.error : 'Unable to start checkout.');
  return body.url;
}

export interface Activity { athlete_id: string; train_dates: string[]; food_dates: string[]; weights: { d: string; kg: number }[] }

export async function fetchRosterActivity(): Promise<Record<string, Activity>> {
  const { data, error } = await supabase.rpc('coach_roster_activity');
  if (error) fail(error);
  const out: Record<string, Activity> = {};
  for (const a of (data ?? []) as Activity[]) out[a.athlete_id] = { ...a, weights: (a.weights ?? []).map((w) => ({ d: String(w.d), kg: Number(w.kg) })) };
  return out;
}
