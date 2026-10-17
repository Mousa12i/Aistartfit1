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

// Coach plans: athletes a coach can have (the database enforces the same limits: coach_tier_limit()).
const coachPlans = {
  coach: { name: 'StartFit Coach (up to 25 athletes)', monthly: 1900, annual: 19000 },
  coach_pro: { name: 'StartFit Coach Pro (up to 60 athletes)', monthly: 3900, annual: 39000 },
  studio: { name: 'StartFit Studio (up to 150 athletes, your branding)', monthly: 7900, annual: 79000 },
} as const;

type Tier = keyof typeof plans;
type Billing = 'weekly' | 'monthly' | 'annual';

/**
 * Moves a running subscription to another plan in place (no second subscription). Stripe charges or credits
 * the prorated difference straight away on the saved card. Returns false when it is already on that price.
 */
async function switchPlan(stripe: Stripe, subId: string, name: string, amount: number, interval: 'week' | 'month' | 'year', metadata: Record<string, string>): Promise<boolean> {
  const sub = await stripe.subscriptions.retrieve(subId);
  const item = sub.items.data[0];
  if (!item) throw new Error('subscription_without_item');
  if (item.price.unit_amount === amount && item.price.recurring?.interval === interval && sub.metadata.tier === metadata.tier && sub.metadata.coach_tier === metadata.coach_tier) return false;
  const product = await stripe.products.create({ name });
  await stripe.subscriptions.update(subId, {
    items: [{ id: item.id, price_data: { currency: 'gbp', unit_amount: amount, product: product.id, recurring: { interval } } }],
    proration_behavior: 'always_invoice',
    cancel_at_period_end: false,
    metadata,
  });
  return true;
}

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

    // Return addresses only on the app's own sites (no redirect to other domains after paying).
    const origin = req.headers.get('Origin') ?? '';
    const allowed = origin === 'https://aistartfit1.vercel.app'
      || /^https:\/\/aistartfit1-[a-z0-9-]+\.vercel\.app$/.test(origin)
      || /^http:\/\/localhost(:\d+)?$/.test(origin);
    if (!allowed) return response({ error: 'Checkout origin is not allowed.' }, 400);

    // The person's current plan: no second subscription, and no Daily Pass on top of a running one.
    const { data: me } = await supabase.from('profiles')
      .select('subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, coach_tier, coach_status, coach_stripe_subscription_id').eq('id', user.id).maybeSingle();
    const subscribed = !!me && me.subscription_tier !== 'free' && (me.subscription_status === 'active' || me.subscription_status === 'trialing');
    const customer = typeof me?.stripe_customer_id === 'string' && me.stripe_customer_id.startsWith('cus_') ? me.stripe_customer_id : null;
    const who = customer ? { customer } : { customer_email: user.email };

    // Daily Pass — one-off payment for 24h full access
    if (body.type === 'daily') {
      if (subscribed) return response({ error: 'You already have full access with your plan.', code: 'already_subscribed' }, 409);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        ...who,
        client_reference_id: user.id,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: dailyPass.price,
            product_data: { name: dailyPass.name },
          },
        }],
        metadata: { user_id: user.id, type: 'daily_pass' },
        payment_intent_data: {
          metadata: { user_id: user.id, type: 'daily_pass' },
        },
        success_url: `${origin}/#/profile?checkout=success&type=daily`,
        cancel_url: `${origin}/#/profile?checkout=cancelled`,
      });

      if (!session.url) return response({ error: 'Unable to start checkout.' }, 502);
      return response({ url: session.url });
    }

    // Coach plan — a separate subscription from the person's own Pro / Pro+ plan.
    if (body.type === 'coach') {
      const coachTier = body.tier as keyof typeof coachPlans;
      const coachBilling = body.billing === 'annual' ? 'annual' : body.billing === 'monthly' ? 'monthly' : null;
      if (typeof coachTier !== 'string' || !Object.hasOwn(coachPlans, coachTier) || !coachBilling) return response({ error: 'Choose a valid coach plan.' }, 400);
      const cp = coachPlans[coachTier];
      if (me && me.coach_tier !== 'free' && (me.coach_status === 'active' || me.coach_status === 'trialing') && me.coach_stripe_subscription_id) {
        const changed = await switchPlan(stripe, me.coach_stripe_subscription_id, cp.name, cp[coachBilling], coachBilling === 'annual' ? 'year' : 'month', { user_id: user.id, kind: 'coach', coach_tier: coachTier });
        if (!changed) return response({ error: 'You are already on this coach plan.', code: 'same_plan' }, 409);
        return response({ url: `${origin}/#/coach?checkout=success`, switched: true });
      }
      const coachSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        ...who,
        client_reference_id: user.id,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: cp[coachBilling],
            product_data: { name: cp.name },
            recurring: { interval: coachBilling === 'annual' ? 'year' : 'month' },
          },
        }],
        subscription_data: { metadata: { user_id: user.id, kind: 'coach', coach_tier: coachTier } },
        metadata: { kind: 'coach' },
        success_url: `${origin}/#/coach?checkout=success`,
        cancel_url: `${origin}/#/coach?checkout=cancelled`,
      });
      if (!coachSession.url) return response({ error: 'Unable to start checkout.' }, 502);
      return response({ url: coachSession.url });
    }

    const tier = body.tier as Tier;
    const billing = body.billing as Billing;
    if (typeof tier !== 'string' || !Object.hasOwn(plans, tier) || !['weekly', 'monthly', 'annual'].includes(billing)) {
      return response({ error: 'Choose a valid plan and billing period.' }, 400);
    }

    const plan = plans[tier];
    const interval = billing === 'annual' ? 'year' : billing === 'weekly' ? 'week' : 'month';
    if (subscribed && me?.stripe_subscription_id) {
      const changed = await switchPlan(stripe, me.stripe_subscription_id, plan.name, plan[billing], interval, { user_id: user.id, tier });
      if (!changed) return response({ error: 'You are already on this plan.', code: 'same_plan' }, 409);
      return response({ url: `${origin}/#/profile?checkout=success`, switched: true });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...who,
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
