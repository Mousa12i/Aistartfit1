/*
# Expand exercises table for free-exercise-db dataset integration

## Purpose
Adds new columns to the exercises table to support the full free-exercise-db dataset
(876 exercises) while maintaining backward compatibility with existing workout plans,
set logs, and recovery engine references.

## New Columns
1. `source_id` (text, nullable) — Original dataset ID for deduplication during import.
2. `category` (text, nullable) — Exercise category: "strength", "cardio", "stretching", etc.
3. `force_type` (text, nullable) — Force type: "push", "pull", "static", or NULL. Named force_type to avoid reserved keyword.
4. `mechanic` (text, nullable) — Movement mechanic: "compound", "isolation", or NULL.
5. `primary_muscles` (text array, nullable) — Raw primary muscle names from dataset.
6. `secondary_muscles_raw` (text array, nullable) — Raw secondary muscle names from dataset.
7. `is_custom` (boolean, default false) — Whether the exercise was user-created.

## Modified Columns
- `description` changed to nullable (dataset exercises may have instructions but no separate description).
- `equipment` CHECK constraint dropped to accept wider values from dataset (12 equipment types).
- `primary_muscle` CHECK constraint dropped to accept wider mapped values.
- `difficulty` CHECK constraint dropped to accept any text value.

## Security
- Existing read_exercises policy (anon + authenticated SELECT) preserved.
- New INSERT and UPDATE policies for authenticated users to add custom exercises.
*/

ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS force_type text;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS mechanic text;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS primary_muscles text[];
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS secondary_muscles_raw text[];
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;

ALTER TABLE public.exercises ALTER COLUMN description DROP NOT NULL;

ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_equipment_check;
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_primary_muscle_check;
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_difficulty_check;

CREATE INDEX IF NOT EXISTS exercises_source_id_idx ON public.exercises (source_id);
CREATE INDEX IF NOT EXISTS exercises_category_idx ON public.exercises (category);
CREATE INDEX IF NOT EXISTS exercises_is_custom_idx ON public.exercises (is_custom);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_exercises" ON public.exercises;
CREATE POLICY "read_exercises" ON public.exercises FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_custom_exercises" ON public.exercises;
CREATE POLICY "insert_custom_exercises" ON public.exercises FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_custom_exercises" ON public.exercises;
CREATE POLICY "update_custom_exercises" ON public.exercises FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
