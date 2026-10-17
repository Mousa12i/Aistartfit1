/*
  Coach studio 2 (2026-10-18)
  1. coach_engagement(today, tz): per athlete, the local days with any activity in the last 28 days, the last activity,
     the coach's own contact, check-in text lengths, pause and programme end. Feeds the dropout radar
     (Pedersen et al. 2019, JMIR 21(9):e13617: 2 weeks of inactivity -> 79.2 % later dropped out, 3 weeks -> 84.6 %).
  2. Pause (illness, travel): coach_set_pause(); a paused athlete is not flagged and owes no check-in.
  3. coach_memory: the coach's private timeline of facts about an athlete (injury, travel, goal, life event).
  4. coach_message_translations: cached translations of chat messages (written only by the chat-translate function).
  5. coach_checkins.plans: the athlete's if-then plans for next week (implementation intentions).
  6. coach_habit_ratings: the 4-item Self-Report Behavioural Automaticity Index (Gardner et al. 2012) per habit.
  7. coach_scheduled_messages + a minute job that sends them.
*/

-- ---------- 2. pause ----------
ALTER TABLE public.coach_links ADD COLUMN IF NOT EXISTS paused_until date;
ALTER TABLE public.coach_links ADD COLUMN IF NOT EXISTS pause_reason text CHECK (pause_reason IS NULL OR char_length(pause_reason) <= 200);

CREATE OR REPLACE FUNCTION public.coach_set_pause(athlete uuid, until date, reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF until IS NOT NULL AND (until < current_date OR until > current_date + 90) THEN RAISE EXCEPTION 'pause_out_of_range'; END IF;
  UPDATE coach_links SET paused_until = until, pause_reason = CASE WHEN until IS NULL THEN NULL ELSE nullif(left(trim(coalesce(reason, '')), 200), '') END
  WHERE coach_id = (SELECT auth.uid()) AND athlete_id = athlete AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_your_athlete'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.coach_set_pause(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_set_pause(uuid, date, text) TO authenticated;

-- ---------- 1. engagement ----------
CREATE OR REPLACE FUNCTION public.coach_engagement(today date, tz text)
RETURNS TABLE(athlete_id uuid, active_dates date[], last_active_at timestamptz, last_coach_message_at timestamptz,
  coach_messages_14d integer, checkin_lengths integer[], paused_until date, pause_reason text, plan_ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (
    SELECT CASE WHEN today BETWEEN current_date - 2 AND current_date + 2 THEN today ELSE current_date END AS today,
      coalesce((SELECT n.name FROM pg_timezone_names n WHERE n.name = tz LIMIT 1), 'UTC') AS tz
  ),
  links AS (SELECT l.* FROM coach_links l WHERE l.coach_id = (SELECT auth.uid()) AND l.status = 'active'),
  acts AS (
    SELECT ws.user_id AS aid, ws.completed_at AS at FROM workout_sessions ws JOIN links l ON l.athlete_id = ws.user_id
      WHERE ws.status = 'completed' AND ws.completed_at > now() - interval '60 days'
    UNION ALL SELECT m.user_id, m.created_at FROM meal_logs m JOIN links l ON l.athlete_id = m.user_id WHERE m.created_at > now() - interval '60 days'
    UNION ALL SELECT c.athlete_id, c.submitted_at FROM coach_checkins c JOIN links l ON l.athlete_id = c.athlete_id AND l.coach_id = c.coach_id WHERE c.submitted_at > now() - interval '60 days'
    UNION ALL SELECT cm.athlete_id, cm.created_at FROM coach_messages cm JOIN links l ON l.athlete_id = cm.athlete_id AND l.coach_id = cm.coach_id
      WHERE cm.sender_id = cm.athlete_id AND cm.created_at > now() - interval '60 days'
    UNION ALL SELECT h.athlete_id, h.updated_at FROM coach_habit_logs h JOIN links l ON l.athlete_id = h.athlete_id WHERE h.done AND h.updated_at > now() - interval '60 days'
    UNION ALL SELECT b.user_id, b.recorded_at FROM body_measurements b JOIN links l ON l.athlete_id = b.user_id WHERE b.recorded_at > now() - interval '60 days'
    UNION ALL SELECT dc.user_id, coalesce(dc.updated_at, dc.created_at) FROM daily_checkins dc JOIN links l ON l.athlete_id = dc.user_id WHERE coalesce(dc.updated_at, dc.created_at) > now() - interval '60 days'
  )
  SELECT l.athlete_id,
    coalesce((SELECT array_agg(DISTINCT (a.at AT TIME ZONE d.tz)::date ORDER BY (a.at AT TIME ZONE d.tz)::date) FROM acts a
      WHERE a.aid = l.athlete_id AND (a.at AT TIME ZONE d.tz)::date > d.today - 28 AND (a.at AT TIME ZONE d.tz)::date <= d.today), '{}'),
    (SELECT max(a.at) FROM acts a WHERE a.aid = l.athlete_id),
    (SELECT max(cm.created_at) FROM coach_messages cm WHERE cm.coach_id = l.coach_id AND cm.athlete_id = l.athlete_id AND cm.sender_id = l.coach_id),
    (SELECT count(*)::int FROM coach_messages cm WHERE cm.coach_id = l.coach_id AND cm.athlete_id = l.athlete_id AND cm.sender_id = l.coach_id AND cm.created_at > now() - interval '14 days'),
    coalesce((SELECT array_agg(x.len ORDER BY x.submitted_at DESC) FROM (
      SELECT c.submitted_at, (coalesce(char_length(c.win), 0) + coalesce(char_length(c.struggle), 0) + coalesce(char_length(c.question), 0)
        + coalesce((SELECT sum(char_length(coalesce(e->>'a', ''))) FROM jsonb_array_elements(c.answers) e), 0))::int AS len
      FROM coach_checkins c WHERE c.coach_id = l.coach_id AND c.athlete_id = l.athlete_id ORDER BY c.submitted_at DESC LIMIT 6) x), '{}'),
    l.paused_until, l.pause_reason,
    (SELECT (a.assigned_at AT TIME ZONE d.tz)::date + wp.duration_weeks * 7 FROM user_plan_assignments a JOIN workout_plans wp ON wp.id = a.plan_id
      WHERE a.user_id = l.athlete_id AND a.completed_at IS NULL AND wp.duration_weeks BETWEEN 1 AND 104 ORDER BY a.assigned_at DESC LIMIT 1)
  FROM d, links l;
$$;
REVOKE EXECUTE ON FUNCTION public.coach_engagement(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_engagement(date, text) TO authenticated;

-- ---------- 3. coach memory ----------
CREATE TABLE IF NOT EXISTS public.coach_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('injury', 'travel', 'goal', 'life', 'preference', 'other')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
  happened_on date NOT NULL DEFAULT current_date,
  until_on date,
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (until_on IS NULL OR until_on >= happened_on)
);
CREATE INDEX IF NOT EXISTS coach_memory_pair_idx ON public.coach_memory (coach_id, athlete_id, happened_on DESC);
CREATE INDEX IF NOT EXISTS coach_memory_athlete_idx ON public.coach_memory (athlete_id);
ALTER TABLE public.coach_memory ENABLE ROW LEVEL SECURITY;
-- Private to the coach (like coach_notes), and only while the athlete is linked.
CREATE POLICY memory_read ON public.coach_memory FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = coach_id AND coach_link_active(coach_id, athlete_id));
CREATE POLICY memory_insert ON public.coach_memory FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = coach_id AND coach_link_active(coach_id, athlete_id));
CREATE POLICY memory_update ON public.coach_memory FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = coach_id) WITH CHECK ((SELECT auth.uid()) = coach_id AND coach_link_active(coach_id, athlete_id));

-- ---------- 4. translations ----------
CREATE TABLE IF NOT EXISTS public.coach_message_translations (
  message_id uuid NOT NULL REFERENCES public.coach_messages(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('en', 'ar', 'es', 'fr', 'de', 'pt', 'tr', 'it')),
  body text NOT NULL CHECK (char_length(body) <= 8000),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, lang)
);
CREATE INDEX IF NOT EXISTS coach_message_translations_req_idx ON public.coach_message_translations (requested_by, created_at);
ALTER TABLE public.coach_message_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY translation_read ON public.coach_message_translations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM coach_messages m WHERE m.id = message_id
    AND ((SELECT auth.uid()) = m.coach_id OR (SELECT auth.uid()) = m.athlete_id) AND coach_link_active(m.coach_id, m.athlete_id)));

-- ---------- 5. if-then plans in check-ins ----------
ALTER TABLE public.coach_checkins ADD COLUMN IF NOT EXISTS plans jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.coach_checkins ADD CONSTRAINT coach_checkins_plans_check
  CHECK (jsonb_typeof(plans) = 'array' AND jsonb_array_length(plans) <= 5 AND char_length(plans::text) <= 3000);

-- ---------- 6. habit automaticity (SRBAI) ----------
CREATE TABLE IF NOT EXISTS public.coach_habit_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.coach_habits(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rated_on date NOT NULL,
  items smallint[] NOT NULL CHECK (array_length(items, 1) = 4 AND 1 <= ALL(items) AND 7 >= ALL(items)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, rated_on)
);
CREATE INDEX IF NOT EXISTS coach_habit_ratings_athlete_idx ON public.coach_habit_ratings (athlete_id);
ALTER TABLE public.coach_habit_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY habit_rating_read ON public.coach_habit_ratings FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = athlete_id OR EXISTS (SELECT 1 FROM coach_habits h WHERE h.id = habit_id AND h.coach_id = (SELECT auth.uid()) AND coach_link_active(h.coach_id, h.athlete_id)));
CREATE POLICY habit_rating_insert ON public.coach_habit_ratings FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = athlete_id AND EXISTS (SELECT 1 FROM coach_habits h WHERE h.id = habit_id AND h.athlete_id = (SELECT auth.uid()) AND h.active AND coach_link_active(h.coach_id, h.athlete_id)));
CREATE POLICY habit_rating_update ON public.coach_habit_ratings FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = athlete_id)
  WITH CHECK ((SELECT auth.uid()) = athlete_id AND EXISTS (SELECT 1 FROM coach_habits h WHERE h.id = habit_id AND h.athlete_id = (SELECT auth.uid()) AND coach_link_active(h.coach_id, h.athlete_id)));

-- ---------- 7. scheduled messages ----------
CREATE TABLE IF NOT EXISTS public.coach_scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coach_scheduled_due_idx ON public.coach_scheduled_messages (send_at) WHERE sent_at IS NULL AND canceled_at IS NULL;
CREATE INDEX IF NOT EXISTS coach_scheduled_pair_idx ON public.coach_scheduled_messages (coach_id, athlete_id);
ALTER TABLE public.coach_scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY scheduled_read ON public.coach_scheduled_messages FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = coach_id);
CREATE POLICY scheduled_insert ON public.coach_scheduled_messages FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = coach_id AND coach_link_active(coach_id, athlete_id) AND sent_at IS NULL AND canceled_at IS NULL
    AND send_at > now() AND send_at < now() + interval '60 days');
-- Only cancelling is allowed after scheduling (the guard below keeps the rest unchanged).
CREATE POLICY scheduled_cancel ON public.coach_scheduled_messages FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = coach_id AND sent_at IS NULL) WITH CHECK ((SELECT auth.uid()) = coach_id);

CREATE OR REPLACE FUNCTION public.scheduled_message_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.coach_id <> OLD.coach_id OR NEW.athlete_id <> OLD.athlete_id OR NEW.body <> OLD.body OR NEW.send_at <> OLD.send_at
      OR NEW.sent_at IS DISTINCT FROM OLD.sent_at OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'only_cancel_allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.scheduled_message_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER coach_scheduled_guard BEFORE UPDATE ON public.coach_scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.scheduled_message_guard();

CREATE OR REPLACE FUNCTION public.send_due_scheduled_messages()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT * FROM coach_scheduled_messages WHERE sent_at IS NULL AND canceled_at IS NULL AND send_at <= now()
    ORDER BY send_at LIMIT 500 FOR UPDATE SKIP LOCKED
  LOOP
    IF coach_link_active(r.coach_id, r.athlete_id) THEN
      INSERT INTO coach_messages (coach_id, athlete_id, sender_id, body) VALUES (r.coach_id, r.athlete_id, r.coach_id, r.body);
      UPDATE coach_scheduled_messages SET sent_at = now() WHERE id = r.id;
      n := n + 1;
    ELSE
      UPDATE coach_scheduled_messages SET canceled_at = now() WHERE id = r.id;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_due_scheduled_messages() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('coach-scheduled-messages', '* * * * *', 'select public.send_due_scheduled_messages()');
