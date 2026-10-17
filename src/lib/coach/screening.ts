// Pre-participation health screening for a coach's intake form.
//
// Source: Riebe D, et al. "Updating ACSM's Recommendations for Exercise Preparticipation Health Screening."
// Med Sci Sports Exerc. 2015;47(11):2473-2479 (doi:10.1249/MSS.0000000000000664), as used in ACSM's
// Guidelines for Exercise Testing and Prescription (10th-11th ed.). The algorithm uses three questions:
//   1. Does the person exercise regularly now (at least 30 min of moderate intensity on 3+ days a week for 3+ months)?
//   2. Do they have known cardiovascular, metabolic (type 1 or 2 diabetes) or renal disease?
//   3. Do they have signs or symptoms suggestive of these diseases?
// Pregnancy is outside that algorithm: ACOG Committee Opinion 804 (2020) advises a talk with the obstetric
// care provider before starting or continuing an exercise program.
//
// The same outcome is recomputed by the database trigger (intake_screening_outcome) so it cannot be edited.
// This is a screening aid for the coach, not a diagnosis.

import type { IntakeOutcome } from './insights';

/** Signs and symptoms listed by ACSM (Riebe 2015, table 1). */
export const SYMPTOMS = [
  'chest_pain',     // pain or discomfort in the chest, neck, jaw, arms or other areas that may be from ischemia
  'breathless',     // shortness of breath at rest or with mild exertion
  'dizziness',      // dizziness or fainting (syncope)
  'orthopnea',      // breathlessness lying down, or waking up breathless at night
  'ankle_swelling', // ankle edema
  'palpitations',   // palpitations or a racing heart (tachycardia)
  'claudication',   // calf pain when walking that goes away with rest (intermittent claudication)
  'murmur',         // known heart murmur
  'unusual_fatigue',// unusual fatigue or breathlessness with usual activities
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export interface ScreeningInput {
  exercisesRegularly: boolean;
  knownDisease: boolean;
  symptoms: readonly string[];
}

export function screeningOutcome(i: ScreeningInput): IntakeOutcome {
  const hasSymptoms = i.symptoms.length > 0;
  if (hasSymptoms && i.exercisesRegularly) return 'stop_and_clearance';
  if (hasSymptoms) return 'clearance';
  if (i.knownDisease && i.exercisesRegularly) return 'clearance_before_vigorous';
  if (i.knownDisease) return 'clearance';
  return 'no_clearance';
}

/** What the coach may program before clearance, per outcome (ACSM wording, shortened). */
export const OUTCOME_ADVICE: Record<IntakeOutcome, 'light_moderate_progress' | 'moderate_ok_clear_vigorous' | 'clear_first' | 'stop_clear_first'> = {
  no_clearance: 'light_moderate_progress',
  clearance_before_vigorous: 'moderate_ok_clear_vigorous',
  clearance: 'clear_first',
  stop_and_clearance: 'stop_clear_first',
};

export interface CoachIntake {
  id: string;
  coach_id: string;
  athlete_id: string;
  answers: { q: string; a: string }[];
  goal: string | null;
  days_per_week: number | null;
  minutes_per_session: number | null;
  equipment: string | null;
  injuries: string | null;
  exercises_regularly: boolean;
  known_disease: boolean;
  symptoms: string[];
  pregnant: boolean;
  outcome: IntakeOutcome;
  consented_at: string;
  submitted_at: string;
}

/** Up to 10 coach questions, each 3 to 200 characters, no duplicates. */
export function cleanQuestions(list: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const q = raw.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (q.length >= 3 && !out.some((x) => x.toLowerCase() === q.toLowerCase())) out.push(q);
    if (out.length === 10) break;
  }
  return out;
}
