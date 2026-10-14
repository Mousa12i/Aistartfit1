import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { AI_CONSENT_REQUIRED, hasAiConsent } from '../_shared/consent.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GeneratedDay {
  day: string;
  focus: string;
  exercises: { name: string; sets: number; reps: string; rest: string; notes: string }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: 'AI generation requires an OpenAI API key.' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    if (!(await hasAiConsent(supabase, user.id))) {
      return new Response(JSON.stringify(AI_CONSENT_REQUIRED), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isAdmin = (user.email ?? '').toLowerCase() === 'mossaismael551@gmail.com';
    if (profile.subscription_tier !== 'plus' && !isAdmin) {
      return new Response(JSON.stringify({ error: 'AI Biometric Routine Generator is a Pro+ exclusive feature.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({})) as { fatigue?: string; soreness?: string };
    const fatigue = body.fatigue ?? 'normal';
    const soreness = body.soreness ?? 'none';

    const { data: workoutSessions } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(10);

    const { data: exercises } = await supabase
      .from('exercises')
      .select('id, name, primary_muscle, secondary_muscles, equipment, difficulty, movement_pattern, exercise_type')
      .order('name');

    const recentCutoff = Date.now() - 72 * 60 * 60 * 1000;
    const recentSessions = (workoutSessions ?? []).filter((session) => session.completed_at && new Date(session.completed_at).getTime() >= recentCutoff);
    const recentSessionIds = recentSessions.map((session) => session.id);
    const { data: recentSets } = recentSessionIds.length > 0
      ? await supabase.from('workout_set_logs').select('exercise_id, reps, weight, session_id').in('session_id', recentSessionIds).eq('completed', true)
      : { data: [] };
    const exerciseById = new Map((exercises ?? []).map((exercise) => [exercise.id, exercise]));
    const blockedMuscles = new Set<string>();
    for (const session of recentSessions) {
      const hoursSince = (Date.now() - new Date(session.completed_at).getTime()) / 3600000;
      for (const set of (recentSets ?? []).filter((entry) => entry.session_id === session.id)) {
        const exercise = exerciseById.get(set.exercise_id);
        if (!exercise) continue;
        const recovery = (hoursSince / (['back', 'legs', 'glutes'].includes(exercise.primary_muscle) ? 72 : 48)) * 100;
        if (recovery < 60) blockedMuscles.add(exercise.primary_muscle);
      }
    }
    const eligibleExercises = (exercises ?? []).filter((exercise) => !blockedMuscles.has(exercise.primary_muscle));

    const contextParts: string[] = [];
    contextParts.push(`Goal: ${profile.physique_goal ?? profile.fitness_goal ?? 'general'}`);
    contextParts.push(`Experience: ${profile.experience_level ?? 'beginner'}`);
    contextParts.push(`Weight: ${profile.weight_kg ?? 70}kg, Height: ${profile.height_cm ?? 170}cm`);
    if (profile.body_fat_pct) contextParts.push(`Body fat: ${profile.body_fat_pct}%`);
    contextParts.push(`Training days: ${profile.preferred_days?.join(', ') ?? 'Mon, Wed, Fri'}`);
    contextParts.push(`Session duration: ${profile.session_duration_min ?? 45} min`);
    if (profile.limitations) contextParts.push(`CRITICAL - Limitations/injuries: ${profile.limitations}`);
    contextParts.push(`Available equipment: ${profile.preferred_equipment?.join(', ') ?? 'none'}`);
    contextParts.push(`Current fatigue level: ${fatigue}`);
    contextParts.push(`Current soreness: ${soreness}`);
    contextParts.push(`Restricted muscles below 60% recovery: ${blockedMuscles.size > 0 ? [...blockedMuscles].join(', ') : 'none'}`);

    if (recentSessions && recentSessions.length > 0) {
      const last3 = recentSessions.slice(0, 3);
      contextParts.push(`Recent sessions: ${last3.map((s) => `${s.plan_name ?? 'workout'} on ${new Date(s.completed_at).toLocaleDateString()}`).join('; ')}`);
    }

    const exerciseNames = eligibleExercises.map((e) => `${e.name} (${e.primary_muscle}, ${e.equipment}, ${e.difficulty})`);
    contextParts.push(`\nAvailable exercise library (${exerciseNames.length} eligible exercises): ${exerciseNames.slice(0, 80).join(', ')}`);

    const systemPrompt = `You are StartFit's Elite Biometric Routine Generator, powered by the o3-mini reasoning engine.
You are a world-leading Sports Scientist and Biomechanics Researcher.

Your task: Generate a complete weekly workout program tailored to the user's specific biometrics, joint limitations, equipment, and goals.

Rules:
1. NEVER recommend exercises that aggravate the user's stated joint issues or limitations
2. Only use exercises from the provided exercise library
3. Match exercise difficulty to the user's experience level
4. Respect their available equipment — no barbell exercises if they only have dumbbells
5. Never select a restricted muscle listed in the user context; choose eligible substitutions from the provided library instead
6. If fatigue is high or soreness is reported, reduce volume by ~30% and substitute gentler variations
7. Include specific progressive overload schemes (e.g., "add 2.5kg when all sets hit top of rep range")
7. Include rep ranges, rest periods, and coaching notes for each exercise
8. Distribute volume intelligently across the week based on their available training days
9. For hypertrophy: 10-20 sets per muscle group per week, 8-15 rep range
10. For fat loss: supersets, shorter rest, higher density
11. For powerlifting: lower reps (3-6), longer rest, compound focus
12. For recomposition: moderate volume, moderate intensity, slight deficit focus

Return ONLY valid JSON in this exact format:
{
  "routine_name": "string",
  "summary": "1-2 sentence overview",
  "physiological_reasoning": "Detailed breakdown of exercise selection rationale based on biometrics, joint limitations, and goals",
  "macros": { "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 },
  "days": [
    {
      "day": "Monday",
      "focus": "Push (Chest/Shoulders/Triceps)",
      "exercises": [
        { "name": "Barbell Bench Press", "sets": 4, "reps": "6-8", "rest": "120s", "notes": "Add 2.5kg when all sets complete 8 reps", "form_cues": "Keep shoulder blades retracted, lower bar to lower chest" }
      ]
    }
  ],
  "progression_notes": "How to progress week over week"
}`;

    const userPrompt = `Generate a weekly workout program for this user:\n\n${contextParts.join('\n')}`;

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'o3-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openAiResponse.ok) {
      const errBody = await openAiResponse.text().catch(() => '');
      console.error('OpenAI API error:', openAiResponse.status, errBody);
      return new Response(JSON.stringify({ error: 'AI generation temporarily unavailable.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const openAiData = await openAiResponse.json();
    const content = openAiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: 'No routine generated' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let routine: { routine_name: string; summary: string; physiological_reasoning?: string; macros?: { calories: number; protein_g: number; carbs_g: number; fat_g: number }; days: GeneratedDay[]; progression_notes: string };
    try {
      routine = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: 'Generated routine was malformed. Please try again.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ routine }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Routine generator error:', err);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
