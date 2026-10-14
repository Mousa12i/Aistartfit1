import { useState } from 'react';

// Small single-series charts for the Recovery Doctor. One hue per chart, recessive axis, value on hover/tap,
// and the title names the series (no legend needed for one series).

export interface BarDatum {
  label: string;
  value: number | null;
  /** Shown in the tooltip. */
  detail?: string;
  /** Draw as a muted bar (e.g. incomplete data). */
  muted?: boolean;
}

export function BarChart({ data, color = '#76d8ed', height = 96, refLine, refLabel, unit = '' }: { data: BarDatum[]; color?: string; height?: number; refLine?: number | null; refLabel?: string; unit?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value ?? 0), refLine ?? 0);
  const w = 100 / Math.max(1, data.length);
  const shown = active != null ? data[active] : null;
  return (
    <div className="w-full">
      <div className="mb-1 h-4 text-[10px] text-cloud-dim" aria-live="polite">
        {shown ? <span className="text-cloud">{shown.label}: <b>{shown.value == null ? 'no data' : `${shown.value}${unit}`}</b>{shown.detail ? ` · ${shown.detail}` : ''}</span> : 'Tap a bar for details'}
      </div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img">
        <line x1="0" x2="100" y1={height - 0.5} y2={height - 0.5} stroke="#304454" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {refLine != null && refLine > 0 && (
          <line x1="0" x2="100" y1={height - (refLine / max) * (height - 4)} y2={height - (refLine / max) * (height - 4)} stroke="#8aa0b5" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke">
            <title>{refLabel ?? `Reference ${refLine}${unit}`}</title>
          </line>
        )}
        {data.map((d, i) => {
          const h = d.value == null ? 0 : Math.max(1.5, (d.value / max) * (height - 4));
          const bw = Math.max(1, w * 0.62);
          return (
            <g key={i} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onClick={() => setActive(i)} style={{ cursor: 'pointer' }}>
              <rect x={i * w} y={0} width={w} height={height} fill="transparent" />
              {d.value != null && <rect x={i * w + (w - bw) / 2} y={height - h} width={bw} height={h} rx={1.2} fill={color} opacity={d.muted ? 0.35 : active == null || active === i ? 1 : 0.55} />}
              <title>{`${d.label}: ${d.value == null ? 'no data' : `${d.value}${unit}`}${d.detail ? ` · ${d.detail}` : ''}`}</title>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-cloud-dim">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      {refLabel && refLine != null && <p className="mt-0.5 text-[9px] text-cloud-dim">- - - {refLabel}</p>}
    </div>
  );
}

export function LineChart({ points, color = '#5fe28c', height = 80, min, max, refLine, refLabel, unit = '' }: { points: { label: string; value: number | null }[]; color?: string; height?: number; min?: number; max?: number; refLine?: number | null; refLabel?: string; unit?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  const lo = min ?? Math.min(...vals, refLine ?? Infinity);
  const hi = max ?? Math.max(...vals, refLine ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => (points.length <= 1 ? 50 : (i / (points.length - 1)) * 100);
  const y = (v: number) => height - 4 - ((v - lo) / span) * (height - 8);
  const segments: string[] = [];
  let current = '';
  points.forEach((p, i) => {
    if (p.value == null) {
      if (current) segments.push(current);
      current = '';
    } else current += `${current ? 'L' : 'M'}${x(i)},${y(p.value)}`;
  });
  if (current) segments.push(current);
  const shown = active != null ? points[active] : null;
  if (!vals.length) return <p className="text-[11px] text-cloud-dim">No data yet.</p>;
  return (
    <div className="w-full">
      <div className="mb-1 h-4 text-[10px] text-cloud-dim" aria-live="polite">
        {shown ? <span className="text-cloud">{shown.label}: <b>{shown.value == null ? 'no data' : `${shown.value}${unit}`}</b></span> : 'Tap the chart for details'}
      </div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img">
        {refLine != null && <line x1="0" x2="100" y1={y(refLine)} y2={y(refLine)} stroke="#8aa0b5" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        {segments.map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
        {active != null && points[active].value != null && <line x1={x(active)} x2={x(active)} y1={0} y2={height} stroke="#8aa0b5" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        {points.map((p, i) => (
          <rect
            key={i}
            x={x(i) - 50 / Math.max(1, points.length)}
            y={0}
            width={100 / Math.max(1, points.length)}
            height={height}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive(i)}
          >
            <title>{`${p.label}: ${p.value == null ? 'no data' : `${p.value}${unit}`}`}</title>
          </rect>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-cloud-dim">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
      {refLabel && refLine != null && <p className="mt-0.5 text-[9px] text-cloud-dim">- - - {refLabel}</p>}
    </div>
  );
}

export function shortDate(key: string): string {
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
