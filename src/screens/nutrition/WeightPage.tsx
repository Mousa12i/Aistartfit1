import { useMemo, useState, type FormEvent } from 'react';
import { EyeOff, Trash2, Weight } from 'lucide-react';
import { kgToLbs, lbsToKg } from '@/lib/utils';
import { errorMessage } from '@/lib/nutrition/api';
import { addDays, formatShortDate, isValidDateKey } from '@/lib/nutrition/dates';
import { rateFeedback, weightRate, type TrendPoint } from '@/lib/nutrition/engine';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';
import { Citations, EmptyState, FieldLabel, Notice, Page, PageHeader, Panel, Section, Segmented, Toast, inputClass } from './ui';

type Range = 30 | 90 | 180;

export function WeightPage() {
  const n = useNutrition();
  const { params, go } = useNutritionNav();
  const imperial = n.profile?.unit_system === 'imperial';
  const unit = imperial ? 'lb' : 'kg';
  const show = (kg: number) => (imperial ? kgToLbs(kg) : Math.round(kg * 10) / 10);
  const [value, setValue] = useState('');
  const [date, setDate] = useState(n.today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(90);

  const weighIns = useMemo(() => n.weights.map((w) => ({ date: w.date, kg: w.kg })), [n.weights]);
  const rate = weightRate(weighIns, n.today, 21);
  const targets = n.targetsFor(n.today);
  const feedback = rate ? rateFeedback(targets.mode, n.settings.rate_pct, rate.pctPerWeek) : null;
  const latest = n.trend[n.trend.length - 1] ?? null;
  const trendAt = (daysAgo: number) => {
    const cutoff = addDays(n.today, -daysAgo);
    const before = n.trend.filter((p) => p.date <= cutoff);
    return before.length ? before[before.length - 1].trend : null;
  };
  const t7 = trendAt(7);
  const t30 = trendAt(30);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const raw = Number(value.replace(',', '.'));
    if (!Number.isFinite(raw) || raw <= 0) return setError('Enter your weight.');
    const kg = imperial ? lbsToKg(raw) : raw;
    if (kg < 25 || kg > 350) return setError('That weight looks out of range — please check it.');
    if (!isValidDateKey(date) || date > n.today) return setError('Choose today or an earlier date.');
    setBusy(true);
    setError(null);
    try {
      await n.addWeight(kg, date);
      setValue('');
      setToast('Weigh-in saved');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (n.noNumbers) {
    return (
      <Page>
        <PageHeader title="Weight trend" onBack={() => go('hub')} />
        <EmptyState
          icon={<EyeOff className="h-5 w-5" />}
          title="Hidden in balanced mode"
          body="Weight tracking is switched off while numbers are hidden. You can change this in Check-in & settings."
          action={
            <button type="button" onClick={() => go('check-in')} className="rounded-xl bg-ink-elevated px-4 py-2 text-xs font-semibold text-cloud">
              Open settings
            </button>
          }
        />
      </Page>
    );
  }

  const recent = [...n.weights].reverse().slice(0, 30);

  return (
    <Page>
      <PageHeader title="Weight trend" subtitle="Daily weight is noisy — the trend is what counts" onBack={() => go('hub')} />

      <Panel className="p-4">
        <form onSubmit={submit} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <div>
            <FieldLabel htmlFor="w-value">Weight ({unit})</FieldLabel>
            <input id="w-value" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={latest ? String(show(latest.kg)) : imperial ? '170' : '75'} autoFocus={params.get('add') === '1'} className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor="w-date">Date</FieldLabel>
            <input id="w-date" type="date" value={date} max={n.today} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" disabled={busy} className="h-[46px] rounded-xl bg-lime px-4 text-xs font-bold text-ink-bg disabled:opacity-50">
            {busy ? '…' : 'Save'}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-rust">{error}</p>}
        <p className="mt-2 text-[10px] text-cloud-muted">Best: first thing in the morning, after the toilet, before eating or drinking. Saved to your Progress too.</p>
      </Panel>

      {n.trend.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<Weight className="h-5 w-5" />} title="No weigh-ins yet" body="Log your weight 3–4 times a week. After two weeks you will see your trend and rate of change." />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatBox label="Trend weight" value={latest ? `${show(latest.trend)} ${unit}` : '—'} />
            <StatBox label="7-day change" value={latest && t7 != null ? signed(show(latest.trend) - show(t7), unit) : '—'} />
            <StatBox label="30-day change" value={latest && t30 != null ? signed(show(latest.trend) - show(t30), unit) : '—'} />
          </div>

          <Panel className="mt-3 p-4">
            <div className="mb-3">
              <Segmented<string>
                value={String(range)}
                onChange={(v) => setRange(Number(v) as Range)}
                options={[
                  { value: '30', label: '30 days' },
                  { value: '90', label: '90 days' },
                  { value: '180', label: '6 months' },
                ]}
              />
            </div>
            <TrendChart points={n.trend.filter((p) => p.date >= addDays(n.today, -range))} show={show} unit={unit} />
            <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-cloud-dim">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cloud-muted" /> Daily weigh-in
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-lime" /> Trend
              </span>
            </div>
          </Panel>

          {feedback && rate && (
            <div className="mt-3">
              <Notice tone={feedback.status === 'on_track' || feedback.status === 'stable' ? 'success' : 'warn'} title={`${rate.pctPerWeek > 0 ? '+' : ''}${rate.pctPerWeek.toFixed(2)}% per week over the last 3 weeks`}>
                {feedback.message}
              </Notice>
            </div>
          )}
        </>
      )}

      <Section title="Why the scale jumps around" className="mt-6">
        <Panel className="p-4">
          <p className="text-xs leading-relaxed text-cloud-dim">
            Water shifts with salt, carbohydrate, digestion, hormones and hard training, so your weight can change by a kilo overnight without any change in fat. The
            trend line smooths this out, and every recommendation in the app uses the trend over 2–3 weeks.
          </p>
          <button type="button" onClick={() => go('library', { a: 'scale' })} className="mt-2 text-[11px] font-semibold text-lime">
            Read more →
          </button>
          <Citations ids={['frie2020']} className="mt-2" />
        </Panel>
      </Section>

      {recent.length > 0 && (
        <Section title="Recent weigh-ins">
          <ul className="divide-y divide-ink-border/60 rounded-2xl border border-ink-border bg-ink-surface">
            {recent.map((w) => (
              <li key={w.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-cloud">{formatShortDate(w.date)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-cloud">
                    {show(w.kg)} {unit}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete weigh-in from ${formatShortDate(w.date)}`}
                    onClick={() => n.deleteWeight(w.id).catch((err) => setError(errorMessage(err)))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-cloud-muted hover:bg-ink-elevated hover:text-rust"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}

function signed(v: number, unit: string): string {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? '+' : ''}${r.toFixed(1)} ${unit}`;
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-surface px-3 py-3 text-center">
      <p className="text-sm font-bold tabular-nums text-cloud">{value}</p>
      <p className="mt-0.5 text-[10px] text-cloud-dim">{label}</p>
    </div>
  );
}

function TrendChart({ points, show, unit }: { points: TrendPoint[]; show: (kg: number) => number; unit: string }) {
  const W = 320;
  const H = 150;
  const pad = { l: 34, r: 8, t: 8, b: 18 };
  if (points.length < 2) {
    return <p className="py-10 text-center text-xs text-cloud-dim">Add at least two weigh-ins in this period to see a chart.</p>;
  }
  const values = points.flatMap((p) => [show(p.kg), show(p.trend)]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1) {
    min -= 0.5;
    max += 0.5;
  }
  const first = new Date(`${points[0].date}T12:00:00`).getTime();
  const last = new Date(`${points[points.length - 1].date}T12:00:00`).getTime();
  const span = Math.max(1, last - first);
  const x = (date: string) => pad.l + ((new Date(`${date}T12:00:00`).getTime() - first) / span) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(show(p.trend)).toFixed(1)}`).join(' ');
  const ticks = [max, (max + min) / 2, min];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Weight trend chart in ${unit}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#26372D" strokeDasharray="3 4" />
          <text x={pad.l - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#68766E">
            {t.toFixed(1)}
          </text>
        </g>
      ))}
      {points.map((p) => (
        <circle key={p.date} cx={x(p.date)} cy={y(show(p.kg))} r={2.4} fill="#68766E" />
      ))}
      <path d={path} fill="none" stroke="#A6FF32" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <text x={pad.l} y={H - 4} fontSize="9" fill="#68766E">
        {formatShortDate(points[0].date)}
      </text>
      <text x={W - pad.r} y={H - 4} fontSize="9" fill="#68766E" textAnchor="end">
        {formatShortDate(points[points.length - 1].date)}
      </text>
    </svg>
  );
}
