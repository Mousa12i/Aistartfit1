/*
# Nutrition hub

1. meal_logs — richer entries (all new columns are optional, old rows keep working)
   - meal_slot, grams, servings, serving_label, food_ref, source
   - sugar_g, fiber_g, sat_fat_g, sodium_mg (NULL = not reported by the food source)
   - nutrients (jsonb) for vitamins, minerals and other nutrients
   - protein, carbs_g, fat_g become numeric so decimals are kept
2. New tables
   - nutrition_settings: one row per user (goal, rate, macros, wellbeing check-in, preferences, favourites)
   - custom_foods: foods a user creates (values per 100 g)
   - nutrition_coach_messages: chat history of the nutrition AI coach
   - food_search_cache: server-side cache for USDA / Open Food Facts lookups (service role only)
3. Security
   - RLS on every table; users can only access their own rows.
   - food_search_cache has RLS enabled and no policies, so only the service role (edge functions) can use it.
*/

-- 1. meal_logs ---------------------------------------------------------------
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS meal_slot text;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS grams numeric;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS servings numeric;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS serving_label text;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS food_ref text;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS sugar_g numeric;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS fiber_g numeric;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS sat_fat_g numeric;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS sodium_mg numeric;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS nutrients jsonb;

ALTER TABLE meal_logs ALTER COLUMN protein TYPE numeric USING protein::numeric;
ALTER TABLE meal_logs ALTER COLUMN carbs_g TYPE numeric USING carbs_g::numeric;
ALTER TABLE meal_logs ALTER COLUMN fat_g TYPE numeric USING fat_g::numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meal_logs_meal_slot_check') THEN
    ALTER TABLE meal_logs ADD CONSTRAINT meal_logs_meal_slot_check
      CHECK (meal_slot IS NULL OR meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meal_logs_amounts_check') THEN
    ALTER TABLE meal_logs ADD CONSTRAINT meal_logs_amounts_check
      CHECK (kcal >= 0 AND protein >= 0 AND carbs_g >= 0 AND fat_g >= 0
        AND (grams IS NULL OR grams > 0) AND (servings IS NULL OR servings > 0)) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS meal_logs_user_date_idx ON meal_logs (user_id, logged_date);
CREATE INDEX IF NOT EXISTS water_logs_user_date_idx ON water_logs (user_id, logged_date);

-- 2. nutrition_settings -----------------------------------------------------
CREATE TABLE IF NOT EXISTS nutrition_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_mode text NOT NULL DEFAULT 'maintain' CHECK (goal_mode IN ('cut', 'maintain', 'bulk', 'recomp')),
  rate_pct numeric NOT NULL DEFAULT 0 CHECK (rate_pct >= 0 AND rate_pct <= 1),
  sex text CHECK (sex IS NULL OR sex IN ('male', 'female', 'unspecified')),
  protein_g_per_kg numeric CHECK (protein_g_per_kg IS NULL OR (protein_g_per_kg >= 1.2 AND protein_g_per_kg <= 3.1)),
  fat_pct numeric CHECK (fat_pct IS NULL OR (fat_pct >= 20 AND fat_pct <= 35)),
  meals_per_day int NOT NULL DEFAULT 4 CHECK (meals_per_day BETWEEN 2 AND 6),
  carb_shift boolean NOT NULL DEFAULT false,
  kcal_override int CHECK (kcal_override IS NULL OR (kcal_override >= 1000 AND kcal_override <= 6000)),
  adaptive_tdee int CHECK (adaptive_tdee IS NULL OR (adaptive_tdee >= 1000 AND adaptive_tdee <= 7000)),
  adaptive_updated_at timestamptz,
  mode_started_at date,
  diet_break_until date,
  no_numbers boolean NOT NULL DEFAULT false,
  screening jsonb,
  diet_prefs text[] NOT NULL DEFAULT '{}',
  allergies text[] NOT NULL DEFAULT '{}',
  favorites jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nutrition_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_nutrition_settings" ON nutrition_settings;
CREATE POLICY "select_own_nutrition_settings" ON nutrition_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_nutrition_settings" ON nutrition_settings;
CREATE POLICY "insert_own_nutrition_settings" ON nutrition_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_nutrition_settings" ON nutrition_settings;
CREATE POLICY "update_own_nutrition_settings" ON nutrition_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_nutrition_settings" ON nutrition_settings;
CREATE POLICY "delete_own_nutrition_settings" ON nutrition_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 3. custom_foods -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  brand text CHECK (brand IS NULL OR char_length(brand) <= 120),
  serving_label text CHECK (serving_label IS NULL OR char_length(serving_label) <= 60),
  serving_grams numeric CHECK (serving_grams IS NULL OR serving_grams > 0),
  kcal numeric NOT NULL CHECK (kcal >= 0 AND kcal <= 900),
  protein numeric NOT NULL DEFAULT 0 CHECK (protein >= 0 AND protein <= 100),
  carbs numeric NOT NULL DEFAULT 0 CHECK (carbs >= 0 AND carbs <= 100),
  fat numeric NOT NULL DEFAULT 0 CHECK (fat >= 0 AND fat <= 100),
  sugar numeric CHECK (sugar IS NULL OR (sugar >= 0 AND sugar <= 100)),
  fiber numeric CHECK (fiber IS NULL OR (fiber >= 0 AND fiber <= 100)),
  sat_fat numeric CHECK (sat_fat IS NULL OR (sat_fat >= 0 AND sat_fat <= 100)),
  sodium_mg numeric CHECK (sodium_mg IS NULL OR (sodium_mg >= 0 AND sodium_mg <= 40000)),
  nutrients jsonb,
  barcode text CHECK (barcode IS NULL OR barcode ~ '^[0-9]{6,14}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_foods_user_idx ON custom_foods (user_id, name);

ALTER TABLE custom_foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_custom_foods" ON custom_foods;
CREATE POLICY "select_own_custom_foods" ON custom_foods FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_custom_foods" ON custom_foods;
CREATE POLICY "insert_own_custom_foods" ON custom_foods FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_custom_foods" ON custom_foods;
CREATE POLICY "update_own_custom_foods" ON custom_foods FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_custom_foods" ON custom_foods;
CREATE POLICY "delete_own_custom_foods" ON custom_foods FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 4. nutrition_coach_messages ------------------------------------------------
CREATE TABLE IF NOT EXISTS nutrition_coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (char_length(content) <= 20000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nutrition_coach_messages_user_idx ON nutrition_coach_messages (user_id, created_at);

ALTER TABLE nutrition_coach_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_nutrition_coach_messages" ON nutrition_coach_messages;
CREATE POLICY "select_own_nutrition_coach_messages" ON nutrition_coach_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_nutrition_coach_messages" ON nutrition_coach_messages;
CREATE POLICY "delete_own_nutrition_coach_messages" ON nutrition_coach_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
-- Inserts are made by the nutrition-coach edge function with the service role.

-- 5. food_search_cache (service role only) -----------------------------------
CREATE TABLE IF NOT EXISTS food_search_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE food_search_cache ENABLE ROW LEVEL SECURITY;
