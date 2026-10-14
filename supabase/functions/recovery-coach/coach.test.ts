import { describe, expect, it } from 'vitest';
import { buildContext, buildSystemPrompt, hasRedFlag, NO_EVIDENCE_TEXT, parseModelJson, SAFETY_TEXT, sanitizeReply } from './coach';
import { COACH_CLAIMS } from './evidence.generated';

const ok = { claimIds: new Set(COACH_CLAIMS.map((c) => c.id)), existingMemory: ['Sleeps 6 h on weekdays'], redFlag: false };

describe('recovery coach output checks', () => {
  it('keeps blocks that cite known claims or the person data and drops the rest', () => {
    const r = sanitizeReply(
      {
        blocks: [
          { text: 'Massage helps DOMS most', basis: 'evidence', claim_ids: ['massage_doms'] },
          { text: 'A 2025 study shows 40% faster recovery', basis: 'evidence', claim_ids: ['invented_2025'] },
          { text: 'You slept 5.5 h last night', basis: 'user_data' },
          { text: 'Take ibuprofen', basis: 'medicine' },
        ],
        links: ['checkin', 'hack', 'methods'],
      },
      ok,
    );
    expect(r.blocks.map((b) => b.text)).toEqual(['Massage helps DOMS most', 'You slept 5.5 h last night']);
    expect(r.dropped).toBe(2);
    expect(r.links).toEqual(['checkin', 'methods']);
  });
  it('falls back to an honest "not covered" answer', () => {
    expect(sanitizeReply(null, ok).blocks[0].text).toBe(NO_EVIDENCE_TEXT);
  });
  it('limits general blocks', () => {
    const r = sanitizeReply({ blocks: [1, 2, 3].map((i) => ({ text: `hi ${i}`, basis: 'general' })) }, ok);
    expect(r.blocks.length).toBe(2);
  });
  it('does not save memory that already exists', () => {
    const r = sanitizeReply({ blocks: [{ text: 'ok', basis: 'general' }], memory: [{ category: 'recovery', content: 'sleeps 6 h on weekdays' }, { category: 'injury', content: 'Left knee pain when squatting' }] }, ok);
    expect(r.memory).toEqual([{ category: 'injury', content: 'Left knee pain when squatting' }]);
  });
});

describe('red flags', () => {
  it('detects warning signs in English and Arabic', () => {
    expect(hasRedFlag('My urine is dark brown after leg day')).toBe(true);
    expect(hasRedFlag('I had chest pain during the run')).toBe(true);
    expect(hasRedFlag('عندي ألم في الصدر وقت التمرين')).toBe(true);
    expect(hasRedFlag('صار لون البول غامق بعد التمرين')).toBe(true);
    expect(hasRedFlag('حسيت بخدر بإيدي')).toBe(true);
    expect(hasRedFlag('My legs are sore after squats')).toBe(false);
    expect(hasRedFlag('عضلاتي موجوعة بعد التمرين')).toBe(false);
  });
  it('always puts the safety answer first, even if the model fails', () => {
    const r = sanitizeReply(null, { ...ok, redFlag: true });
    expect(r.blocks[0].text).toBe(SAFETY_TEXT);
    expect(r.blocks[0].claimIds).toEqual(['triage_rule', 'rhabdo_signs']);
    expect(r.links[0]).toBe('triage');
    expect(r.safety).toBe(true);
  });
});

describe('prompt and context', () => {
  it('lists every claim and marks StartFit rules', () => {
    const p = buildSystemPrompt(COACH_CLAIMS);
    for (const c of COACH_CLAIMS) expect(p.includes(`[${c.id}]`)).toBe(true);
    expect(p.includes('StartFit design rule')).toBe(true);
  });
  it('puts the person data into the context', () => {
    const c = buildContext({
      now: '2026-10-14',
      profile: null,
      memory: [],
      snapshot: { decision: 'adjust' },
      checkins: [{ checkin_date: '2026-10-14', sleep_hours: 6, wellness_sleep: 2, wellness_energy: 3, wellness_soreness: 3, wellness_stress: 4, wellness_mood: 4 }],
      sessions: [{ date: '2026-10-13', name: 'Legs', minutes: 60, rpe: 8 }],
      pain: [],
      rtt: [{ area: 'Knee', stage: 2, status: 'active' }],
      deloads: [],
    });
    expect(c).toContain('2026-10-14 sleep 6h, w 2/3/3/4/4');
    expect(c).toContain('Legs 60min RPE 8');
    expect(c).toContain('Knee stage 2/4 active');
    expect(c).toContain('"decision":"adjust"');
  });
  it('parses fenced JSON', () => {
    expect(parseModelJson('```json\n{"blocks":[]}\n```')).toEqual({ blocks: [] });
  });
});
