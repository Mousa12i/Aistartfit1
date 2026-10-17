import { describe, expect, it } from 'vitest';
import { insideHours } from './hours.ts';

// 2026-10-17 is British Summer Time (UTC+1).
const at = (iso: string) => new Date(iso);

describe('coach reply hours', () => {
  it('day hours in the coach time zone', () => {
    expect(insideHours(9, 18, 'Europe/London', at('2026-10-17T08:30:00Z'))).toBe(true); // 09:30 local
    expect(insideHours(9, 18, 'Europe/London', at('2026-10-17T07:30:00Z'))).toBe(false); // 08:30 local
    expect(insideHours(9, 18, 'Europe/London', at('2026-10-17T17:00:00Z'))).toBe(false); // 18:00 local, end is exclusive
    expect(insideHours(9, 18, 'Asia/Amman', at('2026-10-17T06:30:00Z'))).toBe(true); // 09:30 in Amman (UTC+3)
  });
  it('hours across midnight', () => {
    expect(insideHours(20, 2, 'UTC', at('2026-10-17T23:00:00Z'))).toBe(true);
    expect(insideHours(20, 2, 'UTC', at('2026-10-17T01:30:00Z'))).toBe(true);
    expect(insideHours(20, 2, 'UTC', at('2026-10-17T12:00:00Z'))).toBe(false);
  });
  it('no hours set, equal hours or a bad zone never hold notifications', () => {
    expect(insideHours(null, null, null)).toBe(true);
    expect(insideHours(9, 9, 'UTC')).toBe(true);
    expect(insideHours(9, 18, 'Not/AZone', at('2026-10-17T03:00:00Z'))).toBe(true);
  });
});
