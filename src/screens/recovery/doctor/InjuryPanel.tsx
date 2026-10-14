import { useState } from 'react';
import { OctagonAlert, Footprints } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DoctorState } from '@/lib/recovery/doctor/build';
import type { PainLog } from '@/lib/recovery/store';
import { RTT_STAGES, PAIN_OK } from '@/lib/recovery/doctor/rtt';
import { logRttMorning, logRttSession, startRtt, updateRtt } from '@/lib/recovery/doctor/api';
import { DoctorTriage } from '@/components/recovery/DoctorTriage';
import { Gate } from '@/components/recovery/Gate';
import { Panel, RecoverySources } from './ui';
import { shortDate } from './charts';

export function RedFlagsCard() {
  return (
    <section className="rounded-2xl border border-[#ff5964]/40 bg-[#ff5964]/10 p-4" data-testid="red-flags">
      <div className="flex items-center gap-2">
        <OctagonAlert className="h-5 w-5 text-[#ff5964]" />
        <h3 className="text-sm font-black text-white">Stop and get medical help if you have</h3>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-white">
        <li>• Dark (tea- or cola-coloured) urine with muscle pain, weakness or swelling after exercise</li>
        <li>• Chest pain, fainting, or breathlessness that is unusual for you</li>
        <li>• Numbness, tingling, a joint giving way, or sudden sharp pain during a lift</li>
        <li>• Swelling or pain out of proportion to what you did</li>
      </ul>
      <RecoverySources claimIds={['triage_rule', 'rhabdo_signs', 'rhabdo_risk']} className="mt-3" />
    </section>
  );
}

function PainPicker({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold text-cloud">{label}</p>
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            aria-label={`${label}: ${i} of 10`}
            className={cn('h-8 rounded-md text-[11px] font-bold', value === i ? 'bg-white text-[#071018]' : i <= PAIN_OK ? 'bg-[#5fe28c]/10 text-[#5fe28c]' : i <= 5 ? 'bg-[#ffd34f]/10 text-[#ffd34f]' : 'bg-[#ff5964]/10 text-[#ff5964]')}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReturnToTraining({ state, painLogs, onChanged }: { state: DoctorState; painLogs: PainLog[]; onChanged: () => void }) {
  const active = state.rtt.find((p) => p.status === 'active') ?? null;
  const [area, setArea] = useState('');
  const [pain, setPain] = useState<number | null>(null);
  const [morningPain, setMorningPain] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setPain(null);
      setMorningPain(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };
  const recentAreas = [...new Set(painLogs.filter((p) => p.triage_level !== 'red').map((p) => p.body_area))].slice(0, 4);
  const awaitingMorning = active?.entries.filter((e) => e.morningWorse == null && e.date < state.today).slice(-1)[0] ?? null;
  const ev = active?.evaluation;

  return (
    <Panel title="Return to training" subtitle="Step back in after pain, guided by how it responds during and the next morning" right={<Footprints className="h-5 w-5 text-[#8ad8f3]" />} testId="rtt">
      {!active ? (
        <div>
          <p className="text-xs text-cloud-dim">Start a 4-stage plan for one painful area. Not for red-flag symptoms — those need a clinician first.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {recentAreas.map((a) => (
              <button key={a} type="button" onClick={() => setArea(a)} className={cn('rounded-full px-3 py-1 text-[11px]', area === a ? 'bg-[#8ad8f3] text-[#071018]' : 'bg-[#172431] text-cloud')}>
                {a}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={60} placeholder="Area, e.g. left knee" className="min-w-0 flex-1 rounded-lg bg-[#172431] px-3 py-2 text-xs text-white placeholder:text-cloud-dim/50" />
            <button type="button" disabled={busy || !area.trim()} onClick={() => void run(() => startRtt(area.trim(), painLogs.find((p) => p.body_area === area.trim())?.id ?? null))} className="rounded-lg bg-[#8ad8f3] px-3 py-2 text-xs font-black text-[#071018] disabled:opacity-40">
              Start
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-white">{active.area}</p>
            <p className="text-[11px] text-cloud-dim">since {shortDate(active.started_at.slice(0, 10))}</p>
          </div>
          <ol className="mt-3 grid grid-cols-4 gap-1.5">
            {RTT_STAGES.map((s) => (
              <li key={s.stage} className={cn('rounded-lg px-2 py-1.5 text-center text-[10px] font-bold', s.stage === active.stage ? 'bg-[#8ad8f3] text-[#071018]' : s.stage < active.stage ? 'bg-[#5fe28c]/20 text-[#5fe28c]' : 'bg-[#172431] text-cloud-dim')}>
                {s.stage}. {s.title}
              </li>
            ))}
          </ol>
          <p className="mt-2 rounded-lg bg-black/20 px-3 py-2 text-xs text-cloud">{RTT_STAGES[active.stage - 1].what}</p>
          {ev && (
            <div className={cn('mt-3 rounded-xl border p-3', ev.advice === 'see_clinician' ? 'border-[#ff5964]/40 bg-[#ff5964]/10' : ev.advice === 'back' ? 'border-[#ffd34f]/40 bg-[#ffd34f]/10' : 'border-[#243442] bg-[#172431]')} data-testid="rtt-advice">
              <p className="text-xs font-bold text-white">{ev.text}</p>
              {(ev.advice === 'advance' || ev.advice === 'back') && (
                <button type="button" disabled={busy} onClick={() => void run(() => updateRtt(active.id, { stage: ev.nextStage }))} className="mt-2 rounded-lg bg-white px-3 py-1.5 text-[11px] font-black text-[#071018]">
                  Go to stage {ev.nextStage}
                </button>
              )}
              {ev.advice === 'complete' && (
                <button type="button" disabled={busy} onClick={() => void run(() => updateRtt(active.id, { status: 'completed' }))} className="mt-2 rounded-lg bg-[#5fe28c] px-3 py-1.5 text-[11px] font-black text-[#071018]">
                  Finish programme
                </button>
              )}
            </div>
          )}
          {awaitingMorning && (
            <div className="mt-3 space-y-2 rounded-xl border border-[#8ad8f3]/30 p-3">
              <p className="text-xs font-bold text-white">Morning after {shortDate(awaitingMorning.date)}</p>
              <PainPicker value={morningPain} onChange={setMorningPain} label="Pain or stiffness now (0–10)" />
              <div className="flex gap-2">
                <button type="button" disabled={busy || morningPain == null} onClick={() => void run(() => logRttMorning(active.id, awaitingMorning.date, morningPain!, false))} className="flex-1 rounded-lg bg-[#5fe28c]/20 py-2 text-[11px] font-bold text-[#5fe28c] disabled:opacity-40">
                  Not worse than usual
                </button>
                <button type="button" disabled={busy || morningPain == null} onClick={() => void run(() => logRttMorning(active.id, awaitingMorning.date, morningPain!, true))} className="flex-1 rounded-lg bg-[#ff5964]/20 py-2 text-[11px] font-bold text-[#ff5964] disabled:opacity-40">
                  Worse than usual
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 space-y-2">
            <PainPicker value={pain} onChange={setPain} label="Today's session: highest pain during it (0–10)" />
            <button type="button" disabled={busy || pain == null} onClick={() => void run(() => logRttSession(active.id, active.stage, pain!, null))} className="w-full rounded-lg bg-[#8ad8f3] py-2 text-xs font-black text-[#071018] disabled:opacity-40">
              Log today's session at stage {active.stage}
            </button>
          </div>
          <button type="button" disabled={busy} onClick={() => void run(() => updateRtt(active.id, { status: 'stopped' }))} className="mt-3 text-[11px] text-cloud-dim underline">
            Stop this programme
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-[#ff5964]">{error}</p>}
      <RecoverySources claimIds={['pain_monitoring', 'rtt_rule']} className="mt-3" />
    </Panel>
  );
}

export function InjuryPanel({ state, painLogs, onChanged }: { state: DoctorState; painLogs: PainLog[]; onChanged: () => void }) {
  return (
    <div className="space-y-4" data-testid="injury-panel">
      <RedFlagsCard />
      <Panel title="Pain triage" subtitle="A structured check that tells you whether to train around it or get it seen. Not a diagnosis.">
        <DoctorTriage painLogs={painLogs} onSaved={onChanged} />
        <RecoverySources claimIds={['triage_rule']} className="mt-3" />
      </Panel>
      <Gate feature="recoveryReturnToTraining" label="Return-to-training programme">
        <ReturnToTraining state={state} painLogs={painLogs} onChanged={onChanged} />
      </Gate>
    </div>
  );
}
