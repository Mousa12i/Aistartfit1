export type FitnessGoal = 'fat_loss' | 'muscle_gain' | 'strength' | 'endurance' | 'general_fitness';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingLocation = 'gym' | 'home' | 'outdoor';
export type Equipment = 'none' | 'dumbbells' | 'barbell' | 'kettlebell' | 'resistance_bands' | 'pull_up_bar' | 'bench' | 'machine' | 'other';
export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes' | 'core' | 'full_body' | 'cardio';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type UnitSystem = 'metric' | 'imperial';
export type PhysiqueGoal = 'hypertrophy' | 'fat_loss' | 'powerlifting' | 'recomposition' | 'general';

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  fitness_goal: FitnessGoal | null;
  experience_level: ExperienceLevel | null;
  training_location: TrainingLocation | null;
  preferred_equipment: Equipment[] | null;
  preferred_days: string[] | null;
  session_duration_min: number | null;
  limitations: string | null;
  unit_system: UnitSystem;
  notification_enabled: boolean;
  onboarding_completed: boolean;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  body_fat_pct: number | null;
  physique_goal: PhysiqueGoal | null;
  subscription_tier: 'free' | 'pro' | 'plus';
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_current_period_end: string | null;
  /** Language chosen right after sign-in (NULL until chosen). */
  preferred_language?: string | null;
  /** Coach mode (NULL until the person picks). */
  account_type?: 'athlete' | 'coach' | null;
  coach_code?: string | null;
  coach_tier?: 'free' | 'coach' | 'coach_pro' | 'studio';
  coach_status?: string | null;
  coach_period_end?: string | null;
  coach_brand_name?: string | null;
  coach_bio?: string | null;
  coach_checkin_day?: number;
  coach_headline?: string | null;
  coach_specialties?: string[];
  coach_years?: number | null;
  coach_languages?: string[];
  coach_format?: 'online' | 'in_person' | 'hybrid' | null;
  coach_location?: string | null;
  coach_philosophy?: string | null;
  coach_certifications?: { name: string; issuer: string | null; year: number | null }[];
  coach_insured?: boolean | null;
  coach_dietitian?: boolean | null;
  coach_terms_version?: string | null;
  coach_terms_accepted_at?: string | null;
  coach_welcome_message?: string | null;
  coach_hours_start?: number | null;
  coach_hours_end?: number | null;
  coach_hours_tz?: string | null;
  coach_checkin_questions?: string[];
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  instructions: string[];
  safety_notes: string | null;
  primary_muscle: MuscleGroup;
  secondary_muscles: MuscleGroup[] | null;
  equipment: Equipment;
  difficulty: Difficulty;
  default_sets: number;
  default_reps: string;
  default_rest_seconds: number;
  image_url: string | null;
  video_url: string | null;
  video_thumbnail: string | null;
  video_duration: number | null;
  video_source: string;
  movement_pattern: string | null;
  exercise_type: string | null;
  is_pro: boolean | null;
  access_tier: 'free' | 'pro' | 'plus';
  source_id: string | null;
  category: string | null;
  force_type: string | null;
  mechanic: string | null;
  primary_muscles: string[] | null;
  secondary_muscles_raw: string[] | null;
  is_custom: boolean;
  created_at: string;
  /** Movement pattern id (see lib/training/taxonomy). Null on rows from before the library migration. */
  pattern?: string | null;
  /** Muscles trained directly: counted as one set per set performed. */
  muscles_primary?: string[];
  /** Muscles trained indirectly: counted as half a set. */
  muscles_secondary?: string[];
  /** Small stabilisers (rotator cuff, serratus, ...): shown, not counted as volume. */
  muscles_extra?: string[];
  equipment_tags?: string[];
  safety_flags?: string[];
  is_unilateral?: boolean;
  is_hidden?: boolean;
  canonical_id?: string | null;
  aliases?: string[];
  image_urls?: string[];
  core_slot?: string | null;
  core_rank?: number | null;
  created_by?: string | null;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  goal: FitnessGoal;
  difficulty: Difficulty;
  duration_weeks: number;
  sessions_per_week: number;
  session_duration_min: number;
  equipment_needed: Equipment[];
  image_url: string | null;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  /** Full plan (volume, reasons, references) for routines built by the plan engine or the coach. */
  details?: unknown | null;
  source?: 'library' | 'user' | 'engine' | 'coach';
  updated_at?: string;
  archived?: boolean;
}

export interface WorkoutPlanExercise {
  id: string;
  plan_id: string;
  exercise_id: string;
  exercise_order: number;
  sets: number;
  reps: string;
  rest_seconds: number;
  exercise?: Exercise;
  /** Training day inside the routine (0-based). Older routines have every exercise on day 0. */
  day_index?: number;
  day_label?: string | null;
  rir_target?: number | null;
  notes?: string | null;
  /** Coach prescription extras. */
  tempo?: string | null;
  group_label?: string | null;
  alt_exercise_id?: string | null;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  plan_id: string | null;
  plan_name: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number;
  total_sets: number;
  total_reps: number;
  exercises_completed: number;
  notes: string | null;
  status: 'active' | 'completed' | 'abandoned';
  total_volume: number;
  abandoned_at: string | null;
  /** Which day of the routine this session trained (null for free workouts and older sessions). */
  plan_day?: number | null;
  /** How hard the whole session felt, 0–10 (session RPE), if rated. */
  session_rpe?: number | null;
  rpe_recorded_at?: string | null;
}

export type SetType = 'warm_up' | 'working' | 'drop' | 'back_off' | 'assessment';

export interface WorkoutSetLog {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight: number | null;
  completed: boolean;
  set_type: SetType | null;
  rir: number | null;
  notes: string | null;
}

export interface AiConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AiUsage {
  id: string;
  user_id: string;
  request_count: number;
  last_request_at: string;
  daily_limit: number;
}

export interface UserGoal {
  id: string;
  user_id: string;
  title: string;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  deadline: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string | null;
  recorded_at: string;
  created_at: string;
}

export interface MealLog {
  id: string;
  user_id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs_g: number;
  fat_g: number;
  logged_date: string;
  created_at: string;
}

export interface WaterLog {
  id: string;
  user_id: string;
  ml: number;
  logged_date: string;
  created_at: string;
}

export type RecoveryLogKind = 'soreness' | 'sleep' | 'hydration' | 'journal' | 'recovery_session' | 'recommendation';

export interface RecoveryLog {
  id: string;
  user_id: string;
  kind: RecoveryLogKind;
  value: number | null;
  muscle: string | null;
  note: string | null;
  metadata: Record<string, string | number | boolean>;
  recorded_at: string;
  created_at: string;
}

export interface DailyCheckin {
  id: string;
  user_id: string;
  checkin_date: string;
  sleep_hours: number | null;
  sleep_source?: 'manual' | 'device' | null;
  hydration_l: number | null;
  stress: number | null;
  resting_hr: number | null;
  resting_hr_bpm?: number | null;
  hr_verified?: boolean;
  hrv_source?: 'manual' | 'wearable' | null;
  hrv_ms: number | null;
  body_weight: number | null;
  protein_g: number | null;
  soreness?: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface SorenessLog {
  id: string;
  user_id: string;
  muscle: string;
  soreness_score: number;
  recorded_at: string;
  created_at: string;
}

export interface PainLog {
  id: string;
  user_id: string;
  body_area: string;
  onset: string | null;
  pain_type: string | null;
  severity: number;
  during_exercise: boolean | null;
  swelling: boolean;
  bruising: boolean;
  rom_loss: boolean;
  duration_hours: number | null;
  notes: string | null;
  triage_level: 'green' | 'yellow' | 'red';
  recorded_at: string;
  created_at: string;
}

export interface RecoveryProfileEntry {
  id: string;
  user_id: string;
  muscle: string;
  personal_multiplier: number;
  sample_size: number;
  confidence: string;
  manually_overridden: boolean;
  updated_at: string;
}

export type Tab = 'routines' | 'exercises' | 'workout' | 'nutrition' | 'recover' | 'account';

export type Screen =
  | { name: 'home' }
  | { name: 'training' }
  | { name: 'ai-coach' }
  | { name: 'profile' }
  | { name: 'exercise-library' }
  | { name: 'exercise-detail'; exerciseId: string }
  | { name: 'programme-detail'; planId: string }
  | { name: 'active-workout'; planId: string | null }
  | { name: 'workout-completion'; sessionId: string }
  | { name: 'workout-history' }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'edit-profile' }
  | { name: 'nutrition' }
  | { name: 'recovery' }
  | { name: 'biometric-assessment' }
  | { name: 'exercise-vault' };
