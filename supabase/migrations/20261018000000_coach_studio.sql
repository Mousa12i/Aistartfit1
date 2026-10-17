/*
  Coach studio (2026-10-18)
  1. coach_roster_v2(today, tz): the roster with the coach's local day (food today, food days, training days),
     the sessions the athlete's plan asks for each week, the last message (preview, time, who sent it)
     and the intake / health-screening status.
  2. coach_roster_activity_v2(today, tz): 14-day pulse in the coach's time zone.
  3. Intake: coach questions (profiles.coach_intake_questions) and the athlete's answers with the ACSM
     pre-participation screening (Riebe et al. 2015) in coach_intakes. Health answers are shared only with
     the athlete's explicit agreement (consented_at) and only with the active coach.
  4. coach_business_stats(): retention and responsiveness numbers for the coach's own business view.
*/

-- ---------- 3. intake ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coach_intake_questions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_coach_intake_questions_check
  CHECK (jsonb_typeof(coach_intake_questions) = 'array' AND jsonb_array_length(coach_intake_questions) <= 10);

CREATE TABLE IF NOT EXISTS public.coach_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Answers to the coach's own questions: [{q, a}]
  answers jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) <= 10),
  -- Standard intake fields
  goal text CHECK (goal IS NULL OR char_length(goal) <= 500),
  days_per_week smallint CHECK (days_per_week IS NULL OR days_per_week BETWEEN 1 AND 7),
  minutes_per_session smallint CHECK (minutes_per_session IS NULL OR minutes_per_session BETWEEN 10 AND 240),
  equipment text CHECK (equipment IS NULL OR char_length(equipment) <= 500),
  injuries text CHECK (injuries IS NULL OR char_length(injuries) <= 1000),
  -- ACSM 2015 screening inputs
  exercises_regularly boolean NOT NULL,
  known_disease boolean NOT NULL,
  symptoms text[] NOT NULL DEFAULT '{}' CHECK (array_length(symptoms, 1) IS NULL OR array_length(symptoms, 1) <= 12),
  pregnant boolean NOT NULL DEFAULT false,
  outcome text NOT NULL CHECK (outcome IN ('no_clearance', 'clearance_before_vigorous', 'clearance', 'stop_and_clearance')),
  consented_at timestamptz NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, athlete_id)
);
ALTER TABLE public.coach_intakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY intake_read ON public.coach_intakes FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = athlete_id OR (SELECT auth.uid()) = coach_id) AND coach_link_active(coach_id, athlete_id));
CREATE POLICY intake_athlete_insert ON public.coach_intakes FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = athlete_id AND coach_link_active(coach_id, athlete_id));
CREATE POLICY intake_athlete_update ON public.coach_intakes FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = athlete_id)
  WITH CHECK ((SELECT auth.uid()) = athlete_id AND coach_link_active(coach_id, athlete_id));

/** The screening outcome is recomputed in the database so it cannot be set by hand. */
CREATE OR REPLACE FUNCTION public.intake_screening_outcome()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE has_symptoms boolean := coalesce(array_length(NEW.symptoms, 1), 0) > 0;
BEGIN
  NEW.outcome := CASE
    WHEN has_symptoms AND NEW.exercises_regularly THEN 'stop_and_clearance'
    WHEN has_symptoms THEN 'clearance'
    WHEN NEW.known_disease AND NEW.exercises_regularly THEN 'clearance_before_vigorous'
    WHEN NEW.known_disease THEN 'clearance'
    ELSE 'no_clearance'
  END;
  NEW.submitted_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.intake_screening_outcome() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER coach_intake_outcome BEFORE INSERT OR UPDATE ON public.coach_intakes
  FOR EACH ROW EXECUTE FUNCTION public.intake_screening_outcome();

-- The coach's intake questions, readable by their linked athletes.
CREATE OR REPLACE FUNCTION public.my_coach_intake_questions()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.coach_intake_questions FROM coach_links l JOIN profiles p ON p.id = l.coach_id
  WHERE l.athlete_id = (SELECT auth.uid()) AND l.status = 'active' LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.my_coach_intake_questions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_coach_intake_questions() TO authenticated;

-- ---------- 1. roster v2 ----------
CREATE OR REPLACE FUNCTION public.coach_roster_v2(today date, tz text)
RETURNS TABLE(
  athlete_id uuid, display_name text, avatar_url text, joined_at timestamptz, fitness_goal text, experience_level text, age integer,
  height_cm numeric, profile_weight_kg numeric, limitations text, last_workout_at timestamptz, workouts_7d integer, workouts_28d integer,
  food_days_7d integer, last_food_date date, kcal_today integer, protein_today numeric, goal_mode text, rate_pct numeric, kcal_override integer,
  unread integer, pending_checkins integer, last_checkin_at timestamptz, planned_per_week integer,
  last_message_at timestamptz, last_message_preview text, last_message_from_athlete boolean, intake_outcome text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- A day outside +-2 days of the server date is ignored (falls back to the server date).
  WITH d AS (SELECT CASE WHEN today BETWEEN current_date - 2 AND current_date + 2 THEN today ELSE current_date END AS today)
  SELECT p.id, p.display_name, p.avatar_url, l.created_at,
    p.fitness_goal, p.experience_level, p.age, p.height_cm, p.weight_kg, p.limitations,
    (SELECT max(ws.completed_at) FROM workout_sessions ws WHERE ws.user_id = p.id AND ws.status = 'completed'),
    (SELECT count(*)::int FROM workout_sessions ws WHERE ws.user_id = p.id AND ws.status = 'completed' AND ws.completed_at > now() - interval '7 days'),
    (SELECT count(*)::int FROM workout_sessions ws WHERE ws.user_id = p.id AND ws.status = 'completed' AND ws.completed_at > now() - interval '28 days'),
    (SELECT count(DISTINCT m.logged_date)::int FROM meal_logs m WHERE m.user_id = p.id AND m.logged_date > d.today - 7 AND m.logged_date <= d.today),
    (SELECT max(m.logged_date) FROM meal_logs m WHERE m.user_id = p.id AND m.logged_date <= d.today),
    (SELECT coalesce(sum(m.kcal), 0)::int FROM meal_logs m WHERE m.user_id = p.id AND m.logged_date = d.today),
    (SELECT coalesce(sum(m.protein), 0) FROM meal_logs m WHERE m.user_id = p.id AND m.logged_date = d.today),
    ns.goal_mode, ns.rate_pct, ns.kcal_override,
    (SELECT count(*)::int FROM coach_messages cm WHERE cm.coach_id = l.coach_id AND cm.athlete_id = p.id AND cm.sender_id = p.id AND cm.read_at IS NULL),
    (SELECT count(*)::int FROM coach_checkins c WHERE c.coach_id = l.coach_id AND c.athlete_id = p.id AND c.reviewed_at IS NULL),
    (SELECT max(c.submitted_at) FROM coach_checkins c WHERE c.coach_id = l.coach_id AND c.athlete_id = p.id),
    (SELECT wp.sessions_per_week FROM user_plan_assignments a JOIN workout_plans wp ON wp.id = a.plan_id
      WHERE a.user_id = p.id AND a.completed_at IS NULL ORDER BY a.assigned_at DESC LIMIT 1),
    lm.created_at, left(coalesce(lm.body, CASE WHEN lm.audio_path IS NOT NULL THEN '🎤' WHEN lm.image_path IS NOT NULL THEN '📷' END), 80), lm.sender_id = p.id,
    (SELECT i.outcome FROM coach_intakes i WHERE i.coach_id = l.coach_id AND i.athlete_id = p.id)
  FROM d, coach_links l
  JOIN profiles p ON p.id = l.athlete_id
  LEFT JOIN nutrition_settings ns ON ns.user_id = p.id
  LEFT JOIN LATERAL (
    SELECT cm.created_at, cm.body, cm.audio_path, cm.image_path, cm.sender_id FROM coach_messages cm
    WHERE cm.coach_id = l.coach_id AND cm.athlete_id = p.id ORDER BY cm.created_at DESC LIMIT 1
  ) lm ON true
  WHERE l.coach_id = (SELECT auth.uid()) AND l.status = 'active'
  ORDER BY l.created_at;
$$;
REVOKE EXECUTE ON FUNCTION public.coach_roster_v2(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_roster_v2(date, text) TO authenticated;

-- ---------- 2. activity v2 ----------
CREATE OR REPLACE FUNCTION public.coach_roster_activity_v2(today date, tz text)
RETURNS TABLE(athlete_id uuid, train_dates date[], food_dates date[], weights jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- Unknown time zone names fall back to UTC; a day outside +-2 days of the server date falls back to the server date.
  WITH d AS (
    SELECT CASE WHEN today BETWEEN current_date - 2 AND current_date + 2 THEN today ELSE current_date END AS today,
      coalesce((SELECT n.name FROM pg_timezone_names n WHERE n.name = tz LIMIT 1), 'UTC') AS tz
  )
  SELECT l.athlete_id,
    coalesce((SELECT array_agg(DISTINCT (ws.completed_at AT TIME ZONE d.tz)::date) FROM workout_sessions ws
      WHERE ws.user_id = l.athlete_id AND ws.status = 'completed' AND ws.completed_at > now() - interval '15 days'), '{}'),
    coalesce((SELECT array_agg(DISTINCT m.logged_date) FROM meal_logs m
      WHERE m.user_id = l.athlete_id AND m.logged_date > d.today - 14 AND m.logged_date <= d.today), '{}'),
    coalesce((SELECT jsonb_agg(jsonb_build_object('d', (b.recorded_at AT TIME ZONE d.tz)::date, 'kg', b.weight_kg) ORDER BY b.recorded_at)
      FROM body_measurements b WHERE b.user_id = l.athlete_id AND b.weight_kg IS NOT NULL AND b.recorded_at > now() - interval '42 days'), '[]'::jsonb)
  FROM d, coach_links l
  WHERE l.coach_id = (SELECT auth.uid()) AND l.status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION public.coach_roster_activity_v2(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_roster_activity_v2(date, text) TO authenticated;

-- ---------- 4. business stats ----------
CREATE OR REPLACE FUNCTION public.coach_business_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT (SELECT auth.uid()) AS id),
  links AS (SELECT l.* FROM coach_links l, me WHERE l.coach_id = me.id),
  cks AS (
    SELECT c.* FROM coach_checkins c, me WHERE c.coach_id = me.id AND c.submitted_at > now() - interval '56 days'
  ),
  waiting AS (
    SELECT l.athlete_id, lm.created_at FROM links l
    JOIN LATERAL (SELECT cm.sender_id, cm.created_at FROM coach_messages cm WHERE cm.coach_id = l.coach_id AND cm.athlete_id = l.athlete_id ORDER BY cm.created_at DESC LIMIT 1) lm ON true
    WHERE l.status = 'active' AND lm.sender_id = l.athlete_id
  )
  SELECT jsonb_build_object(
    'active', (SELECT count(*) FROM links WHERE status = 'active'),
    'joined_30d', (SELECT count(*) FROM links WHERE created_at > now() - interval '30 days'),
    'left_30d', (SELECT count(*) FROM links WHERE status = 'ended' AND ended_at > now() - interval '30 days'),
    'ever', (SELECT count(*) FROM links),
    'median_tenure_days', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (coalesce(ended_at, now()) - created_at)) / 86400) FROM links),
    'retained_90d', (SELECT count(*) FROM links WHERE created_at <= now() - interval '90 days' AND (status = 'active' OR ended_at > created_at + interval '90 days')),
    'eligible_90d', (SELECT count(*) FROM links WHERE created_at <= now() - interval '90 days'),
    'checkins_8w', (SELECT count(*) FROM cks),
    'reviewed_8w', (SELECT count(*) FROM cks WHERE reviewed_at IS NOT NULL),
    'median_review_hours', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (reviewed_at - submitted_at)) / 3600) FROM cks WHERE reviewed_at IS NOT NULL),
    'waiting_replies', (SELECT count(*) FROM waiting),
    'oldest_wait_hours', (SELECT extract(epoch FROM (now() - min(created_at))) / 3600 FROM waiting)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.coach_business_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_business_stats() TO authenticated;
