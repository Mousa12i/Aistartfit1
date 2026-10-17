/*
  Week manager: the coach's recovery map uses the athlete's personal recovery multipliers,
  so it shows the same recovery % the athlete sees. Read-only, linked coaches only.
*/
CREATE POLICY "coach_reads_recovery_profile" ON public.recovery_profile
  FOR SELECT TO authenticated USING (public.is_coach_of(user_id));
