import { supabase } from '@/lib/supabase';
import { callFunction, isSchemaError } from '@/lib/nutrition/api';
import { MUSCLE_LABELS } from '../muscles';
import type { MuscleRecoveryState } from '../engine';
import type { DoctorState } from './build';

export type RecoveryCoachLink = 'checkin' | 'rate_session' | 'triage' | 'return_to_training' | 'methods' | 'deload' | 'sleep' | 'report_pdf' | 'nutrition';

export interface RecoveryCoachBlock {
  text: string;
  basis: 'evidence' | 'user_data' | 'general';
  claimIds: string[];
}

export interface RecoveryCoachReply {
  blocks: RecoveryCoachBlock[];
  links: RecoveryCoachLink[];
  memorySaved: { category: string; content: string }[];
  safety: boolean;
  remaining: number | null;
}

export interface RecoveryCoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data: RecoveryCoachReply | null;
  created_at: string;
}

/** The app's own summary of the person's recovery, sent with each question (the server adds the raw rows). */
export function coachSnapshot(state: DoctorState, muscles: MuscleRecoveryState[]) {
  return {
    today: state.today,
    decision: { level: state.decision.level, reasons: state.decision.reasons.map((r) => r.text), actions: state.decision.actions },
    nextWorkout: state.nextWorkout ? { name: state.nextWorkout.planName, day: state.nextWorkout.dayLabel, muscles: state.nextWorkout.muscles.map((m) => MUSCLE_LABELS[m]) } : null,
    checkinToday: state.wellnessToday ? { score: state.wellnessToday.score, status: state.wellnessToday.status, usual: state.wellnessToday.baseline?.mean ?? null, lowItems: state.wellnessToday.lowItems } : 'not done',
    sleep: state.sleep,
    thisWeek: { sessions: state.thisWeek.sessions, load: state.thisWeek.load, rated: state.thisWeek.ratedSessions, monotony: state.thisWeek.monotony, strain: state.thisWeek.strain, changeVsUsualPercent: state.change.percent },
    lighterWeek: state.activeDeload ? `active until ${state.activeDeload.ends_on}` : state.deload.suggest ? `suggested: ${state.deload.signals.filter((s) => s.met).map((s) => s.text).join('; ')}` : 'not needed',
    muscleRecoveryEstimates: muscles
      .filter((m) => m.recoveryPercent != null)
      .map((m) => `${MUSCLE_LABELS[m.muscle]} ${Math.round(m.recoveryPercent!)}% (last session ${m.sessionEffectiveSets.toFixed(1)} sets)`),
    strengthTrends: state.trends.map((t) => `${t.name} ${t.latest} kg e1RM, ${t.changePercent ?? '?'}% over 8 wk`),
    returnToTraining: state.rtt.filter((r) => r.status === 'active').map((r) => ({ area: r.area, stage: r.stage, advice: r.evaluation.text })),
    patterns: state.whatWorks.filter((c) => c.result === 'pattern').map((c) => c.summary),
  };
}

export async function listRecoveryCoachMessages(limit = 60): Promise<{ messages: RecoveryCoachMessage[]; available: boolean }> {
  const { data, error } = await supabase.from('recovery_coach_messages').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) {
    if (isSchemaError(error)) return { messages: [], available: false };
    throw error;
  }
  return { messages: ((data as RecoveryCoachMessage[]) ?? []).reverse(), available: true };
}

export async function clearRecoveryCoachMessages(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase.from('recovery_coach_messages').delete().eq('user_id', auth.user.id);
  if (error) throw error;
}

export async function sendRecoveryCoachMessage(message: string, snapshot: unknown): Promise<RecoveryCoachReply> {
  return callFunction<RecoveryCoachReply>('recovery-coach', { message, snapshot });
}
