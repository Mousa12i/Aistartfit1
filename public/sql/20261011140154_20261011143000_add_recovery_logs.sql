/*
# Add owner-scoped recovery activity logs

1. New Tables
- `recovery_logs` stores user-owned recovery activity records for soreness, sleep, hydration, journal notes, recovery sessions, and completed recommendations.
- `id` is the generated primary key.
- `user_id` is filled from the authenticated session and cannot be reassigned by the client.
- `kind` identifies the recovery activity type.
- `value` stores a numeric measurement when applicable, such as sleep hours, hydration millilitres, or soreness level.
- `muscle` stores the related muscle group for soreness records.
- `note` stores journal text or an optional activity note.
- `metadata` stores small structured details such as a recovery activity title.
- `recorded_at` stores when the activity happened.
- `created_at` stores when the record was created.

2. Security
- Row level security is enabled.
- Authenticated users can select, insert, update, and delete only their own recovery records.
- The owner is derived from `auth.uid()` by default and every policy verifies ownership.

3. Important Notes
- Existing workout sessions and water logs are not modified.
- The table is intentionally additive and safe to run more than once.
*/

CREATE TABLE IF NOT EXISTS public.recovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('soreness', 'sleep', 'hydration', 'journal', 'recovery_session', 'recommendation')),
  value numeric,
  muscle text,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recovery_logs_user_recorded_idx
  ON public.recovery_logs (user_id, recorded_at DESC);

ALTER TABLE public.recovery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recovery_logs" ON public.recovery_logs;
CREATE POLICY "select_own_recovery_logs" ON public.recovery_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_recovery_logs" ON public.recovery_logs;
CREATE POLICY "insert_own_recovery_logs" ON public.recovery_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_recovery_logs" ON public.recovery_logs;
CREATE POLICY "update_own_recovery_logs" ON public.recovery_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_recovery_logs" ON public.recovery_logs;
CREATE POLICY "delete_own_recovery_logs" ON public.recovery_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
