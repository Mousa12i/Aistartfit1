import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { assessWellness, wellnessBaseline, wellnessScore, type WellnessEntry } from './wellness';
import { sessionLoad, weekLoad, weeklySeries, loadChange, monotonyFlag, type LoadSession } from './load';
import { performanceTrends, sleepSummary, type PerfSet } from './trends';
import { decideToday, detectDeload } from './decision';
import { evaluateRtt } from './rtt';
import { cycleInfo, isPeriodDay } from './cycle';
import { whatWorks, weeklyReport, recoveryFingerprint } from './insights';
import { RECOVERY_CLAIMS, RECOVERY_REFERENCES, referencesForRecoveryClaims } from './evidence';
import { MODALITIES } from './modalities';
import type { MuscleRecoveryState } from '../engine';

const TODAY = '2026-10-14';
const entry = (date: string, v: number, sleepHours: number | null = 7.5, extra: Partial<WellnessEntry> = {}): WellnessEntry => ({
  date, sleep: v, energy: v, soreness: v, stress: v, mood: v, sleepHours, ...extra,
});
// 14 days alternating 3s and 4s → scores 15 / 20, mean 17.5
const history = Array.from({ length: 14 }, (_, i) => entry(addDays(TODAY, -14 + i), i % 2 ? 4 : 3));

function state(muscle: MuscleRecoveryState['muscle'], pct: number | null): MuscleRecoveryState {
  return { muscle, recoveryPercent: pct, status: pct == null ? 'no_data' : pct < 50 ? 'red' : pct < 90 ? 'orange' : 'green' } as MuscleRecoveryState;
}

describe('evidence list', () => {
  it('every study claim has references and every design claim says it is a StartFit rule', () => {
    for (const c of Object.values(RECOVERY_CLAIMS)) {
      if (c.kind === 'study') {
        expect(c.refs.length > 0).toBe(true);
        for (const r of c.refs) expect(!!RECOVERY_REFERENCES[r]).toBe(true);
      } else {
        expect(c.refs.length).toBe(0);
        expect(c.text.startsWith('StartFit rule')).toBe(true);
      }
    }
  });
  it('modalities only cite existing claims', () => {
    for (const m of MODALITIES) for (const id of m.claimIds) expect(!!RECOVERY_CLAIMS[id]).toBe(true);
  });
  it('collects references without repeats', () => {
    expect(referencesForRecoveryClaims(['massage_doms', 'methods_doms', 'cwi_blunts']).map((r) => r.id)).toEqual(['dupuy2018', 'roberts2015']);
  });
});

describe('wellness', () => {
  it('scores only complete check-ins', () => {
    expect(wellnessScore(entry(TODAY, 3))).toBe(15);
    expect(wellnessScore({ ...entry(TODAY, 3), mood: null })).toBeNull();
  });
  it('needs 7 check-ins before a personal baseline', () => {
    expect(wellnessBaseline(history.slice(-6), TODAY)).toBeNull();
    const b = wellnessBaseline(history, TODAY)!;
    expect(b.mean).toBe(17.5);
    expect(b.n).toBe(14);
  });
  it('flags a check-in far below your usual', () => {
    const w = assessWellness([...history, entry(TODAY, 2)], TODAY)!;
    expect(w.score).toBe(10);
    expect(w.status).toBe('much_lower');
    expect(w.lowItems.length).toBe(5);
  });
  it('treats a usual score as usual', () => {
    expect(assessWellness([...history, entry(TODAY, 3, 7, { energy: 4, mood: 4 })], TODAY)!.status).toBe('usual');
  });
});

describe('session load', () => {
  const sessions: LoadSession[] = [
    { id: 'a', date: addDays(TODAY, -6), minutes: 60, rpe: 7 },
    { id: 'b', date: addDays(TODAY, -4), minutes: 50, rpe: 8 },
    { id: 'c', date: addDays(TODAY, -2), minutes: 60, rpe: 6 },
    { id: 'd', date: TODAY, minutes: 45, rpe: null },
  ];
  it('is RPE × minutes and skips unrated sessions', () => {
    expect(sessionLoad(sessions[0])).toBe(420);
    expect(sessionLoad(sessions[3])).toBeNull();
  });
  it('computes weekly load, monotony and strain over 7 days', () => {
    const w = weekLoad(sessions, TODAY);
    expect(w.load).toBe(420 + 400 + 360);
    expect(w.sessions).toBe(4);
    expect(w.ratedSessions).toBe(3);
    // daily [420,0,400,0,360,0,0]: mean 168.57, sample SD 205.2 → 0.8
    expect(w.monotony).toBe(0.8);
    expect(w.strain).toBe(Math.round(1180 * 0.8));
    expect(monotonyFlag(w)).toBe(false);
  });
  it('flags monotonous weeks (same load every day)', () => {
    const daily: LoadSession[] = Array.from({ length: 7 }, (_, i) => ({ id: `x${i}`, date: addDays(TODAY, -i), minutes: i === 0 ? 50 : 60, rpe: 6 }));
    const w = weekLoad(daily, TODAY);
    expect(w.monotony! > 2).toBe(true);
    expect(monotonyFlag(w)).toBe(true);
  });
  it('compares this week with the previous weeks (no ACWR)', () => {
    const many: LoadSession[] = [];
    for (let wk = 0; wk < 5; wk++) many.push({ id: `w${wk}`, date: addDays(TODAY, -7 * wk), minutes: 60, rpe: wk === 0 ? 10 : 5 });
    const series = weeklySeries(many, TODAY, 8);
    expect(series.length).toBe(8);
    const c = loadChange(series);
    expect(c.previousAverage).toBe(300);
    expect(c.percent).toBe(100);
  });
});

describe('trends', () => {
  it('tracks the best estimated 1RM per session', () => {
    const sets: PerfSet[] = [0, 1, 2, 3].flatMap((i) => [
      { sessionId: `s${i}`, date: addDays(TODAY, -21 + i * 7), exerciseId: 'bench', exerciseName: 'Bench', weight: 60 + i * 2.5, reps: 8, rir: 2, setType: 'working', completed: true },
      { sessionId: `s${i}`, date: addDays(TODAY, -21 + i * 7), exerciseId: 'bench', exerciseName: 'Bench', weight: 40, reps: 10, rir: 5, setType: 'warm_up', completed: true },
    ]);
    const [t] = performanceTrends(sets, TODAY);
    expect(t.points.length).toBe(4);
    expect(t.changePercent! > 0).toBe(true);
  });
  it('summarises sleep debt and regularity', () => {
    const s = sleepSummary([6, 8, 5, 7, 6.5, 9, 7].map((h, i) => ({ date: addDays(TODAY, -i), hours: h })), TODAY);
    expect(s.lastNight).toBe(6);
    expect(s.nightsUnder7).toBe(3);
    expect(s.debt).toBe(3.5);
    expect(s.irregular).toBe(true);
  });
});

describe("today's decision", () => {
  const base = { today: TODAY, lastNightSleep: 8, plannedMuscles: [] as MuscleRecoveryState['muscle'][], muscleStates: [], pain: [], monotonyHigh: false, deloadActive: false, rttArea: null };
  const usual = assessWellness([...history, entry(TODAY, 4)], TODAY);
  it('stops on a red flag', () => {
    const d = decideToday({ ...base, wellness: usual, pain: [{ area: 'Thigh', level: 'red', date: addDays(TODAY, -1), note: 'Red flags: Dark or cola-colored urine' }] });
    expect(d.level).toBe('stop');
    expect(d.claimIds.includes('rhabdo_signs')).toBe(true);
  });
  it('asks for the check-in first', () => {
    expect(decideToday({ ...base, wellness: null }).level).toBe('need_checkin');
  });
  it('goes when everything is in order', () => {
    expect(decideToday({ ...base, wellness: usual }).level).toBe('go');
  });
  it('adjusts after a short night', () => {
    const d = decideToday({ ...base, wellness: usual, lastNightSleep: 6 });
    expect(d.level).toBe('adjust');
    expect(d.claimIds.includes('sleep_loss_perf')).toBe(true);
  });
  it('goes easy under 5 hours or a much lower check-in', () => {
    expect(decideToday({ ...base, wellness: usual, lastNightSleep: 4.5 }).level).toBe('easy');
    expect(decideToday({ ...base, wellness: assessWellness([...history, entry(TODAY, 2)], TODAY) }).level).toBe('easy');
  });
  it('names muscles of the next workout that are not recovered', () => {
    const d = decideToday({ ...base, wellness: usual, plannedMuscles: ['quads', 'glutes'], muscleStates: [state('quads', 30), state('glutes', 95), state('biceps', 100)] });
    expect(d.level).toBe('adjust');
    expect(d.notReady).toEqual(['quads']);
  });
});

describe('deload detector', () => {
  it('needs two signals', () => {
    const one = detectDeload({ today: TODAY, performanceDrops: [{ name: 'Quads', percentDrop: 7 }], recentStatuses: ['usual', 'usual'], monotonyHigh: false, lastDeloadOrStart: addDays(TODAY, -14), activeWeeks: 2 });
    expect(one.suggest).toBe(false);
    const two = detectDeload({ today: TODAY, performanceDrops: [{ name: 'Quads', percentDrop: 7 }], recentStatuses: ['lower', 'much_lower', 'lower', 'usual', 'usual'], monotonyHigh: false, lastDeloadOrStart: addDays(TODAY, -14), activeWeeks: 2 });
    expect(two.suggest).toBe(true);
    expect(two.metCount).toBe(2);
  });
  it('counts 6+ weeks of training since the last lighter week', () => {
    const d = detectDeload({ today: TODAY, performanceDrops: [], recentStatuses: [], monotonyHigh: true, lastDeloadOrStart: addDays(TODAY, -50), activeWeeks: 7 });
    expect(d.suggest).toBe(true);
  });
});

describe('return to training', () => {
  const e = (date: string, stage: number, during: number, worse: boolean | null) => ({ date, stage, painDuring: during, painNextMorning: worse == null ? null : 2, morningWorse: worse });
  it('advances after two good sessions', () => {
    expect(evaluateRtt(1, [e('2026-10-10', 1, 2, false), e('2026-10-12', 1, 3, false)]).advice).toBe('advance');
  });
  it('waits for the next-morning answer', () => {
    expect(evaluateRtt(1, [e('2026-10-12', 1, 2, null)]).advice).toBe('log_morning');
  });
  it('goes back when pain is above 5 or worse next morning', () => {
    expect(evaluateRtt(3, [e('2026-10-12', 3, 6, false)]).nextStage).toBe(2);
    expect(evaluateRtt(2, [e('2026-10-12', 2, 2, true)]).advice).toBe('back');
  });
  it('sends to a clinician at 8/10', () => {
    expect(evaluateRtt(2, [e('2026-10-12', 2, 8, null)]).advice).toBe('see_clinician');
  });
  it('starts a new stage afresh after moving back', () => {
    expect(evaluateRtt(2, [e('2026-10-12', 3, 6, false)]).advice).toBe('stay');
    // old good sessions at stage 2 from before stage 3 do not count again
    expect(evaluateRtt(2, [e('2026-10-08', 2, 1, false), e('2026-10-10', 2, 1, false), e('2026-10-12', 3, 6, false)]).advice).toBe('stay');
  });
  it('completes after two good sessions at stage 4', () => {
    expect(evaluateRtt(4, [e('2026-10-10', 4, 1, false), e('2026-10-12', 4, 0, false)]).advice).toBe('complete');
  });
  it('needs one more good session when the last one was good', () => {
    expect(evaluateRtt(2, [e('2026-10-10', 2, 4, false), e('2026-10-12', 2, 1, false)]).text).toContain('1 more');
  });
});

describe('cycle', () => {
  it('estimates cycle day and next start from recorded starts', () => {
    const c = cycleInfo(['2026-08-20', '2026-09-17', '2026-10-15', '2026-10-13'], TODAY);
    expect(c.cycleDay).toBe(2);
    expect(c.onPeriodDays).toBe(true);
    expect(c.typicalLength).toBe(27); // 28 and 26 days; the future date is ignored
    expect(isPeriodDay(['2026-10-01'], '2026-10-05')).toBe(true);
    expect(isPeriodDay(['2026-10-01'], '2026-10-06')).toBe(false);
  });
});

describe('what works for you', () => {
  const days = Array.from({ length: 30 }, (_, i) => addDays(TODAY, -29 + i));
  // good sleep → 4s; short sleep → 2s (big, consistent difference)
  const wellness = days.map((d, i) => (i % 2 ? entry(d, 4, 8) : entry(d, 2, 5.5)));
  const input = { today: TODAY, wellness, sessions: [] as LoadSession[], sets: [] as PerfSet[], modalityLogs: [], bodyWeightKg: 80, cycleStarts: null };
  it('shows a pattern only with 5+ days on each side', () => {
    const sleep = whatWorks(input).find((c) => c.id === 'sleep')!;
    expect(sleep.result).toBe('pattern');
    expect(sleep.meanA).toBe(16);
    expect(sleep.meanB).toBe(8);
    const few = whatWorks({ ...input, wellness: wellness.slice(-6) }).find((c) => c.id === 'sleep')!;
    expect(few.result).toBe('not_enough_data');
  });
  it('reports no clear difference when the two sides are alike', () => {
    const same = days.map((d, i) => entry(d, 3 + (i % 3 === 0 ? 1 : 0), i % 2 ? 8 : 6));
    const c = whatWorks({ ...input, wellness: same }).find((x) => x.id === 'sleep')!;
    expect(c.result).toBe('no_clear_difference');
  });
  it('builds a weekly report and a fingerprint', () => {
    const sessions: LoadSession[] = [0, 2, 4].map((i) => ({ id: `s${i}`, date: addDays(TODAY, -i), minutes: 60, rpe: 7 }));
    const r = weeklyReport({ ...input, sessions });
    expect(r.sessions).toBe(3);
    expect(r.load).toBe(1260);
    expect(r.checkins).toBe(7);
    const f = recoveryFingerprint({ ...input, sessions }, []);
    expect(f.wellness != null).toBe(true);
    expect(f.missing).toContain('6 rated sessions');
  });
});

describe('gym ↔ home switch', () => {
  it('pauses the performance signal of the deload detector for two weeks', () => {
    const d = detectDeload({ today: TODAY, performancePaused: true, performanceDrops: [{ name: 'Quads', percentDrop: 12 }], recentStatuses: ['lower', 'lower', 'lower'], monotonyHigh: false, lastDeloadOrStart: addDays(TODAY, -14), activeWeeks: 2 });
    expect(d.signals.find((s) => s.id === 'performance')!.met).toBe(false);
    expect(d.metCount).toBe(1);
    expect(d.suggest).toBe(false);
  });
});
