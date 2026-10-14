import { supabase } from '../supabase';
import type { RecoveryMuscle } from './muscles';
import { RECOVERY_MUSCLES } from './muscles';
import { mapExerciseToMuscles, mapExerciseFromPersistedMuscles, computeMuscleRecovery } from './engine';
import type { MuscleRecoveryState, ExerciseMuscleMapping, SetLogForRecovery, SorenessEntry, SleepEntry } from './engine';
import { computeReadiness, computeACWR, estimate1RM } from './readiness';
import type { ReadinessResult, AcwrResult, PerformanceCheck } from './readiness';
import type { Exercise, WorkoutSetLog } from '../types';

export interface DailyCheckin {
  id: string;
  user_id: string;
  checkin_date: string;
  sleep_hours: number | null;
  hydration_l: number | null;
  stress: number | null;
  resting_hr: number | null;
  resting_hr_bpm?: number | null;
  hr_verified?: boolean;
  sleep_source?: 'manual' | 'device' | null;
  hrv_source?: 'manual' | 'wearable' | null;
  hrv_ms: number | null;
  body_weight: number | null;
  protein_g: number | null;
  soreness?: Record<string, number>;
  wellness_sleep?: number | null;
  wellness_energy?: number | null;
  wellness_soreness?: number | null;
  wellness_stress?: number | null;
  wellness_mood?: number | null;
  wellness_at?: string | null;
}

export interface SorenessLog {
  id: string;
  user_id: string;
  muscle: string;
  soreness_score: number;
  recorded_at: string;
}

export interface PainLog {
  id: string;
  user_id: string;
  body_area: string;
  onset: string | null;
  pain_type: string | null;
  severity: number;
  during_exercise: boolean | null;
  swelling: boolean;
  bruising: boolean;
  rom_loss: boolean;
  duration_hours: number | null;
  notes: string | null;
  triage_level: 'green' | 'yellow' | 'red';
  recorded_at: string;
}

export interface RecoveryProfileEntry {
  id: string;
  user_id: string;
  muscle: string;
  personal_multiplier: number;
  sample_size: number;
  confidence: string;
  manually_overridden: boolean;
}

// ============ FETCH ============

export interface RecoverySession {
  id: string;
  completed_at: string;
  started_at: string;
  duration_seconds: number;
  total_sets: number;
  total_volume: number | null;
  plan_id: string | null;
  plan_name: string | null;
  plan_day?: number | null;
  session_rpe?: number | null;
}

const PAGE = 1000;

/** Completed sessions of the last `days` days, newest first. */
export async function fetchRecentSessions(days = 120): Promise<RecoverySession[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const out: RecoverySession[] = [];
  for (let from = 0; from < PAGE * 5; from += PAGE) {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .not('completed_at', 'is', null)
      .gte('completed_at', since)
      .order('completed_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data as RecoverySession[]) ?? [];
    out.push(...rows.filter((r) => (r as { status?: string }).status !== 'abandoned'));
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Every set log of the given sessions (fetched in chunks and pages, so nothing is cut off at 1000 rows). */
export async function fetchSetLogsForSessions(sessionIds: string[]): Promise<WorkoutSetLog[]> {
  const out: WorkoutSetLog[] = [];
  for (let i = 0; i < sessionIds.length; i += 60) {
    const chunk = sessionIds.slice(i, i + 60);
    for (let from = 0; from < PAGE * 10; from += PAGE) {
      const { data, error } = await supabase
        .from('workout_set_logs')
        .select('*')
        .in('session_id', chunk)
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data as WorkoutSetLog[]) ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
  }
  return out;
}

/** Kept for older callers: set logs of the most recent completed sessions. */
export async function fetchAllSetLogsForRecovery(limit = 200): Promise<WorkoutSetLog[]> {
  const sessions = await fetchRecentSessions(365);
  return fetchSetLogsForSessions(sessions.slice(0, limit).map((s) => s.id));
}

/** The exercises referenced by the logs (and only those). */
export async function fetchExercisesForMapping(ids?: string[]): Promise<Exercise[]> {
  if (!ids) {
    const all: Exercise[] = [];
    for (let from = 0; from < PAGE * 20; from += PAGE) {
      const { data, error } = await supabase.from('exercises').select('*').order('id').range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data as Exercise[]) ?? [];
      all.push(...rows);
      if (rows.length < PAGE) break;
    }
    return all;
  }
  const out: Exercise[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 150) {
    const { data, error } = await supabase.from('exercises').select('*').in('id', unique.slice(i, i + 150));
    if (error) throw error;
    out.push(...((data as Exercise[]) ?? []));
  }
  return out;
}

export async function fetchDailyCheckins(limit = 30): Promise<DailyCheckin[]> {
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .order('checkin_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as DailyCheckin[]) ?? [];
}

export async function fetchTodayCheckin(): Promise<DailyCheckin | null> {
  const today = localDateKey(new Date());
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('checkin_date', today)
    .maybeSingle();
  if (error) throw error;
  return data as DailyCheckin | null;
}

export async function fetchSorenessLogs(limit = 100): Promise<SorenessLog[]> {
  const { data, error } = await supabase
    .from('soreness_logs')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as SorenessLog[]) ?? [];
}

export async function fetchPainLogs(limit = 50): Promise<PainLog[]> {
  const { data, error } = await supabase
    .from('pain_logs')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as PainLog[]) ?? [];
}

export async function fetchRecoveryProfile(): Promise<RecoveryProfileEntry[]> {
  const { data, error } = await supabase
    .from('recovery_profile')
    .select('*')
    .order('muscle');
  if (error) throw error;
  return (data as RecoveryProfileEntry[]) ?? [];
}

export async function fetchSessionsForACWR(): Promise<{ date: string; totalSets: number }[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('completed_at, total_sets')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []).map((s: { completed_at: string; total_sets: number }) => ({
    date: s.completed_at,
    totalSets: s.total_sets ?? 0,
  }));
}

// ============ WRITE ============

export async function upsertDailyCheckin(input: Partial<DailyCheckin>): Promise<DailyCheckin | null> {
  const today = localDateKey(new Date());
  const { data, error } = await supabase
    .from('daily_checkins')
    .upsert({
      checkin_date: today,
      sleep_hours: input.sleep_hours ?? null,
      hydration_l: input.hydration_l ?? null,
      stress: input.stress ?? null,
      resting_hr: input.resting_hr ?? null,
      resting_hr_bpm: input.resting_hr_bpm ?? input.resting_hr ?? null,
      hr_verified: input.hr_verified ?? false,
      sleep_source: input.sleep_source ?? null,
      hrv_source: input.hrv_source ?? null,
      hrv_ms: input.hrv_ms ?? null,
      body_weight: input.body_weight ?? null,
      protein_g: input.protein_g ?? null,
      soreness: input.soreness ?? {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,checkin_date' })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as DailyCheckin | null;
}

export async function createSorenessLog(muscle: string, score: number): Promise<SorenessLog | null> {
  const { data, error } = await supabase
    .from('soreness_logs')
    .insert({ muscle, soreness_score: score })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as SorenessLog | null;
}

export async function createPainLog(input: Omit<PainLog, 'id' | 'user_id' | 'recorded_at' | 'created_at'>): Promise<PainLog | null> {
  const { data, error } = await supabase
    .from('pain_logs')
    .insert(input)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as PainLog | null;
}

export async function deletePainLog(id: string): Promise<void> {
  const { error } = await supabase.from('pain_logs').delete().eq('id', id);
  if (error) throw error;
}

export async function updateRecoveryProfileEntry(muscle: string, multiplier: number): Promise<void> {
  const { error } = await supabase
    .from('recovery_profile')
    .upsert({
      muscle,
      personal_multiplier: multiplier,
      manually_overridden: true,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function resetRecoveryProfileEntry(muscle: string): Promise<void> {
  const { error } = await supabase
    .from('recovery_profile')
    .delete()
    .eq('muscle', muscle);
  if (error) throw error;
}

// ============ AGGREGATE COMPUTATION ============

export interface FullRecoveryData {
  muscleStates: MuscleRecoveryState[];
  readiness: ReadinessResult;
  acwr: AcwrResult;
  performanceChecks: PerformanceCheck[];
  todayCheckin: DailyCheckin | null;
  sorenessLogs: SorenessLog[];
  painLogs: PainLog[];
  recoveryProfile: RecoveryProfileEntry[];
  sleepHistory: SleepEntry[];
  /** Raw inputs, shared with the recovery doctor analytics so everything uses one fetch. */
  sessions: RecoverySession[];
  setLogs: SetLogForRecovery[];
  checkins: DailyCheckin[];
  exerciseMappings: Map<string, ExerciseMuscleMapping>;
  exercises: Exercise[];
}

/** Muscle mapping for one exercise: the library's muscles first, then the stored table, then the coarse fallback. */
export function mappingForExercise(ex: Exercise, persisted?: { muscle: RecoveryMuscle; contribution: number }[]): ExerciseMuscleMapping {
  const primary = (ex.muscles_primary ?? []).filter(isRecoveryMuscle) as RecoveryMuscle[];
  const secondary = (ex.muscles_secondary ?? []).filter(isRecoveryMuscle) as RecoveryMuscle[];
  const nonVolume = ex.pattern === 'mobility' || ex.pattern === 'balance';
  if (nonVolume) return mapExerciseFromPersistedMuscles(ex.id, ex.name, []);
  if (primary.length || secondary.length) {
    return mapExerciseFromPersistedMuscles(ex.id, ex.name, [
      ...primary.map((muscle) => ({ muscle, contribution: 1 })),
      ...secondary.filter((m) => !primary.includes(m)).map((muscle) => ({ muscle, contribution: 0.5 })),
    ]);
  }
  if (persisted && persisted.length) return mapExerciseFromPersistedMuscles(ex.id, ex.name, persisted);
  return mapExerciseToMuscles(ex.id, ex.name, ex.primary_muscle, ex.secondary_muscles as string[] | null);
}

export async function fetchFullRecoveryData(now = new Date()): Promise<FullRecoveryData> {
  const [sessions, checkins, sorenessLogs, painLogs, recoveryProfile] = await Promise.all([
    fetchRecentSessions(120),
    fetchDailyCheckins(120),
    fetchSorenessLogs(),
    fetchPainLogs(),
    fetchRecoveryProfile().catch(() => [] as RecoveryProfileEntry[]),
  ]);

  const setLogs = await fetchSetLogsForSessions(sessions.map((s) => s.id));
  const exercises = await fetchExercisesForMapping(setLogs.map((l) => l.exercise_id));

  // Stored mappings only for exercises without library muscle data (older custom exercises).
  const needPersisted = exercises.filter((ex) => !(ex.muscles_primary?.length || ex.muscles_secondary?.length)).map((ex) => ex.id);
  const mappingsByExercise = new Map<string, { muscle: RecoveryMuscle; contribution: number }[]>();
  for (let i = 0; i < needPersisted.length; i += 150) {
    const { data: persisted, error: mappingError } = await supabase
      .from('exercise_muscles')
      .select('exercise_id, muscle, contribution')
      .in('exercise_id', needPersisted.slice(i, i + 150));
    if (mappingError) break;
    for (const row of persisted ?? []) {
      if (!isRecoveryMuscle(row.muscle)) continue;
      const existing = mappingsByExercise.get(row.exercise_id) ?? [];
      existing.push({ muscle: row.muscle as RecoveryMuscle, contribution: Number(row.contribution) });
      mappingsByExercise.set(row.exercise_id, existing);
    }
  }

  const exerciseMappings = new Map<string, ExerciseMuscleMapping>();
  for (const ex of exercises) exerciseMappings.set(ex.id, mappingForExercise(ex, mappingsByExercise.get(ex.id)));

  const sessionIdToCompletedAt = new Map<string, string>();
  for (const s of sessions) if (s.completed_at) sessionIdToCompletedAt.set(s.id, s.completed_at);

  const setLogsWithDate: SetLogForRecovery[] = setLogs.map((log) => ({
    exercise_id: log.exercise_id,
    exercise_name: log.exercise_name,
    set_type: log.set_type,
    rir: log.rir,
    weight: log.weight,
    reps: log.reps,
    completed: log.completed,
    session_id: log.session_id,
    session_completed_at: sessionIdToCompletedAt.get(log.session_id) ?? null,
  }));

  // Soreness on a 0-10 scale, from soreness_logs and the check-in snapshot
  const sorenessEntries: SorenessEntry[] = sorenessLogs
    .filter((s) => isRecoveryMuscle(s.muscle))
    .map((s) => ({ muscle: s.muscle as RecoveryMuscle, score: s.soreness_score, recordedAt: s.recorded_at }));
  for (const c of checkins) {
    if (!c.soreness) continue;
    for (const [muscle, score] of Object.entries(c.soreness)) {
      if (isRecoveryMuscle(muscle)) sorenessEntries.push({ muscle: muscle as RecoveryMuscle, score, recordedAt: `${c.checkin_date}T08:00:00` });
    }
  }

  const sleepEntries: SleepEntry[] = checkins
    .filter((c): c is DailyCheckin & { sleep_hours: number } => c.sleep_hours != null)
    .map((c) => ({ date: c.checkin_date, sleepHours: c.sleep_hours }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const personalMultipliers: Record<string, number> = {};
  for (const rp of recoveryProfile) personalMultipliers[rp.muscle] = rp.personal_multiplier;

  const muscleStates = computeMuscleRecovery({
    setLogs: setLogsWithDate,
    exerciseMappings,
    soreness: sorenessEntries,
    sleep: sleepEntries,
    personalMultipliers,
    now,
  });

  const todayKey = localDateKey(now);
  const todayCheckin = checkins.find((c) => c.checkin_date === todayKey) ?? null;
  const latestCheckin = checkins[0] ?? null;

  const latestSorenessByMuscle = new Map<string, SorenessEntry>();
  for (const s of sorenessEntries) {
    const existing = latestSorenessByMuscle.get(s.muscle);
    if (!existing || new Date(s.recordedAt) > new Date(existing.recordedAt)) latestSorenessByMuscle.set(s.muscle, s);
  }
  // Only soreness reported in the last 48 hours counts for today's readiness.
  const latestSoreness = Array.from(latestSorenessByMuscle.values())
    .filter((s) => now.getTime() - new Date(s.recordedAt).getTime() <= 48 * 3600 * 1000)
    .map((s) => ({ muscle: s.muscle, score: s.score }));

  const baselineHR = computeBaselineHR(checkins);
  const performanceChecks = computePerformanceChecksFromLogs(setLogsWithDate, exerciseMappings, muscleStates);

  const readiness = computeReadiness({
    muscleStates,
    latestCheckin: latestCheckin ? {
      checkinDate: latestCheckin.checkin_date,
      sleepHours: latestCheckin.sleep_hours,
      hydrationL: latestCheckin.hydration_l,
      stress: latestCheckin.stress,
      restingHr: latestCheckin.resting_hr,
      hrvMs: latestCheckin.hrv_ms,
      bodyWeight: latestCheckin.body_weight,
      proteinG: latestCheckin.protein_g,
    } : null,
    latestSoreness,
    baselineHR,
    performanceChecks,
    sleep: sleepEntries,
  });

  const acwr = computeACWR(sessions.map((s) => ({ date: s.completed_at, totalSets: s.total_sets ?? 0 })), now);

  return {
    muscleStates,
    readiness,
    acwr,
    performanceChecks,
    todayCheckin,
    sorenessLogs,
    painLogs,
    recoveryProfile,
    sleepHistory: sleepEntries,
    sessions,
    setLogs: setLogsWithDate,
    checkins,
    exerciseMappings,
    exercises,
  };
}

export function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isRecoveryMuscle(s: string): boolean {
  return (RECOVERY_MUSCLES as string[]).includes(s);
}

function computeBaselineHR(checkins: DailyCheckin[]): { restingHr: number; hrvMs: number; sampleDays: number } | null {
  const withHR = checkins.filter((c) => c.resting_hr != null && c.hrv_ms != null);
  if (withHR.length < 3) return null;
  const avgHr = withHR.reduce((sum, c) => sum + (c.resting_hr ?? 0), 0) / withHR.length;
  const avgHrv = withHR.reduce((sum, c) => sum + (c.hrv_ms ?? 0), 0) / withHR.length;
  return { restingHr: Math.round(avgHr), hrvMs: Math.round(avgHrv), sampleDays: withHR.length };
}

function computePerformanceChecksFromLogs(
  setLogs: SetLogForRecovery[],
  exerciseMappings: Map<string, ExerciseMuscleMapping>,
  muscleStates: MuscleRecoveryState[]
): PerformanceCheck[] {
  // For each muscle: take the exercise that trains it directly and was logged most often, then compare
  // the best estimated 1RM of its latest session with the average of up to 4 earlier sessions.
  // Only the same exercise is compared, so a bench press is never compared with a fly.
  const checks: PerformanceCheck[] = [];
  const byExercise = new Map<string, Map<string, { date: string; best: number }>>();
  for (const log of setLogs) {
    if (!log.completed || log.set_type === 'warm_up' || !log.session_completed_at || !log.weight || log.weight <= 0 || log.reps <= 0) continue;
    const e1rm = estimate1RM(log.weight, log.reps, log.rir);
    if (e1rm <= 0) continue;
    const sessions = byExercise.get(log.exercise_id) ?? new Map<string, { date: string; best: number }>();
    const cur = sessions.get(log.session_id);
    if (!cur || e1rm > cur.best) sessions.set(log.session_id, { date: log.session_completed_at, best: e1rm });
    byExercise.set(log.exercise_id, sessions);
  }

  for (const ms of muscleStates.filter((m) => m.recoveryPercent != null)) {
    let chosen: { date: string; best: number }[] | null = null;
    for (const [exerciseId, sessions] of byExercise) {
      const mapping = exerciseMappings.get(exerciseId);
      if (!mapping?.muscles.some((mc) => mc.muscle === ms.muscle && mc.contribution >= 1)) continue;
      if (sessions.size < 2) continue;
      const list = [...sessions.values()].sort((a, b) => a.date.localeCompare(b.date));
      if (!chosen || list.length > chosen.length) chosen = list;
    }
    if (!chosen) continue;
    const latest = chosen[chosen.length - 1];
    const baseline = chosen.slice(-5, -1);
    const baselineE1RM = baseline.reduce((sum, v) => sum + v.best, 0) / baseline.length;
    const percentDrop = ((baselineE1RM - latest.best) / baselineE1RM) * 100;
    checks.push({ muscle: ms.muscle, baselineE1RM, currentE1RM: latest.best, percentDrop, isFatigued: percentDrop > 5 });
  }
  return checks;
}
