/*
# Training brain: day-aware routines, saved plans, per-account memory and the training coach

1. Routines (workout_plans / workout_plan_exercises / workout_sessions)
   - workout_plans: details (the full plan as JSON: volume, reasons, references), source
     (library | user | engine | coach), updated_at, archived.
   - workout_plan_exercises: day_index + day_label (so a routine has real training days),
     rir_target and notes.
   - workout_sessions: plan_day (which day of the routine was trained).
   - save_training_plan(): saves a routine and its exercises in one transaction, as the caller
     (row level security applies), optionally replacing an existing routine and making it active.

2. training_profiles: the answers the plan was built from (goal, schedule, equipment, health
   screening, pain), one row per account, so the app only asks for what is missing next time.

3. user_memory: facts the person or a coach saved about the account (injuries, preferences,
   equipment, goals). The person can see, edit and delete every entry. Shared by all coaches.

4. training_coach_messages: chat history of the training coach.

All new tables are private to their owner. The coach's server function writes with the service role.
*/

-- ============ ROUTINES ============
ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS details jsonb,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'library',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

UPDATE public.workout_plans SET source = 'user' WHERE source = 'library' AND is_public = false AND created_by IS NOT NULL;

ALTER TABLE public.workout_plans DROP CONSTRAINT IF EXISTS workout_plans_source_check;
ALTER TABLE public.workout_plans ADD CONSTRAINT workout_plans_source_check CHECK (source IN ('library', 'user', 'engine', 'coach'));

ALTER TABLE public.workout_plan_exercises
  ADD COLUMN IF NOT EXISTS day_index int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS day_label text,
  ADD COLUMN IF NOT EXISTS rir_target int,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.workout_plan_exercises DROP CONSTRAINT IF EXISTS workout_plan_exercises_day_check;
ALTER TABLE public.workout_plan_exercises ADD CONSTRAINT workout_plan_exercises_day_check
  CHECK (day_index BETWEEN 0 AND 13 AND (rir_target IS NULL OR rir_target BETWEEN 0 AND 5) AND sets BETWEEN 1 AND 10);

CREATE INDEX IF NOT EXISTS idx_plan_exercises_plan_day ON public.workout_plan_exercises (plan_id, day_index, exercise_order);

ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS plan_day int;

-- Plan owners could already update their plan rows; keep updated_at current.
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Routines people create themselves are 'user' routines even when the app does not say so.
CREATE OR REPLACE FUNCTION public.workout_plans_default_source() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source = 'library' AND NEW.is_public = false AND NEW.created_by IS NOT NULL THEN
    NEW.source := 'user';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workout_plans_default_source ON public.workout_plans;
CREATE TRIGGER workout_plans_default_source BEFORE INSERT ON public.workout_plans
  FOR EACH ROW EXECUTE FUNCTION public.workout_plans_default_source();

DROP TRIGGER IF EXISTS workout_plans_touch ON public.workout_plans;
CREATE TRIGGER workout_plans_touch BEFORE UPDATE ON public.workout_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

/*
  Saves a routine with its exercises. Runs as the caller, so the normal row level security applies:
  a person can only create or replace their own routines. p_exercises is a JSON array of
  { exercise_id, day_index, day_label, exercise_order, sets, reps, rest_seconds, rir_target, notes }.
*/
CREATE OR REPLACE FUNCTION public.save_training_plan(
  p_name text,
  p_description text,
  p_goal text,
  p_difficulty text,
  p_sessions_per_week int,
  p_session_minutes int,
  p_duration_weeks int,
  p_equipment text[],
  p_details jsonb,
  p_source text,
  p_exercises jsonb,
  p_replace_plan_id uuid DEFAULT NULL,
  p_activate boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan uuid;
  v_count int;
  v_visible int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to save a routine.' USING ERRCODE = '28000';
  END IF;
  IF p_source NOT IN ('user', 'engine', 'coach') THEN
    RAISE EXCEPTION 'Unknown routine source.' USING ERRCODE = '22023';
  END IF;
  IF coalesce(length(trim(p_name)), 0) = 0 OR length(p_name) > 120 THEN
    RAISE EXCEPTION 'A routine needs a name of up to 120 characters.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_exercises) <> 'array' OR jsonb_array_length(p_exercises) = 0 OR jsonb_array_length(p_exercises) > 120 THEN
    RAISE EXCEPTION 'A routine needs between 1 and 120 exercises.' USING ERRCODE = '22023';
  END IF;

  -- every exercise must exist, be visible to this person and not be a hidden duplicate
  SELECT count(*), count(e.id) FILTER (WHERE NOT e.is_hidden)
    INTO v_count, v_visible
  FROM jsonb_array_elements(p_exercises) x
  LEFT JOIN exercises e ON e.id = (x->>'exercise_id')::uuid;
  IF v_visible <> v_count THEN
    RAISE EXCEPTION 'One or more exercises are not available.' USING ERRCODE = '22023';
  END IF;

  IF p_replace_plan_id IS NOT NULL THEN
    UPDATE workout_plans SET
      name = p_name,
      description = coalesce(p_description, ''),
      goal = p_goal,
      difficulty = p_difficulty,
      sessions_per_week = p_sessions_per_week,
      session_duration_min = p_session_minutes,
      duration_weeks = p_duration_weeks,
      equipment_needed = coalesce(p_equipment, '{}'),
      details = p_details,
      source = p_source,
      archived = false
    WHERE id = p_replace_plan_id AND created_by = v_uid
    RETURNING id INTO v_plan;
    IF v_plan IS NULL THEN
      RAISE EXCEPTION 'That routine does not exist or is not yours.' USING ERRCODE = '42501';
    END IF;
    DELETE FROM workout_plan_exercises WHERE plan_id = v_plan;
  ELSE
    INSERT INTO workout_plans (name, description, goal, difficulty, duration_weeks, sessions_per_week, session_duration_min,
                               equipment_needed, is_public, created_by, details, source)
    VALUES (p_name, coalesce(p_description, ''), p_goal, p_difficulty, p_duration_weeks, p_sessions_per_week, p_session_minutes,
            coalesce(p_equipment, '{}'), false, v_uid, p_details, p_source)
    RETURNING id INTO v_plan;
  END IF;

  INSERT INTO workout_plan_exercises (plan_id, exercise_id, exercise_order, sets, reps, rest_seconds, day_index, day_label, rir_target, notes)
  SELECT v_plan,
         (x->>'exercise_id')::uuid,
         coalesce((x->>'exercise_order')::int, ord::int),
         (x->>'sets')::int,
         coalesce(x->>'reps', '8-12'),
         coalesce((x->>'rest_seconds')::int, 90),
         coalesce((x->>'day_index')::int, 0),
         x->>'day_label',
         (x->>'rir_target')::int,
         x->>'notes'
  FROM jsonb_array_elements(p_exercises) WITH ORDINALITY AS t(x, ord);

  IF p_activate THEN
    -- only one active routine at a time: close the others, then (re)open this one
    UPDATE user_plan_assignments SET completed_at = now()
      WHERE user_id = v_uid AND completed_at IS NULL AND plan_id <> v_plan;
    IF NOT EXISTS (SELECT 1 FROM user_plan_assignments WHERE user_id = v_uid AND plan_id = v_plan AND completed_at IS NULL) THEN
      INSERT INTO user_plan_assignments (user_id, plan_id) VALUES (v_uid, v_plan);
    END IF;
  END IF;

  RETURN v_plan;
END;
$$;

REVOKE ALL ON FUNCTION public.save_training_plan(text, text, text, text, int, int, int, text[], jsonb, text, jsonb, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_training_plan(text, text, text, text, int, int, int, text[], jsonb, text, jsonb, uuid, boolean) TO authenticated;

-- ============ TRAINING PROFILE ============
CREATE TABLE IF NOT EXISTS public.training_profiles (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  intake jsonb NOT NULL DEFAULT '{}'::jsonb,
  screening jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_training_profile_select" ON public.training_profiles;
CREATE POLICY "own_training_profile_select" ON public.training_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_training_profile_insert" ON public.training_profiles;
CREATE POLICY "own_training_profile_insert" ON public.training_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_training_profile_update" ON public.training_profiles;
CREATE POLICY "own_training_profile_update" ON public.training_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_training_profile_delete" ON public.training_profiles;
CREATE POLICY "own_training_profile_delete" ON public.training_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS training_profiles_touch ON public.training_profiles;
CREATE TRIGGER training_profiles_touch BEFORE UPDATE ON public.training_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ MEMORY ============
CREATE TABLE IF NOT EXISTS public.user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('goal', 'health', 'injury', 'equipment', 'schedule', 'preference', 'training', 'nutrition', 'recovery', 'other')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'training_coach', 'nutrition_coach', 'ai_coach', 'app')),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_memory_user ON public.user_memory (user_id, updated_at DESC);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_memory_select" ON public.user_memory;
CREATE POLICY "own_memory_select" ON public.user_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_memory_insert" ON public.user_memory;
CREATE POLICY "own_memory_insert" ON public.user_memory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND source = 'user');
DROP POLICY IF EXISTS "own_memory_update" ON public.user_memory;
CREATE POLICY "own_memory_update" ON public.user_memory FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_memory_delete" ON public.user_memory;
CREATE POLICY "own_memory_delete" ON public.user_memory FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_memory_touch ON public.user_memory;
CREATE TRIGGER user_memory_touch BEFORE UPDATE ON public.user_memory
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- A person can keep up to 200 memories; coaches save through the service role and are held to the same limit.
CREATE OR REPLACE FUNCTION public.user_memory_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM user_memory WHERE user_id = NEW.user_id) >= 200 THEN
    RAISE EXCEPTION 'Memory is full (200 entries). Delete some entries first.' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.user_memory_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_memory_limit ON public.user_memory;
CREATE TRIGGER user_memory_limit BEFORE INSERT ON public.user_memory
  FOR EACH ROW EXECUTE FUNCTION public.user_memory_limit();

-- ============ TRAINING COACH CHAT ============
CREATE TABLE IF NOT EXISTS public.training_coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (length(content) <= 8000),
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_coach_messages_user ON public.training_coach_messages (user_id, created_at DESC);

ALTER TABLE public.training_coach_messages ENABLE ROW LEVEL SECURITY;

-- Messages are written by the coach's server function (service role); people can read and delete theirs.
DROP POLICY IF EXISTS "own_training_coach_select" ON public.training_coach_messages;
CREATE POLICY "own_training_coach_select" ON public.training_coach_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_training_coach_delete" ON public.training_coach_messages;
CREATE POLICY "own_training_coach_delete" ON public.training_coach_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
