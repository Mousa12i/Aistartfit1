// "Today's decision" and the lighter-week (deload) detector.
// Claims: decision_rule, deload_rule, deload_concept, ots_consensus, sleep_7h, sleep_loss_perf,
// failure_recovery, triage_rule, monotony_rule.

import type { RecoveryMuscle } from '../muscles';
import { MUSCLE_LABELS } from '../muscles';
import type { MuscleRecoveryState } from '../engine';
import type { WellnessStatus, WellnessToday } from './wellness';
import { WELLNESS_LABELS } from './wellness';
import { daysBetween } from './dates';

export type DecisionLevel = 'stop' | 'easy' | 'adjust' | 'go' | 'need_checkin';

export interface DecisionReason {
  text: string;
  claimIds: string[];
}

export interface TodayDecision {
  level: DecisionLevel;
  title: string;
  reasons: DecisionReason[];
  actions: string[];
  /** Muscles of the next workout that are not recovered yet, and muscles that are. */
  notReady: RecoveryMuscle[];
  ready: RecoveryMuscle[];
  claimIds: string[];
}

export interface PainReport {
  area: string;
  level: 'green' | 'yellow' | 'red';
  date: string;
  /** Red-flag text chosen, if stored. */
  note?: string | null;
}

export interface DecisionInput {
  today: string;
  wellness: WellnessToday | null;
  lastNightSleep: number | null;
  plannedMuscles: RecoveryMuscle[];
  muscleStates: MuscleRecoveryState[];
  pain: PainReport[];
  monotonyHigh: boolean;
  deloadActive: boolean;
  rttArea: string | null;
}

const TITLES: Record<DecisionLevel, string> = {
  stop: 'Stop — get checked first',
  easy: 'Easy day',
  adjust: 'Train, but adjust',
  go: 'Go — train as planned',
  need_checkin: 'Do your 30-second check-in',
};

export function decideToday(input: DecisionInput): TodayDecision {
  const reasons: DecisionReason[] = [];
  const actions: string[] = [];
  const recentPain = input.pain.filter((p) => daysBetween(p.date, input.today) <= 7 && daysBetween(p.date, input.today) >= 0);
  const stateBy = new Map(input.muscleStates.map((s) => [s.muscle, s]));
  const planned = [...new Set(input.plannedMuscles)];
  const notReady = planned.filter((m) => {
    const s = stateBy.get(m);
    return s != null && s.recoveryPercent != null && s.recoveryPercent < 50;
  });
  const ready = input.muscleStates.filter((s) => s.recoveryPercent != null && s.recoveryPercent >= 90).map((s) => s.muscle);

  const finish = (level: DecisionLevel): TodayDecision => {
    const claimIds = [...new Set(['decision_rule', ...reasons.flatMap((r) => r.claimIds)])];
    return { level, title: TITLES[level], reasons, actions, notReady, ready, claimIds };
  };

  // 1. red flags win over everything
  const red = recentPain.find((p) => p.level === 'red');
  if (red) {
    reasons.push({ text: `You reported a red-flag symptom (${red.area}) on ${red.date}.`, claimIds: ['triage_rule'] });
    if (red.note && /urine/i.test(red.note)) reasons.push({ text: 'Dark urine after exercise with muscle pain or weakness can be a sign of exertional rhabdomyolysis.', claimIds: ['rhabdo_signs'] });
    actions.push('Do not train until a clinician has checked you.', 'If you have dark urine, chest pain or fainted, seek urgent care.');
    return finish('stop');
  }

  let signals = 0;
  let strong = false;

  // 2. wellness vs your own baseline
  const w = input.wellness;
  if (w) {
    const low = w.lowItems.map((k) => WELLNESS_LABELS[k].title.toLowerCase());
    if (w.status === 'much_lower') {
      strong = true;
      signals++;
      reasons.push({ text: `Your check-in (${w.score}/25) is far below your usual ${w.baseline!.mean}.`, claimIds: ['wellness_subjective', 'wellness_scale'] });
    } else if (w.status === 'lower') {
      signals++;
      reasons.push({ text: `Your check-in (${w.score}/25) is lower than your usual ${w.baseline!.mean}.`, claimIds: ['wellness_subjective', 'wellness_scale'] });
    } else if (w.status === 'no_baseline' && w.lowItems.length >= 3) {
      signals++;
      reasons.push({ text: `Low answers today: ${low.join(', ')}. (Your personal baseline starts after 7 check-ins.)`, claimIds: ['wellness_scale'] });
    } else if (w.status === 'better' || w.status === 'usual') {
      reasons.push({ text: `Check-in ${w.score}/25 — ${w.status === 'better' ? 'better than' : 'in line with'} your usual.`, claimIds: ['wellness_scale'] });
    }
  }

  // 3. sleep
  if (input.lastNightSleep != null && input.lastNightSleep < 7) {
    signals++;
    if (input.lastNightSleep < 5) strong = true;
    reasons.push({ text: `You slept ${input.lastNightSleep} h (adults need 7 or more); expect lower strength and performance today.`, claimIds: ['sleep_7h', 'sleep_loss_perf', 'sleep_strength'] });
  }

  // 4. muscles of the next workout
  if (notReady.length) {
    signals++;
    reasons.push({
      text: `Not recovered yet for your next workout: ${notReady.map((m) => `${MUSCLE_LABELS[m]} ${Math.round(stateBy.get(m)!.recoveryPercent!)}%`).join(', ')} (estimate).`,
      claimIds: ['recovery_estimate', 'failure_recovery'],
    });
  }

  // 5. pain to train around
  const yellow = recentPain.filter((p) => p.level === 'yellow');
  if (yellow.length) {
    signals++;
    reasons.push({ text: `Recent pain report: ${[...new Set(yellow.map((p) => p.area))].join(', ')}.`, claimIds: ['triage_rule', 'pain_monitoring'] });
    actions.push('Leave out movements that hurt more than 3/10 in the painful area.');
  }
  if (input.rttArea) actions.push(`Follow today's stage of your ${input.rttArea} return-to-training plan.`);

  // 6. week pattern
  if (input.monotonyHigh) {
    signals++;
    reasons.push({ text: 'This week has had very similar hard days with little variation (high monotony).', claimIds: ['monotony_strain', 'monotony_rule'] });
  }
  if (input.deloadActive) actions.push('You are in a lighter week: about half your usual sets, same exercises, 3–4 reps in reserve.');

  if (!w) {
    actions.unshift('Answer the 5 morning questions so today’s decision can use how you feel.');
    if (notReady.length && ready.length) actions.push(`Recovered and ready: ${ready.slice(0, 6).map((m) => MUSCLE_LABELS[m]).join(', ')}.`);
    return finish('need_checkin');
  }

  let level: DecisionLevel = 'go';
  if (strong || signals >= 3) level = 'easy';
  else if (signals >= 1) level = 'adjust';

  if (level === 'easy') {
    actions.unshift('Do about half your usual sets at 3–4 reps in reserve, or swap the session for 20–40 minutes of easy cardio and mobility.');
  } else if (level === 'adjust') {
    actions.unshift('Train, but stop every set 2–3 reps short of failure and skip max or PR attempts.');
    if (notReady.length && ready.length) actions.push(`Or swap to a session for muscles that are ready: ${ready.slice(0, 6).map((m) => MUSCLE_LABELS[m]).join(', ')}.`);
  } else {
    actions.unshift('Train as planned. Log your sets and rate the session afterwards.');
  }
  return finish(level);
}

// ---------------- lighter week (deload) detector ----------------

export interface DeloadInput {
  today: string;
  /** True for two weeks after switching between gym and home equipment (lifts are not comparable). */
  performancePaused?: boolean;
  /** Tracked lifts whose latest session was more than 5% below their recent average. */
  performanceDrops: { name: string; percentDrop: number }[];
  recentStatuses: WellnessStatus[];
  monotonyHigh: boolean;
  /** Date of the last lighter week, or of the first logged session if there was none. */
  lastDeloadOrStart: string | null;
  /** Weeks with at least one completed session in the last 8. */
  activeWeeks: number;
}

export interface DeloadSignal {
  id: 'performance' | 'wellness' | 'monotony' | 'time';
  met: boolean;
  text: string;
}

export interface DeloadAdvice {
  suggest: boolean;
  metCount: number;
  signals: DeloadSignal[];
  claimIds: string[];
}

export function detectDeload(input: DeloadInput): DeloadAdvice {
  const lowCount = input.recentStatuses.filter((s) => s === 'lower' || s === 'much_lower').length;
  const weeksSince = input.lastDeloadOrStart ? Math.floor(daysBetween(input.lastDeloadOrStart, input.today) / 7) : 0;
  const signals: DeloadSignal[] = [
    {
      id: 'performance',
      met: !input.performancePaused && input.performanceDrops.length > 0,
      text: input.performancePaused
        ? 'Performance check paused for 2 weeks after switching between gym and home equipment'
        : input.performanceDrops.length
          ? `Performance dropped: ${input.performanceDrops.map((d) => `${d.name} −${d.percentDrop.toFixed(1)}%`).join(', ')}`
          : 'No main lift dropped more than 5%',
    },
    { id: 'wellness', met: lowCount >= 3, text: `${lowCount} of your last ${input.recentStatuses.length} check-ins were lower than usual` },
    { id: 'monotony', met: input.monotonyHigh, text: input.monotonyHigh ? 'Monotony above 2.0 this week' : 'Monotony normal this week' },
    { id: 'time', met: weeksSince >= 6 && input.activeWeeks >= 5, text: `${weeksSince} weeks since your last lighter week or start` },
  ];
  const metCount = signals.filter((s) => s.met).length;
  return { suggest: metCount >= 2, metCount, signals, claimIds: ['deload_rule', 'deload_concept', 'deload_full_stop', 'ots_consensus'] };
}
