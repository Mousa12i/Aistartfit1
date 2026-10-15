/*
# Add carbs and fat columns to meal_logs

1. Modified Tables
- `meal_logs` — adds `carbs_g` (integer, default 0) and `fat_g` (integer, default 0) columns
  so the nutrition tracker can log full macros, not just calories and protein.
2. Security
- No policy changes. Existing RLS policies cover the new columns.
*/

ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS carbs_g integer NOT NULL DEFAULT 0;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS fat_g integer NOT NULL DEFAULT 0;
