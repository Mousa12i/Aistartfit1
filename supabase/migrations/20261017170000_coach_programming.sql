/*
  Coach programming: richer prescriptions and full editing of an athlete's own program copy.
  - workout_plan_exercises: tempo, superset group, alternative exercise.
  - Security-definer functions so a coach can change the program of a linked athlete (rows the athlete owns),
    always checked with is_coach_of().
*/

ALTER TABLE public.workout_plan_exercises
  ADD COLUMN IF NOT EXISTS tempo text CHECK (tempo IS NULL OR tempo ~ '^[0-9X]{1,2}(-[0-9X]{1,2}){1,3}$'),
  ADD COLUMN IF NOT EXISTS group_label text CHECK (group_label IS NULL OR group_label ~ '^[A-H]$'),
  ADD COLUMN IF NOT EXISTS alt_exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL;

-- Whose plan is this, and may the caller (a coach) change it?
CREATE OR REPLACE FUNCTION public.coach_can_edit_plan(p uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM workout_plans wp WHERE wp.id = p AND (wp.created_by = auth.uid() OR is_coach_of(wp.created_by)));
$$;

CREATE OR REPLACE FUNCTION public.coach_plan_add_exercise(p uuid, ex uuid, day integer, label text, new_sets integer, new_reps text, new_rest integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nid uuid; ord integer;
BEGIN
  IF NOT coach_can_edit_plan(p) THEN RAISE EXCEPTION 'not_your_athlete'; END IF;
  IF new_sets < 1 OR new_sets > 10 THEN RAISE EXCEPTION 'bad_sets'; END IF;
  IF day < 0 OR day > 13 THEN RAISE EXCEPTION 'bad_day'; END IF;
  SELECT coalesce(max(exercise_order), -1) + 1 INTO ord FROM workout_plan_exercises WHERE plan_id = p;
  INSERT INTO workout_plan_exercises (plan_id, exercise_id, exercise_order, sets, reps, rest_seconds, day_index, day_label)
  VALUES (p, ex, ord, new_sets, coalesce(nullif(trim(new_reps), ''), '8-12'), new_rest, day, nullif(trim(label), ''))
  RETURNING id INTO nid;
  UPDATE workout_plans SET updated_at = now() WHERE id = p;
  RETURN nid;
END;
$$;

CREATE OR REPLACE FUNCTION public.coach_plan_update_row(row_id uuid, patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p uuid;
BEGIN
  SELECT plan_id INTO p FROM workout_plan_exercises WHERE id = row_id;
  IF p IS NULL OR NOT coach_can_edit_plan(p) THEN RAISE EXCEPTION 'not_your_athlete'; END IF;
  IF patch ? 'sets' AND ((patch->>'sets')::int < 1 OR (patch->>'sets')::int > 10) THEN RAISE EXCEPTION 'bad_sets'; END IF;
  UPDATE workout_plan_exercises SET
    sets = CASE WHEN patch ? 'sets' THEN (patch->>'sets')::int ELSE sets END,
    reps = CASE WHEN patch ? 'reps' THEN coalesce(nullif(trim(patch->>'reps'), ''), reps) ELSE reps END,
    rest_seconds = CASE WHEN patch ? 'rest_seconds' THEN (patch->>'rest_seconds')::int ELSE rest_seconds END,
    rir_target = CASE WHEN patch ? 'rir_target' THEN (patch->>'rir_target')::int ELSE rir_target END,
    tempo = CASE WHEN patch ? 'tempo' THEN nullif(trim(patch->>'tempo'), '') ELSE tempo END,
    group_label = CASE WHEN patch ? 'group_label' THEN nullif(trim(patch->>'group_label'), '') ELSE group_label END,
    notes = CASE WHEN patch ? 'notes' THEN nullif(trim(patch->>'notes'), '') ELSE notes END,
    alt_exercise_id = CASE WHEN patch ? 'alt_exercise_id' THEN (patch->>'alt_exercise_id')::uuid ELSE alt_exercise_id END,
    exercise_order = CASE WHEN patch ? 'exercise_order' THEN (patch->>'exercise_order')::int ELSE exercise_order END,
    day_index = CASE WHEN patch ? 'day_index' THEN (patch->>'day_index')::int ELSE day_index END,
    day_label = CASE WHEN patch ? 'day_label' THEN nullif(trim(patch->>'day_label'), '') ELSE day_label END
  WHERE id = row_id;
  UPDATE workout_plans SET updated_at = now() WHERE id = p;
END;
$$;

-- A linked coach may remove rows from the athlete's program (RLS, same check as the functions).
CREATE POLICY "coach_removes_athlete_plan_rows" ON public.workout_plan_exercises FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_plans wp WHERE wp.id = workout_plan_exercises.plan_id AND public.is_coach_of(wp.created_by)));

CREATE OR REPLACE FUNCTION public.coach_plan_meta(p uuid, new_name text, weeks integer, per_week integer, progression text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT coach_can_edit_plan(p) THEN RAISE EXCEPTION 'not_your_athlete'; END IF;
  IF weeks IS NOT NULL AND (weeks < 1 OR weeks > 52) THEN RAISE EXCEPTION 'bad_weeks'; END IF;
  IF per_week IS NOT NULL AND (per_week < 1 OR per_week > 14) THEN RAISE EXCEPTION 'bad_days'; END IF;
  UPDATE workout_plans SET
    name = coalesce(nullif(trim(new_name), ''), name),
    duration_weeks = coalesce(weeks, duration_weeks),
    sessions_per_week = coalesce(per_week, sessions_per_week),
    details = CASE WHEN progression IS NULL THEN details
                   ELSE coalesce(details, '{}'::jsonb) || jsonb_build_object('progression', left(trim(progression), 600)) END,
    updated_at = now()
  WHERE id = p;
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['coach_can_edit_plan(uuid)', 'coach_plan_add_exercise(uuid, uuid, integer, text, integer, text, integer)',
    'coach_plan_update_row(uuid, jsonb)', 'coach_plan_meta(uuid, text, integer, integer, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
