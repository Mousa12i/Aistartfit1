/*
# Drop unique constraint on exercises.name

1. Changes
- Drop the unique index on exercises.name to allow importing the free-exercise-db dataset
  which has 876 exercises, some with names that overlap with the existing 539 original exercises
- The source_id unique index remains for deduplication of dataset entries
- exercises.id (UUID) remains the primary key

2. Security
- No security changes. RLS policies remain unchanged.
*/

DROP INDEX IF EXISTS public.exercises_name_key;
