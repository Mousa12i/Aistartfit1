// Optional, private menstrual-cycle insights (claim: cycle_trivial). Only period start dates are stored.
// Phases are kept to what can be known from start dates alone: period days (days 1–5) and the rest.

import { addDays, daysBetween, median } from './dates';

export interface CycleInfo {
  cycleDay: number | null;
  /** Median length of recent cycles between 21 and 45 days; null with fewer than 2 starts. */
  typicalLength: number | null;
  nextStartEstimate: string | null;
  onPeriodDays: boolean;
  starts: string[];
}

export function cycleInfo(startDates: string[], today: string): CycleInfo {
  const starts = [...new Set(startDates)].filter((d) => d <= today).sort();
  const last = starts[starts.length - 1] ?? null;
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const len = daysBetween(starts[i - 1], starts[i]);
    if (len >= 21 && len <= 45) lengths.push(len);
  }
  const typical = median(lengths.slice(-6));
  const cycleDay = last ? daysBetween(last, today) + 1 : null;
  return {
    cycleDay: cycleDay != null && cycleDay <= 60 ? cycleDay : null,
    typicalLength: typical == null ? null : Math.round(typical),
    nextStartEstimate: last && typical ? addDays(last, Math.round(typical)) : null,
    onPeriodDays: cycleDay != null && cycleDay >= 1 && cycleDay <= 5,
    starts,
  };
}

/** Whether a date falls on days 1–5 after one of the recorded starts. */
export function isPeriodDay(startDates: string[], date: string): boolean {
  return startDates.some((s) => {
    const d = daysBetween(s, date);
    return d >= 0 && d <= 4;
  });
}
