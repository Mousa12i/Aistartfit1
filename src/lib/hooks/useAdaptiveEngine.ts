import { useState, useCallback, useEffect } from 'react';
import { fetchUserSessions, fetchSessionSetLogs } from '@/lib/data';
import type { WorkoutSession, WorkoutSetLog } from '@/lib/types';

export interface Recommendation {
  id: string;
  exerciseId: string;
  exerciseName: string;
  type: 'increase_weight' | 'increase_reps' | 'reduce_weight';
  from: number;
  to: number;
  unit: string;
  reason: string;
  status: 'recommended' | 'applied' | 'dismissed';
  createdAt: string;
}

export interface SessionAnalysis {
  sessionId: string;
  recommendations: Recommendation[];
}

export function useAdaptiveEngine() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUserSessions(20);
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const analyzeSession = useCallback(
    async (sessionId: string): Promise<Recommendation[]> => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return [];

      const logs = await fetchSessionSetLogs(sessionId);
      const exerciseLogs = groupLogsByExercise(logs);
      const newRecs: Recommendation[] = [];

      for (const [exerciseId, exLogs] of Object.entries(exerciseLogs)) {
        const rec = analyzeExerciseLogs(exerciseId, exLogs, sessions);
        if (rec) newRecs.push(rec);
      }

      setRecommendations((prev) => {
        const existing = prev.filter((r) => !newRecs.some((nr) => nr.exerciseId === r.exerciseId));
        return [...newRecs, ...existing];
      });

      return newRecs;
    },
    [sessions]
  );

  const dismissRecommendation = useCallback((id: string) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'dismissed' } : r))
    );
  }, []);

  const applyRecommendation = useCallback((id: string) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'applied' } : r))
    );
  }, []);

  const activeRecommendations = recommendations.filter((r) => r.status === 'recommended');

  return {
    sessions,
    recommendations: activeRecommendations,
    allRecommendations: recommendations,
    loading,
    analyzeSession,
    dismissRecommendation,
    applyRecommendation,
    refresh: loadSessions,
  };
}

function groupLogsByExercise(logs: WorkoutSetLog[]): Record<string, WorkoutSetLog[]> {
  const groups: Record<string, WorkoutSetLog[]> = {};
  for (const log of logs) {
    if (!groups[log.exercise_id]) groups[log.exercise_id] = [];
    groups[log.exercise_id].push(log);
  }
  return groups;
}

function analyzeExerciseLogs(
  exerciseId: string,
  logs: WorkoutSetLog[],
  allSessions: WorkoutSession[]
): Recommendation | null {
  const completedLogs = logs.filter((l) => l.completed);
  if (completedLogs.length === 0) return null;

  const exerciseName = completedLogs[0]?.exercise_name ?? 'Unknown';
  const maxWeight = Math.max(...completedLogs.map((l) => l.weight ?? 0));

  // Need at least 2 sessions of history for this exercise
  const exerciseSessions = allSessions.filter((s) =>
    s.exercises_completed > 0
  );
  if (exerciseSessions.length < 2) return null;

  // Check if all sets hit target reps (assuming target is the mode of reps logged)
  const repCounts = completedLogs.map((l) => l.reps);
  const targetReps = repCounts[0] ?? 10;
  const allHitTarget = completedLogs.every((l) => l.reps >= targetReps);

  if (allHitTarget && maxWeight > 0) {
    // Recommend weight increase — 2.5% round to nearest 0.5
    const increase = Math.max(1, Math.round(maxWeight * 0.025 * 2) / 2);
    const newWeight = Math.round((maxWeight + increase) * 2) / 2;
    return {
      id: `rec_${exerciseId}_${Date.now()}`,
      exerciseId,
      exerciseName,
      type: 'increase_weight',
      from: maxWeight,
      to: newWeight,
      unit: 'kg',
      reason: `You hit every target rep on all sets in your last ${exerciseName} sessions. Time to increase the weight.`,
      status: 'recommended',
      createdAt: new Date().toISOString(),
    };
  }

  // Check if reps were missed consistently
  const missedReps = completedLogs.some((l) => l.reps < targetReps);
  if (missedReps && maxWeight > 0) {
    const reducedWeight = Math.round(maxWeight * 0.95 * 2) / 2;
    if (reducedWeight < maxWeight) {
      return {
        id: `rec_${exerciseId}_${Date.now()}`,
        exerciseId,
        exerciseName,
        type: 'reduce_weight',
        from: maxWeight,
        to: reducedWeight,
        unit: 'kg',
        reason: `You missed target reps in your last ${exerciseName} sessions at this load. Consider reducing the weight.`,
        status: 'recommended',
        createdAt: new Date().toISOString(),
      };
    }
  }

  return null;
}

// Helper: calculate training volume for a session
export function calculateVolume(logs: WorkoutSetLog[]): number {
  return logs
    .filter((l) => l.completed)
    .reduce((sum, l) => sum + (l.weight ?? 0) * l.reps, 0);
}

// Helper: estimate session duration from start/completion
export function sessionDuration(session: WorkoutSession): number {
  if (!session.completed_at) return session.duration_seconds;
  const start = new Date(session.started_at).getTime();
  const end = new Date(session.completed_at).getTime();
  return Math.round((end - start) / 1000);
}
