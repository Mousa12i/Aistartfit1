import { useState } from 'react';
import { Sparkles, Dumbbell, Moon, AlertTriangle, Zap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { MuscleRecoveryState } from '@/lib/recovery/engine';
import type { RecoveryMuscle } from '@/lib/recovery/muscles';
import { MUSCLE_LABELS } from '@/lib/recovery/muscles';
import type { ReadinessResult } from '@/lib/recovery/readiness';
import type { DailyCheckin, PainLog } from '@/lib/recovery/store';

interface CoachProps {
  muscleStates: MuscleRecoveryState[];
  readiness: ReadinessResult;
  todayCheckin: DailyCheckin | null;
  painLogs: PainLog[];
  sleepHistory: { date: string; sleepHours: number }[];
  onStartFreshWorkout: (muscles: RecoveryMuscle[]) => void;
}

interface Recommendation {
  icon: typeof Sparkles;
  title: string;
  body: string;
  action?: string;
  reason: string;
}

export function Coach({ muscleStates, readiness, todayCheckin, painLogs, sleepHistory, onStartFreshWorkout }: CoachProps) {
  const [showFreshMuscles, setShowFreshMuscles] = useState(false);

  const recommendations = buildRecommendations(muscleStates, readiness, todayCheckin, painLogs, sleepHistory);

  // Fresh muscles: recovery >= 90%, no yellow/red pain in that area
  const yellowRedAreas = new Set(painLogs.filter(p => p.triage_level !== 'green').map(p => p.body_area.toLowerCase()));
  const freshMuscles = muscleStates.filter((m) => {
    if (m.status !== 'green') return false;
    const label = MUSCLE_LABELS[m.muscle].toLowerCase();
    return !Array.from(yellowRedAreas).some(area => label.includes(area) || area.includes(label));
  });

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-lime" />
        <h3 className="text-sm font-semibold text-cloud">Coach</h3>
      </div>

      {/* Recommendations */}
      <div className="space-y-2 mb-4">
        {recommendations.map((rec, i) => (
          <RecommendationRow key={i} rec={rec} />
        ))}
      </div>

      {/* Fresh Muscle Workout */}
      <div className="rounded-xl bg-lime/5 border border-lime/20 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-lime" />
            <p className="text-xs font-semibold text-cloud">Fresh Muscle Workout</p>
          </div>
          <button onClick={() => setShowFreshMuscles(!showFreshMuscles)} className="text-[10px] text-sky">
            {showFreshMuscles ? 'Hide' : 'Show'} ({freshMuscles.length})
          </button>
        </div>
        <p className="text-[11px] text-cloud-dim mb-2">
          Shows muscles without a current recovery flag and avoids areas with active pain flags.
        </p>
        {showFreshMuscles && (
          <div className="flex flex-wrap gap-1.5 mb-2 animate-slide-down">
            {freshMuscles.length === 0 ? (
              <p className="text-[11px] text-cloud-dim">No unflagged muscles are available from the recorded training history yet.</p>
            ) : (
              freshMuscles.map((m) => (
                <span key={m.muscle} className="px-2 py-1 rounded-md bg-lime/10 text-[10px] font-medium text-lime">
                  {MUSCLE_LABELS[m.muscle]}
                </span>
              ))
            )}
          </div>
        )}
        {freshMuscles.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => onStartFreshWorkout(freshMuscles.map(m => m.muscle))} className="w-full">
            <Zap className="w-3.5 h-3.5" /> Build Session from Fresh Muscles
          </Button>
        )}
      </div>
    </Card>
  );
}

function buildRecommendations(
  muscleStates: MuscleRecoveryState[],
  readiness: ReadinessResult,
  checkin: DailyCheckin | null,
  painLogs: PainLog[],
  sleepHistory: { date: string; sleepHours: number }[]
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Readiness-based recommendation
  if (readiness.status === 'usual_training_may_be_reasonable') {
    recs.push({
      icon: Dumbbell,
      title: 'Usual training may be reasonable',
      body: 'The recorded inputs do not currently raise a stronger caution flag.',
      reason: `Rule ${readiness.firedRuleId} from ${readiness.availableInputs.length} independent inputs.`,
    });
  } else if (readiness.status === 'caution') {
    recs.push({
      icon: AlertTriangle,
      title: 'Train with caution',
      body: 'Some recovery signals are below optimal. Consider lighter loads or isolation work today.',
      reason: `Rule ${readiness.firedRuleId} from recorded inputs.`
    });
  } else if (readiness.status === 'consider_reducing_intensity') {
    recs.push({
      icon: Moon,
      title: 'Consider reducing intensity',
      body: 'Sleep and stress crossed the strongest caution rule. Consider a lighter session today.',
      reason: `Rule ${readiness.firedRuleId} from recorded inputs.`,
    });
  } else {
    recs.push({
      icon: Sparkles,
      title: 'Log your recovery signals',
      body: 'Complete today\'s check-in to receive personalised training recommendations.',
      reason: 'Not enough data for a recommendation.',
    });
  }

  // Sleep-based recommendation
  const recentSleep = sleepHistory.slice(0, 2);
  if (recentSleep.length >= 2) {
    const avgSleep = recentSleep.reduce((sum, s) => sum + s.sleepHours, 0) / recentSleep.length;
    if (avgSleep < 6) {
      recs.push({
        icon: Moon,
        title: 'Lower intensity on heavy compounds',
        body: `Average sleep over the last 2 nights: ${avgSleep.toFixed(1)}h. Sleep restriction can reduce force in multi-joint lifts (Knowles et al. 2018). Consider reducing intensity on squats, deadlifts, and presses.`,
        reason: 'Consecutive nights of short sleep impair recovery and performance.',
      });
    }
  }

  // Pain-based recommendation
  const activePain = painLogs.filter(p => p.triage_level !== 'green' && new Date(p.recorded_at).getTime() > Date.now() - 72 * 3600000);
  if (activePain.length > 0) {
    const areas = [...new Set(activePain.map(p => p.body_area))].join(', ');
    recs.push({
      icon: AlertTriangle,
      title: `Avoid: ${areas}`,
      body: activePain.some(p => p.triage_level === 'red')
        ? 'Red-flag symptoms detected. Stop training and seek medical care before resuming.'
        : 'Monitor for 48-72h. Reduce load on these areas. Re-check before training them again.',
      reason: 'Active pain logs in the last 72 hours.',
    });
  }

  return recs;
}

function RecommendationRow({ rec }: { rec: Recommendation }) {
  const Icon = rec.icon;
  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-ink-elevated/40">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime/10 text-lime flex-shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-cloud">{rec.title}</p>
        <p className="text-[11px] text-cloud-dim leading-relaxed mt-0.5">{rec.body}</p>
        <p className="text-[9px] text-cloud-dim/50 mt-1 italic">{rec.reason}</p>
      </div>
    </div>
  );
}
