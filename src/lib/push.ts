// Phone / browser notifications (Web Push) and the in-app notification list.
import { supabase } from './supabase';

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** On iPhone, web notifications only work once StartFit is added to the Home Screen (iOS 16.4+). */
export function needsInstallForPush(): boolean {
  return isIos() && !isStandalone();
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function pushState(): Promise<PushState> {
  if (needsInstallForPush() && !pushSupported()) return 'needs-install';
  if (!pushSupported()) return needsInstallForPush() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

function keyBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const b64 = (buf: ArrayBuffer | null) => {
  if (!buf) return '';
  let s = '';
  for (const x of new Uint8Array(buf)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Must be called from a tap (browsers only show the permission prompt after a user action). */
export async function enablePush(userId: string): Promise<PushState> {
  if (!pushSupported()) return needsInstallForPush() ? 'needs-install' : 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const { data: publicKey, error } = await supabase.rpc('push_public_key');
  if (error || typeof publicKey !== 'string' || !publicKey) throw new Error('push_not_ready');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey).buffer as ArrayBuffer });
  const { error: saveError } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: b64(sub.getKey('p256dh')),
    auth: b64(sub.getKey('auth')),
    user_agent: navigator.userAgent.slice(0, 200),
  }, { onConflict: 'endpoint' });
  if (saveError) throw saveError;
  await supabase.from('profiles').update({ notification_enabled: true }).eq('id', userId);
  return 'on';
}

export async function disablePush(userId: string): Promise<PushState> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } finally {
    await supabase.from('profiles').update({ notification_enabled: false }).eq('id', userId);
  }
  return 'off';
}

/** Keeps the service worker registered so taps on notifications open the app. */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined); });
}

// ---------------- in-app list ----------------

export type NotificationKind = 'message' | 'checkin' | 'checkin_reviewed' | 'new_athlete' | 'targets_changed' | 'routine_given' | 'recovery_plan';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  actor_name: string | null;
  preview: string | null;
  url: string;
  created_at: string;
  read_at: string | null;
}

export async function listNotifications(): Promise<AppNotification[]> {
  const { data } = await supabase.from('notifications').select('id, kind, actor_name, preview, url, created_at, read_at').order('created_at', { ascending: false }).limit(50);
  return (data ?? []) as AppNotification[];
}

export async function unreadCount(): Promise<number> {
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return count ?? 0;
}

export async function markAllRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
  nav.clearAppBadge?.().catch(() => undefined);
}
