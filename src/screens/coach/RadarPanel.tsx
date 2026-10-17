import { useState } from 'react';
import { Activity as RadarIcon, ChevronRight, Clock as CalendarClock, Pause as PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { RADAR, STUDY, type Radar, type RadarLevel, type RadarReason } from '@/lib/coach/engagement';
import { setPause } from '@/lib/coach/api';
import { shortDate } from '@/lib/coach/recovery-plan';
import { Sheet } from './ui';

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

export const LEVEL_STYLE: Record<RadarLevel, string> = {
  critical: 'bg-rust/15 text-rust border-rust/40',
  high: 'bg-gold/15 text-gold border-gold/40',
  quiet: 'bg-sky/10 text-sky border-sky/30',
  ok: 'bg-lime/10 text-lime border-lime/30',
  paused: 'bg-ink-elevated text-cloud-dim border-ink-border',
};

export function radarReasonText(r: RadarReason, t: T): string {
  switch (r.code) {
    case 'inactive': return t('radar.inactive', { days: r.days });
    case 'fading': return t('radar.fading', { last7: r.last7, usual: r.usual });
    case 'short_checkins': return t('radar.shortCheckins', { recent: r.recent, before: r.before });
    case 'coach_silent': return r.never ? t('radar.coachNever', { days: r.days }) : t('radar.coachSilent', { days: r.days });
  }
}

/** What the study found for this length of inactivity (only for 14+ days, the points Pedersen 2019 reported). */
export function studyLine(radar: Radar, t: T): string | null {
  if (radar.inactiveDays == null || radar.level === 'paused') return null;
  if (radar.inactiveDays >= RADAR.criticalDays) return t('radar.study21', { pct: STUDY.inactive21, n: STUDY.n.toLocaleString('en') });
  if (radar.inactiveDays >= RADAR.highDays) return t('radar.study14', { pct: STUDY.inactive14, n: STUDY.n.toLocaleString('en') });
  return null;
}

/** Coach home: the athletes drifting away, most urgent first. */
export function RadarSection({ items, onOpen }: { items: { id: string; name: string; radar: Radar }[]; onOpen: (id: string) => void }) {
  const { t } = useI18n();
  if (!items.length) return null;
  return (
    <section className="mb-6" aria-labelledby="radar-title" data-testid="radar-section">
      <h2 id="radar-title" className="mb-1 flex items-center gap-2 text-sm font-semibold text-cloud"><RadarIcon className="h-4 w-4 text-gold" />{t('radar.title')}</h2>
      <p className="mb-2 text-[11px] text-cloud-muted">{t('radar.subtitle')}</p>
      <ul className="overflow-hidden rounded-2xl border border-ink-border bg-ink-surface">
        {items.slice(0, 8).map((it, i) => (
          <li key={it.id} className={cn(i > 0 && 'border-t border-ink-border/60')}>
            <button type="button" onClick={() => onOpen(it.id)} className="flex w-full items-center gap-3 px-4 py-3 text-start" data-testid="radar-row">
              <span className={cn('flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', LEVEL_STYLE[it.radar.level])}>{t(`radar.level_${it.radar.level}` as MessageKey)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-cloud" dir="auto">{it.name}</span>
                <span className="block truncate text-xs text-cloud-dim">{it.radar.reasons[0] ? radarReasonText(it.radar.reasons[0], t) : ''}</span>
              </span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-cloud-muted rtl:rotate-180" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Athlete overview: the radar for this athlete, with every reason, the study behind it and the pause control. */
export function RadarCard({ radar, athleteId, name, onChanged }: { radar: Radar; athleteId: string; name: string; onChanged: () => void }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const study = studyLine(radar, t);
  const today = new Date();
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const max = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90));

  const save = async (value: string | null) => {
    setErr(null);
    if (value && (value < ymd(today) || value > max)) { setErr(t('radar.pauseRange')); return; }
    setBusy(true);
    try { await setPause(athleteId, value, value ? reason : null); setOpen(false); onChanged(); } catch { setErr(t('coach.saveError')); } finally { setBusy(false); }
  };

  return (
    <section className={cn('rounded-2xl border p-4', radar.level === 'ok' ? 'border-ink-border bg-ink-surface' : LEVEL_STYLE[radar.level].replace(/text-\S+/, ''))} data-testid="radar-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-cloud"><RadarIcon className="h-4 w-4 text-gold" />{t('radar.title')}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', LEVEL_STYLE[radar.level])}>{t(`radar.level_${radar.level}` as MessageKey)}</span>
            <span className="text-[11px] text-cloud-dim">{t('radar.activeDays', { n: radar.last7, usual: radar.usualPerWeek })}</span>
          </div>
        </div>
        <button type="button" onClick={() => { setErr(null); setOpen(true); }} className="flex flex-shrink-0 items-center gap-1 rounded-xl border border-ink-border px-2.5 py-1.5 text-[11px] font-semibold text-cloud-dim" data-testid="pause-open">
          <PauseCircle className="h-3.5 w-3.5" />{radar.pausedUntil ? t('radar.paused', { date: shortDate(radar.pausedUntil, lang) }) : t('radar.pause')}
        </button>
      </div>
      {radar.reasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-cloud">{radar.reasons.map((r) => <li key={r.code}>• {radarReasonText(r, t)}</li>)}</ul>
      )}
      {radar.programEndsIn != null && radar.programEndsIn <= RADAR.programEndingDays && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gold" data-testid="program-ending"><CalendarClock className="h-3.5 w-3.5" />
          {radar.programEndsIn < 0 ? t('radar.programEnded', { days: -radar.programEndsIn }) : t('radar.programEnds', { days: radar.programEndsIn })}
        </p>
      )}
      {study && <p className="mt-2 text-[10px] leading-relaxed text-cloud-muted" data-testid="radar-study">{study}</p>}
      {radar.level !== 'ok' && radar.level !== 'paused' && <p className="mt-1 text-[10px] text-cloud-muted">{t('radar.ruleNote')}</p>}

      <Sheet open={open} title={t('radar.pauseTitle', { name })} onClose={() => setOpen(false)}>
        <p className="mb-3 text-xs leading-relaxed text-cloud-dim">{t('radar.pauseHelp')}</p>
        <label className="mb-2 block"><span className="mb-1 block text-[11px] text-cloud-dim">{t('radar.pauseUntil')}</span>
          <input type="date" value={until} min={ymd(today)} max={max} onChange={(e) => setUntil(e.target.value)} className="w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-2.5 text-sm text-cloud" data-testid="pause-until" /></label>
        <label className="mb-3 block"><span className="mb-1 block text-[11px] text-cloud-dim">{t('radar.pauseReason')}</span>
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} dir="auto" className="w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-2.5 text-sm text-cloud" placeholder={t('radar.pauseReasonPh')} /></label>
        {err && <p className="mb-2 text-xs text-rust">{err}</p>}
        <button type="button" disabled={busy || !until} onClick={() => save(until)} className="w-full rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg disabled:opacity-40" data-testid="pause-save">{t('radar.pauseSave')}</button>
        {radar.pausedUntil && <button type="button" disabled={busy} onClick={() => save(null)} className="mt-2 w-full rounded-xl border border-ink-border py-2.5 text-sm font-semibold text-cloud" data-testid="pause-end">{t('radar.pauseEnd')}</button>}
      </Sheet>
    </section>
  );
}
