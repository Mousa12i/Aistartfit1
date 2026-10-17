/*
  Coach recovery plan for one athlete: sleep and step targets, rest days, a mobility routine,
  a planned lighter (deload) week with how much to cut sets, and notes.
  Only the linked coach writes it; the athlete reads it (Recovery screen and workout).
*/

-- A notification kind for recovery plans (the push text says "updated your recovery plan").
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('message', 'checkin', 'checkin_reviewed', 'new_athlete', 'targets_changed', 'routine_given', 'recovery_plan'));

CREATE TABLE IF NOT EXISTS public.coach_recovery_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sleep_hours numeric CHECK (sleep_hours IS NULL OR sleep_hours BETWEEN 5 AND 11),
  steps integer CHECK (steps IS NULL OR steps BETWEEN 1000 AND 30000),
  rest_days smallint[] NOT NULL DEFAULT '{}' CHECK (rest_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
  mobility jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(mobility) = 'array' AND jsonb_array_length(mobility) <= 12),
  mobility_days smallint[] NOT NULL DEFAULT '{}' CHECK (mobility_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
  deload_start date,
  deload_days smallint CHECK (deload_days IS NULL OR deload_days BETWEEN 3 AND 14),
  deload_set_pct smallint CHECK (deload_set_pct IS NULL OR deload_set_pct BETWEEN 30 AND 90),
  deload_note text CHECK (deload_note IS NULL OR char_length(deload_note) <= 500),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, athlete_id)
);
ALTER TABLE public.coach_recovery_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recovery_plan_read" ON public.coach_recovery_plans FOR SELECT TO authenticated
  USING ((athlete_id = auth.uid() OR coach_id = auth.uid()) AND coach_link_active(coach_id, athlete_id));
CREATE POLICY "recovery_plan_insert" ON public.coach_recovery_plans FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid() AND coach_link_active(coach_id, athlete_id));
CREATE POLICY "recovery_plan_update" ON public.coach_recovery_plans FOR UPDATE TO authenticated
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid() AND coach_link_active(coach_id, athlete_id));

CREATE OR REPLACE FUNCTION public.on_recovery_plan_by_coach()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM notify(NEW.athlete_id, 'recovery_plan', NEW.coach_id, NULL, '/recovery');
  RETURN NEW;
END;
$$;
CREATE TRIGGER coach_recovery_plan_notify AFTER INSERT OR UPDATE ON public.coach_recovery_plans
  FOR EACH ROW EXECUTE FUNCTION public.on_recovery_plan_by_coach();
