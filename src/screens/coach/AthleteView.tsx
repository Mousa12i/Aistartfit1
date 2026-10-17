import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, Check, ChevronDown, ChevronLeft, ClipboardCheck, Columns2, HeartPulse, Sparkles, Stethoscope, Utensils, Dumbbell, Pencil, Plus, TrendingUp, UserMinus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import {
  addHabit, archiveHabit, assignPlan, coachErrorKey, draftCheckinReply, endCoachLink, fetchRoster, listHabits, listCheckins, listGivableRoutines, listReplies, loadAthleteDetail, loadIntake, loadNote,
  reviewCheckin, saveNote, setAthleteTargets, updatePlanExercise,
  type AthleteDetail, type Checkin, type Habit, type HabitLog, type PlanExerciseRow, type QuickReply, type RoutineOption,
} from '@/lib/coach/api';
import { athleteSignals, plannedPerWeek, type RosterRow } from '@/lib/coach/insights';
import { checkinGlance, ymdLocal, addDaysYmd, type Glance } from '@/lib/coach/checkin-glance';
import { OUTCOME_ADVICE, SYMPTOMS, type CoachIntake } from '@/lib/coach/screening';
import { shortDate } from '@/lib/coach/recovery-plan';
import { rateFeedback, weightRate, type RateStatus } from '@/lib/nutrition/engine';
import { strengthProgress } from '@/lib/coach/progress';
import { Avatar, Lightbox, PrivatePhoto, RiskBadge, ScoreDots, Sheet, Sparkline, StatBlock, humanize, reasonText, relativeDays } from './ui';
import { ChatThread } from './ChatThread';
import { AthleteBodyMap } from './AthleteBodyMap';

type Tab = 'overview' | 'training' | 'nutrition' | 'checkins' | 'chat';
type T = (k: MessageKey, v?: Record<string, string | number>) => string;

const TABS: [Tab, MessageKey][] = [
  ['overview', 'coach.tabOverview'], ['training', 'coach.tabTraining'], ['nutrition', 'coach.tabNutrition'], ['checkins', 'coach.tabCheckins'], ['chat', 'coach.tabChat'],
];

const STATUS_KEY: Record<RateStatus, MessageKey> = {
  on_track: 'goal.statusOnTrack', too_fast: 'goal.statusTooFast', too_slow: 'goal.statusTooSlow',
  wrong_direction: 'goal.statusWrongWay', stable: 'goal.statusStable', drifting: 'goal.statusDrifting',
};

const MODE_KEY: Record<string, MessageKey> = { cut: 'goal.cutTitle', bulk: 'goal.bulkTitle', recomp: 'goal.recompTitle', maintain: 'coach.modeMaintain' };

const field = 'w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-2.5 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none';

export function AthleteView() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, dir } = useI18n();
  const [row, setRow] = useState<RosterRow | null>(null);
  const [detail, setDetail] = useState<AthleteDetail | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const tab = (params.get('tab') as Tab) || 'overview';
  const now = useMemo(() => new Date(), [detail]); // eslint-disable-line react-hooks/exhaustive-deps
  const me = user?.id ?? '';

  const load = useCallback(async () => {
    try {
      const roster = await fetchRoster();
      const r = roster.find((x) => x.athlete_id === id) ?? null;
      setRow(r);
      if (!r) { setMissing(true); return; }
      const [d, c, q] = await Promise.all([loadAthleteDetail(id), listCheckins(me, id), listReplies(me)]);
      setDetail(d);
      setCheckins(c);
      setReplies(q);
    } catch {
      setError(t('coach.loadError'));
    }
  }, [id, me, t]);

  useEffect(() => { if (me) load(); }, [load, me]);

  const setTab = (next: Tab) => setParams({ tab: next });

  if (missing) {
    return (
      <div className="min-h-screen bg-ink-bg px-5 pt-5" dir={dir}>
        <button type="button" onClick={() => navigate('/coach')} className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></button>
        <p className="text-sm text-cloud-dim">{t('coach.athleteGone')}</p>
      </div>
    );
  }

  const s = row ? athleteSignals(row, now) : null;
  const first = (row?.display_name ?? '').split(' ')[0];

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-40 pt-5" dir={dir} data-testid="athlete-view">
      <header className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate('/coach')} aria-label={t('common.back')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim">
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        {row && <Avatar id={row.athlete_id} name={row.display_name} url={row.avatar_url} size={44} />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-cloud">{row?.display_name || '…'}</h1>
          {s && <RiskBadge level={s.level} t={t} />}
        </div>
      </header>

      <nav className="sticky top-0 z-20 -mx-5 mb-4 flex gap-1 overflow-x-auto border-b border-ink-border/60 bg-ink-bg/90 px-5 pb-2 pt-1 backdrop-blur" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`}
            className={cn('relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold', tab === k ? 'text-cloud' : 'text-cloud-dim')}>
            {t(label)}
            {k === 'checkins' && (row?.pending_checkins ?? 0) > 0 && <span className="ms-1 inline-block h-1.5 w-1.5 rounded-full bg-lime align-middle" />}
            {k === 'chat' && (row?.unread ?? 0) > 0 && <span className="ms-1 inline-block h-1.5 w-1.5 rounded-full bg-sky align-middle" />}
            {tab === k && <span className="absolute inset-x-2 -bottom-2 h-0.5 rounded-full bg-lime" />}
          </button>
        ))}
      </nav>

      {error && <p className="mb-3 rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">{error}</p>}
      {!row || (!detail && tab !== 'chat') ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-surface" />)}</div>
      ) : tab === 'overview' ? (
        <Overview row={row} detail={detail!} now={now} me={me} t={t} onRemoved={() => navigate('/coach')} />
      ) : tab === 'training' ? (
        <Training athleteId={id} me={me} detail={detail!} now={now} t={t} reload={load} />
      ) : tab === 'nutrition' ? (
        <Nutrition athleteId={id} row={row} detail={detail!} t={t} reload={load} />
      ) : tab === 'checkins' ? (
        <Checkins items={checkins} replies={replies} firstName={first} t={t} reload={load} row={row} detail={detail!} me={me} />
      ) : (
        <ChatThread coachId={me} athleteId={id} me={me} replies={replies} firstName={first} />
      )}
    </div>
  );
}

// ---------------- overview ----------------

function Overview({ row, detail, now, me, t, onRemoved }: { row: RosterRow; detail: AthleteDetail; now: Date; me: string; t: T; onRemoved: () => void }) {
  const s = athleteSignals(row, now);
  const [note, setNote] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeErr, setRemoveErr] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { lang } = useI18n();

  useEffect(() => { loadNote(me, row.athlete_id).then(setNote).catch(() => setNote('')); }, [me, row.athlete_id]);

  const today = ymdLocal(now);
  const rate = weightRate(detail.weights.map((w) => ({ date: w.date, kg: w.kg })), today, 21);
  const mode = (row.goal_mode ?? 'maintain') as 'cut' | 'bulk' | 'maintain' | 'recomp';
  const fb = rate ? rateFeedback(mode, Number(row.rate_pct ?? 0), rate.pctPerWeek) : null;
  const lastW = detail.weights[detail.weights.length - 1];
  // Last 7 nights: today and the 6 days before (detail.daily holds 14 days).
  const since7 = addDaysYmd(today, -6);
  const sleep = detail.daily.filter((d) => d.sleep_hours != null && d.sleep_hours > 0 && d.date >= since7 && d.date <= today);
  const avgSleep = sleep.length ? sleep.reduce((a, d) => a + (d.sleep_hours ?? 0), 0) / sleep.length : null;

  return (
    <div className="space-y-4">
      {s.reasons.length > 0 && (
        <div className="rounded-2xl border border-rust/25 bg-rust/[0.06] p-4">
          <div className="mb-1.5 text-sm font-semibold text-cloud">{t('coach.whyFlagged')}</div>
          <ul className="space-y-1 text-xs text-cloud-dim">{s.reasons.map((r) => <li key={r.code}>• {reasonText(r, t)}</li>)}</ul>
          <p className="mt-2 text-[10px] text-cloud-muted">{t('coach.riskRuleNote')}</p>
        </div>
      )}

      <IntakeCard row={row} me={me} t={t} lang={lang} />

      <AthleteBodyMap row={row} />

      <div className="grid grid-cols-2 gap-2">
        <StatBlock label={t('coach.statSessions7')} value={row.workouts_7d} sub={t('coach.statSessions28', { n: row.workouts_28d })} />
        <StatBlock label={t('coach.statFoodDays')} value={`${row.food_days_7d}/7`} sub={t('coach.statToday', { kcal: row.kcal_today, protein: Math.round(row.protein_today) })} />
        <StatBlock label={t('coach.statLastWorkout')} value={<span className="text-base">{relativeDays(row.last_workout_at, now, t)}</span>} />
        <StatBlock label={t('coach.statSleep')} value={avgSleep != null ? t('recplan.hours', { h: avgSleep.toFixed(1) }) : '—'} sub={t('coach.statSleepSub7', { n: sleep.length })} />
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-cloud-dim">{t('coach.weightTrend')}</div>
            <div className="text-2xl font-bold tabular-nums text-cloud">{lastW ? t('coach.unitKg', { n: lastW.kg.toFixed(1) }) : '—'}</div>
            <div className="text-[11px] text-cloud-dim">{t(MODE_KEY[mode] ?? 'coach.modeMaintain')}{row.rate_pct ? ` · ${t('coach.pctPerWeek', { pct: Number(row.rate_pct).toFixed(2) })}` : ''}</div>
          </div>
          <Sparkline points={detail.weights.map((w) => w.kg)} width={140} height={48} />
        </div>
        {rate && fb ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-ink-elevated px-3 py-2 text-xs">
            <span className="text-cloud-dim">{t('coach.pctPerWeek', { pct: ltr(`${rate.pctPerWeek > 0 ? '+' : ''}${rate.pctPerWeek.toFixed(2)}`) })}</span>
            <span className={cn('font-semibold', fb.status === 'on_track' || fb.status === 'stable' ? 'text-lime' : 'text-gold')}>{t(STATUS_KEY[fb.status])}</span>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-cloud-muted">{t('goal.progressNeedData')}</p>
        )}
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-4">
        <div className="mb-2 text-xs text-cloud-dim">{t('coach.profile')}</div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-cloud-muted">{t('coach.goal')}</dt><dd className="text-cloud">{humanize(row.fitness_goal, t)}</dd>
          <dt className="text-cloud-muted">{t('coach.experience')}</dt><dd className="text-cloud">{humanize(row.experience_level, t)}</dd>
          <dt className="text-cloud-muted">{t('goal.age')}</dt><dd className="text-cloud">{row.age ?? '—'}</dd>
          <dt className="text-cloud-muted">{t('goal.height')}</dt><dd className="text-cloud">{row.height_cm ?? '—'}</dd>
        </dl>
        {row.limitations && <p className="mt-2 rounded-lg bg-gold/10 px-2.5 py-1.5 text-xs text-gold">{t('coach.limitations')}: {row.limitations}</p>}
      </div>

      <HabitsManager athleteId={row.athlete_id} me={me} now={now} t={t} />

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-cloud">{t('coach.privateNotes')}</span>
          {noteSaved && <span className="text-[11px] text-lime">{t('coach.saved')}</span>}
        </div>
        <p className="mb-2 text-[11px] text-cloud-muted">{t('coach.privateNotesHelp')}</p>
        <textarea
          value={note ?? ''}
          onChange={(e) => setNote(e.target.value)}
          onBlur={async () => { if (note == null) return; await saveNote(me, row.athlete_id, note).catch(() => undefined); setNoteSaved(true); window.setTimeout(() => setNoteSaved(false), 1500); }}
          rows={4}
          placeholder={t('coach.notesPlaceholder')}
          className={field}
          data-testid="coach-notes"
        />
      </div>

      <button type="button" onClick={() => setConfirmRemove(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-border py-2.5 text-xs font-semibold text-cloud-dim hover:text-rust">
        <UserMinus className="h-4 w-4" />{t('coach.removeAthlete')}
      </button>
      <Sheet open={confirmRemove} title={t('coach.removeAthlete')} onClose={() => setConfirmRemove(false)}>
        <p className="mb-4 text-sm text-cloud-dim">{t('coach.removeConfirm', { name: row.display_name ?? '' })}</p>
        {removeErr && <p className="mb-3 rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">{t('coach.saveError')}</p>}
        <button type="button" disabled={removing} onClick={async () => {
          setRemoving(true); setRemoveErr(false);
          try { await endCoachLink(row.athlete_id); onRemoved(); } catch { setRemoveErr(true); } finally { setRemoving(false); }
        }} className="w-full rounded-xl bg-rust py-3 text-sm font-bold text-white disabled:opacity-60" data-testid="remove-confirm">{t('coach.removeAthlete')}</button>
      </Sheet>
    </div>
  );
}

// ---------------- training ----------------

function Training({ athleteId, me, detail, now, t, reload }: { athleteId: string; me: string; detail: AthleteDetail; now: Date; t: T; reload: () => Promise<void> }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState<PlanExerciseRow | null>(null);
  const [giveOpen, setGiveOpen] = useState(false);
  const [routines, setRoutines] = useState<RoutineOption[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const days = useMemo(() => {
    const m = new Map<number, { label: string; items: PlanExerciseRow[] }>();
    for (const e of detail.plan?.exercises ?? []) {
      const d = m.get(e.day_index) ?? { label: e.day_label ?? t('coach.dayN', { n: e.day_index + 1 }), items: [] };
      d.items.push(e);
      m.set(e.day_index, d);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }, [detail.plan, t]);

  const openGive = async () => {
    setGiveOpen(true);
    if (!routines) setRoutines(await listGivableRoutines(me).catch(() => []));
  };

  const give = async (planId: string) => {
    setBusy(planId);
    try {
      await assignPlan(athleteId, planId);
      setGiveOpen(false);
      setMsg(t('coach.routineGiven'));
      await reload();
    } catch {
      setMsg(t('coach.saveError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-xl bg-lime/10 px-3 py-2 text-xs text-lime">{msg}</p>}
      <button type="button" onClick={() => navigate(`/coach/athlete/${athleteId}/recovery-plan`)} data-testid="open-recovery-plan"
        className="flex w-full items-center gap-3 rounded-2xl border border-sky/40 bg-sky/[0.06] px-4 py-3.5 text-start">
        <HeartPulse className="h-5 w-5 flex-shrink-0 text-sky" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-cloud">{t('recplan.title')}</span>
          <span className="block text-xs text-cloud-dim">{t('recplan.entry')}</span>
        </span>
      </button>
      <div className="rounded-2xl border border-ink-border bg-ink-surface p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-cloud-dim">{t('coach.activeRoutine')}</div>
            <div className="truncate text-base font-bold text-cloud">{detail.plan?.name ?? t('coach.noRoutine')}</div>
          </div>
          <div className="flex flex-shrink-0 gap-1.5">
            {detail.plan && <button type="button" onClick={() => navigate(`/coach/athlete/${athleteId}/program`)} className="rounded-xl border border-lime/40 px-3 py-2 text-xs font-bold text-lime" data-testid="edit-program">{t('coach.editProgram')}</button>}
            <button type="button" onClick={openGive} className="rounded-xl bg-lime px-3 py-2 text-xs font-bold text-ink-bg" data-testid="give-routine">{t('coach.giveRoutine')}</button>
          </div>
        </div>
        {days.map((d) => (
          <div key={d.label} className="mb-3 last:mb-0">
            <div className="mb-1.5 text-[11px] font-semibold text-lime">{d.label}</div>
            <ul className="divide-y divide-ink-border/50 rounded-xl bg-ink-elevated/50">
              {d.items.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setEditing(e)} className="flex w-full items-center gap-3 px-3 py-2.5 text-start" data-testid="plan-exercise">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-cloud">{e.name}</div>
                      <div className="text-[11px] text-cloud-dim" dir="ltr">{e.sets} × {e.reps}{e.rest_seconds ? ` · ${e.rest_seconds}s` : ''}{e.rir_target != null ? ` · RIR ${e.rir_target}` : ''}</div>
                      {e.notes && <div className="mt-0.5 truncate text-[11px] text-gold">{e.notes}</div>}
                    </div>
                    <Pencil className="h-4 w-4 flex-shrink-0 text-cloud-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <StrengthProgress detail={detail} t={t} />

      <div>
        <h3 className="mb-2 text-sm font-semibold text-cloud">{t('coach.recentSessions')}</h3>
        {detail.sessions.length === 0 && <p className="text-xs text-cloud-dim">{t('coach.noSessions')}</p>}
        <ul className="space-y-2">
          {detail.sessions.slice(0, 12).map((s) => {
            const openNow = openSession === s.id;
            const byEx = new Map<string, { reps: number | null; weight: number | null }[]>();
            for (const l of s.sets.filter((x) => x.completed)) {
              const k = l.exercise_name ?? '—';
              byEx.set(k, [...(byEx.get(k) ?? []), { reps: l.reps, weight: l.weight }]);
            }
            return (
              <li key={s.id} className="rounded-2xl border border-ink-border bg-ink-surface">
                <button type="button" onClick={() => setOpenSession(openNow ? null : s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-start">
                  <Dumbbell className="h-4 w-4 flex-shrink-0 text-lime" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-cloud">{s.plan_name ?? t('coach.workout')}</div>
                    <div className="text-[11px] text-cloud-dim">
                      {relativeDays(s.completed_at, now, t)} · {t('coach.sessionMeta', { min: Math.round((s.duration_seconds ?? 0) / 60), sets: s.total_sets ?? 0 })}{s.total_volume ? ` · ${t('coach.unitKg', { n: Math.round(Number(s.total_volume)) })}` : ''}{s.session_rpe ? ` · RPE ${s.session_rpe}` : ''}
                    </div>
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-cloud-muted transition-transform', openNow && 'rotate-180')} />
                </button>
                {openNow && (
                  <div className="border-t border-ink-border/60 px-4 py-3">
                    {[...byEx.entries()].map(([name, sets]) => (
                      <div key={name} className="mb-1.5 text-xs">
                        <span className="text-cloud">{name}</span>{' '}
                        <span className="text-cloud-dim" dir="ltr">{sets.map((x) => `${x.weight ?? 0}×${x.reps ?? 0}`).join(', ')}</span>
                      </div>
                    ))}
                    {s.notes && <p className="mt-2 text-[11px] text-cloud-muted">{s.notes}</p>}
                    {byEx.size === 0 && <p className="text-xs text-cloud-dim">{t('coach.noSetDetail')}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <ExerciseSheet ex={editing} onClose={() => setEditing(null)} t={t} onSaved={async () => { setEditing(null); setMsg(t('coach.saved')); await reload(); }} />

      <Sheet open={giveOpen} title={t('coach.giveRoutine')} onClose={() => setGiveOpen(false)}>
        <p className="mb-3 text-xs text-cloud-dim">{t('coach.giveRoutineHelp')}</p>
        {!routines && <div className="h-20 animate-pulse rounded-xl bg-ink-elevated" />}
        <ul className="space-y-2">
          {(routines ?? []).map((r) => (
            <li key={r.id}>
              <button type="button" disabled={!!busy} onClick={() => give(r.id)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-ink-elevated px-3.5 py-3 text-start disabled:opacity-60">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-cloud">{r.name}</span>
                  <span className="text-[11px] text-cloud-dim">{r.is_public ? t('coach.readyMade') : t('coach.yourRoutine')}{r.sessions_per_week ? ` · ${t('coach.perWeek', { n: r.sessions_per_week })}` : ''}</span>
                </span>
                <span className="text-xs font-semibold text-lime">{busy === r.id ? '…' : t('coach.give')}</span>
              </button>
            </li>
          ))}
        </ul>
        {routines && routines.length === 0 && <p className="text-xs text-cloud-dim">{t('coach.noRoutinesToGive')}</p>}
      </Sheet>
    </div>
  );
}

function ExerciseSheet({ ex, onClose, onSaved, t }: { ex: PlanExerciseRow | null; onClose: () => void; onSaved: () => void; t: T }) {
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [rest, setRest] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!ex) return;
    setSets(String(ex.sets));
    setReps(ex.reps);
    setRest(ex.rest_seconds != null ? String(ex.rest_seconds) : '');
    setNotes(ex.notes ?? '');
    setErr(null);
  }, [ex]);
  const save = async () => {
    if (!ex) return;
    const n = Number(sets);
    if (!Number.isInteger(n) || n < 1 || n > 10) { setErr(t('coach.setsRange')); return; }
    const r = rest.trim() ? Number(rest) : null;
    if (r != null && (!Number.isFinite(r) || r < 0 || r > 900)) { setErr(t('coach.restRange')); return; }
    try {
      await updatePlanExercise(ex.id, { sets: n, reps: reps.trim().slice(0, 20) || null, rest: r != null ? Math.round(r) : null, notes });
      onSaved();
    } catch {
      setErr(t('coach.saveError'));
    }
  };
  return (
    <Sheet open={!!ex} title={ex?.name ?? ''} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2">
        <label><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.sets')}</span><input value={sets} onChange={(e) => setSets(e.target.value)} inputMode="numeric" className={field} dir="ltr" data-testid="ex-sets" /></label>
        <label><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.reps')}</span><input value={reps} onChange={(e) => setReps(e.target.value)} maxLength={20} className={field} dir="ltr" /></label>
        <label><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.restSec')}</span><input value={rest} onChange={(e) => setRest(e.target.value)} inputMode="numeric" maxLength={3} className={field} dir="ltr" data-testid="ex-rest" /></label>
      </div>
      <label className="mt-3 block"><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.cue')}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={300} placeholder={t('coach.cuePlaceholder')} className={field} />
      </label>
      {err && <p className="mt-2 text-xs text-rust">{err}</p>}
      <button type="button" onClick={save} className="mt-4 w-full rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg" data-testid="ex-save">{t('common.save')}</button>
      <p className="mt-2 text-[11px] text-cloud-muted">{t('coach.editAppliesNote')}</p>
    </Sheet>
  );
}

// ---------------- nutrition ----------------

function Nutrition({ athleteId, row, detail, t, reload }: { athleteId: string; row: RosterRow; detail: AthleteDetail; t: T; reload: () => Promise<void> }) {
  const navigate = useNavigate();
  const settings = detail.settings ?? {};
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<string>(String(settings.goal_mode ?? 'maintain'));
  const [rate, setRate] = useState(String(settings.rate_pct ?? 0));
  const [kcal, setKcal] = useState(settings.kcal_override != null ? String(settings.kcal_override) : '');
  const [protein, setProtein] = useState(settings.protein_g_per_kg != null ? String(settings.protein_g_per_kg) : '');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { lang } = useI18n();

  const byDay = useMemo(() => {
    const m = new Map<string, { kcal: number; protein: number; items: typeof detail.meals }>();
    for (const meal of detail.meals) {
      const d = m.get(meal.logged_date) ?? { kcal: 0, protein: 0, items: [] };
      d.kcal += Number(meal.kcal ?? 0);
      d.protein += Number(meal.protein ?? 0);
      d.items.push(meal);
      m.set(meal.logged_date, d);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 7);
  }, [detail.meals]);

  const target = settings.kcal_override != null ? Number(settings.kcal_override) : null;
  const maxK = Math.max(target ?? 0, ...byDay.map(([, d]) => d.kcal), 1);
  const weight = detail.weights[detail.weights.length - 1]?.kg ?? row.profile_weight_kg ?? null;

  const save = async () => {
    setErr(null);
    const k = kcal.trim() ? Math.round(Number(kcal)) : null;
    const p = protein.trim() ? Number(protein.replace(',', '.')) : null;
    if (k != null && (k < 1200 || k > 6000)) { setErr(t('coach.kcalRange')); return; }
    if (p != null && (p < 0.8 || p > 3.3)) { setErr(t('coach.proteinRange')); return; }
    const r = mode === 'cut' ? Math.min(1, Math.max(0.25, Number(rate) || 0.7)) : mode === 'bulk' ? Math.min(0.5, Math.max(0.1, Number(rate) || 0.25)) : 0;
    try {
      await setAthleteTargets(athleteId, { mode, rate: r, kcal: k, proteinPerKg: p });
      setOpen(false);
      setMsg(t('coach.targetsSaved'));
      await reload();
    } catch {
      setErr(t('coach.saveError'));
    }
  };

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-xl bg-lime/10 px-3 py-2 text-xs text-lime">{msg}</p>}
      <button type="button" onClick={() => navigate(`/coach/athlete/${athleteId}/nutrition-plan`)} data-testid="open-meal-plan"
        className="flex w-full items-center gap-3 rounded-2xl border border-lime/40 bg-lime/[0.06] px-4 py-3.5 text-start">
        <Utensils className="h-5 w-5 flex-shrink-0 text-lime" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-cloud">{t('mealplan.editorTitle')}</span>
          <span className="block text-xs text-cloud-dim">{t('mealplan.editorEntry')}</span>
        </span>
      </button>
      <div className="rounded-2xl border border-ink-border bg-ink-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-cloud-dim">{t('coach.targets')}</div>
            <div className="text-base font-bold text-cloud">{t(MODE_KEY[String(settings.goal_mode ?? 'maintain')] ?? 'coach.modeMaintain')}</div>
            <div className="mt-0.5 text-[11px] text-cloud-dim">
              {target ? t('coach.kcalN', { kcal: target }) : t('coach.kcalAuto')}
              {settings.protein_g_per_kg != null && weight ? ` · ${t('coach.proteinG', { g: Math.round(Number(settings.protein_g_per_kg) * weight) })}` : ''}
            </div>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-lime px-3 py-2 text-xs font-bold text-ink-bg" data-testid="edit-targets">{t('coach.editTargets')}</button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-cloud">{t('coach.last7Days')}</h3>
        {byDay.length === 0 && <p className="text-xs text-cloud-dim">{t('coach.noFood')}</p>}
        <ul className="space-y-2">
          {byDay.map(([date, d]) => (
            <li key={date} className="rounded-2xl border border-ink-border bg-ink-surface p-3.5">
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="w-16 flex-shrink-0 text-xs text-cloud-dim">{shortDate(date, lang)}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink-elevated" dir="ltr">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-lime" style={{ width: `${(d.kcal / maxK) * 100}%` }} />
                    {target && <span className="absolute inset-y-0 w-0.5 bg-cloud" style={{ left: `${(target / maxK) * 100}%` }} />}
                  </span>
                  <span className="w-32 flex-shrink-0 text-end text-xs tabular-nums text-cloud">{t('coach.kcalProtein', { kcal: Math.round(d.kcal), g: Math.round(d.protein) })}</span>
                </summary>
                <ul className="mt-2 space-y-1 border-t border-ink-border/60 pt-2">
                  {d.items.map((m) => (
                    <li key={m.id} className="flex justify-between gap-2 text-[11px]">
                      <span className="truncate text-cloud-dim">{m.name}</span>
                      <span className="flex-shrink-0 tabular-nums text-cloud-muted">{t('coach.kcalProtein', { kcal: Math.round(m.kcal), g: Math.round(Number(m.protein)) })}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </div>

      <Sheet open={open} title={t('coach.editTargets')} onClose={() => setOpen(false)}>
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {(['cut', 'maintain', 'bulk', 'recomp'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn('rounded-xl border py-2 text-xs font-semibold', mode === m ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')}>
              {t(MODE_KEY[m])}
            </button>
          ))}
        </div>
        {(mode === 'cut' || mode === 'bulk') && (
          <label className="mb-3 block"><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.ratePct')}</span>
            <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={field} dir="ltr" />
            <span className="mt-1 block text-[10px] text-cloud-muted">{t(mode === 'cut' ? 'coach.rateCutHelp' : 'coach.rateBulkHelp')}</span>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.fixedKcal')}</span><input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="numeric" placeholder={t('coach.auto')} className={field} dir="ltr" data-testid="target-kcal" /></label>
          <label><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.proteinPerKg')}</span><input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="decimal" placeholder={t('coach.auto')} className={field} dir="ltr" /></label>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-cloud-muted">{t('coach.targetsHelp')}</p>
        {err && <p className="mt-2 text-xs text-rust">{err}</p>}
        <button type="button" onClick={save} className="mt-4 w-full rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg" data-testid="save-targets">{t('common.save')}</button>
      </Sheet>
    </div>
  );
}

// ---------------- check-ins ----------------

function Checkins({ items, replies, firstName, t, reload, row, detail, me }: { items: Checkin[]; replies: QuickReply[]; firstName: string; t: T; reload: () => Promise<void>; row: RosterRow; detail: AthleteDetail; me: string }) {
  const { lang } = useI18n();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [ai, setAi] = useState<{ id: string } | null>(null);
  const [aiInfo, setAiInfo] = useState<Record<string, string>>({});
  const [habitLogs, setHabitLogs] = useState<{ habits: number; logs: { day: string; done: boolean }[] } | null>(null);
  useEffect(() => {
    listHabits(row.athlete_id).then((r) => setHabitLogs({ habits: r.habits.length, logs: r.logs })).catch(() => setHabitLogs(null));
  }, [row.athlete_id]);

  // The loaded logs: meals and daily check-ins cover 14 days, sessions 28 days.
  const dataFrom = addDaysYmd(ymdLocal(new Date()), -13);
  const glanceFor = (c: Checkin, prev: Checkin | undefined): Glance => {
    const to = ymdLocal(new Date(c.submitted_at));
    const from = addDaysYmd(to, -6);
    const done = habitLogs ? habitLogs.logs.filter((l) => l.done && l.day >= from && l.day <= to).length : 0;
    return checkinGlance({
      submittedAt: c.submitted_at, weightKg: c.weight_kg, waistCm: c.waist_cm,
      prev: prev ? { weightKg: prev.weight_kg, waistCm: prev.waist_cm, submittedAt: prev.submitted_at } : null,
      sessions: detail.sessions.map((s) => s.completed_at).filter((x): x is string => !!x),
      plannedPerWeek: plannedPerWeek(row),
      meals: detail.meals.map((m) => ({ date: m.logged_date, kcal: Number(m.kcal ?? 0), protein: Number(m.protein ?? 0) })),
      kcalTarget: detail.settings?.kcal_override != null ? Number(detail.settings.kcal_override) : null,
      sleep: detail.daily.map((d) => ({ date: d.date, hours: d.sleep_hours })),
      habits: habitLogs && habitLogs.habits > 0 ? { done, possible: habitLogs.habits * 7 } : null,
      dataFrom,
    });
  };

  const send = async (c: Checkin, draft: string) => {
    setBusy(c.id);
    setErrs((e) => ({ ...e, [c.id]: '' }));
    try {
      await reviewCheckin(c.id, draft.trim().slice(0, 4000));
      await reload();
    } catch {
      setErrs((e) => ({ ...e, [c.id]: t('coach.reviewError') }));
    } finally {
      setBusy(null);
    }
  };

  const draftWithAi = async (c: Checkin, g: Glance) => {
    setAi({ id: c.id });
    setErrs((e) => ({ ...e, [c.id]: '' }));
    try {
      const r = await draftCheckinReply(c.id, g);
      setDrafts((d) => ({ ...d, [c.id]: r.reply }));
      setAiInfo((x) => ({ ...x, [c.id]: t('coach.aiUsed', { used: r.used, limit: r.limit }) }));
    } catch (e) {
      const k = coachErrorKey(e);
      setErrs((x) => ({ ...x, [c.id]: k === 'athlete_ai_consent' ? t('coach.aiConsent', { name: firstName }) : k === 'daily_limit_reached' ? t('coach.aiLimit') : t('coach.aiError') }));
    } finally {
      setAi(null);
    }
  };

  if (items.length === 0) return <p className="py-8 text-center text-sm text-cloud-dim">{t('coach.noCheckins')}</p>;
  const template = t('coach.replyTemplate');
  const withPhotos = items.filter((c) => c.photo_paths.length > 0);
  return (
    <div className="space-y-3">
      {withPhotos.length >= 2 && <PhotoCompare first={withPhotos[withPhotos.length - 1]} last={withPhotos[0]} t={t} onOpen={setLightbox} />}
      {items.map((c, i) => {
        const prev = items[i + 1];
        const delta = c.weight_kg != null && prev?.weight_kg != null ? Number(c.weight_kg) - Number(prev.weight_kg) : null;
        const draft = drafts[c.id] ?? '';
        const g = !c.reviewed_at || i === 0 ? glanceFor(c, prev) : null;
        return (
          <article key={c.id} className={cn('rounded-2xl border p-4', c.reviewed_at ? 'border-ink-border bg-ink-surface' : 'border-lime/40 bg-lime/[0.04]')} data-testid="checkin-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-cloud">{t('coach.weekOf', { date: shortDate(c.week_of, lang) })}</div>
              {c.reviewed_at ? <span className="text-[11px] text-cloud-dim">{t('coach.reviewed')}</span> : <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold text-ink-bg">{t('coach.toReview')}</span>}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              {([['coach.ciSleep', c.sleep, false], ['coach.ciEnergy', c.energy, false], ['coach.ciStress', c.stress, true], ['coach.ciHunger', c.hunger, true], ['coach.ciTraining', c.training_adherence, false], ['coach.ciNutrition', c.nutrition_adherence, false]] as [MessageKey, number | null, boolean][]).map(([k, v, inv]) => (
                <div key={k} className="rounded-xl bg-ink-elevated px-2 py-2"><div className="text-cloud-dim">{t(k)}</div><ScoreDots value={v} invert={inv} /></div>
              ))}
            </div>
            {(c.weight_kg != null || c.waist_cm != null) && (
              <div className="mt-2 flex gap-4 text-xs text-cloud">
                {c.weight_kg != null && <span>{t('coach.unitKg', { n: Number(c.weight_kg).toFixed(1) })}{delta != null && <span className={cn('ms-1', delta < 0 ? 'text-sky' : 'text-gold')} dir="ltr">{delta > 0 ? '+' : ''}{delta.toFixed(1)}</span>}</span>}
                {c.waist_cm != null && <span>{t('coach.waist')} {t('coach.unitCm', { n: Number(c.waist_cm).toFixed(1) })}</span>}
              </div>
            )}
            {c.win && <p className="mt-3 text-xs"><span className="font-semibold text-lime">{t('coach.ciWin')}: </span><span dir="auto" className="text-cloud">{c.win}</span></p>}
            {c.struggle && <p className="mt-1.5 text-xs"><span className="font-semibold text-gold">{t('coach.ciStruggle')}: </span><span dir="auto" className="text-cloud">{c.struggle}</span></p>}
            {c.question && <p className="mt-1.5 text-xs"><span className="font-semibold text-sky">{t('coach.ciQuestion')}: </span><span dir="auto" className="text-cloud">{c.question}</span></p>}
            {(c.answers ?? []).map((a) => (
              <p key={a.q} className="mt-1.5 text-xs"><span className="font-semibold text-cloud-dim" dir="auto">{a.q} </span><span dir="auto" className="text-cloud">{a.a}</span></p>
            ))}
            {g && <GlancePanel g={g} t={t} lang={lang} />}
            {c.photo_paths.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">{c.photo_paths.map((p) => <PrivatePhoto key={p} path={p} className="aspect-[3/4] w-full rounded-xl" onOpen={setLightbox} />)}</div>
            )}
            {c.reviewed_at ? (
              c.coach_reply && <p dir="auto" className="mt-3 whitespace-pre-wrap rounded-xl bg-ink-elevated px-3 py-2 text-xs text-cloud-dim">{c.coach_reply}</p>
            ) : (
              <div className="mt-3">
                {g && (
                  <button type="button" disabled={!!ai} onClick={() => draftWithAi(c, g)} data-testid="ai-draft"
                    className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-sky/40 bg-sky/[0.06] py-2.5 text-xs font-bold text-sky disabled:opacity-60">
                    <Sparkles className="h-4 w-4" />{ai?.id === c.id ? t('coach.aiDrafting') : t('coach.aiDraft')}
                  </button>
                )}
                {aiInfo[c.id] && <p className="mb-2 text-[11px] text-cloud-muted">{t('coach.aiNote', { name: firstName })} · {aiInfo[c.id]}</p>}
                <textarea
                  value={draft}
                  onChange={(e) => setDrafts({ ...drafts, [c.id]: e.target.value })}
                  maxLength={4000}
                  dir="auto"
                  rows={draft.length > 200 ? 8 : 4}
                  placeholder={template}
                  className={field}
                  data-testid="checkin-reply"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {!draft && <button type="button" onClick={() => setDrafts({ ...drafts, [c.id]: template })} className="rounded-full border border-ink-border px-3 py-1 text-[11px] text-cloud-dim">{t('coach.useTemplate')}</button>}
                  {replies.map((r) => (
                    <button key={r.id} type="button" onClick={() => setDrafts({ ...drafts, [c.id]: (draft ? `${draft}\n` : '') + r.body.replace(/\{name\}/g, firstName) })} className="rounded-full border border-ink-border px-3 py-1 text-[11px] text-cloud-dim">{r.title}</button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy === c.id}
                  onClick={() => send(c, draft)}
                  className="mt-3 w-full rounded-xl bg-lime py-2.5 text-sm font-bold text-ink-bg disabled:opacity-50"
                  data-testid="checkin-send"
                >
                  {draft.trim() ? t('coach.sendReview') : t('coach.markReviewed')}
                </button>
                {errs[c.id] && <p className="mt-2 rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust" data-testid="checkin-error">{errs[c.id]}</p>}
              </div>
            )}
          </article>
        );
      })}
      <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

// ---------------- progress photos side by side ----------------

function PhotoCompare({ first, last, t, onOpen }: { first: Checkin; last: Checkin; t: T; onOpen: (url: string) => void }) {
  const { lang } = useI18n();
  const [i, setI] = useState(0);
  const n = Math.min(first.photo_paths.length, last.photo_paths.length) || 1;
  const pick = (c: Checkin) => c.photo_paths[Math.min(i, c.photo_paths.length - 1)];
  const dw = first.weight_kg != null && last.weight_kg != null ? Number(last.weight_kg) - Number(first.weight_kg) : null;
  const dwaist = first.waist_cm != null && last.waist_cm != null ? Number(last.waist_cm) - Number(first.waist_cm) : null;
  return (
    <section className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="photo-compare">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cloud"><Columns2 className="h-4 w-4 text-lime" />{t('coach.compareTitle')}</div>
      <div className="grid grid-cols-2 gap-2">
        {[first, last].map((c) => (
          <div key={c.id}>
            <PrivatePhoto path={pick(c)} className="aspect-[3/4] w-full rounded-xl" onOpen={onOpen} />
            <div className="mt-1 text-center text-[11px] text-cloud-dim">{shortDate(c.week_of, lang)}{c.weight_kg != null ? ` · ${t('coach.unitKg', { n: Number(c.weight_kg).toFixed(1) })}` : ''}</div>
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: n }, (_, k) => <button key={k} type="button" onClick={() => setI(k)} aria-label={`${k + 1}`} className={cn('h-2 w-6 rounded-full', i === k ? 'bg-lime' : 'bg-ink-elevated')} />)}
        </div>
      )}
      {(dw != null || dwaist != null) && (
        <div className="mt-3 flex justify-center gap-4 text-xs text-cloud">
          {dw != null && <span>{t('coach.unitKg', { n: ltr(`${dw > 0 ? '+' : ''}${dw.toFixed(1)}`) })}</span>}
          {dwaist != null && <span>{t('coach.waist')} {t('coach.unitCm', { n: ltr(`${dwaist > 0 ? '+' : ''}${dwaist.toFixed(1)}`) })}</span>}
        </div>
      )}
    </section>
  );
}

// ---------------- strength progress ----------------

function StrengthProgress({ detail, t }: { detail: AthleteDetail; t: T }) {
  const rows = useMemo(() => strengthProgress(detail.sessions), [detail.sessions]);
  if (!rows.length) return null;
  return (
    <section className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="strength-progress">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-cloud"><TrendingUp className="h-4 w-4 text-lime" />{t('coach.strengthTitle')}</div>
      <p className="mb-3 text-[11px] leading-relaxed text-cloud-muted">{t('coach.strengthNote')}</p>
      <ul className="space-y-2">
        {rows.slice(0, 8).map((r) => (
          <li key={r.name} className="flex items-center gap-3 rounded-xl bg-ink-elevated/60 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-cloud">{r.name}</div>
              <div className="text-[11px] text-cloud-dim"><span dir="ltr">{t('coach.unitKg', { n: r.best.weight })} × {r.best.reps}</span> · e1RM {t('coach.unitKg', { n: r.points[r.points.length - 1].toFixed(1) })} · {t('coach.sessionsN', { n: r.points.length })}</div>
            </div>
            <Sparkline points={r.points} width={64} height={26} />
            <span className={cn('w-14 text-end text-xs font-semibold tabular-nums', r.changePct > 0.5 ? 'text-lime' : r.changePct < -0.5 ? 'text-rust' : 'text-cloud-dim')} dir="ltr">
              {r.changePct > 0 ? '+' : ''}{r.changePct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------- habits (coach side) ----------------

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function HabitsManager({ athleteId, me, now, t }: { athleteId: string; me: string; now: Date; t: T }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [title, setTitle] = useState('');
  const [err, setErr] = useState(false);
  const load = useCallback(async () => {
    try { const r = await listHabits(athleteId); setHabits(r.habits); setLogs(r.logs); } catch { setErr(true); }
  }, [athleteId]);
  useEffect(() => { load(); }, [load]);
  const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(now); d.setDate(d.getDate() - (6 - k)); return ymd(d); });
  const add = async () => {
    if (title.trim().length < 2) return;
    try { await addHabit(me, athleteId, title); setTitle(''); await load(); } catch { setErr(true); }
  };
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="habits-manager">
      <div className="mb-1 text-sm font-semibold text-cloud">{t('coach.habitsTitle')}</div>
      <p className="mb-3 text-[11px] text-cloud-muted">{t('coach.habitsHelp')}</p>
      <ul className="space-y-2">
        {habits.map((h) => {
          const done = days.filter((d) => logs.some((l) => l.habit_id === h.id && l.day === d && l.done)).length;
          return (
            <li key={h.id} className="rounded-xl bg-ink-elevated/60 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-cloud" dir="auto">{h.title}</span>
                <span className="text-[11px] tabular-nums text-cloud-dim" dir="ltr">{done}/7</span>
                <button type="button" onClick={async () => { await archiveHabit(h.id).catch(() => setErr(true)); load(); }} aria-label={t('coach.remove')} className="text-cloud-muted hover:text-rust"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex gap-1" dir="ltr">
                {days.map((d) => {
                  const ok = logs.some((l) => l.habit_id === h.id && l.day === d && l.done);
                  return <span key={d} title={d} className={cn('flex h-5 flex-1 items-center justify-center rounded', ok ? 'bg-lime text-ink-bg' : 'bg-ink-bg')}>{ok && <Check className="h-3 w-3" />}</span>;
                })}
              </div>
            </li>
          );
        })}
      </ul>
      {habits.length < 6 && (
        <div className="mt-2 flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder={t('coach.habitPlaceholder')} className={field} dir="auto" data-testid="habit-input" />
          <button type="button" onClick={add} disabled={title.trim().length < 2} aria-label={t('coach.habitAdd')} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-lime text-ink-bg disabled:opacity-40" data-testid="habit-add"><Plus className="h-4 w-4" /></button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-rust">{t('coach.saveError')}</p>}
    </div>
  );
}

// ---------------- week at a glance (one check-in) ----------------

function GlancePanel({ g, t, lang }: { g: Glance; t: T; lang: string }) {
  const sign = (n: number) => ltr(`${n > 0 ? '+' : ''}${n.toFixed(1)}`);
  const cells: { k: MessageKey; v: string; sub?: string; tone?: string }[] = [
    { k: 'coach.glanceSessions', v: t('coach.glanceOf', { a: g.sessions, b: g.planned }), tone: g.sessions >= g.planned ? 'text-lime' : g.sessions === 0 ? 'text-rust' : undefined },
    { k: 'coach.glanceFood', v: t('coach.glanceOf', { a: g.foodDays, b: 7 }) },
    { k: 'coach.glanceKcal', v: g.avgKcal != null ? t('coach.kcalN', { kcal: g.avgKcal.toLocaleString(lang === 'ar' ? 'ar-u-nu-latn' : lang) }) : '—', sub: g.kcalVsTargetPct != null ? t('coach.glanceVsTarget', { pct: sign(g.kcalVsTargetPct) }) : undefined },
    { k: 'coach.glanceProtein', v: g.avgProtein != null ? t('coach.unitG', { n: g.avgProtein }) : '—' },
    { k: 'coach.glanceSleep', v: g.sleepAvg != null ? t('recplan.hours', { h: g.sleepAvg }) : '—', sub: g.sleepNights ? t('coach.glanceNights', { n: g.sleepNights }) : undefined },
    { k: 'coach.glanceWeight', v: g.weightDelta != null ? t('coach.unitKg', { n: sign(g.weightDelta) }) : '—', sub: g.daysSincePrev != null && g.weightDelta != null ? t('coach.glanceSince', { days: g.daysSincePrev }) : undefined },
  ];
  if (g.waistDelta != null) cells.push({ k: 'coach.glanceWaist', v: t('coach.unitCm', { n: sign(g.waistDelta) }) });
  if (g.habitPct != null) cells.push({ k: 'coach.glanceHabits', v: `${g.habitPct}%` });
  return (
    <section className="mt-3 rounded-xl border border-ink-border bg-ink-bg/60 p-3" data-testid="checkin-glance">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-cloud-dim">
        <Calendar className="h-3.5 w-3.5 text-lime" />{t('coach.glanceTitle')}
        <span className="font-normal text-cloud-muted">· {t('coach.glanceRange', { from: shortDate(g.from, lang), to: shortDate(g.to, lang) })}</span>
      </div>
      <dl className="grid grid-cols-3 gap-1.5 text-center">
        {cells.map((c) => (
          <div key={c.k} className="rounded-lg bg-ink-elevated/70 px-1.5 py-2">
            <dt className="text-[10px] text-cloud-dim">{t(c.k)}</dt>
            <dd className={cn('text-sm font-bold tabular-nums text-cloud', c.tone)}>{c.v}</dd>
            {c.sub && <dd className="text-[10px] text-cloud-muted">{c.sub}</dd>}
          </div>
        ))}
      </dl>
      {!g.complete && <p className="mt-2 text-[10px] text-cloud-muted">{t('coach.glanceIncomplete')}</p>}
    </section>
  );
}

// ---------------- intake and health screening (coach side) ----------------

/** Keeps a signed number ("-0.7", "+1.2") in reading order inside right-to-left text. */
const ltr = (s: string) => `\u2066${s}\u2069`;

const OUTCOME_TONE: Record<string, string> = {
  no_clearance: 'border-lime/30 bg-lime/[0.05] text-lime',
  clearance_before_vigorous: 'border-gold/40 bg-gold/[0.07] text-gold',
  clearance: 'border-gold/40 bg-gold/[0.07] text-gold',
  stop_and_clearance: 'border-rust/40 bg-rust/[0.07] text-rust',
};

function IntakeCard({ row, me, t, lang }: { row: RosterRow; me: string; t: T; lang: string }) {
  const [intake, setIntake] = useState<CoachIntake | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => { loadIntake(me, row.athlete_id).then(setIntake).catch(() => setIntake(null)); }, [me, row.athlete_id]);
  const first = (row.display_name ?? '').split(' ')[0] || '—';
  if (intake === undefined) return null;
  if (!intake) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="intake-missing">
        <ClipboardCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-cloud-dim" />
        <div>
          <div className="text-sm font-semibold text-cloud">{t('coach.intakeTitle')}</div>
          <p className="text-xs text-cloud-dim">{t('coach.intakeMissing', { name: first })}</p>
        </div>
      </div>
    );
  }
  const o = intake.outcome;
  return (
    <section className={cn('rounded-2xl border p-4', OUTCOME_TONE[o])} data-testid="intake-card">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start gap-3 text-start">
        <Stethoscope className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{t(`coach.outcome_${o}` as MessageKey)}</span>
          <span className="block text-xs text-cloud">{t(`coach.advice_${OUTCOME_ADVICE[o]}` as MessageKey)}</span>
          {intake.pregnant && <span className="mt-1 block text-xs text-cloud">{t('coach.intakePregnant')}</span>}
        </span>
        <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-cloud-dim transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <dl className="mt-3 space-y-1.5 border-t border-ink-border/60 pt-3 text-xs" data-testid="intake-detail">
          <Line k={t('coach.intakeRegular')} v={intake.exercises_regularly ? t('common.yes') : t('common.no')} />
          <Line k={t('coach.intakeDisease')} v={intake.known_disease ? t('common.yes') : t('common.no')} />
          <Line k={t('coach.intakeSymptoms')} v={intake.symptoms.length ? intake.symptoms.filter((x) => (SYMPTOMS as readonly string[]).includes(x)).map((x) => t(`symptom.${x}` as MessageKey)).join(' · ') : t('coach.intakeNone')} />
          {intake.goal && <Line k={t('coach.intakeGoal')} v={intake.goal} auto />}
          {intake.days_per_week != null && <Line k={t('coach.intakeDays')} v={String(intake.days_per_week)} />}
          {intake.minutes_per_session != null && <Line k={t('coach.intakeMinutes')} v={String(intake.minutes_per_session)} />}
          {intake.equipment && <Line k={t('coach.intakeEquipment')} v={intake.equipment} auto />}
          {intake.injuries && <Line k={t('coach.intakeInjuries')} v={intake.injuries} auto />}
          {intake.answers.map((a) => <Line key={a.q} k={a.q} v={a.a || '—'} auto />)}
          <p className="pt-1 text-[10px] text-cloud-muted">{t('coach.intakeSent', { date: new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(intake.submitted_at)) })} · {t('coach.intakeSource')}</p>
        </dl>
      )}
    </section>
  );
}

function Line({ k, v, auto }: { k: string; v: string; auto?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-2/5 flex-shrink-0 text-cloud-dim" dir="auto">{k}</dt>
      <dd className="min-w-0 flex-1 whitespace-pre-line text-cloud" dir={auto ? 'auto' : undefined}>{v}</dd>
    </div>
  );
}
