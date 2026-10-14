import type { RecoveryMuscle } from './muscles';
import type { MuscleRecoveryState, SorenessEntry } from './engine';
import type { PerformanceCheck } from './readiness';
import { supabase } from '../supabase';

export interface ProfileUpdateInput {
  muscle: RecoveryMuscle;
  predictedRecoveryPercent: number;
  actualSoreness: number | null;
  performanceDrop: number | null;
  currentMultiplier: number;
  sampleSize: number;
}

/**
 * After 3+ sessions for a muscle, compare predicted recovery with reported soreness
 * and the performance check. Adjust a personal multiplier per muscle (bounded 0.7-1.4, slow updates).
 */
export function computeProfileUpdate(input: ProfileUpdateInput): {
  newMultiplier: number;
  newSampleSize: number;
  confidence: 'Low' | 'Moderate' | 'High';
  adjustment: number;
} {
  const { predictedRecoveryPercent, actualSoreness, performanceDrop, currentMultiplier, sampleSize } = input;

  // Determine if the model over- or under-estimates recovery
  // High soreness + high predicted recovery → model overestimates → increase multiplier (slower recovery)
  // Low soreness + low predicted recovery → model underestimates → decrease multiplier (faster recovery)

  let adjustment = 0;

  if (actualSoreness != null) {
    // If soreness is high (>=7) but predicted recovery is > 70%, model overestimates
    if (actualSoreness >= 7 && predictedRecoveryPercent > 70) {
      adjustment = 0.05;
    } else if (actualSoreness <= 3 && predictedRecoveryPercent < 50) {
      // Model underestimates recovery
      adjustment = -0.05;
    }
  }

  // Performance drop also informs the adjustment
  if (performanceDrop != null && performanceDrop > 5 && predictedRecoveryPercent > 70) {
    adjustment += 0.03;
  }

  // Slow updates: scale by 1/sampleSize to avoid overcorrection
  const learningRate = 1 / Math.max(3, sampleSize);
  adjustment *= learningRate * 3; // slightly faster but still bounded

  let newMultiplier = currentMultiplier + adjustment;
  newMultiplier = Math.max(0.7, Math.min(1.4, newMultiplier));

  const newSampleSize = sampleSize + 1;
  const confidence: 'Low' | 'Moderate' | 'High' =
    newSampleSize >= 10 ? 'High' : newSampleSize >= 5 ? 'Moderate' : 'Low';

  return { newMultiplier, newSampleSize, confidence, adjustment };
}

/**
 * Run profile updates for all muscles with enough data.
 */
export async function updateRecoveryProfiles(
  muscleStates: MuscleRecoveryState[],
  soreness: SorenessEntry[],
  performanceChecks: PerformanceCheck[],
  existingProfile: { muscle: string; personal_multiplier: number; sample_size: number; manually_overridden: boolean | null }[],
): Promise<void> {
  for (const state of muscleStates) {
    if (state.recoveryPercent == null) continue;
    if (state.hoursSinceLastTrained == null || state.hoursSinceLastTrained > 168) continue;

    // Need at least 3 sessions (approximated by weekly sets >= 3)
    if (state.weeklyEffectiveSets < 3) continue;

    const existing = existingProfile.find((p) => p.muscle === state.muscle);
    const currentMultiplier = existing?.personal_multiplier ?? 1.0;
    const currentSampleSize = existing?.sample_size ?? 0;

    // Skip manually overridden entries
    const isOverridden = existing && existing.manually_overridden === true;
    if (isOverridden) continue;

    const muscleSoreness = soreness.find((s) => s.muscle === state.muscle);
    const perfCheck = performanceChecks.find((pc) => pc.muscle === state.muscle);

    // Only update if we have at least one signal
    if (!muscleSoreness && !perfCheck) continue;

    const update = computeProfileUpdate({
      muscle: state.muscle,
      predictedRecoveryPercent: state.recoveryPercent,
      actualSoreness: muscleSoreness?.score ?? null,
      performanceDrop: perfCheck?.percentDrop ?? null,
      currentMultiplier,
      sampleSize: currentSampleSize,
    });

    // Only write if there's a meaningful adjustment
    if (Math.abs(update.adjustment) < 0.001) continue;

    try {
      await supabase
        .from('recovery_profile')
        .upsert({
          muscle: state.muscle,
          personal_multiplier: update.newMultiplier,
          sample_size: update.newSampleSize,
          confidence: update.confidence,
          manually_overridden: false,
          updated_at: new Date().toISOString(),
        });
    } catch {
      // Silently skip — profile updates are non-critical
    }
  }
}

export interface ProfileDisplay {
  muscle: RecoveryMuscle;
  multiplier: number;
  sampleSize: number;
  confidence: 'Low' | 'Moderate' | 'High';
  description: string;
  isOverridden: boolean;
}

export function formatProfileDescription(multiplier: number): string {
  if (multiplier === 1.0) return 'Recovers at the average rate';
  if (multiplier > 1.0) {
    const pct = Math.round((multiplier - 1.0) * 100);
    return `Recovers about ${pct}% slower than the average model`;
  }
  const pct = Math.round((1.0 - multiplier) * 100);
  return `Recovers about ${pct}% faster than the average model`;
}
