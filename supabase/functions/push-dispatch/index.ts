// Sends pending notifications to people's devices (Web Push). Called every minute by a pg_cron job
// with a shared secret; it never accepts calls from the app.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { bytesToB64url, sendPush } from '../_shared/webpush.ts';
import { pushText } from './text.ts';
import { insideHours } from './hours.ts';

const SUBJECT = 'https://aistartfit1.vercel.app';

function reply(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// deno-lint-ignore no-explicit-any
async function config(db: any): Promise<Record<string, string>> {
  const { data, error } = await db.rpc('push_config_get');
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
}

Deno.serve(async (req: Request) => {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return reply({ error: 'not_configured' }, 503);
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    let cfg = await config(db);
    if (!cfg.cron_secret || req.headers.get('x-cron-secret') !== cfg.cron_secret) return reply({ error: 'forbidden' }, 403);

    // First run: create the VAPID key pair inside the server and keep it in the private settings.
    if (!cfg.vapid_private_jwk || !cfg.vapid_public) {
      const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
      const pub = bytesToB64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
      await db.rpc('push_config_set', { k: 'vapid_private_jwk', v: JSON.stringify(jwk) });
      await db.rpc('push_config_set', { k: 'vapid_public', v: pub });
      cfg = await config(db);
    }
    const vapid = { privateJwk: JSON.parse(cfg.vapid_private_jwk) as JsonWebKey, publicKey: cfg.vapid_public, subject: SUBJECT };

    // Normal notifications go out within 30 minutes; ones held for a coach's reply hours can wait up to 16 hours.
    const fresh = Date.now() - 30 * 60000;
    const since = new Date(Date.now() - 16 * 3600000).toISOString();
    const { data: pending } = await db.from('notifications').select('id, user_id, kind, actor_name, preview, url, created_at')
      .is('pushed_at', null).gte('created_at', since).order('created_at').limit(500);
    const list = (pending ?? []) as { id: string; user_id: string; kind: string; actor_name: string | null; preview: string | null; url: string; created_at: string }[];
    if (!list.length) return reply({ sent: 0 });

    const users = [...new Set(list.map((n) => n.user_id))];
    const [{ data: profiles }, { data: subs }] = await Promise.all([
      db.from('profiles').select('id, notification_enabled, preferred_language, coach_hours_start, coach_hours_end, coach_hours_tz').in('id', users),
      db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, failures').in('user_id', users),
    ]);
    type Prof = { id: string; notification_enabled: boolean | null; preferred_language: string | null; coach_hours_start: number | null; coach_hours_end: number | null; coach_hours_tz: string | null };
    const prof = new Map(((profiles ?? []) as Prof[]).map((p) => [p.id, p]));
    const unread = new Map<string, number>();
    for (const u of users) {
      const { count } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', u).is('read_at', null);
      unread.set(u, count ?? 0);
    }

    let sent = 0;
    let failed = 0;
    let held = 0;
    for (const n of list) {
      const p = prof.get(n.user_id);
      const hasHours = p?.coach_hours_start != null && p?.coach_hours_end != null;
      if (hasHours && !insideHours(p!.coach_hours_start, p!.coach_hours_end, p!.coach_hours_tz)) { held++; continue; }
      if (!hasHours && new Date(n.created_at).getTime() < fresh) {
        await db.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', n.id);
        continue;
      }
      const targets = ((subs ?? []) as { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; failures: number }[]).filter((s) => s.user_id === n.user_id);
      if (p?.notification_enabled !== false) {
        const text = pushText(p?.preferred_language, n.kind as Parameters<typeof pushText>[1], n.actor_name ?? 'StartFit', n.preview);
        const payload = JSON.stringify({ ...text, url: n.url, tag: `${n.kind}:${n.url}`, badge: unread.get(n.user_id) ?? 0 });
        for (const s of targets) {
          try {
            const r = await sendPush(s, payload, vapid);
            if (r.ok) { sent++; await db.from('push_subscriptions').update({ last_ok_at: new Date().toISOString(), failures: 0 }).eq('id', s.id); }
            else if (r.gone || s.failures >= 9) { failed++; await db.from('push_subscriptions').delete().eq('id', s.id); }
            else { failed++; await db.from('push_subscriptions').update({ failures: s.failures + 1 }).eq('id', s.id); }
          } catch (e) {
            failed++;
            console.error('push send failed', e instanceof Error ? e.message : e);
          }
        }
      }
      await db.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', n.id);
    }
    return reply({ processed: list.length, sent, failed, held });
  } catch (e) {
    console.error('push-dispatch error', e);
    return reply({ error: 'failed' }, 500);
  }
});
