-- Temporarily drop the unique constraint on name so the seed batch files
-- (which use ON CONFLICT (source_id) DO NOTHING) can load without hitting
-- a separate unique violation on name from pre-existing rows.
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_name_key;
