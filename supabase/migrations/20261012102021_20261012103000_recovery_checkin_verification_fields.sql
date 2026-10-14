/*
# Extend existing daily check-ins for verified recovery inputs

1. Existing table
- Reuses `daily_checkins`; no replacement table is created and no user rows are removed.
- Adds `sleep_source` so every sleep value identifies manual or device origin.
- Adds `hrv_source` so HRV values identify manual or wearable origin.
- Adds `resting_hr_bpm` as the explicit rules-engine field while retaining the existing `resting_hr` column for compatibility.
- Adds `hr_verified` to record explicit confirmation for readings outside normal verification bands.

2. Validation
- Adds database checks matching the recovery input limits for the new fields.
- Source values are restricted to the documented manual/device and manual/wearable choices.

3. Security
- Existing authenticated, owner-scoped RLS policies on `daily_checkins` remain in place.
- No auth, billing, navigation, or existing records are changed.
*/

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS sleep_source text,
  ADD COLUMN IF NOT EXISTS hrv_source text,
  ADD COLUMN IF NOT EXISTS resting_hr_bpm integer,
  ADD COLUMN IF NOT EXISTS hr_verified boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_checkins_sleep_source_check') THEN
    ALTER TABLE public.daily_checkins ADD CONSTRAINT daily_checkins_sleep_source_check CHECK (sleep_source IS NULL OR sleep_source IN ('manual', 'device'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_checkins_hrv_source_check') THEN
    ALTER TABLE public.daily_checkins ADD CONSTRAINT daily_checkins_hrv_source_check CHECK (hrv_source IS NULL OR hrv_source IN ('manual', 'wearable'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_checkins_resting_hr_bpm_check') THEN
    ALTER TABLE public.daily_checkins ADD CONSTRAINT daily_checkins_resting_hr_bpm_check CHECK (resting_hr_bpm IS NULL OR resting_hr_bpm BETWEEN 30 AND 220);
  END IF;
END $$;