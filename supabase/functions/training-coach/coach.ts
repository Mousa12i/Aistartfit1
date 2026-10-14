// Pure logic of the training coach (no Deno or network calls), so it can be unit-tested.
// The model may only state facts that come from (a) the evidence list, (b) the exercise library rows
// given to it, (c) the person's own data and plan. Every answer block must say which one; blocks
// that cite nothing valid are dropped by sanitizeReply before anything reaches the person.

import type { CoachClaim } from './evidence.generated.ts';

export interface LibraryFact {
  id: string;
  name: string;
  pattern: string | null;
  primary: string[];
  secondary: string[];
  equipment: string[];
  flags: string[];
  difficulty: string;
  steps: string[];
}

export type Basis = 'evidence' | 'library' | 'plan' | 'user_data' | 'general';

export interface CoachBlock {
  text: string;
  basis: Basis;
  claimIds: string[];
  exerciseIds: string[];
}

export type CoachAction =
  | { type: 'swap_exercise'; dayIndex: number; exerciseId: string; newExerciseId: string }
  | { type: 'set_sets'; dayIndex: number; exerciseId: string; sets: number }
  | { type: 'set_reps'; dayIndex: number; exerciseId: string; repsMin: number; repsMax: number }
  | { type: 'set_rest'; dayIndex: number; exerciseId: string; restSeconds: number }
  | { type: 'remove_exercise'; dayIndex: number; exerciseId: string }
  | { type: 'add_exercise'; dayIndex: number; exerciseId: string; sets: number; repsMin: number; repsMax: number; restSeconds?: number; rir?: number }
  | { type: 'move_exercise'; dayIndex: number; exerciseId: string; toIndex: number };

export const MEMORY_CATEGORIES = ['goal', 'health', 'injury', 'equipment', 'schedule', 'preference', 'training', 'nutrition', 'recovery', 'other'] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface SanitizedReply {
  blocks: CoachBlock[];
  actions: CoachAction[];
  ask: string[];
  memory: { category: MemoryCategory; content: string }[];
  dropped: number;
}

export const NO_EVIDENCE_TEXT =
  "I don't have verified evidence in StartFit's sources to answer that reliably, so I won't guess. I can help with your plan, the exercises in the library, or the topics in your plan's references.";

const STOP = new Set(
  'the a an and or for to of in on with my me i is are do does how what which why when can should best good exercise exercises workout train training muscle muscles vs versus about from this that it'.split(' '),
);

/** Words from the message worth searching the exercise library for (names are in English). */
export function searchTerms(message: string): string[] {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return [...new Set(words)].slice(0, 6);
}

export function buildSystemPrompt(claims: CoachClaim[]): string {
  const evidence = claims.map((c) => `[${c.id}] (${c.kind === 'study' ? c.refs.map((r) => r.short).join('; ') : 'StartFit design rule'}) ${c.text}`).join('\n');
  return `You are the StartFit training coach. You help one person with their training: their plan, exercise choice and technique, sets, reps, effort, rest, progression, cardio and training around aches.

STRICT RULES — answers are checked by software and anything that breaks them is deleted:
1. Only state facts that come from: the EVIDENCE list below (cite its ids), the EXERCISE LIBRARY rows in the context (cite their ids), or the person's own DATA / PLAN in the context. Never invent studies, authors, numbers, percentages or mechanisms that are not in those sources. If the sources do not cover a question, say so plainly (basis "general") and do not guess.
2. Never write a new training plan yourself. Plans are built by the StartFit plan engine from the person's answers. You may (a) explain the plan, (b) propose specific changes as "actions" using only exercise ids from the EXERCISE LIBRARY rows or the PLAN, or (c) tell the person to press "Rebuild plan" when their goal, days, time, equipment or health changed.
3. Exercise questions (what it trains, how to do it, alternatives, equipment, safety tags) must be answered from the EXERCISE LIBRARY rows only. Muscle lists use the library's primary (direct, counted as 1 set) and secondary (indirect, counted as ½ set) fields.
4. Safety first. Chest pain, fainting, unusual breathlessness, severe or worsening pain, numbness, tingling or weakness: tell the person to stop and see a clinician; do not suggest training through it. You do not diagnose. Pregnancy, under-18s, heart, metabolic, kidney or lung conditions: their clinician's advice comes first.
5. If MISSING lists information the plan needs and the person asks for a plan or plan changes, ask for the missing items (at most 2 questions, in "ask"). Do not ask for anything that is already known.
6. Memory: when the person tells you a lasting fact useful for future coaching (an injury or pain, equipment, schedule, preferences, goals, likes/dislikes), add it to "memory" in one short sentence. Never store anything the person asks you not to remember. Do not repeat facts already in MEMORY.
7. Reply in the same language the person writes in. Be brief and practical: usually 1–4 short blocks.
8. Output ONLY a JSON object with this shape:
{"blocks":[{"text":"...","basis":"evidence|library|plan|user_data|general","claim_ids":["..."],"exercise_ids":["..."]}],
 "actions":[{"type":"swap_exercise","dayIndex":0,"exerciseId":"...","newExerciseId":"..."} | {"type":"set_sets","dayIndex":0,"exerciseId":"...","sets":3} | {"type":"set_reps","dayIndex":0,"exerciseId":"...","repsMin":8,"repsMax":12} | {"type":"set_rest","dayIndex":0,"exerciseId":"...","restSeconds":120} | {"type":"remove_exercise","dayIndex":0,"exerciseId":"..."} | {"type":"add_exercise","dayIndex":0,"exerciseId":"...","sets":3,"repsMin":8,"repsMax":12}],
 "ask":["..."],
 "memory":[{"category":"goal|health|injury|equipment|schedule|preference|training|nutrition|recovery|other","content":"..."}]}
A block with basis "evidence" must list at least one claim id; "library" must list at least one exercise id. Use "general" only for greetings, clarifying questions, encouragement or saying that something is not covered — never for facts.

EVIDENCE (the only scientific statements you may make):
${evidence}`;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function int(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
}

export function parseModelJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    const v = JSON.parse(trimmed);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const v = JSON.parse(trimmed.slice(start, end + 1));
        return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function sanitizeAction(raw: unknown, ok: { exerciseIds: Set<string>; dayCount: number }): CoachAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const dayIndex = int(a.dayIndex);
  if (dayIndex == null || dayIndex < 0 || dayIndex >= Math.max(1, ok.dayCount)) return null;
  const exerciseId = str(a.exerciseId, 80);
  if (!ok.exerciseIds.has(exerciseId)) return null;
  switch (a.type) {
    case 'swap_exercise': {
      const newExerciseId = str(a.newExerciseId, 80);
      if (!ok.exerciseIds.has(newExerciseId) || newExerciseId === exerciseId) return null;
      return { type: 'swap_exercise', dayIndex, exerciseId, newExerciseId };
    }
    case 'set_sets': {
      const sets = int(a.sets);
      return sets != null && sets >= 1 && sets <= 6 ? { type: 'set_sets', dayIndex, exerciseId, sets } : null;
    }
    case 'set_reps': {
      const repsMin = int(a.repsMin);
      const repsMax = int(a.repsMax);
      return repsMin != null && repsMax != null && repsMin >= 1 && repsMin <= repsMax && repsMax <= 600 ? { type: 'set_reps', dayIndex, exerciseId, repsMin, repsMax } : null;
    }
    case 'set_rest': {
      const restSeconds = int(a.restSeconds);
      return restSeconds != null && restSeconds >= 15 && restSeconds <= 300 ? { type: 'set_rest', dayIndex, exerciseId, restSeconds } : null;
    }
    case 'remove_exercise':
      return { type: 'remove_exercise', dayIndex, exerciseId };
    case 'move_exercise': {
      const toIndex = int(a.toIndex);
      return toIndex != null && toIndex >= 0 && toIndex < 20 ? { type: 'move_exercise', dayIndex, exerciseId, toIndex } : null;
    }
    case 'add_exercise': {
      const sets = int(a.sets);
      const repsMin = int(a.repsMin);
      const repsMax = int(a.repsMax);
      if (sets == null || sets < 1 || sets > 6 || repsMin == null || repsMax == null || repsMin < 1 || repsMin > repsMax || repsMax > 600) return null;
      const restSeconds = int(a.restSeconds);
      const rir = int(a.rir);
      return {
        type: 'add_exercise',
        dayIndex,
        exerciseId,
        sets,
        repsMin,
        repsMax,
        ...(restSeconds != null && restSeconds >= 15 && restSeconds <= 300 ? { restSeconds } : {}),
        ...(rir != null && rir >= 0 && rir <= 5 ? { rir } : {}),
      };
    }
    default:
      return null;
  }
}

export function sanitizeReply(
  parsed: Record<string, unknown> | null,
  ok: { claimIds: Set<string>; exerciseIds: Set<string>; dayCount: number; hasPlan: boolean; existingMemory: string[] },
): SanitizedReply {
  const blocks: CoachBlock[] = [];
  let dropped = 0;
  let generalCount = 0;
  const rawBlocks = Array.isArray(parsed?.blocks) ? (parsed!.blocks as unknown[]).slice(0, 8) : [];
  for (const rb of rawBlocks) {
    if (!rb || typeof rb !== 'object') {
      dropped++;
      continue;
    }
    const b = rb as Record<string, unknown>;
    const text = str(b.text, 1500);
    const basis = (['evidence', 'library', 'plan', 'user_data', 'general'] as Basis[]).includes(b.basis as Basis) ? (b.basis as Basis) : null;
    const claimIds = (Array.isArray(b.claim_ids) ? b.claim_ids : []).map((x) => str(x, 60)).filter((x) => ok.claimIds.has(x));
    const exerciseIds = (Array.isArray(b.exercise_ids) ? b.exercise_ids : []).map((x) => str(x, 80)).filter((x) => ok.exerciseIds.has(x));
    if (!text || !basis) {
      dropped++;
      continue;
    }
    if (basis === 'evidence' && claimIds.length === 0) {
      dropped++;
      continue;
    }
    if (basis === 'library' && exerciseIds.length === 0) {
      dropped++;
      continue;
    }
    if (basis === 'plan' && !ok.hasPlan) {
      dropped++;
      continue;
    }
    if (basis === 'general') {
      generalCount++;
      if (generalCount > 2 || text.length > 600) {
        dropped++;
        continue;
      }
    }
    blocks.push({ text, basis, claimIds: [...new Set(claimIds)], exerciseIds: [...new Set(exerciseIds)] });
  }

  const actions: CoachAction[] = [];
  if (ok.hasPlan && Array.isArray(parsed?.actions)) {
    for (const ra of (parsed!.actions as unknown[]).slice(0, 8)) {
      const a = sanitizeAction(ra, { exerciseIds: ok.exerciseIds, dayCount: ok.dayCount });
      if (a) actions.push(a);
      else dropped++;
    }
  }

  const ask = (Array.isArray(parsed?.ask) ? parsed!.ask : []).map((q) => str(q, 300)).filter(Boolean).slice(0, 2);

  const known = new Set(ok.existingMemory.map((m) => m.toLowerCase().trim()));
  const memory: { category: MemoryCategory; content: string }[] = [];
  for (const rm of Array.isArray(parsed?.memory) ? (parsed!.memory as unknown[]).slice(0, 3) : []) {
    if (!rm || typeof rm !== 'object') continue;
    const m = rm as Record<string, unknown>;
    const category = (MEMORY_CATEGORIES as readonly string[]).includes(m.category as string) ? (m.category as MemoryCategory) : null;
    const content = str(m.content, 300);
    if (!category || !content || known.has(content.toLowerCase())) continue;
    known.add(content.toLowerCase());
    memory.push({ category, content });
  }

  if (blocks.length === 0 && ask.length === 0) {
    blocks.push({ text: NO_EVIDENCE_TEXT, basis: 'general', claimIds: [], exerciseIds: [] });
  }
  return { blocks, actions, ask, memory, dropped };
}

export interface ContextInput {
  now: string;
  profile: { age: number | null; weight_kg: number | null; height_cm: number | null; fitness_goal: string | null; experience_level: string | null } | null;
  draft: Record<string, unknown>;
  missing: string[];
  memory: { category: string; content: string }[];
  plan: unknown;
  history: unknown;
  recentSessions: { date: string; name: string | null; minutes: number }[];
  checkins: { date: string; sleep_hours: number | null; soreness_count: number }[];
  pain: { area: string; severity: number | null; date: string }[];
  nutritionMode: string | null;
  library: LibraryFact[];
}

/** Keeps the plan small enough to send: ids, names and prescriptions only. */
export function compactPlan(plan: unknown): unknown {
  if (!plan || typeof plan !== 'object') return null;
  const p = plan as Record<string, unknown>;
  const days = Array.isArray(p.days) ? (p.days as Record<string, unknown>[]) : [];
  return {
    title: p.title,
    goal: p.effectiveGoal ?? p.goal,
    level: p.level,
    strengthDays: p.strengthDays,
    sessionMinutes: p.sessionMinutes,
    days: days.slice(0, 7).map((d) => ({
      dayIndex: d.index,
      label: d.label,
      exercises: (Array.isArray(d.exercises) ? (d.exercises as Record<string, unknown>[]) : []).slice(0, 12).map((e) => ({
        id: e.exerciseId,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        rir: e.rir,
        rest: e.restSeconds,
        alternatives: Array.isArray(e.alternatives) ? (e.alternatives as Record<string, unknown>[]).slice(0, 4).map((a) => ({ id: a.exerciseId, name: a.name })) : [],
      })),
    })),
    volume: Array.isArray(p.volume) ? (p.volume as Record<string, unknown>[]).map((v) => `${v.label}: ${v.sets} sets (target ${v.low}-${v.high})`) : [],
    cardioMinutesPerWeek: p.cardioMinutesPerWeek,
    notes: Array.isArray(p.notes) ? (p.notes as Record<string, unknown>[]).map((n) => n.text).slice(0, 8) : [],
  };
}

/** Exercise ids the plan refers to (exercises and their listed alternatives). */
export function planExerciseIds(plan: unknown): string[] {
  const out = new Set<string>();
  const days = plan && typeof plan === 'object' && Array.isArray((plan as Record<string, unknown>).days) ? ((plan as Record<string, unknown>).days as Record<string, unknown>[]) : [];
  for (const d of days) {
    for (const e of Array.isArray(d.exercises) ? (d.exercises as Record<string, unknown>[]) : []) {
      if (typeof e.exerciseId === 'string') out.add(e.exerciseId);
      for (const a of Array.isArray(e.alternatives) ? (e.alternatives as Record<string, unknown>[]) : []) if (typeof a.exerciseId === 'string') out.add(a.exerciseId);
    }
  }
  return [...out].slice(0, 200);
}

export function buildContext(c: ContextInput): string {
  const lines: string[] = [];
  lines.push(`TODAY: ${c.now}`);
  lines.push(`PROFILE: ${JSON.stringify(c.profile ?? {})}`);
  lines.push(`ANSWERS SO FAR: ${JSON.stringify(c.draft).slice(0, 3000)}`);
  lines.push(`MISSING: ${c.missing.length ? c.missing.join(', ') : 'nothing'}`);
  lines.push(`NUTRITION GOAL: ${c.nutritionMode ?? 'not set'}`);
  lines.push(`MEMORY: ${c.memory.length ? c.memory.map((m) => `- (${m.category}) ${m.content}`).join('\n') : 'none'}`);
  lines.push(`PLAN: ${c.plan ? JSON.stringify(compactPlan(c.plan)).slice(0, 9000) : 'no plan yet'}`);
  lines.push(`TRAINING HISTORY SUMMARY: ${c.history ? JSON.stringify(c.history).slice(0, 2500) : 'none'}`);
  lines.push(`RECENT SESSIONS: ${c.recentSessions.length ? c.recentSessions.map((s) => `${s.date} ${s.name ?? 'Workout'} ${s.minutes} min`).join('; ') : 'none'}`);
  lines.push(`RECENT CHECK-INS: ${c.checkins.length ? c.checkins.map((k) => `${k.date} sleep ${k.sleep_hours ?? '?'} h, sore areas ${k.soreness_count}`).join('; ') : 'none'}`);
  lines.push(`RECENT PAIN LOGS: ${c.pain.length ? c.pain.map((p) => `${p.date} ${p.area} ${p.severity ?? '?'}/10`).join('; ') : 'none'}`);
  lines.push('EXERCISE LIBRARY ROWS (id | name | pattern | primary | secondary | equipment | safety tags | level | how):');
  for (const f of c.library) {
    lines.push(
      `${f.id} | ${f.name} | ${f.pattern ?? '-'} | ${f.primary.join(',') || '-'} | ${f.secondary.join(',') || '-'} | ${f.equipment.join(',') || '-'} | ${f.flags.join(',') || 'none'} | ${f.difficulty} | ${f.steps.slice(0, 4).join(' ').slice(0, 400)}`,
    );
  }
  return lines.join('\n');
}
