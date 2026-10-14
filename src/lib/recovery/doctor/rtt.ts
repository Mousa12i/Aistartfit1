// Return-to-training with pain monitoring (claims: pain_monitoring, rtt_rule, triage_rule).

export interface RttStage {
  stage: 1 | 2 | 3 | 4;
  title: string;
  what: string;
}

export const RTT_STAGES: RttStage[] = [
  { stage: 1, title: 'Pain-free movement', what: 'Move the area through its comfortable range and do light holds (isometrics), 2–3 sets. Keep pain at 3/10 or less.' },
  { stage: 2, title: 'Light loading', what: 'Your usual exercises for the area at about half your usual weight (or bodyweight), 2 sets, stopping 3–4 reps short of failure.' },
  { stage: 3, title: 'Building back', what: 'About three-quarters of your usual weight and sets, stopping 2–3 reps short of failure.' },
  { stage: 4, title: 'Full training', what: 'Your normal plan. Keep checking the next-morning response for 2 more sessions.' },
];

export const PAIN_OK = 3;
export const PAIN_TOO_MUCH = 5;
export const PAIN_SEE_CLINICIAN = 8;

export interface RttEntry {
  date: string;
  stage: number;
  painDuring: number;
  painNextMorning: number | null;
  morningWorse: boolean | null;
}

export type RttAdvice = 'advance' | 'stay' | 'back' | 'complete' | 'see_clinician' | 'log_morning';

export interface RttEvaluation {
  stage: number;
  advice: RttAdvice;
  text: string;
  nextStage: number;
  claimIds: string[];
}

const good = (e: RttEntry) => e.painDuring <= PAIN_OK && e.morningWorse === false;

export function evaluateRtt(stage: number, entries: RttEntry[]): RttEvaluation {
  const claimIds = ['rtt_rule', 'pain_monitoring'];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let lastOther = -1;
  sorted.forEach((e, i) => {
    if (e.stage !== stage) lastOther = i;
  });
  const atStage = sorted.slice(lastOther + 1);
  // only sessions done at the current stage count, so moving up or back starts the stage afresh
  const last = atStage[atStage.length - 1];
  if (!last) return { stage, advice: 'stay', text: 'Do your first session at this stage and log the pain during it.', nextStage: stage, claimIds };
  if (last.painDuring >= PAIN_SEE_CLINICIAN || (last.painNextMorning ?? 0) >= PAIN_SEE_CLINICIAN) {
    return { stage, advice: 'see_clinician', text: `Pain reached ${Math.max(last.painDuring, last.painNextMorning ?? 0)}/10. Stop loading this area and see a clinician.`, nextStage: stage, claimIds: [...claimIds, 'triage_rule'] };
  }
  if (last.painDuring > PAIN_TOO_MUCH || last.morningWorse === true) {
    const next = Math.max(1, stage - 1);
    return {
      stage,
      advice: 'back',
      text: last.morningWorse ? 'The area was worse the next morning, so go back a stage.' : `Pain during the session was ${last.painDuring}/10 (above 5), so go back a stage.`,
      nextStage: next,
      claimIds,
    };
  }
  if (last.morningWorse == null) return { stage, advice: 'log_morning', text: 'Tomorrow morning, log whether the area feels worse than usual.', nextStage: stage, claimIds };
  const lastTwo = atStage.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every(good)) {
    if (stage >= 4) return { stage, advice: 'complete', text: 'Two good sessions at full training: you can finish this programme.', nextStage: 4, claimIds };
    return { stage, advice: 'advance', text: `Two sessions in a row with pain ≤${PAIN_OK}/10 and no worse next morning: move to stage ${stage + 1}.`, nextStage: stage + 1, claimIds };
  }
  const streak = atStage.length && good(atStage[atStage.length - 1]) ? 1 : 0;
  return { stage, advice: 'stay', text: `Stay at stage ${stage}: ${2 - streak} more good session(s) needed (pain ≤${PAIN_OK}/10, next morning no worse).`, nextStage: stage, claimIds };
}
