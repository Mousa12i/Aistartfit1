import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, Info, Minus, Plus, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REFERENCES } from '@/lib/nutrition/evidence';

export const MACRO_COLORS = {
  protein: '#A6FF32',
  carbs: '#FFB224',
  fat: '#4AA8E5',
  fiber: '#7ADFA9',
  kcal: '#A6FF32',
  over: '#E5484D',
} as const;

export function fmt(value: number | null | undefined, decimals = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-GB', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 -mx-5 mb-4 flex items-center gap-3 border-b border-ink-border/40 bg-ink-bg/85 px-5 pb-3 pt-5 backdrop-blur-xl">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim transition-colors hover:text-cloud"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-bold leading-tight text-cloud">{title}</h1>
        {subtitle && <div className="truncate text-xs text-cloud-dim">{subtitle}</div>}
      </div>
      {right}
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-2xl px-5 pb-32 animate-fade-in', className)}>{children}</div>;
}

export function Section({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mb-6', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold text-cloud">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Panel({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const classes = cn('rounded-2xl border border-ink-border bg-ink-surface', onClick && 'cursor-pointer text-left transition-colors hover:border-lime/30 active:scale-[0.995]', className);
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(classes, 'block w-full')}>
        {children}
      </button>
    );
  }
  return <div className={classes}>{children}</div>;
}

/** Circular progress ring. `value` above `max` turns the ring red. */
export function Ring({
  value,
  max,
  size = 164,
  stroke = 14,
  color = MACRO_COLORS.kcal,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.max(0, value / max) : 0;
  const over = ratio > 1.05;
  const shown = Math.min(1, ratio);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1C2A23" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? MACRO_COLORS.over : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.32,0.72,0,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, max, color, className }: { value: number; max: number; color: string; className?: string }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-ink-elevated', className)}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ratio * 100}%`, backgroundColor: color }} />
    </div>
  );
}

export function MacroBar({ label, value, target, color, unit = 'g' }: { label: string; value: number; target: number; color: string; unit?: string }) {
  const over = target > 0 && value > target * 1.1;
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-cloud">{label}</p>
      <p className={cn('mb-1.5 whitespace-nowrap text-[11px] tabular-nums', over ? 'text-rust' : 'text-cloud-dim')}>
        <span className="font-semibold text-cloud">{fmt(value)}</span> / {fmt(target)} {unit}
      </p>
      <ProgressBar value={value} max={target} color={over ? MACRO_COLORS.over : color} />
    </div>
  );
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim hover:text-cloud',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-ink-elevated p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-all',
            value === o.value ? 'bg-ink-surface text-cloud shadow-card' : 'text-cloud-dim hover:text-cloud',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-cloud">{label}</span>
        {description && <span className="mt-0.5 block text-[11px] leading-relaxed text-cloud-dim">{description}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className={cn('relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors', checked ? 'bg-lime' : 'bg-ink-border')}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-cloud shadow transition-all', checked ? 'left-[22px] bg-ink-bg' : 'left-0.5')} />
      </span>
    </label>
  );
}

export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  suffix,
  decimals = 0,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  suffix?: string;
  decimals?: number;
  label: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(Number(value.toFixed(decimals)))), [value, decimals]);
  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    else setText(String(value));
  };
  const bump = (dir: 1 | -1) => onChange(Math.min(max, Math.max(min, Number((value + dir * step).toFixed(decimals)))));
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => bump(-1)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-elevated text-cloud hover:bg-ink-border">
        <Minus className="h-4 w-4" />
      </button>
      <label className="flex flex-1 items-baseline justify-center gap-1 rounded-xl border border-ink-border bg-ink-bg px-3 py-2">
        <span className="sr-only">{label}</span>
        <input
          value={text}
          inputMode="decimal"
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          }}
          className="w-20 bg-transparent text-center text-xl font-bold tabular-nums text-cloud focus:outline-none"
        />
        {suffix && <span className="text-xs text-cloud-dim">{suffix}</span>}
      </label>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => bump(1)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-elevated text-cloud hover:bg-ink-border">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Notice({ tone = 'info', title, children, action }: { tone?: 'info' | 'warn' | 'danger' | 'success'; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const styles = {
    info: { box: 'border-sky/25 bg-sky/5', icon: <Info className="h-4 w-4 text-sky" /> },
    warn: { box: 'border-gold/30 bg-gold/5', icon: <AlertTriangle className="h-4 w-4 text-gold" /> },
    danger: { box: 'border-rust/35 bg-rust/5', icon: <ShieldAlert className="h-4 w-4 text-rust" /> },
    success: { box: 'border-lime/25 bg-lime/5', icon: <CheckCircle2 className="h-4 w-4 text-lime" /> },
  }[tone];
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-3.5', styles.box)} role={tone === 'danger' || tone === 'warn' ? 'alert' : undefined}>
      <div className="mt-0.5 flex-shrink-0">{styles.icon}</div>
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold text-cloud">{title}</p>}
        {children && <div className="mt-0.5 text-xs leading-relaxed text-cloud-dim">{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-border px-6 py-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-elevated text-lime">{icon}</div>
      <p className="text-sm font-semibold text-cloud">{title}</p>
      {body && <p className="mt-1 max-w-xs text-xs leading-relaxed text-cloud-dim">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

/** Small citation chips that open the reference in a new tab. */
export function Citations({ ids, className }: { ids: string[]; className?: string }) {
  const refs = ids.map((id) => REFERENCES[id]).filter(Boolean);
  if (!refs.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {refs.map((r) => (
        <a
          key={r.id}
          href={r.url}
          target="_blank"
          rel="noreferrer"
          title={r.citation}
          className="rounded-md bg-ink-elevated px-2 py-0.5 text-[10px] text-cloud-dim transition-colors hover:text-lime"
        >
          {r.short}
        </a>
      ))}
    </div>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(id);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="fixed inset-x-0 bottom-28 z-[60] flex justify-center px-5" role="status">
      <div className="animate-slide-up rounded-full border border-lime/30 bg-ink-elevated px-4 py-2.5 text-sm font-medium text-cloud shadow-elevated">{message}</div>
    </div>
  );
}

export function SetupRequired({ feature }: { feature: string }) {
  return (
    <Notice tone="warn" title="Database update needed">
      {feature} needs the latest database migration (<code className="text-cloud">20261013150000_nutrition_hub.sql</code>). Run{' '}
      <code className="text-cloud">supabase db push</code> and reload the app. Your existing diary keeps working in the meantime.
    </Notice>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-cloud-dim">
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-3 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none';
