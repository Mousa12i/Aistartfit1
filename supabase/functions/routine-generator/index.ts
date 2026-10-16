import { languageInstruction } from '../_shared/language.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { AI_CONSENT_REQUIRED, hasAiConsent } from '../_shared/consent.ts';
import { effectiveTier } from '../_shared/tier.ts';

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
    if (effectiveTier(profile) !== 'plus' && !isAdmin) {
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

    // The curated core library (one ranked list per movement slot), not the first 80 names alphabetically.
    const { data: exercises } = await supabase
      .from('exercises')
      .select('id, name, primary_muscle, secondary_muscles, equipment, difficulty, movement_pattern, exercise_type, core_slot, core_rank')
      .not('core_slot', 'is', null)
      .not('is_hidden', 'is', true)
      .order('core_slot')
      .order('core_rank');

    const recentCutoff = Date.now() - 72 * 60 * 60 * 1000;
    const recentSessions = (workoutSessions ?? []).filter((session) => session.completed_at && new Date(session.completed_at).getTime() >= recentCutoff);
    const recentSessionIds = recentSessions.map((session) => session.id);
    const { data: recentSets } = recentSessionIds.length > 0
      ? await supabase.from('workout_set_logs').select('exercise_id, reps, weight, session_id').in('session_id', recentSessionIds).eq('completed', true)
      : { data: [] };
    const recentIds = [...new Set((recentSets ?? []).map((entry) => entry.exercise_id).filter(Boolean))];
    const { data: recentExercises } = recentIds.length > 0
      ? await supabase.from('exercises').select('id, primary_muscle').in('id', recentIds)
      : { data: [] };
    const exerciseById = new Map((recentExercises ?? []).map((exercise) => [exercise.id, exercise]));
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
    // Only what the person can actually use. A gym has machines and cables; at home only the listed kit.
    const owned = new Set<string>(['none', ...((profile.preferred_equipment as string[] | null) ?? [])]);
    const atGym = profile.training_location === 'gym' || !profile.training_location;
    const canUse = (equipment: string) => atGym || owned.has(equipment);
    // Muscles still recovering stay in the library: the week is planned so they come later, not dropped.
    const eligibleExercises = (exercises ?? []).filter((exercise) => canUse(exercise.equipment));
    const allowedNames = new Map(eligibleExercises.map((e) => [e.name.toLowerCase(), e.name]));

    const contextParts: string[] = [];
    const notGiven = 'not given';
    contextParts.push(`Goal: ${profile.physique_goal ?? profile.fitness_goal ?? notGiven}`);
    contextParts.push(`Experience: ${profile.experience_level ?? `${notGiven} (programme as a beginner)`}`);
    contextParts.push(`Age: ${profile.age ?? notGiven}. Weight: ${profile.weight_kg ? `${profile.weight_kg} kg` : notGiven}. Height: ${profile.height_cm ? `${profile.height_cm} cm` : notGiven}.`);
    if (profile.body_fat_pct) contextParts.push(`Body fat: ${profile.body_fat_pct}%`);
    contextParts.push(`Training days: ${profile.preferred_days?.length ? profile.preferred_days.join(', ') : `${notGiven} (use 3 non-consecutive days)`}`);
    contextParts.push(`Session duration: ${profile.session_duration_min ? `${profile.session_duration_min} min` : `${notGiven} (keep sessions to about 60 min)`}`);
    if (profile.limitations) contextParts.push(`CRITICAL - Limitations/injuries: ${profile.limitations}`);
    contextParts.push(`Training location: ${profile.training_location ?? notGiven}. Available equipment: ${atGym ? 'full gym' : [...owned].join(', ')}`);
    contextParts.push(`Current fatigue level: ${fatigue}`);
    contextParts.push(`Current soreness: ${soreness}`);
    contextParts.push(`Restricted muscles below 60% recovery: ${blockedMuscles.size > 0 ? [...blockedMuscles].join(', ') : 'none'}`);

    if (recentSessions && recentSessions.length > 0) {
      const last3 = recentSessions.slice(0, 3);
      contextParts.push(`Recent sessions: ${last3.map((s) => `${s.plan_name ?? 'workout'} on ${new Date(s.completed_at).toLocaleDateString()}`).join('; ')}`);
    }

    const bySlot = new Map<string, string[]>();
    for (const e of eligibleExercises) {
      const list = bySlot.get(e.core_slot as string) ?? [];
      list.push(`${e.name} (${e.equipment}, ${e.difficulty})`);
      bySlot.set(e.core_slot as string, list);
    }
    contextParts.push(`\nExercise library, by movement slot, best first (use ONLY these exact names):\n${[...bySlot.entries()].map(([slot, names]) => `- ${slot}: ${names.join('; ')}`).join('\n')}`);

    const systemPrompt = `You are StartFit's routine generator. Build one week of resistance training for this person that a careful, evidence-based strength coach would write.

Evidence you follow (do not cite anything beyond this):
- Volume: about 10–20 hard sets per muscle per week for growth; beginners do well near 10. (Schoenfeld et al. 2017, dose-response meta-analysis.)
- Frequency: train each muscle about twice a week when volume allows (Schoenfeld et al. 2016).
- Effort: most working sets 0–3 reps in reserve; compound lifts 1–3 RIR, isolation 0–2 RIR.
- Rep ranges: anything from about 6 to 30 reps builds muscle when sets are hard (Schoenfeld et al. 2017); use 5–8 for heavy compounds, 8–15 for most work, 12–20 for small muscles. For strength goals put compounds at 3–6 reps.
- Rest: 2–3 min for compounds, 1–2 min for isolation (longer rests support more volume; Schoenfeld et al. 2016).
- Fat loss: the calorie deficit drives fat loss; training's job is to keep muscle, so keep the loads heavy and the volume close to normal. Do NOT turn the plan into short-rest circuits.
- Progression: double progression — when every set reaches the top of the rep range at the target RIR, add the smallest load step (about 2.5 kg for barbells, 1–2 kg per dumbbell) next time.

Rules:
1. Use ONLY exercise names from the library in the user context, spelled exactly. Prefer the first options in each slot.
2. A muscle listed as below 60% recovered must not be trained on the first day of the week; place its work later in the week.
3. Respect limitations: if an exercise could aggravate them, choose another from the same slot and say why in notes.
4. Match the number of training days and the session length. Roughly 4–6 exercises a session, about 3 sets each; fewer if the session is short.
5. Each week cover at least: a squat or leg press, a hinge, a horizontal push, a horizontal pull, a vertical pull, an overhead or incline press, and some direct arm, calf and core work.
6. If fatigue is high or soreness is reported, cut sets by about a third this week and say so.
7. Do not give calorie or macro numbers: those come from the Nutrition tab.

Return ONLY valid JSON:
{
  "routine_name": "string",
  "summary": "1-2 sentences",
  "physiological_reasoning": "why this split, volume and exercise choice suit this person",
  "days": [
    { "day": "Monday", "focus": "Upper", "exercises": [
      { "name": "exact library name", "sets": 3, "reps": "6-8", "rest": "120-180s", "notes": "target RIR and progression rule", "form_cues": "two short cues" }
    ] }
  ],
  "progression_notes": "how to progress week to week, and when to take a lighter week"
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
          { role: 'system', content: `${systemPrompt}\n\n${languageInstruction(profile.preferred_language)}` },
          { role: 'user', content: userPrompt },
        ],
        reasoning_effort: 'medium',
        max_completion_tokens: 12000,
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

    // Keep only real library exercises, written with their exact names, so every one opens in the app.
    let dropped = 0;
    routine.days = (Array.isArray(routine.days) ? routine.days : []).map((d) => ({
      ...d,
      exercises: (Array.isArray(d.exercises) ? d.exercises : []).flatMap((e) => {
        const real = allowedNames.get(String(e?.name ?? '').toLowerCase().trim());
        if (!real) { dropped++; return []; }
        return [{ ...e, name: real }];
      }),
    })).filter((d) => d.exercises.length > 0);
    delete routine.macros;
    if (routine.days.length === 0) {
      return new Response(JSON.stringify({ error: 'The routine could not be built from the exercise library. Please try again.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (dropped > 0) console.warn(`routine-generator dropped ${dropped} exercises not in the library`);

    return new Response(JSON.stringify({ routine }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Routine generator error:', err);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
