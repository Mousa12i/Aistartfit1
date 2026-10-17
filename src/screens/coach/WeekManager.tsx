import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity as ActivityIcon, Check, ChevronLeft, Dumbbell, Flame, Loader2, MessageCircle, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { fetchRoster, sendMessage, setAthleteTargets, updatePlanExercise } from '@/lib/coach/api';
import type { RosterRow } from '@/lib/coach/insights';
import { groupRecovery, MUSCLE_GROUPS, type MessageTopic, type MuscleGroup, type Proposal, type VolumeTarget } from '@/lib/coach/autopilot';
import { loadAthleteWeek, mapLimited, MappingCache, type AthleteWeekData } from '@/lib/coach/week-data';
import { REFERENCES } from '@/lib/nutrition/evidence';
import { TRAINING_REFERENCES } from '@/lib/training/evidence';
import { Avatar } from './ui';

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

const REFS = { ...REFERENCES, ...TRAINING_REFERENCES };

const GROUP_KEY: Record<MuscleGroup, MessageKey> = {
  chest: 'muscle.chest', shoulders: 'muscle.shoulders', back: 'muscle.back', arms: 'muscle.arms',
  core: 'muscle.core', quads: 'muscle.quads', posterior: 'muscle.posterior', calves: 'muscle.calves',
};
const TARGET_KEY: Record<VolumeTarget, MessageKey> = {
  chest: 'muscle.chest', lats: 'muscle.lats', upperBack: 'muscle.upperBack', quads: 'muscle.quads', hamstrings: 'muscle.hamstrings',
  glutes: 'muscle.glutes', sideDelts: 'muscle.sideDelts', biceps: 'muscle.biceps', triceps: 'muscle.triceps',
};

const CELL: Record<string, string> = {
  red: 'bg-rust/25 text-rust',
  orange: 'bg-gold/20 text-gold',
  green: 'bg-lime/15 text-lime',
  no_data: 'bg-ink-elevated text-cloud-muted',
};

// Wrapped in a left-to-right isolate so the sign stays in front of the number inside Arabic text.
const signed = (n: number, digits = 2) => `\u2066${n > 0 ? '+' : ''}${n.toFixed(digits)}\u2069`;

function messageTitle(m: MessageTopic): MessageKey {
  return ({
    load_up: 'week.msgLoadUp', sleep: 'week.msgSleep', weigh_in: 'week.msgWeigh', log_food: 'week.msgLogFood',
    logging_check: 'week.msgLogging', off_target: 'week.msgOffTarget', reengage: 'week.msgReengage', food_gap: 'week.msgFoodGap',
  } as const)[m.topic];
}

function messageWhy(m: MessageTopic, t: T): string {
  switch (m.topic) {
    case 'load_up': return t('week.whyLoadUp');
    case 'sleep': return t('week.whySleep', { h: m.avgHours, n: m.nights });
    case 'weigh_in': return t('week.whyWeigh', { n: m.points });
    case 'log_food': return t('week.whyLogFood');
    case 'logging_check': return t('week.whyLogging', { kg: signed(m.kgPerWeek) });
    case 'off_target': return t('week.whyOffTarget', { avg: m.avgIntake, target: m.target });
    case 'reengage': return t('week.whyReengage', { days: m.days });
    case 'food_gap': return t('week.whyFoodGap', { days: m.days });
  }
}

/** The text the athlete receives (the coach can edit it before approving). */
export function messageDraft(m: MessageTopic, t: T): string {
  switch (m.topic) {
    case 'load_up':
      return t('week.draftLoadUp', { list: m.items.map((i) => t('week.draftLoadUpLine', { exercise: i.exercise, w: i.weight, low: i.low, high: i.high })).join('\n') });
    case 'sleep': return t('week.draftSleep', { h: m.avgHours, n: m.nights });
    case 'weigh_in': return t('week.draftWeigh');
    case 'log_food': return t('week.draftLogFood');
    case 'logging_check': return t('week.draftLogging', { kg: signed(m.kgPerWeek) });
    case 'off_target': return t('week.draftOffTarget', { avg: m.avgIntake, target: m.target });
    case 'reengage': return t('week.draftReengage', { days: m.days });
    case 'food_gap': return t('week.draftFoodGap', { days: m.days });
  }
}

type Result = 'busy' | 'ok' | 'fail';

/** Coach's weekly review: recovery across the roster and evidence-based suggestions approved in one tap. */
export function WeekManager() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, dir } = useI18n();
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [data, setData] = useState<Record<string, AthleteWeekData | null>>({});
  const [done, setDone] = useState(0);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchRoster();
        if (!alive) return;
        setRoster(r);
        const cache = new MappingCache();
        const now = new Date();
        const out = await mapLimited(r, 3, (row) => loadAthleteWeek(row, cache, now), (n) => alive && setDone(n));
        if (!alive) return;
        const next: Record<string, AthleteWeekData | null> = {};
        const sel: Record<string, boolean> = {};
        r.forEach((row, i) => {
          next[row.athlete_id] = out[i];
          for (const p of out[i]?.week.proposals ?? []) sel[p.id] = true;
        });
        setData(next);
        setSelected(sel);
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Drafts are written in the coach's language until the coach edits them.
  const draftOf = (p: Proposal) => (p.kind === 'message' ? drafts[p.id] ?? messageDraft(p.message, t) : '');

  const loading = !roster || done < roster.length;
  const all = useMemo(() => (roster ?? []).flatMap((r) => (data[r.athlete_id]?.week.proposals ?? []).map((p) => ({ athleteId: r.athlete_id, p }))), [roster, data]);
  const pending = all.filter(({ p }) => selected[p.id] && results[p.id] !== 'ok');

  const apply = async () => {
    if (!user) return;
    setApplying(true);
    for (const { athleteId, p } of pending) {
      setResults((s) => ({ ...s, [p.id]: 'busy' }));
      try {
        if (p.kind === 'kcal') await setAthleteTargets(athleteId, { mode: p.mode, rate: p.rate, kcal: p.to, proteinPerKg: p.proteinPerKg });
        else if (p.kind === 'add_set') await updatePlanExercise(p.add.row.id, { sets: p.add.toSets, reps: null, rest: null, notes: null });
        else {
          const body = draftOf(p).trim();
          if (!body) throw new Error('empty');
          await sendMessage({ coachId: user.id, athleteId, senderId: user.id, body });
        }
        setResults((s) => ({ ...s, [p.id]: 'ok' }));
      } catch {
        setResults((s) => ({ ...s, [p.id]: 'fail' }));
      }
    }
    setApplying(false);
  };

  const setAll = (v: boolean) => setSelected(Object.fromEntries(all.map(({ p }) => [p.id, v])));

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-10 pt-5" dir={dir} data-testid="week-manager">
      <header className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate('/coach')} aria-label={t('common.back')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim">
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <h1 className="flex-1 truncate text-[22px] font-bold text-cloud">{t('week.title')}</h1>
      </header>

      <p className="mb-5 rounded-2xl border border-ink-border bg-ink-surface px-4 py-3 text-xs leading-relaxed text-cloud-dim">
        <Sparkles className="me-1.5 inline h-3.5 w-3.5 text-lime" />{t('week.intro')}
      </p>

      {error && <p className="mb-3 rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">{t('coach.loadError')}</p>}
      {loading && !error && (
        <div className="mb-5 flex items-center gap-2 text-xs text-cloud-dim" data-testid="week-loading">
          <Loader2 className="h-4 w-4 animate-spin" />{t('week.loading', { done, total: roster?.length ?? 0 })}
        </div>
      )}

      {roster && roster.length === 0 && <p className="py-10 text-center text-sm text-cloud-dim">{t('week.noAthletes')}</p>}

      {!loading && roster && roster.length > 0 && (
        <>
          {/* Recovery map */}
          <section className="mb-6" data-testid="recovery-map">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-cloud"><ActivityIcon className="h-4 w-4 text-lime" />{t('week.recoveryMap')}</h2>
            <p className="mb-3 text-[11px] leading-relaxed text-cloud-muted">{t('week.recoveryHint')}</p>
            <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-surface">
              <table className="w-full min-w-[560px] border-separate border-spacing-1 text-center text-[11px]">
                <thead>
                  <tr>
                    <th className="sticky start-0 bg-ink-surface px-2 py-1 text-start font-medium text-cloud-dim">{t('coach.athletes')}</th>
                    {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((g) => <th key={g} className="px-1 py-1 font-medium text-cloud-dim">{t(GROUP_KEY[g])}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => {
                    const d = data[r.athlete_id];
                    return (
                      <tr key={r.athlete_id}>
                        <td className="sticky start-0 max-w-[120px] truncate bg-ink-surface px-2 py-1 text-start text-cloud" dir="auto">{r.display_name ?? '—'}</td>
                        {!d ? (
                          <td colSpan={8} className="rounded-lg bg-rust/10 py-1.5 text-rust">{t('week.athleteError')}</td>
                        ) : !d.trained ? (
                          <td colSpan={8} className="rounded-lg bg-ink-elevated py-1.5 text-cloud-muted">{t('week.noTraining')}</td>
                        ) : groupRecovery(d.recovery).map((g) => (
                          <td key={g.group} className={cn('rounded-lg py-1.5 font-semibold tabular-nums', CELL[g.status])} dir="ltr">
                            {g.percent == null ? '—' : `${g.percent}%`}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Suggestions */}
          <section data-testid="week-suggestions">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-cloud">{t('week.suggestions')} <span className="text-cloud-muted">{all.length}</span></h2>
              {all.length > 0 && (
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={() => setAll(true)} className="text-lime">{t('week.selectAll')}</button>
                  <button type="button" onClick={() => setAll(false)} className="text-cloud-dim">{t('week.selectNone')}</button>
                </div>
              )}
            </div>
            {all.length === 0 && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-lime/20 bg-lime/5 px-4 py-3.5">
                <Check className="h-5 w-5 text-lime" /><p className="text-sm text-cloud">{t('week.none')}</p>
              </div>
            )}
            <div className="space-y-3">
              {roster.map((r) => {
                const d = data[r.athlete_id];
                if (!d) return null;
                const notes = statusNotes(d, t);
                if (!d.week.proposals.length && !notes.length) return null;
                return (
                  <article key={r.athlete_id} className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="week-athlete">
                    <button type="button" onClick={() => navigate(`/coach/athlete/${r.athlete_id}`)} className="mb-2 flex w-full items-center gap-3 text-start">
                      <Avatar id={r.athlete_id} name={r.display_name} url={r.avatar_url} size={34} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-cloud" dir="auto">{r.display_name ?? '—'}</span>
                    </button>
                    {notes.length > 0 && (
                      <ul className="mb-2 space-y-1">
                        {notes.map((n) => <li key={n} className="text-[11px] leading-relaxed text-cloud-muted">• {n}</li>)}
                      </ul>
                    )}
                    <ul className="space-y-2">
                      {d.week.proposals.map((p) => (
                        <ProposalCard key={p.id} p={p} t={t} checked={!!selected[p.id]} result={results[p.id]} draft={draftOf(p)}
                          onToggle={() => setSelected((s) => ({ ...s, [p.id]: !s[p.id] }))}
                          onDraft={(v) => setDrafts((s) => ({ ...s, [p.id]: v }))} />
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {pending.length > 0 && !loading && (
        <div className="sticky bottom-3 z-30 mt-5">
          <button type="button" onClick={apply} disabled={applying} data-testid="week-approve"
            className="mx-auto flex h-12 w-full max-w-lg items-center justify-center gap-2 rounded-2xl bg-lime text-sm font-bold text-ink-bg shadow-lg shadow-black/40 disabled:opacity-60">
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t('week.approve', { n: pending.length })}
          </button>
        </div>
      )}
    </div>
  );
}

function statusNotes(d: AthleteWeekData, t: T): string[] {
  const out: string[] = [];
  const n = d.week.nutrition;
  if (n.status === 'on_track') out.push(t('week.nutOnTrack', { rate: signed(n.rate.pctPerWeek) }));
  if (n.status === 'too_early') out.push(t('week.nutTooEarly', { days: n.daysOnGoal }));
  if (n.status === 'at_floor') out.push(t('week.nutAtFloor', { kcal: n.floor }));
  if (d.week.volumeBlocked === 'adherence' && d.week.adherence != null) out.push(t('week.volAdherence', { pct: Math.round(d.week.adherence * 100) }));
  if (d.week.volumeBlocked === 'sleep') out.push(t('week.volSleep'));
  return out;
}

function ProposalCard({ p, t, checked, result, draft, onToggle, onDraft }: {
  p: Proposal; t: T; checked: boolean; result?: Result; draft?: string; onToggle: () => void; onDraft: (v: string) => void;
}) {
  let icon = <MessageCircle className="h-4 w-4 text-sky" />;
  let title = '';
  let why = '';
  if (p.kind === 'kcal') {
    const o = p.outcome;
    icon = <Flame className="h-4 w-4 text-gold" />;
    title = t('week.kcalTitle', { from: p.from, to: p.to });
    why = `${t('week.kcalWhy', { rate: signed(o.rate.pctPerWeek), days: o.rate.spanDays, points: o.rate.points, target: signed(p.mode === 'cut' ? -o.targetPct : p.mode === 'bulk' ? o.targetPct : 0) })} ${o.base === 'target' ? t('week.kcalBaseTarget') : t('week.kcalBaseIntake', { days: o.loggedDays })}`;
  } else if (p.kind === 'add_set') {
    icon = <Dumbbell className="h-4 w-4 text-lime" />;
    title = t('week.setTitle', { exercise: p.add.row.name, from: p.add.row.sets, to: p.add.toSets });
    why = t('week.setWhy', { muscle: t(TARGET_KEY[p.add.target]), now: p.add.plannedNow, after: p.add.plannedAfter });
  } else {
    title = t(messageTitle(p.message));
    why = messageWhy(p.message, t);
  }
  return (
    <li className={cn('rounded-xl border p-3', checked ? 'border-lime/40 bg-lime/[0.04]' : 'border-ink-border')} data-testid="week-proposal">
      <div className="flex items-start gap-3">
        <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle} disabled={result === 'ok'}
          className={cn('mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border', checked ? 'border-lime bg-lime text-ink-bg' : 'border-ink-border')}>
          {checked && <Check className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-cloud">{icon}<span>{title}</span></div>
          <p className="mt-1 text-xs leading-relaxed text-cloud-dim">{why}</p>
          {p.kind === 'message' && (
            <textarea value={draft ?? ''} onChange={(e) => onDraft(e.target.value)} rows={4} dir="auto" aria-label={t('week.edit')} disabled={result === 'ok'}
              className="mt-2 w-full resize-y rounded-lg border border-ink-border bg-ink-bg px-3 py-2 text-xs leading-relaxed text-cloud focus:border-lime focus:outline-none" />
          )}
          {p.refs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {p.refs.map((id) => REFS[id]).filter(Boolean).map((r) => (
                <a key={r.id} href={r.url} target="_blank" rel="noreferrer" title={r.citation} className="rounded-md bg-ink-elevated px-2 py-0.5 text-[10px] text-cloud-dim hover:text-lime">{r.short}</a>
              ))}
            </div>
          )}
        </div>
        {result === 'busy' && <Loader2 className="h-4 w-4 animate-spin text-cloud-dim" />}
        {result === 'ok' && <span className="flex items-center gap-1 text-[11px] font-semibold text-lime"><Check className="h-4 w-4" />{t('week.applied')}</span>}
        {result === 'fail' && <span className="flex items-center gap-1 text-[11px] font-semibold text-rust"><X className="h-4 w-4" />{t('week.failed')}</span>}
      </div>
    </li>
  );
}
