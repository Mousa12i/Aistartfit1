// Plain-language summary of today's recovery, built only from the person's own data (no AI, no invented numbers).
// Claims: recovery_estimate, sleep_strength (short-night line), and the tonight_rule / caffeine_6h / presleep_protein
// claims for the evening plan.

import { MUSCLE_LABELS, type RecoveryMuscle } from '../muscles';
import type { MuscleRecoveryState } from '../engine';

export interface CoachNoteInput {
  muscles: MuscleRecoveryState[];
  /** Hours slept last night, when logged today. */
  sleepLastNight: number | null;
  nextWorkout: { name: string; muscles: RecoveryMuscle[] } | null;
}

export interface CoachNote {
  lines: string[];
  /** The most useful single action today, or null when there is nothing to change. */
  focus: string | null;
}

const READY = 90;
const LOW = 50;

function hoursLeft(s: MuscleRecoveryState): number {
  if (s.hoursSinceLastTrained == null) return 0;
  return Math.max(0, Math.ceil(s.hoursNeeded - s.hoursSinceLastTrained));
}

function list(names: string[], max = 4): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

function fmtSleep(h: number): string {
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  if (min === 60) return `${whole + 1}h`;
  return min === 0 ? `${whole}h` : `${whole}h ${min}m`;
}

export function buildCoachNote(input: CoachNoteInput): CoachNote {
  const tracked = input.muscles.filter((m) => m.recoveryPercent != null);
  const lines: string[] = [];
  if (input.sleepLastNight != null) {
    lines.push(
      input.sleepLastNight < 6
        ? `You slept ${fmtSleep(input.sleepLastNight)}. After a short night, muscles get a little more time and strength can be lower today.`
        : `You slept ${fmtSleep(input.sleepLastNight)}.`,
    );
  }
  if (tracked.length === 0) {
    lines.push('Log a workout and I will start tracking how each muscle recovers.');
    return { lines, focus: null };
  }

  const ready = tracked.filter((m) => (m.recoveryPercent ?? 0) >= READY);
  const recovering = tracked
    .filter((m) => (m.recoveryPercent ?? 0) < READY)
    .sort((a, b) => (a.recoveryPercent ?? 0) - (b.recoveryPercent ?? 0));

  lines.push(ready.length > 0 ? `Ready: ${list(ready.map((m) => MUSCLE_LABELS[m.muscle]))}.` : 'No tracked muscle is fully recovered yet.');
  if (recovering.length > 0) {
    const parts = recovering.slice(0, 2).map((m) => {
      const left = hoursLeft(m);
      return `${MUSCLE_LABELS[m.muscle]} ${Math.round(m.recoveryPercent ?? 0)}%${left > 0 ? ` (about ${left}h to go)` : ''}`;
    });
    lines.push(`Still recovering: ${parts.join(', ')}${recovering.length > 2 ? ` and ${recovering.length - 2} more` : ''}.`);
  }

  let focus: string | null = null;
  if (input.nextWorkout) {
    const byMuscle = new Map(tracked.map((m) => [m.muscle, m]));
    const low = input.nextWorkout.muscles.filter((m) => (byMuscle.get(m)?.recoveryPercent ?? 100) < LOW);
    if (low.length > 0) {
      focus = `Your next workout (${input.nextWorkout.name}) trains ${list(low.map((m) => MUSCLE_LABELS[m]), 3)}, still under ${LOW}%: go lighter on ${low.length === 1 ? 'it' : 'them'} or swap to recovered muscles today.`;
    } else {
      focus = `Your next workout (${input.nextWorkout.name}) trains muscles that are ${LOW}% or more recovered.`;
    }
  }
  return { lines, focus };
}

export interface TonightInput {
  /** Hours slept last night, if logged. */
  sleepLastNight: number | null;
  /** Bedtime as "HH:MM" (24 h). */
  bedtime: string;
  trainedToday: boolean;
  /** Protein logged in the Nutrition diary today (g), or null when nothing is logged. */
  proteinToday: number | null;
}

export interface TonightPlan {
  sleep: string;
  caffeineCutoff: string;
  protein: string;
}

/** "HH:MM" minus `hours`, wrapping around midnight. */
export function timeMinusHours(hhmm: string, hours: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  let mins = (Number(m[1]) * 60 + Number(m[2]) - Math.round(hours * 60)) % 1440;
  if (mins < 0) mins += 1440;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

export function buildTonightPlan(input: TonightInput): TonightPlan {
  const short = input.sleepLastNight != null && input.sleepLastNight < 7;
  const sleep = short
    ? `Last night was ${fmtSleep(input.sleepLastNight!)}. Aim for 7+ hours tonight: an earlier bedtime (or a nap tomorrow) helps more than sleep tips alone.`
    : 'Aim for 7+ hours of sleep tonight.';
  const caffeineCutoff = `Last caffeine by ${timeMinusHours(input.bedtime, 6)} (6 hours before ${input.bedtime}), including pre-workout and energy drinks.`;
  const logged = input.proteinToday != null && input.proteinToday > 0 ? `You have logged ${Math.round(input.proteinToday)} g of protein today. ` : '';
  const protein = input.trainedToday
    ? `${logged}You trained today: keep a 30–40 g protein serving for before bed.`
    : `${logged}Spread protein over your meals (about 0.4 g/kg per meal).`;
  return { sleep, caffeineCutoff, protein };
}
