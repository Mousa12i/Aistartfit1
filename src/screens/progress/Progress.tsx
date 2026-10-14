import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchUserSessions } from '@/lib/data';
import type { WorkoutSession } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { CircularProgress, ProgressBar } from '@/components/ui/Progress';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Flame, Clock, Dumbbell, TrendingUp, Target, Sparkles, ArrowUp, ArrowDown, X, Check } from 'lucide-react';
import { formatDuration, GOAL_LABELS, startOfWeek, WEEK_DAYS, calculateStreak } from '@/lib/utils';
import { useAdaptiveEngine } from '@/lib/hooks/useAdaptiveEngine';
import { TrainingVolumeAnalytics } from '@/components/TrainingVolumeAnalytics';

interface ProgressProps {
  onBack: () => void;
  onNavigate: (screen: { name: string; [key: string]: string | null }) => void;
}

export function Progress({ onBack, onNavigate }: ProgressProps) {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'week' | 'month' | 'all'>('week');
  const adaptive = useAdaptiveEngine();

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchUserSessions();
        setSessions(s.filter((x) => x.completed_at));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load progress');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const now = new Date();
  const weekStart = startOfWeek();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const rangeSessions = sessions.filter((s) => {
    if (range === 'week') return new Date(s.completed_at!) >= weekStart;
    if (range === 'month') return new Date(s.completed_at!) >= monthStart;
    return true;
  });

  const totalSets = rangeSessions.reduce((sum, s) => sum + s.total_sets, 0);
  const totalDuration = rangeSessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const streak = calculateStreak(sessions);

  const weeklyGoal = profile?.preferred_days?.length ?? 3;
  const completedThisWeek = sessions.filter((s) => new Date(s.completed_at!) >= weekStart).length;

  // Weekly chart data
  const weekActivity = WEEK_DAYS.map((day, i) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(dayDate.getDate() + i);
    const nextDay = new Date(dayDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const daySessions = sessions.filter((s) => {
      const d = new Date(s.completed_at!);
      return d >= dayDate && d < nextDay;
    });
    return {
      day,
      count: daySessions.length,
      duration: daySessions.reduce((sum, s) => sum + s.duration_seconds, 0),
      isToday: dayDate.toDateString() === now.toDateString(),
    };
  });

  const maxCount = Math.max(...weekActivity.map((d) => d.count), 1);

  if (loading) return <div className="px-5 pt-12"><LoadingState /></div>;

  return (
    <div className="pb-6 animate-fade-in">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-display-sm text-cloud font-semibold">Progress</h1>
      </div>

      {/* Range Selector */}
      <div className="px-5 mb-4">
        <div className="flex bg-ink-elevated rounded-xl p-1">
          {(['week', 'month', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all capitalize ${range === r ? 'bg-lime text-ink-bg' : 'text-cloud-dim'}`}
            >
              {r === 'all' ? 'All Time' : r === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={onBack} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="w-7 h-7" />}
          title="No progress data yet"
          description="Complete workouts to track your progress over time."
          action={<Button size="sm" onClick={() => onNavigate({ name: 'training' })}>Start Training</Button>}
        />
      ) : (
        <>
          {/* Overview Stats */}
          <div className="px-5 mb-6">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <StatCard icon={<Flame className="w-5 h-5" />} value={streak.toString()} label="Day Streak" />
              <StatCard icon={<Dumbbell className="w-5 h-5" />} value={rangeSessions.length.toString()} label="Workouts" />
              <StatCard icon={<Clock className="w-5 h-5" />} value={formatDuration(totalDuration)} label="Total Time" />
              <StatCard icon={<TrendingUp className="w-5 h-5" />} value={totalSets.toString()} label="Total Sets" />
            </div>
          </div>

          {/* Weekly Goal */}
          <div className="px-5 mb-6">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-cloud mb-1">Weekly Goal</p>
                  <p className="text-xs text-cloud-dim">{completedThisWeek} of {weeklyGoal} sessions</p>
                </div>
                <CircularProgress value={completedThisWeek} max={weeklyGoal} size={64} strokeWidth={6} label={`${completedThisWeek}`} />
              </div>
              <ProgressBar value={completedThisWeek} max={weeklyGoal} showLabel />
            </Card>
          </div>

          {/* Weekly Chart */}
          <div className="px-5 mb-6">
            <h3 className="text-sm font-semibold text-cloud mb-3">Weekly Activity</h3>
            <Card className="p-5">
              <div className="flex justify-between items-end gap-2 h-32 mb-3">
                {weekActivity.map((d) => (
                  <div key={d.day} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                    <span className="text-[10px] text-cloud-dim tabular-nums">{d.count > 0 ? d.count : ''}</span>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${d.count > 0 ? 'bg-lime-gradient' : 'bg-ink-elevated'} ${d.isToday ? 'ring-2 ring-lime/30' : ''}`}
                      style={{ height: `${d.count > 0 ? Math.max(15, (d.count / maxCount) * 100) : 4}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between gap-2">
                {weekActivity.map((d) => (
                  <span key={d.day} className={`text-[10px] flex-1 text-center ${d.isToday ? 'text-lime font-medium' : 'text-cloud-dim'}`}>
                    {d.day}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          {/* Adaptive Engine Recommendations */}
          {adaptive.recommendations.length > 0 && (
            <div className="px-5 mb-6">
              <h3 className="text-sm font-semibold text-cloud mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-lime" />
                Smart Recommendations
              </h3>
              <div className="space-y-2">
                {adaptive.recommendations.slice(0, 3).map((rec) => (
                  <Card key={rec.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        rec.type === 'increase_weight' ? 'bg-lime/10 text-lime' :
                        rec.type === 'reduce_weight' ? 'bg-rust/10 text-rust' :
                        'bg-gold/10 text-gold'
                      }`}>
                        {rec.type === 'increase_weight' ? <ArrowUp className="w-4 h-4" /> :
                         rec.type === 'reduce_weight' ? <ArrowDown className="w-4 h-4" /> :
                         <TrendingUp className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-cloud">{rec.exerciseName}</p>
                        <p className="text-[11px] text-cloud-dim mt-0.5">
                          {rec.type === 'increase_weight' ? `Increase from ${rec.from} to ${rec.to}${rec.unit}` :
                           rec.type === 'reduce_weight' ? `Reduce from ${rec.from} to ${rec.to}${rec.unit}` :
                           'Keep going'}
                        </p>
                        <p className="text-[10px] text-cloud-muted mt-1">{rec.reason}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => adaptive.applyRecommendation(rec.id)}
                          className="w-7 h-7 rounded-lg bg-lime/10 flex items-center justify-center text-lime hover:bg-lime/20 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => adaptive.dismissRecommendation(rec.id)}
                          className="w-7 h-7 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-rust transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Training Volume Analytics (Pro gated) */}
          <div className="px-5 mb-6">
            <TrainingVolumeAnalytics />
          </div>

          {/* Goal */}
          {profile?.fitness_goal && (
            <div className="px-5 mb-6">
              <Card className="p-5 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-lime/10 flex items-center justify-center">
                  <Target className="w-6 h-6 text-lime" />
                </div>
                <div>
                  <p className="text-xs text-cloud-dim">Your Goal</p>
                  <p className="text-sm font-semibold text-cloud">{GOAL_LABELS[profile.fitness_goal]}</p>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center text-lime flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-cloud truncate">{value}</p>
        <p className="text-[10px] text-cloud-dim">{label}</p>
      </div>
    </Card>
  );
}
