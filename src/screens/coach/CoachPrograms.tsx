import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Copy, Layers, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { assignPlan, coachErrorKey, fetchRoster } from '@/lib/coach/api';
import type { RosterRow } from '@/lib/coach/insights';
import {
  addRoutineRow, copyRoutine, createCoachRoutine, deleteCoachRoutine, deleteRoutineRow, listCoachRoutines, readRoutine, searchExercises,
  updateRoutineMeta, updateRoutineRow, type ExerciseHit, type RoutineFull, type RoutineRow, type RoutineSummary,
} from '@/lib/coach/routines';
import type { MessageKey } from '@/lib/i18n';
import { Avatar, Sheet } from './ui';

const field = 'w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-2.5 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none';

/** /coach/programs: the coach's routine library and StartFit's ready-made routines. */
export function CoachPrograms() {
  const navigate = useNavigate();
  const { t, dir } = useI18n();
  const [data, setData] = useState<{ mine: RoutineSummary[]; ready: RoutineSummary[] } | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);

  useEffect(() => { listCoachRoutines().then(setData).catch(() => setError(true)); }, []);

  const create = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    try { navigate(`/coach/programs/${await createCoachRoutine(name, days)}`); } catch { setError(true); setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-10 pt-5" dir={dir} data-testid="coach-programs">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold text-cloud">{t('coach.programsTitle')}</h1>
        <button type="button" onClick={() => setCreating(true)} className="flex h-10 items-center gap-1.5 rounded-xl bg-lime px-3.5 text-sm font-bold text-ink-bg" data-testid="new-routine">
          <Plus className="h-4 w-4" />{t('coach.newRoutine')}
        </button>
      </div>
      <p className="mb-5 text-xs leading-relaxed text-cloud-dim">{t('coach.programsIntro')}</p>
      {error && <p className="mb-3 rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">{t('coach.loadError')}</p>}
      {!data && !error && <div className="h-40 animate-pulse rounded-2xl bg-ink-surface" />}

      {data && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-cloud">{t('coach.myRoutines')} <span className="text-cloud-muted">{data.mine.length}</span></h2>
          {data.mine.length === 0 ? (
            <button type="button" onClick={() => setCreating(true)} className="mb-6 w-full rounded-2xl border border-dashed border-ink-border px-4 py-6 text-center text-sm text-cloud-dim">{t('coach.noRoutines')}</button>
          ) : (
            <RoutineList items={data.mine} onOpen={(id) => navigate(`/coach/programs/${id}`)} t={t} />
          )}
          <h2 className="mb-2 mt-6 text-sm font-semibold text-cloud">{t('coach.readyRoutines')}</h2>
          <RoutineList items={data.ready} onOpen={(id) => navigate(`/coach/programs/${id}`)} t={t} />
        </>
      )}

      <Sheet open={creating} title={t('coach.newRoutine')} onClose={() => setCreating(false)}>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('coach.newRoutinePh')} maxLength={120} dir="auto" data-testid="new-routine-name" />
        <div className="mb-1.5 mt-4 text-xs text-cloud-dim">{t('coach.sessionsPerWeekLabel')}</div>
        <div className="flex gap-1.5">
          {[2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" onClick={() => setDays(n)} className={cn('flex-1 rounded-xl border py-2.5 text-sm font-semibold', days === n ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')} dir="ltr">{n}</button>
          ))}
        </div>
        <button type="button" onClick={create} disabled={busy || name.trim().length < 2} className="mt-5 w-full rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg disabled:opacity-40" data-testid="new-routine-create">{t('coach.create')}</button>
      </Sheet>
    </div>
  );
}

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

function RoutineList({ items, onOpen, t }: { items: RoutineSummary[]; onOpen: (id: string) => void; t: T }) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-ink-border bg-ink-surface">
      {items.map((r, i) => (
        <li key={r.id} className={cn(i > 0 && 'border-t border-ink-border')}>
          <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-start hover:bg-ink-elevated/50" data-testid="routine-row">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-lime/10"><Layers className="h-4 w-4 text-lime" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-cloud" dir="auto">{r.name}</span>
              {r.sessions_per_week != null && <span className="block text-[11px] text-cloud-dim">{t('coach.sessionsPerWeek', { n: r.sessions_per_week })}</span>}
            </span>
            <ChevronRight className="h-4 w-4 text-cloud-muted rtl:rotate-180" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** /coach/programs/:id — edit one of the coach's routines (or view a ready-made one), and give it to athletes. */
export function CoachRoutineEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { t, dir } = useI18n();
  const [plan, setPlan] = useState<RoutineFull | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [extraDays, setExtraDays] = useState(0);
  const [giveOpen, setGiveOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try { setPlan(await readRoutine(id)); } catch { setPlan(null); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (plan === undefined) return <div className="min-h-screen bg-ink-bg" />;
  if (plan === null) return <div className="min-h-screen bg-ink-bg p-6 text-sm text-cloud-dim" dir={dir}>{t('coach.loadError')}</div>;

  const dayIndexes = [...new Set(plan.rows.map((r) => r.day_index))].sort((a, b) => a - b);
  const lastDay = dayIndexes.length ? dayIndexes[dayIndexes.length - 1] : -1;
  const allDays = [...dayIndexes, ...Array.from({ length: extraDays }, (_, k) => lastDay + 1 + k)];
  if (!allDays.length) allDays.push(0);
  const editable = plan.mine;

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); await load(); } catch { setError(t('coach.saveError')); }
  };

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-28 pt-5" dir={dir} data-testid="routine-editor">
      <header className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate('/coach/programs')} aria-label={t('common.back')} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></button>
        {editable ? (
          <input defaultValue={plan.name} onBlur={(e) => e.target.value.trim() && e.target.value !== plan.name && run(() => updateRoutineMeta(plan.id, { name: e.target.value }))}
            className="min-w-0 flex-1 rounded-xl bg-transparent px-1 py-1 text-xl font-bold text-cloud focus:bg-ink-surface focus:outline-none" dir="auto" data-testid="routine-name" />
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-cloud" dir="auto">{plan.name}</h1>
        )}
      </header>

      {!editable && (
        <div className="mb-4 rounded-2xl border border-ink-border bg-ink-surface p-4 text-xs leading-relaxed text-cloud-dim">
          {t('coach.readyNote')}
          <button type="button" onClick={async () => { try { navigate(`/coach/programs/${await copyRoutine(plan.id)}`, { replace: true }); } catch { setError(t('coach.saveError')); } }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-lime/40 py-2.5 text-sm font-semibold text-lime" data-testid="copy-routine">
            <Copy className="h-4 w-4" />{t('coach.copyToMine')}
          </button>
        </div>
      )}

      {editable && (
        <div className="mb-4 flex items-center gap-2 text-xs text-cloud-dim">
          <span>{t('coach.sessionsPerWeekLabel')}</span>
          {[2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" onClick={() => run(() => updateRoutineMeta(plan.id, { sessions_per_week: n }))} dir="ltr"
              className={cn('h-8 w-8 rounded-lg border text-xs font-semibold', plan.sessions_per_week === n ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border')}>{n}</button>
          ))}
        </div>
      )}

      {error && <p className="mb-3 rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">{error}</p>}

      <div className="space-y-4">
        {allDays.map((d, k) => {
          const rows = plan.rows.filter((r) => r.day_index === d);
          const label = rows.find((r) => r.day_label)?.day_label ?? null;
          return (
            <section key={d} className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="routine-day">
              <div className="mb-2 text-sm font-bold text-cloud" dir="auto">{label || t('coach.dayN', { n: k + 1 })}</div>
              <ul className="space-y-2">
                {rows.map((r) => <RowEditor key={r.id} r={r} editable={editable} t={t} onSave={(p) => run(() => updateRoutineRow(r.id, p))} onDelete={() => run(() => deleteRoutineRow(r.id))} />)}
              </ul>
              {rows.length === 0 && <p className="text-xs text-cloud-muted">{t('coach.emptyDay')}</p>}
              {editable && (
                <button type="button" onClick={() => setAddDay(d)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-border py-2.5 text-xs font-semibold text-lime" data-testid="add-exercise">
                  <Plus className="h-3.5 w-3.5" />{t('coach.addExercise')}
                </button>
              )}
            </section>
          );
        })}
      </div>

      {editable && (
        <button type="button" onClick={() => setExtraDays((n) => n + 1)} className="mt-3 w-full rounded-xl border border-ink-border py-3 text-sm font-semibold text-cloud" data-testid="add-day">
          {t('coach.addDay')}
        </button>
      )}

      <div className="mt-6 grid grid-cols-1 gap-2">
        <button type="button" onClick={() => setGiveOpen(true)} disabled={!plan.rows.length} className="flex items-center justify-center gap-2 rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg disabled:opacity-40" data-testid="give-routine">
          <Send className="h-4 w-4" />{t('coach.giveToAthlete')}
        </button>
        {editable && (
          <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-rust">
            <Trash2 className="h-4 w-4" />{t('coach.deleteRoutine')}
          </button>
        )}
      </div>

      {addDay != null && (
        <ExercisePicker t={t} onClose={() => setAddDay(null)} onPick={(ex) => {
          const dayRows = plan.rows.filter((r) => r.day_index === addDay);
          const order = plan.rows.reduce((m, r) => Math.max(m, r.exercise_order), -1) + 1;
          const label = dayRows.find((r) => r.day_label)?.day_label ?? null;
          run(() => addRoutineRow(plan.id, ex, addDay, label, order)).then(() => { if (!dayRows.length) setExtraDays((n) => Math.max(0, n - 1)); });
          setAddDay(null);
        }} />
      )}
      <GiveSheet open={giveOpen} planId={plan.id} onClose={() => setGiveOpen(false)} t={t} />
      <Sheet open={confirmDelete} title={t('coach.deleteRoutine')} onClose={() => setConfirmDelete(false)}>
        <p className="mb-4 text-sm leading-relaxed text-cloud-dim">{t('coach.deleteRoutineBody')}</p>
        <button type="button" onClick={async () => { try { await deleteCoachRoutine(plan.id); navigate('/coach/programs', { replace: true }); } catch { setError(t('coach.saveError')); setConfirmDelete(false); } }}
          className="w-full rounded-xl bg-rust py-3 text-sm font-bold text-white">{t('coach.deleteRoutine')}</button>
      </Sheet>
    </div>
  );
}

function RowEditor({ r, editable, t, onSave, onDelete }: { r: RoutineRow; editable: boolean; t: T; onSave: (p: Partial<RoutineRow>) => void; onDelete: () => void }) {
  const [sets, setSets] = useState(String(r.sets));
  const [reps, setReps] = useState(r.reps);
  const [rest, setRest] = useState(r.rest_seconds != null ? String(r.rest_seconds) : '');
  const dirty = sets !== String(r.sets) || reps !== r.reps || rest !== (r.rest_seconds != null ? String(r.rest_seconds) : '');
  const setsNum = Number(sets);
  const valid = Number.isInteger(setsNum) && setsNum >= 1 && setsNum <= 10 && reps.trim().length > 0 && (rest === '' || (Number(rest) >= 0 && Number(rest) <= 600));
  return (
    <li className="rounded-xl bg-ink-bg p-3">
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium text-cloud" dir="auto">{r.name}</span>
        {editable && <button type="button" onClick={onDelete} aria-label={t('setup.remove')} className="text-cloud-muted hover:text-rust"><X className="h-4 w-4" /></button>}
      </div>
      {editable ? (
        <div className="mt-2 grid grid-cols-[1fr_1.4fr_1.2fr_auto] items-end gap-2 text-[10px] text-cloud-dim">
          <label>{t('coach.sets')}<input value={sets} onChange={(e) => setSets(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} inputMode="numeric" dir="ltr" className="mt-1 w-full rounded-lg border border-ink-border bg-ink-surface px-2 py-1.5 text-center text-sm text-cloud" /></label>
          <label>{t('coach.reps')}<input value={reps} onChange={(e) => setReps(e.target.value.slice(0, 20))} dir="ltr" className="mt-1 w-full rounded-lg border border-ink-border bg-ink-surface px-2 py-1.5 text-center text-sm text-cloud" /></label>
          <label>{t('coach.restSec')}<input value={rest} onChange={(e) => setRest(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} inputMode="numeric" dir="ltr" className="mt-1 w-full rounded-lg border border-ink-border bg-ink-surface px-2 py-1.5 text-center text-sm text-cloud" /></label>
          <button type="button" disabled={!dirty || !valid} onClick={() => onSave({ sets: setsNum, reps: reps.trim(), rest_seconds: rest === '' ? null : Number(rest) })} aria-label={t('common.save')}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime text-ink-bg disabled:bg-ink-elevated disabled:text-cloud-muted"><Check className="h-4 w-4" /></button>
        </div>
      ) : (
        <div className="mt-1 text-xs text-cloud-dim" dir="ltr">{r.sets} × {r.reps}{r.rest_seconds ? ` · ${r.rest_seconds}s` : ''}</div>
      )}
    </li>
  );
}

function ExercisePicker({ t, onClose, onPick }: { t: T; onClose: () => void; onPick: (ex: ExerciseHit) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ExerciseHit[]>([]);
  useEffect(() => {
    const id = window.setTimeout(() => { searchExercises(q).then(setHits).catch(() => setHits([])); }, 250);
    return () => window.clearTimeout(id);
  }, [q]);
  return (
    <Sheet open title={t('coach.addExercise')} onClose={onClose}>
      <label className="mb-3 flex items-center gap-2 rounded-xl border border-ink-border bg-ink-bg px-3">
        <Search className="h-4 w-4 text-cloud-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('coach.searchExercises')} className="h-11 w-full bg-transparent text-sm text-cloud placeholder:text-cloud-muted focus:outline-none" data-testid="exercise-search" />
      </label>
      <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
        {hits.map((h) => (
          <li key={h.id}>
            <button type="button" onClick={() => onPick(h)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-ink-elevated" data-testid="exercise-hit">
              <span className="min-w-0 flex-1"><span className="block truncate text-sm text-cloud">{h.name}</span>
                {(h.primary_muscle || h.equipment) && <span className="block truncate text-[11px] text-cloud-dim">{[h.primary_muscle, h.equipment].filter(Boolean).join(' · ')}</span>}</span>
              <Plus className="h-4 w-4 text-lime" />
            </button>
          </li>
        ))}
        {q.trim().length >= 2 && hits.length === 0 && <li className="py-6 text-center text-xs text-cloud-dim">{t('coach.noMatch')}</li>}
      </ul>
    </Sheet>
  );
}

function GiveSheet({ open, planId, onClose, t }: { open: boolean; planId: string; onClose: () => void; t: T }) {
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [done, setDone] = useState<Record<string, 'busy' | 'ok' | string>>({});
  useEffect(() => { if (open) fetchRoster().then(setRoster).catch(() => setRoster([])); }, [open]);
  return (
    <Sheet open={open} title={t('coach.giveToAthlete')} onClose={onClose}>
      <p className="mb-3 text-xs leading-relaxed text-cloud-dim">{t('coach.giveNote')}</p>
      {roster && roster.length === 0 && <p className="py-6 text-center text-xs text-cloud-dim">{t('coach.inboxEmpty')}</p>}
      <ul className="space-y-1.5">
        {(roster ?? []).map((r) => (
          <li key={r.athlete_id} className="flex items-center gap-3 rounded-xl bg-ink-elevated/60 px-3 py-2.5">
            <Avatar id={r.athlete_id} name={r.display_name} url={r.avatar_url} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm text-cloud" dir="auto">{r.display_name ?? '—'}</span>
            {done[r.athlete_id] === 'ok' ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-lime"><Check className="h-4 w-4" />{t('week.applied')}</span>
            ) : (
              <button type="button" disabled={done[r.athlete_id] === 'busy'} onClick={async () => {
                setDone((s) => ({ ...s, [r.athlete_id]: 'busy' }));
                try { await assignPlan(r.athlete_id, planId); setDone((s) => ({ ...s, [r.athlete_id]: 'ok' })); }
                catch (e) { setDone((s) => ({ ...s, [r.athlete_id]: coachErrorKey(e) })); }
              }} className="rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-ink-bg disabled:opacity-50" data-testid="give-to">{t('coach.give')}</button>
            )}
          </li>
        ))}
      </ul>
      {Object.values(done).some((v) => v !== 'busy' && v !== 'ok') && <p className="mt-2 text-xs text-rust">{t('coach.saveError')}</p>}
    </Sheet>
  );
}
