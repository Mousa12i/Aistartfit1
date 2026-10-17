/*
  Security audit fixes (2026-10-17).
  1. AI daily limits: users could reset their own ai_usage counter through the API. Only the
     edge functions (service role) may write it now.
  2. Coach chat: the reader of a message could change its text when marking it read. Only read_at
     can change now.
  3. Check-ins and habit logs: updates must stay tied to the athlete's active coach / own habits.
  4. Trigger functions are not callable through the API; fixed search_path on two helpers.
  5. Training plan rows: limits on rest, reps text and notes (also enforced for coach RPCs).
  6. Giving a coach routine to an athlete now keeps tempo, supersets and the alternative exercise.
*/

-- 1. AI usage counter
ALTER POLICY update_own_usage ON public.ai_usage USING (false) WITH CHECK (false);

-- 2. Coach messages: the recipient may only set read_at
CREATE OR REPLACE FUNCTION public.coach_messages_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF NEW.read_at IS NOT NULL AND OLD.read_at IS NOT NULL THEN NEW.read_at := OLD.read_at; END IF;
    NEW.id := OLD.id; NEW.coach_id := OLD.coach_id; NEW.athlete_id := OLD.athlete_id; NEW.sender_id := OLD.sender_id;
    NEW.body := OLD.body; NEW.image_path := OLD.image_path; NEW.audio_path := OLD.audio_path;
    NEW.audio_seconds := OLD.audio_seconds; NEW.broadcast_id := OLD.broadcast_id; NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER coach_messages_guard BEFORE UPDATE ON public.coach_messages
  FOR EACH ROW EXECUTE FUNCTION public.coach_messages_guard();

-- 3a. Check-ins: the athlete's edit must stay with their active coach
ALTER POLICY checkins_athlete_update ON public.coach_checkins
  WITH CHECK (auth.uid() = athlete_id AND coach_reply IS NULL AND reviewed_at IS NULL AND coach_link_active(coach_id, athlete_id));

-- 3b. Habit logs: only for the athlete's own active habits
ALTER POLICY habit_logs_athlete_update ON public.coach_habit_logs
  WITH CHECK (athlete_id = auth.uid() AND day >= current_date - 7 AND day <= current_date + 1
    AND EXISTS (SELECT 1 FROM coach_habits h WHERE h.id = coach_habit_logs.habit_id AND h.athlete_id = auth.uid() AND h.active));

-- 4. Trigger functions are not API endpoints
REVOKE EXECUTE ON FUNCTION public.on_coach_checkin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_coach_link() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_coach_link_welcome() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_coach_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_nutrition_plan_by_coach() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_plan_by_coach() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_recovery_plan_by_coach() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_targets_by_coach() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_messages_guard() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.coach_tier_limit(text) SET search_path = public;
ALTER FUNCTION public.coach_terms_current() SET search_path = public;

-- 5. Plan row limits
ALTER TABLE public.workout_plan_exercises ADD CONSTRAINT workout_plan_exercises_limits_check CHECK (
  (rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 900)
  AND (reps IS NULL OR char_length(reps) <= 20)
  AND (notes IS NULL OR char_length(notes) <= 600)
  AND (day_label IS NULL OR char_length(day_label) <= 60)
);

-- 6. Copy the full prescription when a coach gives a routine
CREATE OR REPLACE FUNCTION public.coach_assign_plan(athlete uuid, source_plan uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  INSERT INTO workout_plan_exercises (plan_id, exercise_id, exercise_order, sets, reps, rest_seconds, day_index, day_label, rir_target, notes, tempo, group_label, alt_exercise_id)
  SELECT new_id, exercise_id, exercise_order, sets, reps, rest_seconds, day_index, day_label, rir_target, notes, tempo, group_label, alt_exercise_id
  FROM workout_plan_exercises WHERE plan_id = source_plan;
  UPDATE user_plan_assignments SET completed_at = now() WHERE user_id = athlete AND completed_at IS NULL;
  INSERT INTO user_plan_assignments (user_id, plan_id) VALUES (athlete, new_id);
  RETURN new_id;
END;
$$;
