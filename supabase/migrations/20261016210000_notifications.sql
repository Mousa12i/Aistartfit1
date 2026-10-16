/*
  # Notifications

  - notifications: one row per event for a person (in-app bell). Created only by database triggers and
    security-definer functions, so nobody can send fake notifications to someone else.
  - push_subscriptions: the browser/phone endpoints a person allowed (Web Push).
  - Events: a coach message, a weekly check-in sent, a check-in reviewed, a new athlete joining,
    a coach changing your targets or giving you a routine.
  - A pg_cron job calls the push-dispatch function every minute; it sends pending notifications to the
    person's devices (only when profiles.notification_enabled is true) and marks them pushed.
*/

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('message', 'checkin', 'checkin_reviewed', 'new_athlete', 'targets_changed', 'routine_given')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  preview text,
  url text NOT NULL DEFAULT '/',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  pushed_at timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_user ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_pending ON public.notifications (created_at) WHERE pushed_at IS NULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_read_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_mark_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Only read_at may change from the app.
CREATE OR REPLACE FUNCTION public.notifications_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    NEW.user_id := OLD.user_id; NEW.kind := OLD.kind; NEW.actor_id := OLD.actor_id; NEW.actor_name := OLD.actor_name;
    NEW.preview := OLD.preview; NEW.url := OLD.url; NEW.created_at := OLD.created_at; NEW.pushed_at := OLD.pushed_at;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notifications_guard BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notifications_guard();

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%'),
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_ok_at timestamptz,
  failures integer NOT NULL DEFAULT 0
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_own" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Internal: create a notification (called by triggers / functions only).
CREATE OR REPLACE FUNCTION public.notify(target uuid, k text, actor uuid, preview_text text, link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text;
BEGIN
  IF target IS NULL OR target = actor THEN RETURN; END IF;
  SELECT coalesce(nullif(trim(coach_brand_name), ''), nullif(trim(display_name), ''), 'StartFit') INTO nm FROM profiles WHERE id = actor;
  INSERT INTO notifications (user_id, kind, actor_id, actor_name, preview, url)
  VALUES (target, k, actor, nm, left(preview_text, 140), link);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_coach_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid; link text;
BEGIN
  IF NEW.sender_id = NEW.coach_id THEN target := NEW.athlete_id; link := '/my-coach';
  ELSE target := NEW.coach_id; link := '/coach/athlete/' || NEW.athlete_id || '?tab=chat'; END IF;
  -- One unread entry per conversation: refresh an unread, not-yet-pushed one instead of adding another.
  UPDATE notifications SET preview = left(coalesce(NEW.body, '📷'), 140), created_at = now()
   WHERE user_id = target AND kind = 'message' AND actor_id = NEW.sender_id AND read_at IS NULL AND pushed_at IS NULL;
  IF NOT FOUND THEN PERFORM notify(target, 'message', NEW.sender_id, coalesce(NEW.body, '📷'), link); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER coach_message_notify AFTER INSERT ON public.coach_messages FOR EACH ROW EXECUTE FUNCTION public.on_coach_message();

CREATE OR REPLACE FUNCTION public.on_coach_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify(NEW.coach_id, 'checkin', NEW.athlete_id, NEW.win, '/coach/athlete/' || NEW.athlete_id || '?tab=checkins');
  ELSIF NEW.reviewed_at IS NOT NULL AND OLD.reviewed_at IS NULL THEN
    PERFORM notify(NEW.athlete_id, 'checkin_reviewed', NEW.coach_id, NEW.coach_reply, '/my-coach');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER coach_checkin_notify AFTER INSERT OR UPDATE ON public.coach_checkins FOR EACH ROW EXECUTE FUNCTION public.on_coach_checkin();

CREATE OR REPLACE FUNCTION public.on_coach_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM notify(NEW.coach_id, 'new_athlete', NEW.athlete_id, NULL, '/coach/athlete/' || NEW.athlete_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER coach_link_notify AFTER INSERT ON public.coach_links FOR EACH ROW EXECUTE FUNCTION public.on_coach_link();

-- The coach's plan changes tell the athlete.
CREATE OR REPLACE FUNCTION public.on_targets_by_coach()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c uuid;
BEGIN
  SELECT coach_id INTO c FROM coach_links WHERE athlete_id = NEW.user_id AND coach_id = auth.uid() AND status = 'active';
  IF c IS NOT NULL THEN PERFORM notify(NEW.user_id, 'targets_changed', c, NULL, '/nutrition/plan'); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER nutrition_targets_notify AFTER INSERT OR UPDATE OF goal_mode, rate_pct, kcal_override, protein_g_per_kg ON public.nutrition_settings
  FOR EACH ROW EXECUTE FUNCTION public.on_targets_by_coach();

CREATE OR REPLACE FUNCTION public.on_plan_by_coach()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c uuid;
BEGIN
  SELECT coach_id INTO c FROM coach_links WHERE athlete_id = NEW.user_id AND coach_id = auth.uid() AND status = 'active';
  IF c IS NOT NULL THEN PERFORM notify(NEW.user_id, 'routine_given', c, NULL, '/training'); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER plan_assignment_notify AFTER INSERT ON public.user_plan_assignments FOR EACH ROW EXECUTE FUNCTION public.on_plan_by_coach();

-- Push dispatch: a private shared secret lets only the database's own cron job call the function.
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.app_config (key text PRIMARY KEY, value text NOT NULL);
-- The private schema is not exposed through the API and anon/authenticated have no usage on it.
