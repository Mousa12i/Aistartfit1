import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { AI_CONSENT_REQUIRED, hasAiConsent } from '../_shared/consent.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const evidence = [
  { id: 'moran_navarro_2017', citation: 'Moran-Navarro et al. 2017, European Journal of Applied Physiology' },
  { id: 'knowles_2018', citation: 'Knowles et al. 2018, Journal of Science and Medicine in Sport' },
  { id: 'saner_2020', citation: 'Saner et al. 2020' },
  { id: 'schoenfeld_2017', citation: 'Schoenfeld, Ogborn, Krieger 2017; Pelland et al. meta-regressions' },
  { id: 'halperin_rir', citation: 'Halperin et al., Sports Medicine' },
  { id: 'bosquet_2008', citation: 'Bosquet et al. 2008, British Journal of Sports Medicine; Bellenger et al. 2016' },
  { id: 'acwr_literature', citation: 'Acute:Chronic Workload Ratio literature' },
  { id: 'dupuy_2018', citation: 'Dupuy et al. 2018, Frontiers in Physiology' },
  { id: 'morton_2018', citation: 'Morton et al. 2018, British Journal of Sports Medicine' },
];

interface RecoveryFact {
  muscle: string;
  recoveryPercent: number | null;
  hoursSinceLastTrained: number | null;
  hoursNeeded: number;
  weeklyEffectiveSets: number;
  status: string;
  lastTrainedDate: string | null;
}

interface ReportRequest {
  selectedMuscle: string;
  muscleState: RecoveryFact;
  readiness: { status: string; confidence: string; availableInputs: string[]; missingInputs: string[] };
  evidenceIds: string[];
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function isFiniteOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function validate(body: ReportRequest): string | null {
  if (!body || typeof body.selectedMuscle !== 'string' || body.selectedMuscle.length > 80) return 'A selected muscle is required';
  const state = body.muscleState;
  if (!state || typeof state.muscle !== 'string' || state.muscle !== body.selectedMuscle) return 'Muscle state does not match selection';
  if (!isFiniteOrNull(state.recoveryPercent) || !isFiniteOrNull(state.hoursSinceLastTrained) || !Number.isFinite(state.hoursNeeded) || !Number.isFinite(state.weeklyEffectiveSets)) return 'Recovery facts contain invalid numeric values';
  if (!body.readiness || typeof body.readiness.status !== 'string' || !Array.isArray(body.readiness.availableInputs) || !Array.isArray(body.readiness.missingInputs)) return 'Readiness facts are invalid';
  if (!Array.isArray(body.evidenceIds) || body.evidenceIds.some((id) => !evidence.some((source) => source.id === id))) return 'Evidence source is not allowlisted';
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    const authHeader = req.headers.get('Authorization');
    if (!supabaseUrl || !serviceKey || !authHeader) return response({ error: 'Authentication required' }, 401);

    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return response({ error: 'Invalid authentication' }, 401);
    const consentDb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    if (!(await hasAiConsent(consentDb, user.id))) return response(AI_CONSENT_REQUIRED, 403);

    const body = await req.json() as ReportRequest;
    const validationError = validate(body);
    if (validationError) return response({ error: validationError }, 400);
    const sources = evidence.filter((source) => body.evidenceIds.includes(source.id));

    if (!openAiKey) return response({ error: 'Recovery interpretation is not configured' }, 503);

    const prompt = [
      'You are a Sports Science Recovery Engine generating an evidence-informed scientific report for a specific muscle group.',
      'Use the verified user data below to produce a detailed, clinically-styled recovery interpretation.',
      '',
      'REPORT STRUCTURE:',
      '1. summary: A 2-4 sentence physiological status assessment. Reference the muscle name, its current recovery percentage, and time since last trained. Explain what the recovery percentage means physiologically (muscle protein synthesis status, residual muscle damage, functional readiness).',
      '2. actions: 4-6 actionable recovery protocol items as an array of strings. Each should be specific and evidence-based, covering:',
      '   - Training recommendations (can they train this muscle? what intensity/load is safe?)',
      '   - Nutritional protocols (protein intake timing/amount for MPS, specific macros if data available)',
      '   - Sleep and recovery interventions (sleep duration targets, active recovery, mobility work)',
      '   - Load management adjustments based on weekly effective sets',
      '3. limitations: 1-3 strings noting what data is missing or what the report cannot conclude (e.g., no HRV data, no soreness logged, cannot diagnose injury).',
      '4. sources: Copy only from the allowlisted sources below. Return as array of {id, citation} objects.',
      '',
      'SCIENTIFIC CONTEXT TO REFERENCE (only cite from the allowlist):',
      '- Muscle protein synthesis (MPS) remains elevated 24-48h post-resistance training; larger muscles may take longer.',
      '- Muscle damage from eccentric loading peaks at 24-72h; soreness (DOMS) is not a reliable recovery marker.',
      '- Functional recovery often precedes full tissue recovery; recovery percentage estimates tissue readiness.',
      '- Weekly effective sets per muscle group should stay within MEV (minimum effective volume) to MAV (maximum recoverable volume) range.',
      '- Sleep restriction impairs MPS, testosterone, and recovery; 7-9h is the evidence-based target.',
      '- Protein intake of 1.6-2.2g/kg bodyweight per day, distributed across 3-4 meals, supports MPS.',
      '',
      'STRICT RULES:',
      'Do not diagnose, prescribe medical treatment, invent measurements, infer missing values, or cite sources not in the allowlist.',
      'Do not claim a study proves more than its citation states.',
      'Return JSON only with keys: summary, actions, limitations, sources.',
      'summary must be a string. actions must be an array of strings. limitations must be an array of strings. sources must be an array of objects with id and citation copied exactly from the allowlist.',
      '',
      `Verified user id: ${user.id}`,
      `Selected muscle facts: ${JSON.stringify(body.muscleState)}`,
      `Readiness facts: ${JSON.stringify(body.readiness)}`,
      `Allowlisted sources: ${JSON.stringify(sources)}`,
    ].join('\n');

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'o3-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!openAiResponse.ok) return response({ error: 'Recovery interpretation failed' }, 502);
    const completion = await openAiResponse.json() as { choices?: { message?: { content?: string } }[] };
    const content = completion.choices?.[0]?.message?.content;
    if (!content) return response({ error: 'Recovery interpretation returned no report' }, 502);
    const report = JSON.parse(content) as { summary?: unknown; actions?: unknown; limitations?: unknown; sources?: unknown };
    if (typeof report.summary !== 'string' || !Array.isArray(report.actions) || !Array.isArray(report.limitations) || !Array.isArray(report.sources)) return response({ error: 'Recovery interpretation returned an invalid report' }, 502);
    const validSources = report.sources.every((source) => typeof source === 'object' && source !== null && sources.some((allowed) => allowed.id === (source as { id?: unknown }).id));
    if (!validSources) return response({ error: 'Recovery interpretation used an unverified source' }, 502);
    return response({ report: { ...report, facts: body.muscleState, readiness: body.readiness } });
  } catch {
    return response({ error: 'Recovery interpretation failed' }, 500);
  }
});
