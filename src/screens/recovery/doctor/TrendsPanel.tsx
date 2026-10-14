import type { DoctorState } from '@/lib/recovery/doctor/build';
import { wellnessScore } from '@/lib/recovery/doctor/wellness';
import { addDays } from '@/lib/recovery/doctor/dates';
import { Panel, RecoverySources } from './ui';
import { BarChart, LineChart, shortDate } from './charts';

export function TrendsPanel({ state }: { state: DoctorState }) {
  const weeks = state.series.map((w) => ({
    label: shortDate(w.end),
    value: w.ratedSessions ? w.load : null,
    detail: `${w.sessions} sessions${w.ratedSessions < w.sessions ? `, ${w.sessions - w.ratedSessions} not rated` : ''}${w.monotony != null ? `, monotony ${w.monotony}` : ''}`,
    muted: w.ratedSessions < w.sessions,
  }));
  const monotony = state.series.map((w) => ({ label: shortDate(w.end), value: w.monotony }));
  const days = Array.from({ length: 28 }, (_, i) => addDays(state.today, -27 + i));
  const byDate = new Map(state.wellnessEntries.map((e) => [e.date, e]));
  const wellness = days.map((d) => {
    const e = byDate.get(d);
    return { label: shortDate(d), value: e ? wellnessScore(e) : null };
  });
  const sleep = days.map((d) => ({ label: shortDate(d), value: byDate.get(d)?.sleepHours ?? null }));
  const baseline = state.wellnessToday?.baseline?.mean ?? state.fingerprint.wellness?.mean ?? null;

  return (
    <div className="space-y-4" data-testid="trends-panel">
      <Panel title="Weekly training load" subtitle="Last 8 weeks · session RPE × minutes (pale bars have unrated sessions)">
        <BarChart data={weeks} color="#76d8ed" />
        <RecoverySources claimIds={['srpe_valid', 'acwr_caution']} className="mt-3" />
      </Panel>
      <Panel title="Monotony" subtitle="Average daily load ÷ its variation, per week (above 2.0 is flagged)">
        <LineChart points={monotony} color="#ffd34f" min={0} refLine={2} refLabel="2.0 flag (StartFit rule)" />
        <RecoverySources claimIds={['monotony_strain', 'monotony_rule']} className="mt-3" />
      </Panel>
      <Panel title="Morning check-in" subtitle="Last 28 days · score 5–25 (higher is better)">
        <LineChart points={wellness} color="#5fe28c" min={5} max={25} refLine={baseline} refLabel={baseline != null ? `Your usual ${baseline}` : undefined} />
        <RecoverySources claimIds={['wellness_subjective', 'wellness_scale']} className="mt-3" />
      </Panel>
      <Panel title="Sleep" subtitle="Last 28 days · hours">
        <BarChart data={sleep} color="#a78bfa" refLine={7} refLabel="7 hours (adult recommendation)" unit=" h" />
        <RecoverySources claimIds={['sleep_7h']} className="mt-3" />
      </Panel>
      <Panel title="Strength trends" subtitle="Best estimated 1RM per session, your most-logged lifts (last 8 weeks)">
        {state.trends.length === 0 ? (
          <p className="text-xs text-cloud-dim">Log the same exercise in 3 or more sessions to see its trend.</p>
        ) : (
          <div className="space-y-4">
            {state.trends.map((t) => (
              <div key={t.exerciseId}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-bold text-white">{t.name}</span>
                  <span className={t.changePercent == null ? 'text-cloud-dim' : t.changePercent >= 0 ? 'text-[#5fe28c]' : 'text-[#ff5964]'}>
                    {t.latest} kg {t.changePercent != null && `(${t.changePercent > 0 ? '+' : ''}${t.changePercent}%)`}
                  </span>
                </div>
                <LineChart points={t.points.map((p) => ({ label: shortDate(p.date), value: p.e1rm }))} color="#76d8ed" height={56} unit=" kg" />
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[10px] text-cloud-dim">Estimated 1RM = weight × (1 + (reps + reps in reserve) ÷ 30). It is an estimate, best for comparing your own sessions.</p>
      </Panel>
    </div>
  );
}
