import { useEffect, useMemo, useState } from 'react';
import { fetchWorkoutPlanById, fetchPlanExercises } from '@/lib/data';
import { deleteRoutine, setActiveRoutine, fetchActiveRoutine, routineVariant, findHomeVersion } from '@/lib/training/api';
import { HomeSwitchSheet } from './HomeSwitch';
import { routineDays, routineWeeklySets } from '@/lib/training/routine';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { WorkoutPlan, WorkoutPlanExercise } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ChevronLeft, ChevronRight, Clock, Calendar, TrendingUp, Dumbbell, Play, Check, Target, Wrench, Trash2, FileText, BarChart3, Home, Building2 } from 'lucide-react';
import { GOAL_LABELS, DIFFICULTY_LABELS, EQUIPMENT_LABELS, cn } from '@/lib/utils';
import { EQUIP_LABELS, type EquipTag } from '@/lib/training/taxonomy';

interface ProgrammeDetailProps {
  planId: string;
  onBack: () => void;
  onStartWorkout: (planId: string, day: number | null) => void;
  onOpenExercise: (exerciseId: string) => void;
  onOpenPlan: (planId: string) => void;
  /** Open another routine (the home or gym version of this one). */
  onOpenProgramme?: (planId: string) => void;
}

export function ProgrammeDetail({ planId, onBack, onStartWorkout, onOpenExercise, onOpenPlan, onOpenProgramme }: ProgrammeDetailProps) {
  const { session } = useAuth();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<WorkoutPlanExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showHome, setShowHome] = useState(false);
  const [homeVersion, setHomeVersion] = useState<WorkoutPlan | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setShowHome(false);
      try {
        const [p, e, current, home] = await Promise.all([fetchWorkoutPlanById(planId), fetchPlanExercises(planId), fetchActiveRoutine().catch(() => null), findHomeVersion(planId).catch(() => null)]);
        setPlan(p);
        setExercises(e);
        setActive(current?.id === planId);
        setHomeVersion(home);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load programme');
      } finally {
        setLoading(false);
      }
    })();
  }, [planId]);

  const days = useMemo(() => routineDays(exercises), [exercises]);
  const weekly = useMemo(() => routineWeeklySets(exercises, plan?.sessions_per_week ?? 1), [exercises, plan]);
  const isOwner = !!plan && !!session?.user && plan.created_by === session.user.id && !plan.is_public;
  const hasEnginePlan = !!plan?.details && typeof plan.details === 'object' && 'engineVersion' in (plan.details as object);
  const variant = routineVariant(plan);

  /** Make another routine active and open it (gym ↔ home). */
  const switchTo = async (targetId: string) => {
    setSwitching(true);
    setActionError(null);
    try {
      await setActiveRoutine(targetId);
      if (onOpenProgramme) onOpenProgramme(targetId);
      else if (targetId === planId) setActive(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not switch routine.');
    } finally {
      setSwitching(false);
    }
  };

  const handleAssign = async () => {
    setAssigning(true);
    setActionError(null);
    try {
      await setActiveRoutine(planId);
      setActive(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not set this routine as active.');
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRoutine(planId);
      onBack();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete this routine.');
    }
  };

  if (loading) return <div className="px-5 pt-12"><LoadingState /></div>;
  if (error) return <ErrorState message={error} onRetry={onBack} />;
  if (!plan) return <ErrorState message="Programme not found" onRetry={onBack} />;

  const equipmentLabel = (eq: string) => EQUIPMENT_LABELS[eq] ?? EQUIP_LABELS[eq as EquipTag] ?? eq;

  return (
    <div className="pb-28 animate-fade-in">
      <div className="relative h-48">
        {plan.image_url && <img src={plan.image_url} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-bg via-ink-bg/40 to-transparent" />
        <button
          onClick={onBack}
          aria-label="Back"
          className="absolute top-6 left-5 w-10 h-10 rounded-xl bg-ink-bg/60 backdrop-blur-md flex items-center justify-center text-cloud"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        {isOwner && (
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete routine"
            className="absolute top-6 right-5 w-10 h-10 rounded-xl bg-ink-bg/60 backdrop-blur-md flex items-center justify-center text-cloud-dim hover:text-rust"
          >
            <Trash2 className="w-4.5 h-4.5" />
          </button>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="lime">{GOAL_LABELS[plan.goal]}</Badge>
            <Badge variant="outline">{DIFFICULTY_LABELS[plan.difficulty]}</Badge>
            {plan.source === 'engine' || plan.source === 'coach' ? <Badge variant="outline">Built from your answers</Badge> : null}
            {active && <Badge variant="lime">Active</Badge>}
          </div>
          <h1 className="text-display-md text-cloud font-bold">{plan.name}</h1>
        </div>
      </div>

      {typeof (plan as WorkoutPlan & { details?: { progression?: unknown } }).details?.progression === 'string' && (
        <CoachProgression text={String((plan as WorkoutPlan & { details?: { progression?: unknown } }).details!.progression)} />
      )}

      {plan.description && (
        <div className="px-5 mt-4 mb-5">
          <p className="text-sm text-cloud-dim leading-relaxed">{plan.description}</p>
        </div>
      )}

      <div className="px-5 mb-5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<Clock className="w-5 h-5" />} label="Session" value={`~${plan.session_duration_min} min`} />
          <StatCard icon={<Calendar className="w-5 h-5" />} label="Days / week" value={`${days.length > 1 ? days.length : plan.sessions_per_week}`} />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Block" value={`${plan.duration_weeks} weeks`} />
          <StatCard icon={<Target className="w-5 h-5" />} label="Goal" value={GOAL_LABELS[plan.goal]} />
        </div>
      </div>

      <div className="px-5 mb-5">
        {variant ? (
          <div className="flex items-center gap-3 rounded-xl2 border border-sky/30 bg-sky/10 p-3.5" data-testid="home-variant-banner">
            <Home className="h-5 w-5 flex-shrink-0 text-sky" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-cloud">Home version</p>
              <p className="text-[11px] text-cloud-dim">Built from “{variant.sourceName}” for: {variant.equipment.map((e) => EQUIP_LABELS[e as EquipTag] ?? e).join(', ')}.</p>
            </div>
            <button type="button" disabled={switching} onClick={() => void switchTo(variant.sourcePlanId)} className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-sky/20 px-2.5 py-1.5 text-[11px] font-bold text-sky" data-testid="back-to-gym">
              <Building2 className="h-3.5 w-3.5" /> Back to gym
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl2 border border-ink-border bg-ink-surface p-3.5">
            <Home className="h-5 w-5 flex-shrink-0 text-lime" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-cloud">{homeVersion ? 'Home version ready' : 'Can’t get to the gym?'}</p>
              <p className="text-[11px] text-cloud-dim">{homeVersion ? 'Switch to it with one tap, or rebuild it for different equipment.' : 'Turn this routine into a home plan with what you have.'}</p>
            </div>
            <div className="flex flex-shrink-0 flex-col gap-1">
              {homeVersion && (
                <button type="button" disabled={switching} onClick={() => void switchTo(homeVersion.id)} className="rounded-lg bg-lime px-2.5 py-1.5 text-[11px] font-bold text-ink-bg" data-testid="use-home-version">
                  Use home version
                </button>
              )}
              <button type="button" onClick={() => setShowHome(true)} className={cn('rounded-lg px-2.5 py-1.5 text-[11px] font-bold', homeVersion ? 'bg-ink-elevated text-cloud' : 'bg-lime text-ink-bg')} data-testid="open-home-switch">
                {homeVersion ? 'Rebuild' : 'Train at home'}
              </button>
            </div>
          </div>
        )}
      </div>

      {hasEnginePlan && (
        <div className="px-5 mb-5">
          <button
            onClick={() => onOpenPlan(plan.id)}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl2 bg-lime/10 border border-lime/30 text-left"
          >
            <FileText className="w-5 h-5 text-lime flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-cloud">Why this plan, progression and PDF</p>
              <p className="text-[11px] text-cloud-dim">Weekly targets, reasons with references, and the coach</p>
            </div>
            <ChevronRight className="w-4 h-4 text-lime" />
          </button>
        </div>
      )}

      {plan.equipment_needed.length > 0 && (
        <div className="px-5 mb-5">
          <h3 className="text-sm font-semibold text-cloud mb-3 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-lime" />
            Equipment
          </h3>
          <div className="flex flex-wrap gap-2">
            {plan.equipment_needed.map((eq) => (
              <Badge key={eq} variant="outline">{equipmentLabel(eq)}</Badge>
            ))}
          </div>
        </div>
      )}

      {weekly.length > 0 && (
        <div className="px-5 mb-5">
          <h3 className="text-sm font-semibold text-cloud mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-lime" />
            Weekly sets per muscle group
          </h3>
          <p className="text-[11px] text-cloud-dim mb-3">Each set counts 1 for the muscle trained directly and ½ for muscles that help.</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {weekly.map((w) => (
              <div key={w.group} className="flex items-center justify-between text-xs">
                <span className="text-cloud-dim truncate">{w.label}</span>
                <span className="text-cloud font-semibold tabular-nums">{w.sets}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {days.map((day) => (
        <div key={day.index} className="px-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-cloud flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-lime" />
              {days.length > 1 ? day.label : `Exercises (${day.exercises.length})`}
            </h3>
            {days.length > 1 && (
              <button
                onClick={() => onStartWorkout(plan.id, day.index)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime/10 text-lime text-xs font-semibold"
              >
                <Play className="w-3 h-3" fill="currentColor" /> Start
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {day.exercises.map((pe, i) => (
              <Card key={pe.id} onClick={() => onOpenExercise(pe.exercise_id)} className="p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim text-xs font-bold flex-shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cloud truncate">{pe.exercise?.name ?? 'Exercise'}</p>
                  <p className="text-xs text-cloud-dim mt-0.5">
                    {pe.sets} × {pe.reps} · {pe.rest_seconds}s rest{pe.rir_target != null ? ` · ${pe.rir_target} in reserve` : ''}
                  </p>
                  {pe.notes && <p className="text-[11px] text-cloud-dim/80 mt-0.5 line-clamp-2">{pe.notes}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-cloud-dim flex-shrink-0" />
              </Card>
            ))}
          </div>
        </div>
      ))}

      {actionError && <p className="px-5 text-xs text-rust mb-3">{actionError}</p>}

      <div className="fixed bottom-0 left-0 right-0 bg-ink-surface/95 backdrop-blur-xl border-t border-ink-border p-4 safe-bottom z-30">
        <div className="max-w-md mx-auto flex gap-3">
          <Button variant="outline" size="lg" onClick={handleAssign} loading={assigning} disabled={active} className="flex-1">
            {active ? <><Check className="w-4 h-4" /> Active</> : 'Make active'}
          </Button>
          <Button size="lg" onClick={() => onStartWorkout(plan.id, null)} className="flex-1">
            <Play className="w-4 h-4" fill="currentColor" />
            {days.length > 1 ? 'Start next day' : 'Start workout'}
          </Button>
        </div>
      </div>

      {showHome && plan && (
        <HomeSwitchSheet plan={plan} rows={exercises} onClose={() => setShowHome(false)} onSaved={(id) => { setShowHome(false); if (onOpenProgramme) onOpenProgramme(id); }} />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this routine?"
        message="The routine is removed. Workouts you already logged with it stay in your history."
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center text-lime flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-cloud-dim">{label}</p>
        <p className="text-sm font-semibold text-cloud truncate">{value}</p>
      </div>
    </Card>
  );
}

/** The coach's progression instructions for this program. */
function CoachProgression({ text }: { text: string }) {
  const { t, dir } = useI18n();
  if (!text.trim()) return null;
  return (
    <div className="px-5 mt-4" dir={dir} data-testid="coach-progression">
      <div className="rounded-2xl border border-gold/30 bg-gold/[0.06] p-3">
        <div className="mb-1 text-xs font-semibold text-gold">{t('coach.progressionShown')}</div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-cloud" dir="auto">{text}</p>
      </div>
    </div>
  );
}
