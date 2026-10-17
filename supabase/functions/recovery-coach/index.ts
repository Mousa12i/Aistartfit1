import { languageInstruction } from '../_shared/language.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { AI_CONSENT_REQUIRED, hasAiConsent } from '../_shared/consent.ts';
import { effectiveTier } from '../_shared/tier.ts';
import { COACH_CLAIMS } from './evidence.generated.ts';
import { formatTrainingContext, loadTrainingContext } from '../_shared/training-context.ts';
import { buildContext, buildSystemPrompt, hasRedFlag, parseModelJson, sanitizeReply } from './coach.ts';

// Recovery coach for the Recovery Doctor. Answers only from StartFit's verified recovery evidence list and
// the person's own recovery data; red-flag symptoms always get a fixed safety answer. Shares OPENAI_API_KEY,
// the daily limits (ai_usage) and the per-account memory (user_memory) with the other coaches.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const TIER_LIMITS: Record<string, number> = { free: 5, pro: 30, plus: 100 };
const ADMIN_EMAILS = ['mossaismael551@gmail.com'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server not properly configured' }, 500);
    if (!openAiKey) return json({ error: 'The recovery coach is not configured yet (OPENAI_API_KEY is missing).' }, 503);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required' }, 401);
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (authError || !user) return json({ error: 'Invalid authentication' }, 401);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
    if (!message) return json({ error: 'Message is required' }, 400);
    const snapshot = body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : null;

    const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    if (!(await hasAiConsent(db, user.id))) {
      // Red-flag safety advice never needs the AI provider, so it is given even without that permission.
      if (hasRedFlag(message)) {
        const safe = sanitizeReply(null, { claimIds: new Set(COACH_CLAIMS.map((c) => c.id)), existingMemory: [], redFlag: true });
        return json({ blocks: safe.blocks, links: safe.links, memorySaved: [], safety: true, remaining: null });
      }
      return json(AI_CONSENT_REQUIRED, 403);
    }

    // ---- Usage limits (shared with the other coaches) ----
    const { data: profileRow } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    // An ended 24h pass counts as free straight away (the expire_daily_passes job tidies the row).
    const tier: string = effectiveTier(profileRow);
    const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
    const isAdmin = !!user.email_confirmed_at && ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
    const { data: usage } = await db.from('ai_usage').select('*').eq('user_id', user.id).maybeSingle();
    const now = new Date();
    const last = usage ? new Date(usage.last_request_at as string) : null;
    const sameDay = !!last && last.toDateString() === now.toDateString();
    const used = sameDay ? Number(usage?.request_count ?? 0) : 0;
    const redFlag = hasRedFlag(message);
    if (!isAdmin && used >= limit) {
      // Safety answers are never blocked by the daily limit.
      if (redFlag) {
        const reply = sanitizeReply(null, { claimIds: new Set(COACH_CLAIMS.map((c) => c.id)), existingMemory: [], redFlag: true });
        return json({ blocks: reply.blocks, links: reply.links, memorySaved: [], safety: true, remaining: 0 });
      }
      return json(
        {
          error: 'daily_limit_reached',
          limit,
          tier,
          message: `You've used all ${limit} coach actions for today on the ${tier === 'free' ? 'Free' : tier === 'pro' ? 'Pro' : 'Pro+'} plan.`,
          upgrade_text: tier === 'free' ? 'Upgrade to Pro for 30 daily actions, or Pro+ for 100.' : tier === 'pro' ? 'Upgrade to Pro+ for 100 daily actions.' : 'Your limit resets tomorrow.',
        },
        429,
      );
    }

    // ---- The person's recovery data ----
    const since28 = new Date(now.getTime() - 28 * 86400000).toISOString();
    const [memoryRes, historyRes, checkinsRes, sessionsRes, painRes, rttRes, deloadRes] = await Promise.all([
      db.from('user_memory').select('category, content').eq('user_id', user.id).order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(60),
      db.from('recovery_coach_messages').select('role, content').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      db
        .from('daily_checkins')
        .select('checkin_date, sleep_hours, wellness_sleep, wellness_energy, wellness_soreness, wellness_stress, wellness_mood')
        .eq('user_id', user.id)
        .gte('checkin_date', since28.slice(0, 10))
        .order('checkin_date', { ascending: false })
        .limit(28),
      db
        .from('workout_sessions')
        .select('plan_name, completed_at, duration_seconds, session_rpe')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', since28)
        .order('completed_at', { ascending: false })
        .limit(30),
      db.from('pain_logs').select('body_area, severity, triage_level, notes, recorded_at').eq('user_id', user.id).gte('recorded_at', since28).order('recorded_at', { ascending: false }).limit(10),
      db.from('rtt_programmes').select('area, stage, status').eq('user_id', user.id).order('started_at', { ascending: false }).limit(5),
      db.from('recovery_adjustments').select('starts_on, ends_on, status').eq('user_id', user.id).order('starts_on', { ascending: false }).limit(5),
    ]);
    const rows = <T,>(r: { data: unknown; error: unknown }): T[] => (r.error ? [] : ((r.data as T[]) ?? []));
    const memory = rows<{ category: string; content: string }>(memoryRes);

    const context = buildContext({
      now: now.toISOString().slice(0, 10),
      profile: profileRow
        ? {
            age: profileRow.age ?? null,
            sex: profileRow.sex ?? profileRow.gender ?? null,
            weight_kg: profileRow.weight_kg ?? null,
            fitness_goal: profileRow.fitness_goal ?? null,
            experience_level: profileRow.experience_level ?? null,
          }
        : null,
      memory,
      snapshot,
      checkins: rows<Record<string, unknown>>(checkinsRes),
      sessions: rows<{ plan_name: string | null; completed_at: string; duration_seconds: number; session_rpe: number | null }>(sessionsRes).map((s) => ({
        date: String(s.completed_at).slice(0, 10),
        name: s.plan_name,
        minutes: Math.round(Number(s.duration_seconds ?? 0) / 60),
        rpe: s.session_rpe ?? null,
      })),
      pain: rows<{ body_area: string; severity: number | null; triage_level: string; notes: string | null; recorded_at: string }>(painRes).map((p) => ({
        date: String(p.recorded_at).slice(0, 10),
        area: p.body_area,
        severity: p.severity,
        triage: p.triage_level,
        notes: p.notes,
      })),
      rtt: rows<{ area: string; stage: number; status: string }>(rttRes),
      deloads: rows<{ starts_on: string; ends_on: string; status: string }>(deloadRes),
    });

    const trainingContext = await loadTrainingContext(db, user.id, now).then(formatTrainingContext).catch(() => '');

    const chatHistory = rows<{ role: string; content: string }>(historyRes)
      .reverse()
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 3000) }));

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: 'o3-mini',
        messages: [
          { role: 'system', content: `${buildSystemPrompt(COACH_CLAIMS)}\n\n${languageInstruction(profileRow?.preferred_language)}\n\n=== CONTEXT ===\n${context}\n${trainingContext}` },
          ...chatHistory,
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: 'medium',
        max_completion_tokens: 4000,
      }),
    });
    let parsed: Record<string, unknown> | null = null;
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const raw: string | undefined = aiData.choices?.[0]?.message?.content;
      parsed = raw ? parseModelJson(raw) : null;
    } else {
      console.error('OpenAI error', aiResponse.status, await aiResponse.text().catch(() => ''));
      if (!redFlag) return json({ error: 'The coach is temporarily unavailable. Please try again.' }, 502);
    }

    const reply = sanitizeReply(parsed, { claimIds: new Set(COACH_CLAIMS.map((c) => c.id)), existingMemory: memory.map((m) => m.content), redFlag });
    if (reply.dropped) console.warn(`recovery-coach: dropped ${reply.dropped} unsupported item(s)`);

    const memorySaved: { category: string; content: string }[] = [];
    for (const m of reply.memory) {
      const { error } = await db.from('user_memory').insert({ user_id: user.id, category: m.category, content: m.content, source: 'recovery_coach' });
      if (!error) memorySaved.push(m);
    }

    const result = { blocks: reply.blocks, links: reply.links, memorySaved, safety: reply.safety };
    const text = reply.blocks.map((b) => b.text).join('\n\n').slice(0, 7900);
    const { error: saveError } = await db.from('recovery_coach_messages').insert([
      { user_id: user.id, role: 'user', content: message },
      { user_id: user.id, role: 'assistant', content: text, data: result },
    ]);
    if (saveError) console.warn('Could not save coach messages:', saveError.message);

    if (!isAdmin) {
      if (usage) await db.from('ai_usage').update({ request_count: used + 1, last_request_at: now.toISOString() }).eq('user_id', user.id);
      else await db.from('ai_usage').insert({ user_id: user.id, request_count: 1, last_request_at: now.toISOString() });
    }

    return json({ ...result, remaining: isAdmin ? null : Math.max(0, limit - used - 1) });
  } catch (err) {
    console.error('recovery-coach error:', err);
    return json({ error: 'An unexpected error occurred. Please try again.' }, 500);
  }
});
