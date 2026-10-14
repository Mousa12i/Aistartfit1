// Turns the raw recovery data into everything the Recovery Doctor shows (pure: no network).

import type { FullRecoveryData, DailyCheckin } from '../store';
import { localDateKey } from '../store';
import { MUSCLE_LABELS, type RecoveryMuscle } from '../muscles';
import { addDays } from './dates';
import { assessWellness, recentWellnessStatuses, type WellnessEntry, type WellnessToday, type WellnessStatus } from './wellness';
import { weeklySeries, loadChange, monotonyFlag, type LoadSession, type WeekLoad, type LoadChange } from './load';
import { performanceTrends, sleepSummary, type PerfSet, type ExerciseTrend, type SleepSummary } from './trends';
import { decideToday, detectDeload, type TodayDecision, type DeloadAdvice, type PainReport } from './decision';
import { whatWorks, recoveryFingerprint, weeklyReport, type Comparison, type Fingerprint, type WeeklyReport, type ModalityLog } from './insights';
import { cycleInfo, type CycleInfo } from './cycle';
import { evaluateRtt, type RttEntry, type RttEvaluation } from './rtt';

export interface RecoveryAdjustment {
  id: string;
  kind: 'deload';
  starts_on: string;
  ends_on: string;
  status: 'active' | 'completed' | 'dismissed';
  reasons: string[];
  created_at: string;
}

export interface RttProgramme {
  id: string;
  area: string;
  stage: number;
  status: 'active' | 'completed' | 'stopped';
  started_at: string;
  entries: RttEntry[];
}

export interface DoctorExtras {
  adjustments: RecoveryAdjustment[];
  rtt: RttProgramme[];
  cycleTracking: boolean;
  cycleStarts: string[];
  modalityLogs: ModalityLog[];
  /** Date the person switched between their gym and home routine, if that happened (YYYY-MM-DD). */
  equipmentSwitchedOn?: string | null;
}

export interface NextWorkout {
  planId: string;
  planName: string;
  dayLabel: string;
  muscles: RecoveryMuscle[];
}

export interface DoctorState {
  today: string;
  wellnessEntries: WellnessEntry[];
  wellnessToday: WellnessToday | null;
  todayAnswered: boolean;
  recentStatuses: WellnessStatus[];
  sleep: SleepSummary;
  sessions: LoadSession[];
  series: WeekLoad[];
  thisWeek: WeekLoad;
  change: LoadChange;
  monotonyHigh: boolean;
  unratedRecent: { id: string; date: string; name: string }[];
  trends: ExerciseTrend[];
  pain: PainReport[];
  decision: TodayDecision;
  deload: DeloadAdvice;
  activeDeload: RecoveryAdjustment | null;
  fingerprint: Fingerprint;
  whatWorks: Comparison[];
  weekly: WeeklyReport;
  cycle: CycleInfo | null;
  rtt: (RttProgramme & { evaluation: RttEvaluation })[];
  nextWorkout: NextWorkout | null;
}

export function wellnessEntriesFrom(checkins: DailyCheckin[]): WellnessEntry[] {
  return checkins
    .map((c) => ({
      date: c.checkin_date,
      sleep: c.wellness_sleep ?? null,
      energy: c.wellness_energy ?? null,
      soreness: c.wellness_soreness ?? null,
      stress: c.wellness_stress ?? null,
      mood: c.wellness_mood ?? null,
      sleepHours: c.sleep_hours ?? null,
      proteinG: c.protein_g ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildDoctor(input: {
  full: FullRecoveryData;
  extras: DoctorExtras;
  now: Date;
  nextWorkout: NextWorkout | null;
  bodyWeightKg: number | null;
}): DoctorState {
  const { full, extras, now } = input;
  const today = localDateKey(now);

  const wellnessEntries = wellnessEntriesFrom(full.checkins);
  const wellnessToday = assessWellness(wellnessEntries, today);
  const recentStatuses = recentWellnessStatuses(wellnessEntries, today, 5);
  const sleep = sleepSummary(
    wellnessEntries.filter((e) => e.sleepHours != null).map((e) => ({ date: e.date, hours: e.sleepHours! })),
    today,
  );

  const sessions: LoadSession[] = full.sessions
    .filter((s) => s.completed_at)
    .map((s) => {
      const seconds = s.duration_seconds > 0 ? s.duration_seconds : Math.max(0, (Date.parse(s.completed_at) - Date.parse(s.started_at)) / 1000);
      return { id: s.id, date: localDateKey(new Date(s.completed_at)), minutes: Math.round(seconds / 60), rpe: s.session_rpe ?? null };
    });
  const series = weeklySeries(sessions, today, 8);
  const thisWeek = series[series.length - 1];
  const change = loadChange(series);
  const monotonyHigh = monotonyFlag(thisWeek);
  const unratedRecent = full.sessions
    .filter((s) => s.completed_at && s.session_rpe == null && Date.parse(s.completed_at) >= now.getTime() - 3 * 86400000)
    .slice(0, 3)
    .map((s) => ({ id: s.id, date: localDateKey(new Date(s.completed_at)), name: s.plan_name ?? 'Workout' }));

  const sessionDate = new Map(full.sessions.map((s) => [s.id, s.completed_at ? localDateKey(new Date(s.completed_at)) : null]));
  const sets: PerfSet[] = full.setLogs
    .filter((l) => sessionDate.get(l.session_id ?? '') != null)
    .map((l) => ({
      sessionId: l.session_id ?? '',
      date: sessionDate.get(l.session_id ?? '')!,
      exerciseId: l.exercise_id,
      exerciseName: l.exercise_name,
      weight: Number(l.weight ?? 0),
      reps: Number(l.reps ?? 0),
      rir: l.rir ?? null,
      setType: l.set_type ?? null,
      completed: !!l.completed,
    }));
  const trends = performanceTrends(sets, today);

  const pain: PainReport[] = full.painLogs.map((p) => ({
    area: p.body_area,
    level: (p.triage_level as PainReport['level']) ?? 'green',
    date: localDateKey(new Date(p.recorded_at)),
    note: p.notes,
  }));

  const activeDeload = extras.adjustments.find((a) => a.status === 'active' && a.starts_on <= today && a.ends_on >= today) ?? null;
  const rtt = extras.rtt.map((p) => ({ ...p, evaluation: evaluateRtt(p.stage, p.entries) }));
  const activeRtt = rtt.find((p) => p.status === 'active') ?? null;

  const decision = decideToday({
    today,
    wellness: wellnessToday,
    lastNightSleep: sleep.lastNight,
    plannedMuscles: input.nextWorkout?.muscles ?? [],
    muscleStates: full.muscleStates,
    pain,
    monotonyHigh,
    deloadActive: !!activeDeload,
    rttArea: activeRtt?.area ?? null,
  });

  const firstSession = sessions.map((s) => s.date).sort()[0] ?? null;
  const lastDeload = extras.adjustments.filter((a) => a.status !== 'dismissed').map((a) => a.ends_on).sort().pop() ?? null;
  // Lifts are not comparable for two weeks after moving between gym and home equipment.
  const performancePaused = !!extras.equipmentSwitchedOn && extras.equipmentSwitchedOn >= addDays(today, -13);
  const deload = detectDeload({
    today,
    performancePaused,
    performanceDrops: full.performanceChecks
      .filter((c) => c.isFatigued && c.percentDrop != null)
      .map((c) => ({ name: MUSCLE_LABELS[c.muscle], percentDrop: c.percentDrop! })),
    recentStatuses,
    monotonyHigh,
    lastDeloadOrStart: lastDeload ?? firstSession,
    activeWeeks: series.filter((w) => w.sessions > 0).length,
  });
  if (activeDeload) deload.suggest = false;

  const insightInput = {
    today,
    wellness: wellnessEntries,
    sessions,
    sets,
    modalityLogs: extras.modalityLogs,
    bodyWeightKg: input.bodyWeightKg,
    cycleStarts: extras.cycleTracking ? extras.cycleStarts : null,
  };

  return {
    today,
    wellnessEntries,
    wellnessToday,
    todayAnswered: !!wellnessToday,
    recentStatuses,
    sleep,
    sessions,
    series,
    thisWeek,
    change,
    monotonyHigh,
    unratedRecent,
    trends,
    pain,
    decision,
    deload,
    activeDeload,
    fingerprint: recoveryFingerprint(insightInput, full.recoveryProfile),
    whatWorks: whatWorks(insightInput),
    weekly: weeklyReport(insightInput),
    cycle: extras.cycleTracking ? cycleInfo(extras.cycleStarts, today) : null,
    rtt,
    nextWorkout: input.nextWorkout,
  };
}

/** Dates of the next lighter week if accepted today (7 days). */
export function deloadWindow(today: string): { starts_on: string; ends_on: string } {
  return { starts_on: today, ends_on: addDays(today, 6) };
}
