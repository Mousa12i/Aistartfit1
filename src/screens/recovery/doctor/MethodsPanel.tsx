import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MODALITIES, VERDICT_LABELS, isLoggable, type Modality, type Verdict } from '@/lib/recovery/doctor/modalities';
import { logModality } from '@/lib/recovery/doctor/api';
import { RecoverySources } from './ui';

const VERDICT_STYLE: Record<Verdict, string> = {
  helps: 'bg-[#5fe28c]/15 text-[#5fe28c]',
  some: 'bg-[#8ad8f3]/15 text-[#8ad8f3]',
  careful: 'bg-[#ffd34f]/15 text-[#ffd34f]',
  no: 'bg-white/10 text-cloud-dim',
  slows: 'bg-[#ff9f43]/15 text-[#ff9f43]',
};

export function MethodsPanel({ onLogged }: { onLogged: () => void }) {
  const [logged, setLogged] = useState<Record<string, string>>({});
  const log = async (id: string) => {
    try {
      await logModality(id);
      setLogged((s) => ({ ...s, [id]: 'Logged for today' }));
      onLogged();
    } catch (e) {
      setLogged((s) => ({ ...s, [id]: e instanceof Error ? e.message : 'Could not log' }));
    }
  };
  const card = (m: Modality) => (
    <article key={m.id} className="rounded-2xl border border-[#243442] bg-[#0d1820] p-4" data-testid={`method-${m.id}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-black text-white">{m.name}</h3>
        <span className={cn('flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase', VERDICT_STYLE[m.verdict])}>{VERDICT_LABELS[m.verdict]}</span>
      </div>
      <p className="mt-1.5 text-xs text-cloud">{m.summary}</p>
      <p className="mt-1.5 text-[11px] text-cloud-dim"><b className="text-cloud">{m.verdict === 'slows' ? 'What to do:' : 'How to use:'}</b> {m.howToUse}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <RecoverySources claimIds={m.claimIds} />
        {isLoggable(m) &&
          (logged[m.id] ? (
            <span className="flex items-center gap-1 text-[10px] text-[#5fe28c]"><Check className="h-3 w-3" /> {logged[m.id]}</span>
          ) : (
            <button type="button" onClick={() => void log(m.id)} className="flex-shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-bold text-cloud">
              I did this today
            </button>
          ))}
      </div>
    </article>
  );
  return (
    <div className="space-y-3" data-testid="methods-panel">
      <p className="text-xs text-cloud-dim">What the research says about common recovery methods — including the ones that don't help. Log what you use: "What works for you" compares your next-morning soreness with and without it.</p>
      {MODALITIES.filter((m) => m.verdict !== 'slows').map(card)}
      <div className="pt-3" data-testid="methods-slows">
        <h2 className="text-[15px] font-black text-white">What can slow your recovery</h2>
        <p className="mt-1 text-xs text-cloud-dim">Common habits that studies linked with worse sleep, slower muscle building or smaller training gains. Open the sources on each card to see the study.</p>
      </div>
      {MODALITIES.filter((m) => m.verdict === 'slows').map(card)}
    </div>
  );
}
