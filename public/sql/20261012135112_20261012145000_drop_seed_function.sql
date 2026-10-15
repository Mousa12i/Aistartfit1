/*
# Drop temporary seed function

1. Changes
- Drop the seed_exercises_from_json function as it was only needed for the initial bulk import
2. Security
- Removes SECURITY DEFINER function that was granted to anon role
*/

DROP FUNCTION IF EXISTS public.seed_exercises_from_json(json);
