/*
  # Expire 24-hour passes

  The Stripe webhook gives a Daily Pass buyer subscription_tier 'plus' with a period end 24 hours
  later, but nothing ever took it away again, so a £1.49 pass became permanent Pro+.
  Every 5 minutes this job moves expired passes back to free. The coaches and the app also check
  the end time themselves, so access stops on time even between runs.
*/
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.expire_daily_passes()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH expired AS (
    UPDATE public.profiles
       SET subscription_tier = 'free',
           subscription_status = 'expired'
     WHERE subscription_status = 'daily_pass'
       AND subscription_current_period_end IS NOT NULL
       AND subscription_current_period_end < now()
    RETURNING 1
  )
  SELECT count(*)::int FROM expired;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_daily_passes() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('expire-daily-passes', '*/5 * * * *', 'select public.expire_daily_passes()');
