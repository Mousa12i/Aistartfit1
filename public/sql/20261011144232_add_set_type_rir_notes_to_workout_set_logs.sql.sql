/*
# Add set_type, rir, and notes to workout_set_logs

1. Modified Tables
- `workout_set_logs`
  - Added `set_type` (text, nullable) — categorises the set: 'warm_up', 'working', 'drop', 'back_off', 'assessment'. Nullable so existing rows are unaffected.
  - Added `rir` (integer, nullable) — reps in reserve, 0-10 or null when unknown. Nullable.
  - Added `notes` (text, nullable) — per-set user notes. Nullable.
2. Security
- No new tables; RLS policies on workout_set_logs remain unchanged.
3. Important Notes
- All three columns are nullable, so existing rows default to null and current inserts without these fields continue to work.
- No destructive operations — columns are only added.
*/

ALTER TABLE workout_set_logs
  ADD COLUMN IF NOT EXISTS set_type text,
  ADD COLUMN IF NOT EXISTS rir integer,
  ADD COLUMN IF NOT EXISTS notes text;
