/*
# Privacy: consents and account deletion

1. user_consents: the person's current choice for
   - 'health_data': explicit consent to StartFit processing their health and fitness data (UK GDPR Art. 9(2)(a));
   - 'third_party_ai': explicit permission to send their data to the AI provider (OpenAI) when they use a coach
     (App Store Review Guideline 5.1.2(i)).
   One row per person and kind, with the privacy policy version the choice was made under.
2. user_consent_events: an append-only record of every grant and withdrawal, so consent can be demonstrated
   (UK GDPR Art. 7(1)). Written only by a trigger.
3. Account deletion runs in the delete-account server function (service role). Every table that holds a
   person's data already cascades from auth.users, except routines they created (workout_plans.created_by is
   SET NULL); the function deletes those first.
*/

CREATE TABLE IF NOT EXISTS public.user_consents (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('health_data', 'third_party_ai')),
  granted boolean NOT NULL,
  policy_version text NOT NULL CHECK (length(policy_version) BETWEEN 1 AND 40),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_consents_select" ON public.user_consents;
CREATE POLICY "own_consents_select" ON public.user_consents FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_consents_insert" ON public.user_consents;
CREATE POLICY "own_consents_insert" ON public.user_consents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_consents_update" ON public.user_consents;
CREATE POLICY "own_consents_update" ON public.user_consents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_consent_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  granted boolean NOT NULL,
  policy_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_consent_events_user ON public.user_consent_events (user_id, created_at DESC);

ALTER TABLE public.user_consent_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_consent_events_select" ON public.user_consent_events;
CREATE POLICY "own_consent_events_select" ON public.user_consent_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- no insert/update/delete policies: people cannot write or change the record themselves

CREATE OR REPLACE FUNCTION public.touch_consent() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- AFTER triggers: an upsert that turns into an update fires only the UPDATE trigger, so no phantom events.
CREATE OR REPLACE FUNCTION public.log_consent_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.granted IS DISTINCT FROM OLD.granted OR NEW.policy_version IS DISTINCT FROM OLD.policy_version THEN
    INSERT INTO public.user_consent_events (user_id, kind, granted, policy_version) VALUES (NEW.user_id, NEW.kind, NEW.granted, NEW.policy_version);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS user_consents_log ON public.user_consents;
DROP TRIGGER IF EXISTS user_consents_touch ON public.user_consents;
CREATE TRIGGER user_consents_touch BEFORE INSERT OR UPDATE ON public.user_consents
  FOR EACH ROW EXECUTE FUNCTION public.touch_consent();
CREATE TRIGGER user_consents_log AFTER INSERT OR UPDATE ON public.user_consents
  FOR EACH ROW EXECUTE FUNCTION public.log_consent_event();
