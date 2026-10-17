/*
  A coach account can become a training account only when nobody is coached any more and no paid coach plan
  is running (otherwise athletes would be left with a coach who cannot see them, or the coach would keep paying).
*/
CREATE OR REPLACE FUNCTION public.guard_account_type_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.account_type = 'coach' AND NEW.account_type IS DISTINCT FROM 'coach' THEN
    IF EXISTS (SELECT 1 FROM coach_links l WHERE l.coach_id = OLD.id AND l.status = 'active') THEN
      RAISE EXCEPTION 'coach_has_athletes' USING ERRCODE = 'P0001';
    END IF;
    IF OLD.coach_tier IN ('coach', 'coach_pro', 'studio') AND (OLD.coach_period_end IS NULL OR OLD.coach_period_end > now()) THEN
      RAISE EXCEPTION 'coach_subscription_active' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_account_type_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_account_type_change BEFORE UPDATE OF account_type ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_account_type_change();
