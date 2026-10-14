/*
# Fix Security Advisor Warnings

## Changes
1. Revoke EXECUTE on handle_new_user from anon and authenticated roles — this function should only be called by the trigger on auth.users, not via the REST API.
2. Set search_path on update_updated_at function to 'public' to prevent search path manipulation.

## Security
- handle_new_user remains SECURITY DEFINER (needed to insert into profiles table), but is no longer callable via REST RPC by any client.
- update_updated_at now has an immutable search_path.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
