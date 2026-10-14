import type { RecoveryMuscle } from './muscles';
import { BASE_RECOVERY_HOURS, COARSE_TO_FINE, DEFAULT_PRIMARY_CONTRIBUTION, DEFAULT_SECONDARY_CONTRIBUTION } from './muscles';

export interface MuscleContribution {
  muscle: RecoveryMuscle;
  contribution: number;
}

export interface ExerciseMuscleMapping {
  exerciseId: string;
  exerciseName: string;
  muscles: MuscleContribution[];
}

/**
 * Maps an exercise's coarse primary_muscle and secondary_muscles to fine-grained recovery muscles.
 * Primary muscles get contribution 1.0, secondary 0.5.
 */
export function mapExerciseToMuscles(
  exerciseId: string,
  exerciseName: string,
  primaryMuscle: string,
  secondaryMuscles: string[] | null
): ExerciseMuscleMapping {
  const muscles: MuscleContribution[] = [];
  const primaryFine = COARSE_TO_FINE[primaryMuscle] ?? [];
  for (const m of primaryFine) {
    muscles.push({ muscle: m, contribution: DEFAULT_PRIMARY_CONTRIBUTION });
  }
  for (const sm of secondaryMuscles ?? []) {
    const fine = COARSE_TO_FINE[sm] ?? [];
    for (const m of fine) {
      if (!muscles.some((mc) => mc.muscle === m)) {
        muscles.push({ muscle: m, contribution: DEFAULT_SECONDARY_CONTRIBUTION });
      }
    }
  }
  return { exerciseId, exerciseName, muscles };
}

export function mapExerciseFromPersistedMuscles(
  exerciseId: string,
  exerciseName: string,
  persistedMuscles: MuscleContribution[]
): ExerciseMuscleMapping {
  return { exerciseId, exerciseName, muscles: persistedMuscles };
}

export interface SetLogForRecovery {
  exercise_id: string;
  exercise_name: string;
  set_type: string | null;
  rir: number | null;
  weight: number | null;
  reps: number;
  completed: boolean;
  session_id: string;
  session_completed_at: string | null;
}

export interface MuscleRecoveryState {
  muscle: RecoveryMuscle;
  recoveryPercent: number | null;
  hoursSinceLastTrained: number | null;
  hoursNeeded: number;
  status: 'no_data' | 'red' | 'orange' | 'green';
  lastTrainedDate: string | null;
  weeklyEffectiveSets: number;
  weeklySetBand: 'low' | 'efficient' | 'productive' | 'diminishing';
  sessionEffectiveSets: number;
  hasSessionVolumeWarning: boolean;
  personalMultiplier: number;
  modifiers: {
    rirExtra: number;
    volumeExtra: number;
    sorenessExtra: number;
    sleepMultiplier: number;
    personalMultiplier: number;
  };
}

export interface SorenessEntry {
  muscle: RecoveryMuscle;
  score: number;
  recordedAt: string;
}

export interface SleepEntry {
  date: string;
  sleepHours: number;
}

export interface RecoveryInput {
  setLogs: SetLogForRecovery[];
  exerciseMappings: Map<string, ExerciseMuscleMapping>;
  soreness: SorenessEntry[];
  sleep: SleepEntry[];
  personalMultipliers: Record<string, number>;
  now: Date;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function computeMuscleRecovery(input: RecoveryInput): MuscleRecoveryState[] {
  const { setLogs, exerciseMappings, soreness, sleep, personalMultipliers, now } = input;

  const sevenDaysAgo = now.getTime() - WEEK_MS;

  // Group sets by muscle — only working sets (exclude warm_up), only completed
  const muscleSets: Record<string, {
    sessionSets: Map<string, number>;
    lowRirBySession: Map<string, number>;
    lastTrainedAt: number | null;
    lastSessionId: string | null;
    weeklySets: number;
  }> = {};

  for (const log of setLogs) {
    if (!log.completed || !log.session_completed_at) continue;
    if (log.set_type === 'warm_up') continue;

    const mapping = exerciseMappings.get(log.exercise_id);
    if (!mapping) continue;

    const sessionDate = new Date(log.session_completed_at).getTime();
    if (!Number.isFinite(sessionDate) || sessionDate > now.getTime()) continue;
    const sessionId = log.session_id;

    for (const mc of mapping.muscles) {
      if (!muscleSets[mc.muscle]) {
        muscleSets[mc.muscle] = { sessionSets: new Map(), lowRirBySession: new Map(), lastTrainedAt: null, lastSessionId: null, weeklySets: 0 };
      }
      const ms = muscleSets[mc.muscle];

      if (ms.lastTrainedAt == null || sessionDate > ms.lastTrainedAt) {
        ms.lastTrainedAt = sessionDate;
        ms.lastSessionId = sessionId;
      }

      // Weekly effective sets (fractional: 1 for direct work, 0.5 for helping muscles)
      if (sessionDate >= sevenDaysAgo) {
        ms.weeklySets += mc.contribution;
      }

      // Per-session effective sets, and sets taken within 1 rep of failure
      ms.sessionSets.set(sessionId, (ms.sessionSets.get(sessionId) ?? 0) + mc.contribution);
      if (log.rir != null && log.rir <= 1 && mc.contribution >= 0.5) {
        ms.lowRirBySession.set(sessionId, (ms.lowRirBySession.get(sessionId) ?? 0) + 1);
      }
    }
  }

  // Compute sleep multiplier (avg of last 2 nights)
  const recentSleep = sleep.slice(0, 2);
  const avgSleep = recentSleep.length > 0
    ? recentSleep.reduce((sum, s) => sum + s.sleepHours, 0) / recentSleep.length
    : null;
  const sleepMultiplier = avgSleep != null && avgSleep < 6 ? 1.15 : 1.0;

  // Latest soreness per muscle
  const latestSoreness: Record<string, SorenessEntry> = {};
  for (const s of soreness) {
    const existing = latestSoreness[s.muscle];
    if (!existing || new Date(s.recordedAt) > new Date(existing.recordedAt)) {
      latestSoreness[s.muscle] = s;
    }
  }

  const allMuscles = Object.keys(BASE_RECOVERY_HOURS) as RecoveryMuscle[];

  return allMuscles.map((muscle) => {
    const baseHours = BASE_RECOVERY_HOURS[muscle];
    const data = muscleSets[muscle];
    const personalMultiplier = personalMultipliers[muscle] ?? 1.0;

    const weeklyEffectiveSets = data?.weeklySets ?? 0;
    const weeklySetBand: MuscleRecoveryState['weeklySetBand'] =
      weeklyEffectiveSets < 4 ? 'low' :
      weeklyEffectiveSets <= 10 ? 'efficient' :
      weeklyEffectiveSets <= 20 ? 'productive' : 'diminishing';

    // Effective sets in the most recent session for this muscle (the one recovery is measured from)
    const sessionEffectiveSets = data?.lastSessionId ? data.sessionSets.get(data.lastSessionId) ?? 0 : 0;
    const hasSessionVolumeWarning = sessionEffectiveSets > 11;

    if (!data?.lastTrainedAt) {
      return {
        muscle,
        recoveryPercent: null,
        hoursSinceLastTrained: null,
        hoursNeeded: baseHours,
        status: 'no_data' as const,
        lastTrainedDate: null,
        weeklyEffectiveSets,
        weeklySetBand,
        sessionEffectiveSets,
        hasSessionVolumeWarning,
        personalMultiplier,
        modifiers: { rirExtra: 0, volumeExtra: 0, sorenessExtra: 0, sleepMultiplier, personalMultiplier },
      };
    }

    const hoursSince = (now.getTime() - data.lastTrainedAt) / (1000 * 60 * 60);

    // Compute modifiers
    let rirExtra = 0;
    let volumeExtra = 0;
    let sorenessExtra = 0;

    // RIR modifier: sets taken to (or within 1 rep of) failure in the last session add up to +24h
    const lowRirSets = data.lastSessionId ? data.lowRirBySession.get(data.lastSessionId) ?? 0 : 0;
    if (lowRirSets > 0) {
      rirExtra = Math.min(24, lowRirSets * 6);
    }

    // Volume modifier: high per-session volume adds time
    if (sessionEffectiveSets > 11) {
      volumeExtra = Math.min(12, (sessionEffectiveSets - 11) * 2);
    }

    // Soreness modifier (0-10 scale), only when reported after the last session of this muscle
    const sorenessEntry = latestSoreness[muscle];
    if (sorenessEntry && sorenessEntry.score >= 7 && new Date(sorenessEntry.recordedAt).getTime() >= data.lastTrainedAt - 12 * 3600 * 1000) {
      sorenessExtra = 12;
    }

    const hoursNeeded = (baseHours + rirExtra + volumeExtra + sorenessExtra) * sleepMultiplier * personalMultiplier;
    const recoveryPercent = Math.max(0, Math.min(100, (hoursSince / hoursNeeded) * 100));

    const status: MuscleRecoveryState['status'] =
      recoveryPercent < 50 ? 'red' :
      recoveryPercent < 90 ? 'orange' : 'green';

    return {
      muscle,
      recoveryPercent,
      hoursSinceLastTrained: hoursSince,
      hoursNeeded,
      status,
      lastTrainedDate: new Date(data.lastTrainedAt).toISOString(),
      weeklyEffectiveSets,
      weeklySetBand,
      sessionEffectiveSets,
      hasSessionVolumeWarning,
      personalMultiplier,
      modifiers: { rirExtra, volumeExtra, sorenessExtra, sleepMultiplier, personalMultiplier },
    };
  });
}

export function getRecoveryActions(muscle: RecoveryMuscle, status: MuscleRecoveryState['status']): string[] {
  const actions: string[] = [];
  if (status === 'green') {
    actions.push('This muscle is well recovered and ready for training.');
    actions.push('Consider progressive overload or a higher-volume session.');
  } else if (status === 'orange') {
    actions.push('Still recovering — prioritise lighter loads or isolation work.');
    actions.push('Active recovery: light cardio, mobility, or massage for this area.');
    actions.push('Ensure adequate protein intake (1.6-2.2 g/kg/day).');
  } else if (status === 'red') {
    actions.push('Avoid direct training of this muscle group today.');
    actions.push('Massage has the strongest evidence for reducing DOMS (Dupuy et al. 2018).');
    actions.push('Prioritise sleep — short sleep impairs muscle repair (Saner et al. 2020).');
    actions.push('If soreness persists beyond 72h or worsens, consider the Doctor triage.');
  } else {
    actions.push('No training data for this muscle yet. Log a workout to see recovery estimates.');
  }
  return actions;
}
