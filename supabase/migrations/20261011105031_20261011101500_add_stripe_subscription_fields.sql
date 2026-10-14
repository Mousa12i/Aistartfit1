/*
# Add Stripe subscription fields

1. Modified Tables
- `profiles.subscription_tier` stores the server-confirmed app tier (`free`, `pro`, or `plus`).
- `profiles.subscription_status` stores the Stripe lifecycle state.
- `profiles.stripe_customer_id` stores the Stripe customer reference for billing support.
- `profiles.stripe_subscription_id` stores the active Stripe subscription reference.
- `profiles.subscription_current_period_end` stores the current paid-through timestamp.

2. Security
- Existing profile row-level policies remain owner-scoped for signed-in users.
- These fields are intended to be written only by the Stripe webhook using the service role, never trusted from the browser.

3. Important Notes
- No existing user data is removed or renamed.
- Existing profiles default to the free tier and no active subscription.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'pro', 'plus')),
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id
  ON public.profiles(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
