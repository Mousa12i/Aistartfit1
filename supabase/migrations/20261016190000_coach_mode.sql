/*
  # Coach mode

  A person is an athlete or a coach. A coach gets a short code; an athlete who enters it (and agrees to
  what is shared) joins that coach. One active coach per athlete. The coach can then read the athlete's
  training, food, weight and recovery logs, set their calorie targets, give them a routine, and chat
  (text and photos). The athlete can leave at any time, which ends all access immediately.

  1. profiles: account_type, coach_code, coach plan columns (server-only, like the other billing columns).
  2. coach_links: coach <-> athlete, with the consent time.
  3. coach_messages: chat, with an optional photo in the private coach-media bucket.
  4. is_coach_of(): used by read policies on the athlete's tables.
  5. RPCs (security definer, all check the link): join, leave, remove, set targets, assign routine,
     update a routine exercise, athlete card for the coach.
*/

-- 1. profiles -----------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text CHECK (account_type IN ('athlete', 'coach')),
  ADD COLUMN IF NOT EXISTS coach_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS coach_tier text NOT NULL DEFAULT 'free' CHECK (coach_tier IN ('free', 'coach', 'coach_pro', 'studio')),
  ADD COLUMN IF NOT EXISTS coach_status text,
  ADD COLUMN IF NOT EXISTS coach_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS coach_stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS coach_brand_name text,
  ADD COLUMN IF NOT EXISTS coach_bio text;

-- Coach plan columns can only be changed by the server (Stripe webhook), as with subscription_tier.
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
      NEW.coach_tier := 'free';
      NEW.coach_status := NULL;
      NEW.coach_period_end := NULL;
      NEW.coach_stripe_subscription_id := NULL;
      NEW.coach_code := NULL;
    ELSE
      NEW.subscription_tier := OLD.subscription_tier;
      NEW.subscription_status := OLD.subscription_status;
      NEW.stripe_customer_id := OLD.stripe_customer_id;
      NEW.stripe_subscription_id := OLD.stripe_subscription_id;
      NEW.subscription_current_period_end := OLD.subscription_current_period_end;
      NEW.coach_tier := OLD.coach_tier;
      NEW.coach_status := OLD.coach_status;
      NEW.coach_period_end := OLD.coach_period_end;
      NEW.coach_stripe_subscription_id := OLD.coach_stripe_subscription_id;
      NEW.coach_code := OLD.coach_code;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Athletes a coach plan allows.
CREATE OR REPLACE FUNCTION public.coach_tier_limit(tier text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE tier WHEN 'coach' THEN 25 WHEN 'coach_pro' THEN 60 WHEN 'studio' THEN 150 ELSE 8 END;
$$;

-- 2. links ----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  consented_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_by uuid,
  CHECK (coach_id <> athlete_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS coach_links_one_active_coach ON public.coach_links (athlete_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS coach_links_coach ON public.coach_links (coach_id, status);
ALTER TABLE public.coach_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_links_read_own" ON public.coach_links FOR SELECT TO authenticated
  USING (auth.uid() = coach_id OR auth.uid() = athlete_id);
-- Writes only through the RPCs below.

CREATE OR REPLACE FUNCTION public.is_coach_of(athlete uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.coach_links WHERE coach_id = auth.uid() AND athlete_id = athlete AND status = 'active');
$$;
REVOKE EXECUTE ON FUNCTION public.is_coach_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_of(uuid) TO authenticated;

-- Read access for the coach (only what the consent screen lists).
CREATE POLICY "coach_reads_sessions" ON public.workout_sessions FOR SELECT TO authenticated USING (public.is_coach_of(user_id));
CREATE POLICY "coach_reads_set_logs" ON public.workout_set_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = workout_set_logs.session_id AND public.is_coach_of(ws.user_id)));
CREATE POLICY "coach_reads_meals" ON public.meal_logs FOR SELECT TO authenticated USING (public.is_coach_of(user_id));
CREATE POLICY "coach_reads_water" ON public.water_logs FOR SELECT TO authenticated USING (public.is_coach_of(user_id));
CREATE POLICY "coach_reads_measurements" ON public.body_measurements FOR SELECT TO authenticated USING (public.is_coach_of(user_id));
CREATE POLICY "coach_reads_nutrition_settings" ON public.nutrition_settings FOR SELECT TO authenticated USING (public.is_coach_of(user_id));
CREATE POLICY "coach_reads_checkins" ON public.daily_checkins FOR SELECT TO authenticated USING (public.is_coach_of(user_id));
CREATE POLICY "coach_reads_soreness" ON public.soreness_logs FOR SELECT TO authenticated USING (public.is_coach_of(user_id));
CREATE POLICY "coach_reads_assignments" ON public.user_plan_assignments FOR SELECT TO authenticated USING (public.is_coach_of(user_id));
CREATE POLICY "coach_reads_athlete_plans" ON public.workout_plans FOR SELECT TO authenticated USING (public.is_coach_of(created_by));
CREATE POLICY "coach_reads_athlete_plan_exercises" ON public.workout_plan_exercises FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_plans wp WHERE wp.id = workout_plan_exercises.plan_id AND public.is_coach_of(wp.created_by)));

-- 3. messages -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text CHECK (body IS NULL OR char_length(body) <= 4000),
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK (body IS NOT NULL OR image_path IS NOT NULL),
  CHECK (sender_id = coach_id OR sender_id = athlete_id)
);
CREATE INDEX IF NOT EXISTS coach_messages_pair ON public.coach_messages (coach_id, athlete_id, created_at DESC);
ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.coach_link_active(c uuid, a uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.coach_links WHERE coach_id = c AND athlete_id = a AND status = 'active');
$$;
REVOKE EXECUTE ON FUNCTION public.coach_link_active(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_link_active(uuid, uuid) TO authenticated;

CREATE POLICY "coach_messages_read" ON public.coach_messages FOR SELECT TO authenticated
  USING ((auth.uid() = coach_id OR auth.uid() = athlete_id) AND public.coach_link_active(coach_id, athlete_id));
CREATE POLICY "coach_messages_send" ON public.coach_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND (auth.uid() = coach_id OR auth.uid() = athlete_id) AND public.coach_link_active(coach_id, athlete_id)
    AND (image_path IS NULL OR image_path LIKE (coach_id::text || '/' || athlete_id::text || '/%')));
-- The receiver marks messages read.
CREATE POLICY "coach_messages_mark_read" ON public.coach_messages FOR UPDATE TO authenticated
  USING ((auth.uid() = coach_id OR auth.uid() = athlete_id) AND sender_id <> auth.uid())
  WITH CHECK ((auth.uid() = coach_id OR auth.uid() = athlete_id) AND sender_id <> auth.uid());
CREATE POLICY "coach_messages_delete_own" ON public.coach_messages FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- Photos: private bucket, path coach_id/athlete_id/file. Only the two people of an active link.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('coach-media', 'coach-media', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "coach_media_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'coach-media'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid()::text = (storage.foldername(name))[2])
    AND public.coach_link_active(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid));
CREATE POLICY "coach_media_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'coach-media'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid()::text = (storage.foldername(name))[2])
    AND public.coach_link_active(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid));

-- 4. RPCs ------------------------------------------------------------------------------------------

-- A coach gets a code the first time they ask (6 letters/digits without look-alikes, e.g. SF-7K2QXM).
CREATE OR REPLACE FUNCTION public.become_coach()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT coach_code INTO code FROM profiles WHERE id = me;
  IF code IS NULL THEN
    LOOP
      code := 'SF-';
      FOR i IN 1..6 LOOP
        code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE coach_code = code);
    END LOOP;
  END IF;
  UPDATE profiles SET account_type = 'coach', coach_code = code WHERE id = me;
  RETURN code;
END;
$$;

-- What an athlete sees before agreeing to join.
CREATE OR REPLACE FUNCTION public.coach_preview(code text)
RETURNS TABLE (coach_id uuid, display_name text, brand_name text, bio text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, display_name, coach_brand_name, coach_bio, avatar_url FROM profiles
  WHERE coach_code = upper(trim(code)) AND account_type = 'coach' AND auth.uid() IS NOT NULL;
$$;

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
  SELECT id, coach_tier, coach_status, coach_period_end INTO c FROM profiles
    WHERE coach_code = upper(trim(code)) AND account_type = 'coach';
  IF c.id IS NULL THEN RAISE EXCEPTION 'code_not_found'; END IF;
  IF c.id = me THEN RAISE EXCEPTION 'own_code'; END IF;
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

-- The athlete leaves, or the coach removes the athlete. Access ends at once.
CREATE OR REPLACE FUNCTION public.end_coach_link(other uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  UPDATE coach_links SET status = 'ended', ended_at = now(), ended_by = me
  WHERE status = 'active'
    AND ((athlete_id = me AND (other IS NULL OR coach_id = other)) OR (coach_id = me AND athlete_id = other));
END;
$$;

-- Coach sets the athlete's nutrition goal and (optionally) a fixed calorie and protein target.
CREATE OR REPLACE FUNCTION public.coach_set_targets(athlete uuid, mode text, rate numeric, kcal integer, protein_per_kg numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_coach_of(athlete) THEN RAISE EXCEPTION 'not_your_athlete'; END IF;
  IF mode NOT IN ('cut', 'maintain', 'bulk', 'recomp') THEN RAISE EXCEPTION 'bad_mode'; END IF;
  IF kcal IS NOT NULL AND (kcal < 1200 OR kcal > 6000) THEN RAISE EXCEPTION 'kcal_out_of_range'; END IF;
  IF protein_per_kg IS NOT NULL AND (protein_per_kg < 0.8 OR protein_per_kg > 3.3) THEN RAISE EXCEPTION 'protein_out_of_range'; END IF;
  INSERT INTO nutrition_settings (user_id, goal_mode, rate_pct, kcal_override, protein_g_per_kg, mode_started_at)
  VALUES (athlete, mode, coalesce(rate, 0), kcal, protein_per_kg, current_date)
  ON CONFLICT (user_id) DO UPDATE SET
    goal_mode = excluded.goal_mode,
    rate_pct = excluded.rate_pct,
    kcal_override = excluded.kcal_override,
    protein_g_per_kg = excluded.protein_g_per_kg,
    mode_started_at = CASE WHEN nutrition_settings.goal_mode <> excluded.goal_mode THEN current_date ELSE nutrition_settings.mode_started_at END,
    updated_at = now();
END;
$$;

-- Coach gives the athlete one of the coach's routines (or a public one): a copy owned by the athlete.
CREATE OR REPLACE FUNCTION public.coach_assign_plan(athlete uuid, source_plan uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  src record;
  new_id uuid;
BEGIN
  IF NOT is_coach_of(athlete) THEN RAISE EXCEPTION 'not_your_athlete'; END IF;
  SELECT * INTO src FROM workout_plans WHERE id = source_plan AND (created_by = me OR is_public = true OR created_by = athlete);
  IF src.id IS NULL THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  INSERT INTO workout_plans (name, description, goal, difficulty, duration_weeks, sessions_per_week, session_duration_min, equipment_needed, image_url, is_public, created_by, details, source)
  VALUES (src.name, src.description, src.goal, src.difficulty, src.duration_weeks, src.sessions_per_week, src.session_duration_min, src.equipment_needed, src.image_url, false, athlete,
          coalesce(src.details, '{}'::jsonb) || jsonb_build_object('assigned_by_coach', me, 'assigned_at', now()), 'coach')
  RETURNING id INTO new_id;
  INSERT INTO workout_plan_exercises (plan_id, exercise_id, exercise_order, sets, reps, rest_seconds, day_index, day_label, rir_target, notes)
  SELECT new_id, exercise_id, exercise_order, sets, reps, rest_seconds, day_index, day_label, rir_target, notes
  FROM workout_plan_exercises WHERE plan_id = source_plan;
  UPDATE user_plan_assignments SET completed_at = now() WHERE user_id = athlete AND completed_at IS NULL;
  INSERT INTO user_plan_assignments (user_id, plan_id) VALUES (athlete, new_id);
  RETURN new_id;
END;
$$;

-- Coach changes sets / reps / rest / note on an exercise of a routine the athlete owns.
CREATE OR REPLACE FUNCTION public.coach_update_plan_exercise(row_id uuid, new_sets integer, new_reps text, new_rest integer, new_notes text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE owner uuid;
BEGIN
  SELECT wp.created_by INTO owner FROM workout_plan_exercises e JOIN workout_plans wp ON wp.id = e.plan_id WHERE e.id = row_id;
  IF owner IS NULL OR NOT is_coach_of(owner) THEN RAISE EXCEPTION 'not_your_athlete'; END IF;
  IF new_sets IS NOT NULL AND (new_sets < 1 OR new_sets > 10) THEN RAISE EXCEPTION 'bad_sets'; END IF;
  UPDATE workout_plan_exercises SET
    sets = coalesce(new_sets, sets),
    reps = coalesce(nullif(trim(new_reps), ''), reps),
    rest_seconds = coalesce(new_rest, rest_seconds),
    notes = CASE WHEN new_notes IS NULL THEN notes ELSE nullif(trim(new_notes), '') END
  WHERE id = row_id;
END;
$$;

-- What the coach needs about each athlete (no email, no billing).
CREATE OR REPLACE FUNCTION public.coach_athletes()
RETURNS TABLE (
  athlete_id uuid, display_name text, avatar_url text, joined_at timestamptz,
  fitness_goal text, experience_level text, age integer, height_cm numeric, weight_kg numeric, limitations text,
  last_workout_at timestamptz, workouts_7d integer, kcal_today integer, protein_today numeric,
  last_weight_kg numeric, last_weight_at timestamptz, unread integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.avatar_url, l.created_at,
    p.fitness_goal, p.experience_level, p.age, p.height_cm, p.weight_kg, p.limitations,
    (SELECT max(ws.completed_at) FROM workout_sessions ws WHERE ws.user_id = p.id AND ws.status = 'completed'),
    (SELECT count(*)::int FROM workout_sessions ws WHERE ws.user_id = p.id AND ws.status = 'completed' AND ws.completed_at > now() - interval '7 days'),
    (SELECT coalesce(sum(m.kcal), 0)::int FROM meal_logs m WHERE m.user_id = p.id AND m.logged_date = current_date),
    (SELECT coalesce(sum(m.protein), 0) FROM meal_logs m WHERE m.user_id = p.id AND m.logged_date = current_date),
    (SELECT b.weight_kg FROM body_measurements b WHERE b.user_id = p.id AND b.weight_kg IS NOT NULL ORDER BY b.recorded_at DESC LIMIT 1),
    (SELECT b.recorded_at FROM body_measurements b WHERE b.user_id = p.id AND b.weight_kg IS NOT NULL ORDER BY b.recorded_at DESC LIMIT 1),
    (SELECT count(*)::int FROM coach_messages cm WHERE cm.coach_id = l.coach_id AND cm.athlete_id = p.id AND cm.sender_id = p.id AND cm.read_at IS NULL)
  FROM coach_links l JOIN profiles p ON p.id = l.athlete_id
  WHERE l.coach_id = auth.uid() AND l.status = 'active'
  ORDER BY l.created_at;
$$;

-- The athlete's view of their coach.
CREATE OR REPLACE FUNCTION public.my_coach()
RETURNS TABLE (coach_id uuid, display_name text, brand_name text, bio text, avatar_url text, joined_at timestamptz, unread integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.coach_brand_name, p.coach_bio, p.avatar_url, l.created_at,
    (SELECT count(*)::int FROM coach_messages cm WHERE cm.coach_id = p.id AND cm.athlete_id = l.athlete_id AND cm.sender_id = p.id AND cm.read_at IS NULL)
  FROM coach_links l JOIN profiles p ON p.id = l.coach_id
  WHERE l.athlete_id = auth.uid() AND l.status = 'active';
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['become_coach()', 'coach_preview(text)', 'join_coach(text)', 'end_coach_link(uuid)',
    'coach_set_targets(uuid, text, numeric, integer, numeric)', 'coach_assign_plan(uuid, uuid)',
    'coach_update_plan_exercise(uuid, integer, text, integer, text)', 'coach_athletes()', 'my_coach()'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
