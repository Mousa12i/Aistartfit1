import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

// In-app account deletion (App Store Review Guideline 5.1.1(v); UK GDPR right to erasure).
// Deletes the signed-in person's account and all their data:
//   1. stops running Stripe subscriptions (own plan and coach plan) so they are not charged again, then asks Stripe to delete the
//      customer record (Stripe still keeps the payment records the law requires it to keep);
//   2. deletes routines they created (the only table that does not cascade from the account);
//   3. deletes the auth user — every other table holding their data cascades from it.
// The request must carry the person's own session and the confirmation word "DELETE".

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server not properly configured' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required' }, 401);
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (authError || !user) return json({ error: 'Invalid authentication' }, 401);

    const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
    if (body.confirm !== 'DELETE') return json({ error: 'Type DELETE to confirm.' }, 400);

    const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // 1. stop billing
    const { data: profile } = await db.from('profiles')
      .select('stripe_subscription_id, subscription_status, stripe_customer_id, coach_stripe_subscription_id, coach_status').eq('id', user.id).maybeSingle();
    // The person's own plan and, for coaches, the coach plan: both are stopped before anything is deleted.
    const running = [
      { id: (profile?.stripe_subscription_id as string | null | undefined) ?? null, status: String(profile?.subscription_status ?? '') },
      { id: (profile?.coach_stripe_subscription_id as string | null | undefined) ?? null, status: String(profile?.coach_status ?? '') },
    ].filter((x) => x.id && ACTIVE_STATUSES.includes(x.status));
    if (running.length) {
      const secret = Deno.env.get('STRIPE_SECRET_KEY');
      if (!secret) return json({ error: 'Your subscription could not be cancelled automatically. Please cancel it from Manage subscription first, then delete your account.' }, 409);
      const stripe = new Stripe(secret, { apiVersion: '2024-12-18.acacia' });
      for (const sub of running) {
        try {
          await stripe.subscriptions.cancel(sub.id!);
        } catch (e) {
          const code = (e as { code?: string }).code;
          if (code !== 'resource_missing') {
            console.error('delete-account: stripe cancel failed', e);
            return json({ error: 'Your subscription could not be cancelled. Nothing was deleted. Please try again or cancel it from Manage subscription first.' }, 502);
          }
        }
      }
    }

    const customerId = (profile?.stripe_customer_id as string | null | undefined) ?? null;
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (customerId && stripeSecret) {
      try {
        const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });
        await stripe.customers.del(customerId);
      } catch (e) {
        // Billing is already stopped; a failure here must not block the person's erasure. Logged for follow-up.
        if ((e as { code?: string }).code !== 'resource_missing') console.error('delete-account: stripe customer delete failed', customerId, e);
      }
    }

    // 2. routines the person created (workout_plans.created_by is ON DELETE SET NULL)
    const { error: plansError } = await db.from('workout_plans').delete().eq('created_by', user.id).eq('is_public', false);
    if (plansError) {
      console.error('delete-account: routines', plansError);
      return json({ error: 'Your account could not be deleted. Nothing else was changed. Please try again.' }, 500);
    }

    // 3. the account itself; all other personal data cascades
    const { error: deleteError } = await db.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('delete-account: auth delete', deleteError);
      return json({ error: 'Your account could not be fully deleted. Please try again.' }, 500);
    }
    return json({ deleted: true });
  } catch (err) {
    console.error('delete-account error:', err);
    return json({ error: 'An unexpected error occurred. Please try again.' }, 500);
  }
});
