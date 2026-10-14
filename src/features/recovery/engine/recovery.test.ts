import { describe, expect, it } from 'vitest';
import { normalizeRecoverySnapshot } from './normalize';
import { selectSleep } from './sleep';
import { selectHrv } from './hrv';
import { selectRestingHr } from './restingHr';
import { selectReadiness } from './readiness';
import { getBundledRecoveryData, loadRecoveryData } from '../data/loader';

const empty = normalizeRecoverySnapshot({ checkins: [], workouts: [], profile: { body_weight_kg: null } });

describe('recovery engine', () => {
  it('keeps empty history missing', () => { expect(selectSleep(empty).value).toBeNull(); expect(selectHrv(empty).value).toBeNull(); });
  it('uses the same recorded sleep value everywhere', () => { const snapshot = normalizeRecoverySnapshot({ ...empty, checkins: [{ checkin_date: '2026-10-12', sleep_hours: 2, sleep_source: 'manual', hrv_ms: null, stress: null, protein_g: null, soreness: {} }] }); expect(selectSleep(snapshot).value).toBe(2); });
  it('preserves manual HRV source', () => { const snapshot = normalizeRecoverySnapshot({ ...empty, checkins: [{ checkin_date: '2026-10-12', sleep_hours: null, hrv_ms: 72, hrv_source: 'manual', stress: null, protein_g: null, soreness: {} }] }); expect(selectHrv(snapshot).source).toBe('manual'); });
  it('uses insufficient_data with only two independent inputs', () => { const snapshot = normalizeRecoverySnapshot({ ...empty, checkins: [{ checkin_date: '2026-10-12', sleep_hours: 7, stress: 3, hrv_ms: null, protein_g: null, soreness: {} }] }); expect(selectReadiness(snapshot, false, null).value).toBe('insufficient_data'); });
  it('requires confirmation for a resting heart rate of 34', () => { const snapshot = normalizeRecoverySnapshot({ ...empty, checkins: [{ checkin_date: '2026-10-12', sleep_hours: null, hrv_ms: null, resting_hr_bpm: 34, hr_verified: false, stress: null, protein_g: null, soreness: {} }] }); expect(selectRestingHr(snapshot).completeness).toBe('unverified'); });
  it('validates the bundled catalog and rejects unknown IDs', () => { expect(getBundledRecoveryData().muscles.length).toBeGreaterThan(0); expect(() => loadRecoveryData(['known'], ['chest'])).toThrow('Unknown recovery exercise ID'); });
});
