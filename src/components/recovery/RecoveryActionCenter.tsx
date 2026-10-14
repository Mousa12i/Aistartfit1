import { CheckCircle2, ClipboardCheck, Moon, ShieldAlert, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { FullRecoveryData } from '@/lib/recovery/store';

interface RecoveryActionCenterProps {
  data: FullRecoveryData;
  onCheckIn: () => void;
  onDoctor: () => void;
}

export function RecoveryActionCenter({ data, onCheckIn, onDoctor }: RecoveryActionCenterProps) {
  const missingCheckin = !data.todayCheckin;
  const attentionMuscle = data.muscleStates.find((muscle) => muscle.status === 'red');
  const activePain = data.painLogs.some((log) => log.triage_level !== 'green');
  const action = activePain
    ? { icon: ShieldAlert, title: 'Review your pain assessment', reason: 'A recent pain entry needs attention before you make a training decision.', label: 'Open Doctor', onClick: onDoctor }
    : missingCheckin
      ? { icon: ClipboardCheck, title: "Complete today's check-in", reason: 'Sleep, stress, hydration, and soreness are not recorded for today.', label: 'Log check-in', onClick: onCheckIn }
      : attentionMuscle
        ? { icon: Moon, title: 'Give one muscle more recovery time', reason: `${attentionMuscle.muscle} is flagged by the recorded recovery state.`, label: 'Review muscle', onClick: onDoctor }
        : { icon: CheckCircle2, title: 'Keep your current plan', reason: 'No stronger action is supported by the recovery data currently available.', label: 'Stay consistent', onClick: onCheckIn };
  const Icon = action.icon;

  return (
    <Card className="p-4 border-lime/20 bg-gradient-to-br from-lime/10 to-ink-surface">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-lime" />
        <p className="text-[10px] uppercase tracking-widest font-bold text-lime">Your Next Best Action</p>
      </div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-lime/15 text-lime"><Icon className="w-4 h-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-cloud">{action.title}</h2>
          <p className="text-[11px] text-cloud-dim leading-relaxed mt-1">{action.reason}</p>
          <p className="text-[10px] text-cloud-dim/60 mt-2">Suggestion only — nothing changes until you choose an action.</p>
        </div>
        <button onClick={action.onClick} className="shrink-0 rounded-lg bg-lime px-3 py-2 text-[10px] font-bold text-ink-bg hover:brightness-105 transition-all">{action.label}</button>
      </div>
    </Card>
  );
}
