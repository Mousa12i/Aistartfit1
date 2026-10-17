import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CreditCard, FileText, LogOut, MessageSquareText, Settings, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { COACH_TERMS_VERSION, type CoachProfile } from '@/lib/coach/api';
import { COACH_LIMITS, coachTierNow } from '@/lib/coach/insights';
import { CoachProfileCard } from './CoachProfileCard';
import { CoachSettingsSheet } from './CoachSettingsSheet';

const TIER_KEY: Record<string, MessageKey> = { free: 'coach.planFree', coach: 'coach.planCoach', coach_pro: 'coach.planCoachPro', studio: 'coach.planStudio' };

/** /coach/account: the coach's profile, plan, coaching settings, rules and app settings. */
export function CoachAccount() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { t, dir } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!profile) return null;
  const tier = coachTierNow(profile.coach_tier, profile.coach_period_end);

  const card: CoachProfile = {
    coach_id: profile.id, display_name: profile.display_name, brand_name: profile.coach_brand_name ?? null, bio: profile.coach_bio ?? null,
    avatar_url: profile.avatar_url, headline: profile.coach_headline ?? null, specialties: profile.coach_specialties ?? [], years: profile.coach_years ?? null,
    languages: profile.coach_languages ?? [], format: profile.coach_format ?? null, location: profile.coach_location ?? null, philosophy: profile.coach_philosophy ?? null,
    certifications: profile.coach_certifications ?? [], insured: profile.coach_insured ?? null, dietitian: profile.coach_dietitian ?? null,
    checkin_day: profile.coach_checkin_day ?? null, terms_ok: profile.coach_terms_version === COACH_TERMS_VERSION, terms_accepted_at: profile.coach_terms_accepted_at ?? null,
  };

  const rows: { icon: LucideIcon; label: string; sub?: string; onClick: () => void; testId?: string }[] = [
    { icon: UserRound, label: t('coach.editProfile'), onClick: () => navigate('/coach/profile'), testId: 'acct-edit-profile' },
    { icon: CreditCard, label: t('coach.planBilling'), sub: `${t(TIER_KEY[tier])} · ${t('coach.upToAthletes', { n: COACH_LIMITS[tier] })}`, onClick: () => navigate('/?plans=1'), testId: 'acct-plan' },
    { icon: MessageSquareText, label: t('coach.checkinReplies'), onClick: () => setSettingsOpen(true), testId: 'acct-coach-settings' },
    { icon: ShieldCheck, label: t('coach.viewRules'), onClick: () => navigate('/coach/rules') },
    { icon: Settings, label: t('coach.appSettings'), onClick: () => navigate('/settings'), testId: 'acct-app-settings' },
    { icon: FileText, label: t('coach.privacyPolicy'), onClick: () => navigate('/privacy') },
  ];

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-10 pt-5" dir={dir} data-testid="coach-account">
      <h1 className="mb-4 text-[22px] font-bold text-cloud">{t('nav.account')}</h1>
      <CoachProfileCard p={card} compact />
      <div className="mt-2 px-1 text-[11px] text-cloud-muted" dir="ltr">{profile.email} · {profile.coach_code}</div>

      <ul className="mt-5 overflow-hidden rounded-2xl border border-ink-border bg-ink-surface">
        {rows.map((r, i) => (
          <li key={r.label} className={i > 0 ? 'border-t border-ink-border' : undefined}>
            <button type="button" onClick={r.onClick} data-testid={r.testId} className="flex w-full items-center gap-3 px-4 py-3.5 text-start hover:bg-ink-elevated/50">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ink-elevated text-lime"><r.icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-cloud">{r.label}</span>
                {r.sub && <span className="block text-[11px] text-cloud-dim">{r.sub}</span>}
              </span>
              <ChevronRight className="h-4 w-4 text-cloud-muted rtl:rotate-180" />
            </button>
          </li>
        ))}
      </ul>

      <button type="button" onClick={() => signOut()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-rust/30 py-3 text-sm font-semibold text-rust" data-testid="acct-signout">
        <LogOut className="h-4 w-4 rtl:-scale-x-100" />{t('coach.signOut')}
      </button>

      {user && <CoachSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} userId={user.id} />}
    </div>
  );
}
