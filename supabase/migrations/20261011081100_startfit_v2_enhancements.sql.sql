/*
# StartFit V2 Enhancements — Video, Metrics, Goals, Measurements, Exercises

## Purpose
Extends the StartFit schema to support the V2 product spec: real instructional
video metadata on exercises, personal metrics (age/height/weight/activity level)
on profiles, a user goals system, body measurement tracking, and additional
seed exercises.

## 1. New Columns on `exercises`
- `video_url` (text, nullable) — URL to an instructional video.
- `video_thumbnail` (text, nullable) — poster image URL for the video player.
- `video_duration` (integer, nullable) — video length in seconds.
- `video_source` (text, not null, default 'unknown') — provenance label.

## 2. New Columns on `profiles`
- `age` (integer, nullable)
- `height_cm` (numeric, nullable)
- `weight_kg` (numeric, nullable)
- `activity_level` (text, nullable)

## 3. New Table: `user_goals`
Personal fitness goals a user can create, edit, and track. Owner-scoped RLS.

## 4. New Table: `body_measurements`
Time-series body measurement records. Owner-scoped RLS.

## 5. Seed Data
9 additional exercises inserted with WHERE NOT EXISTS guards for idempotency.

## 6. Security
- RLS enabled on user_goals and body_measurements.
- Owner-scoped CRUD policies (select/insert/update/delete) TO authenticated.
- user_id columns DEFAULT auth.uid() so client inserts omitting user_id succeed.
*/

-- ============================================================
-- 1. Exercise video columns
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='exercises' AND column_name='video_url') THEN
    ALTER TABLE exercises ADD COLUMN video_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='exercises' AND column_name='video_thumbnail') THEN
    ALTER TABLE exercises ADD COLUMN video_thumbnail text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='exercises' AND column_name='video_duration') THEN
    ALTER TABLE exercises ADD COLUMN video_duration integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='exercises' AND column_name='video_source') THEN
    ALTER TABLE exercises ADD COLUMN video_source text NOT NULL DEFAULT 'unknown';
  END IF;
END $$;

-- ============================================================
-- 2. Profile personal metric columns
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='age') THEN
    ALTER TABLE profiles ADD COLUMN age integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='height_cm') THEN
    ALTER TABLE profiles ADD COLUMN height_cm numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='weight_kg') THEN
    ALTER TABLE profiles ADD COLUMN weight_kg numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='activity_level') THEN
    ALTER TABLE profiles ADD COLUMN activity_level text;
  END IF;
END $$;

-- ============================================================
-- 3. user_goals table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  target_value numeric,
  current_value numeric DEFAULT 0,
  unit text,
  deadline date,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_goals" ON user_goals;
CREATE POLICY "select_own_goals" ON user_goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_goals" ON user_goals;
CREATE POLICY "insert_own_goals" ON user_goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_goals" ON user_goals;
CREATE POLICY "update_own_goals" ON user_goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_goals" ON user_goals;
CREATE POLICY "delete_own_goals" ON user_goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 4. body_measurements table
-- ============================================================
CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric,
  body_fat_percent numeric,
  chest_cm numeric,
  waist_cm numeric,
  hips_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  notes text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_measurements" ON body_measurements;
CREATE POLICY "select_own_measurements" ON body_measurements FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_measurements" ON body_measurements;
CREATE POLICY "insert_own_measurements" ON body_measurements FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_measurements" ON body_measurements;
CREATE POLICY "update_own_measurements" ON body_measurements FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_measurements" ON body_measurements;
CREATE POLICY "delete_own_measurements" ON body_measurements FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 5. Additional seed exercises (idempotent via WHERE NOT EXISTS)
-- ============================================================
INSERT INTO exercises (name, description, instructions, safety_notes, primary_muscle, secondary_muscles, equipment, difficulty, default_sets, default_reps, default_rest_seconds, video_source)
SELECT * FROM (VALUES
  ('Barbell Bench Press',
   'The king of chest exercises. Builds raw pressing strength and pec mass.',
   ARRAY['Lie flat on a bench with eyes under the bar.','Grip the bar slightly wider than shoulder-width.','Plant feet firmly, retract shoulder blades.','Lower the bar to mid-chest with control.','Press up explosively to full lockout.'],
   'Always use a spotter for heavy sets. Keep wrists stacked over elbows.',
   'chest', ARRAY['shoulders','arms'], 'barbell', 'intermediate', 4, '5-8', 120, 'unknown'),
  ('Incline Dumbbell Press',
   'Targets the upper chest fibres for full pectoral development.',
   ARRAY['Set an incline bench to 30-45 degrees.','Sit back with dumbbells at shoulder level.','Press the dumbbells up and slightly together.','Lower with control, feeling a stretch.','Repeat for reps.'],
   'Use a moderate incline; too steep shifts load to shoulders.',
   'chest', ARRAY['shoulders'], 'dumbbells', 'beginner', 3, '8-12', 90, 'unknown'),
  ('Romanian Deadlift',
   'Hamstring and glute builder that improves hip hinge mechanics.',
   ARRAY['Stand with a barbell at hip height, feet shoulder-width.','Unlock knees slightly, chest tall.','Hinge at the hips, lowering the bar along your legs.','Keep the bar close; feel a hamstring stretch.','Drive hips forward to return to standing.'],
   'Keep a neutral spine. Do not round your lower back.',
   'legs', ARRAY['glutes','back'], 'barbell', 'intermediate', 3, '8-10', 120, 'unknown'),
  ('Lat Pulldown',
   'Builds back width and targets the lats through a vertical pull.',
   ARRAY['Sit at a lat pulldown station, knees under pads.','Grip the bar wider than shoulder-width.','Pull the bar to upper chest, elbows down.','Squeeze the lats at the bottom.','Control the return to full stretch.'],
   'Avoid swinging or using momentum to pull the weight.',
   'back', ARRAY['arms'], 'machine', 'beginner', 3, '10-12', 90, 'unknown'),
  ('Seated Cable Row',
   'Horizontal pull for back thickness and postural strength.',
   ARRAY['Sit at a cable row station, feet on pads.','Grab the handle, chest tall, shoulders back.','Pull the handle to your lower ribs.','Squeeze shoulder blades together.','Return with control to a full stretch.'],
   'Maintain a neutral spine; do not round forward.',
   'back', ARRAY['arms'], 'machine', 'beginner', 3, '10-12', 90, 'unknown'),
  ('Dumbbell Shoulder Press',
   'Overhead press for deltoid strength and shoulder stability.',
   ARRAY['Sit or stand with dumbbells at shoulder height.','Press the dumbbells overhead to full extension.','Keep core tight, ribs down.','Lower with control to shoulder level.','Repeat for reps.'],
   'Do not arch your lower back. Use a bench with back support if needed.',
   'shoulders', ARRAY['arms'], 'dumbbells', 'beginner', 3, '8-12', 90, 'unknown'),
  ('Lateral Raise',
   'Isolates the lateral deltoid for shoulder width.',
   ARRAY['Stand with dumbbells at your sides, palms facing in.','Raise the dumbbells out to the sides.','Lead with the elbows, not the hands.','Stop at shoulder height.','Lower slowly with control.'],
   'Use light weight. Avoid swinging the dumbbells up.',
   'shoulders', NULL, 'dumbbells', 'beginner', 3, '12-15', 60, 'unknown'),
  ('Triceps Pushdown',
   'Isolates the triceps for arm definition and pressing support.',
   ARRAY['Stand at a cable station with a bar or rope attachment.','Grip the attachment at chest height.','Push down until arms are fully extended.','Keep elbows pinned to your sides.','Return with control.'],
   'Keep elbows stationary; do not let them flare.',
   'arms', NULL, 'machine', 'beginner', 3, '12-15', 60, 'unknown'),
  ('Treadmill Running',
   'Steady-state cardio for endurance, heart health, and recovery.',
   ARRAY['Start with a 5-minute walk to warm up.','Set a comfortable running pace.','Maintain upright posture, relaxed shoulders.','Breathe rhythmically; aim for conversational pace.','Cool down with a 5-minute walk.'],
   'Wear proper running shoes. Stop if you feel sharp pain.',
   'cardio', NULL, 'none', 'beginner', 1, '20-30 min', 0, 'unknown')
) AS t(name, description, instructions, safety_notes, primary_muscle, secondary_muscles, equipment, difficulty, default_sets, default_reps, default_rest_seconds, video_source)
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name = t.name);

-- ============================================================
-- 6. updated_at triggers for new tables
-- ============================================================
DROP TRIGGER IF EXISTS trg_user_goals_updated_at ON user_goals;
CREATE TRIGGER trg_user_goals_updated_at
  BEFORE UPDATE ON user_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_body_measurements_updated_at ON body_measurements;
CREATE TRIGGER trg_body_measurements_updated_at
  BEFORE UPDATE ON body_measurements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
