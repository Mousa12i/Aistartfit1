/*
# Workout persistence integrity fixes

1. Changes to workout_sessions
- Adds `status` text column (default 'active', CHECK in 'active','completed','abandoned') so completed vs abandoned vs in-progress sessions are distinguishable.
- Adds `total_volume` numeric column (default 0) to persist total training volume at completion.
- Adds `abandoned_at` timestamptz column (nullable) recorded when a session is abandoned.
- Back-fills `status='completed'` for rows that already have `completed_at`.

2. Changes to workout_set_logs
- Deduplicates existing rows that share (session_id, exercise_id, set_number), keeping one row per group (the one with the lowest id). This repairs the duplicates already in the table from the previous insert-only save path.
- Adds a UNIQUE constraint `uniq_set_logs_session_exercise_set` on (session_id, exercise_id, set_number) so future saves cannot create duplicates — the app will use upsert against this constraint.

3. Security
- No policy changes. RLS remains enabled and owner-scoped via the existing session-ownership subquery on workout_set_logs and auth.uid() = user_id on workout_sessions. The new columns are covered by the existing UPDATE policy (all columns updatable).

4. Important notes
- No destructive column drops, type changes, or renames. All additions are additive.
- The deduplication DELETE only removes duplicate rows, never the single kept row, so no set data is lost.
*/

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  ADD COLUMN IF NOT EXISTS total_volume numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS abandoned_at timestamptz;

UPDATE workout_sessions SET status = 'completed' WHERE completed_at IS NOT NULL AND status = 'active';

DELETE FROM workout_set_logs a
USING workout_set_logs b
WHERE a.session_id = b.session_id
  AND a.exercise_id = b.exercise_id
  AND a.set_number = b.set_number
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_set_logs_session_exercise_set
  ON workout_set_logs (session_id, exercise_id, set_number);
