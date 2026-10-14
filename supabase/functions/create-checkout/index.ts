import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const plans = {
  pro: {
    name: 'StartFit Pro',
    weekly: 350,
    monthly: 999,
    annual: 9990,
  },
  plus: {
    name: 'StartFit Pro+ (o3-mini AI)',
    weekly: 599,
    monthly: 1499,
    annual: 14990,
  },
} as const;

const dailyPass = {
  name: 'StartFit Daily Pass (24h Full Access)',
  price: 149,
};

type Tier = keyof typeof plans;
type Billing = 'weekly' | 'monthly' | 'annual';

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!stripeSecret || !supabaseUrl || !anonKey) return response({ error: 'Billing is temporarily unavailable.' }, 503);

    const authorization = req.headers.get('Authorization');
    if (!authorization) return response({ error: 'Authentication required.' }, 401);

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return response({ error: 'Authentication required.' }, 401);

    const body = await req.json() as { tier?: string; billing?: string; type?: string };
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });

    const origin = req.headers.get('Origin') ?? '';
    if (!origin.startsWith('https://') && !origin.startsWith('http://localhost')) {
      return response({ error: 'Checkout origin is not allowed.' }, 400);
    }

    // Daily Pass — one-off payment for 24h full access
    if (body.type === 'daily') {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: user.email,
        client_reference_id: user.id,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: dailyPass.price,
            product_data: { name: dailyPass.name },
          },
        }],
        payment_intent_data: {
          metadata: { user_id: user.id, type: 'daily_pass' },
        },
        success_url: `${origin}/#/profile?checkout=success&type=daily`,
        cancel_url: `${origin}/#/profile?checkout=cancelled`,
      });

      if (!session.url) return response({ error: 'Unable to start checkout.' }, 502);
      return response({ url: session.url });
    }

    const tier = body.tier as Tier;
    const billing = body.billing as Billing;
    if (!(tier in plans) || !['weekly', 'monthly', 'annual'].includes(billing)) {
      return response({ error: 'Choose a valid plan and billing period.' }, 400);
    }

    const plan = plans[tier];
    const interval = billing === 'annual' ? 'year' : billing === 'weekly' ? 'week' : 'month';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: plan[billing],
          product_data: { name: plan.name },
          recurring: { interval },
        },
      }],
      subscription_data: {
        metadata: { user_id: user.id, tier },
      },
      success_url: `${origin}/#/profile?checkout=success`,
      cancel_url: `${origin}/#/profile?checkout=cancelled`,
    });

    if (!session.url) return response({ error: 'Unable to start checkout.' }, 502);
    return response({ url: session.url });
  } catch (error) {
    console.error('create-checkout error', error);
    return response({ error: 'Unable to start checkout.' }, 500);
  }
});
