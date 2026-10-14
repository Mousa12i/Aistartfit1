// Pure logic of the recovery coach (no Deno or network calls), so it can be unit-tested.
// The model may only state facts from (a) StartFit's verified recovery evidence list, (b) the person's own
// recovery data in the context. Every answer block says which; blocks that cite nothing valid are dropped.
// Red-flag symptoms in the message always get a fixed safety answer first, whatever the model says.

import type { CoachClaim } from './evidence.generated.ts';

export type Basis = 'evidence' | 'user_data' | 'general';

export interface CoachBlock {
  text: string;
  basis: Basis;
  claimIds: string[];
}

/** In-app shortcuts the coach may offer (validated against this list). */
export const LINKS = ['checkin', 'rate_session', 'triage', 'return_to_training', 'methods', 'deload', 'sleep', 'report_pdf', 'nutrition'] as const;
export type CoachLink = (typeof LINKS)[number];

export const MEMORY_CATEGORIES = ['goal', 'health', 'injury', 'equipment', 'schedule', 'preference', 'training', 'nutrition', 'recovery', 'other'] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface SanitizedReply {
  blocks: CoachBlock[];
  links: CoachLink[];
  memory: { category: MemoryCategory; content: string }[];
  safety: boolean;
  dropped: number;
}

export const NO_EVIDENCE_TEXT =
  "I don't have verified evidence in StartFit's recovery sources to answer that reliably, so I won't guess. I can explain your recovery data, today's decision, sleep, training load, soreness, recovery methods and returning after pain.";

export const SAFETY_TEXT =
  'What you describe can be a warning sign. Stop training today and get medical help: seek urgent care now for chest pain, fainting, trouble breathing, or dark (tea- or cola-coloured) urine with muscle pain or weakness. The Recovery Doctor cannot diagnose this.';

// English and Arabic phrases for red-flag symptoms (lower-cased match).
const RED_FLAG_PATTERNS: RegExp[] = [
  /chest pain|pain in (my )?chest|ألم (في )?(ال)?صدر|وجع (ب|في )?(ال)?صدر/,
  /faint|passed out|blacked out|أغمي|اغمي|إغماء|اغماء|فقدت الوعي/,
  /urine.{0,20}(dark|brown|cola|tea)|(dark|brown|cola|tea)[- a-z]{0,20}urine|pee.{0,15}(dark|brown)|بول (غامق|داكن|بني|لونه غامق)|لون البول (غامق|داكن|بني)/,
  /can'?t breathe|short(ness)? of breath at rest|ضيق (في )?(ال)?تنفس|ما (عم )?(بقدر|اقدر) اتنفس/,
  /numb|tingling|خدر|تنميل/,
  /(knee|joint|ankle) (gave|gives) way|الركبة (تفلت|خانتني)|المفصل (يفلت|خانني)/,
];

export function hasRedFlag(message: string): boolean {
  const m = message.toLowerCase();
  return RED_FLAG_PATTERNS.some((p) => p.test(m));
}

export function buildSystemPrompt(claims: CoachClaim[]): string {
  const evidence = claims.map((c) => `[${c.id}] (${c.kind === 'study' ? c.refs.map((r) => r.short).join('; ') : 'StartFit design rule'}) ${c.text}`).join('\n');
  return `You are the StartFit Recovery Doctor's coach: a recovery specialist for one person. You help with recovery between workouts, today's training decision, sleep, training load, muscle soreness, overreaching and lighter weeks, recovery methods, aches and returning to training after pain. You are not a physician: you never diagnose, and you never tell someone to train through red-flag symptoms.

STRICT RULES — answers are checked by software and anything that breaks them is deleted:
1. Only state facts from the EVIDENCE list below (cite its ids) or from the person's DATA in the context. Never invent studies, authors, numbers, percentages, mechanisms, supplements or treatments that are not there. If the sources do not cover a question, say so plainly (basis "general") and do not guess.
2. Always ground advice in the person's DATA when it is relevant: today's decision and its reasons, check-in vs their own baseline, sleep, session RPE load, monotony, muscle recovery estimates (these are estimates, say so), performance trends, pain reports, return-to-training stage. Quote their actual numbers. If the data needed is missing, say what to log (use "links").
3. Distinguish study findings from StartFit rules: when you use a claim whose source is "StartFit design rule", say it is StartFit's rule.
4. Safety first. Chest pain, fainting, breathlessness, dark or cola-coloured urine with muscle pain or weakness, numbness, tingling, a joint giving way, severe, worsening or sudden sharp pain: tell the person to stop and get medical help. Pregnancy, under-18s, heart, metabolic, kidney or lung conditions: their clinician comes first. Never suggest medicines or doses.
5. Do not change training plans yourself; you may suggest the in-app tools via "links".
6. Memory: when the person tells you a lasting fact useful for future coaching (an injury, a condition, sleep situation, schedule, preferences), add it to "memory" in one short sentence. Never store anything they ask you not to remember, and nothing already in MEMORY.
7. Reply in the same language the person writes in (Arabic in Arabic). Be brief and practical: usually 1–4 short blocks.
8. Output ONLY a JSON object:
{"blocks":[{"text":"...","basis":"evidence|user_data|general","claim_ids":["..."]}],
 "links":["checkin|rate_session|triage|return_to_training|methods|deload|sleep|report_pdf|nutrition"],
 "memory":[{"category":"goal|health|injury|equipment|schedule|preference|training|nutrition|recovery|other","content":"..."}]}
A block with basis "evidence" must list at least one claim id. Use "general" only for greetings, clarifying questions, encouragement or saying that something is not covered — never for facts.

EVIDENCE (the only scientific statements you may make):
${evidence}`;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function parseModelJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const tryParse = (t: string) => {
    try {
      const v = JSON.parse(t);
      return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(trimmed);
  if (direct) return direct;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start ? tryParse(trimmed.slice(start, end + 1)) : null;
}

export function sanitizeReply(
  parsed: Record<string, unknown> | null,
  ok: { claimIds: Set<string>; existingMemory: string[]; redFlag: boolean },
): SanitizedReply {
  const blocks: CoachBlock[] = [];
  let dropped = 0;
  let generalCount = 0;
  if (ok.redFlag) blocks.push({ text: SAFETY_TEXT, basis: 'evidence', claimIds: ['triage_rule', 'rhabdo_signs'].filter((id) => ok.claimIds.has(id)) });

  for (const rb of Array.isArray(parsed?.blocks) ? (parsed!.blocks as unknown[]).slice(0, 8) : []) {
    if (!rb || typeof rb !== 'object') {
      dropped++;
      continue;
    }
    const b = rb as Record<string, unknown>;
    const text = str(b.text, 1500);
    const basis = (['evidence', 'user_data', 'general'] as Basis[]).includes(b.basis as Basis) ? (b.basis as Basis) : null;
    const claimIds = (Array.isArray(b.claim_ids) ? b.claim_ids : []).map((x) => str(x, 60)).filter((x) => ok.claimIds.has(x));
    if (!text || !basis || (basis === 'evidence' && claimIds.length === 0)) {
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
    blocks.push({ text, basis, claimIds: [...new Set(claimIds)] });
  }

  const links = [...new Set((Array.isArray(parsed?.links) ? parsed!.links : []).map((x) => str(x, 40)))].filter((x): x is CoachLink => (LINKS as readonly string[]).includes(x)).slice(0, 3);
  if (ok.redFlag && !links.includes('triage')) links.unshift('triage');

  const known = new Set(ok.existingMemory.map((m) => m.toLowerCase().trim()));
  const memory: SanitizedReply['memory'] = [];
  for (const rm of Array.isArray(parsed?.memory) ? (parsed!.memory as unknown[]).slice(0, 3) : []) {
    if (!rm || typeof rm !== 'object') continue;
    const m = rm as Record<string, unknown>;
    const category = (MEMORY_CATEGORIES as readonly string[]).includes(m.category as string) ? (m.category as MemoryCategory) : null;
    const content = str(m.content, 300);
    if (!category || !content || known.has(content.toLowerCase())) continue;
    known.add(content.toLowerCase());
    memory.push({ category, content });
  }

  if (blocks.length === 0) blocks.push({ text: NO_EVIDENCE_TEXT, basis: 'general', claimIds: [] });
  return { blocks, links: links.slice(0, 3), memory, safety: ok.redFlag, dropped };
}

export interface ContextInput {
  now: string;
  profile: { age: number | null; sex: string | null; weight_kg: number | null; fitness_goal: string | null; experience_level: string | null } | null;
  memory: { category: string; content: string }[];
  /** Summary the app computed from the same data (decision, baseline, load, muscles…). */
  snapshot: unknown;
  checkins: Record<string, unknown>[];
  sessions: { date: string; name: string | null; minutes: number; rpe: number | null }[];
  pain: { date: string; area: string; severity: number | null; triage: string; notes: string | null }[];
  rtt: { area: string; stage: number; status: string }[];
  deloads: { starts_on: string; ends_on: string; status: string }[];
}

export function buildContext(c: ContextInput): string {
  const lines: string[] = [];
  lines.push(`TODAY: ${c.now}`);
  lines.push(`PROFILE: ${JSON.stringify(c.profile ?? {})}`);
  lines.push(`MEMORY: ${c.memory.length ? c.memory.map((m) => `- (${m.category}) ${m.content}`).join('\n') : 'none'}`);
  lines.push(`APP SUMMARY (computed by StartFit from the data below): ${c.snapshot ? JSON.stringify(c.snapshot).slice(0, 6000) : 'not sent'}`);
  lines.push(
    `CHECK-INS (date, sleep h, wellness 1–5 sleep/energy/soreness/stress/mood, 5 = best): ${
      c.checkins.length
        ? c.checkins
            .map((k) => `${k.checkin_date} sleep ${k.sleep_hours ?? '?'}h, w ${[k.wellness_sleep, k.wellness_energy, k.wellness_soreness, k.wellness_stress, k.wellness_mood].map((x) => x ?? '-').join('/')}`)
            .join('; ')
        : 'none'
    }`,
  );
  lines.push(`SESSIONS (date, name, minutes, session RPE 0–10): ${c.sessions.length ? c.sessions.map((s) => `${s.date} ${s.name ?? 'Workout'} ${s.minutes}min RPE ${s.rpe ?? 'not rated'}`).join('; ') : 'none'}`);
  lines.push(`PAIN REPORTS: ${c.pain.length ? c.pain.map((p) => `${p.date} ${p.area} ${p.severity ?? '?'}/10 triage ${p.triage}${p.notes ? ` (${p.notes.slice(0, 120)})` : ''}`).join('; ') : 'none'}`);
  lines.push(`RETURN-TO-TRAINING: ${c.rtt.length ? c.rtt.map((r) => `${r.area} stage ${r.stage}/4 ${r.status}`).join('; ') : 'none'}`);
  lines.push(`LIGHTER WEEKS: ${c.deloads.length ? c.deloads.map((d) => `${d.starts_on}→${d.ends_on} ${d.status}`).join('; ') : 'none'}`);
  return lines.join('\n');
}
