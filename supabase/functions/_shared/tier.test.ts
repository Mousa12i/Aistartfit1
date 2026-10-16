import { describe, expect, it } from 'vitest';
import { effectiveTier } from './tier';

const now = new Date('2026-10-16T12:00:00Z');
describe('effectiveTier', () => {
  it('keeps a live subscription', () => {
    expect(effectiveTier({ subscription_tier: 'pro', subscription_status: 'active', subscription_current_period_end: '2026-10-01T00:00:00Z' }, now)).toBe('pro');
  });
  it('honours a daily pass until it ends', () => {
    expect(effectiveTier({ subscription_tier: 'plus', subscription_status: 'daily_pass', subscription_current_period_end: '2026-10-16T20:00:00Z' }, now)).toBe('plus');
  });
  it('drops an ended daily pass to free', () => {
    expect(effectiveTier({ subscription_tier: 'plus', subscription_status: 'daily_pass', subscription_current_period_end: '2026-10-16T11:59:00Z' }, now)).toBe('free');
    expect(effectiveTier({ subscription_tier: 'plus', subscription_status: 'daily_pass', subscription_current_period_end: null }, now)).toBe('free');
  });
  it('treats unknown values as free', () => {
    expect(effectiveTier(null, now)).toBe('free');
    expect(effectiveTier({ subscription_tier: 'gold' }, now)).toBe('free');
  });
});
