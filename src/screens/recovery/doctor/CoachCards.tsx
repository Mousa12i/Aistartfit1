import { useEffect, useMemo, useState } from 'react';
import { Coffee, Moon, Stethoscope, Utensils } from 'lucide-react';
import type { MuscleRecoveryState } from '@/lib/recovery/engine';
import type { RecoveryMuscle } from '@/lib/recovery/muscles';
import { buildCoachNote, buildTonightPlan } from '@/lib/recovery/doctor/coach-note';
import { fetchEntries } from '@/lib/nutrition/api';
import { todayKey } from '@/lib/nutrition/dates';
import { RecoverySources } from './ui';

/** Plain-language summary at the top of Today, from the person's own data. */
export function CoachNoteCard({
  muscles,
  sleepLastNight,
  nextWorkout,
  onAsk,
}: {
  muscles: MuscleRecoveryState[];
  sleepLastNight: number | null;
  nextWorkout: { name: string; muscles: RecoveryMuscle[] } | null;
  onAsk: () => void;
}) {
  const note = useMemo(() => buildCoachNote({ muscles, sleepLastNight, nextWorkout }), [muscles, sleepLastNight, nextWorkout]);
  return (
    <section className="rounded-2xl border border-[#243442] bg-[#0d1820] p-4" data-testid="coach-note">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8ad8f3] text-[#071018]"><Stethoscope className="h-4 w-4" /></span>
        <div>
          <p className="text-[13px] font-black text-white">Coach's note</p>
          <p className="text-[10px] text-cloud-dim">From your logged training, sleep and plan</p>
        </div>
      </div>
      <div className="space-y-1">
        {note.lines.map((l, i) => (
          <p key={i} className="text-[13px] leading-relaxed text-cloud">{l}</p>
        ))}
      </div>
      {note.focus && <p className="mt-2 rounded-lg bg-black/25 px-3 py-2 text-[13px] font-semibold leading-relaxed text-white">{note.focus}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <RecoverySources claimIds={['recovery_estimate', ...(sleepLastNight != null && sleepLastNight < 6 ? ['sleep_strength'] : [])]} />
        <button type="button" onClick={onAsk} className="flex-shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-bold text-cloud">Ask the coach</button>
      </div>
    </section>
  );
}

const BEDTIME_KEY = 'startfit.bedtime';

function readBedtime(): string {
  try {
    const v = localStorage.getItem(BEDTIME_KEY);
    return v && /^\d{2}:\d{2}$/.test(v) ? v : '23:00';
  } catch {
    return '23:00';
  }
}

/** Tonight's plan: sleep, caffeine cutoff and protein before bed. */
export function TonightCard({ sleepLastNight, trainedToday }: { sleepLastNight: number | null; trainedToday: boolean }) {
  const [bedtime, setBedtime] = useState(readBedtime);
  const [protein, setProtein] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const today = todayKey();
    fetchEntries(today, today)
      .then((entries) => {
        if (!cancelled) setProtein(entries.reduce((sum, e) => sum + (e.protein || 0), 0));
      })
      .catch(() => { /* the diary is optional here */ });
    return () => { cancelled = true; };
  }, []);

  const changeBedtime = (v: string) => {
    if (!/^\d{2}:\d{2}$/.test(v)) return;
    setBedtime(v);
    try { localStorage.setItem(BEDTIME_KEY, v); } catch { /* not saved in this browser */ }
  };

  const plan = buildTonightPlan({ sleepLastNight, bedtime, trainedToday, proteinToday: protein });
  const claimIds = ['tonight_rule', 'sleep_7h', 'sleep_extension_naps', 'caffeine_6h', ...(trainedToday ? ['post_exercise_protein', 'presleep_protein'] : ['protein_per_meal'])];

  return (
    <section className="rounded-2xl border border-[#243442] bg-[#0d1820] p-4" data-testid="tonight-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[15px] font-black text-white">TONIGHT'S PLAN</p>
          <p className="text-[11px] text-cloud-dim">Three things that help tomorrow's recovery</p>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-cloud-dim">
          Bedtime
          <input type="time" value={bedtime} onChange={(e) => changeBedtime(e.target.value)} className="rounded-md border border-white/15 bg-black/30 px-1.5 py-1 text-xs text-white" aria-label="Your usual bedtime" />
        </label>
      </div>
      <ul className="space-y-2">
        <li className="flex gap-2.5 text-[13px] leading-relaxed text-cloud"><Moon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#8ad8f3]" />{plan.sleep}</li>
        <li className="flex gap-2.5 text-[13px] leading-relaxed text-cloud"><Coffee className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#ffd34f]" />{plan.caffeineCutoff}</li>
        <li className="flex gap-2.5 text-[13px] leading-relaxed text-cloud"><Utensils className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#5fe28c]" />{plan.protein}</li>
      </ul>
      <RecoverySources claimIds={claimIds} className="mt-3" />
    </section>
  );
}
