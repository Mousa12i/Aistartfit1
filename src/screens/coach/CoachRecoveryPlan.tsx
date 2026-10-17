import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BatteryCharging, ChevronDown, ChevronLeft, ChevronUp, Footprints, Loader2, Moon, PenLine, Plus, StretchHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { fetchRoster } from '@/lib/coach/api';
import type { RosterRow } from '@/lib/coach/insights';
import { LIMITS, addDays, shortDate, weekdayNames, loadRecoveryPlan, newId, planErrors, saveRecoveryPlan, type MobilityItem, type RecoveryPlan } from '@/lib/coach/recovery-plan';
import { localDateKey } from '@/lib/recovery/store';
import { ExercisePicker } from './CoachPrograms';

const field = 'w-full rounded-xl border border-ink-border bg-ink-bg px-3 py-2 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none';
const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));

/** Monday-first order for the day pickers. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function DayPicker({ value, set, names, testId }: { value: number[]; set: (v: number[]) => void; names: string[]; testId?: string }) {
  return (
    <div className="grid grid-cols-7 gap-1" data-testid={testId}>
      {ORDER.map((d) => {
        const on = value.includes(d);
        return (
          <button key={d} type="button" aria-pressed={on} onClick={() => set(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            className={cn('rounded-lg border py-2 text-[11px] font-semibold', on ? 'border-lime bg-lime/15 text-cloud' : 'border-ink-border text-cloud-dim')}>{names[d]}</button>
        );
      })}
    </div>
  );
}

const MOBILITY_PRESETS: { key: MessageKey; dose: string }[] = [
  { key: 'recplan.presetHip', dose: '2 × 30 s' },
  { key: 'recplan.presetTspine', dose: '2 × 8' },
  { key: 'recplan.presetAnkle', dose: '2 × 10' },
  { key: 'recplan.presetShoulder', dose: '2 × 10' },
  { key: 'recplan.presetHamstring', dose: '2 × 30 s' },
  { key: 'recplan.presetWalk', dose: '10 min' },
];

/** /coach/athlete/:id/recovery-plan — the coach sets the athlete's recovery plan. */
export function CoachRecoveryPlan() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, dir, lang } = useI18n();
  const names = useMemo(() => weekdayNames(lang), [lang]);
  const [row, setRow] = useState<RosterRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sleep, setSleep] = useState('');
  const [steps, setSteps] = useState('');
  const [restDays, setRestDays] = useState<number[]>([]);
  const [mobility, setMobility] = useState<MobilityItem[]>([]);
  const [mobilityDays, setMobilityDays] = useState<number[]>([]);
  const [deloadOn, setDeloadOn] = useState(false);
  const [deloadStart, setDeloadStart] = useState('');
  const [deloadDays, setDeloadDays] = useState(7);
  const [deloadPct, setDeloadPct] = useState(50);
  const [deloadNote, setDeloadNote] = useState('');
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const today = localDateKey(new Date());

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchRoster();
        setRow(r.find((x) => x.athlete_id === id) ?? null);
        const p = await loadRecoveryPlan(id);
        if (p) {
          setSleep(p.sleep_hours != null ? String(p.sleep_hours) : '');
          setSteps(p.steps != null ? String(p.steps) : '');
          setRestDays(p.rest_days); setMobility(p.mobility); setMobilityDays(p.mobility_days);
          setDeloadOn(!!p.deload_start);
          if (p.deload_start) setDeloadStart(p.deload_start);
          if (p.deload_days) setDeloadDays(p.deload_days);
          if (p.deload_set_pct) setDeloadPct(p.deload_set_pct);
          setDeloadNote(p.deload_note ?? ''); setNotes(p.notes ?? '');
        }
      } catch { /* shown as empty */ }
      setLoaded(true);
    })();
  }, [id]);

  const plan: RecoveryPlan = {
    coach_id: user?.id ?? '', athlete_id: id,
    sleep_hours: Number.isFinite(num(sleep)) ? Math.round(num(sleep) * 10) / 10 : null,
    steps: Number.isFinite(num(steps)) ? Math.round(num(steps)) : null,
    rest_days: restDays, mobility: mobility.map((m) => ({ ...m, name: m.name.trim(), dose: m.dose.trim() })).filter((m) => m.name), mobility_days: mobilityDays,
    deload_start: deloadOn && deloadStart ? deloadStart : null,
    deload_days: deloadOn ? deloadDays : null, deload_set_pct: deloadOn ? deloadPct : null,
    deload_note: deloadOn && deloadNote.trim() ? deloadNote.trim() : null,
    notes: notes.trim() || null,
  };
  const errs = planErrors(plan);
  const deloadMissing = deloadOn && !deloadStart;

  const save = async () => {
    if (errs.length || deloadMissing) return;
    setBusy(true); setMsg(null);
    try { await saveRecoveryPlan(plan); setMsg({ ok: true, text: t('recplan.saved') }); }
    catch { setMsg({ ok: false, text: t('coach.saveError') }); }
    finally { setBusy(false); }
  };

  const upd = (mid: string, patch: Partial<MobilityItem>) => setMobility((ms) => ms.map((m) => (m.id === mid ? { ...m, ...patch } : m)));
  const move = (i: number, by: number) => setMobility((ms) => {
    const j = i + by;
    if (j < 0 || j >= ms.length) return ms;
    const next = [...ms];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const addItem = (item: Omit<MobilityItem, 'id'>) => setMobility((ms) => (ms.length >= LIMITS.mobility ? ms : [...ms, { ...item, id: newId() }]));

  if (!loaded) return <div className="min-h-screen bg-ink-bg" />;

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-32 pt-5" dir={dir} data-testid="recovery-plan-editor">
      <header className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(`/coach/athlete/${id}?tab=training`)} aria-label={t('common.back')} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-cloud-dim" dir="auto">{row?.display_name ?? ''}</div>
          <h1 className="truncate text-xl font-bold text-cloud">{t('recplan.title')}</h1>
        </div>
      </header>

      {/* Daily targets */}
      <section className="mb-4 rounded-2xl border border-ink-border bg-ink-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-cloud">{t('recplan.daily')}</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[11px] text-cloud-dim"><span className="flex items-center gap-1"><Moon className="h-3.5 w-3.5 text-sky" />{t('recplan.sleepHours')}</span>
            <input value={sleep} onChange={(e) => setSleep(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 4))} inputMode="decimal" dir="ltr" placeholder="8" data-testid="rp-sleep"
              className={cn('mt-1 w-full rounded-lg border bg-ink-bg px-2 py-2 text-center text-sm text-cloud', errs.includes('sleep') ? 'border-rust' : 'border-ink-border')} />
          </label>
          <label className="block text-[11px] text-cloud-dim"><span className="flex items-center gap-1"><Footprints className="h-3.5 w-3.5 text-lime" />{t('recplan.steps')}</span>
            <input value={steps} onChange={(e) => setSteps(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} inputMode="numeric" dir="ltr" placeholder="8000" data-testid="rp-steps"
              className={cn('mt-1 w-full rounded-lg border bg-ink-bg px-2 py-2 text-center text-sm text-cloud', errs.includes('steps') ? 'border-rust' : 'border-ink-border')} />
          </label>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-cloud-muted">{t('recplan.sleepHint')}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-cloud-muted">{t('recplan.stepsHint')}</p>
        {(errs.includes('sleep') || errs.includes('steps')) && <p className="mt-1 text-[11px] text-rust">{t('recplan.rangeError', { s1: LIMITS.sleep[0], s2: LIMITS.sleep[1], p1: LIMITS.steps[0], p2: LIMITS.steps[1] })}</p>}
      </section>

      {/* Rest days */}
      <section className="mb-4 rounded-2xl border border-ink-border bg-ink-surface p-4">
        <h2 className="mb-1 text-sm font-bold text-cloud">{t('recplan.restDays')}</h2>
        <p className="mb-3 text-[11px] text-cloud-dim">{t('recplan.restDaysHelp')}</p>
        <DayPicker value={restDays} set={setRestDays} names={names} testId="rp-rest-days" />
      </section>

      {/* Mobility */}
      <section className="mb-4 rounded-2xl border border-ink-border bg-ink-surface p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-cloud"><StretchHorizontal className="h-4 w-4 text-lime" />{t('recplan.mobility')}</h2>
        <p className="mb-3 text-[11px] text-cloud-dim">{t('recplan.mobilityHelp')}</p>
        <ul className="space-y-2">
          {mobility.map((m, i) => (
            <li key={m.id} className="rounded-xl border border-ink-border bg-ink-bg p-2.5" data-testid="rp-mobility-item">
              <div className="flex items-center gap-2">
                <input value={m.name} onChange={(e) => upd(m.id, { name: e.target.value.slice(0, 80) })} dir="auto" placeholder={t('recplan.itemName')} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-cloud focus:outline-none" />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('recplan.moveUp')} className="p-1 text-cloud-dim disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === mobility.length - 1} aria-label={t('recplan.moveDown')} className="p-1 text-cloud-dim disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => setMobility((ms) => ms.filter((x) => x.id !== m.id))} aria-label={t('recplan.remove')} className="p-1 text-rust"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 grid grid-cols-[7rem_1fr] gap-2">
                <input value={m.dose} onChange={(e) => upd(m.id, { dose: e.target.value.slice(0, 30) })} dir="ltr" placeholder="2 × 30 s" aria-label={t('recplan.dose')} className="rounded-lg border border-ink-border bg-ink-surface px-2 py-1.5 text-center text-xs text-cloud" />
                <input value={m.note ?? ''} onChange={(e) => upd(m.id, { note: e.target.value.slice(0, 160) })} dir="auto" placeholder={t('recplan.itemNote')} className="rounded-lg border border-ink-border bg-ink-surface px-2 py-1.5 text-xs text-cloud placeholder:text-cloud-muted" />
              </div>
            </li>
          ))}
        </ul>
        {mobility.length < LIMITS.mobility && (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setPicker(true)} className="flex items-center gap-1 rounded-full bg-lime px-3 py-1.5 text-xs font-bold text-ink-bg" data-testid="rp-add-library"><Plus className="h-3 w-3" />{t('recplan.fromLibrary')}</button>
              <button type="button" onClick={() => addItem({ exercise_id: null, name: '', dose: '' })} className="flex items-center gap-1 rounded-full border border-ink-border px-3 py-1.5 text-xs text-cloud-dim" data-testid="rp-add-custom"><PenLine className="h-3 w-3" />{t('recplan.custom')}</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MOBILITY_PRESETS.map((p) => (
                <button key={p.key} type="button" onClick={() => addItem({ exercise_id: null, name: t(p.key), dose: p.dose })} data-testid="rp-preset"
                  className="flex items-center gap-1 rounded-full border border-dashed border-ink-border px-3 py-1.5 text-xs text-lime"><Plus className="h-3 w-3" />{t(p.key)}</button>
              ))}
            </div>
          </>
        )}
        {mobility.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[11px] text-cloud-dim">{t('recplan.mobilityDays')}</div>
            <DayPicker value={mobilityDays} set={setMobilityDays} names={names} testId="rp-mobility-days" />
          </div>
        )}
      </section>

      {/* Deload */}
      <section className="mb-4 rounded-2xl border border-ink-border bg-ink-surface p-4">
        <button type="button" role="switch" aria-checked={deloadOn} data-testid="rp-deload-toggle"
          onClick={() => { const on = !deloadOn; setDeloadOn(on); if (on && !deloadStart) setDeloadStart(addDays(today, 7)); }}
          className="flex w-full items-center justify-between gap-3 text-start">
          <span className="flex items-center gap-2 text-sm font-bold text-cloud"><BatteryCharging className="h-4 w-4 text-gold" />{t('recplan.deload')}</span>
          <span className={cn('flex h-6 w-10 flex-shrink-0 items-center rounded-full p-0.5', deloadOn ? 'bg-lime' : 'bg-ink-elevated')}><span className={cn('h-5 w-5 rounded-full bg-white transition-transform', deloadOn && 'translate-x-4 rtl:-translate-x-4')} /></span>
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-cloud-dim">{t('recplan.deloadHelp')}</p>
        {deloadOn && (
          <div className="mt-3 space-y-3">
            <label className="block text-[11px] text-cloud-dim">{t('recplan.deloadStart')}
              <input type="date" value={deloadStart} min={today} onChange={(e) => setDeloadStart(e.target.value)} dir="ltr" data-testid="rp-deload-start" className={cn(field, 'mt-1')} />
            </label>
            <div>
              <div className="mb-1 text-[11px] text-cloud-dim">{t('recplan.deloadLength')}</div>
              <div className="flex flex-wrap gap-1.5">
                {[4, 5, 7, 10, 14].map((d) => (
                  <button key={d} type="button" onClick={() => setDeloadDays(d)} aria-pressed={deloadDays === d}
                    className={cn('rounded-full border px-3 py-1.5 text-xs', deloadDays === d ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')}>{t(d > 10 ? 'recplan.daysMany' : 'recplan.days', { n: d })}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-cloud-dim"><span>{t('recplan.deloadSets')}</span><span className="font-bold text-cloud" dir="ltr" data-testid="rp-pct">{deloadPct}%</span></div>
              <input type="range" min={LIMITS.setPct[0]} max={LIMITS.setPct[1]} step={10} value={deloadPct} onChange={(e) => setDeloadPct(Number(e.target.value))} className="w-full accent-lime" dir="ltr" aria-label={t('recplan.deloadSets')} data-testid="rp-pct-range" />
              <p className="mt-1 text-[11px] text-cloud-dim">{t('recplan.deloadExample', { pct: deloadPct, n: Math.max(1, Math.ceil((4 * deloadPct) / 100)) })}</p>
            </div>
            <label className="block text-[11px] text-cloud-dim">{t('recplan.deloadNote')}
              <textarea value={deloadNote} onChange={(e) => setDeloadNote(e.target.value.slice(0, 500))} rows={2} dir="auto" placeholder={t('recplan.deloadNotePh')} className={cn(field, 'mt-1')} />
            </label>
            {deloadStart && <p className="text-[11px] text-cloud-dim" dir="auto">{t('recplan.deloadRange', { start: shortDate(deloadStart, lang), end: shortDate(addDays(deloadStart, deloadDays - 1), lang) })}</p>}
          </div>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-cloud-muted">{t('recplan.deloadSource')}</p>
      </section>

      <section className="mb-4 rounded-2xl border border-ink-border bg-ink-surface p-4">
        <label className="block"><span className="mb-1 block text-sm font-bold text-cloud">{t('recplan.notes')}</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 1500))} rows={3} dir="auto" placeholder={t('recplan.notesPh')} className={field} data-testid="rp-notes" />
        </label>
        <p className="mt-2 text-[10px] leading-relaxed text-cloud-muted">{t('recplan.scopeNote')}</p>
      </section>

      {msg && <p className={cn('mb-2 text-center text-xs', msg.ok ? 'text-lime' : 'text-rust')} data-testid="rp-msg">{msg.text}</p>}
      <div className="sticky bottom-3 z-30">
        <button type="button" onClick={save} disabled={busy || errs.length > 0 || deloadMissing} data-testid="rp-save"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lime text-sm font-bold text-ink-bg shadow-lg shadow-black/40 disabled:opacity-40">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t('recplan.save')}
        </button>
      </div>

      {picker && <ExercisePicker t={t} title={t('recplan.fromLibrary')} onClose={() => setPicker(false)} onPick={(ex) => { addItem({ exercise_id: ex.id, name: ex.name, dose: '2 × 10' }); setPicker(false); }} />}
    </div>
  );
}
