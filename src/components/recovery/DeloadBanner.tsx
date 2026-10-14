import { useEffect, useState } from 'react';
import { CirclePause } from 'lucide-react';
import { fetchActiveDeload } from '@/lib/recovery/doctor/api';
import type { RecoveryAdjustment } from '@/lib/recovery/doctor/build';

/** Shown during workouts while a lighter week accepted in the Recovery Doctor is active. */
export function DeloadBanner() {
  const [deload, setDeload] = useState<RecoveryAdjustment | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchActiveDeload()
      .then((d) => !cancelled && setDeload(d))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  if (!deload) return null;
  return (
    <div className="mx-5 mb-3 flex items-start gap-2 rounded-xl border border-sky/30 bg-sky/10 p-3" data-testid="deload-banner">
      <CirclePause className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky" />
      <p className="text-[11px] leading-relaxed text-cloud">
        <b>Lighter week</b> (until {new Date(`${deload.ends_on}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}): do about half your usual sets, keep the same exercises, and stop 3–4 reps short of failure.
      </p>
    </div>
  );
}
