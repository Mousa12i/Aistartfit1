// Shared by every coach: what the person is training with right now. Read straight from the database, so
// the coaches always see the same thing as the app (gym or home version of the routine, its exercises,
// sessions shortened with "Short on time", and an active lighter week).

export interface ActiveRoutineFacts {
  name: string;
  assignedAt: string | null;
  home: { sourceName: string; equipment: string[] } | null;
  /** Day label -> exercises ("name sets×reps"). */
  days: { label: string; exercises: string[] }[];
}

export interface TrainingContextFacts {
  routine: ActiveRoutineFacts | null;
  shortened: { date: string; note: string }[];
  lighterWeek: { startsOn: string; endsOn: string } | null;
}

const EQUIP: Record<string, string> = {
  bodyweight: 'body weight', dumbbell: 'dumbbells', barbell: 'barbell', ez_bar: 'EZ bar', rack: 'squat rack', bench: 'bench',
  kettlebell: 'kettlebell', band: 'resistance band', pullup_bar: 'pull-up bar', dip_bars: 'dip bars', box: 'box/step',
  suspension: 'suspension trainer', rings: 'rings', ab_wheel: 'ab wheel', exercise_ball: 'exercise ball', landmine: 'landmine',
};

/** Plain-text block for a coach's context. */
export function formatTrainingContext(f: TrainingContextFacts): string {
  const lines: string[] = [];
  if (!f.routine) {
    lines.push('ACTIVE ROUTINE: none chosen.');
  } else {
    const r = f.routine;
    const since = r.assignedAt ? ` (active since ${r.assignedAt.slice(0, 10)})` : '';
    if (r.home) {
      lines.push(
        `ACTIVE ROUTINE: "${r.name}"${since} — this is the HOME VERSION of the gym routine "${r.home.sourceName}". The person is training at home with: ${r.home.equipment.map((e) => EQUIP[e] ?? e).join(', ')}. Only suggest exercises and changes that work with this equipment; the gym routine is still saved and can be switched back to on the routine page ("Back to gym").`,
      );
    } else {
      lines.push(`ACTIVE ROUTINE: "${r.name}"${since}.`);
    }
    for (const d of r.days.slice(0, 7)) lines.push(`  ${d.label}: ${d.exercises.slice(0, 12).join('; ')}`);
  }
  if (f.shortened.length) {
    lines.push(`SESSIONS SHORTENED WITH "SHORT ON TIME" (last 14 days): ${f.shortened.map((s) => `${s.date} ${s.note}`).join(' | ')}`);
  }
  if (f.lighterWeek) lines.push(`LIGHTER WEEK ACTIVE: ${f.lighterWeek.startsOn} to ${f.lighterWeek.endsOn} (about half the usual sets, 3–4 reps in reserve).`);
  return lines.join('\n');
}

export const SHORT_ON_TIME_PREFIX = 'Short on time:';

type Row = Record<string, unknown>;
// deno-lint-ignore no-explicit-any
type Db = any;

/** Loads the facts with the service-role client, always filtered by the person's id. */
export async function loadTrainingContext(db: Db, userId: string, now = new Date()): Promise<TrainingContextFacts> {
  const today = now.toISOString().slice(0, 10);
  const since14 = new Date(now.getTime() - 14 * 86400000).toISOString();
  const [assignRes, sessRes, deloadRes] = await Promise.all([
    db.from('user_plan_assignments').select('plan_id, assigned_at').eq('user_id', userId).is('completed_at', null).order('assigned_at', { ascending: false }).limit(1),
    db.from('workout_sessions').select('completed_at, notes').eq('user_id', userId).eq('status', 'completed').gte('completed_at', since14).like('notes', `${SHORT_ON_TIME_PREFIX}%`).order('completed_at', { ascending: false }).limit(10),
    db.from('recovery_adjustments').select('starts_on, ends_on').eq('user_id', userId).eq('status', 'active').lte('starts_on', today).gte('ends_on', today).limit(1),
  ]);
  let routine: ActiveRoutineFacts | null = null;
  const assign = ((assignRes.error ? [] : assignRes.data) ?? [])[0] as Row | undefined;
  if (assign?.plan_id) {
    const [planRes, exRes] = await Promise.all([
      db.from('workout_plans').select('name, details').eq('id', assign.plan_id).maybeSingle(),
      db.from('workout_plan_exercises').select('sets, reps, day_index, day_label, exercise_order, exercise:exercises!workout_plan_exercises_exercise_id_fkey(name)').eq('plan_id', assign.plan_id).order('day_index').order('exercise_order').limit(150),
    ]);
    const plan = planRes.error ? null : (planRes.data as Row | null);
    if (plan) {
      const variant = (plan.details as { variant?: { kind?: string; sourceName?: string; equipment?: string[] } } | null)?.variant;
      const days = new Map<number, { label: string; exercises: string[] }>();
      for (const e of ((exRes.error ? [] : exRes.data) ?? []) as Row[]) {
        const d = Number(e.day_index ?? 0);
        const entry = days.get(d) ?? { label: (e.day_label as string | null) ?? `Day ${d + 1}`, exercises: [] };
        const name = ((e.exercise as { name?: string } | null)?.name) ?? 'Exercise';
        entry.exercises.push(`${name} ${e.sets}×${e.reps}`);
        days.set(d, entry);
      }
      routine = {
        name: String(plan.name ?? 'Routine'),
        assignedAt: (assign.assigned_at as string | null) ?? null,
        home: variant?.kind === 'home' ? { sourceName: variant.sourceName ?? 'gym routine', equipment: variant.equipment ?? [] } : null,
        days: [...days.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v),
      };
    }
  }
  const shortened = (((sessRes.error ? [] : sessRes.data) ?? []) as Row[]).map((s) => ({ date: String(s.completed_at).slice(0, 10), note: String(s.notes).slice(SHORT_ON_TIME_PREFIX.length).trim().slice(0, 160) }));
  const dl = ((deloadRes.error ? [] : deloadRes.data) ?? [])[0] as Row | undefined;
  return { routine, shortened, lighterWeek: dl ? { startsOn: String(dl.starts_on), endsOn: String(dl.ends_on) } : null };
}
