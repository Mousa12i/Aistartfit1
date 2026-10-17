import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Layers, Loader2, Plus, Search, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { assignPlan, coachErrorKey, fetchRoster } from '@/lib/coach/api';
import type { RosterRow } from '@/lib/coach/insights';
import {
  athleteActivePlanId, addRoutineRow, copyRoutine, createCoachRoutine, deleteCoachRoutine, deleteDay, deleteRoutineRow, duplicateDay, listCoachRoutines, moveRow, readRoutine, renameDay,
  searchExercises, updateRoutineMeta, updateRoutineRow, validTempo, type ExerciseHit, type RoutineFull, type RoutineRow, type RoutineSummary, type RowPatch,
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

/** Editor for a coach routine, a ready-made routine (view + copy) or an athlete's own program copy. */
export function CoachRoutineEditor({ planIdOverride, backTo, athleteName }: { planIdOverride?: string; backTo?: string; athleteName?: string | null } = {}) {
  const params = useParams();
  const id = planIdOverride ?? params.id ?? '';
  const navigate = useNavigate();
  const { t, dir } = useI18n();
  const [plan, setPlan] = useState<RoutineFull | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [altFor, setAltFor] = useState<RoutineRow | null>(null);
  const [extraDays, setExtraDays] = useState(0);
  const [giveOpen, setGiveOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
  const editable = plan.access !== 'readonly';
  const back = backTo ?? '/coach/programs';

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setSaving(true);
    try { await fn(); await load(); } catch { setError(t('coach.saveError')); } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-28 pt-5" dir={dir} data-testid="routine-editor">
      <header className="mb-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate(back)} aria-label={t('common.back')} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></button>
        {editable ? (
          <input defaultValue={plan.name} onBlur={(e) => e.target.value.trim() && e.target.value !== plan.name && run(() => updateRoutineMeta(plan.id, { name: e.target.value }))}
            className="min-w-0 flex-1 rounded-xl bg-transparent px-1 py-1 text-xl font-bold text-cloud focus:bg-ink-surface focus:outline-none" dir="auto" data-testid="routine-name" />
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-cloud" dir="auto">{plan.name}</h1>
        )}
        {saving && <Loader2 className="h-4 w-4 animate-spin text-cloud-dim" />}
      </header>

      {plan.access === 'athlete' && (
        <p className="mb-4 rounded-xl bg-sky/10 px-3 py-2 text-xs leading-relaxed text-sky">{t('coach.editingAthletePlan', { name: athleteName ?? '' })}</p>
      )}

      {!editable && (
        <div className="mb-4 rounded-2xl border border-ink-border bg-ink-surface p-4 text-xs leading-relaxed text-cloud-dim">
          {t('coach.readyNote')}
          <button type="button" onClick={async () => { try { navigate(`/coach/programs/${await copyRoutine(plan.id)}`, { replace: true }); } catch { setError(t('coach.saveError')); } }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-lime/40 py-2.5 text-sm font-semibold text-lime" data-testid="copy-routine">
            <Copy className="h-4 w-4" />{t('coach.copyToMine')}
          </button>
        </div>
      )}

      {editable && <PlanMeta plan={plan} t={t} onSave={(p) => run(() => updateRoutineMeta(plan.id, p))} />}
      {!editable && plan.progression && <p className="mb-4 rounded-xl bg-ink-surface px-3 py-2 text-xs text-cloud-dim" dir="auto">{plan.progression}</p>}

      {error && <p className="mb-3 rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">{error}</p>}

      <div className="space-y-4">
        {allDays.map((d, k) => {
          const rows = plan.rows.filter((r) => r.day_index === d).sort((a, b) => a.exercise_order - b.exercise_order);
          const label = rows.find((r) => r.day_label)?.day_label ?? null;
          return (
            <section key={d} className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="routine-day">
              <div className="mb-2 flex items-center gap-2">
                {editable && rows.length > 0 ? (
                  <input defaultValue={label ?? ''} placeholder={t('coach.dayN', { n: k + 1 })} onBlur={(e) => e.target.value !== (label ?? '') && run(() => renameDay(plan.rows, d, e.target.value))}
                    className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 text-sm font-bold text-cloud placeholder:text-cloud focus:bg-ink-bg focus:outline-none" dir="auto" data-testid="day-label" />
                ) : (
                  <div className="flex-1 text-sm font-bold text-cloud" dir="auto">{label || t('coach.dayN', { n: k + 1 })}</div>
                )}
                {editable && rows.length > 0 && (
                  <>
                    <button type="button" onClick={() => run(() => duplicateDay(plan.id, plan.rows, d, Math.max(lastDay, ...allDays) + 1, label ? `${label} (2)` : null))} aria-label={t('coach.duplicateDay')} title={t('coach.duplicateDay')} className="rounded-lg p-1.5 text-cloud-dim hover:text-cloud" data-testid="dup-day"><Copy className="h-4 w-4" /></button>
                    <button type="button" onClick={() => run(() => deleteDay(plan.rows, d))} aria-label={t('coach.deleteDay')} title={t('coach.deleteDay')} className="rounded-lg p-1.5 text-cloud-dim hover:text-rust"><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
              <ul className="space-y-2">
                {rows.map((r, i) => (
                  <RowEditor key={r.id} r={r} editable={editable} t={t} open={openRow === r.id} onToggle={() => setOpenRow(openRow === r.id ? null : r.id)}
                    first={i === 0} last={i === rows.length - 1}
                    onMove={(dir2) => run(() => moveRow(plan.rows, r.id, dir2))}
                    onSave={(p) => run(() => updateRoutineRow(r.id, p))}
                    onDelete={() => run(() => deleteRoutineRow(r.id))}
                    onPickAlt={() => setAltFor(r)} />
                ))}
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
        {plan.access !== 'athlete' && (
          <button type="button" onClick={() => setGiveOpen(true)} disabled={!plan.rows.length} className="flex items-center justify-center gap-2 rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg disabled:opacity-40" data-testid="give-routine">
            <Send className="h-4 w-4 rtl:-scale-x-100" />{t('coach.giveToAthlete')}
          </button>
        )}
        {plan.access === 'own' && (
          <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-rust">
            <Trash2 className="h-4 w-4" />{t('coach.deleteRoutine')}
          </button>
        )}
      </div>

      {addDay != null && (
        <ExercisePicker t={t} onClose={() => setAddDay(null)} onPick={(ex) => {
          const dayRows = plan.rows.filter((r) => r.day_index === addDay);
          const label = dayRows.find((r) => r.day_label)?.day_label ?? null;
          const wasEmpty = !dayRows.length;
          setAddDay(null);
          run(() => addRoutineRow(plan.id, ex, addDay, label)).then(() => { if (wasEmpty && addDay > lastDay) setExtraDays((n) => Math.max(0, n - 1)); });
        }} />
      )}
      {altFor && (
        <ExercisePicker t={t} title={t('coach.pickAlternative', { name: altFor.name })} onClose={() => setAltFor(null)} onPick={(ex) => {
          const row = altFor;
          setAltFor(null);
          run(() => updateRoutineRow(row.id, { alt_exercise_id: ex.id }));
        }} />
      )}
      {plan.access !== 'athlete' && <GiveSheet open={giveOpen} planId={plan.id} onClose={() => setGiveOpen(false)} t={t} />}
      <Sheet open={confirmDelete} title={t('coach.deleteRoutine')} onClose={() => setConfirmDelete(false)}>
        <p className="mb-4 text-sm leading-relaxed text-cloud-dim">{t('coach.deleteRoutineBody')}</p>
        <button type="button" onClick={async () => { try { await deleteCoachRoutine(plan.id); navigate('/coach/programs', { replace: true }); } catch { setError(t('coach.saveError')); setConfirmDelete(false); } }}
          className="w-full rounded-xl bg-rust py-3 text-sm font-bold text-white">{t('coach.deleteRoutine')}</button>
      </Sheet>
    </div>
  );
}

/** Weeks, sessions per week and the progression instructions the athlete reads. */
function PlanMeta({ plan, t, onSave }: { plan: RoutineFull; t: T; onSave: (p: { sessions_per_week?: number; weeks?: number | null; progression?: string | null }) => void }) {
  const [prog, setProg] = useState(plan.progression ?? '');
  return (
    <div className="mb-4 space-y-3 rounded-2xl border border-ink-border bg-ink-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-cloud-dim">
        <span className="w-28">{t('coach.sessionsPerWeekLabel')}</span>
        {[2, 3, 4, 5, 6].map((n) => (
          <button key={n} type="button" onClick={() => onSave({ sessions_per_week: n })} dir="ltr"
            className={cn('h-8 w-8 rounded-lg border text-xs font-semibold', plan.sessions_per_week === n ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border')}>{n}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-cloud-dim">
        <span className="w-28">{t('coach.durationWeeks')}</span>
        {[4, 6, 8, 12, 16].map((n) => (
          <button key={n} type="button" onClick={() => onSave({ weeks: n })} dir="ltr" data-testid={`weeks-${n}`}
            className={cn('h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold', plan.duration_weeks === n ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border')}>{n}</button>
        ))}
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-cloud-dim">{t('coach.progressionLabel')}</span>
        <textarea value={prog} onChange={(e) => setProg(e.target.value.slice(0, 600))} onBlur={() => prog !== (plan.progression ?? '') && onSave({ progression: prog })} rows={2} dir="auto"
          placeholder={t('coach.progressionPh')} className={field} data-testid="progression" />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {(['coach.progDouble', 'coach.progLinear', 'coach.progRir'] as MessageKey[]).map((k) => (
          <button key={k} type="button" onClick={() => { const v = t(k); setProg(v); onSave({ progression: v }); }} className="rounded-full border border-ink-border px-2.5 py-1 text-[11px] text-cloud-dim hover:text-cloud">{t(`${k}Title` as MessageKey)}</button>
        ))}
      </div>
    </div>
  );
}

function RowEditor({ r, editable, t, open, onToggle, first, last, onMove, onSave, onDelete, onPickAlt }: {
  r: RoutineRow; editable: boolean; t: T; open: boolean; onToggle: () => void; first: boolean; last: boolean;
  onMove: (d: -1 | 1) => void; onSave: (p: RowPatch) => void; onDelete: () => void; onPickAlt: () => void;
}) {
  const [sets, setSets] = useState(String(r.sets));
  const [reps, setReps] = useState(r.reps);
  const [rest, setRest] = useState(r.rest_seconds != null ? String(r.rest_seconds) : '');
  const [rir, setRir] = useState(r.rir_target != null ? String(r.rir_target) : '');
  const [tempo, setTempo] = useState(r.tempo ?? '');
  const [group, setGroup] = useState(r.group_label ?? '');
  const [notes, setNotes] = useState(r.notes ?? '');
  useEffect(() => {
    setSets(String(r.sets)); setReps(r.reps); setRest(r.rest_seconds != null ? String(r.rest_seconds) : '');
    setRir(r.rir_target != null ? String(r.rir_target) : ''); setTempo(r.tempo ?? ''); setGroup(r.group_label ?? ''); setNotes(r.notes ?? '');
  }, [r]);
  const setsNum = Number(sets);
  const valid = Number.isInteger(setsNum) && setsNum >= 1 && setsNum <= 10 && reps.trim().length > 0
    && (rest === '' || (Number(rest) >= 0 && Number(rest) <= 600)) && (rir === '' || (Number(rir) >= 0 && Number(rir) <= 5)) && (tempo === '' || validTempo(tempo));
  const summary = [`${r.sets} × ${r.reps}`, r.rest_seconds ? `${r.rest_seconds}s` : null, r.rir_target != null ? `RIR ${r.rir_target}` : null, r.tempo ? `${t('coach.tempo')} ${r.tempo}` : null].filter(Boolean).join(' · ');
  return (
    <li className={cn('rounded-xl bg-ink-bg p-3', r.group_label && 'border-s-2 border-sky')} data-testid="routine-row-ex">
      <div className="flex items-start gap-2">
        {r.group_label && <span className="mt-0.5 rounded bg-sky/15 px-1.5 text-[10px] font-bold text-sky" dir="ltr">{r.group_label}</span>}
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-start">
          <span className="block text-sm font-medium text-cloud" dir="auto">{r.name}</span>
          <span className="block text-[11px] text-cloud-dim" dir="ltr">{summary}</span>
          {r.notes && <span className="block truncate text-[11px] text-gold" dir="auto">{r.notes}</span>}
          {r.alt_name && <span className="block truncate text-[11px] text-cloud-muted" dir="auto">{t('coach.alternative')}: {r.alt_name}</span>}
        </button>
        {editable && (
          <div className="flex flex-col">
            <button type="button" disabled={first} onClick={() => onMove(-1)} aria-label={t('coach.moveUp')} className="p-0.5 text-cloud-muted disabled:opacity-20"><ChevronUp className="h-4 w-4" /></button>
            <button type="button" disabled={last} onClick={() => onMove(1)} aria-label={t('coach.moveDown')} className="p-0.5 text-cloud-muted disabled:opacity-20"><ChevronDown className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      {editable && open && (
        <div className="mt-3 space-y-2 border-t border-ink-border pt-3" data-testid="row-form">
          <div className="grid grid-cols-3 gap-2 text-[10px] text-cloud-dim">
            <label>{t('coach.sets')}<input value={sets} onChange={(e) => setSets(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} inputMode="numeric" dir="ltr" className={mini} /></label>
            <label>{t('coach.reps')}<input value={reps} onChange={(e) => setReps(e.target.value.slice(0, 20))} dir="ltr" placeholder="8-12" className={mini} /></label>
            <label>{t('coach.restSec')}<input value={rest} onChange={(e) => setRest(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} inputMode="numeric" dir="ltr" className={mini} /></label>
            <label>RIR<input value={rir} onChange={(e) => setRir(e.target.value.replace(/[^0-9]/g, '').slice(0, 1))} inputMode="numeric" dir="ltr" placeholder="0–5" className={mini} data-testid="row-rir" /></label>
            <label>{t('coach.tempo')}<input value={tempo} onChange={(e) => setTempo(e.target.value.toUpperCase().replace(/[^0-9X-]/g, '').slice(0, 11))} dir="ltr" placeholder="3-1-1" className={cn(mini, tempo && !validTempo(tempo) && 'border-rust')} data-testid="row-tempo" /></label>
            <label>{t('coach.superset')}
              <select value={group} onChange={(e) => setGroup(e.target.value)} className={mini} data-testid="row-group">
                <option value="">—</option>
                {['A', 'B', 'C', 'D', 'E', 'F'].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 300))} rows={2} dir="auto" placeholder={t('coach.cuePlaceholder')} className={field} />
          <p className="text-[10px] leading-relaxed text-cloud-muted">{t('coach.rowHelp')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!valid} onClick={() => onSave({
              sets: setsNum, reps: reps.trim(), rest_seconds: rest === '' ? undefined : Number(rest), rir_target: rir === '' ? null : Number(rir),
              tempo: tempo === '' ? '' : tempo, group_label: group, notes,
            })} className="flex-1 rounded-lg bg-lime py-2 text-xs font-bold text-ink-bg disabled:opacity-40" data-testid="row-save">{t('common.save')}</button>
            <button type="button" onClick={onPickAlt} className="rounded-lg border border-ink-border px-3 py-2 text-xs text-cloud" data-testid="row-alt">{r.alt_name ? t('coach.changeAlternative') : t('coach.addAlternative')}</button>
            {r.alt_exercise_id && <button type="button" onClick={() => onSave({ alt_exercise_id: null })} className="rounded-lg border border-ink-border px-3 py-2 text-xs text-cloud-dim">{t('coach.removeAlternative')}</button>}
            <button type="button" onClick={onDelete} className="rounded-lg border border-rust/30 px-3 py-2 text-xs text-rust" data-testid="row-delete">{t('setup.remove')}</button>
          </div>
        </div>
      )}
    </li>
  );
}

const mini = 'mt-1 w-full rounded-lg border border-ink-border bg-ink-surface px-2 py-1.5 text-center text-sm text-cloud';

function ExercisePicker({ t, onClose, onPick, title }: { t: T; onClose: () => void; onPick: (ex: ExerciseHit) => void; title?: string }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ExerciseHit[]>([]);
  useEffect(() => {
    const id = window.setTimeout(() => { searchExercises(q).then(setHits).catch(() => setHits([])); }, 250);
    return () => window.clearTimeout(id);
  }, [q]);
  return (
    <Sheet open title={title ?? t('coach.addExercise')} onClose={onClose}>
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

/** /coach/athlete/:id/program — the athlete's own program copy, fully editable by their coach. */
export function AthleteProgram() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { t, dir } = useI18n();
  const [planId, setPlanId] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    athleteActivePlanId(id).then(setPlanId).catch(() => setPlanId(null));
    fetchRoster().then((r) => setName(r.find((x) => x.athlete_id === id)?.display_name ?? null)).catch(() => undefined);
  }, [id]);
  if (planId === undefined) return <div className="min-h-screen bg-ink-bg" />;
  if (!planId) {
    return (
      <div className="min-h-screen bg-ink-bg px-5 pt-5" dir={dir}>
        <button type="button" onClick={() => navigate(`/coach/athlete/${id}?tab=training`)} aria-label={t('common.back')} className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></button>
        <p className="text-sm text-cloud-dim">{t('coach.noProgramYet')}</p>
      </div>
    );
  }
  return <CoachRoutineEditor planIdOverride={planId} backTo={`/coach/athlete/${id}?tab=training`} athleteName={name} />;
}
