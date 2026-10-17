import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarCheck, Layers, MessageCircle, User, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { fetchRoster } from '@/lib/coach/api';
import { NotificationBell } from './NotificationBell';

const TABS: { key: string; path: string; label: MessageKey; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { key: 'team', path: '/', label: 'nav.team', icon: Users, match: (p) => p === '/' || p.startsWith('/coach/athlete') },
  { key: 'week', path: '/coach/week', label: 'nav.week', icon: CalendarCheck, match: (p) => p.startsWith('/coach/week') },
  { key: 'inbox', path: '/coach/inbox', label: 'nav.inbox', icon: MessageCircle, match: (p) => p.startsWith('/coach/inbox') },
  { key: 'programs', path: '/coach/programs', label: 'nav.programs', icon: Layers, match: (p) => p.startsWith('/coach/programs') },
  { key: 'account', path: '/coach/account', label: 'nav.account', icon: User, match: (p) => p.startsWith('/coach/account') || p.startsWith('/coach/profile') || p.startsWith('/coach/rules') || p.startsWith('/settings') },
];

/** The coach app: its own navigation, nothing from the athlete app. */
export function CoachShell({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => fetchRoster().then((r) => alive && setUnread(r.reduce((a, x) => a + (x.unread || 0), 0))).catch(() => undefined);
    load();
    const id = window.setInterval(load, 45000);
    return () => { alive = false; window.clearInterval(id); };
  }, [pathname]);

  const badge = (key: string) => (key === 'inbox' && unread > 0 ? (unread > 99 ? '99+' : String(unread)) : null);

  return (
    <div className="min-h-screen min-h-dvh bg-ink-bg lg:flex" data-testid="coach-shell">
      {!hideNav && (
        <aside className="hidden w-56 flex-shrink-0 border-e border-ink-border bg-ink-bg lg:flex lg:flex-col" dir={dir}>
          <div className="flex h-16 items-center gap-2 px-5">
            <span className="text-xl font-black italic tracking-tight text-cloud">START<span className="text-lime">FIT</span></span>
            <span className="rounded-md bg-lime/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-lime">{t('coach.coach')}</span>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {TABS.map((tab) => {
              const active = tab.match(pathname);
              const b = badge(tab.key);
              return (
                <button key={tab.key} type="button" onClick={() => navigate(tab.path)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-xs transition-colors', active ? 'bg-lime/10 text-lime ring-1 ring-lime/20' : 'text-cloud-dim hover:bg-ink-surface hover:text-cloud')}>
                  <tab.icon className="h-4 w-4" />{t(tab.label)}
                  {b && <span className="ms-auto rounded-full bg-rust px-1.5 text-[10px] font-bold text-white">{b}</span>}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-ink-border px-4 py-4"><NotificationBell /></div>
        </aside>
      )}
      <div className="flex min-h-screen min-h-dvh min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>
        {!hideNav && (
          <nav className="glass-nav safe-bottom border-t border-ink-border/50 lg:hidden" dir={dir} data-testid="coach-nav">
            <div className="mx-auto flex max-w-md items-center justify-around px-1 py-2">
              {TABS.map((tab) => {
                const active = tab.match(pathname);
                const b = badge(tab.key);
                return (
                  <button key={tab.key} type="button" onClick={() => navigate(tab.path)} data-testid={`coach-tab-${tab.key}`}
                    className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition-all active:scale-95">
                    {active && <div className="absolute inset-0 rounded-xl bg-lime/8 ring-1 ring-lime/20" />}
                    <div className="relative p-1.5">
                      <tab.icon className={cn('h-5 w-5', active ? 'text-lime' : 'text-cloud-dim')} />
                      {b && <span className="absolute -end-1.5 -top-1 min-w-[16px] rounded-full bg-rust px-1 text-center text-[9px] font-bold leading-4 text-white">{b}</span>}
                    </div>
                    <span className={cn('text-[10px] font-medium', active ? 'text-lime' : 'text-cloud-dim')}>{t(tab.label)}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
