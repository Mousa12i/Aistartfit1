import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { dedupeFoods, normalizeOffProduct, normalizeUsdaFood, type UsdaSearchFood } from './normalize.ts';

// Food search for the Nutrition tab.
// - Text search: USDA FoodData Central (generic foods first, then branded products).
// - Barcode: Open Food Facts product lookup.
// Results are cached in food_search_cache (service role) to stay inside the free API limits.
//
// Secrets: USDA_API_KEY (free key from api.data.gov; falls back to the heavily rate-limited DEMO_KEY),
//          optional OFF_USER_AGENT, e.g. "StartFit/1.0 (support@yourdomain.com)".

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SEARCH_TTL_MS = 7 * 24 * 3600 * 1000;
const BARCODE_TTL_MS = 30 * 24 * 3600 * 1000;

async function fetchWithTimeout(url: string, init: RequestInit, ms = 9000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server not properly configured' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required' }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) return json({ error: 'Invalid authentication' }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const readCache = async (key: string, ttl: number): Promise<unknown | null> => {
      const { data, error } = await admin.from('food_search_cache').select('payload, created_at').eq('cache_key', key).maybeSingle();
      if (error || !data) return null;
      return Date.now() - new Date(data.created_at as string).getTime() < ttl ? data.payload : null;
    };
    const writeCache = async (key: string, payload: unknown) => {
      const { error } = await admin.from('food_search_cache').upsert({ cache_key: key, payload, created_at: new Date().toISOString() }, { onConflict: 'cache_key' });
      if (error) console.warn('food_search_cache write failed:', error.message);
    };

    const body = (await req.json().catch(() => ({}))) as { query?: unknown; barcode?: unknown };

    // ---- Barcode lookup (Open Food Facts) ----
    if (typeof body.barcode === 'string') {
      const code = body.barcode.replace(/\D/g, '');
      if (code.length < 6 || code.length > 14) return json({ error: 'Invalid barcode' }, 400);
      const cacheKey = `off:${code}`;
      const cached = await readCache(cacheKey, BARCODE_TTL_MS);
      if (cached) return json(cached);

      const userAgent = Deno.env.get('OFF_USER_AGENT') ?? 'StartFit/1.0 (nutrition tracker)';
      const res = await fetchWithTimeout(
        `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_en,product_name_ar,generic_name,brands,nutriments,serving_size,serving_quantity`,
        { headers: { 'User-Agent': userAgent, Accept: 'application/json' } },
      );
      if (res.status === 404) {
        const payload = { food: null };
        await writeCache(cacheKey, payload);
        return json(payload);
      }
      if (!res.ok) {
        console.error('Open Food Facts error', res.status);
        return json({ error: 'The product database is busy. Try again in a minute.' }, 503);
      }
      const data = (await res.json()) as { status?: number; product?: Record<string, unknown> };
      const food = data.status === 0 ? null : normalizeOffProduct(code, data.product);
      const payload = { food };
      await writeCache(cacheKey, payload);
      return json(payload);
    }

    // ---- Text search (USDA FoodData Central) ----
    if (typeof body.query !== 'string') return json({ error: 'Send a query or a barcode' }, 400);
    const query = body.query.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (query.length < 2) return json({ error: 'Query too short' }, 400);

    const cacheKey = `usda:${query.toLowerCase()}`;
    const cached = await readCache(cacheKey, SEARCH_TTL_MS);
    if (cached) return json(cached);

    const apiKey = Deno.env.get('USDA_API_KEY') || 'DEMO_KEY';
    if (apiKey === 'DEMO_KEY') console.warn('USDA_API_KEY is not set; using DEMO_KEY (30 requests/hour).');
    const search = async (dataType: string[], pageSize: number): Promise<UsdaSearchFood[]> => {
      const res = await fetchWithTimeout(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, dataType, pageSize, pageNumber: 1 }),
      });
      if (!res.ok) throw new Error(`USDA ${res.status}`);
      const data = (await res.json()) as { foods?: UsdaSearchFood[] };
      return data.foods ?? [];
    };

    const [generic, branded] = await Promise.allSettled([search(['Foundation', 'SR Legacy', 'Survey (FNDDS)'], 20), search(['Branded'], 12)]);
    if (generic.status === 'rejected' && branded.status === 'rejected') {
      console.error('USDA search failed', generic.reason, branded.reason);
      const limited = String(generic.reason).includes('429') || String(branded.reason).includes('429');
      return json({ error: limited ? 'The food database is busy right now. Try again in a minute.' : 'The food database is not reachable right now.' }, 503);
    }
    const foods = dedupeFoods(
      [...(generic.status === 'fulfilled' ? generic.value : []), ...(branded.status === 'fulfilled' ? branded.value : [])]
        .map(normalizeUsdaFood)
        .filter((f): f is NonNullable<typeof f> => f != null),
    ).slice(0, 30);

    const payload = { foods };
    if (generic.status === 'fulfilled' && branded.status === 'fulfilled') await writeCache(cacheKey, payload);
    return json(payload);
  } catch (err) {
    console.error('food-search error:', err);
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return json({ error: aborted ? 'The food database took too long to answer. Try again.' : 'An unexpected error occurred.' }, aborted ? 504 : 500);
  }
});
