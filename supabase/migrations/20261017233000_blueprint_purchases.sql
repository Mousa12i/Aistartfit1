-- One-off AI Blueprint purchases: each paid checkout is one credit for one generated programme.
-- Written only by the Stripe webhook and the routine generator (service role); the buyer can read their own.
CREATE TABLE IF NOT EXISTS public.blueprint_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blueprint_id text NOT NULL CHECK (blueprint_id IN ('bp_1w', 'bp_2w', 'bp_4w', 'bp_3m', 'bp_6m')),
  weeks smallint NOT NULL CHECK (weeks BETWEEN 1 AND 24),
  amount_pence integer NOT NULL CHECK (amount_pence > 0),
  stripe_session_id text NOT NULL UNIQUE,
  stripe_payment_intent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  refunded_at timestamptz
);
CREATE INDEX IF NOT EXISTS blueprint_purchases_user ON public.blueprint_purchases (user_id, created_at);
ALTER TABLE public.blueprint_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY blueprint_purchases_read_own ON public.blueprint_purchases FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE ON public.blueprint_purchases FROM anon, authenticated;
ALTER TABLE public.blueprint_purchases ADD COLUMN IF NOT EXISTS routine jsonb; -- the delivered programme, so the buyer can reopen it

-- One row per handled one-off Stripe checkout, so retried webhook deliveries are applied once.
CREATE TABLE IF NOT EXISTS public.stripe_processed (
  key text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_processed ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_processed FROM anon, authenticated;
