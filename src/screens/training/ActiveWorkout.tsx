import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPlanExercises, fetchExercises, fetchActiveSession, createWorkoutSession, saveSetLog, updateSetLog, completeWorkoutSession, abandonWorkoutSession, fetchSessionSetLogs, fetchExercisesByIds, fetchWorkoutPlanById, nextRoutineDay } from '@/lib/data';
import { routineDays } from '@/lib/training/routine';
import { relatedRoutineIds } from '@/lib/training/api';
import { DeloadBanner } from '@/components/recovery/DeloadBanner';
import { supabase } from '@/lib/supabase';
import { deloadSets, deloadState, loadRecoveryPlan, shortDate } from '@/lib/coach/recovery-plan';
import { localDateKey } from '@/lib/recovery/store';
import { TimeFitSheet, applyFit, type PairInfo } from './TimeFit';
import { SHORT_ON_TIME_PREFIX, type FitResult } from '@/lib/training/time-fit';
import type { WorkoutPlanExercise, SetType, Exercise } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { LoadingState, ErrorState } from '@/components/ui/States';
import {
  ChevronLeft, Check, X, ChevronRight, ChevronDown,
  Play, Pause, Timer, Dumbbell, Volume2, VolumeX, Headphones,
  Plus, StickyNote, ChevronUp, Clock, Undo2, Link2,
} from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { AnatomyViewer } from '@/components/ui/AnatomyViewer';
import { useAudioCoach } from '@/lib/hooks/useAudioCoach';

interface ActiveWorkoutProps {
  planId: string | null;
  /** Routine day to train (0-based); when missing, the day after the last one completed. */
  day?: number | null;
  /** Free workout started from an exercise page: begin with this exercise. */
  exerciseId?: string | null;
  onBack: () => void;
  onComplete: (sessionId: string) => void;
}

interface SetState {
  completed: boolean;
  reps: number;
  weight: string;
  setType: SetType;
  rir: number | null;
  notes: string;
}

const SET_TYPE_LABELS: Record<SetType, string> = {
  warm_up: 'Warm-up',
  working: 'Working',
  drop: 'Drop',
  back_off: 'Back-off',
  assessment: 'Assessment',
};

const SET_TYPE_COLORS: Record<SetType, string> = {
  warm_up: 'text-sky bg-sky/10',
  working: 'text-lime bg-lime/10',
  drop: 'text-rust bg-rust/10',
  back_off: 'text-gold bg-gold/10',
  assessment: 'text-cloud bg-ink-elevated',
};

const SET_TYPE_ORDER: SetType[] = ['warm_up', 'working', 'drop', 'back_off', 'assessment'];

const RIR_OPTIONS: (number | null)[] = [null, 0, 1, 2, 3, 4, 5];

function freshSets(count: number): SetState[] {
  return Array.from({ length: Math.max(1, count) }, (_, idx) => ({
    completed: false,
    reps: 0,
    weight: '',
    setType: idx === 0 ? ('warm_up' as SetType) : ('working' as SetType),
    rir: null,
    notes: '',
  }));
}

function adhocRow(ex: Exercise, order: number): WorkoutPlanExercise {
  return {
    id: `adhoc-${ex.id}-${order}`,
    plan_id: '',
    exercise_id: ex.id,
    exercise_order: order,
    sets: ex.default_sets || 3,
    reps: ex.default_reps || '10',
    rest_seconds: ex.default_rest_seconds || 60,
    exercise: ex,
  };
}

export function ActiveWorkout({ planId, day = null, exerciseId = null, onBack, onComplete }: ActiveWorkoutProps) {
  const [dayLabel, setDayLabel] = useState<string | null>(null);
  const [exercises, setExercises] = useState<WorkoutPlanExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
  const [setStates, setSetStates] = useState<Record<number, SetState[]>>({});
  const [paused, setPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [restTimer, setRestTimer] = useState<{ active: boolean; remaining: number; total: number }>({
    active: false,
    remaining: 0,
    total: 0,
  });
  const [completing, setCompleting] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [expandedSet, setExpandedSet] = useState<number | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const audio = useAudioCoach();
  const [showTimeFit, setShowTimeFit] = useState(false);
  const [pairs, setPairs] = useState<Record<string, PairInfo>>({});
  const { t: tr, lang: uiLang } = useI18n();
  const [coachDeload, setCoachDeload] = useState<{ pct: number; end: string; note: string | null } | null>(null);
  const [fitted, setFitted] = useState<{ target: number; original: WorkoutPlanExercise[]; summary: string } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savingSetRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const existing = await fetchActiveSession(planId);

        // ---- which exercises: a routine day, or a free workout ----
        let rows: WorkoutPlanExercise[] = [];
        let dayToUse: number | null = existing?.plan_day ?? day ?? null;
        let sessionName: string | null = existing?.plan_name ?? null;
        if (planId) {
          const all = await fetchPlanExercises(planId);
          if (all.length === 0) {
            setError('This programme has no exercises.');
            setLoading(false);
            return;
          }
          const days = routineDays(all);
          const planRow = await fetchWorkoutPlanById(planId).catch(() => null);
          if (days.length > 1) {
            const related = await relatedRoutineIds(planRow).catch(() => [] as string[]);
            if (dayToUse == null || !days.some((d) => d.index === dayToUse)) dayToUse = await nextRoutineDay(planId, days.map((d) => d.index), related);
            const chosen = days.find((d) => d.index === dayToUse) ?? days[0];
            rows = chosen.exercises;
            setDayLabel(chosen.label);
          } else {
            rows = all;
            dayToUse = null;
          }
          if (!sessionName) {
            const plan = planRow;
            if (plan) sessionName = days.length > 1 ? `${plan.name} · ${days.find((d) => d.index === dayToUse)?.label ?? ''}` : plan.name;
          }
        }

        const session = existing ?? (await createWorkoutSession(planId, sessionName, dayToUse));
        if (!session) {
          setError('Failed to start workout session.');
          setLoading(false);
          return;
        }
        setSessionId(session.id);
        if (existing) setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)));

        const logs = existing ? await fetchSessionSetLogs(existing.id) : [];
        if (!planId) {
          // Free workout: rebuild the exercises already logged, then add the one it was started from.
          const ids: string[] = [];
          for (const log of logs) if (!ids.includes(log.exercise_id)) ids.push(log.exercise_id);
          if (exerciseId && !ids.includes(exerciseId)) ids.push(exerciseId);
          const found = await fetchExercisesByIds(ids);
          rows = ids
            .map((id) => found.find((f) => f.id === id))
            .filter((f): f is Exercise => !!f)
            .map((ex, i) => adhocRow(ex, i));
        }

        // A deload week set by the coach: fewer sets on routine workouts (logged sets are always kept).
        if (planId) {
          const coachDl = await coachDeloadToday().catch(() => null);
          setCoachDeload(coachDl);
          if (coachDl) rows = rows.map((r) => ({ ...r, sets: deloadSets(r.sets, coachDl.pct) }));
        }
        setExercises(rows);
        setPairs(coachSupersets(rows));
        const initial: Record<number, SetState[]> = {};
        rows.forEach((e, i) => {
          const logged = logs.filter((l) => l.exercise_id === e.exercise_id).reduce((m, l) => Math.max(m, l.set_number), 0);
          initial[i] = freshSets(Math.max(e.sets, logged));
        });
        for (const log of logs) {
          const exerciseIndex = rows.findIndex((item) => item.exercise_id === log.exercise_id);
          if (exerciseIndex < 0 || !initial[exerciseIndex]?.[log.set_number - 1]) continue;
          initial[exerciseIndex][log.set_number - 1] = {
            completed: log.completed,
            reps: log.reps,
            weight: log.weight == null ? '' : String(log.weight),
            setType: log.set_type ?? initial[exerciseIndex][log.set_number - 1].setType,
            rir: log.rir,
            notes: log.notes ?? '',
          };
        }
        setSetStates(initial);
        if (exerciseId) {
          const idx = rows.findIndex((r) => r.exercise_id === exerciseId);
          if (idx >= 0) setCurrentExerciseIdx(idx);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workout');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (restRef.current) clearInterval(restRef.current);
    };
  }, [planId, day, exerciseId]);

  useEffect(() => {
    if (!paused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused]);

  useEffect(() => {
    if (restTimer.active && restTimer.remaining > 0) {
      restRef.current = setInterval(() => {
        setRestTimer((prev) => {
          if (prev.remaining <= 1) {
            if (restRef.current) clearInterval(restRef.current);
            return { ...prev, active: false, remaining: 0 };
          }
          return { ...prev, remaining: prev.remaining - 1 };
        });
      }, 1000);
    } else if (restRef.current) {
      clearInterval(restRef.current);
    }
    return () => {
      if (restRef.current) clearInterval(restRef.current);
    };
  }, [restTimer.active, restTimer.remaining]);

  useEffect(() => {
    if (restTimer.remaining === 3 && restTimer.active) {
      audio.speak('Three, two, one. Get ready for the next set.');
    }
  }, [restTimer.remaining, restTimer.active, audio]);

  const currentExercise = exercises[currentExerciseIdx];
  const currentSets = setStates[currentExerciseIdx] ?? [];

  const totalSets = Object.values(setStates).flat().filter((s) => s.completed).length;
  const totalSetsPossible = Object.values(setStates).flat().length;
  const totalReps = Object.values(setStates).flat().filter((s) => s.completed).reduce((sum, s) => sum + s.reps, 0);
  const totalVolume = Object.values(setStates).flat().filter((s) => s.completed).reduce((sum, s) => sum + (s.reps * (parseFloat(s.weight) || 0)), 0);
  const exercisesCompleted = Object.entries(setStates).filter(([, sets]) => sets.length > 0 && sets.every((s) => s.completed)).length;

  const startRestTimer = useCallback((seconds: number) => {
    setRestTimer({ active: true, remaining: seconds, total: seconds });
  }, []);

  const handleSetToggle = (setIdx: number) => {
    if (savingSetRef.current) return;
    setSetStates((prev) => {
      const updated = { ...prev };
      const sets = [...(updated[currentExerciseIdx] ?? [])];
      const set = sets[setIdx];
      const newCompleted = !set.completed;
      sets[setIdx] = {
        ...set,
        completed: newCompleted,
        reps: newCompleted ? (set.reps || parseInt(currentExercise.reps) || 10) : 0,
      };
      updated[currentExerciseIdx] = sets;

      if (sessionId) {
        savingSetRef.current = true;
        saveSetLog(
          sessionId,
          currentExercise.exercise_id,
          currentExercise.exercise?.name ?? 'Exercise',
          setIdx + 1,
          sets[setIdx].reps,
          set.weight ? parseFloat(set.weight) : null,
          newCompleted,
          set.setType,
          set.rir,
          set.notes || null
        ).then((result) => {
          savingSetRef.current = false;
          if (result.error) throw new Error(result.error);
          if (newCompleted) audio.speak(`Set ${setIdx + 1} complete. Good work. Rest for ${currentExercise.rest_seconds} seconds.`, { interrupt: true });
        }).catch(() => {
          savingSetRef.current = false;
          setSetStates((prev2) => {
            const u2 = { ...prev2 };
            const s2 = [...(u2[currentExerciseIdx] ?? [])];
            if (s2[setIdx]) u2[currentExerciseIdx] = s2.map((item, index) => index === setIdx ? set : item);
            return u2;
          });
          setError('Could not save that set. Please try again.');
        });
        if (newCompleted) startRestTimer(currentExercise.rest_seconds);
      }
      return updated;
    });
  };

  const handleSetEdit = (setIdx: number, field: 'reps' | 'weight' | 'notes', value: string) => {
    setSetStates((prev) => {
      const updated = { ...prev };
      const sets = [...(updated[currentExerciseIdx] ?? [])];
      if (field === 'reps') {
        sets[setIdx] = { ...sets[setIdx], reps: parseInt(value) || 0 };
      } else if (field === 'weight') {
        sets[setIdx] = { ...sets[setIdx], weight: value };
      } else {
        sets[setIdx] = { ...sets[setIdx], notes: value };
      }
      updated[currentExerciseIdx] = sets;
      return updated;
    });
    if (sessionId && currentExercise) {
      const set = setStates[currentExerciseIdx]?.[setIdx];
      if (set?.completed) {
        const fields: Parameters<typeof updateSetLog>[3] = {};
        if (field === 'reps') fields.reps = parseInt(value) || 0;
        else if (field === 'weight') fields.weight = value ? parseFloat(value) : null;
        else fields.notes = value || null;
        void updateSetLog(sessionId, currentExercise.exercise_id, setIdx + 1, fields);
      }
    }
  };

  const handleSetTypeChange = (setIdx: number, setType: SetType) => {
    setSetStates((prev) => {
      const updated = { ...prev };
      const sets = [...(updated[currentExerciseIdx] ?? [])];
      sets[setIdx] = { ...sets[setIdx], setType };
      updated[currentExerciseIdx] = sets;
      return updated;
    });
    if (sessionId && currentExercise) {
      const set = setStates[currentExerciseIdx]?.[setIdx];
      if (set?.completed) {
        void updateSetLog(sessionId, currentExercise.exercise_id, setIdx + 1, { set_type: setType });
      }
    }
  };

  const handleRirChange = (setIdx: number, rir: number | null) => {
    setSetStates((prev) => {
      const updated = { ...prev };
      const sets = [...(updated[currentExerciseIdx] ?? [])];
      sets[setIdx] = { ...sets[setIdx], rir };
      updated[currentExerciseIdx] = sets;
      return updated;
    });
    if (sessionId && currentExercise) {
      const set = setStates[currentExerciseIdx]?.[setIdx];
      if (set?.completed) {
        void updateSetLog(sessionId, currentExercise.exercise_id, setIdx + 1, { rir });
      }
    }
  };

  const handleAddSet = () => {
    setSetStates((prev) => {
      const updated = { ...prev };
      const sets = [...(updated[currentExerciseIdx] ?? [])];
      const lastSet = sets[sets.length - 1];
      sets.push({
        completed: false,
        reps: 0,
        weight: lastSet?.weight ?? '',
        setType: 'working',
        rir: null,
        notes: '',
      });
      updated[currentExerciseIdx] = sets;
      return updated;
    });
  };

  const handleAddExerciseToWorkout = (ex: Exercise) => {
    const newIdx = exercises.length;
    const newPlanExercise: WorkoutPlanExercise = {
      id: `adhoc-${ex.id}-${Date.now()}`,
      plan_id: '',
      exercise_id: ex.id,
      exercise_order: newIdx,
      sets: 3,
      reps: '10',
      rest_seconds: 60,
      exercise: ex,
    };
    setExercises((prev) => [...prev, newPlanExercise]);
    setSetStates((prev) => ({
      ...prev,
      [newIdx]: Array.from({ length: 3 }, (_, idx) => ({
        completed: false,
        reps: 0,
        weight: '',
        setType: idx === 0 ? 'warm_up' as SetType : 'working' as SetType,
        rir: null,
        notes: '',
      })),
    }));
    setShowExercisePicker(false);
    setExerciseSearch('');
    setCurrentExerciseIdx(newIdx);
  };

  const loadExercisePicker = async () => {
    if (allExercises.length === 0) {
      try {
        const ex = await fetchExercises();
        setAllExercises(ex);
      } catch {
        // non-critical
      }
    }
    setShowExercisePicker(true);
  };

  const filteredPickerExercises = allExercises.filter((e) =>
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  ).slice(0, 30);

  const handleFinish = async () => {
    if (!sessionId) return;
    setCompleting(true);
    const { error: finishError } = await completeWorkoutSession(
      sessionId,
      elapsedSeconds,
      totalSets,
      totalReps,
      exercisesCompleted,
      // Recorded so the coaches and the Recovery Doctor know this session was deliberately shortened.
      fitted ? `${SHORT_ON_TIME_PREFIX} fitted to ${fitted.target} min. ${fitted.summary}`.slice(0, 500) : undefined,
      totalVolume
    );
    if (finishError) {
      setCompleting(false);
      setError(finishError);
      return;
    }
    onComplete(sessionId);
  };

  const canFinish = totalSets > 0;

  const startedIdx = new Set(Object.entries(setStates).filter(([, sets]) => sets.some((x) => x.completed)).map(([i]) => Number(i)));

  /** Swap in a new list of exercises, keeping what was already logged for the ones that stay. */
  const replaceRows = (next: WorkoutPlanExercise[]) => {
    const oldIndex = new Map(exercises.map((r, i) => [r.id, i]));
    const states: Record<number, SetState[]> = {};
    next.forEach((r, i) => {
      const old = oldIndex.get(r.id);
      const prev = old != null ? setStates[old] : undefined;
      if (prev && prev.some((x) => x.completed)) states[i] = prev;
      else states[i] = freshSets(r.sets);
    });
    const current = exercises[currentExerciseIdx]?.id;
    setExercises(next);
    setSetStates(states);
    const ni = next.findIndex((r) => r.id === current);
    setCurrentExerciseIdx(ni >= 0 ? ni : 0);
  };

  const handleApplyFit = (result: FitResult) => {
    const original = fitted?.original ?? exercises;
    const { rows: next, pairs: p } = applyFit(exercises, result);
    replaceRows(next);
    setPairs(p);
    const summary = [result.removed.length ? `Left out: ${result.removed.map((r) => r.name).join(', ')}.` : '', result.setsCut.length ? `Fewer sets: ${result.setsCut.map((c) => `${c.name} ${c.from}→${c.to}`).join(', ')}.` : ''].filter(Boolean).join(' ');
    setFitted({ target: result.target, original, summary });
    setShowTimeFit(false);
  };

  const handleUndoFit = () => {
    if (!fitted) return;
    replaceRows(fitted.original);
    setPairs({});
    setFitted(null);
  };

  const currentPair = currentExercise ? pairs[currentExercise.id] : undefined;

  if (loading) return <div className="px-5 pt-12"><LoadingState label="Preparing workout..." /></div>;
  if (error) return <ErrorState message={error} onRetry={onBack} />;

  if (showExercisePicker) {
    return (
      <div className="min-h-screen bg-ink-bg flex flex-col pb-4">
        <div className="px-5 pt-6 pb-4 flex items-center gap-3">
          <button
            onClick={() => setShowExercisePicker(false)}
            className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-display-sm text-cloud font-semibold">Add Exercise</h2>
        </div>
        <div className="px-5 mb-4">
          <input
            type="text"
            value={exerciseSearch}
            onChange={(e) => setExerciseSearch(e.target.value)}
            placeholder="Search 1400+ exercises..."
            className="w-full bg-ink-elevated border border-ink-border rounded-xl px-4 py-3 text-sm text-cloud placeholder:text-cloud-dim/50 focus:outline-none focus:border-lime/50"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 space-y-2">
          {filteredPickerExercises.map((ex) => (
            <button
              key={ex.id}
              onClick={() => handleAddExerciseToWorkout(ex)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-ink-surface border border-ink-border hover:border-lime/30 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-lime/10 flex items-center justify-center flex-shrink-0">
                <Dumbbell className="w-5 h-5 text-lime" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-cloud truncate">{ex.name}</p>
                <p className="text-[10px] text-cloud-dim">{ex.primary_muscle} · {ex.equipment}</p>
              </div>
              <Plus className="w-4 h-4 text-lime flex-shrink-0" />
            </button>
          ))}
          {filteredPickerExercises.length === 0 && (
            <p className="text-sm text-cloud-dim text-center py-8">No exercises found.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-bg flex flex-col pb-4">
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <button
          onClick={() => setShowExitConfirm(true)}
          className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-rust transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', paused ? 'bg-gold' : 'bg-lime animate-pulse')} />
          <span className="text-sm font-mono text-cloud tabular-nums">{formatDuration(elapsedSeconds)}</span>
        </div>
        <div className="flex items-center gap-2">
          {audio.enabled && (
            <button
              onClick={audio.toggleMute}
              className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-colors', audio.muted ? 'bg-ink-elevated text-cloud-dim' : 'bg-lime/10 text-lime')}
              aria-label={audio.muted ? 'Unmute audio coach' : 'Mute audio coach'}
            >
              {audio.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={() => audio.enabled ? audio.disable() : audio.enable()}
            className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-colors', audio.enabled ? 'bg-lime/10 text-lime' : 'bg-ink-elevated text-cloud-dim')}
            aria-label={audio.enabled ? 'Disable audio coach' : 'Enable audio coach'}
          >
            <Headphones className="w-5 h-5" />
          </button>
          <button
            onClick={() => setPaused(!paused)}
            className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
          >
            {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {coachDeload ? (
        <div className="mx-5 mb-3 rounded-xl border border-gold/40 bg-gold/10 p-3" data-testid="coach-deload-banner">
          <p className="text-[11px] font-bold text-gold">{tr('recplan.deloadWorkout', { pct: coachDeload.pct, end: shortDate(coachDeload.end, uiLang) })}</p>
          {coachDeload.note && <p className="mt-1 whitespace-pre-line text-[11px] text-cloud" dir="auto">{coachDeload.note}</p>}
        </div>
      ) : <DeloadBanner />}
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          {dayLabel ? <p className="text-xs font-semibold text-lime">{dayLabel}</p> : <span />}
          {(exercises.length > 1 || fitted) && (fitted ? (
            <button onClick={handleUndoFit} className="flex items-center gap-1 rounded-full bg-ink-elevated px-2.5 py-1 text-[11px] font-semibold text-cloud-dim" data-testid="undo-fit">
              <Clock className="w-3 h-3 text-lime" /> Fitted to {fitted.target} min · <Undo2 className="w-3 h-3" /> Undo
            </button>
          ) : (
            <button onClick={() => setShowTimeFit(true)} className="flex items-center gap-1 rounded-full bg-lime/10 px-2.5 py-1 text-[11px] font-semibold text-lime" data-testid="open-time-fit">
              <Clock className="w-3 h-3" /> Short on time?
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-cloud-dim">{currentExerciseIdx + 1} of {exercises.length} exercises</span>
          <span className="text-xs text-cloud-dim">{totalSets} / {totalSetsPossible} sets</span>
        </div>
        <div className="h-2 bg-ink-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-lime-gradient rounded-full transition-all duration-500"
            style={{ width: `${totalSetsPossible > 0 ? (totalSets / totalSetsPossible) * 100 : 0}%` }}
          />
        </div>
        {totalVolume > 0 && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-cloud-dim">Total volume</span>
            <span className="text-sm font-bold text-lime tabular-nums">{Math.round(totalVolume).toLocaleString()} kg</span>
          </div>
        )}
      </div>

      {restTimer.active && (
        <div className="px-5 mb-4 animate-slide-down">
          <div className="flex items-center justify-between p-4 rounded-xl2 bg-lime/10 border border-lime/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lime/20 flex items-center justify-center">
                <Timer className="w-5 h-5 text-lime" />
              </div>
              <div>
                <p className="text-xs text-lime font-medium">Rest Timer</p>
                <p className="text-lg font-bold text-cloud font-mono tabular-nums">{formatDuration(restTimer.remaining)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRestTimer((prev) => ({ ...prev, remaining: prev.remaining + 15 }))}
                className="px-3 py-1.5 rounded-lg bg-ink-elevated text-xs text-cloud font-medium"
              >
                +15s
              </button>
              <button
                onClick={() => setRestTimer({ active: false, remaining: 0, total: 0 })}
                className="px-3 py-1.5 rounded-lg bg-ink-elevated text-xs text-cloud-dim font-medium"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 px-5 overflow-y-auto">
        <div className="mb-4">
          {/* Exercise Carousel */}
          {exercises.length > 0 && (
            <div className="mb-4 -mx-5 px-5">
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
                {exercises.map((ex, i) => {
                  const isCurrent = i === currentExerciseIdx;
                  const isDone = setStates[i]?.length > 0 && setStates[i]?.every((s) => s.completed);
                  const isPartial = setStates[i]?.some((s) => s.completed) && !isDone;
                  return (
                    <button
                      key={ex.id}
                      onClick={() => setCurrentExerciseIdx(i)}
                      className={cn(
                        'flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-xs font-bold transition-all relative',
                        isCurrent ? 'bg-lime text-ink-bg ring-2 ring-lime/30' : 'bg-ink-elevated text-cloud-dim'
                      )}
                    >
                      {isDone ? <Check className="w-5 h-5" /> : i + 1}
                      {isPartial && !isDone && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-gold border-2 border-ink-bg" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-lime/10 flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-lime" />
              </div>
              <h2 className="text-display-sm text-cloud font-semibold mb-2">Empty Workout</h2>
              <p className="text-sm text-cloud-dim text-center max-w-xs mb-6">
                Add exercises to start logging your sets, reps, and volume.
              </p>
              <Button onClick={loadExercisePicker} size="lg">
                <Plus className="w-4 h-4" />
                Add Exercise
              </Button>
            </div>
          ) : currentExercise ? (
            <>
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell className="w-5 h-5 text-lime" />
            <h2 className="text-display-sm text-cloud font-semibold">{currentExercise.exercise?.name}</h2>
          </div>
          {currentPair && (
            <button
              onClick={() => { const i = exercises.findIndex((r) => r.id === currentPair.partnerId); if (i >= 0) setCurrentExerciseIdx(i); }}
              className="mb-3 flex w-full items-center gap-2 rounded-xl border border-sky/30 bg-sky/10 px-3 py-2 text-left"
              data-testid="superset-banner"
            >
              <Link2 className="w-4 h-4 text-sky flex-shrink-0" />
              <span className="text-[11px] text-cloud">
                <b className="text-sky">Superset {currentPair.label}</b> with {currentPair.partnerName}: {currentPair.label.endsWith('1') ? 'after each set, go straight to it, then rest.' : 'rest after this one, then back to the first.'}
              </span>
            </button>
          )}

          {currentExercise.exercise && (
            <div className="mb-4">
              <AnatomyViewer
                exerciseName={currentExercise.exercise.name}
                primaryMuscle={currentExercise.exercise.primary_muscle}
                secondaryMuscles={(currentExercise.exercise.secondary_muscles ?? []).filter(Boolean) as string[]}
                imageUrl={currentExercise.exercise.image_url}
              />
            </div>
          )}

          {(currentExercise.tempo || currentExercise.rir_target != null || currentExercise.notes || currentExercise.alt_exercise_id) && (
            <CoachPrescription row={currentExercise} />
          )}

          <Card className="p-4 mb-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xs text-cloud-dim mb-1">Sets</p>
                <p className="text-lg font-bold text-cloud">{currentSets.length}</p>
              </div>
              <div>
                <p className="text-xs text-cloud-dim mb-1">Reps</p>
                <p className="text-lg font-bold text-cloud">{currentExercise.reps}</p>
              </div>
              <div>
                <p className="text-xs text-cloud-dim mb-1">Rest</p>
                <p className="text-lg font-bold text-cloud">{currentExercise.rest_seconds}s</p>
              </div>
              <div>
                <p className="text-xs text-cloud-dim mb-1">Volume</p>
                <p className="text-lg font-bold text-lime tabular-nums">
                  {Math.round(currentSets.filter(s => s.completed).reduce((sum, s) => sum + (s.reps * (parseFloat(s.weight) || 0)), 0)).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>

          {/* Set Tracking */}
          <div className="flex flex-col gap-2.5 mb-4">
            {currentSets.map((set, setIdx) => (
              <Card
                key={setIdx}
                className={cn('p-3 transition-all', set.completed && 'border-lime/30')}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                    set.completed ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim'
                  )}>
                    {setIdx + 1}
                  </div>

                  <button
                    onClick={() => handleSetTypeChange(setIdx, SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(set.setType) + 1) % SET_TYPE_ORDER.length])}
                    className={cn(
                      'px-2 py-1.5 rounded-lg text-[10px] font-semibold flex-shrink-0 transition-colors',
                      SET_TYPE_COLORS[set.setType]
                    )}
                  >
                    {SET_TYPE_LABELS[set.setType]}
                  </button>

                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-cloud-dim">Reps</label>
                      <input
                        type="number"
                        value={set.reps || ''}
                        onChange={(e) => handleSetEdit(setIdx, 'reps', e.target.value)}
                        placeholder={currentExercise.reps}
                        className="w-full bg-ink-elevated rounded-lg px-2 py-1.5 text-sm text-cloud text-center focus:outline-none focus:border-lime/50 border border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-cloud-dim">Weight (kg)</label>
                      <input
                        type="text"
                        value={set.weight}
                        onChange={(e) => handleSetEdit(setIdx, 'weight', e.target.value)}
                        placeholder="0"
                        inputMode="decimal"
                        className="w-full bg-ink-elevated rounded-lg px-2 py-1.5 text-sm text-cloud text-center focus:outline-none focus:border-lime/50 border border-transparent"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleSetToggle(setIdx)}
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 flex-shrink-0',
                      set.completed ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim hover:text-lime'
                    )}
                  >
                    <Check className="w-5 h-5" strokeWidth={3} />
                  </button>
                </div>

                {/* Expandable detail row: RIR + Notes */}
                <button
                  onClick={() => setExpandedSet(expandedSet === setIdx ? null : setIdx)}
                  className="mt-2 flex items-center gap-1.5 text-[10px] text-cloud-dim hover:text-cloud transition-colors w-full"
                >
                  {expandedSet === setIdx ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {set.rir !== null ? `RIR: ${set.rir}` : 'RIR: —'}
                  {set.notes && <span className="truncate">· {set.notes}</span>}
                </button>
                {expandedSet === setIdx && (
                  <div className="mt-2 space-y-2 animate-slide-down">
                    <div>
                      <label className="text-[10px] text-cloud-dim mb-1 block">Reps in Reserve (RIR)</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {RIR_OPTIONS.map((opt) => (
                          <button
                            key={opt === null ? 'null' : String(opt)}
                            onClick={() => handleRirChange(setIdx, opt)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors',
                              set.rir === opt
                                ? 'bg-lime text-ink-bg'
                                : 'bg-ink-elevated text-cloud-dim hover:text-cloud'
                            )}
                          >
                            {opt === null ? '—' : opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-cloud-dim mb-1 block flex items-center gap-1">
                        <StickyNote className="w-3 h-3" /> Set Notes
                      </label>
                      <textarea
                        value={set.notes}
                        onChange={(e) => handleSetEdit(setIdx, 'notes', e.target.value)}
                        placeholder="How did this set feel?"
                        rows={2}
                        className="w-full bg-ink-elevated rounded-lg px-2.5 py-2 text-xs text-cloud placeholder:text-cloud-dim/40 resize-none focus:outline-none focus:border-lime/30 border border-transparent"
                      />
                    </div>
                  </div>
                )}
              </Card>
            ))}

            {/* Add Set Button */}
            <button
              onClick={handleAddSet}
              className="flex items-center justify-center gap-2 p-3 rounded-xl2 bg-ink-surface border border-dashed border-ink-border text-sm text-cloud-dim hover:text-lime hover:border-lime/30 transition-colors w-full"
            >
              <Plus className="w-4 h-4" />
              Add Set
            </button>
          </div>

          {/* Exercise Navigation + Add Exercise */}
          <div className="flex gap-3 mb-4">
            <Button
              variant="outline"
              onClick={() => setCurrentExerciseIdx((i) => Math.max(0, i - 1))}
              disabled={currentExerciseIdx === 0}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={loadExercisePicker}
              className="flex-1"
            >
              <Plus className="w-4 h-4" />
              Add Exercise
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const nextIdx = Math.min(exercises.length - 1, currentExerciseIdx + 1);
                if (nextIdx !== currentExerciseIdx) {
                  setCurrentExerciseIdx(nextIdx);
                  const nextEx = exercises[nextIdx];
                  audio.speak(`Next exercise: ${nextEx.exercise?.name ?? ''}. ${nextEx.sets} sets of ${nextEx.reps}.`, { interrupt: true });
                }
              }}
              disabled={currentExerciseIdx === exercises.length - 1}
              className="flex-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <button
            onClick={() => setExpandedExercise(expandedExercise === null ? -1 : null)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-ink-elevated text-sm text-cloud-dim"
          >
            <span>Exercise List</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', expandedExercise !== null && 'rotate-180')} />
          </button>
          {expandedExercise !== null && (
            <div className="flex flex-col gap-1.5 mt-2 animate-slide-down">
              {exercises.map((ex, i) => (
                <button
                  key={ex.id}
                  onClick={() => setCurrentExerciseIdx(i)}
                  className={cn(
                    'flex items-center gap-3 p-2.5 rounded-lg text-left transition-all',
                    i === currentExerciseIdx ? 'bg-lime/10 text-lime' : 'bg-ink-surface text-cloud-dim'
                  )}
                >
                  <div className={cn('w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold', i === currentExerciseIdx ? 'bg-lime text-ink-bg' : 'bg-ink-elevated')}>
                    {i + 1}
                  </div>
                  <span className="text-sm flex-1 truncate">{ex.exercise?.name}</span>
                  {setStates[i]?.every((s) => s.completed) && <Check className="w-4 h-4 text-lime" />}
                </button>
              ))}
            </div>
          )}
        </>
          ) : null}
        </div>
      </div>

      <div className="px-5 pt-3 border-t border-ink-border safe-bottom space-y-2">
        {canFinish && (
          <p className="text-center text-[11px] text-cloud-dim">
            {totalSets} of {totalSetsPossible} sets completed
            {totalVolume > 0 && ` · ${Math.round(totalVolume).toLocaleString()} kg volume`}
          </p>
        )}
        <Button
          size="lg"
          onClick={handleFinish}
          loading={completing}
          disabled={!canFinish}
          className="w-full"
        >
          <Check className="w-5 h-5" strokeWidth={3} />
          Save & Complete Workout
        </Button>
        {!canFinish && (
          <p className="text-center text-[11px] text-cloud-dim">Complete at least one set to save your workout.</p>
        )}
      </div>

      {showTimeFit && <TimeFitSheet rows={exercises} startedIdx={startedIdx} onClose={() => setShowTimeFit(false)} onApply={handleApplyFit} />}

      <ConfirmDialog
        open={showExitConfirm}
        title="Exit workout?"
        message="Your logged sets will be saved, but this workout will be marked as incomplete. Are you sure you want to exit?"
        confirmLabel="Exit"
        variant="destructive"
        onConfirm={() => { if (sessionId) { void abandonWorkoutSession(sessionId); } onBack(); }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
}

/** The coach's deload for today, if one is running. */
async function coachDeloadToday(): Promise<{ pct: number; end: string; note: string | null } | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const plan = await loadRecoveryPlan(data.user.id);
  const st = deloadState(plan, localDateKey(new Date()));
  return st.kind === 'active' ? { pct: st.pct, end: st.end, note: plan?.deload_note ?? null } : null;
}

/** Supersets the coach set with a group letter: consecutive exercises with the same letter become A1/A2. */
function coachSupersets(rows: WorkoutPlanExercise[]): Record<string, PairInfo> {
  const out: Record<string, PairInfo> = {};
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (!a.group_label || a.group_label !== b.group_label || out[a.id] || out[b.id]) continue;
    out[a.id] = { label: `${a.group_label}1`, partnerId: b.id, partnerName: b.exercise?.name ?? '' };
    out[b.id] = { label: `${a.group_label}2`, partnerId: a.id, partnerName: a.exercise?.name ?? '' };
  }
  return out;
}

/** The coach's prescription for this exercise: target effort, tempo, cue and the alternative if needed. */
function CoachPrescription({ row }: { row: WorkoutPlanExercise }) {
  const { t } = useI18n();
  const [alt, setAlt] = useState<string | null>(null);
  useEffect(() => {
    if (!row.alt_exercise_id) { setAlt(null); return; }
    fetchExercisesByIds([row.alt_exercise_id]).then((x) => setAlt(x[0]?.name ?? null)).catch(() => setAlt(null));
  }, [row.alt_exercise_id]);
  return (
    <div className="mb-4 rounded-2xl border border-gold/30 bg-gold/[0.06] p-3 text-xs" data-testid="coach-prescription">
      <div className="mb-1 font-semibold text-gold">{t('coach.prescriptionTitle')}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-cloud" dir="ltr">
        {row.rir_target != null && <span>RIR {row.rir_target}</span>}
        {row.tempo && <span>{t('coach.tempo')} {row.tempo}</span>}
      </div>
      {row.notes && <p className="mt-1 text-cloud" dir="auto">{row.notes}</p>}
      {alt && <p className="mt-1 text-cloud-dim" dir="auto">{t('coach.alternative')}: {alt}</p>}
      {row.tempo && <p className="mt-1 text-[10px] text-cloud-muted">{t('coach.tempoHelp')}</p>}
    </div>
  );
}
