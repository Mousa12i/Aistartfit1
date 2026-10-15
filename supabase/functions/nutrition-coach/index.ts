import { languageInstruction } from '../_shared/language.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { AI_CONSENT_REQUIRED, hasAiConsent } from '../_shared/consent.ts';
import { formatTrainingContext, loadTrainingContext } from '../_shared/training-context.ts';
import { buildContext, buildSystemPrompt, deriveFlags, type MealRow, type ProfileRow, type SettingsRow, type TargetsSnapshot } from './context.ts';

// AI nutrition coach for the Nutrition tab. Uses the same OPENAI_API_KEY secret
// and the same daily usage limits (ai_usage) as the main AI Coach.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const TIER_LIMITS: Record<string, number> = { free: 5, pro: 30, plus: 100 };
const ADMIN_EMAILS = ['mossaismael551@gmail.com'];

const isDateKey = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function addDays(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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

    const body = (await req.json().catch(() => ({}))) as { message?: unknown; mode?: unknown; targets?: unknown; today?: unknown };
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
    if (!message) return json({ error: 'Message is required' }, 400);
    const mode: 'chat' | 'plan' = body.mode === 'plan' ? 'plan' : 'chat';
    const today = isDateKey(body.today) ? body.today : new Date().toISOString().slice(0, 10);
    const targets = body.targets && typeof body.targets === 'object' ? (body.targets as TargetsSnapshot) : null;

    const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    if (!(await hasAiConsent(db, user.id))) return json(AI_CONSENT_REQUIRED, 403);

    // ---- Usage limits (shared with the main AI Coach) ----
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

    // ---- User data ----
    const from14 = addDays(today, -13);
    const [settingsRes, mealsRes, waterRes, weightsRes, workoutsRes, checkinsRes, historyRes] = await Promise.all([
      db.from('nutrition_settings').select('*').eq('user_id', user.id).maybeSingle(),
      db
        .from('meal_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_date', from14)
        .lte('logged_date', today)
        .order('created_at', { ascending: true })
        .limit(400),
      db.from('water_logs').select('ml, logged_date').eq('user_id', user.id).gte('logged_date', addDays(today, -6)).lte('logged_date', today),
      db
        .from('body_measurements')
        .select('weight_kg, recorded_at')
        .eq('user_id', user.id)
        .not('weight_kg', 'is', null)
        .gte('recorded_at', `${addDays(today, -60)}T00:00:00Z`)
        .order('recorded_at', { ascending: true }),
      db
        .from('workout_sessions')
        .select('plan_name, completed_at, duration_seconds, status')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', `${from14}T00:00:00Z`)
        .order('completed_at', { ascending: false })
        .limit(14),
      db
        .from('daily_checkins')
        .select('checkin_date, sleep_hours, stress, soreness')
        .eq('user_id', user.id)
        .order('checkin_date', { ascending: false })
        .limit(3),
      db.from('nutrition_coach_messages').select('role, content').eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
    ]);
    // Shared per-account memory (written by the person and by the coaches). Missing table = older database.
    const memoryRes = await db.from('user_memory').select('category, content').eq('user_id', user.id).order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(40);
    const memoryText = memoryRes.error || !memoryRes.data?.length
      ? ''
      : `\n\n=== WHAT THE USER HAS TOLD STARTFIT TO REMEMBER ===\n${(memoryRes.data as { category: string; content: string }[]).map((m) => `- (${m.category}) ${m.content}`).join('\n')}`;

    const settings = (settingsRes.error ? null : settingsRes.data) as SettingsRow | null;
    const profile = (profileRow ?? null) as ProfileRow | null;
    const flags = deriveFlags(profile, settings);

    const waterByDate: Record<string, number> = {};
    for (const w of (waterRes.data ?? []) as { ml: number; logged_date: string }[]) {
      waterByDate[w.logged_date] = (waterByDate[w.logged_date] ?? 0) + Number(w.ml ?? 0);
    }

    const context = buildContext({
      today,
      profile,
      settings,
      targets,
      meals: (mealsRes.data ?? []) as MealRow[],
      waterByDate,
      weights: ((weightsRes.data ?? []) as { weight_kg: number; recorded_at: string }[]).map((w) => ({
        date: String(w.recorded_at).slice(0, 10),
        kg: Number(w.weight_kg),
      })),
      workouts: ((workoutsRes.data ?? []) as { plan_name: string | null; completed_at: string; duration_seconds: number }[]).map((w) => ({
        date: String(w.completed_at).slice(0, 10),
        name: w.plan_name,
        minutes: Math.round(Number(w.duration_seconds ?? 0) / 60),
      })),
      checkins: ((checkinsRes.error ? [] : checkinsRes.data ?? []) as { checkin_date: string; sleep_hours: number | null; stress: number | null; soreness: Record<string, number> | null }[]).map((c) => ({
        date: c.checkin_date,
        sleep_hours: c.sleep_hours,
        stress: c.stress,
        soreness_count: c.soreness ? Object.values(c.soreness).filter((v) => Number(v) >= 3).length : 0,
      })),
      flags,
    });

    const history = ((historyRes.error ? [] : historyRes.data ?? []) as { role: string; content: string }[])
      .reverse()
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) }));

    const trainingContext = await loadTrainingContext(db, user.id, now).then(formatTrainingContext).catch(() => '');
    const messages = [
      { role: 'system', content: `${buildSystemPrompt(flags, mode)}\n\n${languageInstruction(profileRow?.preferred_language)}\n\n=== USER CONTEXT ===\n${context}${trainingContext ? `\n\n=== TRAINING ===\n${trainingContext}` : ''}${memoryText}` },
      ...history,
      { role: 'user', content: message },
    ];

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: 'o3-mini',
        messages,
        reasoning_effort: mode === 'plan' ? 'medium' : 'low',
        max_completion_tokens: mode === 'plan' ? 6000 : 2500,
      }),
    });
    if (!aiResponse.ok) {
      console.error('OpenAI error', aiResponse.status, await aiResponse.text().catch(() => ''));
      return json({ error: 'The coach is temporarily unavailable. Please try again.' }, 502);
    }
    const aiData = await aiResponse.json();
    const reply: string | undefined = aiData.choices?.[0]?.message?.content?.trim();
    if (!reply) return json({ error: 'The coach did not return an answer. Please try again.' }, 502);

    // ---- Save the exchange and count usage ----
    const { error: saveError } = await db.from('nutrition_coach_messages').insert([
      { user_id: user.id, role: 'user', content: message },
      { user_id: user.id, role: 'assistant', content: reply.slice(0, 20000) },
    ]);
    if (saveError) console.warn('Could not save coach messages:', saveError.message);

    if (!isAdmin) {
      if (usage) {
        await db.from('ai_usage').update({ request_count: used + 1, last_request_at: now.toISOString() }).eq('user_id', user.id);
      } else {
        await db.from('ai_usage').insert({ user_id: user.id, request_count: 1, last_request_at: now.toISOString() });
      }
    }

    return json({ reply });
  } catch (err) {
    console.error('nutrition-coach error:', err);
    return json({ error: 'An unexpected error occurred. Please try again.' }, 500);
  }
});
