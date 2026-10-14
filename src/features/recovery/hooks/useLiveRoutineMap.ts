import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  plannedSetsByMuscle,
  unmappedExercises,
  plannedVsDone,
  type WorkoutPlan,
  type PlannedExercise,
  type DoneExerciseState,
} from '../engine/routineMuscles';
import type { RecoveryMuscle } from '@/lib/recovery/muscles';
import { COARSE_TO_FINE } from '@/lib/recovery/muscles';

export interface LiveRoutineMapResult {
  plans: WorkoutPlan[];
  plannedMap: ReturnType<typeof plannedSetsByMuscle>;
  comparison: ReturnType<typeof plannedVsDone>;
  unmapped: ReturnType<typeof unmappedExercises>;
  loading: boolean;
  error: string | null;
  lastUpdatedAt: Date;
  liveConnected: boolean;
  refresh: () => Promise<void>;
}

export function useLiveRoutineMap(): LiveRoutineMapResult {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [doneStates, setDoneStates] = useState<Record<string, DoneExerciseState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());
  const [liveConnected, setLiveConnected] = useState(false);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Fetch assigned plans (may be empty)
      const { data: assignments, error: assignError } = await supabase
        .from('user_plan_assignments')
        .select('plan_id')
        .eq('user_id', user.id)
        .is('completed_at', null);
      if (assignError) throw assignError;

      const assignedPlanIds = (assignments ?? []).map((a) => a.plan_id);

      // Fetch plan exercises for assigned plans
      let plansWithExercises: WorkoutPlan[] = [];
      let planExerciseIds: string[] = [];

      if (assignedPlanIds.length > 0) {
        const { data: planRows, error: planError } = await supabase
          .from('workout_plans')
          .select('id, name')
          .in('id', assignedPlanIds);
        if (planError) throw planError;

        const { data: planExercises, error: peError } = await supabase
          .from('workout_plan_exercises')
          .select('plan_id, exercise_id, sets, reps')
          .in('plan_id', assignedPlanIds)
          .order('exercise_order');
        if (peError) throw peError;

        planExerciseIds = [...new Set((planExercises ?? []).map((pe) => pe.exercise_id))];
        let planExerciseRows: { id: string; name: string; primary_muscle: string; secondary_muscles: string[] | null }[] = [];
        if (planExerciseIds.length > 0) {
          const { data, error: exErr } = await supabase.from('exercises').select('id, name, primary_muscle, secondary_muscles').in('id', planExerciseIds);
          if (exErr) throw exErr;
          planExerciseRows = data ?? [];
        }

        const planExerciseById = new Map((planExerciseRows ?? []).map((e) => [e.id, e]));
        plansWithExercises = (planRows ?? []).map((plan) => ({
          id: plan.id,
          name: plan.name,
          exercises: (planExercises ?? [])
            .filter((pe) => pe.plan_id === plan.id)
            .map((pe) => {
              const ex = planExerciseById.get(pe.exercise_id);
              return {
                exercise_id: pe.exercise_id,
                exercise_name: ex?.name ?? 'Unknown Exercise',
                sets: pe.sets,
                primary_muscle: ex?.primary_muscle ?? '',
                secondary_muscles: (ex?.secondary_muscles as string[]) ?? [],
              } as PlannedExercise;
            }),
        }));
      }
      setPlans(plansWithExercises);

      // Fetch ALL completed workout sessions (independent of plan assignments)
      const { data: sessions, error: sessionError } = await supabase
        .from('workout_sessions')
        .select('id, completed_at, started_at')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(100);
      if (sessionError) throw sessionError;

      const sessionIds = (sessions ?? []).map((s) => s.id);
      let doneMap: Record<string, DoneExerciseState> = {};

      if (sessionIds.length > 0) {
        const { data: setLogs, error: logError } = await supabase
          .from('workout_set_logs')
          .select('exercise_id, completed, session_id')
          .in('session_id', sessionIds)
          .eq('completed', true);
        if (logError) throw logError;

        const sessionDateById = new Map((sessions ?? []).map((s) => [s.id, s.completed_at ?? s.started_at]));

        const exerciseLastDone = new Map<string, { lastDoneAt: string; sessionDate: string }>();
        for (const log of setLogs ?? []) {
          const sessionDate = sessionDateById.get(log.session_id);
          if (!sessionDate) continue;
          const existing = exerciseLastDone.get(log.exercise_id);
          if (!existing || new Date(sessionDate) > new Date(existing.sessionDate)) {
            exerciseLastDone.set(log.exercise_id, { lastDoneAt: sessionDate, sessionDate });
          }
        }

        // Fetch muscle mappings for ALL exercises that appear in set logs (not just plan exercises)
        const allExerciseIds = [...new Set([...exerciseLastDone.keys(), ...planExerciseIds])];
        let allExerciseRows: { id: string; name: string; primary_muscle: string; secondary_muscles: string[] | null }[] = [];
        if (allExerciseIds.length > 0) {
          const { data, error: exErr } = await supabase.from('exercises').select('id, name, primary_muscle, secondary_muscles').in('id', allExerciseIds);
          if (exErr) throw exErr;
          allExerciseRows = data ?? [];
        }

        const exerciseMuscleById = new Map<string, string[]>();
        for (const ex of allExerciseRows ?? []) {
          const coarse = ex.primary_muscle;
          const fineMuscles = COARSE_TO_FINE[coarse] ?? [];
          if (fineMuscles.length > 0) exerciseMuscleById.set(ex.id, fineMuscles);
        }

        doneMap = {};
        for (const [exerciseId, done] of exerciseLastDone) {
          const fineMuscles = exerciseMuscleById.get(exerciseId);
          if (!fineMuscles) continue;
          for (const fine of fineMuscles) {
            const existing = doneMap[fine];
            if (!existing || !existing.lastDoneAt || new Date(done.lastDoneAt) > new Date(existing.lastDoneAt)) {
              doneMap[fine as RecoveryMuscle] = { lastDoneAt: done.lastDoneAt, lastSessionDate: done.sessionDate };
            }
          }
        }
      }
      setDoneStates(doneMap);
      setLastUpdatedAt(new Date());
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load recovery data');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchData();

    const channel = supabase
      .channel('recovery_live_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_plan_assignments' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_plan_exercises' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_sessions' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_set_logs' }, () => void fetchData())
      .subscribe((status) => {
        if (mountedRef.current) setLiveConnected(status === 'SUBSCRIBED');
      });

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const plannedMap = plannedSetsByMuscle(plans);
  const unmapped = unmappedExercises(plans);
  const comparison = plannedVsDone(plannedMap, doneStates);

  return {
    plans,
    plannedMap,
    comparison,
    unmapped,
    loading,
    error,
    lastUpdatedAt,
    liveConnected,
    refresh: fetchData,
  };
}
