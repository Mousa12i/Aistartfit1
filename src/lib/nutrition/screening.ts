// Wellbeing check-in shown before nutrition targets are set.
// The five questions are the SCOFF screening questionnaire
// (Morgan, Reid & Lacey, BMJ 1999). Two or more "yes" answers suggest the
// person may benefit from talking to a professional. It is a screen, not a
// diagnosis, and the app never presents it as one.

export const SCOFF_QUESTIONS = [
  { id: 'sick', text: 'Do you make yourself sick because you feel uncomfortably full?' },
  { id: 'control', text: 'Do you worry you have lost control over how much you eat?' },
  { id: 'one_stone', text: 'Have you recently lost more than one stone (about 6 kg) in a 3-month period?' },
  { id: 'fat', text: 'Do you believe yourself to be fat when others say you are too thin?' },
  { id: 'food', text: 'Would you say that food dominates your life?' },
] as const;

export type ScoffId = (typeof SCOFF_QUESTIONS)[number]['id'];

export const HEALTH_CONDITIONS = [
  { id: 'diabetes_meds', label: 'Diabetes treated with insulin or tablets' },
  { id: 'kidney', label: 'Kidney disease' },
  { id: 'other', label: 'Another condition where a doctor manages my diet' },
] as const;

export type ConditionId = (typeof HEALTH_CONDITIONS)[number]['id'];

export interface ScreeningRecord {
  version: 'scoff-1999';
  answers: Partial<Record<ScoffId, boolean>>;
  score: number;
  positive: boolean;
  under18: boolean;
  pregnant: boolean;
  conditions: ConditionId[];
  completedAt: string;
}

export function scoreScoff(answers: Partial<Record<ScoffId, boolean>>): { score: number; positive: boolean } {
  const score = SCOFF_QUESTIONS.reduce((sum, q) => sum + (answers[q.id] ? 1 : 0), 0);
  return { score, positive: score >= 2 };
}

export interface SafetyState {
  /** No calorie deficit (under 18, pregnancy). */
  noDeficit: boolean;
  /** No weight-change goals at all (positive screen). */
  noWeightGoals: boolean;
  /** Show support information prominently. */
  showSupport: boolean;
  /** Suggest checking plans with a clinician. */
  clinicianAdvised: boolean;
  reasons: string[];
}

export function deriveSafety(screening: ScreeningRecord | null, profileAge: number | null | undefined): SafetyState {
  const reasons: string[] = [];
  const under18 = (profileAge != null && profileAge > 0 && profileAge < 18) || !!screening?.under18;
  const pregnant = !!screening?.pregnant;
  const positive = !!screening?.positive;
  const conditions = screening?.conditions ?? [];

  if (positive) reasons.push('Your check-in answers suggest it may help to talk to someone about eating. Weight goals are paused.');
  if (under18) reasons.push('You are under 18, so the app does not plan a calorie deficit. Growth needs enough energy.');
  if (pregnant) reasons.push('During pregnancy or breastfeeding the app does not plan a calorie deficit.');
  if (conditions.includes('diabetes_meds')) reasons.push('With diabetes medication, changes to carbs or calories should be checked with your care team.');
  if (conditions.includes('kidney')) reasons.push('With kidney disease, protein targets must come from your doctor or renal dietitian.');
  if (conditions.includes('other')) reasons.push('Check any plan here with the clinician who manages your diet.');

  return {
    noDeficit: under18 || pregnant,
    noWeightGoals: positive,
    showSupport: positive,
    clinicianAdvised: pregnant || conditions.length > 0,
    reasons,
  };
}

export const SUPPORT_LINES: { region: string; name: string; phone?: string; hours?: string; url: string }[] = [
  { region: 'England', name: 'Beat', phone: '0808 801 0677', hours: 'Mon–Fri, 3pm–8pm', url: 'https://www.beateatingdisorders.org.uk' },
  { region: 'Scotland', name: 'Beat', phone: '0808 801 0432', hours: 'Mon–Fri, 3pm–8pm', url: 'https://www.beateatingdisorders.org.uk' },
  { region: 'Wales', name: 'Beat', phone: '0808 801 0433', hours: 'Mon–Fri, 3pm–8pm', url: 'https://www.beateatingdisorders.org.uk' },
  { region: 'Northern Ireland', name: 'Beat', phone: '0808 801 0434', hours: 'Mon–Fri, 3pm–8pm', url: 'https://www.beateatingdisorders.org.uk' },
  { region: 'United States', name: 'National Alliance for Eating Disorders', phone: '866-662-1235', hours: 'Mon–Fri, 9am–7pm ET', url: 'https://findahelpline.com/organizations/national-alliance-for-eating-disorders' },
  { region: 'Anywhere else', name: 'Find A Helpline — free, confidential services by country', url: 'https://findahelpline.com' },
];
