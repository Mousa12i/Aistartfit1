import { useState } from 'react';
import { Check, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setSessionRpe } from '@/lib/recovery/doctor/api';

// Category-ratio 0–10 scale used for session RPE (claim: srpe_valid).
export const RPE_LABELS: Record<number, string> = {
  0: 'Rest',
  1: 'Very, very easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Somewhat hard',
  5: 'Hard',
  6: 'Between hard and very hard',
  7: 'Very hard',
  8: 'Between very hard and maximal',
  9: 'Between very hard and maximal',
  10: 'Maximal',
};

interface Props {
  sessionId: string;
  minutes: number;
  initial?: number | null;
  title?: string;
  compact?: boolean;
  onSaved?: (rpe: number) => void;
}

/** "How hard was the whole session?" — saves session RPE; load = RPE × minutes. */
export function SessionRpeCard({ sessionId, minutes, initial = null, title = 'How hard was this whole session?', compact = false, onSaved }: Props) {
  const [value, setValue] = useState<number | null>(initial);
  const [saved, setSaved] = useState(initial != null);
  const [error, setError] = useState<string | null>(null);

  const save = async (v: number) => {
    setValue(v);
    setError(null);
    try {
      await setSessionRpe(sessionId, v);
      setSaved(true);
      onSaved?.(v);
    } catch (e) {
      setSaved(false);
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  };

  return (
    <div className={cn('rounded-xl border border-sky/25 bg-sky/5', compact ? 'p-3' : 'p-4')} data-testid="session-rpe">
      <div className="mb-2 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-sky" />
        <p className="text-sm font-semibold text-cloud">{title}</p>
      </div>
      {!compact && <p className="mb-3 text-[11px] text-cloud-dim">0 = rest, 10 = maximal. Think of the whole workout, not the last set. It turns your session into a training-load number for the Recovery Doctor.</p>}
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`RPE ${i}: ${RPE_LABELS[i]}`}
            onClick={() => void save(i)}
            className={cn(
              'h-9 rounded-md text-xs font-bold transition-colors',
              value === i ? 'bg-sky text-ink-bg' : i >= 8 ? 'bg-rust/10 text-rust' : i >= 5 ? 'bg-gold/10 text-gold' : 'bg-ink-elevated text-cloud',
            )}
          >
            {i}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-cloud-dim">
        {value == null ? 'Tap a number.' : <>{RPE_LABELS[value]}{minutes > 0 && <> · session load <b className="text-cloud">{value * minutes}</b> ({value} × {minutes} min)</>}{saved && <Check className="ml-1 inline h-3 w-3 text-lime" />}</>}
      </p>
      {error && <p className="mt-1 text-[11px] text-rust">{error}</p>}
    </div>
  );
}
