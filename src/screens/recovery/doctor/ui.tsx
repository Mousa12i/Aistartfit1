import { useState, type ReactNode } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RECOVERY_CLAIMS, RECOVERY_REFERENCES } from '@/lib/recovery/doctor/evidence';

/** Source chips for recovery claims: each study links to its record, StartFit rules are labelled as such. */
export function RecoverySources({ claimIds, className, showText = false }: { claimIds: string[]; className?: string; showText?: boolean }) {
  const [open, setOpen] = useState(false);
  const ids = [...new Set(claimIds)].filter((id) => RECOVERY_CLAIMS[id]);
  const refs = [...new Set(ids.flatMap((id) => RECOVERY_CLAIMS[id].refs))].map((r) => RECOVERY_REFERENCES[r]).filter(Boolean);
  const design = ids.some((id) => RECOVERY_CLAIMS[id].kind === 'design');
  if (!refs.length && !design) return null;
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        {refs.map((r) => (
          <a key={r.id} href={r.url} target="_blank" rel="noreferrer" title={r.citation} className="rounded-md bg-black/25 px-2 py-0.5 text-[10px] text-cloud-dim transition-colors hover:text-[#8ad8f3]">
            {r.short}
          </a>
        ))}
        {design && <span className="rounded-md bg-black/25 px-2 py-0.5 text-[10px] text-gold">StartFit rule</span>}
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-0.5 text-[10px] text-cloud-dim hover:text-cloud" aria-expanded={open}>
          <Info className="h-3 w-3" /> {open ? 'Hide' : 'Why'}
        </button>
      </div>
      {(open || showText) && (
        <ul className="mt-2 space-y-1.5">
          {ids.map((id) => (
            <li key={id} className="rounded-lg bg-black/20 px-2.5 py-1.5 text-[11px] leading-relaxed text-cloud-dim">
              {RECOVERY_CLAIMS[id].text}
              {RECOVERY_CLAIMS[id].refs.length > 0 && <span className="text-cloud"> — {RECOVERY_CLAIMS[id].refs.map((r) => RECOVERY_REFERENCES[r]?.short).join('; ')}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Panel({ title, subtitle, right, children, className, testId }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section className={cn('rounded-2xl border border-[#243442] bg-[#0d1820] p-4', className)} data-testid={testId}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-black tracking-wide text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-cloud-dim">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-xl bg-[#172431] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-cloud-dim">{label}</p>
      <p className={cn('mt-0.5 text-base font-black', tone === 'good' ? 'text-[#5fe28c]' : tone === 'warn' ? 'text-[#ffd34f]' : tone === 'bad' ? 'text-[#ff5964]' : 'text-white')}>{value}</p>
      {sub && <p className="text-[10px] text-cloud-dim">{sub}</p>}
    </div>
  );
}

export function Collapsible({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[#243442]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-bold text-cloud" aria-expanded={open}>
        {title}
        <ChevronDown className={cn('h-4 w-4 text-cloud-dim transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-[#243442] px-3 py-3">{children}</div>}
    </div>
  );
}
