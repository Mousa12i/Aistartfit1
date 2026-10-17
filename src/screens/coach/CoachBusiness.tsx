import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, MessageCircle, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { coachBusinessStats, type BusinessStats } from '@/lib/coach/api';

/** /coach/business: retention and responsiveness from the coach's own roster, check-ins and messages. */
export function CoachBusiness() {
  const navigate = useNavigate();
  const { t, dir, lang } = useI18n();
  const [s, setS] = useState<BusinessStats | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { coachBusinessStats().then(setS).catch(() => setError(true)); }, []);

  // Western digits in every language (as in the rest of the app); separators follow the language.
  const loc = lang === 'ar' ? 'ar-u-nu-latn' : lang;
  const num = (n: number) => n.toLocaleString(loc, { maximumFractionDigits: 0 });
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
  // Plain numbers go into plural texts (the plural form is chosen from the number).
  const hours = (h: number | null) => (h == null ? '—' : h < 1 ? t('biz.underHour') : t('biz.hoursN', { n: h < 10 ? Math.round(h * 10) / 10 : Math.round(h) }));

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-12 pt-5" dir={dir} data-testid="coach-business">
      <header className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate('/')} aria-label={t('common.back')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim">
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <h1 className="text-xl font-bold text-cloud">{t('biz.title')}</h1>
      </header>
      {error && <p className="rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">{t('coach.loadError')}</p>}
      {!s && !error && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-surface" />)}</div>}
      {s && (
        <div className="space-y-4">
          <Group icon={Users} title={t('biz.clients')}>
            <Stat label={t('biz.active')} value={num(s.active)} />
            <Stat label={t('biz.joined')} value={num(s.joined_30d)} tone={s.joined_30d > 0 ? 'text-lime' : undefined} />
            <Stat label={t('biz.left')} value={num(s.left_30d)} tone={s.left_30d > 0 ? 'text-gold' : undefined} />
          </Group>

          <Group icon={TrendingUp} title={t('biz.retentionTitle')}>
            <Stat label={t('biz.retention')} value={pct(s.retained_90d, s.eligible_90d) == null ? '—' : `${pct(s.retained_90d, s.eligible_90d)}%`}
              sub={s.eligible_90d > 0 ? t('biz.ofN', { a: num(s.retained_90d), b: num(s.eligible_90d) }) : t('biz.retentionNone')} wide />
            <Stat label={t('biz.tenure')} value={s.median_tenure_days == null ? '—' : t('biz.daysN', { n: Math.floor(s.median_tenure_days) })} sub={t('biz.everN', { n: s.ever })} wide />
          </Group>

          <Group icon={Clock} title={t('biz.checkinsTitle')}>
            <Stat label={t('biz.reviewed')} value={pct(s.reviewed_8w, s.checkins_8w) == null ? '—' : `${pct(s.reviewed_8w, s.checkins_8w)}%`} sub={t('biz.ofN', { a: num(s.reviewed_8w), b: num(s.checkins_8w) })} wide />
            <Stat label={t('biz.reviewTime')} value={hours(s.median_review_hours)} wide />
          </Group>

          <Group icon={MessageCircle} title={t('biz.messagesTitle')}>
            <Stat label={t('biz.waiting')} value={num(s.waiting_replies)} tone={s.waiting_replies > 0 ? 'text-gold' : 'text-lime'} wide />
            <Stat label={t('biz.oldestWait')} value={hours(s.oldest_wait_hours)} tone={(s.oldest_wait_hours ?? 0) >= 24 ? 'text-rust' : undefined} wide />
          </Group>

          <p className="px-1 text-[11px] leading-relaxed text-cloud-muted">{t('biz.note')}</p>
        </div>
      )}
    </div>
  );
}

function Group({ icon: Icon, title, children }: { icon: typeof Users; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-border bg-ink-surface p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-cloud"><Icon className="h-4 w-4 text-lime" />{title}</h2>
      <div className="grid grid-cols-6 gap-2">{children}</div>
    </section>
  );
}

function Stat({ label, value, sub, tone, wide }: { label: string; value: string; sub?: string; tone?: string; wide?: boolean }) {
  return (
    <div className={cn('rounded-xl bg-ink-elevated/70 px-3 py-2.5', wide ? 'col-span-3' : 'col-span-2')} data-testid="biz-stat">
      <div className="text-[11px] text-cloud-dim">{label}</div>
      <div className={cn('text-xl font-bold tabular-nums text-cloud', tone)}>{value}</div>
      {sub && <div className="text-[10px] text-cloud-muted">{sub}</div>}
    </div>
  );
}
