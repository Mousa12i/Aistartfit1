// The coach's recovery plan for one athlete: sleep and step targets, rest days, a mobility routine,
// and a planned lighter (deload) week. The athlete sees it on the Recovery screen; during a deload
// their workouts show fewer sets.
import { supabase } from '../supabase';

/** One mobility or stretching item: from the exercise library or written by the coach. */
export interface MobilityItem { id: string; exercise_id: string | null; name: string; dose: string; note?: string }

export interface RecoveryPlan {
  id?: string;
  coach_id: string;
  athlete_id: string;
  sleep_hours: number | null;
  steps: number | null;
  /** 0 = Sunday … 6 = Saturday (same as Date.getDay()). */
  rest_days: number[];
  mobility: MobilityItem[];
  mobility_days: number[];
  deload_start: string | null;
  deload_days: number | null;
  deload_set_pct: number | null;
  deload_note: string | null;
  notes: string | null;
  updated_at?: string;
}

/** Database limits (same CHECKs as the table). */
export const LIMITS = {
  sleep: [5, 11] as const,
  steps: [1000, 30000] as const,
  deloadDays: [3, 14] as const,
  setPct: [30, 90] as const,
  mobility: 12,
};

/** Days between two YYYY-MM-DD dates (b − a), calendar days, no time zone shifts. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export type DeloadState = { kind: 'none' } | { kind: 'upcoming'; inDays: number; start: string; end: string } | { kind: 'active'; day: number; of: number; end: string; pct: number };

/** Where today is relative to the planned deload (upcoming within 14 days, active, or none). */
export function deloadState(plan: Pick<RecoveryPlan, 'deload_start' | 'deload_days' | 'deload_set_pct'> | null, today: string): DeloadState {
  if (!plan?.deload_start || !plan.deload_days) return { kind: 'none' };
  const d = daysBetween(plan.deload_start, today);
  const end = addDays(plan.deload_start, plan.deload_days - 1);
  if (d >= 0 && d < plan.deload_days) return { kind: 'active', day: d + 1, of: plan.deload_days, end, pct: plan.deload_set_pct ?? 50 };
  if (d < 0 && d >= -14) return { kind: 'upcoming', inDays: -d, start: plan.deload_start, end };
  return { kind: 'none' };
}

/** Sets during a deload: the coach's percentage of the planned sets, rounded up, at least 1. */
export function deloadSets(sets: number, pct: number): number {
  return Math.max(1, Math.ceil((sets * pct) / 100));
}

/** Average sleep over the last `days` nights that have a value, or null. */
export function averageSleep(entries: { date: string; sleepHours: number }[], today: string, days = 7): { avg: number; nights: number } | null {
  const xs = entries.filter((e) => { const d = daysBetween(e.date, today); return d >= 0 && d < days && e.sleepHours > 0; }).map((e) => e.sleepHours);
  if (!xs.length) return null;
  return { avg: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10, nights: xs.length };
}

export function planErrors(p: RecoveryPlan): ('sleep' | 'steps' | 'deload_days' | 'deload_pct' | 'deload_start')[] {
  const out: ('sleep' | 'steps' | 'deload_days' | 'deload_pct' | 'deload_start')[] = [];
  const inR = (v: number, [a, b]: readonly [number, number]) => Number.isFinite(v) && v >= a && v <= b;
  if (p.sleep_hours != null && !inR(p.sleep_hours, LIMITS.sleep)) out.push('sleep');
  if (p.steps != null && !inR(p.steps, LIMITS.steps)) out.push('steps');
  if (p.deload_start) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.deload_start)) out.push('deload_start');
    if (p.deload_days == null || !inR(p.deload_days, LIMITS.deloadDays)) out.push('deload_days');
    if (p.deload_set_pct == null || !inR(p.deload_set_pct, LIMITS.setPct)) out.push('deload_pct');
  }
  return out;
}

/** Short weekday names in the app language, index 0 = Sunday. 2023-01-01 was a Sunday. */
export function weekdayNames(lang: string, style: 'short' | 'long' = 'short'): string[] {
  let f: Intl.DateTimeFormat;
  try { f = new Intl.DateTimeFormat(lang, { weekday: style, timeZone: 'UTC' }); } catch { f = new Intl.DateTimeFormat('en', { weekday: style, timeZone: 'UTC' }); }
  return [0, 1, 2, 3, 4, 5, 6].map((i) => f.format(new Date(Date.UTC(2023, 0, 1 + i))));
}

/** A YYYY-MM-DD date as a short day and month in the app language (e.g. "17 Oct", "17 أكتوبر"). */
export function shortDate(date: string, lang: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  try { return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dt); } catch { return date; }
}

export const newId = () => Math.random().toString(36).slice(2, 10);

// ---------------- data ----------------

const dayList = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter((n) => n >= 0 && n <= 6) : []);

export async function loadRecoveryPlan(athleteId: string): Promise<RecoveryPlan | null> {
  const { data, error } = await supabase.from('coach_recovery_plans').select('*').eq('athlete_id', athleteId)
    .order('updated_at', { ascending: false }).limit(1);
  if (error) throw error;
  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) return null;
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    id: String(row.id), coach_id: String(row.coach_id), athlete_id: String(row.athlete_id),
    sleep_hours: num(row.sleep_hours), steps: num(row.steps),
    rest_days: dayList(row.rest_days), mobility: Array.isArray(row.mobility) ? (row.mobility as MobilityItem[]) : [],
    mobility_days: dayList(row.mobility_days),
    deload_start: row.deload_start ? String(row.deload_start).slice(0, 10) : null,
    deload_days: num(row.deload_days), deload_set_pct: num(row.deload_set_pct),
    deload_note: (row.deload_note as string | null) ?? null, notes: (row.notes as string | null) ?? null,
    updated_at: String(row.updated_at ?? ''),
  };
}

export async function saveRecoveryPlan(plan: RecoveryPlan): Promise<void> {
  const { id: _id, updated_at: _u, ...rest } = plan;
  void _id; void _u;
  const clean = rest.deload_start ? rest : { ...rest, deload_days: null, deload_set_pct: null, deload_note: null };
  const { error } = await supabase.from('coach_recovery_plans')
    .upsert({ ...clean, updated_at: new Date().toISOString() }, { onConflict: 'coach_id,athlete_id' });
  if (error) throw error;
}
