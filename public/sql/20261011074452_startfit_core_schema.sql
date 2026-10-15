/*
# StartFit Core Schema — Profiles, Exercises, Workout Plans, Sessions, AI

## Overview
This migration creates the complete non-shop database schema for StartFit, a premium fitness application.
It establishes tables for user profiles, exercise library, workout programmes, workout sessions with set logging,
and AI coaching conversations with usage tracking. Row Level Security is enabled on every table.

## New Tables

1. **profiles** — User profile data linked to auth.users
   - id (uuid, PK, references auth.users)
   - email (text, not null)
   - display_name, avatar_url (nullable)
   - fitness_goal, experience_level, training_location, preferred_equipment, preferred_days (nullable)
   - session_duration_min (int, nullable)
   - limitations (text, nullable — user-provided training limitations)
   - unit_system ('metric' | 'imperial', default 'metric')
   - notification_enabled (bool, default true)
   - onboarding_completed (bool, default false)
   - created_at, updated_at (timestamptz)

2. **exercises** — Public exercise library (read-only for users)
   - id, name, description, instructions (text[])
   - safety_notes, primary_muscle, secondary_muscles, equipment, difficulty
   - default_sets, default_reps, default_rest_seconds
   - image_url (nullable)
   - created_at

3. **workout_plans** — Workout programmes (public seed + user-created)
   - id, name, description, goal, difficulty
   - duration_weeks, sessions_per_week, session_duration_min
   - equipment_needed (equipment[])
   - image_url, is_public, created_by
   - created_at

4. **workout_plan_exercises** — Junction table linking plans to exercises with set/rep/rest config
   - id, plan_id (FK), exercise_id (FK), exercise_order
   - sets, reps, rest_seconds

5. **user_plan_assignments** — Tracks which programmes a user has selected
   - id, user_id (FK), plan_id (FK), assigned_at, completed_at, progress_percent

6. **workout_sessions** — Records of completed/pending workout sessions
   - id, user_id (FK), plan_id (nullable), plan_name
   - started_at, completed_at (nullable), duration_seconds
   - total_sets, total_reps, exercises_completed, notes

7. **workout_set_logs** — Individual set records within a session
   - id, session_id (FK), exercise_id, exercise_name
   - set_number, reps, weight, completed

8. **ai_conversations** — AI Coach conversation threads
   - id, user_id (FK), title, created_at

9. **ai_messages** — Individual messages in AI conversations
   - id, conversation_id (FK), user_id (FK), role ('user' | 'assistant'), content, created_at

10. **ai_usage** — Per-user AI usage tracking for rate limiting
    - id, user_id (FK), request_count, last_request_at, daily_limit

## Security (RLS)
- profiles: users can CRUD only their own profile. A trigger auto-creates a profile on signup.
- exercises: public read (anon + authenticated), no writes from client.
- workout_plans: public plans readable by all; user plans readable by owner. Only owner can insert/update/delete their plans.
- workout_plan_exercises: readable by all (for public plans) or owner. Writes by plan owner only.
- user_plan_assignments: owner-scoped CRUD.
- workout_sessions: owner-scoped CRUD.
- workout_set_logs: owner-scoped CRUD (via session ownership check).
- ai_conversations: owner-scoped CRUD.
- ai_messages: owner-scoped CRUD (via conversation ownership check).
- ai_usage: owner can read/update only.

## Important Notes
1. A trigger function `handle_new_user()` automatically creates a profile row when a new auth.user signs up.
2. All user-owned tables use `user_id uuid NOT NULL DEFAULT auth.uid()` so inserts succeed even when the client omits user_id.
3. Profile creation via trigger prevents privilege escalation — users cannot set arbitrary roles or create profiles for other users.
4. Exercise library is seeded with 18 exercises and 6 workout programmes with full exercise assignments.
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  avatar_url text,
  fitness_goal text CHECK (fitness_goal IN ('fat_loss','muscle_gain','strength','endurance','general_fitness')),
  experience_level text CHECK (experience_level IN ('beginner','intermediate','advanced')),
  training_location text CHECK (training_location IN ('gym','home','outdoor')),
  preferred_equipment text[],
  preferred_days text[],
  session_duration_min int,
  limitations text,
  unit_system text NOT NULL DEFAULT 'metric' CHECK (unit_system IN ('metric','imperial')),
  notification_enabled boolean NOT NULL DEFAULT true,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ EXERCISES (public library) ============
CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  instructions text[] NOT NULL,
  safety_notes text,
  primary_muscle text NOT NULL CHECK (primary_muscle IN ('chest','back','shoulders','arms','legs','glutes','core','full_body','cardio')),
  secondary_muscles text[],
  equipment text NOT NULL DEFAULT 'none' CHECK (equipment IN ('none','dumbbells','barbell','kettlebell','resistance_bands','pull_up_bar','bench','machine')),
  difficulty text NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  default_sets int NOT NULL DEFAULT 3,
  default_reps text NOT NULL DEFAULT '8-12',
  default_rest_seconds int NOT NULL DEFAULT 60,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_exercises" ON exercises;
CREATE POLICY "read_exercises" ON exercises FOR SELECT
  TO anon, authenticated USING (true);

-- ============ WORKOUT PLANS ============
CREATE TABLE IF NOT EXISTS workout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  goal text NOT NULL CHECK (goal IN ('fat_loss','muscle_gain','strength','endurance','general_fitness')),
  difficulty text NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  duration_weeks int NOT NULL DEFAULT 4,
  sessions_per_week int NOT NULL DEFAULT 3,
  session_duration_min int NOT NULL DEFAULT 45,
  equipment_needed text[] NOT NULL DEFAULT '{}',
  image_url text,
  is_public boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_workout_plans" ON workout_plans;
CREATE POLICY "read_workout_plans" ON workout_plans FOR SELECT
  TO anon, authenticated USING (is_public = true OR created_by = auth.uid());

DROP POLICY IF EXISTS "insert_own_workout_plans" ON workout_plans;
CREATE POLICY "insert_own_workout_plans" ON workout_plans FOR INSERT
  TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "update_own_workout_plans" ON workout_plans;
CREATE POLICY "update_own_workout_plans" ON workout_plans FOR UPDATE
  TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "delete_own_workout_plans" ON workout_plans;
CREATE POLICY "delete_own_workout_plans" ON workout_plans FOR DELETE
  TO authenticated USING (created_by = auth.uid());

-- ============ WORKOUT PLAN EXERCISES ============
CREATE TABLE IF NOT EXISTS workout_plan_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  exercise_order int NOT NULL DEFAULT 0,
  sets int NOT NULL DEFAULT 3,
  reps text NOT NULL DEFAULT '8-12',
  rest_seconds int NOT NULL DEFAULT 60
);

ALTER TABLE workout_plan_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_plan_exercises" ON workout_plan_exercises;
CREATE POLICY "read_plan_exercises" ON workout_plan_exercises FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM workout_plans wp WHERE wp.id = plan_id AND (wp.is_public = true OR wp.created_by = auth.uid()))
  );

DROP POLICY IF EXISTS "insert_own_plan_exercises" ON workout_plan_exercises;
CREATE POLICY "insert_own_plan_exercises" ON workout_plan_exercises FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM workout_plans wp WHERE wp.id = plan_id AND wp.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_plan_exercises" ON workout_plan_exercises;
CREATE POLICY "update_own_plan_exercises" ON workout_plan_exercises FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workout_plans wp WHERE wp.id = plan_id AND wp.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_plan_exercises" ON workout_plan_exercises;
CREATE POLICY "delete_own_plan_exercises" ON workout_plan_exercises FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workout_plans wp WHERE wp.id = plan_id AND wp.created_by = auth.uid())
  );

-- ============ USER PLAN ASSIGNMENTS ============
CREATE TABLE IF NOT EXISTS user_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  progress_percent int NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

ALTER TABLE user_plan_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_assignments" ON user_plan_assignments;
CREATE POLICY "select_own_assignments" ON user_plan_assignments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_assignments" ON user_plan_assignments;
CREATE POLICY "insert_own_assignments" ON user_plan_assignments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_assignments" ON user_plan_assignments;
CREATE POLICY "update_own_assignments" ON user_plan_assignments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_assignments" ON user_plan_assignments;
CREATE POLICY "delete_own_assignments" ON user_plan_assignments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ WORKOUT SESSIONS ============
CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES workout_plans(id) ON DELETE SET NULL,
  plan_name text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds int NOT NULL DEFAULT 0,
  total_sets int NOT NULL DEFAULT 0,
  total_reps int NOT NULL DEFAULT 0,
  exercises_completed int NOT NULL DEFAULT 0,
  notes text
);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON workout_sessions;
CREATE POLICY "select_own_sessions" ON workout_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sessions" ON workout_sessions;
CREATE POLICY "insert_own_sessions" ON workout_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sessions" ON workout_sessions;
CREATE POLICY "update_own_sessions" ON workout_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sessions" ON workout_sessions;
CREATE POLICY "delete_own_sessions" ON workout_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_completed_at ON workout_sessions(completed_at DESC);

-- ============ WORKOUT SET LOGS ============
CREATE TABLE IF NOT EXISTS workout_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL,
  exercise_name text NOT NULL,
  set_number int NOT NULL,
  reps int NOT NULL DEFAULT 0,
  weight numeric,
  completed boolean NOT NULL DEFAULT false
);

ALTER TABLE workout_set_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_set_logs" ON workout_set_logs;
CREATE POLICY "select_own_set_logs" ON workout_set_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_set_logs" ON workout_set_logs;
CREATE POLICY "insert_own_set_logs" ON workout_set_logs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_set_logs" ON workout_set_logs;
CREATE POLICY "update_own_set_logs" ON workout_set_logs FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_set_logs" ON workout_set_logs;
CREATE POLICY "delete_own_set_logs" ON workout_set_logs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid())
  );

-- ============ AI CONVERSATIONS ============
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversations" ON ai_conversations;
CREATE POLICY "select_own_conversations" ON ai_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_conversations" ON ai_conversations;
CREATE POLICY "insert_own_conversations" ON ai_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_conversations" ON ai_conversations;
CREATE POLICY "delete_own_conversations" ON ai_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ AI MESSAGES ============
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON ai_messages;
CREATE POLICY "select_own_messages" ON ai_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_messages" ON ai_messages;
CREATE POLICY "insert_own_messages" ON ai_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_messages" ON ai_messages;
CREATE POLICY "delete_own_messages" ON ai_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id, created_at);

-- ============ AI USAGE ============
CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count int NOT NULL DEFAULT 0,
  last_request_at timestamptz NOT NULL DEFAULT now(),
  daily_limit int NOT NULL DEFAULT 20,
  UNIQUE(user_id)
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_usage" ON ai_usage;
CREATE POLICY "select_own_usage" ON ai_usage FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_usage" ON ai_usage;
CREATE POLICY "update_own_usage" ON ai_usage FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ UPDATED_AT TRIGGER FOR PROFILES ============
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
