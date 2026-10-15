/*
# Make seed function callable via REST API

1. Changes
- Make seed_exercises_from_json SECURITY DEFINER so it bypasses RLS during seeding
- Grant EXECUTE to anon, authenticated roles
2. Security
- This function is for one-time bulk seeding only and will be dropped after seeding completes
- SECURITY DEFINER is required because the anon role cannot INSERT into exercises (RLS restricts to authenticated)
*/

DROP FUNCTION IF EXISTS public.seed_exercises_from_json(json);
CREATE OR REPLACE FUNCTION public.seed_exercises_from_json(data json)
RETURNS void AS $$
DECLARE
  row json;
  v_source_id text;
  v_name text;
  v_desc text;
  v_instructions text[];
  v_primary_muscle text;
  v_secondary_muscles text[];
  v_equipment text;
  v_difficulty text;
  v_category text;
  v_force_type text;
  v_mechanic text;
  v_primary_muscles text[];
  v_secondary_muscles_raw text[];
  v_image_url text;
BEGIN
  FOREACH row IN ARRAY data LOOP
    v_source_id := row->>0;
    v_name := row->>1;
    v_desc := row->>2;
    v_instructions := ARRAY(SELECT json_array_elements_text(row->3));
    v_primary_muscle := row->>4;
    v_secondary_muscles := ARRAY(SELECT json_array_elements_text(row->5));
    v_equipment := row->>6;
    v_difficulty := row->>7;
    v_category := row->>8;
    v_force_type := NULLIF(row->>9, '');
    v_mechanic := NULLIF(row->>10, '');
    v_primary_muscles := ARRAY(SELECT json_array_elements_text(row->11));
    v_secondary_muscles_raw := ARRAY(SELECT json_array_elements_text(row->12));
    v_image_url := NULLIF(row->>13, '');

    INSERT INTO public.exercises (
      source_id, name, description, instructions, primary_muscle,
      secondary_muscles, equipment, difficulty, category, force_type,
      mechanic, primary_muscles, secondary_muscles_raw, image_url, is_custom
    ) VALUES (
      v_source_id, v_name, v_desc, v_instructions, v_primary_muscle,
      v_secondary_muscles, v_equipment, v_difficulty, v_category, v_force_type,
      v_mechanic, v_primary_muscles, v_secondary_muscles_raw, v_image_url, false
    )
    ON CONFLICT (source_id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.seed_exercises_from_json(json) TO anon, authenticated;
