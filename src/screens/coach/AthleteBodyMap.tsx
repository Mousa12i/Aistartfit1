import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { useI18n, type MessageKey } from '@/lib/i18n';
import type { RosterRow } from '@/lib/coach/insights';
import { MappingCache, loadAthleteWeek } from '@/lib/coach/week-data';
import type { MuscleRecoveryState } from '@/lib/recovery/engine';
import type { RecoveryMuscle } from '@/lib/recovery/muscles';

// three.js is large: load the 3D model only when the coach opens an athlete.
const RecoveryBodyModel = lazy(() => import('@/components/recovery/RecoveryBodyModel').then((m) => ({ default: m.RecoveryBodyModel })));

export const muscleKey = (m: RecoveryMuscle) => `bodymuscle.${m}` as MessageKey;

/** Same thresholds as the colors on the 3D model: up to 50% red, up to 85% amber, above that green. */
export function bandOf(p: number | null): 'none' | 'red' | 'amber' | 'green' {
  if (p == null) return 'none';
  return p <= 50 ? 'red' : p <= 85 ? 'amber' : 'green';
}
const BAND_CLASS = { none: 'text-cloud-dim', red: 'text-[#EF4444]', amber: 'text-[#F59E0B]', green: 'text-[#10B981]' } as const;

/** The athlete's live recovery on the 3D body, for the coach (same engine and colors as the athlete's Recovery screen). */
export function AthleteBodyMap({ row }: { row: RosterRow }) {
  const { t, dir } = useI18n();
  const [states, setStates] = useState<MuscleRecoveryState[] | null>(null);
  const [trained, setTrained] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<RecoveryMuscle | null>(null);

  useEffect(() => {
    let off = false;
    setStates(null); setFailed(false);
    loadAthleteWeek(row, new MappingCache())
      .then((d) => { if (!off) { setStates(d.recovery); setTrained(d.trained); } })
      .catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.athlete_id]);

  const sel = useMemo(() => states?.find((s) => s.muscle === selected) ?? null, [states, selected]);
  const fatigued = useMemo(() => {
    const names = (states ?? []).filter((s) => bandOf(s.recoveryPercent) === 'red').map((s) => t(muscleKey(s.muscle)));
    return names.join(' · ');
  }, [states, t]);

  const text = {
    title: t('bodymap.title'), subtitle: t('bodymap.subtitle'), badge: t('bodymap.badge'),
    legend: [t('bodymap.legendRed'), t('bodymap.legendAmber'), t('bodymap.legendGreen'), t('bodymap.legendNone')] as [string, string, string, string],
    footer: t('bodymap.footer'),
  };

  if (failed) return <p className="rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">{t('bodymap.error')}</p>;
  if (!states) return <div className="h-[440px] animate-pulse rounded-2xl bg-ink-surface" />;

  const hoursLeft = sel && sel.recoveryPercent != null && sel.hoursSinceLastTrained != null ? Math.max(0, Math.ceil(sel.hoursNeeded - sel.hoursSinceLastTrained)) : null;

  return (
    <section className="space-y-2" dir={dir} data-testid="coach-body-map">
      {!trained && <p className="rounded-xl bg-ink-surface px-3 py-2 text-xs text-cloud-dim">{t('bodymap.noWorkouts')}</p>}
      <div>
        <Suspense fallback={<div className="h-[440px] animate-pulse rounded-2xl bg-ink-surface" />}>
          <RecoveryBodyModel muscleStates={states} selectedMuscle={selected} onSelectMuscle={setSelected} text={text} />
        </Suspense>
      </div>
      {sel ? (
        <div className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="body-map-muscle">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold text-cloud">{t(muscleKey(sel.muscle))}</span>
            <span className={`text-xl font-black tabular-nums ${BAND_CLASS[bandOf(sel.recoveryPercent)]}`} dir="ltr">{sel.recoveryPercent == null ? '—' : `${Math.round(sel.recoveryPercent)}%`}</span>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-ink-elevated py-2"><dt className="text-[10px] text-cloud-dim">{t('bodymap.hoursLeft')}</dt><dd className="text-sm font-bold text-cloud">{hoursLeft == null ? '—' : t('bodymap.hoursN', { n: hoursLeft })}</dd></div>
            <div className="rounded-xl bg-ink-elevated py-2"><dt className="text-[10px] text-cloud-dim">{t('bodymap.lastTrained')}</dt><dd className="text-sm font-bold text-cloud">{sel.hoursSinceLastTrained == null ? '—' : sel.hoursSinceLastTrained < 48 ? t('bodymap.hoursAgo', { n: Math.round(sel.hoursSinceLastTrained) }) : t('bodymap.daysAgo', { n: Math.floor(sel.hoursSinceLastTrained / 24) })}</dd></div>
            <div className="rounded-xl bg-ink-elevated py-2"><dt className="text-[10px] text-cloud-dim">{t('bodymap.weekSets')}</dt><dd className="text-sm font-bold text-cloud" dir="ltr">{Math.round(sel.weeklyEffectiveSets * 10) / 10}</dd></div>
          </dl>
          {sel.recoveryPercent == null && <p className="mt-2 text-[11px] text-cloud-dim">{t('bodymap.noMuscleData')}</p>}
        </div>
      ) : (
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-cloud-dim"><Activity className="h-3.5 w-3.5 text-lime" />
          {fatigued ? t('bodymap.fatigued', { list: fatigued }) : t('bodymap.tapHint')}
        </p>
      )}
    </section>
  );
}
