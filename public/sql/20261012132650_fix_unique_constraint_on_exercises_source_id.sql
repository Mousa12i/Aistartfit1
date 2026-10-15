-- Drop the partial unique index that ON CONFLICT can't use
DROP INDEX IF EXISTS public.exercises_source_id_unique_idx;

-- Create a full unique index (no WHERE clause) so ON CONFLICT (source_id) works
-- Note: source_id is nullable, and Postgres allows multiple NULLs in a unique index,
-- so this won't conflict with any exercises that have source_id = NULL.
CREATE UNIQUE INDEX exercises_source_id_unique_idx ON public.exercises (source_id);
