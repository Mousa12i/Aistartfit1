/*
  Coach nutrition plan: daily targets for training and rest days, meals with alternative options built from real
  foods (amounts in grams, nutrients per 100 g from the food database), and do/limit guidance.
  - One plan per athlete per coach; the athlete reads it, only the linked coach writes it.
  - Calories come from the macros (Atwater 4/4/9) and must stay between 1200 and 6000 kcal, the same limits as
    coach_set_targets.
*/

CREATE TABLE IF NOT EXISTS public.coach_nutrition_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  protein_g numeric NOT NULL CHECK (protein_g BETWEEN 0 AND 500),
  carbs_train_g numeric NOT NULL CHECK (carbs_train_g BETWEEN 0 AND 1000),
  fat_train_g numeric NOT NULL CHECK (fat_train_g BETWEEN 0 AND 400),
  carbs_rest_g numeric NOT NULL CHECK (carbs_rest_g BETWEEN 0 AND 1000),
  fat_rest_g numeric NOT NULL CHECK (fat_rest_g BETWEEN 0 AND 400),
  fiber_g numeric CHECK (fiber_g IS NULL OR fiber_g BETWEEN 0 AND 100),
  water_ml integer CHECK (water_ml IS NULL OR water_ml BETWEEN 0 AND 8000),
  meals jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(meals) = 'array' AND jsonb_array_length(meals) <= 8),
  guidance jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(guidance) = 'object'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, athlete_id),
  CHECK (protein_g * 4 + carbs_train_g * 4 + fat_train_g * 9 BETWEEN 1200 AND 6000),
  CHECK (protein_g * 4 + carbs_rest_g * 4 + fat_rest_g * 9 BETWEEN 1200 AND 6000)
);
ALTER TABLE public.coach_nutrition_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_plan_read" ON public.coach_nutrition_plans FOR SELECT TO authenticated
  USING ((athlete_id = auth.uid() OR coach_id = auth.uid()) AND coach_link_active(coach_id, athlete_id));
CREATE POLICY "nutrition_plan_insert" ON public.coach_nutrition_plans FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid() AND coach_link_active(coach_id, athlete_id));
CREATE POLICY "nutrition_plan_update" ON public.coach_nutrition_plans FOR UPDATE TO authenticated
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid() AND coach_link_active(coach_id, athlete_id));

-- The athlete is told when the coach saves a new nutrition plan.
CREATE OR REPLACE FUNCTION public.on_nutrition_plan_by_coach()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM notify(NEW.athlete_id, 'targets_changed', NEW.coach_id, NULL, '/nutrition/coach-plan');
  RETURN NEW;
END;
$$;
CREATE TRIGGER coach_nutrition_plan_notify AFTER INSERT OR UPDATE ON public.coach_nutrition_plans
  FOR EACH ROW EXECUTE FUNCTION public.on_nutrition_plan_by_coach();
