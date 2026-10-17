/*
  Coach public profile + coach code of conduct.

  1. Profile fields the athlete sees before and after joining (all written by the coach, credentials self-declared).
  2. The coach code of conduct and privacy rules: accepted through accept_coach_terms() so the time and the version
     are recorded by the server (the client cannot write them).
  3. join_coach() refuses coaches who have not accepted the current version.
  4. coach_profile_by_code() / my_coach_profile(): the public card as JSON.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_headline text CHECK (coach_headline IS NULL OR char_length(coach_headline) <= 80),
  ADD COLUMN IF NOT EXISTS coach_specialties text[] NOT NULL DEFAULT '{}' CHECK (cardinality(coach_specialties) <= 6),
  ADD COLUMN IF NOT EXISTS coach_years smallint CHECK (coach_years IS NULL OR coach_years BETWEEN 0 AND 60),
  ADD COLUMN IF NOT EXISTS coach_languages text[] NOT NULL DEFAULT '{}' CHECK (cardinality(coach_languages) <= 8),
  ADD COLUMN IF NOT EXISTS coach_format text CHECK (coach_format IS NULL OR coach_format IN ('online', 'in_person', 'hybrid')),
  ADD COLUMN IF NOT EXISTS coach_location text CHECK (coach_location IS NULL OR char_length(coach_location) <= 80),
  ADD COLUMN IF NOT EXISTS coach_philosophy text CHECK (coach_philosophy IS NULL OR char_length(coach_philosophy) <= 300),
  ADD COLUMN IF NOT EXISTS coach_certifications jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(coach_certifications) = 'array' AND jsonb_array_length(coach_certifications) <= 10),
  ADD COLUMN IF NOT EXISTS coach_insured boolean,
  ADD COLUMN IF NOT EXISTS coach_dietitian boolean,
  ADD COLUMN IF NOT EXISTS coach_terms_version text,
  ADD COLUMN IF NOT EXISTS coach_terms_accepted_at timestamptz;

-- Terms acceptance is server-written only.
CREATE OR REPLACE FUNCTION public.protect_coach_terms()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND coalesce(current_setting('startfit.accepting_terms', true), '') <> 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.coach_terms_version := NULL;
      NEW.coach_terms_accepted_at := NULL;
    ELSE
      NEW.coach_terms_version := OLD.coach_terms_version;
      NEW.coach_terms_accepted_at := OLD.coach_terms_accepted_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_coach_terms BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_coach_terms();

CREATE OR REPLACE FUNCTION public.coach_terms_current()
RETURNS text LANGUAGE sql STABLE AS $$ SELECT '2026-10-17'::text $$;

CREATE OR REPLACE FUNCTION public.accept_coach_terms(version text)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid(); accepted timestamptz := now(); n int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF version IS DISTINCT FROM coach_terms_current() THEN RAISE EXCEPTION 'terms_outdated'; END IF;
  PERFORM set_config('startfit.accepting_terms', 'on', true);
  UPDATE profiles SET coach_terms_version = version, coach_terms_accepted_at = accepted WHERE id = me AND account_type = 'coach';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('startfit.accepting_terms', 'off', true);
  IF n = 0 THEN RAISE EXCEPTION 'not_a_coach'; END IF;
  RETURN accepted;
END;
$$;

-- Same rules as before, plus: the coach must have accepted the current code of conduct.
CREATE OR REPLACE FUNCTION public.join_coach(code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  c record;
  used int;
  link uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT id, coach_tier, coach_status, coach_period_end, coach_terms_version INTO c FROM profiles
    WHERE coach_code = upper(trim(code)) AND account_type = 'coach';
  IF c.id IS NULL THEN RAISE EXCEPTION 'code_not_found'; END IF;
  IF c.id = me THEN RAISE EXCEPTION 'own_code'; END IF;
  IF c.coach_terms_version IS DISTINCT FROM coach_terms_current() THEN RAISE EXCEPTION 'coach_not_ready'; END IF;
  IF EXISTS (SELECT 1 FROM coach_links WHERE athlete_id = me AND status = 'active') THEN RAISE EXCEPTION 'already_has_coach'; END IF;
  SELECT count(*) INTO used FROM coach_links WHERE coach_id = c.id AND status = 'active';
  IF used >= coach_tier_limit(CASE WHEN c.coach_tier <> 'free' AND (c.coach_period_end IS NULL OR c.coach_period_end > now()) THEN c.coach_tier ELSE 'free' END) THEN
    RAISE EXCEPTION 'coach_full';
  END IF;
  INSERT INTO coach_links (coach_id, athlete_id) VALUES (c.id, me) RETURNING id INTO link;
  UPDATE profiles SET account_type = coalesce(account_type, 'athlete') WHERE id = me;
  RETURN link;
END;
$$;

CREATE OR REPLACE FUNCTION public.coach_public_card(p public.profiles)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'coach_id', p.id, 'display_name', p.display_name, 'brand_name', p.coach_brand_name, 'bio', p.coach_bio,
    'avatar_url', p.avatar_url, 'headline', p.coach_headline, 'specialties', to_jsonb(p.coach_specialties),
    'years', p.coach_years, 'languages', to_jsonb(p.coach_languages), 'format', p.coach_format, 'location', p.coach_location,
    'philosophy', p.coach_philosophy, 'certifications', p.coach_certifications, 'insured', p.coach_insured,
    'dietitian', p.coach_dietitian, 'checkin_day', p.coach_checkin_day,
    'terms_ok', p.coach_terms_version IS NOT DISTINCT FROM coach_terms_current(), 'terms_accepted_at', p.coach_terms_accepted_at
  );
$$;
REVOKE EXECUTE ON FUNCTION public.coach_public_card(public.profiles) FROM PUBLIC, anon, authenticated;

-- Before joining: the card behind a code (signed-in people only).
CREATE OR REPLACE FUNCTION public.coach_profile_by_code(code text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coach_public_card(p) FROM profiles p
  WHERE p.coach_code = upper(trim(code)) AND p.account_type = 'coach' AND auth.uid() IS NOT NULL;
$$;

-- After joining: the athlete's own coach.
CREATE OR REPLACE FUNCTION public.my_coach_profile()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coach_public_card(p) FROM coach_links l JOIN profiles p ON p.id = l.coach_id
  WHERE l.athlete_id = auth.uid() AND l.status = 'active' LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_coach_terms(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_coach_terms(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_profile_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_profile_by_code(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_coach_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_coach_profile() TO authenticated;
