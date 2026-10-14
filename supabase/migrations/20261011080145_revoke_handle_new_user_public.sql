/*
# Revoke EXECUTE on handle_new_user from PUBLIC

## Changes
- Revoke EXECUTE from PUBLIC role on handle_new_user() function.
- This prevents any client (anon, authenticated, or any other role) from calling the function via REST RPC.
- The function is only called by the auth.users trigger, which runs with superuser privileges.

## Security
- Prevents privilege escalation via direct RPC calls to the profile creation function.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
