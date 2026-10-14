// Local-calendar date helpers. Dates are stored as 'YYYY-MM-DD' keys in the
// user's own time zone so a meal eaten at 00:30 lands on the right day.

const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isValidDateKey(key: string | null | undefined): key is string {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = parseDateKey(key);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === key;
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Whole calendar days from `fromKey` to `toKey` (negative if `toKey` is earlier). */
export function daysBetween(fromKey: string, toKey: string): number {
  const a = parseDateKey(fromKey).getTime();
  const b = parseDateKey(toKey).getTime();
  return Math.round((b - a) / 86400000);
}

/** Inclusive list of date keys between two keys. */
export function dateKeysBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const span = daysBetween(fromKey, toKey);
  for (let i = 0; i <= span; i++) out.push(addDays(fromKey, i));
  return out;
}

export function weekdayShort(key: string): string {
  return WEEKDAY_SHORT[parseDateKey(key).getDay()];
}

export function formatDayLabel(key: string, today: string = todayKey()): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return parseDateKey(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatShortDate(key: string): string {
  return parseDateKey(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatLongDate(key: string): string {
  return parseDateKey(key).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Local calendar day of an ISO timestamp. */
export function dateKeyFromISO(iso: string): string {
  return toDateKey(new Date(iso));
}

/** Midday on the given local day, as ISO. Used when a record needs a timestamp for a chosen day. */
export function middayISO(key: string): string {
  const date = parseDateKey(key);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}
