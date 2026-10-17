import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Live mode has no customer portal until one is configured. Use the dashboard's default if it exists,
 * otherwise an active one, otherwise create StartFit's: invoices, card update, cancel at period end.
 */
async function portalConfiguration(stripe: Stripe, origin: string): Promise<string> {
  const list = await stripe.billingPortal.configurations.list({ limit: 10 });
  const pick = list.data.find((c) => c.is_default && c.active) ?? list.data.find((c) => c.active);
  if (pick) return pick.id;
  const created = await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'StartFit: manage your subscription', privacy_policy_url: `${origin}/#/privacy` },
    default_return_url: `${origin}/#/profile`,
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email', 'address'] },
      subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'unused', 'other'] } },
    },
  });
  return created.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const secret = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!secret || !supabaseUrl || !anonKey) return response({ error: 'Billing is temporarily unavailable.' }, 503);

    const authorization = req.headers.get('Authorization');
    if (!authorization) return response({ error: 'Authentication required.' }, 401);

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return response({ error: 'Authentication required.' }, 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return response({ error: 'No active subscription found. Upgrade first to manage billing.' }, 400);
    }

    const origin = req.headers.get('Origin') ?? '';
    const allowed = origin === 'https://aistartfit1.vercel.app'
      || /^https:\/\/aistartfit1-[a-z0-9-]+\.vercel\.app$/.test(origin)
      || /^http:\/\/localhost(:\d+)?$/.test(origin);
    if (!allowed) {
      return response({ error: 'Invalid origin.' }, 400);
    }

    // Coaches come back to their account page; everyone else to their profile.
    const body = await req.json().catch(() => ({})) as { from?: unknown };
    const back = body?.from === 'coach' ? '/#/coach/account' : '/#/profile';

    const stripe = new Stripe(secret, { apiVersion: '2024-12-18.acacia' });
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      configuration: await portalConfiguration(stripe, origin),
      return_url: `${origin}${back}`,
    });

    return response({ url: session.url });
  } catch (error) {
    console.error('billing-portal error', error);
    return response({ error: 'Unable to open billing portal.' }, 500);
  }
});
