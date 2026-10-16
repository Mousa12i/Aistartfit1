import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ClipboardCheck, Copy, MessageCircle, Search, Settings2, Share2, Sparkles, UserPlus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import {
  becomeCoach, fetchRoster, fetchRosterActivity, startCoachCheckout, type Activity,
} from '@/lib/coach/api';
import {
  athleteSignals, COACH_LIMITS, coachTierNow, joinLink, summarize, triage, type CoachTier, type RosterRow, type TriageItem,
} from '@/lib/coach/insights';
import { Avatar, PulseStrip, RISK_STYLE, Sheet, Sparkline, reasonText, relativeDays } from './ui';
import { CoachSettingsSheet } from './CoachSettingsSheet';
import { NotificationBell } from '@/components/NotificationBell';

type Filter = 'all' | 'attention' | 'checkins' | 'unread';

const PLANS: { tier: Exclude<CoachTier, 'free'>; price: number; annual: number; name: MessageKey; perk: MessageKey }[] = [
  { tier: 'coach', price: 19, annual: 190, name: 'coach.planCoach', perk: 'coach.planCoachPerk' },
  { tier: 'coach_pro', price: 39, annual: 390, name: 'coach.planCoachPro', perk: 'coach.planCoachProPerk' },
  { tier: 'studio', price: 79, annual: 790, name: 'coach.planStudio', perk: 'coach.planStudioPerk' },
];

/** The coach's home: who needs attention today, the roster at a glance, the invite code and the plan. */
export function CoachHome() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();
  const { t, dir } = useI18n();
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [activity, setActivity] = useState<Record<string, Activity>>({});
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [plansOpen, setPlansOpen] = useState(params.get('plans') === '1');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const now = useMemo(() => new Date(), [roster]); // eslint-disable-line react-hooks/exhaustive-deps

  const code = profile?.coach_code ?? null;
  const tier = coachTierNow(profile?.coach_tier, profile?.coach_period_end);
  const limit = COACH_LIMITS[tier];

  const load = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([fetchRoster(), fetchRosterActivity()]);
      setRoster(r);
      setActivity(a);
    } catch {
      setError(t('coach.loadError'));
      setRoster([]);
    }
  }, [t]);

  useEffect(() => {
    // First visit: make sure this account has a coach code.
    if (profile && !profile.coach_code) {
      becomeCoach().then(() => refreshProfile()).catch(() => setError(t('coach.loadError')));
    }
  }, [profile, refreshProfile, t]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (params.get('checkout') === 'success') refreshProfile();
  }, [params, refreshProfile]);

  const items = useMemo(() => (roster ? triage(roster, now) : []), [roster, now]);
  const summary = useMemo(() => (roster ? summarize(roster, now) : null), [roster, now]);

  const visible = useMemo(() => {
    if (!roster) return [];
    const q = query.trim().toLowerCase();
    return roster
      .filter((r) => !q || (r.display_name ?? '').toLowerCase().includes(q))
      .filter((r) => {
        if (filter === 'unread') return r.unread > 0;
        if (filter === 'checkins') return r.pending_checkins > 0;
        if (filter === 'attention') return athleteSignals(r, now).level !== 'ok';
        return true;
      })
      .sort((a, b) => athleteSignals(b, now).score - athleteSignals(a, now).score || (a.display_name ?? '').localeCompare(b.display_name ?? ''));
  }, [roster, filter, query, now]);

  const link = code ? joinLink(window.location.origin + window.location.pathname.replace(/\/$/, ''), code) : '';

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code ?? '' : link);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    } catch { /* clipboard blocked */ }
  };

  const share = async () => {
    const text = t('coach.shareText', { code: code ?? '', link });
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ text }); return; } catch { /* cancelled */ }
    }
    copy('link');
  };

  const buy = async (planTier: Exclude<CoachTier, 'free'>) => {
    setBusyTier(planTier);
    try {
      window.location.href = await startCoachCheckout(planTier, billing);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('coach.loadError'));
      setBusyTier(null);
    }
  };

  const open = (id: string, tab?: string) => navigate(`/coach/athlete/${id}${tab ? `?tab=${tab}` : ''}`);
  const count = roster?.length ?? 0;
  const firstName = (profile?.display_name ?? '').split(' ')[0];

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-36 pt-5" dir={dir} data-testid="coach-home">
      <header className="mb-5 flex items-center gap-3">
        <button type="button" onClick={() => navigate('/')} aria-label={t('common.back')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim">
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-cloud-dim">{profile?.coach_brand_name || t('coach.portal')}</div>
          <h1 className="truncate text-[22px] font-bold leading-tight text-cloud">{t('coach.hello', { name: firstName || t('coach.coach') })}</h1>
        </div>
        <NotificationBell />
        <button type="button" onClick={() => setSettingsOpen(true)} aria-label={t('coach.settings')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim">
          <Settings2 className="h-5 w-5" />
        </button>
      </header>

      {error && <p className="mb-3 rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">{error}</p>}

      {/* The day in one line, then the queue */}
      {summary && count > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2" data-testid="coach-summary">
          <Kpi value={items.length} label={t('coach.kpiNeedsYou')} tone={items.length ? 'text-lime' : 'text-cloud'} />
          <Kpi value={`${Math.round(summary.avgTraining * 100)}%`} label={t('coach.kpiTraining')} />
          <Kpi value={`${Math.round(summary.avgFood * 100)}%`} label={t('coach.kpiFood')} />
        </div>
      )}

      {roster && count > 0 && (
        <section className="mb-6" aria-labelledby="needs-you">
          <h2 id="needs-you" className="mb-2 text-sm font-semibold text-cloud">{t('coach.needsYou')}</h2>
          {items.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-lime/20 bg-lime/5 px-4 py-3.5">
              <Check className="h-5 w-5 text-lime" />
              <p className="text-sm text-cloud">{t('coach.allClear')}</p>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-ink-border bg-ink-surface" data-testid="triage">
              {items.slice(0, 8).map((it, i) => (
                <TriageRow key={`${it.kind}-${it.athleteId}`} item={it} first={i === 0} onOpen={open} t={t} />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Roster */}
      {roster && count > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-cloud">{t('coach.athletes')} <span className="text-cloud-muted">{count}/{limit}</span></h2>
            <div className="flex items-center gap-3 text-[10px] text-cloud-muted" aria-hidden="true">
              <span className="flex items-center gap-1"><span className="h-2.5 w-1.5 rounded-[1px] bg-lime" />{t('coach.legendTrained')}</span>
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-sky" />{t('coach.legendFood')}</span>
            </div>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-ink-border bg-ink-surface px-3">
              <Search className="h-4 w-4 text-cloud-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('coach.search')} className="h-10 w-full bg-transparent text-sm text-cloud placeholder:text-cloud-muted focus:outline-none" />
            </label>
          </div>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {([['all', 'coach.filterAll'], ['attention', 'coach.filterAttention'], ['checkins', 'coach.filterCheckins'], ['unread', 'coach.filterUnread']] as [Filter, MessageKey][]).map(([f, k]) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={cn('whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium', filter === f ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')}>
                {t(k)}
              </button>
            ))}
          </div>
          <ul className="space-y-2" data-testid="roster">
            {visible.map((r) => <RosterCard key={r.athlete_id} row={r} activity={activity[r.athlete_id]} now={now} onOpen={open} t={t} />)}
            {visible.length === 0 && <li className="py-6 text-center text-xs text-cloud-dim">{t('coach.noMatch')}</li>}
          </ul>
        </section>
      )}

      {/* Invite */}
      <section className={cn('mb-6 rounded-3xl border p-5', count === 0 ? 'border-lime/40 bg-lime/[0.06]' : 'border-ink-border bg-ink-surface')} data-testid="coach-invite">
        {count === 0 && (
          <>
            <UserPlus className="mb-3 h-7 w-7 text-lime" />
            <h2 className="text-xl font-bold text-cloud">{t('coach.emptyTitle')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-cloud-dim">{t('coach.emptyBody')}</p>
          </>
        )}
        {count > 0 && <h2 className="text-sm font-semibold text-cloud">{t('coach.inviteTitle')}</h2>}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-ink-bg px-4 py-3">
          <div>
            <div className="text-[11px] text-cloud-dim">{t('coach.yourCode')}</div>
            <div className="font-mono text-2xl font-bold tracking-wider text-lime" dir="ltr" data-testid="coach-code">{code ?? '…'}</div>
          </div>
          <button type="button" onClick={() => copy('code')} disabled={!code} className="flex h-10 items-center gap-1.5 rounded-xl bg-ink-elevated px-3 text-xs font-semibold text-cloud">
            {copied === 'code' ? <Check className="h-4 w-4 text-lime" /> : <Copy className="h-4 w-4" />}
            {copied === 'code' ? t('coach.copied') : t('coach.copy')}
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={share} disabled={!code} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-lime text-sm font-bold text-ink-bg">
            <Share2 className="h-4 w-4" />{t('coach.shareInvite')}
          </button>
          <button type="button" onClick={() => copy('link')} disabled={!code} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-ink-border text-sm font-semibold text-cloud">
            {copied === 'link' ? <Check className="h-4 w-4 text-lime" /> : <Copy className="h-4 w-4" />}
            {copied === 'link' ? t('coach.copied') : t('coach.copyLink')}
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-cloud-muted">{t('coach.inviteHow')}</p>
      </section>

      {/* Plan */}
      <section className="rounded-3xl border border-ink-border bg-ink-surface p-5" data-testid="coach-plan">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-cloud-dim">{t('coach.yourPlan')}</div>
            <div className="text-lg font-bold text-cloud">{t(tier === 'free' ? 'coach.planFree' : PLANS.find((p) => p.tier === tier)!.name)}</div>
          </div>
          <div className="text-end">
            <div className="text-lg font-bold tabular-nums text-cloud" dir="ltr">{count}/{limit}</div>
            <div className="text-[11px] text-cloud-dim">{t('coach.athletesUsed')}</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-elevated">
          <div className={cn('h-full rounded-full', count / limit >= 0.85 ? 'bg-gold' : 'bg-lime')} style={{ width: `${Math.min(100, (count / limit) * 100)}%` }} />
        </div>
        <button type="button" onClick={() => setPlansOpen(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-lime/40 py-2.5 text-sm font-semibold text-lime" data-testid="coach-see-plans">
          <Sparkles className="h-4 w-4" />{tier === 'free' ? t('coach.seePlans') : t('coach.changePlan')}
        </button>
      </section>

      <Sheet open={plansOpen} title={t('coach.plansTitle')} onClose={() => setPlansOpen(false)}>
        <p className="mb-3 text-xs leading-relaxed text-cloud-dim">{t('coach.plansIntro')}</p>
        <div className="mb-4 flex rounded-xl bg-ink-elevated p-1">
          {(['monthly', 'annual'] as const).map((b) => (
            <button key={b} type="button" onClick={() => setBilling(b)} className={cn('flex-1 rounded-lg py-2 text-xs font-semibold', billing === b ? 'bg-ink-surface text-cloud' : 'text-cloud-dim')}>
              {t(b === 'monthly' ? 'coach.monthly' : 'coach.annual')}
            </button>
          ))}
        </div>
        <div className="space-y-2.5">
          <PlanRow name={t('coach.planFree')} price="£0" perk={t('coach.planFreePerk')} current={tier === 'free'} t={t} />
          {PLANS.map((p) => (
            <PlanRow
              key={p.tier}
              name={t(p.name)}
              price={billing === 'monthly' ? `£${p.price}` : `£${p.annual}`}
              per={t(billing === 'monthly' ? 'coach.perMonth' : 'coach.perYear')}
              perk={t(p.perk)}
              current={tier === p.tier}
              busy={busyTier === p.tier}
              onPick={() => buy(p.tier)}
              t={t}
            />
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-cloud-muted">{t('coach.plansFine')}</p>
      </Sheet>

      <CoachSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} userId={user?.id ?? ''} />
    </div>
  );
}

function Kpi({ value, label, tone }: { value: string | number; label: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-surface px-3 py-3">
      <div className={cn('text-2xl font-extrabold tabular-nums', tone ?? 'text-cloud')} dir="ltr">{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-cloud-dim">{label}</div>
    </div>
  );
}

function TriageRow({ item, first, onOpen, t }: { item: TriageItem; first: boolean; onOpen: (id: string, tab?: string) => void; t: (k: MessageKey, v?: Record<string, string | number>) => string }) {
  const conf = {
    message: { icon: MessageCircle, tone: 'text-sky', text: t('coach.triageMessage', { n: item.count ?? 1 }), tab: 'chat', action: t('coach.reply') },
    checkin: { icon: ClipboardCheck, tone: 'text-lime', text: t('coach.triageCheckin'), tab: 'checkins', action: t('coach.review') },
    at_risk: { icon: AlertTriangle, tone: 'text-rust', text: item.reasons?.[0] ? reasonText(item.reasons[0], t) : t('coach.riskAtRisk'), tab: 'chat', action: t('coach.reachOut') },
    new: { icon: UserPlus, tone: 'text-gold', text: t('coach.triageNew'), tab: 'overview', action: t('coach.welcome') },
  }[item.kind];
  const Icon = conf.icon;
  return (
    <li className={cn(!first && 'border-t border-ink-border/60')}>
      <button type="button" onClick={() => onOpen(item.athleteId, conf.tab)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-ink-elevated/50">
        <Icon className={cn('h-5 w-5 flex-shrink-0', conf.tone)} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-cloud">{item.name}</div>
          <div className="truncate text-xs text-cloud-dim">{conf.text}</div>
        </div>
        <span className="flex-shrink-0 rounded-lg bg-ink-elevated px-2.5 py-1.5 text-[11px] font-semibold text-cloud">{conf.action}</span>
      </button>
    </li>
  );
}

function RosterCard({ row, activity, now, onOpen, t }: { row: RosterRow; activity?: Activity; now: Date; onOpen: (id: string) => void; t: (k: MessageKey, v?: Record<string, string | number>) => string }) {
  const s = athleteSignals(row, now);
  const weights = activity?.weights.map((w) => w.kg) ?? [];
  const last = weights.length ? weights[weights.length - 1] : row.profile_weight_kg;
  return (
    <li>
      <button type="button" onClick={() => onOpen(row.athlete_id)} className="w-full rounded-2xl border border-ink-border bg-ink-surface p-3.5 text-start hover:border-lime/30" data-testid="roster-card">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-full ring-2', RISK_STYLE[s.level].ring)}>
            <Avatar id={row.athlete_id} name={row.display_name} url={row.avatar_url} size={40} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-cloud">{row.display_name || '—'}</span>
              {row.unread > 0 && <span className="rounded-full bg-sky px-1.5 text-[10px] font-bold text-ink-bg" dir="ltr">{row.unread}</span>}
              {row.pending_checkins > 0 && <ClipboardCheck className="h-3.5 w-3.5 text-lime" aria-label={t('coach.triageCheckin')} />}
            </div>
            <div className="truncate text-[11px] text-cloud-dim">
              {s.reasons[0]
                ? <span className={s.level === 'ok' ? 'text-cloud-dim' : RISK_STYLE[s.level].text}>{reasonText(s.reasons[0], t)}</span>
                : row.last_workout_at ? t('coach.lastTrained', { when: relativeDays(row.last_workout_at, now, t) }) : t('coach.noWorkoutYet')}
            </div>
          </div>
          {weights.length >= 2 ? <Sparkline points={weights} width={64} height={26} /> : null}
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <PulseStrip trainDates={activity?.train_dates ?? []} foodDates={activity?.food_dates ?? []} now={now} label={t('coach.pulseLabel', { sessions: row.workouts_7d, days: row.food_days_7d })} />
          <div className="text-end text-[11px] tabular-nums text-cloud-dim" dir="ltr">
            {last ? `${Number(last).toFixed(1)} kg` : ''}
          </div>
        </div>
      </button>
    </li>
  );
}

function PlanRow({ name, price, per, perk, current, busy, onPick, t }: { name: string; price: string; per?: string; perk: string; current: boolean; busy?: boolean; onPick?: () => void; t: (k: MessageKey) => string }) {
  return (
    <div className={cn('rounded-2xl border p-4', current ? 'border-lime bg-lime/5' : 'border-ink-border bg-ink-elevated/40')}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-base font-bold text-cloud">{name}</div>
        <div className="text-base font-bold text-cloud" dir="ltr">{price}<span className="text-xs font-normal text-cloud-dim">{per ? ` ${per}` : ''}</span></div>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-cloud-dim">{perk}</p>
      {current ? (
        <div className="mt-3 text-xs font-semibold text-lime">{t('coach.currentPlan')}</div>
      ) : onPick ? (
        <button type="button" onClick={onPick} disabled={busy} className="mt-3 w-full rounded-xl bg-lime py-2.5 text-sm font-bold text-ink-bg disabled:opacity-50">
          {busy ? t('coach.opening') : t('coach.choose')}
        </button>
      ) : null}
    </div>
  );
}
