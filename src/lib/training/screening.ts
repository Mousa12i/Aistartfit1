// Health screening for training plans. It is a screen, not a diagnosis: it decides whether the
// app should build a plan right away, build a more careful one, or ask the person to see a
// clinician first. It uses the factors of ACSM pre-participation screening (Riebe et al., 2015):
// current activity, signs or symptoms and/or known cardiovascular, metabolic or renal disease,
// and intended intensity. The exact hold rules are StartFit precautions. Pregnancy follows ACOG
// (2020): a clinical evaluation before an exercise programme.

import { PAIN_AREA_FLAGS, type PainArea, type SafetyFlag } from './taxonomy';
import type { CurrentActivity, HealthScreening, PainEntry } from './plan-types';

export const SCREENING_VERSION = 'startfit-screen-1' as const;

export function emptyScreening(now = new Date()): HealthScreening {
  return {
    version: SCREENING_VERSION,
    symptoms: { chestPain: false, dizzinessOrFainting: false, breathlessAtMildEffort: false, palpitationsOrSwelling: false },
    knownDisease: { heart: false, metabolic: false, kidney: false, lung: false },
    pregnancy: 'no',
    doctorSaidAvoidExercise: false,
    recentSurgeryOrInjury: false,
    uncontrolledHighBloodPressure: false,
    osteoporosis: false,
    clearedByClinician: false,
    completedAt: now.toISOString(),
  };
}

/** Questions shown to the person, in order. `path` says which field of HealthScreening a yes sets. */
export const SCREENING_QUESTIONS: { id: string; text: string; path: string; femaleOnly?: boolean }[] = [
  { id: 'chest_pain', text: 'Do you get chest pain, tightness or pressure when you are resting or doing light activity?', path: 'symptoms.chestPain' },
  { id: 'dizzy', text: 'Do you often feel dizzy, or have you fainted, during or after physical effort?', path: 'symptoms.dizzinessOrFainting' },
  { id: 'breathless', text: 'Do you get unusually short of breath with mild effort, such as climbing one flight of stairs?', path: 'symptoms.breathlessAtMildEffort' },
  { id: 'palpitations', text: 'Do you have a racing or irregular heartbeat, or unexplained swelling in your ankles?', path: 'symptoms.palpitationsOrSwelling' },
  { id: 'heart', text: 'Have you been told you have heart or blood-vessel disease (for example a heart attack, stroke, heart failure or a heart condition)?', path: 'knownDisease.heart' },
  { id: 'metabolic', text: 'Have you been told you have diabetes or another metabolic condition?', path: 'knownDisease.metabolic' },
  { id: 'kidney', text: 'Have you been told you have kidney disease?', path: 'knownDisease.kidney' },
  { id: 'lung', text: 'Have you been told you have a lung condition such as asthma that is not well controlled, or COPD?', path: 'knownDisease.lung' },
  { id: 'bp', text: 'Do you have high blood pressure that is not controlled?', path: 'uncontrolledHighBloodPressure' },
  { id: 'doctor', text: 'Has a doctor told you to avoid exercise or to limit it?', path: 'doctorSaidAvoidExercise' },
  { id: 'surgery', text: 'Have you had surgery, or an injury you are still being treated for, in the last 3 months?', path: 'recentSurgeryOrInjury' },
  { id: 'osteoporosis', text: 'Have you been told you have osteoporosis (thin, fragile bones)?', path: 'osteoporosis' },
];

export interface ScreeningResult {
  status: 'ok' | 'caution' | 'medical_first';
  /** Why the plan waits for a clinician (empty unless status is medical_first). */
  holdReasons: string[];
  /** Plain-language notes shown with the plan. */
  notes: string[];
  claimIds: string[];
  /** Lowest reps-in-reserve target any exercise may carry. */
  minRir: number;
  /** Cardio and conditioning ceiling. */
  maxCardioIntensity: 'moderate' | 'vigorous';
  youth: boolean;
  older: boolean;
  pregnant: boolean;
  postpartum: boolean;
  /** Safety flags whose exercises are left out. */
  excludeFlags: SafetyFlag[];
  /** Leave out exercises done lying on the back or face down. */
  excludeLying: boolean;
  /** Leave out jumping and other high-impact exercises. */
  excludeImpact: boolean;
  clinicianAdvised: boolean;
}

export interface ScreeningInput {
  age: number;
  currentActivity: CurrentActivity;
  pain: PainEntry[];
  screening: HealthScreening;
}

export const MIN_SUPPORTED_AGE = 13;

/**
 * With mild pain only the positions most likely to aggravate the area are left out; with moderate or
 * severe pain every movement feature in PAIN_AREA_FLAGS is (StartFit precaution, claim pain_precaution).
 */
export const MILD_PAIN_FLAGS: Record<PainArea, SafetyFlag[]> = {
  shoulder: ['behind_neck', 'upright_row', 'dip'],
  elbow: ['elbow_stress'],
  wrist: ['wrist_loaded_extension'],
  neck: ['neck_load', 'behind_neck'],
  upper_back: ['neck_load'],
  lower_back: ['loaded_spinal_flexion', 'impact'],
  hip: ['impact'],
  knee: ['impact'],
  ankle: ['impact'],
};

export function screenForTraining(input: ScreeningInput): ScreeningResult {
  const { age, currentActivity, pain, screening: s } = input;
  const hold: string[] = [];
  const notes: string[] = [];
  const claimIds = new Set<string>();
  const exclude = new Set<SafetyFlag>();
  let minRir = 0;
  let maxCardio: 'moderate' | 'vigorous' = 'vigorous';
  let clinicianAdvised = false;
  let excludeLying = false;
  let excludeImpact = false;
  let caution = false;

  const cleared = s.clearedByClinician;
  const hasSymptoms = Object.values(s.symptoms).some(Boolean);
  const hasDisease = Object.values(s.knownDisease).some(Boolean);
  const regular = currentActivity === 'regular';

  if (age < MIN_SUPPORTED_AGE) {
    hold.push('StartFit plans are built for ages 13 and over. For younger children, exercise should be play-based and guided by a qualified adult.');
  }

  if (hasSymptoms && !cleared) {
    hold.push('You answered yes to a symptom that should be looked at by a doctor before you start a training programme.');
    claimIds.add('screening_acsm');
  }
  if (s.doctorSaidAvoidExercise && !cleared) {
    hold.push('A doctor has told you to avoid or limit exercise. Please get their go-ahead and the limits that apply to you first.');
  }
  if (hasDisease && !regular && !cleared) {
    hold.push('You have a known heart, metabolic, kidney or lung condition and you are not yet exercising regularly, so the plan waits until a clinician has cleared you (StartFit precaution based on the ACSM screening factors).');
    claimIds.add('screening_acsm');
  }
  if (s.uncontrolledHighBloodPressure && !cleared) {
    hold.push('High blood pressure that is not controlled should be treated and checked by a doctor before you start training.');
  }
  if (s.recentSurgeryOrInjury && !cleared) {
    hold.push('After recent surgery or an injury that is still being treated, your clinician should confirm what you can do.');
  }
  if (s.pregnancy === 'pregnant' && !cleared) {
    hold.push('During pregnancy, ACOG advises a thorough clinical evaluation before an exercise programme. Please check with your doctor or midwife first.');
    claimIds.add('pregnancy_eval');
  }

  if (hold.length > 0) {
    return {
      status: 'medical_first',
      holdReasons: hold,
      notes: ['This is a screening, not a diagnosis. Once a clinician has cleared you, tick the confirmation and your plan will be built with extra care.'],
      claimIds: [...claimIds],
      minRir: 3,
      maxCardioIntensity: 'moderate',
      youth: age < 18,
      older: age >= 65,
      pregnant: s.pregnancy === 'pregnant',
      postpartum: s.pregnancy === 'postpartum',
      excludeFlags: [],
      excludeLying: s.pregnancy === 'pregnant',
      excludeImpact: true,
      clinicianAdvised: true,
    };
  }

  // ---- cleared, or nothing to hold: build with the right amount of care ----
  if (cleared && (hasSymptoms || hasDisease || s.doctorSaidAvoidExercise || s.uncontrolledHighBloodPressure || s.recentSurgeryOrInjury || s.pregnancy === 'pregnant')) {
    caution = true;
    clinicianAdvised = true;
    minRir = Math.max(minRir, 3);
    maxCardio = 'moderate';
    excludeImpact = true;
    notes.push('You told us a clinician has cleared you. The plan keeps every set well short of failure and cardio at a moderate effort. Follow any limits your clinician gave you; they come before this plan.');
    claimIds.add('screening_acsm');
  } else if (hasDisease && regular) {
    caution = true;
    clinicianAdvised = true;
    maxCardio = 'moderate';
    notes.push('You already exercise regularly, so the plan keeps you at a moderate effort. Ask your clinician before moving to vigorous exercise (StartFit precaution based on the ACSM screening factors).');
    claimIds.add('screening_acsm');
  }

  if (s.pregnancy === 'pregnant') {
    caution = true;
    clinicianAdvised = true;
    minRir = Math.max(minRir, 3);
    maxCardio = 'moderate';
    excludeLying = true;
    excludeImpact = true;
    exclude.add('fall_risk');
    exclude.add('high_skill');
    exclude.add('hanging');
    notes.push('Pregnancy plan: no exercises lying flat on the back or face down, no jumping, no balance risks, and every set stays well short of failure. Stop and call your clinician for any warning sign they have told you about.');
    claimIds.add('pregnancy_modifications');
    claimIds.add('pregnancy_eval');
  }

  if (s.pregnancy === 'postpartum') {
    caution = true;
    clinicianAdvised = true;
    minRir = Math.max(minRir, 3);
    maxCardio = 'moderate';
    excludeImpact = true;
    notes.push('After having a baby, build back gradually. Ask your clinician when you can return to heavier training; until then the plan avoids jumping and keeps every set well short of failure.');
  }

  if (s.osteoporosis) {
    caution = true;
    clinicianAdvised = true;
    exclude.add('loaded_spinal_flexion');
    exclude.add('impact');
    exclude.add('fall_risk');
    exclude.add('high_skill');
    excludeImpact = true;
    minRir = Math.max(minRir, 2);
    notes.push('With osteoporosis the plan leaves out loaded spine bending, jumping and exercises with a fall risk. Ask your clinician which loads are right for you.');
  }

  if (age < 18) {
    caution = true;
    minRir = Math.max(minRir, 2);
    exclude.add('high_skill');
    notes.push('Under 18: the plan uses moderate loads, leaves some repetitions in reserve and avoids maximal lifts. Youth programmes should be supervised by someone qualified.');
    claimIds.add('youth_rt');
  }

  if (age >= 65) {
    caution = true;
    minRir = Math.max(minRir, 2);
    exclude.add('high_skill');
    exclude.add('fall_risk');
    notes.push('Age 65 or over: the plan adds balance work, keeps sets short of failure and progresses gradually.');
    claimIds.add('older_rt');
    claimIds.add('neuromotor');
  }

  for (const p of pain) {
    for (const f of p.level === 'mild' ? MILD_PAIN_FLAGS[p.area] : PAIN_AREA_FLAGS[p.area]) exclude.add(f);
    if (p.level !== 'mild' && (p.area === 'knee' || p.area === 'hip' || p.area === 'ankle' || p.area === 'lower_back')) excludeImpact = true;
    if (p.level === 'severe') {
      caution = true;
      clinicianAdvised = true;
    }
  }
  if (pain.length > 0) {
    caution = true;
    claimIds.add('pain_precaution');
    if (pain.some((p) => p.area === 'lower_back')) claimIds.add('back_pain_exercise');
    if (pain.some((p) => p.level === 'severe')) {
      notes.push('You described severe pain. Please have it checked by a clinician; the plan only avoids the movements that load that area and is not a treatment.');
    }
  }

  return {
    status: caution ? 'caution' : 'ok',
    holdReasons: [],
    notes,
    claimIds: [...claimIds],
    minRir,
    maxCardioIntensity: maxCardio,
    youth: age < 18,
    older: age >= 65,
    pregnant: s.pregnancy === 'pregnant',
    postpartum: s.pregnancy === 'postpartum',
    excludeFlags: [...exclude],
    excludeLying,
    excludeImpact,
    clinicianAdvised,
  };
}
