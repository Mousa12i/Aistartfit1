// A server function refused because the AI permission is missing (for example it was withdrawn on another
// device). The consent provider listens and reloads, so the coach shows the permission card again.
export const AI_CONSENT_EVENT = 'startfit:ai-consent-required';

export function reportIfAiConsentMissing(status: number, payload: unknown): void {
  if (status !== 403) return;
  if ((payload as { error?: unknown } | null)?.error !== 'ai_consent_required') return;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AI_CONSENT_EVENT));
}
