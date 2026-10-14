// Every function that sends a person's data to the AI provider checks their permission first
// (App Store Review Guideline 5.1.2(i): disclose sharing with third-party AI and obtain explicit permission).

// deno-lint-ignore no-explicit-any
type Db = any;

export const AI_CONSENT_REQUIRED = {
  error: 'ai_consent_required',
  message: 'To use the AI coaches, allow StartFit to send the data they need to its AI provider (OpenAI). You can do this in the coach or in Settings → Privacy.',
};

/** True only when the person has granted (and not withdrawn) permission to share data with the AI provider. */
export async function hasAiConsent(db: Db, userId: string): Promise<boolean> {
  const { data, error } = await db.from('user_consents').select('granted').eq('user_id', userId).eq('kind', 'third_party_ai').maybeSingle();
  if (error || !data) return false;
  return data.granted === true;
}
