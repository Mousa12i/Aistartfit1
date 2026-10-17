import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { fetchRoster } from '@/lib/coach/api';
import type { RosterRow } from '@/lib/coach/insights';
import { Avatar } from './ui';

/** Every athlete's conversation in one list: unread first. */
export function CoachInbox() {
  const navigate = useNavigate();
  const { t, dir } = useI18n();
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');

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
      <h1 className="mb-4 text-[22px] font-bold text-cloud">{t('coach.inboxTitle')}</h1>
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
    </div>
  );
}
