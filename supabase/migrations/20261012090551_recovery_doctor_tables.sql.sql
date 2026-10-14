/*
# Recovery Doctor: evidence-based recovery tracking tables

1. New Tables
- exercise_muscles: maps exercises to 19 fine-grained muscles with contribution weights (1.0 primary, 0.5 secondary). Shared reference data.
- daily_checkins: daily recovery check-in (sleep_hours, hydration_l, stress, resting_hr, hrv_ms, body_weight, protein_g). One row per user per day.
- soreness_logs: per-muscle soreness scores (0-10) with timestamps.
- pain_logs: structured pain intake records with triage level (green/yellow/red).
- recovery_profile: per-muscle personal recovery multipliers (0.7-1.4) with sample size and confidence.

2. Security
- RLS enabled on all tables.
- exercise_muscles: SELECT for all authenticated users; no client-side writes (service role only).
- daily_checkins, soreness_logs, pain_logs, recovery_profile: owner-scoped CRUD (authenticated, auth.uid = user_id).
- user_id columns default to auth.uid() so inserts omitting user_id succeed.

3. Important Notes
- All user-scoped tables use ON DELETE CASCADE to auth.users.
- daily_checkins has UNIQUE(user_id, checkin_date) to prevent duplicates.
- recovery_profile has UNIQUE(user_id, muscle) for one multiplier per muscle.
- exercise_muscles has UNIQUE(exercise_id, muscle) to prevent duplicate mappings.
*/

CREATE TABLE IF NOT EXISTS exercise_muscles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle text NOT NULL,
  contribution numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(exercise_id, muscle)
);

ALTER TABLE exercise_muscles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_exercise_muscles" ON exercise_muscles;
CREATE POLICY "select_exercise_muscles"
  ON exercise_muscles FOR SELECT
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours numeric,
  hydration_l numeric,
  stress integer,
  resting_hr integer,
  hrv_ms integer,
  body_weight numeric,
  protein_g numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);

ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_checkins" ON daily_checkins;
CREATE POLICY "select_own_checkins" ON daily_checkins FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_checkins" ON daily_checkins;
CREATE POLICY "insert_own_checkins" ON daily_checkins FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_checkins" ON daily_checkins;
CREATE POLICY "update_own_checkins" ON daily_checkins FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_checkins" ON daily_checkins;
CREATE POLICY "delete_own_checkins" ON daily_checkins FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS soreness_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  muscle text NOT NULL,
  soreness_score integer NOT NULL CHECK (soreness_score >= 0 AND soreness_score <= 10),
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE soreness_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_soreness" ON soreness_logs;
CREATE POLICY "select_own_soreness" ON soreness_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_soreness" ON soreness_logs;
CREATE POLICY "insert_own_soreness" ON soreness_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_soreness" ON soreness_logs;
CREATE POLICY "update_own_soreness" ON soreness_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_soreness" ON soreness_logs;
CREATE POLICY "delete_own_soreness" ON soreness_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS pain_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body_area text NOT NULL,
  onset text,
  pain_type text,
  severity integer NOT NULL DEFAULT 0 CHECK (severity >= 0 AND severity <= 10),
  during_exercise boolean,
  swelling boolean NOT NULL DEFAULT false,
  bruising boolean NOT NULL DEFAULT false,
  rom_loss boolean NOT NULL DEFAULT false,
  duration_hours numeric,
  notes text,
  triage_level text NOT NULL DEFAULT 'green',
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pain_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_pain" ON pain_logs;
CREATE POLICY "select_own_pain" ON pain_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_pain" ON pain_logs;
CREATE POLICY "insert_own_pain" ON pain_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_pain" ON pain_logs;
CREATE POLICY "update_own_pain" ON pain_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_pain" ON pain_logs;
CREATE POLICY "delete_own_pain" ON pain_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS recovery_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  muscle text NOT NULL,
  personal_multiplier numeric NOT NULL DEFAULT 1.0 CHECK (personal_multiplier >= 0.7 AND personal_multiplier <= 1.4),
  sample_size integer NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'Low',
  manually_overridden boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, muscle)
);

ALTER TABLE recovery_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recovery_profile" ON recovery_profile;
CREATE POLICY "select_own_recovery_profile" ON recovery_profile FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_recovery_profile" ON recovery_profile;
CREATE POLICY "insert_own_recovery_profile" ON recovery_profile FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_recovery_profile" ON recovery_profile;
CREATE POLICY "update_own_recovery_profile" ON recovery_profile FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_recovery_profile" ON recovery_profile;
CREATE POLICY "delete_own_recovery_profile" ON recovery_profile FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
