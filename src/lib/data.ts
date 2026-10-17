import { supabase } from './supabase';
import { reportIfAiConsentMissing } from './consent-events';
import type { MuscleRecoveryState } from './recovery/engine';
import type { ReadinessResult } from './recovery/readiness';
import type {
  Exercise,
  WorkoutPlan,
  WorkoutPlanExercise,
  WorkoutSession,
  WorkoutSetLog,
  SetType,
  AiConversation,
  AiMessage,
  UserGoal,
  BodyMeasurement,
  MealLog,
  WaterLog,
  RecoveryLog,
  RecoveryLogKind,
} from './types';

// ============ EXERCISES ============

const EXERCISE_PAGE = 1000; // PostgREST returns at most 1000 rows per request

export async function fetchExercises(filters?: {
  muscleGroup?: string;
  equipment?: string;
  difficulty?: string;
  search?: string;
  category?: string;
  forceType?: string;
  mechanic?: string;
  pattern?: string;
  /** Include duplicates hidden by the library clean-up (needed to resolve old routines and logs). */
  includeHidden?: boolean;
}): Promise<Exercise[]> {
  const build = () => {
    let query = supabase.from('exercises').select('*').order('name').order('id');
    if (!filters?.includeHidden) query = query.eq('is_hidden', false);
    if (filters?.muscleGroup && filters.muscleGroup !== 'all') {
      query = query.eq('primary_muscle', filters.muscleGroup);
    }
    if (filters?.equipment && filters.equipment !== 'all') {
      query = query.eq('equipment', filters.equipment);
    }
    if (filters?.difficulty && filters.difficulty !== 'all') {
      query = query.eq('difficulty', filters.difficulty);
    }
    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }
    if (filters?.forceType && filters.forceType !== 'all') {
      query = query.eq('force_type', filters.forceType);
    }
    if (filters?.mechanic && filters.mechanic !== 'all') {
      query = query.eq('mechanic', filters.mechanic);
    }
    if (filters?.pattern && filters.pattern !== 'all') {
      query = query.eq('pattern', filters.pattern);
    }
    if (filters?.search) {
      // Strip characters that have meaning in a PostgREST filter expression.
      const term = filters.search.replace(/[%,()*\\]/g, ' ').trim();
      if (term) query = query.or(`name.ilike.%${term}%,aliases.cs.{"${term.replace(/"/g, '')}"}`);
    }
    return query;
  };
  const all: Exercise[] = [];
  // At most 20 pages (20,000 rows) as a safety stop.
  for (let from = 0; from < EXERCISE_PAGE * 20; from += EXERCISE_PAGE) {
    const { data, error } = await build().range(from, from + EXERCISE_PAGE - 1);
    if (error) throw error;
    const rows = (data as Exercise[]) ?? [];
    all.push(...rows);
    if (rows.length < EXERCISE_PAGE) break;
  }
  return all;
}

export async function createCustomExercise(input: {
  name: string;
  primary_muscle: string;
  equipment: string;
  difficulty: string;
  category?: string;
  instructions?: string[];
  description?: string;
  pattern?: string | null;
  muscles_primary?: string[];
  muscles_secondary?: string[];
  equipment_tags?: string[];
}): Promise<Exercise | null> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: input.name,
      primary_muscle: input.primary_muscle,
      equipment: input.equipment,
      difficulty: input.difficulty,
      category: input.category ?? 'strength',
      instructions: input.instructions ?? [],
      description: input.description ?? input.name,
      is_custom: true,
      default_sets: 3,
      default_reps: '10',
      default_rest_seconds: 60,
      access_tier: 'free',
      video_source: 'none',
      pattern: input.pattern ?? null,
      muscles_primary: input.muscles_primary ?? [],
      muscles_secondary: input.muscles_secondary ?? [],
      equipment_tags: input.equipment_tags ?? [],
      taxonomy_source: 'user',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Exercise;
}

export async function fetchExercisesByIds(ids: string[]): Promise<Exercise[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('exercises').select('*').in('id', ids);
  if (error) throw error;
  return (data as Exercise[]) ?? [];
}

export async function fetchExerciseById(id: string): Promise<Exercise | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Exercise | null;
}

// ============ WORKOUT PLANS ============

export async function fetchWorkoutPlans(filters?: {
  goal?: string;
  difficulty?: string;
  search?: string;
}): Promise<WorkoutPlan[]> {
  let query = supabase
    .from('workout_plans')
    .select('*')
    .eq('is_public', true)
    .order('created_at');
  if (filters?.goal && filters.goal !== 'all') {
    query = query.eq('goal', filters.goal);
  }
  if (filters?.difficulty && filters.difficulty !== 'all') {
    query = query.eq('difficulty', filters.difficulty);
  }
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data as WorkoutPlan[]) ?? [];
}

export async function fetchWorkoutPlanById(id: string): Promise<WorkoutPlan | null> {
  const { data, error } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as WorkoutPlan | null;
}

export async function fetchPlanExercises(planId: string): Promise<WorkoutPlanExercise[]> {
  const { data, error } = await supabase
    .from('workout_plan_exercises')
    .select('*, exercise:exercises!workout_plan_exercises_exercise_id_fkey(*)')
    .eq('plan_id', planId)
    .order('exercise_order');
  if (error) throw error;
  return (data as WorkoutPlanExercise[]) ?? [];
}

export async function assignPlanToUser(planId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_plan_assignments')
    .insert({ plan_id: planId });
  if (error) {
    if (error.code === '23505') return { error: null };
    return { error: error.message };
  }
  return { error: null };
}

// ============ WORKOUT SESSIONS ============

export async function createWorkoutSession(
  planId: string | null,
  planName: string | null,
  planDay: number | null = null
): Promise<WorkoutSession | null> {
  const row: Record<string, unknown> = {
    plan_id: planId,
    plan_name: planName,
    started_at: new Date().toISOString(),
  };
  if (planDay != null) row.plan_day = planDay;
  let { data, error } = await supabase.from('workout_sessions').insert(row).select('*').single();
  // Before the training-brain migration the plan_day column does not exist yet: save without it.
  if (error && planDay != null && /plan_day/.test(`${error.message} ${error.details ?? ''}`)) {
    delete row.plan_day;
    ({ data, error } = await supabase.from('workout_sessions').insert(row).select('*').single());
  }
  if (error) throw error;
  return data as WorkoutSession;
}

/** The routine day to train next: the one after the last completed session of this routine. */
/**
 * The routine day after the last one completed. `relatedPlanIds` are the gym/home versions of the same
 * routine (same days), so switching between them carries on in order instead of starting again.
 */
export async function nextRoutineDay(planId: string, dayIndexes: number[], relatedPlanIds: string[] = []): Promise<number> {
  const sorted = [...dayIndexes].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('plan_day, completed_at')
    .in('plan_id', [planId, ...relatedPlanIds])
    .eq('status', 'completed')
    .not('plan_day', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return sorted[0];
  const last = Number((data[0] as { plan_day: number }).plan_day);
  return sorted.find((d) => d > last) ?? sorted[0];
}

export async function completeWorkoutSession(
  sessionId: string,
  durationSeconds: number,
  totalSets: number,
  totalReps: number,
  exercisesCompleted: number,
  notes?: string,
  totalVolume?: number
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('workout_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      total_sets: totalSets,
      total_reps: totalReps,
      exercises_completed: exercisesCompleted,
      total_volume: totalVolume ?? 0,
      notes: notes ?? null,
    })
    .eq('id', sessionId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function abandonWorkoutSession(sessionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('workout_sessions')
    .update({ status: 'abandoned', abandoned_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function saveSetLog(
  sessionId: string,
  exerciseId: string,
  exerciseName: string,
  setNumber: number,
  reps: number,
  weight: number | null,
  completed: boolean,
  setType: SetType | null = null,
  rir: number | null = null,
  notes: string | null = null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('workout_set_logs')
    .upsert({
      session_id: sessionId,
      exercise_id: exerciseId,
      exercise_name: exerciseName,
      set_number: setNumber,
      reps,
      weight,
      completed,
      set_type: setType,
      rir,
      notes,
    }, { onConflict: 'session_id,exercise_id,set_number' });
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateSetLog(
  sessionId: string,
  exerciseId: string,
  setNumber: number,
  fields: { reps?: number; weight?: number | null; set_type?: SetType | null; rir?: number | null; notes?: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('workout_set_logs')
    .update(fields)
    .eq('session_id', sessionId)
    .eq('exercise_id', exerciseId)
    .eq('set_number', setNumber);
  if (error) return { error: error.message };
  return { error: null };
}

export async function fetchUserSessions(limit?: number): Promise<WorkoutSession[]> {
  let query = supabase
    .from('workout_sessions')
    .select('*')
    .order('started_at', { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data as WorkoutSession[]) ?? [];
}

export async function fetchActiveSession(planId: string | null): Promise<WorkoutSession | null> {
  let query = supabase
    .from('workout_sessions')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1);
  if (planId) {
    query = query.eq('plan_id', planId);
  } else {
    query = query.is('plan_id', null);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data?.[0] as WorkoutSession) ?? null;
}

export async function fetchSessionById(id: string): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as WorkoutSession | null;
}

export async function fetchSessionSetLogs(sessionId: string): Promise<WorkoutSetLog[]> {
  const { data, error } = await supabase
    .from('workout_set_logs')
    .select('*')
    .eq('session_id', sessionId)
    .order('set_number');
  if (error) throw error;
  return (data as WorkoutSetLog[]) ?? [];
}

// ============ AI CONVERSATIONS ============

export async function fetchAllUserSetLogs(): Promise<WorkoutSetLog[]> {
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id')
    .order('completed_at', { ascending: false }, )
    .limit(50);
  if (!sessions || sessions.length === 0) return [];
  const sessionIds = sessions.map((s) => s.id);
  const { data, error } = await supabase
    .from('workout_set_logs')
    .select('*')
    .in('session_id', sessionIds)
    .order('set_number');
  if (error) throw error;
  return (data as WorkoutSetLog[]) ?? [];
}

export async function fetchConversations(): Promise<AiConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as AiConversation[]) ?? [];
}

export async function createConversation(title: string): Promise<AiConversation | null> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ title })
    .select('*')
    .single();
  if (error) throw error;
  return data as AiConversation;
}

export async function fetchMessages(conversationId: string): Promise<AiMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as AiMessage[]) ?? [];
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('ai_messages')
    .insert({ conversation_id: conversationId, role, content });
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteConversation(conversationId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId);
  if (error) return { error: error.message };
  return { error: null };
}

// ============ AI REQUEST ============

export interface AiResponse {
  reply: string;
  error?: string;
  limitReached?: boolean;
  limit?: number;
  tier?: string;
  upgradeText?: string;
}

export async function sendAiMessage(
  conversationId: string,
  message: string,
  history: AiMessage[]
): Promise<AiResponse> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const session = await supabase.auth.getSession();
  if (session.data.session) {
    headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
  } else {
    headers['Authorization'] = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, message, history }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    reportIfAiConsentMissing(response.status, errorBody);
    if (errorBody.error === 'ai_consent_required') return { reply: '', error: errorBody.message ?? 'AI coaches are switched off.' };
    if (response.status === 429 && errorBody.error === 'daily_limit_reached') {
      return {
        reply: '',
        error: 'daily_limit_reached',
        limitReached: true,
        limit: errorBody.limit,
        tier: errorBody.tier,
        upgradeText: errorBody.upgrade_text,
      };
    }
    return { reply: '', error: errorBody.error ?? `Request failed (${response.status})` };
  }

  const data = await response.json();
  if (!data.reply) {
    return { reply: '', error: data.error ?? 'No reply received from AI Coach' };
  }
  return { reply: data.reply };
}

export interface RecoveryDoctorReport {
  summary: string;
  actions: string[];
  limitations: string[];
  sources: { id: string; citation: string }[];
  facts: MuscleRecoveryState;
  readiness: ReadinessResult;
}

export async function generateRecoveryDoctorReport(input: {
  selectedMuscle: string;
  muscleState: MuscleRecoveryState;
  readiness: ReadinessResult;
  evidenceIds: string[];
}): Promise<RecoveryDoctorReport> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Authentication required');
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recovery-doctor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({})) as { report?: RecoveryDoctorReport; error?: string };
  reportIfAiConsentMissing(response.status, body);
  if (!response.ok || !body.report) throw new Error(body.error ?? 'Recovery interpretation unavailable');
  return body.report;
}

// ============ STRIPE CHECKOUT ============

export async function createCheckoutSession(
  tier: 'pro' | 'plus',
  billing: 'weekly' | 'monthly' | 'annual'
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in before upgrading.');

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ tier, billing }),
  });
  const body = await response.json().catch(() => ({})) as { url?: unknown; error?: unknown };
  if (!response.ok || typeof body.url !== 'string') {
    throw new Error(typeof body.error === 'string' ? body.error : 'Unable to start checkout.');
  }
  return body.url;
}

export async function createDailyPassCheckout(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in first.');

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ type: 'daily' }),
  });
  const body = await response.json().catch(() => ({})) as { url?: unknown; error?: unknown };
  if (!response.ok || typeof body.url !== 'string') {
    throw new Error(typeof body.error === 'string' ? body.error : 'Unable to start checkout.');
  }
  return body.url;
}

export async function createBlueprintCheckout(blueprintId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in first.');

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blueprint-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ blueprintId }),
  });
  const body = await response.json().catch(() => ({})) as { url?: unknown; error?: unknown };
  if (!response.ok || typeof body.url !== 'string') {
    throw new Error(typeof body.error === 'string' ? body.error : 'Unable to start checkout.');
  }
  return body.url;
}

export async function createBillingPortalSession(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in first.');

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing-portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  const body = await response.json().catch(() => ({})) as { url?: unknown; error?: unknown };
  if (!response.ok || typeof body.url !== 'string') {
    throw new Error(typeof body.error === 'string' ? body.error : 'Unable to open billing portal.');
  }
  return body.url;
}

// ============ USER GOALS ============

export async function fetchUserGoals(): Promise<UserGoal[]> {
  const { data, error } = await supabase
    .from('user_goals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as UserGoal[]) ?? [];
}

export async function createUserGoal(
  title: string,
  targetValue: number | null,
  unit: string | null,
  deadline: string | null
): Promise<UserGoal | null> {
  const { data, error } = await supabase
    .from('user_goals')
    .insert({ title, target_value: targetValue, unit, deadline })
    .select('*')
    .single();
  if (error) throw error;
  return data as UserGoal;
}

export async function updateUserGoal(
  id: string,
  updates: Partial<Pick<UserGoal, 'title' | 'target_value' | 'current_value' | 'unit' | 'deadline' | 'is_completed'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_goals').update(updates).eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteUserGoal(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_goals').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

// ============ BODY MEASUREMENTS ============

export async function fetchBodyMeasurements(): Promise<BodyMeasurement[]> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .order('recorded_at', { ascending: false });
  if (error) throw error;
  return (data as BodyMeasurement[]) ?? [];
}

export async function createBodyMeasurement(
  measurement: Omit<BodyMeasurement, 'id' | 'user_id' | 'created_at' | 'recorded_at'>
): Promise<BodyMeasurement | null> {
  const { data, error } = await supabase
    .from('body_measurements')
    .insert(measurement)
    .select('*')
    .single();
  if (error) throw error;
  return data as BodyMeasurement;
}

export async function deleteBodyMeasurement(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('body_measurements').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

// ============ MEAL LOGS ============

export async function fetchMealLogs(date?: string): Promise<MealLog[]> {
  let query = supabase.from('meal_logs').select('*').order('created_at', { ascending: false });
  if (date) query = query.eq('logged_date', date);
  const { data, error } = await query;
  if (error) throw error;
  return (data as MealLog[]) ?? [];
}

export async function createMealLog(
  name: string,
  kcal: number,
  protein: number,
  carbs?: number,
  fat?: number
): Promise<MealLog | null> {
  const { data, error } = await supabase
    .from('meal_logs')
    .insert({ name, kcal, protein, carbs_g: carbs ?? 0, fat_g: fat ?? 0 })
    .select('*')
    .single();
  if (error) throw error;
  return data as MealLog;
}

export async function deleteMealLog(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('meal_logs').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

// ============ WATER LOGS ============

export async function fetchWaterLogs(date?: string): Promise<WaterLog[]> {
  let query = supabase.from('water_logs').select('*').order('created_at', { ascending: false });
  if (date) query = query.eq('logged_date', date);
  const { data, error } = await query;
  if (error) throw error;
  return (data as WaterLog[]) ?? [];
}

export async function addWaterLog(ml: number): Promise<WaterLog | null> {
  const { data, error } = await supabase
    .from('water_logs')
    .insert({ ml })
    .select('*')
    .single();
  if (error) throw error;
  return data as WaterLog;
}

export async function deleteWaterLog(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('water_logs').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function fetchRecoveryLogs(limit = 100): Promise<RecoveryLog[]> {
  const { data, error } = await supabase
    .from('recovery_logs')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as RecoveryLog[]) ?? [];
}

export async function createRecoveryLog(input: {
  kind: RecoveryLogKind;
  value?: number | null;
  muscle?: string | null;
  note?: string | null;
  metadata?: Record<string, string | number | boolean>;
  recordedAt?: string;
}): Promise<RecoveryLog> {
  const { data, error } = await supabase
    .from('recovery_logs')
    .insert({
      kind: input.kind,
      value: input.value ?? null,
      muscle: input.muscle ?? null,
      note: input.note ?? null,
      metadata: input.metadata ?? {},
      recorded_at: input.recordedAt ?? new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as RecoveryLog;
}

export async function updateRecoveryLog(
  id: string,
  updates: Partial<Pick<RecoveryLog, 'value' | 'muscle' | 'note' | 'metadata' | 'recorded_at'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('recovery_logs').update(updates).eq('id', id);
  if (error) return { error: 'Could not update recovery record.' };
  return { error: null };
}

export async function deleteRecoveryLog(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('recovery_logs').delete().eq('id', id);
  if (error) return { error: 'Could not remove recovery record.' };
  return { error: null };
}
