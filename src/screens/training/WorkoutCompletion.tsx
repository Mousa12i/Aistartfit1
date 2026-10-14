import { useEffect, useState } from 'react';
import { fetchSessionById, fetchSessionSetLogs, createRecoveryLog } from '@/lib/data';
import type { WorkoutSession, WorkoutSetLog } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Check, Clock, Dumbbell, TrendingUp, Home as HomeIcon, Trophy, Activity, Utensils, ChevronRight } from 'lucide-react';
import { formatDuration, formatDate } from '@/lib/utils';
import { SessionRpeCard } from '@/components/recovery/SessionRpeCard';

interface WorkoutCompletionProps {
  sessionId: string;
  onBack: () => void;
  onGoHome: () => void;
  /** Opens the Nutrition tab to log a post-workout meal. */
  onRefuel?: () => void;
}

export function WorkoutCompletion({ sessionId, onBack, onGoHome, onRefuel }: WorkoutCompletionProps) {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [setLogs, setSetLogs] = useState<WorkoutSetLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recoveryLogged, setRecoveryLogged] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, logs] = await Promise.all([
          fetchSessionById(sessionId),
          fetchSessionSetLogs(sessionId),
        ]);
        setSession(s);
        setSetLogs(logs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workout');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    if (!session || !setLogs.length || recoveryLogged) return;
    const exercisesMap = new Map<string, string>();
    setLogs.forEach((log) => {
      if (!exercisesMap.has(log.exercise_id)) {
        exercisesMap.set(log.exercise_id, log.exercise_name);
      }
    });
    (async () => {
      try {
        await createRecoveryLog({
          kind: 'recovery_session',
          value: session.total_sets,
          note: `Completed ${session.total_sets} sets, ${session.total_reps} reps across ${exercisesMap.size} exercises`,
          metadata: { sessionId, duration: session.duration_seconds, totalVolume },
        });
        setRecoveryLogged(true);
      } catch {
        // non-blocking — workout is still saved
      }
    })();
  }, [session, setLogs, recoveryLogged, sessionId]);

  if (loading) return <div className="px-5 pt-12"><LoadingState label="Loading results..." /></div>;
  if (error) return <ErrorState message={error} onRetry={onBack} />;
  if (!session) return <ErrorState message="Session not found" onRetry={onBack} />;

  const exercisesMap = new Map<string, { name: string; sets: WorkoutSetLog[] }>();
  setLogs.forEach((log) => {
    const existing = exercisesMap.get(log.exercise_id);
    if (existing) {
      existing.sets.push(log);
    } else {
      exercisesMap.set(log.exercise_id, { name: log.exercise_name, sets: [log] });
    }
  });

  const totalVolume = setLogs.reduce((sum, log) => sum + log.reps * (log.weight ?? 0), 0);

  return (
    <div className="min-h-screen bg-ink-bg flex flex-col pb-6 animate-fade-in">
      {/* Hero */}
      <div className="relative h-72 flex flex-col items-center justify-center px-5">
        <div className="absolute inset-0 bg-lime-glow" />
        <div className="relative flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-lime flex items-center justify-center mb-4 animate-bounce-soft">
            <Trophy className="w-10 h-10 text-ink-bg" />
          </div>
          <h1 className="text-display-lg text-cloud font-bold text-center mb-1">Workout Complete!</h1>
          <p className="text-sm text-cloud-dim text-center">
            {session.plan_name ?? 'Workout'} · {formatDate(session.completed_at ?? session.started_at)}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Clock className="w-5 h-5" />} value={formatDuration(session.duration_seconds)} label="Duration" />
          <StatCard icon={<Dumbbell className="w-5 h-5" />} value={session.total_sets.toString()} label="Total Sets" />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} value={session.total_reps.toString()} label="Total Reps" />
        </div>
        {recoveryLogged && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-lime/5 border border-lime/20">
            <Activity className="w-4 h-4 text-lime flex-shrink-0" />
            <p className="text-xs font-semibold text-lime">Workout saved &amp; Muscle recovery updated!</p>
          </div>
        )}
      </div>

      {/* Session RPE: feeds the Recovery Doctor's training load */}
      <div className="px-5 mb-6">
        <SessionRpeCard
          sessionId={session.id}
          minutes={Math.round(session.duration_seconds / 60)}
          initial={session.session_rpe ?? null}
        />
      </div>

      {/* Exercises Completed */}
      <div className="px-5 mb-6">
        <h3 className="text-sm font-semibold text-cloud mb-3">Exercises Completed</h3>
        <div className="flex flex-col gap-2.5">
          {Array.from(exercisesMap.entries()).map(([id, { name, sets }]) => (
            <Card key={id} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-lime/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-lime" strokeWidth={3} />
                </div>
                <p className="text-sm font-medium text-cloud">{name}</p>
              </div>
              <div className="flex flex-wrap gap-2 pl-10">
                {sets.map((set) => (
                  <div key={set.id} className="px-2.5 py-1.5 rounded-lg bg-ink-elevated text-xs">
                    <span className="text-cloud-dim">Set {set.set_number}:</span>{' '}
                    <span className="text-cloud font-medium">{set.reps} reps</span>
                    {set.weight && <span className="text-cloud-dim"> · {set.weight}kg</span>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {onRefuel && (
        <div className="px-5 mb-4">
          <button
            type="button"
            onClick={onRefuel}
            className="flex w-full items-center gap-3 rounded-xl2 border border-lime/25 bg-lime/10 p-4 text-left transition-colors hover:bg-lime/15"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime text-ink-bg">
              <Utensils className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-cloud">Refuel</span>
              <span className="block text-[11px] text-cloud-dim">Log a post-workout meal with protein and carbs</span>
            </span>
            <ChevronRight className="h-4 w-4 text-cloud-dim" />
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 mt-auto">
        <div className="flex gap-3">
          <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
            <Dumbbell className="w-4 h-4" />
            More Training
          </Button>
          <Button size="lg" onClick={onGoHome} className="flex-1">
            <HomeIcon className="w-4 h-4" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Card className="p-4 flex flex-col items-center text-center">
      <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center text-lime mb-2">
        {icon}
      </div>
      <p className="text-lg font-bold text-cloud">{value}</p>
      <p className="text-[10px] text-cloud-dim">{label}</p>
    </Card>
  );
}
