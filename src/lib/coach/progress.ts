// Strength over time per exercise, from the sets the athlete logged.
// The estimate is Epley's formula (weight × (1 + reps / 30)) with reps in reserve counted as reps,
// the same estimate the recovery screens use. It is an estimate, labelled as such on screen.
import { estimate1RM } from '../recovery/readiness';
import type { SessionRow } from './api';

export interface StrengthRow {
  name: string;
  /** Best estimated 1RM of each session, oldest first. */
  points: number[];
  /** Heaviest-estimate set of the latest session. */
  best: { weight: number; reps: number };
  /** Change from the first to the latest session, %. */
  changePct: number;
}

export function strengthProgress(sessions: Pick<SessionRow, 'completed_at' | 'sets'>[]): StrengthRow[] {
  const byEx = new Map<string, { at: string; e1rm: number; weight: number; reps: number }[]>();
  for (const s of sessions) {
    if (!s.completed_at) continue;
    const best = new Map<string, { e1rm: number; weight: number; reps: number }>();
    for (const l of s.sets) {
      if (!l.completed || !l.exercise_name || !l.weight || !l.reps || l.weight <= 0 || l.reps <= 0) continue;
      const e = estimate1RM(l.weight, l.reps, l.rir);
      const cur = best.get(l.exercise_name);
      if (!cur || e > cur.e1rm) best.set(l.exercise_name, { e1rm: e, weight: l.weight, reps: l.reps });
    }
    for (const [name, b] of best) byEx.set(name, [...(byEx.get(name) ?? []), { at: s.completed_at, ...b }]);
  }
  const out: StrengthRow[] = [];
  for (const [name, list] of byEx) {
    if (list.length < 2) continue;
    list.sort((a, b) => (a.at < b.at ? -1 : 1));
    const first = list[0].e1rm;
    const last = list[list.length - 1];
    out.push({
      name,
      points: list.map((x) => Math.round(x.e1rm * 10) / 10),
      best: { weight: last.weight, reps: last.reps },
      changePct: Math.round(((last.e1rm - first) / first) * 1000) / 10,
    });
  }
  return out.sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
}
