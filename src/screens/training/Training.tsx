import { useEffect, useState } from 'react';
import { fetchWorkoutPlans, fetchPlanExercises, fetchExercises, fetchUserSessions } from '@/lib/data';
import { fetchActiveRoutine, listMyRoutines, setActiveRoutine } from '@/lib/training/api';
import { routineDays, routineWeeklySets } from '@/lib/training/routine';
import { MUSCLE_LABELS as FINE_MUSCLE_LABELS, type RecoveryMuscle } from '@/lib/recovery/muscles';
import type { WorkoutPlan, Exercise, WorkoutPlanExercise, WorkoutSession } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { FilterChips } from '@/components/ui/Chip';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Avatar';
import { useEntitlements } from '@/lib/entitlements-context';
import { BlueprintStorefront } from '@/components/ui/BlueprintStorefront';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { StripeUpgradeModal } from '@/components/ui/StripeUpgradeModal';
import { CustomExerciseModal } from '@/components/ui/CustomExerciseModal';
import {
  Search, Clock, Calendar, Dumbbell, ListOrdered, TrendingUp,
  Crown, ChevronRight, Play, ArrowRight, Zap, Flame, Filter,
  Star, Sparkles, Brain, Lock, Activity, ShoppingCart, Plus, Check, X
} from 'lucide-react';
import {
  GOAL_LABELS, DIFFICULTY_LABELS, MUSCLE_LABELS, EQUIPMENT_LABELS,
  cn, calculateStreak
} from '@/lib/utils';

interface TrainingProps {
  onNavigate: (screen: { name: string; [key: string]: string | null }) => void;
}

type View = 'routines' | 'exercises';

const DIFFICULTY_FILTERS = [
  { value: 'all', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const MUSCLE_FILTERS = [
  { value: 'all', label: 'All Muscles' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'legs', label: 'Legs' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'core', label: 'Core' },
  { value: 'full_body', label: 'Full Body' },
  { value: 'cardio', label: 'Cardio' },
];

const EQUIPMENT_FILTERS = [
  { value: 'all', label: 'All Equipment' },
  { value: 'none', label: 'Bodyweight' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'resistance_bands', label: 'Bands' },
  { value: 'bench', label: 'Bench' },
  { value: 'machine', label: 'Machine' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_FILTERS = [
  { value: 'all', label: 'All Categories' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'stretching', label: 'Stretching' },
  { value: 'plyometrics', label: 'Plyometrics' },
  { value: 'powerlifting', label: 'Powerlifting' },
  { value: 'strongman', label: 'Strongman' },
  { value: 'olympic_weightlifting', label: 'Olympic' },
];

const FORCE_FILTERS = [
  { value: 'all', label: 'All Force' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'static', label: 'Static' },
];

const MECHANIC_FILTERS = [
  { value: 'all', label: 'All Mechanics' },
  { value: 'compound', label: 'Compound' },
  { value: 'isolation', label: 'Isolation' },
];

// Cinematic gym photography (Pexels — license-free)
const PLAN_PHOTOS: Record<string, string> = {
  strength: 'https://images.pexels.com/photos/17210051/pexels-photo-17210051.jpeg?auto=compress&cs=tinysrgb&w=800',
  muscle: 'https://images.pexels.com/photos/14209250/pexels-photo-14209250.jpeg?auto=compress&cs=tinysrgb&w=800',
  fat_loss: 'https://images.pexels.com/photos/4761785/pexels-photo-4761785.jpeg?auto=compress&cs=tinysrgb&w=800',
  endurance: 'https://images.pexels.com/photos/7690459/pexels-photo-7690459.jpeg?auto=compress&cs=tinysrgb&w=800',
  flexibility: 'https://images.pexels.com/photos/38453115/pexels-photo-38453115.jpeg?auto=compress&cs=tinysrgb&w=800',
  general: 'https://images.pexels.com/photos/6390226/pexels-photo-6390226.jpeg?auto=compress&cs=tinysrgb&w=800',
};

const EXERCISE_PHOTOS: Record<string, string> = {
  chest: 'https://images.pexels.com/photos/10475445/pexels-photo-10475445.jpeg?auto=compress&cs=tinysrgb&w=400',
  back: 'https://images.pexels.com/photos/14209250/pexels-photo-14209250.jpeg?auto=compress&cs=tinysrgb&w=400',
  legs: 'https://images.pexels.com/photos/7289370/pexels-photo-7289370.jpeg?auto=compress&cs=tinysrgb&w=400',
  shoulders: 'https://images.pexels.com/photos/7289370/pexels-photo-7289370.jpeg?auto=compress&cs=tinysrgb&w=400',
  arms: 'https://images.pexels.com/photos/10475445/pexels-photo-10475445.jpeg?auto=compress&cs=tinysrgb&w=400',
  core: 'https://images.pexels.com/photos/4761785/pexels-photo-4761785.jpeg?auto=compress&cs=tinysrgb&w=400',
  full_body: 'https://images.pexels.com/photos/6390226/pexels-photo-6390226.jpeg?auto=compress&cs=tinysrgb&w=400',
  cardio: 'https://images.pexels.com/photos/4761785/pexels-photo-4761785.jpeg?auto=compress&cs=tinysrgb&w=400',
};

function getPlanPhoto(plan: WorkoutPlan): string {
  return plan.image_url ?? PLAN_PHOTOS[plan.goal] ?? PLAN_PHOTOS.general;
}

function getExercisePhoto(muscle: string): string {
  return EXERCISE_PHOTOS[muscle] ?? EXERCISE_PHOTOS.full_body;
}

function getExerciseImage(exercise: Exercise): string {
  return exercise.image_url ?? getExercisePhoto(exercise.primary_muscle);
}

export function Training({ onNavigate }: TrainingProps) {
  const [view, setView] = useState<View>('routines');
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [planExercises, setPlanExercises] = useState<Record<string, WorkoutPlanExercise[]>>({});
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tier, hasFeature } = useEntitlements();

  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [forceFilter, setForceFilter] = useState('all');
  const [mechanicFilter, setMechanicFilter] = useState('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showStorefront, setShowStorefront] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [myRoutines, setMyRoutines] = useState<WorkoutPlan[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, e, s, mine, active] = await Promise.all([
          fetchWorkoutPlans(),
          fetchExercises(),
          fetchUserSessions(20),
          listMyRoutines().catch(() => [] as WorkoutPlan[]),
          fetchActiveRoutine().catch(() => null),
        ]);
        setPlans(p);
        setExercises(e);
        setSessions(s.filter((x) => x.completed_at));
        setMyRoutines(mine);
        setActivePlan(active);
        setActivePlanId(active?.id ?? null);

        const peMap: Record<string, WorkoutPlanExercise[]> = {};
        for (const plan of [...mine, ...p.slice(0, 12)]) {
          try {
            peMap[plan.id] = await fetchPlanExercises(plan.id);
          } catch {
            peMap[plan.id] = [];
          }
        }
        setPlanExercises(peMap);

        const favs = new Set<string>();
        for (const ex of e) {
          if (localStorage.getItem(`exercise_fav_${ex.id}`) === 'true') favs.add(ex.id);
        }
        setFavorites(favs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load training data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        localStorage.setItem(`exercise_fav_${id}`, 'false');
      } else {
        next.add(id);
        localStorage.setItem(`exercise_fav_${id}`, 'true');
      }
      return next;
    });
  };

  const filteredPlans = plans.filter((p) => {
    if (difficultyFilter !== 'all' && p.difficulty !== difficultyFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSetActivePlan = async (planId: string) => {
    try {
      await setActiveRoutine(planId);
      setActivePlanId(planId);
      setActivePlan([...myRoutines, ...plans].find((x) => x.id === planId) ?? null);
    } catch {
      // keep the current active routine if the change fails
    }
  };

  const canAccess = (exerciseTier: string | null | undefined): boolean => {
    const et = exerciseTier ?? 'free';
    if (et === 'free') return true;
    if (et === 'pro') return tier === 'pro' || tier === 'plus';
    if (et === 'plus') return tier === 'plus';
    return true;
  };

  const filteredExercises = exercises.filter((e) => {
    if (muscleFilter !== 'all' && e.primary_muscle !== muscleFilter) return false;
    if (equipmentFilter !== 'all' && e.equipment !== equipmentFilter) return false;
    if (difficultyFilter !== 'all' && e.difficulty !== difficultyFilter) return false;
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    if (forceFilter !== 'all' && e.force_type !== forceFilter) return false;
    if (mechanicFilter !== 'all' && e.mechanic !== mechanicFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.name.toLowerCase().includes(q) && !(e.aliases ?? []).some((a) => a.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const streak = calculateStreak(sessions);

  return (
    <div className="pb-24 animate-fade-in min-h-screen bg-ink-bg">
      {/* Header with PRO button */}
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <h1 className="text-display-lg text-cloud font-bold">
          {view === 'routines' ? 'Routines' : 'Exercises'}
        </h1>
        <button
          onClick={() => onNavigate({ name: 'profile' })}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all',
            tier !== 'free'
              ? 'bg-ink-elevated text-cloud-dim'
              : 'bg-lime-gradient text-ink-bg shadow-lime-sm animate-pulse-lime'
          )}
        >
          <Crown className="w-3.5 h-3.5" />
          {tier !== 'free' ? 'PRO ACTIVE' : 'UPGRADE TO PRO'}
        </button>
      </div>

      {/* View Toggle */}
      <div className="px-5 mb-4">
        <div className="flex bg-ink-elevated rounded-xl p-1">
          <button
            onClick={() => setView('routines')}
            className={cn(
              'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
              view === 'routines' ? 'bg-lime text-ink-bg' : 'text-cloud-dim'
            )}
          >
            <ListOrdered className="w-4 h-4" />
            Routines
          </button>
          <button
            onClick={() => setView('exercises')}
            className={cn(
              'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
              view === 'exercises' ? 'bg-lime text-ink-bg' : 'text-cloud-dim'
            )}
          >
            <Dumbbell className="w-4 h-4" />
            Exercises
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="px-5"><LoadingState label="Loading..." /></div>
      ) : error ? (
        <div className="px-5"><p className="text-sm text-rust text-center">{error}</p></div>
      ) : view === 'routines' ? (
        <>
          {/* Training coach: evidence-based plan from the person's answers */}
          <div className="px-5 mb-5">
            <Card
              elevated
              onClick={() => onNavigate({ name: 'training-coach' })}
              className="relative overflow-hidden border-lime/40 bg-gradient-to-br from-lime/15 via-ink-elevated to-ink-surface"
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-lime/15 rounded-full blur-3xl pointer-events-none" />
              <div className="relative p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-11 h-11 rounded-xl bg-lime/20 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-lime" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-cloud">Training coach</h3>
                    <p className="text-[11px] text-cloud-dim">Your plan from studies, your body and your training</p>
                  </div>
                </div>
                <p className="text-[11px] text-cloud-dim leading-relaxed mb-3">
                  Answers a few questions (only what it does not know), builds a week you can start today, explains every choice with references, and remembers you.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-lime flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Build or open my plan</span>
                  <ChevronRight className="w-4 h-4 text-lime" />
                </div>
              </div>
            </Card>
          </div>

          {/* Active Plan Card */}
          {activePlan && (
            <div className="px-5 mb-5">
              <h3 className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-2.5">Active routine</h3>
              <Card
                elevated
                onClick={() => onNavigate({ name: 'programme-detail', planId: activePlan.id })}
                className="relative h-44 overflow-hidden bg-gradient-to-br from-ink-elevated to-ink-surface border-lime/20"
              >
                <img src={getPlanPhoto(activePlan)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-surface via-ink-surface/70 to-transparent" />
                <div className="relative p-4 flex flex-col justify-end h-full">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-lime/20 text-lime text-[10px] font-bold">
                      <Zap className="w-2.5 h-2.5" fill="currentColor" />
                      ACTIVE
                    </div>
                    <Badge variant="outline">{DIFFICULTY_LABELS[activePlan.difficulty]}</Badge>
                  </div>
                  <h3 className="text-display-sm text-cloud font-semibold mb-1">{activePlan.name}</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-cloud-dim">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{activePlan.session_duration_min}m</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{activePlan.sessions_per_week}x/wk</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onNavigate({ name: 'active-workout', planId: activePlan.id }); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime text-ink-bg text-xs font-bold"
                    >
                      <Play className="w-3 h-3" fill="currentColor" /> {routineDays(planExercises[activePlan.id] ?? []).length > 1 ? 'Next day' : 'Start'}
                    </button>
                  </div>
                </div>
              </Card>
              <button
                onClick={() => setShowAllPlans(true)}
                className="mt-2 text-xs text-lime hover:text-lime-dark transition-colors flex items-center gap-1"
              >
                View all plans <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Streak Banner */}
          {streak > 0 && (
            <div className="px-5 mb-5">
              <div className="flex items-center gap-3 p-3.5 rounded-xl2 bg-gradient-to-r from-lime/10 to-transparent border border-lime/20">
                <div className="w-10 h-10 rounded-xl bg-lime/15 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-lime" fill="currentColor" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-cloud">{streak} day streak!</p>
                  <p className="text-[11px] text-cloud-dim">Keep the momentum going</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Biometric Routine Generator Card */}
          <div className="px-5 mb-5">
            <Card
              elevated
              onClick={() => onNavigate({ name: 'routine-generator' })}
              className="relative overflow-hidden border-lime/30 bg-gradient-to-br from-ink-elevated to-ink-surface"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-lime/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-11 h-11 rounded-xl bg-lime/15 flex items-center justify-center">
                      <Brain className="w-5.5 h-5.5 text-lime" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-cloud">AI Biometric Routine</h3>
                      <p className="text-[11px] text-cloud-dim">o3-mini-powered custom weekly program</p>
                    </div>
                  </div>
                  {hasFeature('biometric') ? (
                    <Badge variant="lime">PRO+</Badge>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-elevated text-cloud-dim text-[10px] font-bold">
                      <Lock className="w-2.5 h-2.5" />
                      LOCKED
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-cloud-dim leading-relaxed mb-3">
                  Personalized training based on your body fat, joint limitations, equipment, and fatigue levels.
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-lime" />
                    <span className="text-xs font-semibold text-lime">
                      {hasFeature('biometric') ? 'Generate Now' : 'Upgrade to Unlock'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-lime" />
                </div>
              </div>
            </Card>
          </div>

          {/* Biometric Assessment Entry */}
          <div className="px-5 mb-5">
            <button
              onClick={() => onNavigate({ name: 'biometric-assessment' })}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl2 bg-ink-surface border border-ink-border hover:border-lime/30 transition-all active:scale-[0.98] text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center text-lime flex-shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-cloud">Biometric Assessment</p>
                <p className="text-[11px] text-cloud-dim">Update body metrics & injury profile</p>
              </div>
              <ChevronRight className="w-4 h-4 text-cloud-dim" />
            </button>
          </div>

          {/* Blueprint Storefront Entry — high visibility */}
          <div className="px-5 mb-5">
            <button
              onClick={() => setShowStorefront(true)}
              className="w-full flex items-center gap-3 p-4 rounded-xl2 bg-gradient-to-r from-lime/10 via-lime/5 to-transparent border border-lime/30 hover:border-lime/50 transition-all active:scale-[0.98] text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-lime/15 flex items-center justify-center text-lime flex-shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-cloud">Buy Standalone Custom AI Plan & PDF</p>
                <p className="text-[11px] text-cloud-dim">One-off payment from £3.50 — no subscription, includes PDF download</p>
              </div>
              <ChevronRight className="w-4 h-4 text-lime flex-shrink-0" />
            </button>
          </div>

          {/* Start Empty Workout */}
          <div className="px-5 mb-5">
            <button
              onClick={() => onNavigate({ name: 'active-workout', planId: null })}
              className="w-full flex items-center gap-3 p-4 rounded-xl2 bg-gradient-to-r from-lime/10 to-transparent border border-lime/30 hover:border-lime/50 transition-all active:scale-[0.98] text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-lime/15 flex items-center justify-center text-lime flex-shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-cloud">Start Empty Workout</p>
                <p className="text-[11px] text-cloud-dim">Ad-hoc session — pick exercises as you go</p>
              </div>
              <ChevronRight className="w-4 h-4 text-lime flex-shrink-0" />
            </button>
          </div>

          {/* My routines */}
          {myRoutines.length > 0 && (
            <div className="px-5 mb-5">
              <h3 className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-2.5">My routines</h3>
              <div className="space-y-4">
                {myRoutines.map((plan) => (
                  <RoutineCard
                    key={plan.id}
                    plan={plan}
                    planExercises={planExercises[plan.id] ?? []}
                    isActive={activePlanId === plan.id}
                    onClick={() => onNavigate({ name: 'programme-detail', planId: plan.id })}
                    onStartWorkout={() => onNavigate({ name: 'active-workout', planId: plan.id })}
                    onSetActive={() => handleSetActivePlan(plan.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="px-5 mb-2.5">
            <h3 className="text-xs font-semibold text-cloud-dim uppercase tracking-wider">Ready-made routines</h3>
          </div>

          {/* Routine Cards */}
          {filteredPlans.length === 0 ? (
            <EmptyState icon={<ListOrdered className="w-7 h-7" />} title="No routines found" description="Try adjusting your filters." />
          ) : (
            <div className="px-5 space-y-4">
              {filteredPlans.map((plan) => (
                <RoutineCard
                  key={plan.id}
                  plan={plan}
                  planExercises={planExercises[plan.id] ?? []}
                  isActive={activePlanId === plan.id}
                  onClick={() => onNavigate({ name: 'programme-detail', planId: plan.id })}
                  onStartWorkout={() => onNavigate({ name: 'active-workout', planId: plan.id })}
                  onSetActive={() => handleSetActivePlan(plan.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Search + Filters */}
          <div className="px-5 mb-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search exercises..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={<Search className="w-4 h-4" />}
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center transition-colors flex-shrink-0',
                  showFilters ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim'
                )}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          {showFilters && (
            <div className="px-5 mb-4 flex flex-col gap-2 animate-fade-in">
              <FilterChips options={MUSCLE_FILTERS} selected={muscleFilter} onSelect={setMuscleFilter} />
              <FilterChips options={EQUIPMENT_FILTERS} selected={equipmentFilter} onSelect={setEquipmentFilter} />
              <FilterChips options={DIFFICULTY_FILTERS} selected={difficultyFilter} onSelect={setDifficultyFilter} />
              <FilterChips options={CATEGORY_FILTERS} selected={categoryFilter} onSelect={setCategoryFilter} />
              <FilterChips options={FORCE_FILTERS} selected={forceFilter} onSelect={setForceFilter} />
              <FilterChips options={MECHANIC_FILTERS} selected={mechanicFilter} onSelect={setMechanicFilter} />
            </div>
          )}

          {/* Exercise List */}
          {filteredExercises.length === 0 ? (
            <EmptyState icon={<Dumbbell className="w-7 h-7" />} title="No exercises found" description="Try adjusting your filters or add a custom exercise." />
          ) : (
            <div className="px-5 space-y-2.5">
              {filteredExercises.map((exercise) => {
                const hasAccess = canAccess(exercise.access_tier);
                return (
                <ExerciseListCard
                  key={exercise.id}
                  exercise={exercise}
                  isFavorite={favorites.has(exercise.id)}
                  hasAccess={hasAccess}
                  onToggleFavorite={() => toggleFavorite(exercise.id)}
                  onClick={() => hasAccess ? onNavigate({ name: 'exercise-detail', exerciseId: exercise.id }) : setShowUpgrade(true)}
                  onStart={() => onNavigate({ name: 'start-exercise', exerciseId: exercise.id })}
                />
                );
              })}
            </div>
          )}

          {/* Add Custom Exercise Button */}
          <div className="px-5 mt-4 pb-4">
            <button
              onClick={() => setShowCustomModal(true)}
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl2 bg-ink-surface border border-dashed border-lime/30 text-sm text-lime hover:bg-lime/5 hover:border-lime/50 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Custom Exercise
            </button>
          </div>
        </>
      )}

      <ErrorBoundary label="Blueprint Store">
        <BlueprintStorefront open={showStorefront} onClose={() => setShowStorefront(false)} />
      </ErrorBoundary>

      <StripeUpgradeModal open={showUpgrade} currentTier={tier} onClose={() => setShowUpgrade(false)} />

      <CustomExerciseModal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onCreated={(ex) => { setExercises((prev) => [...prev, ex]); }}
      />

      {showAllPlans && (
        <AllPlansModal
          plans={plans}
          activePlanId={activePlanId}
          onSetActive={(pid) => handleSetActivePlan(pid)}
          onClose={() => setShowAllPlans(false)}
        />
      )}
    </div>
  );
}


function RoutineCard({
  plan,
  planExercises,
  isActive,
  onClick,
  onStartWorkout,
  onSetActive,
}: {
  plan: WorkoutPlan;
  planExercises: WorkoutPlanExercise[];
  isActive: boolean;
  onClick: () => void;
  onStartWorkout: () => void;
  onSetActive: () => void;
}) {
  const weekly = routineWeeklySets(planExercises, plan.sessions_per_week);
  const topMuscles = weekly.slice(0, 4);
  const dayCount = routineDays(planExercises).length;

  return (
    <Card onClick={onClick} elevated className="overflow-hidden">
      {/* Card Header */}
      <div className="relative h-32 overflow-hidden">
        <img src={getPlanPhoto(plan)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-surface via-ink-surface/60 to-transparent" />
        <div className="relative p-4 flex flex-col justify-end h-full">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="lime">{GOAL_LABELS[plan.goal]}</Badge>
            <Badge variant="outline">{DIFFICULTY_LABELS[plan.difficulty]}</Badge>
            {dayCount > 1 && <Badge variant="outline">{dayCount} days</Badge>}
          </div>
          <h3 className="text-display-sm text-cloud font-semibold">{plan.name}</h3>
        </div>
      </div>

      {/* Weekly sets per muscle group (fractional: 1 per direct set, ½ per helping set) */}
      {topMuscles.length > 0 && (
        <div className="px-4 pt-3 pb-2">
          <p className="text-[10px] text-cloud-dim mb-1.5">Weekly sets{dayCount > 1 ? '' : ` (${plan.sessions_per_week}× a week)`}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {topMuscles.map((m) => (
              <span key={m.group} className="px-2 py-1 rounded-lg bg-ink-elevated text-[10px] text-cloud-dim">
                {m.label.replace(/ \(.*\)$/, '')} <span className="text-lime font-bold">{m.sets}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Exercise Thumbnails */}
      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {planExercises.slice(0, 6).map((pe) => (
            <div
              key={pe.id}
              className="flex-shrink-0 w-16 h-16 rounded-xl bg-ink-elevated border border-ink-border overflow-hidden relative group"
            >
              {pe.exercise && (
                <img
                  src={getExercisePhoto(pe.exercise.primary_muscle)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  loading="lazy"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-surface/80 to-transparent" />
              <span className="absolute bottom-1 left-1 right-1 text-[8px] text-cloud font-medium text-center line-clamp-2 leading-tight">
                {pe.exercise?.name ?? 'Exercise'}
              </span>
            </div>
          ))}
          {planExercises.length === 0 && (
            <div className="text-[11px] text-cloud-dim py-3">No exercises configured yet</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 flex items-center justify-between border-t border-ink-border/50">
        <div className="flex items-center gap-3 text-[11px] text-cloud-dim">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{plan.session_duration_min}m</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{plan.sessions_per_week}x/wk</span>
          <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{plan.duration_weeks}w</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onSetActive(); }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors',
              isActive ? 'bg-lime/20 text-lime' : 'bg-ink-elevated text-cloud-dim hover:text-lime'
            )}
          >
            {isActive ? <><Check className="w-3 h-3" /> Active</> : 'Set Active'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartWorkout();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime/10 text-lime text-xs font-semibold hover:bg-lime/20 transition-colors"
          >
            <Play className="w-3 h-3" fill="currentColor" />
            Start
          </button>
        </div>
      </div>
    </Card>
  );
}

function ExerciseListCard({
  exercise,
  isFavorite,
  hasAccess,
  onToggleFavorite,
  onClick,
  onStart,
}: {
  exercise: Exercise;
  isFavorite: boolean;
  hasAccess: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
  onStart: () => void;
}) {
  const difficultyLevel = exercise.difficulty === 'beginner' ? 1 : exercise.difficulty === 'intermediate' ? 2 : 3;
  const tierLabel = exercise.access_tier === 'plus' ? 'PRO+' : exercise.access_tier === 'pro' ? 'PRO' : null;

  return (
    <Card onClick={onClick} className={cn('p-3 flex items-center gap-3 transition-colors', hasAccess ? 'hover:border-lime/20' : 'opacity-70 hover:border-ink-border')}>
      {/* Cinematic Thumbnail */}
      <div className="w-14 h-14 rounded-xl overflow-hidden border border-ink-border flex items-center justify-center flex-shrink-0 relative">
        <img
          src={getExerciseImage(exercise)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-70"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-surface/60 to-transparent" />
        {!hasAccess && (
          <div className="absolute inset-0 bg-ink-surface/70 flex items-center justify-center">
            <Lock className="w-4 h-4 text-cloud-dim" />
          </div>
        )}
        <div className="absolute bottom-1 right-1 flex gap-0.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'w-1 h-1 rounded-full',
                i <= difficultyLevel ? 'bg-lime' : 'bg-ink-border'
              )}
            />
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-sm font-semibold text-cloud truncate">{exercise.name}</h4>
          {tierLabel && (
            <span className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold flex-shrink-0',
              hasAccess
                ? 'bg-ink-elevated text-cloud-dim'
                : 'bg-gold/15 text-gold'
            )}>
              {!hasAccess && <Lock className="w-2 h-2" />}
              {tierLabel}
            </span>
          )}
        </div>
        <p className="text-[11px] text-cloud-dim line-clamp-1 mt-0.5">{exercise.description}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="px-2 py-0.5 rounded-md bg-lime/10 text-[10px] text-lime font-medium truncate max-w-[60%]">
            {exercise.muscles_primary && exercise.muscles_primary.length > 0
              ? exercise.muscles_primary.slice(0, 2).map((m) => FINE_MUSCLE_LABELS[m as RecoveryMuscle] ?? m).join(', ')
              : MUSCLE_LABELS[exercise.primary_muscle] ?? exercise.primary_muscle}
          </span>
          <span className="text-[10px] text-cloud-dim">
            {EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment}
          </span>
          {exercise.is_custom && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gold/15 text-gold">
              CUSTOM
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        {hasAccess && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStart();
            }}
            aria-label={`Start and log ${exercise.name}`}
            className="w-7 h-7 rounded-lg bg-lime/10 text-lime flex items-center justify-center hover:bg-lime/20"
          >
            <Play className="w-3.5 h-3.5" fill="currentColor" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="text-cloud-dim hover:text-gold transition-colors"
        >
          <Star className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} color={isFavorite ? '#FFB224' : undefined} />
        </button>
      </div>
    </Card>
  );
}

function AllPlansModal({
  plans,
  activePlanId,
  onSetActive,
  onClose,
}: {
  plans: WorkoutPlan[];
  activePlanId: string | null;
  onSetActive: (planId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-ink-surface rounded-t-3xl sm:rounded-3xl border border-ink-border max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-ink-surface border-b border-ink-border/50 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-cloud">All Plans</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2">
          {plans.map((plan) => (
            <div key={plan.id} className="flex items-center gap-3 p-3 rounded-xl bg-ink-elevated/50 border border-ink-border">
              <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center flex-shrink-0">
                <ListOrdered className="w-5 h-5 text-lime" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-cloud truncate">{plan.name}</p>
                <p className="text-[10px] text-cloud-dim">
                  {GOAL_LABELS[plan.goal]} · {DIFFICULTY_LABELS[plan.difficulty]} · {plan.sessions_per_week}x/wk
                </p>
              </div>
              <button
                onClick={() => onSetActive(plan.id)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors flex-shrink-0',
                  activePlanId === plan.id ? 'bg-lime/20 text-lime' : 'bg-ink-elevated text-cloud-dim hover:text-lime'
                )}
              >
                {activePlanId === plan.id ? <><Check className="w-3 h-3" /> Active</> : 'Set Active'}
              </button>
            </div>
          ))}
          {plans.length === 0 && (
            <p className="text-sm text-cloud-dim text-center py-8">No plans available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
