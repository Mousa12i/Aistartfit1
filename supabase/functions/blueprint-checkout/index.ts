import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const blueprints: Record<string, { name: string; price: number; weeks: number }> = {
  bp_1w: { name: 'StartFit 1-Week AI Blueprint', price: 350, weeks: 1 },
  bp_2w: { name: 'StartFit 2-Weeks AI Blueprint', price: 599, weeks: 2 },
  bp_4w: { name: 'StartFit 4-Weeks AI Blueprint', price: 999, weeks: 4 },
  bp_3m: { name: 'StartFit 3-Month Transformation', price: 1999, weeks: 12 },
  bp_6m: { name: 'StartFit 6-Month Complete Blueprint', price: 3499, weeks: 24 },
};

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
    if (!stripeSecret || !supabaseUrl || !anonKey) return response({ error: 'Store is temporarily unavailable.' }, 503);

    const authorization = req.headers.get('Authorization');
    if (!authorization) return response({ error: 'Authentication required.' }, 401);

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return response({ error: 'Authentication required.' }, 401);

    const body = await req.json() as { blueprintId?: string };
    const blueprintId = body.blueprintId;
    if (!blueprintId || !(blueprintId in blueprints)) {
      return response({ error: 'Select a valid blueprint to purchase.' }, 400);
    }

    const origin = req.headers.get('Origin') ?? '';
    if (!origin.startsWith('https://') && !origin.startsWith('http://localhost')) {
      return response({ error: 'Checkout origin is not allowed.' }, 400);
    }

    const bp = blueprints[blueprintId];
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: bp.price,
          product_data: {
            name: bp.name,
            description: `Custom AI-generated ${bp.weeks === 1 ? '1-week' : `${bp.weeks / 7 < 1 ? `${bp.weeks}-week` : bp.weeks >= 12 ? `${bp.weeks / 4}-month` : `${bp.weeks}-week`}`} training blueprint powered by o3-mini`,
          },
        },
      }],
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          type: 'blueprint',
          blueprint_id: blueprintId,
          weeks: String(bp.weeks),
        },
      },
      success_url: `${origin}/#/routine-generator?checkout=success&blueprint=${blueprintId}`,
      cancel_url: `${origin}/#/training?checkout=cancelled`,
    });

    if (!session.url) return response({ error: 'Unable to start checkout.' }, 502);
    return response({ url: session.url });
  } catch (error) {
    console.error('blueprint-checkout error', error);
    return response({ error: 'Unable to start checkout.' }, 500);
  }
});
