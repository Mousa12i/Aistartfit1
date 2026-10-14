export interface MetricResult<T> {
  value: T | null;
  unit: string | null;
  source: string | null;
  recordedAt: string | null;
  completeness: 'complete' | 'partial' | 'missing' | 'unverified';
  limitation: string | null;
  explanation: string;
  missingInputs: string[];
}

export interface CheckinSnapshot {
  checkin_date: string;
  sleep_hours: number | null;
  sleep_source?: 'manual' | 'device' | null;
  hrv_ms: number | null;
  hrv_source?: 'manual' | 'wearable' | null;
  resting_hr_bpm?: number | null;
  resting_hr?: number | null;
  hr_verified?: boolean;
  stress: number | null;
  hydration_litres?: number | null;
  hydration_l?: number | null;
  protein_g: number | null;
  soreness: Record<string, number>;
}

export interface WorkoutSnapshot {
  exercise_id: string;
  exercise_name: string;
  session_completed_at: string | null;
  set_type: string | null;
  completed: boolean;
}

export interface ProfileSnapshot { body_weight_kg: number | null }

export interface RecoverySnapshot {
  today: CheckinSnapshot | null;
  checkins: CheckinSnapshot[];
  workouts: WorkoutSnapshot[];
  profile: ProfileSnapshot;
}
