// Consents and account deletion.
// - 'health_data': explicit consent to process health and fitness data (UK GDPR Art. 9(2)(a)). Needed to use the app.
// - 'third_party_ai': explicit permission to send data to the AI provider when a coach is used
//   (App Store Review Guideline 5.1.2(i)). Optional; the coaches are off without it.

import { supabase } from './supabase';
import { callFunction, isSchemaError } from './nutrition/api';

import { PRIVACY_POLICY_VERSION } from './legal/version';

export { PRIVACY_POLICY_VERSION };

export type ConsentKind = 'health_data' | 'third_party_ai';

export interface ConsentState {
  /** false when the consent table does not exist yet (database not migrated). */
  available: boolean;
  health: boolean;
  ai: boolean;
}

export async function fetchConsents(): Promise<ConsentState> {
  const { data, error } = await supabase.from('user_consents').select('kind, granted, policy_version');
  if (error) {
    if (isSchemaError(error)) return { available: false, health: true, ai: false };
    throw error;
  }
  const rows = (data as { kind: ConsentKind; granted: boolean; policy_version: string }[]) ?? [];
  const current = (k: ConsentKind) => rows.some((r) => r.kind === k && r.granted && r.policy_version === PRIVACY_POLICY_VERSION);
  return { available: true, health: current('health_data'), ai: current('third_party_ai') };
}

export async function setConsent(kind: ConsentKind, granted: boolean): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Sign in first.');
  const { error } = await supabase
    .from('user_consents')
    .upsert({ user_id: auth.user.id, kind, granted, policy_version: PRIVACY_POLICY_VERSION }, { onConflict: 'user_id,kind' });
  if (error) throw error;
}

/** Deletes the account and all its data on the server. The caller signs out afterwards. */
export async function deleteMyAccount(): Promise<void> {
  await callFunction<{ deleted: boolean }>('delete-account', { confirm: 'DELETE' });
}

/** True when a server function refused because the AI permission is missing. */
export function isAiConsentError(e: unknown): boolean {
  const p = (e as { payload?: { error?: string } } | null)?.payload;
  return p?.error === 'ai_consent_required';
}
