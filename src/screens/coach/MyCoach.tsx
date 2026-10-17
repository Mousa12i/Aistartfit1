import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Check, ChevronDown, ChevronLeft, ClipboardCheck, LogOut, MessageCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import {
  coachErrorKey, coachProfileByCode, endCoachLink, fetchMyCoach, joinCoach, listCheckins, listHabits, myCoachHours, myCoachProfile, setHabitDone, submitCheckin,
  type CheckinInput, type CoachHours, type Habit, type HabitLog, type CoachProfile, type MyCoach as MyCoachInfo, type Checkin,
} from '@/lib/coach/api';
import { normalizeCode, weekOf } from '@/lib/coach/insights';
import { Avatar, Sheet } from './ui';
import { ChatThread } from './ChatThread';
import { CoachProfileCard } from './CoachProfileCard';

const PENDING_KEY = 'startfit.joinCode';
const field = 'w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-2.5 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none';

const SHARED: MessageKey[] = ['coach.shareTraining', 'coach.shareFood', 'coach.shareWeight', 'coach.shareRecovery', 'coach.shareProfile'];
const NOT_SHARED: MessageKey[] = ['coach.notShareChats', 'coach.notShareCycle', 'coach.notShareEmail'];

const DAY_KEYS: MessageKey[] = ['coach.daySun', 'coach.dayMon', 'coach.dayTue', 'coach.dayWed', 'coach.dayThu', 'coach.dayFri', 'coach.daySat'];

/** /join/:code — keeps the code until the person is signed in, then opens My coach with it filled in. */
export function JoinRoute() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    try { localStorage.setItem(PENDING_KEY, normalizeCode(code)); } catch { /* storage unavailable */ }
    navigate('/my-coach', { replace: true });
  }, [code, navigate]);
  return null;
}

export function pendingJoinCode(): string | null {
  try { return localStorage.getItem(PENDING_KEY); } catch { return null; }
}

/** The athlete's side: join a coach (with a clear consent screen), weekly check-in, chat, leave. */
export function MyCoach() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, dir } = useI18n();
  const [coach, setCoach] = useState<MyCoachInfo | null | undefined>(undefined);
  const [tab, setTab] = useState<'chat' | 'checkin'>('chat');

  const load = useCallback(async () => {
    try { setCoach(await fetchMyCoach()); } catch { setCoach(null); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (coach === undefined) return <div className="min-h-screen bg-ink-bg" />;

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-40 pt-5" dir={dir} data-testid="my-coach">
      <header className="mb-5 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label={t('common.back')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim">
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <h1 className="text-[22px] font-bold text-cloud">{t('coach.myCoach')}</h1>
      </header>
      {coach ? (
        <Linked coach={coach} me={user?.id ?? ''} tab={tab} setTab={setTab} onLeft={load} t={t} />
      ) : (
        <JoinFlow onJoined={load} t={t} />
      )}
    </div>
  );
}

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

function JoinFlow({ onJoined, t }: { onJoined: () => void; t: T }) {
  const [code, setCode] = useState(() => pendingJoinCode() ?? '');
  const [preview, setPreview] = useState<CoachProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const look = async (raw = code) => {
    setError(null);
    setBusy(true);
    try {
      const p = await coachProfileByCode(normalizeCode(raw));
      if (!p) setError(t('coach.err_code_not_found'));
      setPreview(p);
    } catch {
      setError(t('coach.err_generic'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (pendingJoinCode()) look(pendingJoinCode()!); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinCoach(normalizeCode(code));
      try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
      onJoined();
    } catch (e) {
      setError(t(`coach.err_${coachErrorKey(e)}` as MessageKey));
    } finally {
      setBusy(false);
    }
  };

  if (preview) {
    const name = preview.brand_name || preview.display_name || '';
    return (
      <div className="space-y-4" data-testid="join-consent">
        <CoachProfileCard p={preview} />
        {!preview.terms_ok && <p className="rounded-xl bg-gold/10 px-3 py-2 text-xs text-gold">{t('coach.err_coach_not_ready')}</p>}
        <div className="rounded-2xl border border-lime/30 bg-lime/[0.04] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cloud"><ShieldCheck className="h-4 w-4 text-lime" />{t('coach.consentTitle', { name })}</div>
          <ul className="space-y-1.5 text-xs text-cloud">{SHARED.map((k) => <li key={k} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-lime" />{t(k)}</li>)}</ul>
          <div className="mt-3 text-xs font-semibold text-cloud-dim">{t('coach.consentNot')}</div>
          <ul className="mt-1 space-y-1 text-xs text-cloud-dim">{NOT_SHARED.map((k) => <li key={k}>• {t(k)}</li>)}</ul>
          <p className="mt-3 text-[11px] leading-relaxed text-cloud-muted">{t('coach.consentLeave')}</p>
        </div>
        {error && <p className="text-xs text-rust">{error}</p>}
        <button type="button" onClick={join} disabled={busy || !preview.terms_ok} className="w-full rounded-xl bg-lime py-3.5 text-sm font-bold text-ink-bg disabled:opacity-50" data-testid="join-confirm">{t('coach.agreeJoin')}</button>
        <button type="button" onClick={() => setPreview(null)} className="w-full py-2 text-xs text-cloud-dim">{t('common.cancel')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-ink-border bg-ink-surface p-5">
        <h2 className="text-lg font-bold text-cloud">{t('coach.joinTitle')}</h2>
        <p className="mt-1 text-sm leading-relaxed text-cloud-dim">{t('coach.joinBody')}</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="SF-XXXXXX"
          dir="ltr"
          className={cn(field, 'mt-4 text-center font-mono text-xl tracking-widest')}
          data-testid="join-code"
        />
        {error && <p className="mt-2 text-xs text-rust">{error}</p>}
        <button type="button" onClick={() => look()} disabled={busy || code.replace(/[^A-Z0-9]/gi, '').length < 6} className="mt-3 w-full rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg disabled:opacity-40" data-testid="join-find">
          {t('coach.findCoach')}
        </button>
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-cloud-muted">{t('coach.joinNote')}</p>
    </div>
  );
}

function Linked({ coach, me, tab, setTab, onLeft, t }: { coach: MyCoachInfo; me: string; tab: 'chat' | 'checkin'; setTab: (v: 'chat' | 'checkin') => void; onLeft: () => void; t: T }) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const thisWeek = weekOf(new Date());
  const reload = useCallback(async () => { setCheckins(await listCheckins(coach.coach_id, me).catch(() => [])); }, [coach.coach_id, me]);
  useEffect(() => { reload(); }, [reload]);
  const done = checkins.some((c) => c.week_of === thisWeek);
  const name = coach.brand_name || coach.display_name || '';
  const lastReply = checkins.find((c) => c.coach_reply);
  const [about, setAbout] = useState<CoachProfile | null>(null);
  const [hours, setHours] = useState<CoachHours | null>(null);
  useEffect(() => { myCoachHours().then(setHours).catch(() => undefined); }, []);
  const [aboutOpen, setAboutOpen] = useState(false);
  useEffect(() => { myCoachProfile().then(setAbout).catch(() => undefined); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-ink-border bg-ink-surface p-4">
        <Avatar id={coach.coach_id} name={coach.display_name} url={coach.avatar_url} size={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold text-cloud">{name}</div>
          <div className="text-[11px] text-cloud-dim">{t('coach.checkinDue', { day: t(DAY_KEYS[coach.checkin_day ?? 1]) })}</div>
          {hours?.hours_start != null && hours.hours_end != null && hours.hours_start !== hours.hours_end && (
            <div className="text-[11px] text-cloud-dim" data-testid="coach-hours">{t('coach.repliesBetween', { from: hourLabel(hours.hours_start), to: hourLabel(hours.hours_end), tz: hours.hours_tz ?? 'UTC' })}</div>
          )}
        </div>
        <button type="button" onClick={() => setLeaveOpen(true)} aria-label={t('coach.leave')} className="text-cloud-muted hover:text-rust"><LogOut className="h-5 w-5 rtl:-scale-x-100" /></button>
      </div>

      {about && (
        <div>
          <button type="button" onClick={() => setAboutOpen((v) => !v)} className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-xs font-semibold text-cloud-dim" data-testid="about-coach">
            {t('coach.aboutCoach')}<ChevronDown className={cn('h-4 w-4 transition-transform', aboutOpen && 'rotate-180')} />
          </button>
          {aboutOpen && <div className="mt-2"><CoachProfileCard p={about} /></div>}
        </div>
      )}

      <HabitsToday me={me} t={t} />

      {!done && (
        <button type="button" onClick={() => setTab('checkin')} className="flex w-full items-center gap-3 rounded-2xl border border-lime/40 bg-lime/[0.06] p-4 text-start" data-testid="checkin-prompt">
          <ClipboardCheck className="h-6 w-6 text-lime" />
          <div><div className="text-sm font-semibold text-cloud">{t('coach.checkinPromptTitle')}</div><div className="text-xs text-cloud-dim">{t('coach.checkinPromptBody')}</div></div>
        </button>
      )}
      {lastReply?.coach_reply && (
        <div className="rounded-2xl border border-ink-border bg-ink-surface p-4">
          <div className="mb-1 text-xs text-cloud-dim">{t('coach.coachFeedback', { date: lastReply.week_of })}</div>
          <p dir="auto" className="whitespace-pre-wrap text-sm text-cloud">{lastReply.coach_reply}</p>
        </div>
      )}

      <div className="flex rounded-xl bg-ink-elevated p-1">
        {([['chat', 'coach.tabChat', MessageCircle], ['checkin', 'coach.tabCheckins', ClipboardCheck]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold', tab === k ? 'bg-ink-surface text-cloud' : 'text-cloud-dim')}>
            <Icon className="h-3.5 w-3.5" />{t(label)}{k === 'chat' && coach.unread > 0 ? ` (${coach.unread})` : ''}
          </button>
        ))}
      </div>

      {tab === 'chat' ? (
        <ChatThread coachId={coach.coach_id} athleteId={me} me={me} />
      ) : (
        <CheckinForm questions={hours?.questions ?? []} coachId={coach.coach_id} me={me} weekOfDate={thisWeek} existing={checkins.find((c) => c.week_of === thisWeek) ?? null} onSaved={reload} t={t} />
      )}

      <Sheet open={leaveOpen} title={t('coach.leave')} onClose={() => setLeaveOpen(false)}>
        <p className="mb-4 text-sm leading-relaxed text-cloud-dim">{t('coach.leaveConfirm', { name })}</p>
        <button type="button" onClick={async () => { await endCoachLink(null); setLeaveOpen(false); onLeft(); }} className="w-full rounded-xl bg-rust py-3 text-sm font-bold text-white" data-testid="leave-confirm">{t('coach.leave')}</button>
      </Sheet>
    </div>
  );
}

const SCORES: [keyof CheckinInput, MessageKey, MessageKey][] = [
  ['sleep', 'coach.ciSleep', 'coach.ciSleepQ'],
  ['energy', 'coach.ciEnergy', 'coach.ciEnergyQ'],
  ['stress', 'coach.ciStress', 'coach.ciStressQ'],
  ['hunger', 'coach.ciHunger', 'coach.ciHungerQ'],
  ['training_adherence', 'coach.ciTraining', 'coach.ciTrainingQ'],
  ['nutrition_adherence', 'coach.ciNutrition', 'coach.ciNutritionQ'],
];

function CheckinForm({ coachId, me, weekOfDate, existing, onSaved, t, questions }: { coachId: string; me: string; weekOfDate: string; existing: Checkin | null; onSaved: () => void; t: T; questions: string[] }) {
  const empty: CheckinInput = { sleep: null, energy: null, stress: null, hunger: null, training_adherence: null, nutrition_adherence: null, weight_kg: null, waist_cm: null, win: null, struggle: null, question: null, answers: [] };
  const [answers, setAnswers] = useState<string[]>(() => questions.map((q) => existing?.answers?.find((a) => a.q === q)?.a ?? ''));
  useEffect(() => { setAnswers(questions.map((q) => existing?.answers?.find((a) => a.q === q)?.a ?? '')); }, [questions, existing]);
  const [v, setV] = useState<CheckinInput>(existing ? { ...empty, ...existing } : empty);
  const [weight, setWeight] = useState(existing?.weight_kg != null ? String(existing.weight_kg) : '');
  const [waist, setWaist] = useState(existing?.waist_cm != null ? String(existing.waist_cm) : '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const locked = !!existing?.reviewed_at;
  const ready = useMemo(() => SCORES.every(([k]) => v[k] != null), [v]);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : null);
      const qa = questions.map((q, i) => ({ q, a: (answers[i] ?? '').trim().slice(0, 1000) })).filter((x) => x.a);
      await submitCheckin(coachId, me, weekOfDate, { ...v, weight_kg: num(weight), waist_cm: num(waist), answers: qa }, photos);
      setMsg(t('coach.checkinSent'));
      setPhotos([]);
      onSaved();
    } catch {
      setMsg(t('coach.saveError'));
    } finally {
      setBusy(false);
    }
  };

  if (locked) return <p className="rounded-2xl bg-ink-surface p-4 text-sm text-cloud-dim">{t('coach.checkinReviewedNote')}</p>;

  return (
    <div className="space-y-4" data-testid="checkin-form">
      <p className="text-xs text-cloud-dim">{t('coach.checkinIntro')}</p>
      {SCORES.map(([k, label, q]) => (
        <div key={k}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-cloud">{t(label)}</span>
            <span className="text-[11px] text-cloud-muted">{t(q)}</span>
          </div>
          <div className="grid grid-cols-10 gap-1" dir="ltr">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => setV({ ...v, [k]: n })} data-testid={`ci-${k}-${n}`}
                className={cn('h-9 rounded-lg text-xs font-semibold', v[k] === n ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim')}>{n}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <label><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.ciWeight')}</span><input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" className={field} dir="ltr" /></label>
        <label><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.ciWaist')}</span><input value={waist} onChange={(e) => setWaist(e.target.value)} inputMode="decimal" className={field} dir="ltr" /></label>
      </div>
      {([['win', 'coach.ciWin', 'coach.ciWinQ'], ['struggle', 'coach.ciStruggle', 'coach.ciStruggleQ'], ['question', 'coach.ciQuestion', 'coach.ciQuestionQ']] as [keyof CheckinInput, MessageKey, MessageKey][]).map(([k, label, ph]) => (
        <label key={k} className="block">
          <span className="mb-1 block text-[11px] text-cloud-dim">{t(label)}</span>
          <textarea value={(v[k] as string | null) ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value || null })} rows={2} maxLength={1000} placeholder={t(ph)} className={field} />
        </label>
      ))}
      {questions.map((q, i) => (
        <label key={q} className="block" data-testid="ci-custom">
          <span className="mb-1 block text-[11px] text-cloud-dim" dir="auto">{q}</span>
          <textarea value={answers[i] ?? ''} onChange={(e) => setAnswers(answers.map((x, j) => (j === i ? e.target.value : x)))} rows={2} maxLength={1000} className={field} dir="auto" />
        </label>
      ))}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-border px-4 py-3">
        <Camera className="h-5 w-5 text-cloud-dim" />
        <span className="flex-1 text-xs text-cloud-dim">{photos.length ? t('coach.photosChosen', { n: photos.length }) : t('coach.addPhotos')}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotos(Array.from(e.target.files ?? ([] as unknown as FileList)).slice(0, 3) as File[])} />
      </label>
      {msg && <p className="text-xs text-lime">{msg}</p>}
      <button type="button" onClick={submit} disabled={busy || !ready} className="w-full rounded-xl bg-lime py-3.5 text-sm font-bold text-ink-bg disabled:opacity-40" data-testid="checkin-submit">
        {existing ? t('coach.updateCheckin') : t('coach.sendCheckin')}
      </button>
    </div>
  );
}

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The athlete's daily habits from the coach: tick today (and see the last 7 days). */
function HabitsToday({ me, t }: { me: string; t: T }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const load = useCallback(async () => {
    try { const r = await listHabits(me); setHabits(r.habits); setLogs(r.logs); } catch { /* not shown */ }
  }, [me]);
  useEffect(() => { load(); }, [load]);
  if (!habits.length) return null;
  const today = dayKey(new Date());
  const done = (id: string) => logs.some((l) => l.habit_id === id && l.day === today && l.done);
  const toggle = async (h: Habit) => {
    const next = !done(h.id);
    setLogs((ls) => [...ls.filter((l) => !(l.habit_id === h.id && l.day === today)), { habit_id: h.id, day: today, done: next }]);
    try { await setHabitDone(h.id, me, today, next); } catch { load(); }
  };
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="habits-today">
      <div className="mb-2 text-sm font-semibold text-cloud">{t('coach.habitsToday')}</div>
      <ul className="space-y-1.5">
        {habits.map((h) => {
          const ok = done(h.id);
          return (
            <li key={h.id}>
              <button type="button" role="checkbox" aria-checked={ok} onClick={() => toggle(h)} data-testid="habit-tick"
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start', ok ? 'bg-lime/10' : 'bg-ink-elevated/60')}>
                <span className={cn('flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border', ok ? 'border-lime bg-lime text-ink-bg' : 'border-ink-border')}>{ok && <Check className="h-3.5 w-3.5" />}</span>
                <span className={cn('text-sm', ok ? 'text-cloud' : 'text-cloud-dim')} dir="auto">{h.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
