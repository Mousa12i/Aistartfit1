import { useEffect, useState } from 'react';
import { fetchUserSessions } from '@/lib/data';
import type { WorkoutSession } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Dumbbell, Clock, Calendar, ChevronRight } from 'lucide-react';
import { formatDuration, formatRelativeDate } from '@/lib/utils';

interface WorkoutHistoryProps {
  onBack: () => void;
  onNavigate: (screen: { name: string; [key: string]: string | null }) => void;
}

export function WorkoutHistory({ onBack, onNavigate }: WorkoutHistoryProps) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchUserSessions();
        setSessions(s.filter((x) => x.completed_at));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="pb-6 animate-fade-in">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-display-sm text-cloud font-semibold">Workout History</h1>
      </div>

      {loading ? (
        <div className="px-5"><LoadingState /></div>
      ) : error ? (
        <ErrorState message={error} onRetry={onBack} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-7 h-7" />}
          title="No workout history yet"
          description="Complete your first workout to start building your training history."
          action={<Button size="sm" onClick={() => onNavigate({ name: 'training' })}>Browse Workouts</Button>}
        />
      ) : (
        <div className="px-5 flex flex-col gap-2.5">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="p-4"
              onClick={() => onNavigate({ name: 'workout-completion', sessionId: session.id })}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-lime/10 flex items-center justify-center flex-shrink-0">
                  <Dumbbell className="w-5 h-5 text-lime" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cloud truncate">{session.plan_name ?? 'Workout Session'}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-cloud-dim flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatRelativeDate(session.completed_at!)}
                    </span>
                    <span className="text-xs text-cloud-dim flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(session.duration_seconds)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-cloud">{session.total_sets}</p>
                  <p className="text-[10px] text-cloud-dim">sets</p>
                </div>
                <ChevronRight className="w-4 h-4 text-cloud-dim" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
