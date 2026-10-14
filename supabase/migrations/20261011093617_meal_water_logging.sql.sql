/*
# Create meal and water logging tables

1. New Tables
- `meal_logs` — user-logged meals with name, calories, protein
  - `id` (uuid PK)
  - `user_id` (uuid, defaults to auth.uid(), FK to auth.users)
  - `name` (text, not null)
  - `kcal` (integer, not null)
  - `protein` (integer, not null, default 0)
  - `logged_date` (date, not null, defaults to today)
  - `created_at` (timestamptz)
- `water_logs` — user-logged water intake per day
  - `id` (uuid PK)
  - `user_id` (uuid, defaults to auth.uid(), FK to auth.users)
  - `ml` (integer, not null)
  - `logged_date` (date, not null, defaults to today)
  - `created_at` (timestamptz)

2. Security
- RLS enabled on both tables.
- Owner-scoped CRUD: each authenticated user can only access their own rows.
- `user_id` defaults to `auth.uid()` so inserts work without explicitly passing it.
*/

CREATE TABLE IF NOT EXISTS meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kcal integer NOT NULL,
  protein integer NOT NULL DEFAULT 0,
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meal_logs" ON meal_logs;
CREATE POLICY "select_own_meal_logs" ON meal_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_meal_logs" ON meal_logs;
CREATE POLICY "insert_own_meal_logs" ON meal_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_meal_logs" ON meal_logs;
CREATE POLICY "update_own_meal_logs" ON meal_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_meal_logs" ON meal_logs;
CREATE POLICY "delete_own_meal_logs" ON meal_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ml integer NOT NULL,
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_water_logs" ON water_logs;
CREATE POLICY "select_own_water_logs" ON water_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_water_logs" ON water_logs;
CREATE POLICY "insert_own_water_logs" ON water_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_water_logs" ON water_logs;
CREATE POLICY "update_own_water_logs" ON water_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_water_logs" ON water_logs;
CREATE POLICY "delete_own_water_logs" ON water_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
