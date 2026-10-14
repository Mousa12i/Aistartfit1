import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { entryProfile, errorMessage } from '@/lib/nutrition/api';
import { addDays, formatDayLabel, isValidDateKey } from '@/lib/nutrition/dates';
import { GROUP_LABELS, NUTRIENT_META, getAmount, sumProfiles, type NutrientGroup, type NutrientKey, type NutrientProfile } from '@/lib/nutrition/nutrients';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';
import { Citations, MACRO_COLORS, Notice, Page, PageHeader, Panel, ProgressBar, Segmented, Skeleton, fmt } from './ui';

type View = 'day' | 'week';

export function NutrientsPage() {
  const n = useNutrition();
  const { params, go, replace } = useNutritionNav();
  const date = isValidDateKey(params.get('date')) ? (params.get('date') as string) : n.today;
  const [view, setView] = useState<View>('day');
  const [error, setError] = useState<string | null>(null);
  const weekStart = addDays(date, -6);
  const { days, loadRange } = n;

  useEffect(() => {
    loadRange(view === 'week' ? weekStart : date, date).catch((err) => setError(errorMessage(err)));
  }, [view, weekStart, date, loadRange]);

  const targets = n.targetsFor(date);

  const result = useMemo(() => {
    const keys = view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [date];
    if (keys.some((k) => !days[k])) return null;
    const loggedDays = keys.filter((k) => days[k].entries.length > 0);
    const entries = keys.flatMap((k) => days[k].entries);
    const summed = sumProfiles(entries.map(entryProfile));
    const divisor = view === 'week' ? Math.max(1, loggedDays.length) : 1;
    const avg: NutrientProfile = {
      kcal: summed.total.kcal / divisor,
      protein: summed.total.protein / divisor,
      carbs: summed.total.carbs / divisor,
      fat: summed.total.fat / divisor,
      sugar: summed.total.sugar == null ? null : summed.total.sugar / divisor,
      fiber: summed.total.fiber == null ? null : summed.total.fiber / divisor,
      satFat: summed.total.satFat == null ? null : summed.total.satFat / divisor,
      sodiumMg: summed.total.sodiumMg == null ? null : summed.total.sodiumMg / divisor,
      micros: Object.fromEntries(Object.entries(summed.total.micros).map(([k, v]) => [k, (v ?? 0) / divisor])),
    };
    return { profile: avg, coverage: summed.coverage, loggedDays: loggedDays.length, entryCount: entries.length };
  }, [days, view, weekStart, date]);

  const personalTarget = (key: NutrientKey): { value: number; label: string; limit?: boolean } | null => {
    switch (key) {
      case 'kcal':
        return { value: targets.kcal, label: 'your target' };
      case 'protein':
        return { value: targets.protein, label: 'your target' };
      case 'carbs':
        return { value: targets.carbs, label: 'your target' };
      case 'fat':
        return { value: targets.fat, label: 'your target' };
      case 'fiber':
        return { value: targets.fiber, label: '14 g / 1,000 kcal' };
      case 'satFat':
        return { value: targets.satFatMax, label: 'limit: 10% of kcal', limit: true };
      default: {
        const meta = NUTRIENT_META.find((m) => m.key === key);
        return meta?.dv ? { value: meta.dv, label: 'Daily Value', limit: meta.limit } : null;
      }
    }
  };

  const groups = (Object.keys(GROUP_LABELS) as NutrientGroup[]).map((g) => ({ group: g, items: NUTRIENT_META.filter((m) => m.group === g) }));

  return (
    <Page>
      <PageHeader title="Nutrients" subtitle={view === 'week' ? `7 days to ${formatDayLabel(date, n.today).toLowerCase()}` : formatDayLabel(date, n.today)} onBack={() => go('hub')} />

      <div className="mb-3 flex items-center gap-2">
        <button type="button" aria-label="Previous day" onClick={() => replace('nutrients', { date: addDays(date, -1) })} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: '7-day average' },
            ]}
          />
        </div>
        <button
          type="button"
          aria-label="Next day"
          disabled={date >= n.today}
          onClick={() => replace('nutrients', { date: addDays(date, 1) === n.today ? null : addDays(date, 1) })}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="mb-3">
          <Notice tone="warn">{error}</Notice>
        </div>
      )}

      {!result ? (
        <div className="space-y-3">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : result.entryCount === 0 ? (
        <Notice tone="info" title="Nothing logged">
          Log some food to see your full nutrient breakdown.
        </Notice>
      ) : (
        <>
          {view === 'week' && <p className="mb-3 text-[11px] text-cloud-dim">Averaged over {result.loggedDays} logged day{result.loggedDays === 1 ? '' : 's'} (days with no entries are skipped).</p>}
          <div className="space-y-4">
            {groups.map(({ group, items }) => {
              const rows = items.filter((m) => {
                if (group === 'energy' || group === 'macros' || m.key === 'fat') return true;
                return (result.coverage[m.key] ?? 0) > 0;
              });
              if (!rows.length) return null;
              return (
                <Panel key={group} className="p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-cloud-dim">{GROUP_LABELS[group]}</p>
                  <div className="space-y-3">
                    {rows.map((m) => {
                      const amount = getAmount(result.profile, m.key);
                      const coverage = result.coverage[m.key] ?? 0;
                      const target = personalTarget(m.key);
                      const pct = target && amount != null ? (amount / target.value) * 100 : null;
                      const over = !!target?.limit && pct != null && pct > 100;
                      const color = over ? MACRO_COLORS.over : m.key === 'protein' ? MACRO_COLORS.protein : m.key === 'carbs' ? MACRO_COLORS.carbs : m.key === 'fat' ? MACRO_COLORS.fat : '#7ADFA9';
                      return (
                        <div key={m.key}>
                          <div className="mb-1 flex items-baseline justify-between gap-2">
                            <span className="text-xs text-cloud">{m.label}</span>
                            <span className="text-[11px] tabular-nums text-cloud-dim">
                              <b className={cn('text-cloud', over && 'text-rust')}>
                                {fmt(amount, m.decimals)} {m.unit}
                              </b>
                              {target && pct != null && (
                                <>
                                  {' '}
                                  · {fmt(pct)}% <span className="text-cloud-muted">of {target.label}</span>
                                </>
                              )}
                            </span>
                          </div>
                          {target && <ProgressBar value={amount ?? 0} max={target.value} color={color} />}
                          {coverage < 0.95 && coverage > 0 && (
                            <p className="mt-0.5 text-[10px] text-cloud-muted">Based on {Math.round(coverage * 100)}% of logged food — the rest had no data for this nutrient.</p>
                          )}
                          {coverage === 0 && m.group === 'macros' && m.key !== 'protein' && m.key !== 'carbs' && (
                            <p className="mt-0.5 text-[10px] text-cloud-muted">No data from the foods logged.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              );
            })}
            {(() => {
              const missing = NUTRIENT_META.filter((m) => m.group !== 'energy' && m.group !== 'macros' && m.key !== 'fat' && !((result.coverage[m.key] ?? 0) > 0));
              if (!missing.length) return null;
              return (
                <Panel className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-cloud-dim">No data in the foods logged</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-cloud-dim">{missing.map((m) => m.label).join(' · ')}</p>
                  <p className="mt-2 text-[10px] leading-relaxed text-cloud-muted">
                    Shown as unknown rather than zero. Built-in common foods and USDA results carry the most nutrients; label, recipe and quick-add entries
                    often list only the basics.
                  </p>
                </Panel>
              );
            })()}
          </div>
        </>
      )}

      <div className="mt-5 space-y-2 rounded-2xl border border-ink-border bg-ink-surface p-4">
        <p className="text-xs font-semibold text-cloud">About these numbers</p>
        <p className="text-[11px] leading-relaxed text-cloud-dim">
          Calories, macros and fibre are compared with your personal targets. Vitamins and minerals use the FDA Daily Values for adults — a labelling reference, not
          a personal requirement. Foods from USDA include the most nutrients; quick-add and many label foods only include macros, so totals can be incomplete.
        </p>
        <Citations ids={['fdaDV', 'iom2005', 'who2015', 'usdaFdc']} />
      </div>
    </Page>
  );
}
