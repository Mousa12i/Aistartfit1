// Dropout radar: how close each athlete is to quietly leaving, from what they actually do in the app.
//
// Evidence used, and how far it goes:
// - Pedersen DH et al. Predicting dropouts from an electronic health platform for lifestyle interventions.
//   J Med Internet Res 2019;21(9):e13617 (2,684 users). Inactivity was the critical warning sign: of users inactive
//   for 2 weeks, 79.2 % went on to drop out (4 weeks with no activity); after 3 weeks, 84.6 %. The number of advices
//   received from the health coach was also among the predictors. Those percentages describe that platform; we show
//   them as what the study found, not as a forecast for one person.
// - Mohr DC et al. Supportive accountability. J Med Internet Res 2011;13(1):e30: human support improves adherence when
//   people feel accountable to a coach they see as trustworthy, benevolent and expert, with clear expectations.
// The 50 % "fading" and "shorter check-ins" cut-offs are StartFit design rules (marked below), not study results.

export interface EngagementRow {
  athlete_id: string;
  /** Local days (YYYY-MM-DD) in the last 28 with any activity: workout, food, weigh-in, check-in, message, habit, daily check-in. */
  active_dates: string[];
  last_active_at: string | null;
  last_coach_message_at: string | null;
  coach_messages_14d: number;
  /** Characters the athlete wrote in each check-in, newest first. */
  checkin_lengths: number[];
  paused_until: string | null;
  pause_reason: string | null;
  plan_ends_on: string | null;
}

export type RadarLevel = 'paused' | 'ok' | 'quiet' | 'high' | 'critical';

export type RadarReason =
  | { code: 'inactive'; days: number }
  | { code: 'fading'; last7: number; usual: number }
  | { code: 'short_checkins'; recent: number; before: number }
  | { code: 'coach_silent'; days: number; never: boolean };

export interface Radar {
  level: RadarLevel;
  /** Calendar days since the last active day (null: nothing logged yet). */
  inactiveDays: number | null;
  /** Active days in the last 7 (today included). */
  last7: number;
  /** Average active days per week over the 3 weeks before that. */
  usualPerWeek: number;
  reasons: RadarReason[];
  /** Days until the active programme ends (negative: it already ended). */
  programEndsIn: number | null;
  pausedUntil: string | null;
}

export const RADAR = {
  /** Pedersen 2019 reported the outcome of 2- and 3-week inactivity; one quiet week is our early nudge. */
  quietDays: 7,
  highDays: 14,
  criticalDays: 21,
  /** StartFit rule: this week below half the usual weekly active days, when the usual is at least 2. */
  fadingRatio: 0.5,
  fadingMinUsual: 2,
  /** StartFit rule: the last 2 check-ins carry less than half the words of the 2-4 before, which had at least 40 characters. */
  shortRatio: 0.5,
  shortMinBefore: 40,
  /** StartFit rule: no message from the coach for 7 days while the athlete is still active. */
  coachSilentDays: 7,
  programEndingDays: 7,
} as const;

export const STUDY = { inactive14: 79.2, inactive21: 84.6, n: 2684 } as const;

const DAY = 86400000;
const toUtc = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const diffDays = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY);
const localYmd = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function radarFor(row: EngagementRow, today: string, joinedAt: string): Radar {
  const pausedUntil = row.paused_until && row.paused_until >= today ? row.paused_until : null;
  const dates = [...new Set(row.active_dates)].filter((d) => d <= today).sort();
  const lastDay = dates.length ? dates[dates.length - 1] : row.last_active_at ? localYmd(row.last_active_at) : null;
  const memberDays = Math.max(0, diffDays(localYmd(joinedAt), today));
  // Never active: count from joining.
  const inactiveDays = lastDay ? Math.max(0, diffDays(lastDay, today)) : memberDays;

  const last7 = dates.filter((d) => diffDays(d, today) <= 6).length;
  const before = dates.filter((d) => { const n = diffDays(d, today); return n >= 7 && n <= 27; }).length;
  // Weeks of history available before this week (up to 3), so new athletes are not compared with empty weeks.
  const weeksBefore = Math.min(3, Math.max(0, Math.floor((memberDays - 7) / 7)));
  const usualPerWeek = weeksBefore > 0 ? Math.round((before / weeksBefore) * 10) / 10 : 0;

  const reasons: RadarReason[] = [];
  if (inactiveDays >= RADAR.quietDays) reasons.push({ code: 'inactive', days: inactiveDays });
  if (inactiveDays < RADAR.quietDays && usualPerWeek >= RADAR.fadingMinUsual && last7 < usualPerWeek * RADAR.fadingRatio) {
    reasons.push({ code: 'fading', last7, usual: usualPerWeek });
  }
  const lens = row.checkin_lengths;
  if (lens.length >= 4) {
    const recent = (lens[0] + lens[1]) / 2;
    const prev = lens.slice(2, 6);
    const beforeAvg = prev.reduce((a, b) => a + b, 0) / prev.length;
    if (beforeAvg >= RADAR.shortMinBefore && recent < beforeAvg * RADAR.shortRatio) {
      reasons.push({ code: 'short_checkins', recent: Math.round(recent), before: Math.round(beforeAvg) });
    }
  }
  const coachGap = row.last_coach_message_at ? Math.max(0, diffDays(localYmd(row.last_coach_message_at), today)) : memberDays;
  if (coachGap >= RADAR.coachSilentDays && memberDays >= RADAR.coachSilentDays) reasons.push({ code: 'coach_silent', days: coachGap, never: !row.last_coach_message_at });

  let level: RadarLevel = 'ok';
  if (pausedUntil) level = 'paused';
  else if (inactiveDays >= RADAR.criticalDays) level = 'critical';
  else if (inactiveDays >= RADAR.highDays) level = 'high';
  else if (inactiveDays >= RADAR.quietDays || reasons.some((r) => r.code === 'fading' || r.code === 'short_checkins')) level = 'quiet';

  return {
    level,
    inactiveDays: lastDay || memberDays ? inactiveDays : null,
    last7,
    usualPerWeek,
    reasons: pausedUntil ? [] : reasons,
    programEndsIn: row.plan_ends_on ? diffDays(today, row.plan_ends_on) : null,
    pausedUntil,
  };
}

const ORDER: Record<RadarLevel, number> = { critical: 0, high: 1, quiet: 2, ok: 3, paused: 4 };

/** Athletes that need a human touch, most urgent first. */
export function radarList<T extends { radar: Radar; name: string }>(items: T[]): T[] {
  return items
    .filter((x) => x.radar.level === 'critical' || x.radar.level === 'high' || x.radar.level === 'quiet')
    .sort((a, b) => ORDER[a.radar.level] - ORDER[b.radar.level] || (b.radar.inactiveDays ?? 0) - (a.radar.inactiveDays ?? 0) || a.name.localeCompare(b.name));
}
