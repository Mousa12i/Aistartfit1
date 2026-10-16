/*
  # Coach mode: weekly check-ins, private notes, quick replies, check-in day

  - coach_checkins: the athlete's weekly check-in (scores 1–10, weight, wins, struggles, optional photos)
    and the coach's review (reply in the shape "win / fix / next week", reviewed_at).
  - coach_notes: the coach's private notes about an athlete (the athlete never sees them).
  - coach_replies: the coach's saved quick replies.
  - profiles.coach_checkin_day: the weekday the coach reviews (0 = Sunday … 6 = Saturday).
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coach_checkin_day smallint NOT NULL DEFAULT 1 CHECK (coach_checkin_day BETWEEN 0 AND 6);

CREATE TABLE IF NOT EXISTS public.coach_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_of date NOT NULL,
  sleep smallint CHECK (sleep BETWEEN 1 AND 10),
  energy smallint CHECK (energy BETWEEN 1 AND 10),
  stress smallint CHECK (stress BETWEEN 1 AND 10),
  hunger smallint CHECK (hunger BETWEEN 1 AND 10),
  training_adherence smallint CHECK (training_adherence BETWEEN 1 AND 10),
  nutrition_adherence smallint CHECK (nutrition_adherence BETWEEN 1 AND 10),
  weight_kg numeric CHECK (weight_kg IS NULL OR (weight_kg > 20 AND weight_kg < 400)),
  waist_cm numeric CHECK (waist_cm IS NULL OR (waist_cm > 30 AND waist_cm < 250)),
  win text CHECK (win IS NULL OR char_length(win) <= 1000),
  struggle text CHECK (struggle IS NULL OR char_length(struggle) <= 1000),
  question text CHECK (question IS NULL OR char_length(question) <= 1000),
  photo_paths text[] NOT NULL DEFAULT '{}',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  coach_reply text CHECK (coach_reply IS NULL OR char_length(coach_reply) <= 4000),
  reviewed_at timestamptz,
  UNIQUE (athlete_id, coach_id, week_of)
);
CREATE INDEX IF NOT EXISTS coach_checkins_coach ON public.coach_checkins (coach_id, reviewed_at, submitted_at DESC);
ALTER TABLE public.coach_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins_read" ON public.coach_checkins FOR SELECT TO authenticated
  USING ((auth.uid() = athlete_id OR auth.uid() = coach_id) AND public.coach_link_active(coach_id, athlete_id));
CREATE POLICY "checkins_athlete_insert" ON public.coach_checkins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = athlete_id AND public.coach_link_active(coach_id, athlete_id) AND coach_reply IS NULL AND reviewed_at IS NULL);
CREATE POLICY "checkins_athlete_update" ON public.coach_checkins FOR UPDATE TO authenticated
  USING (auth.uid() = athlete_id AND reviewed_at IS NULL) WITH CHECK (auth.uid() = athlete_id AND coach_reply IS NULL AND reviewed_at IS NULL);

-- The coach reviews through this function so they can only write the reply fields.
CREATE OR REPLACE FUNCTION public.coach_review_checkin(checkin uuid, reply text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE coach_checkins SET coach_reply = nullif(trim(reply), ''), reviewed_at = now()
  WHERE id = checkin AND coach_id = auth.uid() AND coach_link_active(coach_id, athlete_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'not_your_checkin'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.coach_review_checkin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_review_checkin(uuid, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.coach_notes (
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 8000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, athlete_id)
);
ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_coach_only" ON public.coach_notes FOR ALL TO authenticated
  USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id AND public.coach_link_active(coach_id, athlete_id));

CREATE TABLE IF NOT EXISTS public.coach_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coach_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "replies_own" ON public.coach_replies FOR ALL TO authenticated USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);

-- Check-in photos may live under coach_id/athlete_id/checkins/ in the coach-media bucket (existing policies cover it).

-- The athlete's view of their coach, with the review day.
CREATE OR REPLACE FUNCTION public.my_coach_info()
RETURNS TABLE (coach_id uuid, display_name text, brand_name text, bio text, avatar_url text, joined_at timestamptz, unread integer, checkin_day smallint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.coach_brand_name, p.coach_bio, p.avatar_url, l.created_at,
    (SELECT count(*)::int FROM coach_messages cm WHERE cm.coach_id = p.id AND cm.athlete_id = l.athlete_id AND cm.sender_id = p.id AND cm.read_at IS NULL),
    p.coach_checkin_day
  FROM coach_links l JOIN profiles p ON p.id = l.coach_id
  WHERE l.athlete_id = auth.uid() AND l.status = 'active';
$$;

-- The coach's roster with everything the "needs you" list uses (one round trip).
CREATE OR REPLACE FUNCTION public.coach_roster()
RETURNS TABLE (
  athlete_id uuid, display_name text, avatar_url text, joined_at timestamptz,
  fitness_goal text, experience_level text, age integer, height_cm numeric, profile_weight_kg numeric, limitations text,
  last_workout_at timestamptz, workouts_7d integer, workouts_28d integer,
  food_days_7d integer, last_food_date date, kcal_today integer, protein_today numeric,
  goal_mode text, rate_pct numeric, kcal_override integer,
  unread integer, pending_checkins integer, last_checkin_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.avatar_url, l.created_at,
    p.fitness_goal, p.experience_level, p.age, p.height_cm, p.weight_kg, p.limitations,
    (SELECT max(ws.completed_at) FROM workout_sessions ws WHERE ws.user_id = p.id AND ws.status = 'completed'),
    (SELECT count(*)::int FROM workout_sessions ws WHERE ws.user_id = p.id AND ws.status = 'completed' AND ws.completed_at > now() - interval '7 days'),
    (SELECT count(*)::int FROM workout_sessions ws WHERE ws.user_id = p.id AND ws.status = 'completed' AND ws.completed_at > now() - interval '28 days'),
    (SELECT count(DISTINCT m.logged_date)::int FROM meal_logs m WHERE m.user_id = p.id AND m.logged_date > current_date - 7),
    (SELECT max(m.logged_date) FROM meal_logs m WHERE m.user_id = p.id),
    (SELECT coalesce(sum(m.kcal), 0)::int FROM meal_logs m WHERE m.user_id = p.id AND m.logged_date = current_date),
    (SELECT coalesce(sum(m.protein), 0) FROM meal_logs m WHERE m.user_id = p.id AND m.logged_date = current_date),
    ns.goal_mode, ns.rate_pct, ns.kcal_override,
    (SELECT count(*)::int FROM coach_messages cm WHERE cm.coach_id = l.coach_id AND cm.athlete_id = p.id AND cm.sender_id = p.id AND cm.read_at IS NULL),
    (SELECT count(*)::int FROM coach_checkins c WHERE c.coach_id = l.coach_id AND c.athlete_id = p.id AND c.reviewed_at IS NULL),
    (SELECT max(c.submitted_at) FROM coach_checkins c WHERE c.coach_id = l.coach_id AND c.athlete_id = p.id)
  FROM coach_links l
  JOIN profiles p ON p.id = l.athlete_id
  LEFT JOIN nutrition_settings ns ON ns.user_id = p.id
  WHERE l.coach_id = auth.uid() AND l.status = 'active'
  ORDER BY l.created_at;
$$;

REVOKE EXECUTE ON FUNCTION public.my_coach_info() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_coach_info() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_roster() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_roster() TO authenticated;

-- Last 14 days of activity per athlete, for the roster's day-by-day strip.
CREATE OR REPLACE FUNCTION public.coach_roster_activity()
RETURNS TABLE (athlete_id uuid, train_dates date[], food_dates date[], weights jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.athlete_id,
    coalesce((SELECT array_agg(DISTINCT (ws.completed_at AT TIME ZONE 'UTC')::date) FROM workout_sessions ws
      WHERE ws.user_id = l.athlete_id AND ws.status = 'completed' AND ws.completed_at > now() - interval '14 days'), '{}'),
    coalesce((SELECT array_agg(DISTINCT m.logged_date) FROM meal_logs m
      WHERE m.user_id = l.athlete_id AND m.logged_date > current_date - 14), '{}'),
    coalesce((SELECT jsonb_agg(jsonb_build_object('d', b.recorded_at::date, 'kg', b.weight_kg) ORDER BY b.recorded_at)
      FROM body_measurements b WHERE b.user_id = l.athlete_id AND b.weight_kg IS NOT NULL AND b.recorded_at > now() - interval '42 days'), '[]'::jsonb)
  FROM coach_links l
  WHERE l.coach_id = auth.uid() AND l.status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION public.coach_roster_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_roster_activity() TO authenticated;
