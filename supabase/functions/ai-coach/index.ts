import { languageInstruction } from '../_shared/language.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { AI_CONSENT_REQUIRED, hasAiConsent } from '../_shared/consent.ts';
import { formatTrainingContext, loadTrainingContext } from '../_shared/training-context.ts';
import { effectiveTier } from '../_shared/tier.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  conversationId: string;
  message: string;
  history: { role: string; content: string }[];
}

const SYSTEM_PROMPT = `You are the StartFit AI Coach: a careful, evidence-based coach for training, recovery and nutrition inside the StartFit app. You talk like a good human coach: warm, direct, specific to this person, and honest about uncertainty.

How you work:
- Use the person's real data in USER CONTEXT (profile, sessions, set logs, nutrition, memory, current routine). Quote their actual numbers. Never invent data you were not given.
- Ask before you prescribe: if a key fact is missing for what they ask (goal, days per week, session time, equipment, experience, injuries), ask for it in one short question instead of guessing.
- Plans: full training plans are built by StartFit's plan engine (Training → Coach), and calorie and macro targets by the Nutrition tab. Point the person there for a full plan, and explain or adjust within it. Do not write a different calorie target or a whole new programme yourself.
- Progressive overload: base it on their logged weights and reps (for example add 2–10% load once they beat the top of the rep range by 1–2 reps, or add a rep first).
- Recovery: muscles listed under RECOVERY RESTRICTIONS are under 60% recovered; do not prescribe direct work for them today.
- Science: only state well-established findings, and say "the evidence is limited" when it is. Never invent studies, authors, percentages or links. The Training, Recovery and Nutrition coaches inside the app show sources for each claim; suggest them for detailed, cited answers.
- Safety: you are not a doctor. Chest pain, fainting, unusual breathlessness, dark urine after hard training, numbness, or severe or worsening pain → stop and seek medical help. Pregnancy, under-18s, heart, kidney, metabolic conditions or medicines → their clinician first. Never suggest crash diets, purging, or supplement doses beyond standard ones.
- Be concise (usually under 250 words), practical, with short paragraphs or bullets.

StartFit plans (for billing or upgrade questions only; never push upgrades unprompted):
- Free: 5 coach messages a day.
- Pro: £3.50/week or £9.99/month (annual £99.90): 30 coach messages a day and the Pro features.
- Pro+: £5.99/week or £14.99/month (annual £149.90): 100 coach messages a day and all features.
- Daily Pass £1.49: 24 hours of full access.
For anything about a specific charge or refund, point them to Account → Manage subscription.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server not properly configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!openAiKey) {
      return new Response(
        JSON.stringify({
          error: 'AI Coach is not configured. The OPENAI_API_KEY secret needs to be set. Please contact the app administrator to enable AI coaching.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!(await hasAiConsent(supabase, user.id))) {
      return new Response(JSON.stringify(AI_CONSENT_REQUIRED), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: RequestBody = await req.json();
    const { message, history } = body;

    if (!message || !message.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch user profile to determine subscription tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const userTier: string = effectiveTier(profile);
    const TIER_LIMITS: Record<string, number> = { free: 5, pro: 30, plus: 100 };
    const tierLimit = TIER_LIMITS[userTier] ?? TIER_LIMITS.free;

    // Admin override: bypass rate limiting for admin emails
    const ADMIN_EMAILS = ['mossaismael551@gmail.com'];
    const isAdmin = ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());

    // Rate limiting: check and increment usage (skip for admin)
    const { data: usage } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const now = new Date();
    const lastRequest = usage ? new Date(usage.last_request_at) : null;
    const isSameDay = lastRequest &&
      lastRequest.getDate() === now.getDate() &&
      lastRequest.getMonth() === now.getMonth() &&
      lastRequest.getFullYear() === now.getFullYear();

    const currentCount = isSameDay ? (usage?.request_count ?? 0) : 0;

    if (!isAdmin && currentCount >= tierLimit) {
      return new Response(
        JSON.stringify({
          error: 'daily_limit_reached',
          limit: tierLimit,
          tier: userTier,
          message: `You've reached your daily limit of ${tierLimit} coach actions on the ${userTier === 'free' ? 'Free' : userTier === 'pro' ? 'Pro' : 'Pro+'} plan.`,
          upgrade_text: userTier === 'free'
            ? 'Upgrade to Pro for 30 daily actions, or Pro+ for 100.'
            : userTier === 'pro'
            ? 'Upgrade to Pro+ for 100 daily actions.'
            : 'Your daily limit resets tomorrow.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch recent workout sessions (last 20)
    const { data: recentSessions } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false }, )
      .limit(20);

    // Fetch set logs for the last 5 sessions for progressive overload analysis
    const sessionIds = (recentSessions ?? []).slice(0, 5).map((s) => s.id);
    let recentSetLogs: Record<string, unknown>[] = [];
    if (sessionIds.length > 0) {
      const { data: logs } = await supabase
        .from('workout_set_logs')
        .select('*')
        .in('session_id', sessionIds)
        .order('set_number');
      recentSetLogs = logs ?? [];
    }

    const sessionDateById = new Map((recentSessions ?? []).map((session) => [session.id, session.completed_at]));
    const recentExerciseIds = [...new Set(recentSetLogs.map((log) => log.exercise_id as string).filter(Boolean))];
    const { data: fatigueExercises } = recentExerciseIds.length > 0
      ? await supabase.from('exercises').select('id, primary_muscle').in('id', recentExerciseIds)
      : { data: [] };
    const fatigueExerciseById = new Map((fatigueExercises ?? []).map((exercise) => [exercise.id, exercise.primary_muscle]));
    const blockedMuscles = new Set<string>();
    for (const log of recentSetLogs) {
      if (log.completed !== true) continue;
      const primaryMuscle = fatigueExerciseById.get(log.exercise_id as string);
      const completedAt = sessionDateById.get(log.session_id as string);
      if (!primaryMuscle || !completedAt) continue;
      const hoursSince = (Date.now() - new Date(completedAt).getTime()) / 3600000;
      const recovery = (hoursSince / (['back', 'legs', 'glutes'].includes(primaryMuscle) ? 72 : 48)) * 100;
      if (recovery < 60) blockedMuscles.add(primaryMuscle);
    }

    // Fetch body measurements for calorie/macro calculations
    const { data: measurements } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(5);

    // Fetch exercises matching keywords from the user's message
    // This gives the AI real exercises from the 1400+ dataset to recommend
    const keywords = message.toLowerCase().match(/\b(chest|back|shoulder|arm|leg|glute|core|bicep|tricep|quad|hamstring|calf|ab|deadlift|squat|bench|press|row|curl|dip|pull|push|cardio|stretch)\b/g);
    let exerciseContext = '';
    if (keywords && keywords.length > 0) {
      const muscleMap: Record<string, string> = {
        chest: 'chest', back: 'back', shoulder: 'shoulders', arm: 'arms',
        leg: 'legs', glute: 'glutes', core: 'core', bicep: 'arms', tricep: 'arms',
        quad: 'legs', hamstring: 'legs', calf: 'legs', ab: 'core',
      };
      const mappedMuscles = [...new Set(keywords.map((k) => muscleMap[k] ?? 'full_body'))];
      const { data: matchingExercises } = await supabase
        .from('exercises')
        .select('name, primary_muscle, equipment, difficulty, category')
        .in('primary_muscle', mappedMuscles)
        .limit(40)
        .order('name');
      const eligibleMatches = (matchingExercises ?? []).filter((exercise) => !blockedMuscles.has(exercise.primary_muscle));
      if (eligibleMatches.length > 0) {
        exerciseContext = '\n=== AVAILABLE EXERCISES FROM DATABASE (use these real exercise names when recommending workouts) ===\n';
        exerciseContext += eligibleMatches.map((e: Record<string, unknown>) =>
          `- ${e.name} (${e.primary_muscle}, ${e.equipment}, ${e.difficulty})`
        ).join('\n');
      }
    }

    // Build rich context
    const contextParts: string[] = [];
    contextParts.push(`=== RECOVERY RESTRICTIONS ===\nMuscles below 60% recovery: ${blockedMuscles.size > 0 ? [...blockedMuscles].join(', ') : 'none'}. Do not prescribe direct work for restricted muscles; substitute eligible exercises from the database.`);

    if (profile) {
      contextParts.push('=== USER PROFILE ===');
      if (profile.fitness_goal) contextParts.push(`Goal: ${profile.fitness_goal}`);
      if (profile.experience_level) contextParts.push(`Experience: ${profile.experience_level}`);
      if (profile.training_location) contextParts.push(`Training location: ${profile.training_location}`);
      if (profile.preferred_equipment?.length) contextParts.push(`Available equipment: ${profile.preferred_equipment.join(', ')}`);
      if (profile.preferred_days?.length) contextParts.push(`Preferred training days: ${profile.preferred_days.join(', ')}`);
      if (profile.session_duration_min) contextParts.push(`Session duration: ${profile.session_duration_min} minutes`);
      if (profile.weight_kg) contextParts.push(`Body weight: ${profile.weight_kg} kg`);
      if (profile.height_cm) contextParts.push(`Height: ${profile.height_cm} cm`);
      if (profile.age) contextParts.push(`Age: ${profile.age}`);
      if (profile.limitations) contextParts.push(`Limitations/injuries: ${profile.limitations}`);
      if (profile.body_fat_pct ?? profile.body_fat_percent) contextParts.push(`Body fat percentage: ${profile.body_fat_pct ?? profile.body_fat_percent}%`);
      if (profile.physique_goal) contextParts.push(`Physique goal: ${profile.physique_goal}`);
      contextParts.push(`Subscription: ${userTier}`);
    }

    // Workout history summary
    if (recentSessions && recentSessions.length > 0) {
      contextParts.push('\n=== RECENT WORKOUT HISTORY (last 20 sessions) ===');
      const completedSessions = recentSessions.filter((s) => s.completed_at);
      if (completedSessions.length > 0) {
        contextParts.push(`Total completed sessions: ${completedSessions.length}`);

        // Last 5 sessions with details
        const last5 = completedSessions.slice(0, 5);
        for (const s of last5) {
          const date = new Date(s.completed_at).toLocaleDateString('en-GB');
          const duration = Math.round(s.duration_seconds / 60);
          contextParts.push(`- ${date}: "${s.plan_name ?? 'Workout'}" | ${duration}min | ${s.total_sets} sets | ${s.total_reps} reps`);
        }

        // Calculate streak and frequency
        const dates = completedSessions.map((s) => new Date(s.completed_at).toDateString());
        const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        let streak = 1;
        for (let i = 1; i < uniqueDates.length; i++) {
          const prev = new Date(uniqueDates[i - 1]);
          const curr = new Date(uniqueDates[i]);
          const diff = (prev.getTime() - curr.getTime()) / 86400000;
          if (diff <= 2) streak++;
          else break;
        }
        contextParts.push(`Current streak: ${streak} sessions`);
        contextParts.push(`Sessions this week: ${dates.filter((d) => { const day = new Date(d); const weekAgo = Date.now() - 7 * 86400000; return day.getTime() >= weekAgo; }).length}`);
      }
    }

    // Progressive overload data from set logs
    if (recentSetLogs.length > 0) {
      contextParts.push('\n=== SET LOG DATA (last 5 sessions) ===');
      // Group by exercise name and find max weight / volume
      const byExercise: Record<string, { weight: number; reps: number; sets: number; date: string }[]> = {};
      for (const log of recentSetLogs) {
        const name = log.exercise_name as string;
        if (!name) continue;
        if (!byExercise[name]) byExercise[name] = [];
        byExercise[name].push({
          weight: (log.weight as number) ?? 0,
          reps: (log.reps as number) ?? 0,
          sets: 1,
          date: log.created_at as string,
        });
      }
      for (const [exercise, logs] of Object.entries(byExercise)) {
        const maxWeight = Math.max(...logs.map((l) => l.weight));
        const avgReps = Math.round(logs.reduce((sum, l) => sum + l.reps, 0) / logs.length);
        const totalVolume = logs.reduce((sum, l) => sum + l.weight * l.reps, 0);
        contextParts.push(`- ${exercise}: max ${maxWeight}kg, avg ${avgReps} reps, volume ${totalVolume}kg (across recent sessions)`);
      }
    }

    // Recovery analysis — which muscles were trained recently
    if (recentSessions && recentSessions.length > 0) {
      const last3Sessions = recentSessions.slice(0, 3);
      for (const s of last3Sessions) {
        if (s.completed_at) {
          const daysAgo = Math.floor((Date.now() - new Date(s.completed_at).getTime()) / 86400000);
          contextParts.push(`\n=== RECOVERY STATUS ===`);
          contextParts.push(`Last workout: ${daysAgo} day(s) ago`);
          break;
        }
      }
    }

    // Body measurements for nutrition calculations
    if (measurements && measurements.length > 0) {
      contextParts.push('\n=== BODY MEASUREMENTS ===');
      const latest = measurements[0];
      if (latest.weight_kg) contextParts.push(`Latest weight: ${latest.weight_kg} kg`);
      if (latest.body_fat_percent) contextParts.push(`Body fat: ${latest.body_fat_percent}%`);
      if (latest.recorded_at) contextParts.push(`Measured: ${new Date(latest.recorded_at).toLocaleDateString('en-GB')}`);
    }

    // Nutrition tab data (optional — skipped if the tables are not there yet)
    try {
      const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const { data: recentMeals } = await supabase
        .from('meal_logs')
        .select('logged_date, kcal, protein')
        .eq('user_id', user.id)
        .gte('logged_date', since);
      const { data: nutritionSettings } = await supabase
        .from('nutrition_settings')
        .select('goal_mode, no_numbers, diet_prefs, allergies, screening')
        .eq('user_id', user.id)
        .maybeSingle();
      const hideNumbers = nutritionSettings?.no_numbers === true || nutritionSettings?.screening?.positive === true;
      if (recentMeals && recentMeals.length > 0) {
        const byDay = new Map<string, { kcal: number; protein: number }>();
        for (const m of recentMeals) {
          const d = byDay.get(m.logged_date) ?? { kcal: 0, protein: 0 };
          d.kcal += Number(m.kcal ?? 0);
          d.protein += Number(m.protein ?? 0);
          byDay.set(m.logged_date, d);
        }
        const days = [...byDay.values()];
        const avgKcal = Math.round(days.reduce((a, d) => a + d.kcal, 0) / days.length);
        const avgProtein = Math.round(days.reduce((a, d) => a + d.protein, 0) / days.length);
        contextParts.push('\n=== NUTRITION (last 7 days, from the Nutrition tab) ===');
        contextParts.push(hideNumbers ? `Food logged on ${days.length} days.` : `Food logged on ${days.length} days. Average on logged days: ${avgKcal} kcal, ${avgProtein} g protein.`);
      }
      if (nutritionSettings) {
        contextParts.push(`Nutrition goal mode: ${nutritionSettings.goal_mode}. Diet preferences: ${(nutritionSettings.diet_prefs ?? []).join(', ') || 'none'}. Allergies: ${(nutritionSettings.allergies ?? []).join(', ') || 'none'}.`);
        if (hideNumbers) contextParts.push('The user prefers nutrition advice WITHOUT calorie, macro or weight numbers and without weight-change goals. Respect this.');
      }
      contextParts.push('For detailed meal plans, food logging or nutrient analysis, you can point the user to the Nutrition tab and its nutrition coach.');
    } catch (nutritionErr) {
      console.warn('Nutrition context unavailable:', nutritionErr);
    }

    // Shared per-account memory (written by the person and by the coaches; see user_memory).
    try {
      const { data: memoryRows, error: memoryError } = await supabase
        .from('user_memory')
        .select('category, content')
        .eq('user_id', user.id)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(40);
      if (!memoryError && memoryRows && memoryRows.length > 0) {
        contextParts.push('\n=== WHAT THE USER HAS TOLD STARTFIT TO REMEMBER ===');
        for (const m of memoryRows as { category: string; content: string }[]) contextParts.push(`- (${m.category}) ${m.content}`);
      }
    } catch (memoryErr) {
      console.warn('Memory unavailable:', memoryErr);
    }

    // What the person trains with right now (gym or home version, shortened sessions, lighter week).
    try {
      const tc = formatTrainingContext(await loadTrainingContext(supabase, user.id, now));
      if (tc) contextParts.push(`\n=== CURRENT TRAINING SETUP ===\n${tc}`);
    } catch (tcErr) {
      console.warn('Training context unavailable:', tcErr);
    }

    // Build context-augmented system prompt
    let contextPrompt = SYSTEM_PROMPT;
    if (exerciseContext) {
      contextParts.push(exerciseContext);
    }
    if (contextParts.length > 0) {
      contextPrompt += `\n\n=== USER CONTEXT (use this to give personalised, specific advice) ===\n${contextParts.join('\n')}`;
      contextPrompt += `\n\nINSTRUCTIONS: When answering, use the user's actual data above. Reference their real numbers, real exercises, and real training history. If they ask about progressive overload, calculate from their set logs. If they ask about recovery, check which muscles they trained and when. If they ask about nutrition, use the Nutrition tab data above and point them to its targets rather than inventing new ones. Never recommend direct training for muscles below 60% recovery; choose recovered substitutes instead.`;
    }

    // Build messages for OpenAI
    const messages: ChatMessage[] = [
      { role: 'system', content: `${contextPrompt}\n\n${languageInstruction(profile?.preferred_language)}` },
      ...history.slice(-10).map((m): ChatMessage => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'o3-mini',
        messages,
        reasoning_effort: 'low',
        // o3-mini spends part of this budget on reasoning before it writes; 1000 left many replies empty.
        max_completion_tokens: 4000,
      }),
    });

    if (!openAiResponse.ok) {
      const errBody = await openAiResponse.text().catch(() => '');
      console.error('OpenAI API error:', openAiResponse.status, errBody);
      return new Response(
        JSON.stringify({ error: 'AI Coach is temporarily unavailable. Please try again.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const openAiData = await openAiResponse.json();
    const reply = openAiData.choices?.[0]?.message?.content;

    if (!reply) {
      return new Response(
        JSON.stringify({ error: 'No response from AI model' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Update usage count (skip for admin — no limit tracking needed)
    if (!isAdmin) {
      if (usage) {
        await supabase
          .from('ai_usage')
          .update({
            request_count: isSameDay ? currentCount + 1 : 1,
            last_request_at: now.toISOString(),
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('ai_usage')
          .insert({
            user_id: user.id,
            request_count: 1,
            last_request_at: now.toISOString(),
          });
      }
    }

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('AI Coach error:', err);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
