/*
# Recovery Doctor v2

1. daily_checkins: five 1–5 morning wellness answers (5 = best) and when they were given.
2. workout_sessions: session RPE (0–10, how hard the whole session felt), asked after each workout.
3. recovery_adjustments: lighter weeks (deloads) the person accepted, so the app can show them everywhere.
4. rtt_programmes + rtt_entries: return-to-training programmes for a sore or painful area, with the pain
   reported during each session and the next morning.
5. recovery_settings + cycle_periods: optional, private menstrual-cycle insights (off by default).
6. recovery_coach_messages: chat history of the recovery AI coach (written by its server function).

Every new table is private to its owner (RLS: auth.uid() = user_id). Nothing existing is removed.
*/

-- ============ MORNING WELLNESS ============
ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS wellness_sleep smallint,
  ADD COLUMN IF NOT EXISTS wellness_energy smallint,
  ADD COLUMN IF NOT EXISTS wellness_soreness smallint,
  ADD COLUMN IF NOT EXISTS wellness_stress smallint,
  ADD COLUMN IF NOT EXISTS wellness_mood smallint,
  ADD COLUMN IF NOT EXISTS wellness_at timestamptz;

ALTER TABLE public.daily_checkins DROP CONSTRAINT IF EXISTS daily_checkins_wellness_check;
ALTER TABLE public.daily_checkins ADD CONSTRAINT daily_checkins_wellness_check CHECK (
  (wellness_sleep IS NULL OR wellness_sleep BETWEEN 1 AND 5) AND
  (wellness_energy IS NULL OR wellness_energy BETWEEN 1 AND 5) AND
  (wellness_soreness IS NULL OR wellness_soreness BETWEEN 1 AND 5) AND
  (wellness_stress IS NULL OR wellness_stress BETWEEN 1 AND 5) AND
  (wellness_mood IS NULL OR wellness_mood BETWEEN 1 AND 5)
);

-- ============ SESSION RPE ============
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS session_rpe smallint,
  ADD COLUMN IF NOT EXISTS rpe_recorded_at timestamptz;

ALTER TABLE public.workout_sessions DROP CONSTRAINT IF EXISTS workout_sessions_session_rpe_check;
ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_sessions_session_rpe_check CHECK (session_rpe IS NULL OR session_rpe BETWEEN 0 AND 10);

-- ============ LIGHTER WEEKS ============
CREATE TABLE IF NOT EXISTS public.recovery_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'deload' CHECK (kind IN ('deload')),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dismissed')),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on AND ends_on - starts_on <= 14)
);
CREATE INDEX IF NOT EXISTS idx_recovery_adjustments_user ON public.recovery_adjustments (user_id, starts_on DESC);
ALTER TABLE public.recovery_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_recovery_adjustments" ON public.recovery_adjustments;
CREATE POLICY "own_recovery_adjustments" ON public.recovery_adjustments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ RETURN TO TRAINING ============
CREATE TABLE IF NOT EXISTS public.rtt_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  area text NOT NULL CHECK (length(area) BETWEEN 1 AND 60),
  pain_log_id uuid REFERENCES public.pain_logs(id) ON DELETE SET NULL,
  stage smallint NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 4),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped')),
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rtt_programmes_user ON public.rtt_programmes (user_id, started_at DESC);
ALTER TABLE public.rtt_programmes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_rtt_programmes" ON public.rtt_programmes;
CREATE POLICY "own_rtt_programmes" ON public.rtt_programmes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.rtt_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  programme_id uuid NOT NULL REFERENCES public.rtt_programmes(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 4),
  pain_during smallint NOT NULL CHECK (pain_during BETWEEN 0 AND 10),
  pain_next_morning smallint CHECK (pain_next_morning IS NULL OR pain_next_morning BETWEEN 0 AND 10),
  morning_worse boolean,
  note text CHECK (note IS NULL OR length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (programme_id, session_date)
);
CREATE INDEX IF NOT EXISTS idx_rtt_entries_programme ON public.rtt_entries (programme_id, session_date);
ALTER TABLE public.rtt_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_rtt_entries" ON public.rtt_entries;
-- the entry and the programme it belongs to must both be the person's own
CREATE POLICY "own_rtt_entries" ON public.rtt_entries FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.rtt_programmes p WHERE p.id = programme_id AND p.user_id = auth.uid()));

-- ============ OPTIONAL CYCLE INSIGHTS ============
CREATE TABLE IF NOT EXISTS public.recovery_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_tracking boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recovery_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_recovery_settings" ON public.recovery_settings;
CREATE POLICY "own_recovery_settings" ON public.recovery_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.cycle_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, start_date)
);
ALTER TABLE public.cycle_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_cycle_periods" ON public.cycle_periods;
CREATE POLICY "own_cycle_periods" ON public.cycle_periods FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ RECOVERY COACH CHAT ============
CREATE TABLE IF NOT EXISTS public.recovery_coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (length(content) <= 8000),
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recovery_coach_messages_user ON public.recovery_coach_messages (user_id, created_at DESC);
ALTER TABLE public.recovery_coach_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_recovery_coach_select" ON public.recovery_coach_messages;
CREATE POLICY "own_recovery_coach_select" ON public.recovery_coach_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_recovery_coach_delete" ON public.recovery_coach_messages;
CREATE POLICY "own_recovery_coach_delete" ON public.recovery_coach_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ MEMORY: allow the recovery coach as a source ============
ALTER TABLE public.user_memory DROP CONSTRAINT IF EXISTS user_memory_source_check;
ALTER TABLE public.user_memory ADD CONSTRAINT user_memory_source_check
  CHECK (source IN ('user', 'training_coach', 'nutrition_coach', 'ai_coach', 'recovery_coach', 'app'));
