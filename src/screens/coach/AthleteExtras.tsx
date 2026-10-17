import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, Download, Pin, Plus, Send, X as Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n, type MessageKey } from '@/lib/i18n';
import {
  addMemory, exportAthleteData, listHabitRatings, listMemory, sendMessage, updateMemory,
  type ActivePlan, type ExportKind, type Habit, type HabitLog, type MemoryItem, type MemoryKind, type SessionRow,
} from '@/lib/coach/api';
import { reviewSession, type ExerciseVerdict } from '@/lib/coach/session-review';
import { consistency, habitTrend, type HabitRating } from '@/lib/coach/habit-science';
import { shortDate } from '@/lib/coach/recovery-plan';

type T = (k: MessageKey, v?: Record<string, string | number>) => string;
const field = 'w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-2.5 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------------- coach memory ----------------

const KINDS: MemoryKind[] = ['injury', 'travel', 'goal', 'life', 'preference', 'other'];
const KIND_TONE: Record<MemoryKind, string> = {
  injury: 'bg-rust/15 text-rust', travel: 'bg-sky/15 text-sky', goal: 'bg-lime/15 text-lime', life: 'bg-gold/15 text-gold', preference: 'bg-ink-elevated text-cloud', other: 'bg-ink-elevated text-cloud-dim',
};

/** The coach's private timeline of what matters about this athlete, so nothing is forgotten at 30+ clients. */
export function MemoryTimeline({ coachId, athleteId }: { coachId: string; athleteId: string }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<MemoryItem[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<MemoryKind>('injury');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(ymd(new Date()));
  const [until, setUntil] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => listMemory(coachId, athleteId).then(setItems).catch(() => setItems([])), [coachId, athleteId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr(null);
    if (body.trim().length < 2) return;
    if (until && until < date) { setErr(t('memory.untilBefore')); return; }
    try {
      await addMemory(coachId, athleteId, { kind, body, happened_on: date, until_on: until || null });
      setBody(''); setUntil(''); setAdding(false); load();
    } catch { setErr(t('coach.saveError')); }
  };
  const act = async (id: string, patch: { pinned?: boolean; archived?: boolean }) => {
    try { await updateMemory(id, patch); load(); } catch { setErr(t('coach.saveError')); }
  };

  const today = ymd(new Date());
  const sorted = (items ?? []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.happened_on.localeCompare(a.happened_on));

  return (
    <section className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="memory">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-cloud"><Brain className="h-4 w-4 text-sky" />{t('memory.title')}</span>
        <button type="button" onClick={() => setAdding((v) => !v)} className="flex items-center gap-1 rounded-lg bg-ink-elevated px-2.5 py-1.5 text-[11px] font-semibold text-lime" data-testid="memory-add"><Plus className="h-3.5 w-3.5" />{t('memory.add')}</button>
      </div>
      <p className="mb-3 text-[11px] text-cloud-muted">{t('memory.help')}</p>
      {adding && (
        <div className="mb-3 space-y-2 rounded-xl bg-ink-elevated/50 p-3">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={cn('rounded-full border px-2.5 py-1 text-[11px]', kind === k ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')}>{t(`memory.kind_${k}` as MessageKey)}</button>
            ))}
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 300))} rows={2} dir="auto" placeholder={t('memory.placeholder')} className={field} data-testid="memory-body" />
          <div className="grid grid-cols-2 gap-2">
            <label><span className="mb-1 block text-[10px] text-cloud-dim">{t('memory.date')}</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></label>
            <label><span className="mb-1 block text-[10px] text-cloud-dim">{t('memory.until')}</span><input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} className={field} /></label>
          </div>
          {err && <p className="text-xs text-rust">{err}</p>}
          <button type="button" onClick={save} disabled={body.trim().length < 2} className="w-full rounded-xl bg-lime py-2.5 text-sm font-bold text-ink-bg disabled:opacity-40" data-testid="memory-save">{t('common.save')}</button>
        </div>
      )}
      {items && items.length === 0 && !adding && <p className="text-xs text-cloud-dim">{t('memory.empty')}</p>}
      <ol className="space-y-2">
        {sorted.map((m) => {
          const current = m.until_on != null && m.until_on >= today && m.happened_on <= today;
          return (
            <li key={m.id} className="flex items-start gap-2 rounded-xl bg-ink-elevated/50 px-3 py-2.5" data-testid="memory-item">
              <span className={cn('mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', KIND_TONE[m.kind])}>{t(`memory.kind_${m.kind}` as MessageKey)}</span>
              <span className="min-w-0 flex-1">
                <span className="block whitespace-pre-line text-sm text-cloud" dir="auto">{m.body}</span>
                <span className="block text-[10px] text-cloud-muted">
                  {shortDate(m.happened_on, lang)}{m.until_on ? ` → ${shortDate(m.until_on, lang)}` : ''}{current ? ` · ${t('memory.now')}` : ''}
                </span>
              </span>
              <button type="button" onClick={() => act(m.id, { pinned: !m.pinned })} aria-label={t('memory.pin')} aria-pressed={m.pinned} className={cn('p-1', m.pinned ? 'text-lime' : 'text-cloud-muted')}><Pin className="h-4 w-4" /></button>
              <button type="button" onClick={() => act(m.id, { archived: true })} aria-label={t('memory.archive')} className="p-1 text-cloud-muted hover:text-rust"><Archive className="h-4 w-4" /></button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------- planned vs done ----------------

const VERDICT_TONE: Record<ExerciseVerdict, string> = {
  as_planned: 'text-lime', too_easy: 'text-sky', too_hard: 'text-rust', fewer_sets: 'text-gold', below_range: 'text-gold', skipped: 'text-rust', extra: 'text-cloud-dim',
};
const roundHalf = (n: number) => Math.round(n * 2) / 2;

/** One session next to the plan day it followed, with a feedback message the coach can send in one tap. */
export function SessionReview({ session, plan, coachId, athleteId, firstName }: { session: SessionRow; plan: ActivePlan | null; coachId: string; athleteId: string; firstName: string }) {
  const { t } = useI18n();
  const [sent, setSent] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const review = useMemo(() => {
    if (!plan || (session.plan_id && session.plan_id !== plan.id)) return null;
    return reviewSession(
      plan.exercises.map((e) => ({ exercise_id: e.exercise_id, name: e.name, sets: e.sets, reps: e.reps, rir_target: e.rir_target, day_index: e.day_index })),
      session.sets.map((s) => ({ exercise_id: s.exercise_id, exercise_name: s.exercise_name, set_type: s.set_type, reps: s.reps, weight: s.weight, rir: s.rir, completed: s.completed })),
      session.plan_day,
    );
  }, [plan, session]);
  if (!review || review.day == null || !review.exercises.length) return null;

  const tips = review.exercises.filter((e) => e.verdict === 'too_easy' && e.topWeight).map((e) =>
    t('review.tipUp', { name: e.name, low: roundHalf(e.topWeight! * 1.02), high: roundHalf(e.topWeight! * 1.05) }));
  const hard = review.exercises.filter((e) => e.verdict === 'too_hard').map((e) => t('review.tipHard', { name: e.name }));
  const message = [t('review.msgIntro', { name: firstName, pct: review.completion ?? 0 }), ...tips, ...hard].join('\n');

  const send = async () => {
    setSent('busy');
    try { await sendMessage({ coachId, athleteId, senderId: coachId, body: message }); setSent('done'); } catch { setSent('error'); }
  };

  return (
    <div className="mb-3 rounded-xl border border-ink-border bg-ink-bg/50 p-3" data-testid="session-review">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-cloud">{t('review.title')}</span>
        {review.completion != null && <span className="text-cloud-dim">{t('review.completion', { pct: review.completion })}</span>}
      </div>
      <table className="w-full text-[11px]">
        <thead><tr className="text-cloud-muted"><th className="py-1 text-start font-normal">{t('review.exercise')}</th><th className="text-start font-normal">{t('review.planned')}</th><th className="text-start font-normal">{t('review.done')}</th><th className="text-end font-normal">{t('review.result')}</th></tr></thead>
        <tbody>
          {review.exercises.map((e) => (
            <tr key={e.exerciseId} className="border-t border-ink-border/40 align-top" data-testid="review-row">
              <td className="py-1.5 pe-2 text-cloud">{e.name}</td>
              <td className="pe-2 text-cloud-dim" dir="ltr">{e.planned ? `${e.planned.sets}×${e.planned.repsMin}${e.planned.repsMax !== e.planned.repsMin ? `-${e.planned.repsMax}` : ''}${e.planned.rir != null ? ` RIR ${e.planned.rir}` : ''}` : '—'}</td>
              <td className="pe-2 text-cloud-dim" dir="ltr">{e.done.sets ? `${e.done.sets}× ${e.done.reps.join('/')}${e.topWeight ? ` @${e.topWeight}` : ''}${e.avgRir != null ? ` RIR ${e.avgRir}` : ''}` : '—'}</td>
              <td className={cn('text-end font-semibold', VERDICT_TONE[e.verdict])}>{t(`review.v_${e.verdict}` as MessageKey)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(tips.length > 0 || hard.length > 0) && <ul className="mt-2 space-y-0.5 text-[11px] text-cloud">{[...tips, ...hard].map((x) => <li key={x}>• {x}</li>)}</ul>}
      <p className="mt-2 text-[10px] text-cloud-muted">{t('review.note')}</p>
      <button type="button" onClick={send} disabled={sent === 'busy' || sent === 'done'} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-lime/40 py-2 text-[11px] font-bold text-lime disabled:opacity-60" data-testid="review-send">
        <Send className="h-3.5 w-3.5 rtl:-scale-x-100" />{sent === 'done' ? t('review.sent') : t('review.send')}
      </button>
      {sent === 'error' && <p className="mt-1 text-[11px] text-rust">{t('coach.sendError')}</p>}
    </div>
  );
}

// ---------------- export (no lock-in) ----------------

const EXPORTS: ExportKind[] = ['workouts', 'sets', 'food', 'weights', 'checkins'];

function download(name: string, csv: string) {
  // UTF-8 byte order mark so Excel opens Arabic and other scripts correctly.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ExportPanel({ athleteId, name }: { athleteId: string; name: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [err, setErr] = useState(false);
  const run = async (k: ExportKind) => {
    setBusy(k); setErr(false);
    try {
      const csv = await exportAthleteData(athleteId, k);
      const safe = (name || 'athlete').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40);
      download(`startfit-${safe}-${k}-${ymd(new Date())}.csv`, csv);
      (window as unknown as { __lastExport?: { kind: string; csv: string } }).__lastExport = { kind: k, csv };
    } catch { setErr(true); } finally { setBusy(null); }
  };
  return (
    <section className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="export-panel">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-cloud"><Download className="h-4 w-4 text-lime" />{t('export.title')}</div>
      <p className="mb-3 text-[11px] text-cloud-muted">{t('export.help')}</p>
      <div className="flex flex-wrap gap-1.5">
        {EXPORTS.map((k) => (
          <button key={k} type="button" disabled={!!busy} onClick={() => run(k)} className="rounded-full border border-ink-border px-3 py-1.5 text-[11px] font-semibold text-cloud disabled:opacity-50" data-testid={`export-${k}`}>
            {busy === k ? '…' : t(`export.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      {err && <p className="mt-2 text-xs text-rust">{t('export.error')}</p>}
    </section>
  );
}

// ---------------- habit strength (coach side) ----------------

/** Consistency in the last 14 days and the athlete's own automaticity ratings (SRBAI 1-7) for each habit. */
export function HabitStrength({ habits, logs, t }: { habits: Habit[]; logs: HabitLog[]; t: T }) {
  const [ratings, setRatings] = useState<HabitRating[]>([]);
  const ids = habits.map((h) => h.id).join(',');
  useEffect(() => { listHabitRatings(habits.map((h) => h.id)).then(setRatings).catch(() => setRatings([])); }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!habits.length) return null;
  const today = ymd(new Date());
  return (
    <div className="mt-3 space-y-1.5 border-t border-ink-border/60 pt-3" data-testid="habit-strength">
      <div className="text-[11px] font-semibold text-cloud-dim">{t('habitsci.title')}</div>
      {habits.map((h) => {
        const c = consistency(logs.filter((l) => l.habit_id === h.id && l.done).map((l) => l.day), today);
        const tr = habitTrend(ratings, h.id);
        const last = tr.points[tr.points.length - 1];
        return (
          <div key={h.id} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="min-w-0 flex-1 truncate text-cloud" dir="auto">{h.title}</span>
            <span className="text-cloud-dim">{t('habitsci.consistency', { done: c.done, of: c.of })}</span>
            <span className={cn('w-28 text-end', last ? 'text-cloud' : 'text-cloud-muted')}>
              {last ? t('habitsci.score', { score: last.score.toFixed(1) }) : t('habitsci.noRating')}
              {tr.change != null && <span className={cn('ms-1', tr.change > 0 ? 'text-lime' : tr.change < 0 ? 'text-rust' : 'text-cloud-dim')} dir="ltr">{tr.change > 0 ? '+' : ''}{tr.change.toFixed(1)}</span>}
            </span>
          </div>
        );
      })}
      <p className="text-[10px] leading-relaxed text-cloud-muted">{t('habitsci.note')}</p>
    </div>
  );
}
