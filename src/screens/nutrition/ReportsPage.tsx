import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, Share2 } from 'lucide-react';
import { entryProfile, errorMessage } from '@/lib/nutrition/api';
import { addDays, dateKeysBetween, formatShortDate } from '@/lib/nutrition/dates';
import { GOAL_LABELS, weightRate } from '@/lib/nutrition/engine';
import { REFERENCES } from '@/lib/nutrition/evidence';
import { proteinMealsHit, summarizeDay } from '@/lib/nutrition/insights';
import { NUTRIENT_META, getAmount, sumProfiles } from '@/lib/nutrition/nutrients';
import { downloadBlob } from '@/lib/nutrition/pdf';
import { renderNutritionReport, type ReportData, type ReportDay } from '@/lib/nutrition/report';
import { kgToLbs } from '@/lib/utils';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';
import { Chip, Notice, Page, PageHeader, Panel, Skeleton, Toast, fmt } from './ui';

const RANGES = [7, 14, 30] as const;
type RangeDays = (typeof RANGES)[number];

const REPORT_REFS = ['mifflin1990', 'morton2018', 'schoenfeld2018', 'ruiz2021', 'iraki2019', 'iom2005', 'fdaDV', 'who2015'];

export function ReportsPage() {
  const n = useNutrition();
  const { go } = useNutritionNav();
  const [range, setRange] = useState<RangeDays>(7);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const to = n.today;
  const from = addDays(to, -(range - 1));
  const { days, loadRange } = n;

  useEffect(() => {
    setError(null);
    loadRange(from, to).catch((err) => setError(errorMessage(err)));
  }, [from, to, loadRange]);

  const keys = useMemo(() => dateKeysBetween(from, to), [from, to]);
  const ready = keys.every((k) => days[k]);

  const data = useMemo<ReportData | null>(() => {
    if (!ready) return null;
    const imperial = n.profile?.unit_system === 'imperial';
    const reportDays: ReportDay[] = keys.map((key) => {
      const d = days[key];
      const s = summarizeDay(key, d.entries, d.water);
      const t = n.targetsFor(key);
      return {
        date: key,
        kcal: s.total.kcal,
        protein: s.total.protein,
        carbs: s.total.carbs,
        fat: s.total.fat,
        fiber: s.total.fiber,
        sugar: s.total.sugar,
        sodium: s.total.sodiumMg,
        waterMl: s.waterMl,
        entries: s.entryCount,
        kcalTarget: t.kcal,
        proteinTarget: t.protein,
        training: n.isTrainingDay(key),
        mealsLogged: Object.keys(s.slotKcal).length,
        proteinMeals: proteinMealsHit(s, Math.max(15, t.proteinPerMeal.low)),
      };
    });
    const entries = keys.flatMap((k) => days[k].entries);
    const loggedDays = reportDays.filter((d) => d.entries > 0).length || 1;
    const summed = sumProfiles(entries.map(entryProfile));
    const targets = n.targetsFor(to);

    const nutrients = NUTRIENT_META.filter((m) => m.group !== 'energy' && m.key !== 'protein' && m.key !== 'carbs' && m.key !== 'fat')
      .map((m) => {
        const total = getAmount(summed.total, m.key);
        const coverage = summed.coverage[m.key] ?? 0;
        if (total == null || coverage === 0) return null;
        const value = total / loggedDays;
        const ref = m.key === 'fiber' ? targets.fiber : m.key === 'satFat' ? targets.satFatMax : m.dv ?? null;
        return { label: m.label, value, unit: m.unit, decimals: m.decimals, pct: ref ? (value / ref) * 100 : null, coverage, limit: !!m.limit };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    const foods = new Map<string, { name: string; count: number; kcal: number; protein: number }>();
    for (const e of entries) {
      const key = e.name.toLowerCase();
      const f = foods.get(key) ?? { name: e.name, count: 0, kcal: 0, protein: 0 };
      f.count++;
      f.kcal += e.kcal;
      f.protein += e.protein;
      foods.set(key, f);
    }
    const topFoods = [...foods.values()].sort((a, b) => b.count - a.count || b.kcal - a.kcal).slice(0, 8);

    const inRange = n.trend.filter((p) => p.date >= from && p.date <= to);
    const unitConv = (kg: number) => (imperial ? kgToLbs(kg) : Math.round(kg * 10) / 10);
    const rate = weightRate(n.weights.map((w) => ({ date: w.date, kg: w.kg })), to, Math.min(range, 21));

    return {
      userName: n.profile?.display_name ?? '',
      from,
      to,
      generatedAt: new Date(),
      noNumbers: n.noNumbers,
      goalLabel: GOAL_LABELS[targets.mode],
      targets: {
        kcal: targets.kcal,
        protein: targets.protein,
        carbs: targets.carbs,
        fat: targets.fat,
        fiber: targets.fiber,
        waterMl: targets.waterMl,
        maintenance: targets.maintenance,
        maintenanceSource: targets.maintenanceSource,
      },
      days: reportDays,
      weight: n.noNumbers
        ? null
        : {
            start: inRange.length ? unitConv(inRange[0].trend) : null,
            end: inRange.length ? unitConv(inRange[inRange.length - 1].trend) : null,
            pctPerWeek: rate?.pctPerWeek ?? null,
            unit: imperial ? 'lb' : 'kg',
          },
      topFoods,
      nutrients,
      insights: periodInsights(reportDays, targets.fiber, n.noNumbers),
      references: REPORT_REFS.map((id) => `${REFERENCES[id].citation} ${REFERENCES[id].url}`),
    };
  }, [ready, keys, days, n, from, to, range]);

  const make = async (mode: 'download' | 'share') => {
    if (!data) return;
    setBusy(mode);
    setError(null);
    try {
      const blob = await renderNutritionReport(data);
      const filename = `startfit-nutrition-${from}-to-${to}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'StartFit nutrition report' });
      } else {
        downloadBlob(blob, filename);
        setToast('Report downloaded');
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') setError(errorMessage(err, 'Could not create the PDF.'));
    } finally {
      setBusy(null);
    }
  };

  const logged = data?.days.filter((d) => d.entries > 0) ?? [];
  const avg = (pick: (d: ReportDay) => number) => (logged.length ? logged.reduce((s, d) => s + pick(d), 0) / logged.length : 0);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <Page>
      <PageHeader title="Reports" subtitle="A detailed PDF for you, your coach or your doctor" onBack={() => go('hub')} />
      <div className="mb-4 flex gap-2">
        {RANGES.map((r) => (
          <Chip key={r} active={range === r} onClick={() => setRange(r)}>
            Last {r} days
          </Chip>
        ))}
      </div>
      {error && (
        <div className="mb-3">
          <Notice tone="warn">{error}</Notice>
        </div>
      )}
      {!data ? (
        <Skeleton className="h-56 rounded-2xl" />
      ) : (
        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/15 text-lime">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-cloud">Nutrition report</p>
              <p className="text-xs text-cloud-dim">
                {formatShortDate(from)} – {formatShortDate(to)} · {logged.length} of {data.days.length} days logged
              </p>
            </div>
          </div>
          {!n.noNumbers && logged.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Mini label="avg kcal" value={fmt(avg((d) => d.kcal))} />
              <Mini label="avg protein" value={`${fmt(avg((d) => d.protein))} g`} />
              <Mini label="on target ±10%" value={`${logged.filter((d) => Math.abs(d.kcal - d.kcalTarget) <= d.kcalTarget * 0.1).length} days`} />
            </div>
          )}
          <ul className="mt-4 space-y-1.5 text-xs text-cloud-dim">
            <li>• Summary cards and a day-by-day chart</li>
            <li>• Full daily table{n.noNumbers ? ' (meals, protein at meals, water)' : ' with macros, fibre, sugars, sodium and water'}</li>
            {!n.noNumbers && <li>• Vitamins and minerals against Daily Values</li>}
            <li>• Most logged foods, what stood out, and the sources behind every target</li>
          </ul>
          {logged.length === 0 && <p className="mt-3 text-xs text-gold">No food logged in this period yet — the report will be mostly empty.</p>}
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => make('download')} disabled={!!busy} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-lime text-sm font-bold text-ink-bg disabled:opacity-50">
              {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
            </button>
            {canShare && (
              <button type="button" onClick={() => make('share')} disabled={!!busy} aria-label="Share PDF" className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-elevated text-cloud disabled:opacity-50">
                {busy === 'share' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              </button>
            )}
          </div>
        </Panel>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-bg/60 px-2 py-2.5">
      <p className="text-sm font-bold tabular-nums text-cloud">{value}</p>
      <p className="text-[10px] text-cloud-dim">{label}</p>
    </div>
  );
}

function periodInsights(days: ReportDay[], fiberTarget: number, noNumbers: boolean): { title: string; body: string }[] {
  const logged = days.filter((d) => d.entries > 0);
  const out: { title: string; body: string }[] = [];
  if (!logged.length) return out;
  out.push({
    title: 'Logging consistency',
    body: `Food was logged on ${logged.length} of ${days.length} days. ${logged.length / days.length >= 0.8 ? 'That is enough data for reliable averages.' : 'Logging most days makes averages and adaptive targets more reliable.'}`,
  });
  const proteinMeals = logged.reduce((s, d) => s + d.proteinMeals, 0) / logged.length;
  out.push({
    title: 'Protein through the day',
    body: `On average ${proteinMeals.toFixed(1)} meals a day had a substantial protein portion. Three to four is a good pattern for most people who train.`,
  });
  if (!noNumbers) {
    const onProtein = logged.filter((d) => d.protein >= d.proteinTarget * 0.9).length;
    out.push({ title: 'Protein target', body: `Reached (within 10%) on ${onProtein} of ${logged.length} logged days.` });
    const fiberDays = logged.filter((d) => d.fiber != null);
    if (fiberDays.length >= 3) {
      const avgFiber = fiberDays.reduce((s, d) => s + (d.fiber ?? 0), 0) / fiberDays.length;
      out.push({ title: 'Fibre', body: `Average ${Math.round(avgFiber)} g a day against a target of ${fiberTarget} g (14 g per 1,000 kcal).` });
    }
    const sodiumDays = logged.filter((d) => d.sodium != null && d.sodium > 2300).length;
    if (sodiumDays > 0) out.push({ title: 'Sodium', body: `Above the 2,300 mg Daily Value on ${sodiumDays} day${sodiumDays === 1 ? '' : 's'} (where sodium data was available).` });
  }
  const training = days.filter((d) => d.training).length;
  if (training) out.push({ title: 'Training days', body: `${training} training day${training === 1 ? '' : 's'} in this period. Meals with carbohydrate and protein 2–3 hours either side of sessions support performance and recovery.` });
  return out;
}
