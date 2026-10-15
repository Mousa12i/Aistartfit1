/*
  # Protect billing columns on profiles

  Signed-in users could update their own subscription_tier (and other billing fields) through the
  API, giving themselves paid features. Only the server (service role: Stripe webhook, checkout,
  account deletion) may change these columns now.
*/
CREATE OR REPLACE FUNCTION public.protect_profile_billing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.subscription_tier := 'free';
      NEW.subscription_status := 'inactive';
      NEW.stripe_customer_id := NULL;
      NEW.stripe_subscription_id := NULL;
      NEW.subscription_current_period_end := NULL;
    ELSE
      NEW.subscription_tier := OLD.subscription_tier;
      NEW.subscription_status := OLD.subscription_status;
      NEW.stripe_customer_id := OLD.stripe_customer_id;
      NEW.stripe_subscription_id := OLD.stripe_subscription_id;
      NEW.subscription_current_period_end := OLD.subscription_current_period_end;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_billing() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_billing ON public.profiles;
CREATE TRIGGER protect_profile_billing
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_billing();
