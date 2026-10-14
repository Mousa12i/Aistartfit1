import { describe, expect, it } from 'vitest';
import { PRIVACY_POLICY, PLACEHOLDERS } from './privacy-policy';
import { PRIVACY_POLICY_VERSION } from './version';
import { AI_CONSENT_EVENT, reportIfAiConsentMissing } from '../consent-events';

const all = JSON.stringify(PRIVACY_POLICY);

describe('privacy policy', () => {
  it('names every service that receives data', () => {
    for (const p of ['Supabase', 'OpenAI', 'Stripe', 'USDA', 'Open Food Facts', 'images.pexels.com', 'raw.githubusercontent.com']) expect(all).toContain(p);
  });
  it('covers what both stores ask for', () => {
    const ids = PRIVACY_POLICY.sections.map((s) => s.id);
    for (const id of ['who', 'collect', 'use', 'share', 'retention', 'delete-account', 'rights', 'children']) expect(ids).toContain(id);
    expect(all).toMatch(/never use your health, fitness or nutrition data for advertising/);
    expect(all).toMatch(/withdraw/i);
  });
  it('carries the consent version and owner placeholders', () => {
    expect(PRIVACY_POLICY.version).toBe(PRIVACY_POLICY_VERSION);
    for (const v of Object.values(PLACEHOLDERS)) expect(all).toContain(v);
  });
});

describe('AI consent signal', () => {
  it('fires only for the consent refusal', () => {
    let n = 0;
    const g = globalThis as unknown as { window?: { dispatchEvent: (e: unknown) => void } };
    const prev = g.window;
    g.window = { dispatchEvent: () => { n++; } };
    reportIfAiConsentMissing(403, { error: 'ai_consent_required' });
    reportIfAiConsentMissing(403, { error: 'other' });
    reportIfAiConsentMissing(429, { error: 'ai_consent_required' });
    g.window = prev;
    expect(n).toBe(1);
    expect(AI_CONSENT_EVENT).toBe('startfit:ai-consent-required');
  });
});
