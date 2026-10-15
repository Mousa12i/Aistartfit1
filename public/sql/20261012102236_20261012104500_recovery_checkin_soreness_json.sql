/*
# Store per-muscle soreness with the existing daily check-in

1. Existing table
- Adds `soreness` JSONB to `daily_checkins` for the canonical muscle-to-score snapshot.
- Existing rows remain unchanged and receive an empty object only when no value exists.

2. Security
- Existing owner-scoped RLS on `daily_checkins` continues to protect this column.
*/
ALTER TABLE public.daily_checkins ADD COLUMN IF NOT EXISTS soreness jsonb NOT NULL DEFAULT '{}'::jsonb;