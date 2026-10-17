// "Planned vs done" for one finished session: each exercise the plan asked for that day next to what the athlete
// logged, with the effort (reps in reserve, RIR) compared with the coach's target.
//
// Evidence: Helms ER, Cronin J, Storey A, Zourdos MC. Application of the repetitions in reserve-based rating of
// perceived exertion scale for resistance training. Strength Cond J 2016;38(4):42-49 (doi:10.1519/SSC.0000000000000218):
// RIR lets load be adjusted to what the athlete can do on the day. ACSM (2009) advises a 2-10 % load increase once the
// current load is managed for more than the target reps. The tolerance of 1 rep in reserve and the wording of each
// suggestion are StartFit rules, so the coach always sees the numbers behind them and decides.

import { parseRepsText } from '../training/time-fit';

export interface ReviewPlanRow {
  exercise_id: string;
  name: string;
  sets: number;
  reps: string;
  rir_target: number | null;
  day_index: number;
}

export interface ReviewSet {
  exercise_id: string | null;
  exercise_name: string | null;
  set_type?: string | null;
  reps: number | null;
  weight: number | null;
  rir: number | null;
  completed: boolean;
}

export type ExerciseVerdict = 'as_planned' | 'too_easy' | 'too_hard' | 'fewer_sets' | 'below_range' | 'skipped' | 'extra';

export interface ExerciseReview {
  exerciseId: string;
  name: string;
  planned: { sets: number; repsMin: number; repsMax: number; rir: number | null } | null;
  done: { sets: number; reps: number[]; weights: number[]; rirs: (number | null)[] };
  /** Average logged RIR on working sets (null when none was logged). */
  avgRir: number | null;
  verdict: ExerciseVerdict;
  /** Top working weight (kg) in this session. */
  topWeight: number | null;
}

export const RIR_TOLERANCE = 1;

const isWarmup = (s: ReviewSet) => (s.set_type ?? '').replace('-', '_') === 'warm_up' || s.set_type === 'warmup';

/** Picks the plan day this session followed: the stored plan_day, otherwise the day sharing the most exercises. */
export function sessionDay(rows: ReviewPlanRow[], sets: ReviewSet[], planDay: number | null): number | null {
  const days = [...new Set(rows.map((r) => r.day_index))];
  if (planDay != null && days.includes(planDay)) return planDay;
  const ids = new Set(sets.filter((s) => s.completed).map((s) => s.exercise_id));
  let best: number | null = null;
  let bestN = 0;
  for (const d of days) {
    const n = rows.filter((r) => r.day_index === d && ids.has(r.exercise_id)).length;
    if (n > bestN) { best = d; bestN = n; }
  }
  return best;
}

export function reviewSession(rows: ReviewPlanRow[], sets: ReviewSet[], planDay: number | null): { day: number | null; exercises: ExerciseReview[]; completion: number | null } {
  const day = sessionDay(rows, sets, planDay);
  const dayRows = day == null ? [] : rows.filter((r) => r.day_index === day);
  const work = sets.filter((s) => s.completed && !isWarmup(s) && s.exercise_id);
  const out: ExerciseReview[] = [];

  for (const r of dayRows) {
    const mine = work.filter((s) => s.exercise_id === r.exercise_id);
    const range = parseRepsText(r.reps);
    const reps = mine.map((s) => s.reps ?? 0);
    const rirs = mine.map((s) => (s.rir == null ? null : Number(s.rir)));
    const logged = rirs.filter((x): x is number => x != null);
    const avgRir = logged.length ? Math.round((logged.reduce((a, b) => a + b, 0) / logged.length) * 10) / 10 : null;
    const weights = mine.map((s) => Number(s.weight ?? 0));
    let verdict: ExerciseVerdict;
    if (!mine.length) verdict = 'skipped';
    else if (mine.length < r.sets) verdict = 'fewer_sets';
    else if (!range.timed && reps.some((n) => n < range.repsMin)) verdict = 'below_range';
    else if (r.rir_target != null && avgRir != null && avgRir > r.rir_target + RIR_TOLERANCE && reps.every((n) => n >= range.repsMax)) verdict = 'too_easy';
    else if (r.rir_target != null && avgRir != null && avgRir < r.rir_target - RIR_TOLERANCE) verdict = 'too_hard';
    else verdict = 'as_planned';
    out.push({
      exerciseId: r.exercise_id, name: r.name,
      planned: { sets: r.sets, repsMin: range.repsMin, repsMax: range.repsMax, rir: r.rir_target },
      done: { sets: mine.length, reps, weights, rirs },
      avgRir, verdict, topWeight: weights.length ? Math.max(...weights) : null,
    });
  }
  // Exercises done that the plan day did not include (swaps or extras).
  const planned = new Set(dayRows.map((r) => r.exercise_id));
  const extras = new Map<string, ReviewSet[]>();
  for (const s of work) if (!planned.has(s.exercise_id!)) extras.set(s.exercise_id!, [...(extras.get(s.exercise_id!) ?? []), s]);
  for (const [id, list] of extras) {
    const weights = list.map((s) => Number(s.weight ?? 0));
    const logged = list.map((s) => s.rir).filter((x): x is number => x != null);
    out.push({
      exerciseId: id, name: list[0].exercise_name ?? '—', planned: null,
      done: { sets: list.length, reps: list.map((s) => s.reps ?? 0), weights, rirs: list.map((s) => s.rir) },
      avgRir: logged.length ? Math.round((logged.reduce((a, b) => a + b, 0) / logged.length) * 10) / 10 : null,
      verdict: 'extra', topWeight: weights.length ? Math.max(...weights) : null,
    });
  }
  const plannedSets = dayRows.reduce((a, r) => a + r.sets, 0);
  const doneSets = out.filter((e) => e.planned).reduce((a, e) => a + Math.min(e.done.sets, e.planned!.sets), 0);
  return { day, exercises: out, completion: plannedSets ? Math.round((doneSets / plannedSets) * 100) : null };
}
