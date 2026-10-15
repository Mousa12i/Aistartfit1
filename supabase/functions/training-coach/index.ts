import { languageInstruction } from '../_shared/language.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { AI_CONSENT_REQUIRED, hasAiConsent } from '../_shared/consent.ts';
import { COACH_CLAIMS } from './evidence.generated.ts';
import { formatTrainingContext, loadTrainingContext } from '../_shared/training-context.ts';
import { buildContext, buildSystemPrompt, parseModelJson, planExerciseIds, sanitizeReply, searchTerms, type LibraryFact } from './coach.ts';

// Training coach for the Training tab. Answers only from StartFit's verified evidence list, the
// exercise library and the person's own data; proposes plan changes as actions that the app applies
// through its validator after the person agrees. Shares OPENAI_API_KEY and the daily limits (ai_usage)
// with the other coaches, and shares the per-account memory (user_memory).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const TIER_LIMITS: Record<string, number> = { free: 5, pro: 30, plus: 100 };
const ADMIN_EMAILS = ['mossaismael551@gmail.com'];
const EXERCISE_FIELDS = 'id, name, pattern, muscles_primary, muscles_secondary, equipment_tags, safety_flags, difficulty, instructions, is_custom, created_by, is_hidden';

type ExerciseRow = {
  id: string;
  name: string;
  pattern: string | null;
  muscles_primary: string[] | null;
  muscles_secondary: string[] | null;
  equipment_tags: string[] | null;
  safety_flags: string[] | null;
  difficulty: string;
  instructions: string[] | null;
  is_custom: boolean;
  created_by: string | null;
  is_hidden: boolean;
};

const toFact = (r: ExerciseRow): LibraryFact => ({
  id: r.id,
  name: r.name,
  pattern: r.pattern,
  primary: r.muscles_primary ?? [],
  secondary: r.muscles_secondary ?? [],
  equipment: r.equipment_tags ?? [],
  flags: r.safety_flags ?? [],
  difficulty: r.difficulty,
  steps: r.instructions ?? [],
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server not properly configured' }, 500);
    if (!openAiKey) return json({ error: 'The AI coach is not configured yet (OPENAI_API_KEY is missing).' }, 503);

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
    const plan = body.plan && typeof body.plan === 'object' ? body.plan : null;
    const draft = body.draft && typeof body.draft === 'object' ? (body.draft as Record<string, unknown>) : {};
    const missing = Array.isArray(body.missing) ? (body.missing as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 12) : [];
    const historySummary = body.history && typeof body.history === 'object' ? body.history : null;

    const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    if (!(await hasAiConsent(db, user.id))) return json(AI_CONSENT_REQUIRED, 403);

    // ---- Usage limits (shared with the other coaches) ----
    const { data: profileRow } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    const tier = (profileRow?.subscription_tier as string) ?? 'free';
    const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
    const { data: usage } = await db.from('ai_usage').select('*').eq('user_id', user.id).maybeSingle();
    const now = new Date();
    const last = usage ? new Date(usage.last_request_at as string) : null;
    const sameDay = !!last && last.toDateString() === now.toDateString();
    const used = sameDay ? Number(usage?.request_count ?? 0) : 0;
    if (!isAdmin && used >= limit) {
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

    // ---- The person's data ----
    const since14 = new Date(now.getTime() - 14 * 86400000).toISOString();
    const [memoryRes, historyRes, sessionsRes, checkinsRes, painRes, nutritionRes] = await Promise.all([
      db.from('user_memory').select('category, content').eq('user_id', user.id).order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(60),
      db.from('training_coach_messages').select('role, content').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      db
        .from('workout_sessions')
        .select('plan_name, completed_at, duration_seconds')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', since14)
        .order('completed_at', { ascending: false })
        .limit(14),
      db.from('daily_checkins').select('checkin_date, sleep_hours, soreness').eq('user_id', user.id).order('checkin_date', { ascending: false }).limit(3),
      db.from('pain_logs').select('body_area, severity, created_at').eq('user_id', user.id).gte('created_at', since14).order('created_at', { ascending: false }).limit(10),
      db.from('nutrition_settings').select('goal_mode').eq('user_id', user.id).maybeSingle(),
    ]);
    const memory = ((memoryRes.error ? [] : memoryRes.data) ?? []) as { category: string; content: string }[];

    // ---- Library rows the coach may talk about ----
    const visible = (r: ExerciseRow) => !r.is_hidden && (!r.is_custom || r.created_by === user.id);
    const facts = new Map<string, LibraryFact>();
    const planIds = planExerciseIds(plan);
    if (planIds.length) {
      const { data } = await db.from('exercises').select(EXERCISE_FIELDS).in('id', planIds);
      for (const r of (data ?? []) as ExerciseRow[]) if (visible(r) || (!r.is_custom && planIds.includes(r.id))) facts.set(r.id, toFact(r));
    }
    for (const term of searchTerms(message)) {
      if (facts.size >= 90) break;
      const { data } = await db.from('exercises').select(EXERCISE_FIELDS).eq('is_hidden', false).ilike('name', `%${term}%`).limit(8);
      for (const r of (data ?? []) as ExerciseRow[]) if (visible(r)) facts.set(r.id, toFact(r));
    }
    // the curated core (first two choices of every slot) so questions in any language have a grounded pool
    const { data: core } = await db.from('exercises').select(EXERCISE_FIELDS).eq('is_hidden', false).lte('core_rank', 2).limit(80);
    for (const r of (core ?? []) as ExerciseRow[]) if (facts.size < 140 && visible(r)) facts.set(r.id, toFact(r));

    const context = buildContext({
      now: now.toISOString().slice(0, 10),
      profile: profileRow
        ? {
            age: profileRow.age ?? null,
            weight_kg: profileRow.weight_kg ?? null,
            height_cm: profileRow.height_cm ?? null,
            fitness_goal: profileRow.fitness_goal ?? null,
            experience_level: profileRow.experience_level ?? null,
          }
        : null,
      draft,
      missing,
      memory,
      plan,
      history: historySummary,
      recentSessions: ((sessionsRes.error ? [] : sessionsRes.data) ?? []).map((s: { plan_name: string | null; completed_at: string; duration_seconds: number }) => ({
        date: String(s.completed_at).slice(0, 10),
        name: s.plan_name,
        minutes: Math.round(Number(s.duration_seconds ?? 0) / 60),
      })),
      checkins: ((checkinsRes.error ? [] : checkinsRes.data) ?? []).map((c: { checkin_date: string; sleep_hours: number | null; soreness: Record<string, number> | null }) => ({
        date: c.checkin_date,
        sleep_hours: c.sleep_hours,
        soreness_count: c.soreness ? Object.values(c.soreness).filter((v) => Number(v) >= 3).length : 0,
      })),
      pain: ((painRes.error ? [] : painRes.data) ?? []).map((p: { body_area: string; severity: number | null; created_at: string }) => ({
        area: p.body_area,
        severity: p.severity,
        date: String(p.created_at).slice(0, 10),
      })),
      nutritionMode: (nutritionRes.error ? null : (nutritionRes.data?.goal_mode as string | undefined)) ?? null,
      library: [...facts.values()],
    });

    const trainingContext = await loadTrainingContext(db, user.id, now).then(formatTrainingContext).catch(() => '');

    const chatHistory = ((historyRes.error ? [] : historyRes.data) ?? [])
      .reverse()
      .map((m: { role: string; content: string }) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 3000) }));

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
        max_completion_tokens: 5000,
      }),
    });
    if (!aiResponse.ok) {
      console.error('OpenAI error', aiResponse.status, await aiResponse.text().catch(() => ''));
      return json({ error: 'The coach is temporarily unavailable. Please try again.' }, 502);
    }
    const aiData = await aiResponse.json();
    const raw: string | undefined = aiData.choices?.[0]?.message?.content;
    if (!raw) return json({ error: 'The coach did not return an answer. Please try again.' }, 502);

    const dayCount = plan && Array.isArray((plan as Record<string, unknown>).days) ? ((plan as Record<string, unknown>).days as unknown[]).length : 0;
    const reply = sanitizeReply(parseModelJson(raw), {
      claimIds: new Set(COACH_CLAIMS.map((c) => c.id)),
      exerciseIds: new Set(facts.keys()),
      dayCount,
      hasPlan: !!plan,
      existingMemory: memory.map((m) => m.content),
    });
    if (reply.dropped) console.warn(`training-coach: dropped ${reply.dropped} unsupported item(s)`);

    // ---- Memory ----
    const memorySaved: { category: string; content: string }[] = [];
    for (const m of reply.memory) {
      const { error } = await db.from('user_memory').insert({ user_id: user.id, category: m.category, content: m.content, source: 'training_coach' });
      if (!error) memorySaved.push(m);
    }

    const result = { blocks: reply.blocks, actions: reply.actions, ask: reply.ask, memorySaved };
    const text = [...reply.blocks.map((b) => b.text), ...reply.ask].join('\n\n').slice(0, 7900);
    const { error: saveError } = await db.from('training_coach_messages').insert([
      { user_id: user.id, role: 'user', content: message },
      { user_id: user.id, role: 'assistant', content: text, data: result },
    ]);
    if (saveError) console.warn('Could not save coach messages:', saveError.message);

    if (!isAdmin) {
      if (usage) {
        await db.from('ai_usage').update({ request_count: used + 1, last_request_at: now.toISOString() }).eq('user_id', user.id);
      } else {
        await db.from('ai_usage').insert({ user_id: user.id, request_count: 1, last_request_at: now.toISOString() });
      }
    }

    return json({ ...result, remaining: isAdmin ? null : Math.max(0, limit - used - 1) });
  } catch (err) {
    console.error('training-coach error:', err);
    return json({ error: 'An unexpected error occurred. Please try again.' }, 500);
  }
});
