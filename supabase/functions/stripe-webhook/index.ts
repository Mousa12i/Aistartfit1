import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function reply(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const TIER_MAP: Record<string, 'free' | 'pro' | 'plus'> = {
  pro: 'pro',
  plus: 'plus',
};

const COACH_TIERS = ['coach', 'coach_pro', 'studio'];

/** Coach plans live in their own columns, so they never touch the person's own Pro / Pro+ plan. */
// deno-lint-ignore no-explicit-any
async function applyCoachSubscription(supabase: any, subscription: Stripe.Subscription, deleted: boolean): Promise<Response> {
  const userId = subscription.metadata.user_id;
  const tier = COACH_TIERS.includes(subscription.metadata.coach_tier) ? subscription.metadata.coach_tier : 'free';
  const status = deleted ? 'canceled' : subscription.status;
  const periodEnd = new Date(subscription.current_period_end * 1000);
  const live = status === 'active' || status === 'trialing' || (periodEnd > new Date() && (status === 'canceled' || status === 'past_due'));
  const update = {
    coach_tier: live ? tier : 'free',
    coach_status: status,
    coach_period_end: periodEnd.toISOString(),
    coach_stripe_subscription_id: subscription.id,
    stripe_customer_id: String(subscription.customer),
    updated_at: new Date().toISOString(),
  };
  const { data: bySub } = await supabase.from('profiles').select('id').eq('coach_stripe_subscription_id', subscription.id).maybeSingle();
  const id = bySub?.id ?? userId;
  if (!id) {
    console.error('Webhook: coach subscription without user', subscription.id);
    return reply({ received: true, note: 'no matching user' });
  }
  await supabase.from('profiles').update(update).eq('id', id);
  return reply({ received: true });
}

interface ProfileUpdate {
  subscription_tier: 'free' | 'pro' | 'plus';
  subscription_status: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string | null;
  subscription_current_period_end?: string | null;
  updated_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const secret = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const signature = req.headers.get('Stripe-Signature');
    if (!secret || !webhookSecret || !supabaseUrl || !serviceRoleKey || !signature) {
      return reply({ error: 'Webhook unavailable.' }, 503);
    }

    const stripe = new Stripe(secret, { apiVersion: '2024-12-18.acacia' });
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      await Stripe.createSubtleCryptoProvider(),
    );
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ─── checkout.session.completed ───────────────────────────────
    // Fires for both subscriptions and one-off payments (daily pass, blueprints).
    // For subscriptions, this is the earliest reliable signal that payment succeeded.
    // For daily passes, this is the ONLY signal — no subscription event fires.
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;
      const customerId = typeof session.customer === 'string' ? session.customer : null;
      const now = new Date().toISOString();

      // ── Daily Pass: one-off 24h full access ──
      const sessionType = session.metadata?.type ?? session.metadata?.Type ?? null;
      const paymentIntentMetadata = session.payment_intent
        ? typeof session.payment_intent === 'string'
          ? null
          : session.payment_intent.metadata
        : null;
      const piType = paymentIntentMetadata?.type ?? null;

      if (sessionType === 'daily_pass' || piType === 'daily_pass') {
        if (!userId) return reply({ received: true, note: 'no user_id for daily pass' });
        const periodEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const update: ProfileUpdate = {
          subscription_tier: 'plus',
          subscription_status: 'daily_pass',
          subscription_current_period_end: periodEnd,
          updated_at: now,
        };
        if (customerId) update.stripe_customer_id = customerId;
        await supabase.from('profiles').update(update).eq('id', userId);
        return reply({ received: true });
      }

      // ── Blueprint: one-off purchase, no tier change ──
      if (sessionType === 'blueprint' || piType === 'blueprint') {
        return reply({ received: true });
      }

      // ── Subscription checkout: fetch the subscription to get tier + period ──
      if (session.mode === 'subscription' && session.subscription && userId) {
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subId);
        if (subscription.metadata.kind === 'coach') return applyCoachSubscription(supabase, subscription, false);
        const tier = TIER_MAP[subscription.metadata.tier] ?? 'free';
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        const update: ProfileUpdate = {
          subscription_tier: subscription.status === 'active' || subscription.status === 'trialing' ? tier : 'free',
          subscription_status: subscription.status,
          stripe_customer_id: customerId ?? String(subscription.customer),
          stripe_subscription_id: subscription.id,
          subscription_current_period_end: periodEnd,
          updated_at: now,
        };

        // Idempotency: only update if subscription_id differs or status changed
        const { data: existing } = await supabase
          .from('profiles')
          .select('stripe_subscription_id, subscription_status')
          .eq('id', userId)
          .maybeSingle();

        if (existing?.stripe_subscription_id === subscription.id && existing?.subscription_status === subscription.status) {
          return reply({ received: true, note: 'duplicate' });
        }

        await supabase.from('profiles').update(update).eq('id', userId);
        return reply({ received: true });
      }

      return reply({ received: true });
    }

    // ─── subscription lifecycle events ────────────────────────────
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.metadata.kind === 'coach') {
        return applyCoachSubscription(supabase, subscription, event.type === 'customer.subscription.deleted');
      }
      const tier = TIER_MAP[subscription.metadata.tier] ?? 'free';
      const isDeleted = event.type === 'customer.subscription.deleted';
      const status = isDeleted ? 'canceled' : subscription.status;
      const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const now = new Date().toISOString();
      const customerId = String(subscription.customer);

      // Determine effective tier: active/trialing → tier, otherwise free
      // Canceled subscriptions retain access until period_end, then drop to free
      let effectiveTier: 'free' | 'pro' | 'plus' = 'free';
      if (status === 'active' || status === 'trialing') {
        effectiveTier = tier;
      } else if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
        // If period hasn't ended yet, keep access; otherwise free
        const periodEndDate = new Date(subscription.current_period_end * 1000);
        effectiveTier = periodEndDate > new Date() ? tier : 'free';
      }

      const update: ProfileUpdate = {
        subscription_tier: effectiveTier,
        subscription_status: status,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        subscription_current_period_end: periodEnd,
        updated_at: now,
      };

      // Match by subscription_id first (most reliable for updates)
      const { data: bySubId } = await supabase
        .from('profiles')
        .select('id, stripe_subscription_id, subscription_status')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle();

      if (bySubId) {
        // Idempotency check
        if (bySubId.subscription_status === status && !isDeleted) {
          return reply({ received: true, note: 'duplicate' });
        }
        await supabase.from('profiles').update(update).eq('id', bySubId.id);
        return reply({ received: true });
      }

      // No match by subscription_id — try customer_id
      const { data: byCustomerId } = await supabase
        .from('profiles')
        .select('id, stripe_subscription_id, subscription_status')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (byCustomerId) {
        await supabase.from('profiles').update(update).eq('id', byCustomerId.id);
        return reply({ received: true });
      }

      // Last resort: try metadata.user_id
      const metadataUserId = subscription.metadata.user_id;
      if (metadataUserId) {
        const { data: byUserId } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', metadataUserId)
          .maybeSingle();
        if (byUserId) {
          await supabase.from('profiles').update(update).eq('id', metadataUserId);
          return reply({ received: true });
        }
      }

      // Could not find the user — log for manual investigation
      console.error('Webhook: could not match subscription to user', {
        subscriptionId: subscription.id,
        customerId,
        metadataUserId,
      });
      return reply({ received: true, note: 'no matching user' });
    }

    return reply({ received: true });
  } catch (error) {
    console.error('stripe-webhook error', error);
    return reply({ error: 'Invalid webhook.' }, 400);
  }
});
