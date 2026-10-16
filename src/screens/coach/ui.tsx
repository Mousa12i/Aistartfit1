import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MessageKey } from '@/lib/i18n';
import type { Reason, RiskLevel } from '@/lib/coach/insights';
import { photoUrl } from '@/lib/coach/api';

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

const HUES = ['#A6FF32', '#4AA8E5', '#FFB224', '#7ADFA9', '#C9A2FF', '#FF8A7A'];

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function hueFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function Avatar({ id, name, url, size = 40 }: { id: string; name: string | null; url?: string | null; size?: number }) {
  const hue = hueFor(id);
  if (url) return <img src={url} alt="" className="flex-shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <div
      aria-hidden="true"
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, background: `${hue}22`, color: hue, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}

export const RISK_STYLE: Record<RiskLevel, { dot: string; text: string; ring: string }> = {
  ok: { dot: 'bg-lime', text: 'text-lime', ring: 'ring-lime/30' },
  watch: { dot: 'bg-gold', text: 'text-gold', ring: 'ring-gold/30' },
  at_risk: { dot: 'bg-rust', text: 'text-rust', ring: 'ring-rust/30' },
};

export function RiskBadge({ level, t }: { level: RiskLevel; t: T }) {
  const key: MessageKey = level === 'at_risk' ? 'coach.riskAtRisk' : level === 'watch' ? 'coach.riskWatch' : 'coach.riskOk';
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-ink-elevated px-2 py-0.5 text-[11px] font-semibold', RISK_STYLE[level].text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', RISK_STYLE[level].dot)} />
      {t(key)}
    </span>
  );
}

export function reasonText(r: Reason, t: T): string {
  switch (r.code) {
    case 'no_workout': return t('coach.reasonNoWorkout', { days: r.days });
    case 'never_trained': return t('coach.reasonNeverTrained', { days: r.days });
    case 'no_food': return t('coach.reasonNoFood', { days: r.days });
    case 'checkin_overdue': return t('coach.reasonCheckin', { days: r.days });
    case 'low_consistency': return t('coach.reasonLowConsistency', { sessions: r.sessions });
  }
}

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Fourteen days at a glance: a tall bar for a day trained, a small dot under it for a day with food logged.
 * Today is on the right edge.
 */
export function PulseStrip({ trainDates, foodDates, now, label }: { trainDates: string[]; foodDates: string[]; now: Date; label: string }) {
  const train = new Set(trainDates.map((d) => d.slice(0, 10)));
  const food = new Set(foodDates.map((d) => d.slice(0, 10)));
  const days = Array.from({ length: 14 }, (_, i) => isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i)));
  return (
    <div className="flex items-end gap-[3px]" role="img" aria-label={label} dir="ltr">
      {days.map((d, i) => (
        <div key={d} className="flex flex-col items-center gap-[3px]">
          <div className={cn('w-[7px] rounded-[2px]', train.has(d) ? 'h-4 bg-lime' : 'h-4 bg-ink-border/50', i === 13 && 'outline outline-1 outline-offset-1 outline-cloud-muted/60')} />
          <div className={cn('h-[3px] w-[3px] rounded-full', food.has(d) ? 'bg-sky' : 'bg-transparent')} />
        </div>
      ))}
    </div>
  );
}

/** Weight line with its first and last value. */
export function Sparkline({ points, width = 120, height = 32 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 0.4);
  const x = (i: number) => 2 + (i / (points.length - 1)) * (width - 4);
  const y = (v: number) => 3 + (1 - (v - min) / span) * (height - 6);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" dir="ltr">
      <path d={d} fill="none" stroke="#A6FF32" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="2.5" fill="#A6FF32" />
    </svg>
  );
}

/** Bottom sheet used for editing (targets, an exercise, settings). */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[88vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-3xl border-t border-ink-border bg-ink-surface px-5 pb-8 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-border" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-cloud">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A private photo, loaded through a short-lived signed link. */
export function PrivatePhoto({ path, className, onOpen }: { path: string; className?: string; onOpen?: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    photoUrl(path).then((u) => { if (alive) setUrl(u); }).catch(() => undefined);
    return () => { alive = false; };
  }, [path]);
  if (!url) return <div className={cn('animate-pulse bg-ink-elevated', className)} />;
  return (
    <button type="button" onClick={() => onOpen?.(url)} className="block">
      <img src={url} alt="" className={cn('object-cover', className)} />
    </button>
  );
}

export function Lightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <img src={url} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
    </div>
  );
}

/** A 1–10 score coloured good / middling / poor. For stress and hunger a high number is the poor end. */
export function ScoreDots({ value, max = 10, invert = false }: { value: number | null; max?: number; invert?: boolean }) {
  if (value == null) return <span className="text-cloud-muted">—</span>;
  const good = invert ? max + 1 - value : value;
  const tone = good >= 7 ? 'text-lime' : good >= 4 ? 'text-gold' : 'text-rust';
  return <span className={cn('font-bold tabular-nums', tone)} dir="ltr">{value}/{max}</span>;
}

export function StatBlock({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl bg-ink-elevated px-3.5 py-3">
      <div className="text-[11px] text-cloud-dim">{label}</div>
      <div className={cn('mt-0.5 text-xl font-bold tabular-nums text-cloud', tone)} dir="ltr">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-cloud-muted">{sub}</div>}
    </div>
  );
}

/** "muscle_gain" → "Muscle gain" (profile values are stored as codes). */
export function humanize(v: string | null | undefined): string {
  if (!v) return '—';
  const s = v.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function relativeDays(iso: string | null, now: Date, t: T): string {
  if (!iso) return t('coach.never');
  const d = Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return t('coach.today');
  if (d === 1) return t('coach.yesterday');
  return t('coach.daysAgo', { days: d });
}
