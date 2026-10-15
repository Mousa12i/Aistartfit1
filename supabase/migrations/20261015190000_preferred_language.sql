/*
  # Preferred language

  The language the person chose for the app (and the coaches). NULL until they choose,
  which is when the app asks for it right after sign-in.
*/
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_preferred_language_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_language_check
      CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'ar', 'es', 'fr', 'de', 'pt', 'tr', 'it'));
  END IF;
END $$;
