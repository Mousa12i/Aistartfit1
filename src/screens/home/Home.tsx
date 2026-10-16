import { useEffect, useState } from 'react';
import { GoalEntryCard } from '@/screens/nutrition/GoalPage';
import { CoachEntryCard } from '@/screens/coach/RolePicker';
import { useAuth } from '@/lib/auth';
import { fetchUserSessions, fetchWorkoutPlans } from '@/lib/data';
import type { WorkoutSession, WorkoutPlan } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CircularProgress, ProgressBar } from '@/components/ui/Progress';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { ErrorState } from '@/components/ui/States';
import { TodayDecisionCard } from '@/components/recovery/TodayDecisionCard';
import {
  Flame, Dumbbell, Clock, TrendingUp, ChevronRight,
  Play, Zap, Target, Calendar, Activity, ArrowRight, Sparkles,
  Apple, Heart
} from 'lucide-react';
import {
  getGreeting, calculateStreak, formatDuration, formatRelativeDate,
  GOAL_LABELS, startOfWeek, WEEK_DAYS
} from '@/lib/utils';

interface HomeProps {
  onNavigate: (screen: { name: string; [key: string]: string | null }) => void;
  onTabChange: (tab: 'routines' | 'exercises' | 'workout' | 'recover' | 'account') => void;
}

export function Home({ onNavigate, onTabChange }: HomeProps) {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([
          fetchUserSessions(20),
          fetchWorkoutPlans(),
        ]);
        setSessions(s.filter((x) => x.completed_at));
        setPlans(p.slice(0, 4));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const streak = calculateStreak(sessions);
  const greeting = getGreeting();
  const firstName = profile?.display_name?.split(' ')[0] ?? 'Athlete';

  const completedThisWeek = sessions.filter((s) => {
    const d = new Date(s.completed_at!);
    return d >= startOfWeek();
  }).length;

  const weeklyGoal = profile?.preferred_days?.length ?? 3;
  const totalSets = sessions.reduce((sum, s) => sum + s.total_sets, 0);
  const totalDuration = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);

  const weekActivity = WEEK_DAYS.map((day, i) => {
    const dayDate = new Date(startOfWeek());
    dayDate.setDate(dayDate.getDate() + i);
    const nextDay = new Date(dayDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const count = sessions.filter((s) => {
      const d = new Date(s.completed_at!);
      return d >= dayDate && d < nextDay;
    }).length;
    return { day, count, isToday: dayDate.toDateString() === new Date().toDateString() };
  });

  const recommendedPlan = plans[0];

  if (loading) {
    return (
      <div className="px-5 pt-12">
        <LoadingState label="Loading your dashboard..." />
      </div>
    );
  }

  return (
    <div className="pb-6 animate-fade-in">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-cloud-dim mb-0.5">{greeting},</p>
          <h1 className="text-display-md text-cloud font-bold">{firstName}</h1>
        </div>
        <button onClick={() => onNavigate({ name: 'profile' })}>
          <Avatar name={profile?.display_name ?? null} url={profile?.avatar_url ?? null} size="md" />
        </button>
      </div>

      {/* Hero */}
      <div className="px-5 mb-6">
        <div className="relative rounded-3xl overflow-hidden h-64">
          <img src="/hero-home.webp" alt="Fitness training" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-bg via-ink-bg/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-lime" fill="currentColor" />
              <span className="text-xs text-lime font-medium uppercase tracking-wider">Ready to train</span>
            </div>
            <h2 className="text-display-lg text-cloud leading-tight mb-1">
              {sessions.length === 0 ? 'Start your journey' : streak > 0 ? `${streak} day streak!` : "Let's get moving"}
            </h2>
            <p className="text-sm text-cloud/70 mb-4 max-w-[80%]">
              {sessions.length === 0
                ? 'Your first workout is just a tap away.'
                : streak > 0
                ? 'Keep the momentum going. Train today!'
                : 'Time to get back on track.'}
            </p>
            <Button
              size="md"
              onClick={() => onNavigate({ name: 'training' })}
              className="w-fit"
            >
              <Play className="w-4 h-4" fill="currentColor" />
              {sessions.length === 0 ? 'Start Workout' : 'Train Now'}
            </Button>
          </div>
        </div>
      </div>

      {/* One goal (cut, bulk, lose weight) -> calories, training and a timeline */}
      <div className="px-5 mb-3">
        <CoachEntryCard />
      </div>
      <div className="px-5 mb-4">
        <GoalEntryCard onOpen={() => onNavigate({ name: 'goal-plan' })} />
      </div>

      {/* Today's recovery decision */}
      <div className="px-5 mb-6">
        <TodayDecisionCard bodyWeightKg={profile?.weight_kg ?? null} onOpen={() => onNavigate({ name: 'recovery' })} />
      </div>

      {/* Stats Row */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Flame className="w-4 h-4" />} value={streak.toString()} label="Day streak" />
          <StatCard icon={<Dumbbell className="w-4 h-4" />} value={sessions.length.toString()} label="Workouts" />
          <StatCard icon={<Clock className="w-4 h-4" />} value={formatDuration(totalDuration)} label="Total time" />
        </div>
      </div>

      {/* Weekly Activity */}
      <div className="px-5 mb-6">
        <SectionHeader title="This Week" action={() => onNavigate({ name: 'progress' })} actionLabel="Details" />
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-3xl font-bold text-cloud">{completedThisWeek}</p>
              <p className="text-xs text-cloud-dim">of {weeklyGoal} sessions goal</p>
            </div>
            <CircularProgress value={completedThisWeek} max={weeklyGoal} size={72} strokeWidth={6} label={`${completedThisWeek}`} />
          </div>
          <div className="flex justify-between gap-1">
            {weekActivity.map((d) => (
              <div key={d.day} className="flex flex-col items-center gap-1.5 flex-1">
                <div className="w-full h-20 flex items-end justify-center">
                  <div
                    className={`w-6 rounded-full transition-all ${d.count > 0 ? 'bg-lime' : 'bg-ink-elevated'} ${d.isToday ? 'ring-2 ring-lime/30' : ''}`}
                    style={{ height: `${d.count > 0 ? Math.max(20, d.count * 40) : 6}px` }}
                  />
                </div>
                <span className={`text-[10px] ${d.isToday ? 'text-lime font-medium' : 'text-cloud-dim'}`}>{d.day}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Today's Workout / Recommended */}
      {recommendedPlan && (
        <div className="px-5 mb-6">
          <SectionHeader title="Recommended for you" action={() => onNavigate({ name: 'training' })} actionLabel="See all" />
          <ProgrammeCard
            plan={recommendedPlan}
            onClick={() => onNavigate({ name: 'programme-detail', planId: recommendedPlan.id })}
          />
        </div>
      )}

      {/* Goal Progress */}
      {profile?.fitness_goal && (
        <div className="px-5 mb-6">
          <SectionHeader title="Goal Progress" />
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-lime" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cloud">{GOAL_LABELS[profile.fitness_goal]}</p>
                <p className="text-xs text-cloud-dim">{totalSets} total sets completed</p>
              </div>
            </div>
            <ProgressBar value={completedThisWeek} max={weeklyGoal} showLabel />
            <p className="text-xs text-cloud-dim mt-2">
              {completedThisWeek >= weeklyGoal
                ? 'Weekly goal achieved! Keep it up.'
                : `${weeklyGoal - completedThisWeek} more session${weeklyGoal - completedThisWeek !== 1 ? 's' : ''} to hit your weekly goal`}
            </p>
          </Card>
        </div>
      )}

      {/* Recent Activity */}
      <div className="px-5 mb-6">
        <SectionHeader title="Recent Activity" action={() => onNavigate({ name: 'workout-history' })} actionLabel="History" />
        {sessions.length === 0 ? (
          <Card className="p-5">
            <EmptyState
              icon={<Activity className="w-7 h-7" />}
              title="No workouts yet"
              description="Complete your first workout to see it here."
              action={<Button size="sm" onClick={() => onNavigate({ name: 'training' })}>Browse Workouts</Button>}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sessions.slice(0, 3).map((session) => (
              <Card key={session.id} className="p-4 flex items-center gap-3" onClick={() => onNavigate({ name: 'workout-completion', sessionId: session.id })}>
                <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center flex-shrink-0">
                  <Dumbbell className="w-5 h-5 text-lime" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cloud truncate">{session.plan_name ?? 'Workout'}</p>
                  <p className="text-xs text-cloud-dim">{formatRelativeDate(session.completed_at!)} · {formatDuration(session.duration_seconds)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-cloud-dim flex-shrink-0" />
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            icon={<Dumbbell className="w-5 h-5" />}
            label="Browse Training"
            onClick={() => onTabChange('routines')}
          />
          <QuickAction
            icon={<Sparkles className="w-5 h-5" />}
            label="Ask AI Coach"
            onClick={() => onTabChange('account')}
          />
          <QuickAction
            icon={<Apple className="w-5 h-5" />}
            label="Nutrition"
            onClick={() => onNavigate({ name: 'nutrition' })}
          />
          <QuickAction
            icon={<Heart className="w-5 h-5" />}
            label="Recovery"
            onClick={() => onNavigate({ name: 'recovery' })}
          />
        </div>
      </div>

      {error && (
        <div className="px-5">
          <ErrorState message={error} />
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Card className="p-3.5 flex flex-col items-center text-center">
      <div className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-lime mb-2">
        {icon}
      </div>
      <p className="text-lg font-bold text-cloud leading-tight">{value}</p>
      <p className="text-[10px] text-cloud-dim leading-tight mt-0.5">{label}</p>
    </Card>
  );
}

function SectionHeader({ title, action, actionLabel }: { title: string; action?: () => void; actionLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-display-sm text-cloud font-semibold">{title}</h3>
      {action && actionLabel && (
        <button onClick={action} className="text-xs text-cloud-dim hover:text-lime transition-colors flex items-center gap-0.5">
          {actionLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function ProgrammeCard({ plan, onClick }: { plan: WorkoutPlan; onClick: () => void }) {
  return (
    <Card onClick={onClick} elevated gradient className="relative h-44">
      {plan.image_url && (
        <img src={plan.image_url} alt={plan.name} className="absolute inset-0 w-full h-full object-cover opacity-50" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-surface via-ink-surface/60 to-transparent" />
      <div className="relative p-4 flex flex-col justify-end h-full">
        <h4 className="text-display-sm text-cloud font-semibold mb-1">{plan.name}</h4>
        <p className="text-xs text-cloud-dim line-clamp-1 mb-2">{plan.description}</p>
        <div className="flex items-center gap-3 text-xs text-cloud-dim">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{plan.session_duration_min}m</span>
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{plan.sessions_per_week}x/wk</span>
          <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />{plan.difficulty}</span>
        </div>
      </div>
    </Card>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-xl2 bg-ink-surface border border-ink-border hover:border-lime/30 transition-all active:scale-[0.98]"
    >
      <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center text-lime">
        {icon}
      </div>
      <span className="text-sm font-medium text-cloud text-left flex-1">{label}</span>
      <ArrowRight className="w-4 h-4 text-cloud-dim" />
    </button>
  );
}
