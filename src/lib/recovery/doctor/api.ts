// Reads and writes for the Recovery Doctor (Supabase, RLS-protected, owner only).

import { supabase } from '@/lib/supabase';
import { fetchPlanExercises, fetchWorkoutPlanById, nextRoutineDay } from '@/lib/data';
import { relatedRoutineIds } from '@/lib/training/api';
import { routineDays } from '@/lib/training/routine';
import { RECOVERY_MUSCLES, type RecoveryMuscle } from '../muscles';
import { localDateKey } from '../store';
import type { DoctorExtras, NextWorkout, RecoveryAdjustment, RttProgramme } from './build';
import type { RttEntry } from './rtt';
import type { WellnessItem } from './wellness';
import { addDays } from './dates';

const isMuscle = (m: string): m is RecoveryMuscle => (RECOVERY_MUSCLES as string[]).includes(m);

export async function fetchDoctorExtras(now = new Date()): Promise<DoctorExtras> {
  const since = addDays(localDateKey(now), -120);
  const [adj, progs, entries, settings, periods, logs] = await Promise.all([
    supabase.from('recovery_adjustments').select('*').order('starts_on', { ascending: false }).limit(30),
    supabase.from('rtt_programmes').select('*').order('started_at', { ascending: false }).limit(10),
    supabase.from('rtt_entries').select('*').order('session_date').limit(500),
    supabase.from('recovery_settings').select('cycle_tracking').maybeSingle(),
    supabase.from('cycle_periods').select('start_date').order('start_date').limit(60),
    supabase.from('recovery_logs').select('recorded_at, metadata').eq('kind', 'recovery_session').gte('recorded_at', `${since}T00:00:00`).limit(1000),
  ]);
  // Tables of the v2 migration may not exist yet on an older database: treat them as empty.
  const rows = <T,>(r: { data: unknown; error: unknown }): T[] => (r.error ? [] : ((r.data as T[]) ?? []));

  const entryRows = rows<{ programme_id: string; session_date: string; stage: number; pain_during: number; pain_next_morning: number | null; morning_worse: boolean | null }>(entries);
  const rtt: RttProgramme[] = rows<{ id: string; area: string; stage: number; status: RttProgramme['status']; started_at: string }>(progs).map((p) => ({
    ...p,
    entries: entryRows
      .filter((e) => e.programme_id === p.id)
      .map((e): RttEntry => ({ date: e.session_date, stage: e.stage, painDuring: e.pain_during, painNextMorning: e.pain_next_morning, morningWorse: e.morning_worse })),
  }));

  return {
    equipmentSwitchedOn: await equipmentSwitchDate().catch(() => null),
    adjustments: rows<RecoveryAdjustment>(adj),
    rtt,
    cycleTracking: !settings.error && !!(settings.data as { cycle_tracking?: boolean } | null)?.cycle_tracking,
    cycleStarts: rows<{ start_date: string }>(periods).map((p) => p.start_date),
    modalityLogs: rows<{ recorded_at: string; metadata: { modality?: string } | null }>(logs)
      .filter((l) => typeof l.metadata?.modality === 'string')
      .map((l) => ({ date: localDateKey(new Date(l.recorded_at)), modality: l.metadata!.modality! })),
  };
}

/** When the active routine became active, if it is a gym ↔ home switch (the home version, or a routine that has one). */
async function equipmentSwitchDate(): Promise<string | null> {
  const { data } = await supabase.from('user_plan_assignments').select('plan_id, assigned_at').is('completed_at', null).order('assigned_at', { ascending: false }).limit(1);
  const a = (data as { plan_id: string; assigned_at: string }[] | null)?.[0];
  if (!a) return null;
  const plan = await fetchWorkoutPlanById(a.plan_id).catch(() => null);
  const related = await relatedRoutineIds(plan).catch(() => [] as string[]);
  return related.length ? localDateKey(new Date(a.assigned_at)) : null;
}

/** The person's next workout: the routine of their latest session (or latest assigned plan), next day in order. */
export async function fetchNextWorkout(): Promise<NextWorkout | null> {
  let planId: string | null = null;
  let planName = 'Your routine';
  // the active routine first (it may be the home version), then the routine of the latest session
  const { data: assigned } = await supabase.from('user_plan_assignments').select('plan_id').is('completed_at', null).order('assigned_at', { ascending: false }).limit(1);
  if (assigned && assigned.length) planId = (assigned[0] as { plan_id: string }).plan_id;
  if (!planId) {
    const { data: last } = await supabase
      .from('workout_sessions')
      .select('plan_id, plan_name')
      .eq('status', 'completed')
      .not('plan_id', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1);
    if (last && last.length) {
      planId = (last[0] as { plan_id: string }).plan_id;
      planName = (last[0] as { plan_name: string | null }).plan_name ?? planName;
    }
  }
  if (!planId) return null;
  const planRow = await fetchWorkoutPlanById(planId).catch(() => null);
  if (planRow?.name) planName = planRow.name;
  const rows = await fetchPlanExercises(planId).catch(() => []);
  if (!rows.length) return null;
  const days = routineDays(rows);
  const related = await relatedRoutineIds(planRow).catch(() => [] as string[]);
  const dayIndex = await nextRoutineDay(planId, days.map((d) => d.index), related).catch(() => days[0].index);
  const day = days.find((d) => d.index === dayIndex) ?? days[0];
  const muscles = new Set<RecoveryMuscle>();
  for (const r of day.exercises) for (const m of r.exercise?.muscles_primary ?? []) if (isMuscle(m)) muscles.add(m);
  return { planId, planName, dayLabel: day.label, muscles: [...muscles] };
}

export async function saveWellness(answers: Record<WellnessItem, number>, sleepHours: number | null, now = new Date()): Promise<void> {
  const row: Record<string, unknown> = {
    checkin_date: localDateKey(now),
    wellness_sleep: answers.sleep,
    wellness_energy: answers.energy,
    wellness_soreness: answers.soreness,
    wellness_stress: answers.stress,
    wellness_mood: answers.mood,
    wellness_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  if (sleepHours != null) {
    row.sleep_hours = sleepHours;
    row.sleep_source = 'manual';
  }
  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user) row.user_id = userData.user.id;
  const { error } = await supabase.from('daily_checkins').upsert(row, { onConflict: 'user_id,checkin_date' });
  if (error) throw error;
}

export async function setSessionRpe(sessionId: string, rpe: number): Promise<void> {
  if (!Number.isInteger(rpe) || rpe < 0 || rpe > 10) throw new Error('RPE must be 0–10');
  const { error } = await supabase.from('workout_sessions').update({ session_rpe: rpe, rpe_recorded_at: new Date().toISOString() }).eq('id', sessionId);
  if (error) throw error;
}

export async function acceptDeload(window: { starts_on: string; ends_on: string }, reasons: string[]): Promise<void> {
  const { error } = await supabase.from('recovery_adjustments').insert({ kind: 'deload', ...window, reasons });
  if (error) throw error;
}

export async function setAdjustmentStatus(id: string, status: RecoveryAdjustment['status']): Promise<void> {
  const { error } = await supabase.from('recovery_adjustments').update({ status }).eq('id', id);
  if (error) throw error;
}

/** Active lighter week today, for other screens (Home, workout). */
export async function fetchActiveDeload(now = new Date()): Promise<RecoveryAdjustment | null> {
  const today = localDateKey(now);
  const { data, error } = await supabase.from('recovery_adjustments').select('*').eq('status', 'active').lte('starts_on', today).gte('ends_on', today).limit(1);
  if (error || !data?.length) return null;
  return data[0] as RecoveryAdjustment;
}

export async function startRtt(area: string, painLogId: string | null): Promise<void> {
  const { error } = await supabase.from('rtt_programmes').insert({ area: area.slice(0, 60), pain_log_id: painLogId });
  if (error) throw error;
}

export async function logRttSession(programmeId: string, stage: number, painDuring: number, note: string | null, now = new Date()): Promise<void> {
  const { error } = await supabase
    .from('rtt_entries')
    .upsert({ programme_id: programmeId, session_date: localDateKey(now), stage, pain_during: painDuring, note }, { onConflict: 'programme_id,session_date' });
  if (error) throw error;
}

export async function logRttMorning(programmeId: string, sessionDate: string, painNextMorning: number, worse: boolean): Promise<void> {
  const { error } = await supabase.from('rtt_entries').update({ pain_next_morning: painNextMorning, morning_worse: worse }).eq('programme_id', programmeId).eq('session_date', sessionDate);
  if (error) throw error;
}

export async function updateRtt(programmeId: string, patch: { stage?: number; status?: RttProgramme['status'] }): Promise<void> {
  const { error } = await supabase.from('rtt_programmes').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', programmeId);
  if (error) throw error;
}

export async function setCycleTracking(on: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('recovery_settings').upsert({ user_id: userData?.user?.id, cycle_tracking: on, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function addPeriodStart(date: string): Promise<void> {
  const { error } = await supabase.from('cycle_periods').upsert({ start_date: date }, { onConflict: 'user_id,start_date', ignoreDuplicates: true });
  if (error) throw error;
}

export async function deleteCycleData(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return;
  const { error } = await supabase.from('cycle_periods').delete().eq('user_id', uid);
  if (error) throw error;
  await setCycleTracking(false);
}

export async function logModality(modality: string): Promise<void> {
  const { error } = await supabase.from('recovery_logs').insert({ kind: 'recovery_session', note: null, metadata: { modality, source: 'recovery_doctor' } });
  if (error) throw error;
}
