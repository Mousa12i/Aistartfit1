import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

/**
 * Links from auth emails come back as `#error=...&error_code=otp_expired` (or `#access_token=...`). The app
 * uses hash routing, so an error hash would be read as a page path. Keep the error code for the sign-in
 * screen and clear it before anything else reads the hash.
 */
export const authLinkError: string | null = (() => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!/(^|&)error(_code)?=/.test(hash)) return null;
  const params = new URLSearchParams(hash);
  const code = params.get('error_code') ?? params.get('error') ?? 'unknown';
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/signin`);
  return code;
})();

/** True when this page load is the return from a confirmation or password-reset link. */
export const authLinkLanding: boolean =
  typeof window !== 'undefined' && /access_token=|type=(signup|recovery|magiclink|invite|email_change)/.test(window.location.hash);

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
