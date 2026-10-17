/** Coaches can set reply hours; their phone notifications wait until the hours start. */
export function insideHours(start: number | null, end: number | null, tz: string | null, now = new Date()): boolean {
  if (start == null || end == null || start === end) return true;
  let h: number;
  try { h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz || 'UTC' }).format(now)); } catch { return true; }
  return start < end ? h >= start && h < end : h >= start || h < end;
}
