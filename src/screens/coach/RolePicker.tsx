import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Dumbbell, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { becomeCoach, fetchMyCoach, setAthleteRole, type MyCoach } from '@/lib/coach/api';
import { pendingJoinCode } from './MyCoach';

/** Asked once after the language: "Are you training, or coaching others?" */
export function RolePicker() {
  const { user, refreshProfile } = useAuth();
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'athlete' | 'coach' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (role: 'athlete' | 'coach') => {
    if (!user) return;
    setBusy(role);
    setError(null);
    try {
      if (role === 'coach') await becomeCoach();
      else await setAthleteRole(user.id);
      await refreshProfile();
      navigate(role === 'coach' ? '/coach' : pendingJoinCode() ? '/my-coach' : '/', { replace: true });
    } catch {
      setError(t('coach.saveError'));
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-ink-bg px-6 py-10" dir={dir} data-testid="role-picker">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-display-md text-cloud">{t('coach.roleTitle')}</h1>
        <p className="mb-8 mt-2 text-sm leading-relaxed text-cloud-dim">{t('coach.roleSubtitle')}</p>
        <div className="space-y-3">
          <RoleCard icon={<Dumbbell className="h-6 w-6" />} title={t('coach.roleAthlete')} body={t('coach.roleAthleteBody')} busy={busy === 'athlete'} onPick={() => pick('athlete')} testId="role-athlete" />
          <RoleCard icon={<Users className="h-6 w-6" />} title={t('coach.roleCoach')} body={t('coach.roleCoachBody')} busy={busy === 'coach'} onPick={() => pick('coach')} testId="role-coach" />
        </div>
        {error && <p className="mt-4 text-xs text-rust">{error}</p>}
        <p className="mt-6 text-[11px] text-cloud-muted">{t('coach.roleChangeLater')}</p>
      </div>
    </div>
  );
}

function RoleCard({ icon, title, body, busy, onPick, testId }: { icon: React.ReactNode; title: string; body: string; busy: boolean; onPick: () => void; testId: string }) {
  return (
    <button type="button" onClick={onPick} disabled={busy} data-testid={testId}
      className={cn('flex w-full items-start gap-4 rounded-3xl border border-ink-border bg-ink-surface p-5 text-start transition-colors hover:border-lime/50', busy && 'opacity-60')}>
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-lime/10 text-lime">{icon}</div>
      <div>
        <div className="text-lg font-bold text-cloud">{title}</div>
        <div className="mt-1 text-sm leading-relaxed text-cloud-dim">{body}</div>
      </div>
    </button>
  );
}

/** Home entry: the coach portal for coaches, "My coach" for athletes. */
export function CoachEntryCard() {
  const { profile } = useAuth();
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const [coach, setCoach] = useState<MyCoach | null>(null);
  const isCoach = profile?.account_type === 'coach';

  useEffect(() => {
    if (!isCoach) fetchMyCoach().then(setCoach).catch(() => setCoach(null));
  }, [isCoach]);

  if (isCoach) {
    return (
      <button type="button" dir={dir} onClick={() => navigate('/coach')} data-testid="coach-entry"
        className="flex w-full items-center gap-3 rounded-2xl border border-lime/30 bg-gradient-to-br from-lime/10 to-transparent p-4 text-start">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-lime text-ink-bg"><ClipboardList className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-cloud">{t('coach.portal')}</div>
          <div className="text-[11px] text-cloud-dim">{t('coach.portalEntryBody')}</div>
        </div>
      </button>
    );
  }
  if (!coach && profile?.account_type !== 'athlete') return null;
  return (
    <button type="button" dir={dir} onClick={() => navigate('/my-coach')} data-testid="my-coach-entry"
      className="flex w-full items-center gap-3 rounded-2xl border border-ink-border bg-ink-surface p-4 text-start">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-ink-elevated text-lime"><Users className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-cloud">{coach ? (coach.brand_name || coach.display_name) : t('coach.haveCoach')}</div>
        <div className="text-[11px] text-cloud-dim">{coach ? (coach.unread > 0 ? t('coach.newMessages', { n: coach.unread }) : t('coach.openMyCoach')) : t('coach.haveCoachBody')}</div>
      </div>
      {coach && coach.unread > 0 && <span className="rounded-full bg-sky px-2 py-0.5 text-[11px] font-bold text-ink-bg">{coach.unread}</span>}
    </button>
  );
}
