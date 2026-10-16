import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ClipboardCheck, Dumbbell, MessageCircle, Target, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { enablePush, listNotifications, markAllRead, needsInstallForPush, pushState, unreadCount, type AppNotification, type NotificationKind, type PushState } from '@/lib/push';

const KIND: Record<NotificationKind, { icon: typeof Bell; key: MessageKey; tone: string }> = {
  message: { icon: MessageCircle, key: 'notif.message', tone: 'text-sky' },
  checkin: { icon: ClipboardCheck, key: 'notif.checkin', tone: 'text-lime' },
  checkin_reviewed: { icon: ClipboardCheck, key: 'notif.checkinReviewed', tone: 'text-lime' },
  new_athlete: { icon: UserPlus, key: 'notif.newAthlete', tone: 'text-gold' },
  targets_changed: { icon: Target, key: 'notif.targetsChanged', tone: 'text-gold' },
  routine_given: { icon: Dumbbell, key: 'notif.routineGiven', tone: 'text-lime' },
};

/** Bell with unread count; opens the notification list. Refreshes every 30 s while the app is open. */
export function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuth();
  const { t, dir, lang } = useI18n();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => { unreadCount().then(setCount).catch(() => undefined); }, []);
  useEffect(() => {
    if (!user) return;
    refresh();
    const id = window.setInterval(refresh, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [user, refresh]);

  const openList = async () => {
    setOpen(true);
    const list = await listNotifications().catch(() => []);
    setItems(list);
    pushState().then(setPush).catch(() => setPush('unsupported'));
    const unread = list.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length) { await markAllRead(unread).catch(() => undefined); setCount(0); }
  };

  const turnOn = async () => {
    if (!user) return;
    setBusy(true);
    try { setPush(await enablePush(user.id)); } catch { setPush('off'); } finally { setBusy(false); }
  };

  const when = (iso: string) => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    try {
      const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
      if (mins < 60) return rtf.format(-mins, 'minute');
      if (mins < 1440) return rtf.format(-Math.round(mins / 60), 'hour');
      return rtf.format(-Math.round(mins / 1440), 'day');
    } catch {
      return '';
    }
  };

  return (
    <>
      <button type="button" onClick={openList} aria-label={t('notif.title')} data-testid="notif-bell"
        className={cn('relative flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim hover:text-cloud', className)}>
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -end-1 -top-1 min-w-[18px] rounded-full bg-rust px-1 text-center text-[10px] font-bold leading-[18px] text-white" data-testid="notif-count">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)}>
          <div dir={dir} role="dialog" aria-modal="true" aria-label={t('notif.title')} onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-3xl border-t border-ink-border bg-ink-surface px-5 pb-8 pt-4 sm:rounded-3xl" data-testid="notif-list">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-cloud">{t('notif.title')}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><X className="h-4 w-4" /></button>
            </div>

            {push === 'off' && (
              <div className="mb-4 rounded-2xl border border-lime/30 bg-lime/5 p-4">
                <p className="text-sm text-cloud">{t('notif.enablePrompt')}</p>
                <button type="button" onClick={turnOn} disabled={busy} className="mt-3 w-full rounded-xl bg-lime py-2.5 text-sm font-bold text-ink-bg disabled:opacity-50" data-testid="notif-enable">{t('notif.enable')}</button>
              </div>
            )}
            {push === 'needs-install' && <p className="mb-4 rounded-2xl bg-ink-elevated p-4 text-xs leading-relaxed text-cloud-dim">{t('notif.iosInstall')}</p>}
            {push === 'denied' && <p className="mb-4 rounded-2xl bg-ink-elevated p-4 text-xs leading-relaxed text-cloud-dim">{t('notif.denied')}</p>}

            {!items && <div className="h-24 animate-pulse rounded-2xl bg-ink-elevated" />}
            {items && items.length === 0 && <p className="py-10 text-center text-sm text-cloud-dim">{t('notif.empty')}</p>}
            <ul className="space-y-1.5">
              {(items ?? []).map((n) => {
                const k = KIND[n.kind];
                const Icon = k.icon;
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => { setOpen(false); navigate(n.url); }}
                      className={cn('flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-start hover:bg-ink-elevated', !n.read_at && 'bg-ink-elevated/60')}>
                      <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', k.tone)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-cloud">{t(k.key, { name: n.actor_name ?? 'StartFit' })}</div>
                        {n.preview && <div dir="auto" className="mt-0.5 line-clamp-2 text-xs text-cloud-dim">{n.preview}</div>}
                        <div className="mt-1 text-[10px] text-cloud-muted">{when(n.created_at)}</div>
                      </div>
                      {!n.read_at && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-lime" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

export { needsInstallForPush };
