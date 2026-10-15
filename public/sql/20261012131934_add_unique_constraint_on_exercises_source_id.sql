-- Drop the existing non-unique index so we can replace it with a unique constraint
DROP INDEX IF EXISTS public.exercises_source_id_idx;

-- Create a unique constraint on source_id so ON CONFLICT (source_id) works
CREATE UNIQUE INDEX exercises_source_id_unique_idx ON public.exercises (source_id) WHERE source_id IS NOT NULL;
