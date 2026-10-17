import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Megaphone, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { broadcast, fetchRoster } from '@/lib/coach/api';
import type { RosterRow } from '@/lib/coach/insights';
import { Avatar, Sheet } from './ui';

/** Every athlete's conversation in one list: unread first. */
export function CoachInbox() {
  const navigate = useNavigate();
  const { t, dir } = useI18n();
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  const [bcOpen, setBcOpen] = useState(false);
  const [bcText, setBcText] = useState('');
  const [bcTo, setBcTo] = useState<string[] | null>(null);
  const [bcBusy, setBcBusy] = useState(false);
  const [bcResult, setBcResult] = useState<string | null>(null);

  const sendBroadcast = async () => {
    if (!bcText.trim()) return;
    setBcBusy(true);
    setBcResult(null);
    try {
      const n = await broadcast(bcText.trim(), bcTo);
      setBcResult(t('coach.broadcastSent', { n }));
      setBcText('');
    } catch {
      setBcResult(t('coach.sendError'));
    } finally {
      setBcBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const load = () => fetchRoster().then((r) => alive && setRows(r)).catch(() => alive && setError(true));
    load();
    const id = window.setInterval(load, 20000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const list = useMemo(() => (rows ?? [])
    .filter((r) => !q.trim() || (r.display_name ?? '').toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.unread - a.unread || (a.display_name ?? '').localeCompare(b.display_name ?? '')), [rows, q]);

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-10 pt-5" dir={dir} data-testid="coach-inbox">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold text-cloud">{t('coach.inboxTitle')}</h1>
        {rows && rows.length > 0 && (
          <button type="button" onClick={() => { setBcOpen(true); setBcResult(null); }} className="flex h-10 items-center gap-1.5 rounded-xl bg-lime px-3.5 text-sm font-bold text-ink-bg" data-testid="broadcast-open">
            <Megaphone className="h-4 w-4 rtl:-scale-x-100" />{t('coach.broadcast')}
          </button>
        )}
      </div>
      {error && <p className="mb-3 rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">{t('coach.loadError')}</p>}
      {rows && rows.length > 0 && (
        <label className="mb-3 flex items-center gap-2 rounded-xl border border-ink-border bg-ink-surface px-3">
          <Search className="h-4 w-4 text-cloud-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('coach.search')} className="h-10 w-full bg-transparent text-sm text-cloud placeholder:text-cloud-muted focus:outline-none" />
        </label>
      )}
      {!rows && !error && <div className="h-40 animate-pulse rounded-2xl bg-ink-surface" />}
      {rows && rows.length === 0 && <p className="py-12 text-center text-sm text-cloud-dim">{t('coach.inboxEmpty')}</p>}
      <ul className="overflow-hidden rounded-2xl border border-ink-border bg-ink-surface">
        {list.map((r, i) => (
          <li key={r.athlete_id} className={cn(i > 0 && 'border-t border-ink-border')}>
            <button type="button" onClick={() => navigate(`/coach/athlete/${r.athlete_id}?tab=chat`)} className="flex w-full items-center gap-3 px-4 py-3.5 text-start hover:bg-ink-elevated/50" data-testid="inbox-row">
              <Avatar id={r.athlete_id} name={r.display_name} url={r.avatar_url} size={40} />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm', r.unread ? 'font-bold text-cloud' : 'font-medium text-cloud')} dir="auto">{r.display_name ?? '—'}</span>
                <span className="block text-[11px] text-cloud-dim">{r.unread ? t('coach.triageMessage', { n: r.unread }) : t('coach.inboxOpen')}</span>
              </span>
              {r.unread > 0 && <span className="min-w-[22px] rounded-full bg-lime px-1.5 text-center text-[11px] font-bold leading-[22px] text-ink-bg">{r.unread}</span>}
              <ChevronRight className="h-4 w-4 text-cloud-muted rtl:rotate-180" />
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={bcOpen} title={t('coach.broadcast')} onClose={() => setBcOpen(false)}>
        <p className="mb-3 text-xs leading-relaxed text-cloud-dim">{t('coach.broadcastHelp')}</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setBcTo(null)} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium', bcTo == null ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')}>{t('coach.broadcastAll', { n: rows?.length ?? 0 })}</button>
          {(rows ?? []).map((r) => {
            const on = bcTo?.includes(r.athlete_id) ?? false;
            return (
              <button key={r.athlete_id} type="button" dir="auto"
                onClick={() => setBcTo((cur) => { const list = cur ?? []; const next = on ? list.filter((x) => x !== r.athlete_id) : [...list, r.athlete_id]; return next.length ? next : null; })}
                className={cn('flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium', on ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')}>
                {on && <Check className="h-3 w-3" />}{r.display_name ?? '—'}
              </button>
            );
          })}
        </div>
        <textarea value={bcText} onChange={(e) => setBcText(e.target.value.slice(0, 4000))} rows={5} dir="auto" placeholder={t('coach.messagePlaceholder')} data-testid="broadcast-text"
          className="w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-2.5 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none" />
        {bcResult && <p className="mt-2 text-xs text-lime" data-testid="broadcast-result">{bcResult}</p>}
        <button type="button" onClick={sendBroadcast} disabled={bcBusy || !bcText.trim()} className="mt-3 w-full rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg disabled:opacity-40" data-testid="broadcast-send">
          {bcTo ? t('coach.broadcastSendTo', { n: bcTo.length }) : t('coach.broadcastSendAll')}
        </button>
      </Sheet>
    </div>
  );
}
