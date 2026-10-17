/*
  Coach tools (from coach reviews of competing apps):
  1. Broadcast: one message to all or chosen athletes (coach_broadcast).
  2. Welcome message sent automatically when an athlete joins.
  3. Voice notes in chat (audio in the private coach-media bucket).
  4. The coach's own extra questions on the weekly check-in (answers stored with the check-in).
  5. Daily habits the coach assigns and the athlete ticks.
  6. Reply hours: shown to athletes; the coach's phone notifications wait until the hours start.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_welcome_message text CHECK (coach_welcome_message IS NULL OR char_length(coach_welcome_message) <= 1000),
  ADD COLUMN IF NOT EXISTS coach_checkin_questions jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(coach_checkin_questions) = 'array' AND jsonb_array_length(coach_checkin_questions) <= 5),
  ADD COLUMN IF NOT EXISTS coach_hours_start smallint CHECK (coach_hours_start IS NULL OR coach_hours_start BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS coach_hours_end smallint CHECK (coach_hours_end IS NULL OR coach_hours_end BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS coach_hours_tz text CHECK (coach_hours_tz IS NULL OR char_length(coach_hours_tz) <= 64);

ALTER TABLE public.coach_messages
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS audio_seconds smallint CHECK (audio_seconds IS NULL OR audio_seconds BETWEEN 1 AND 180),
  ADD COLUMN IF NOT EXISTS broadcast_id uuid;

ALTER TABLE public.coach_checkins
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) <= 5);

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac', 'audio/x-m4a']
 WHERE id = 'coach-media';

-- 1. Broadcast ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coach_broadcast(body text, athletes uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid := auth.uid(); b uuid := gen_random_uuid(); n int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF body IS NULL OR char_length(trim(body)) = 0 OR char_length(body) > 4000 THEN RAISE EXCEPTION 'bad_message'; END IF;
  INSERT INTO coach_messages (coach_id, athlete_id, sender_id, body, broadcast_id)
  SELECT me, l.athlete_id, me, trim(body), b FROM coach_links l
  WHERE l.coach_id = me AND l.status = 'active' AND (athletes IS NULL OR l.athlete_id = ANY (athletes));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- 2. Welcome message ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_coach_link_welcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE msg text;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT coach_welcome_message INTO msg FROM profiles WHERE id = NEW.coach_id;
    IF msg IS NOT NULL AND char_length(trim(msg)) > 0 THEN
      INSERT INTO coach_messages (coach_id, athlete_id, sender_id, body) VALUES (NEW.coach_id, NEW.athlete_id, NEW.coach_id, trim(msg));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER coach_link_welcome AFTER INSERT ON public.coach_links FOR EACH ROW EXECUTE FUNCTION public.on_coach_link_welcome();

-- 5. Habits ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coach_habits_athlete ON public.coach_habits (athlete_id, active);
ALTER TABLE public.coach_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habits_read" ON public.coach_habits FOR SELECT TO authenticated
  USING ((athlete_id = auth.uid() OR coach_id = auth.uid()) AND coach_link_active(coach_id, athlete_id));
CREATE POLICY "habits_coach_insert" ON public.coach_habits FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid() AND coach_link_active(coach_id, athlete_id));
CREATE POLICY "habits_coach_update" ON public.coach_habits FOR UPDATE TO authenticated
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid() AND coach_link_active(coach_id, athlete_id));

CREATE TABLE IF NOT EXISTS public.coach_habit_logs (
  habit_id uuid NOT NULL REFERENCES public.coach_habits(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  done boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (habit_id, day)
);
ALTER TABLE public.coach_habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habit_logs_read" ON public.coach_habit_logs FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR EXISTS (SELECT 1 FROM coach_habits h WHERE h.id = habit_id AND h.coach_id = auth.uid() AND coach_link_active(h.coach_id, h.athlete_id)));
CREATE POLICY "habit_logs_athlete_insert" ON public.coach_habit_logs FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid() AND day BETWEEN current_date - 7 AND current_date + 1
    AND EXISTS (SELECT 1 FROM coach_habits h WHERE h.id = habit_id AND h.athlete_id = auth.uid() AND h.active));
CREATE POLICY "habit_logs_athlete_update" ON public.coach_habit_logs FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid() AND day BETWEEN current_date - 7 AND current_date + 1);

-- 6. Reply hours (public to the coach's athletes) ----------------------------
CREATE OR REPLACE FUNCTION public.my_coach_hours()
RETURNS TABLE (hours_start smallint, hours_end smallint, hours_tz text, questions jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.coach_hours_start, p.coach_hours_end, p.coach_hours_tz, p.coach_checkin_questions
  FROM coach_links l JOIN profiles p ON p.id = l.coach_id
  WHERE l.athlete_id = auth.uid() AND l.status = 'active' LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_broadcast(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_broadcast(text, uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_coach_hours() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_coach_hours() TO authenticated;
