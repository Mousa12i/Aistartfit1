// Recovery methods library. Every "verdict" is a short summary of the cited claims, never more.

export type Verdict = 'helps' | 'some' | 'no' | 'careful' | 'slows';

export interface Modality {
  id: string;
  name: string;
  verdict: Verdict;
  /** One-line summary shown on the card. */
  summary: string;
  /** Practical use, worded to stay inside what the claims say. */
  howToUse: string;
  claimIds: string[];
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  helps: 'Good evidence it helps',
  some: 'Some evidence, small effect',
  no: 'Does not help soreness',
  careful: 'Helps soreness, but has a catch',
  slows: 'Can slow recovery or gains',
};

/** Methods you can log as "I did this today" (the comparison in "What works for you" uses these). */
export function isLoggable(m: Modality): boolean {
  return !['sleep', 'protein'].includes(m.id) && m.verdict !== 'slows';
}

export const MODALITIES: Modality[] = [
  {
    id: 'sleep',
    name: 'Sleep (7+ hours)',
    verdict: 'helps',
    summary: 'The base of recovery: short sleep lowers strength and performance.',
    howToUse: 'Aim for 7 or more hours on a regular basis. After a short night, train in the morning if you can and do not chase personal records.',
    claimIds: ['sleep_7h', 'sleep_loss_perf', 'sleep_strength'],
  },
  {
    id: 'massage',
    name: 'Massage',
    verdict: 'helps',
    summary: 'The most effective technique for soreness (DOMS) and fatigue in a 99-study meta-analysis.',
    howToUse: 'Use it after hard sessions when soreness or fatigue matters for your next one.',
    claimIds: ['massage_doms'],
  },
  {
    id: 'compression',
    name: 'Compression garments',
    verdict: 'helps',
    summary: 'Helped strength recovery, most after resistance training (2–8 h and after 24 h), and perceived fatigue.',
    howToUse: 'Wear them in the hours after a hard resistance session if you need to perform again soon.',
    claimIds: ['compression', 'methods_doms'],
  },
  {
    id: 'active',
    name: 'Active recovery (easy movement)',
    verdict: 'some',
    summary: 'Reduced soreness in the meta-analysis, and gave bigger strength and muscle gains than regular cold-water immersion in a 12-week study.',
    howToUse: 'Easy cycling, walking or light movement for 10–20 minutes on a rest day or after training.',
    claimIds: ['methods_doms', 'cwi_blunts'],
  },
  {
    id: 'foam_rolling',
    name: 'Foam rolling',
    verdict: 'some',
    summary: 'After exercise: slightly less muscle pain (~6%). Evidence supports it more as a warm-up.',
    howToUse: 'Use it in your warm-up for short-term flexibility; after training it may slightly reduce soreness.',
    claimIds: ['foam_roll'],
  },
  {
    id: 'cold_water',
    name: 'Cold-water immersion / ice baths',
    verdict: 'careful',
    summary: 'Reduces soreness, but used regularly after strength training it led to smaller strength and muscle gains.',
    howToUse: 'Keep it for times when feeling fresh soon matters more than long-term gains (e.g. competition days), not after every strength session.',
    claimIds: ['methods_doms', 'cwi_blunts'],
  },
  {
    id: 'stretching',
    name: 'Stretching for soreness',
    verdict: 'no',
    summary: 'A Cochrane review found no clinically important reduction in soreness (before or after exercise).',
    howToUse: 'Stretch for flexibility if you want to, but do not expect it to reduce soreness.',
    claimIds: ['stretch_no_doms'],
  },
  {
    id: 'protein',
    name: 'Enough protein and energy',
    verdict: 'helps',
    summary: 'For muscle gain the benefit of protein levels off around 1.6 g/kg/day; too little energy harms health and performance.',
    howToUse: 'Reach about 1.6 g/kg/day of protein and eat enough for your training (your Nutrition tab tracks both).',
    claimIds: ['protein_plateau', 'reds'],
  },
  {
    id: 'naps',
    name: 'Longer sleep and naps',
    verdict: 'helps',
    summary: 'In a review of 25 studies in athletes, sleeping longer at night and napping were the most effective sleep changes for performance. Sleep-hygiene tips alone showed no effect in the few studies available.',
    howToUse: 'After a short night, plan an earlier bedtime or a daytime nap rather than relying on tips alone.',
    claimIds: ['sleep_extension_naps'],
  },
  {
    id: 'presleep_protein',
    name: 'Protein before sleep',
    verdict: 'some',
    summary: '30–40 g of casein before sleep raised overnight muscle protein synthesis; in one study of 16 men the muscle result was borderline.',
    howToUse: 'On training days, keep part of your protein for a 30–40 g serving (for example milk, skyr or cottage cheese) before bed.',
    claimIds: ['post_exercise_protein', 'presleep_protein', 'protein_per_meal'],
  },
  {
    id: 'creatine',
    name: 'Creatine',
    verdict: 'some',
    summary: 'The ISSN position stand says creatine may improve recovery and help tolerate heavy training, and is safe in healthy people at studied doses.',
    howToUse: 'If you use it, a daily dose works regardless of timing. Check with a doctor first if you have kidney problems or take medication.',
    claimIds: ['creatine_recovery'],
  },
  {
    id: 'tart_cherry',
    name: 'Tart cherry juice',
    verdict: 'some',
    summary: 'A meta-analysis of 14 studies: strength recovered better (moderate effect) and soreness was slightly lower (small effect).',
    howToUse: 'Most useful around hard competitions or test days; it is optional, not a basic.',
    claimIds: ['tart_cherry'],
  },
  {
    id: 'caffeine_late',
    name: 'Caffeine late in the day',
    verdict: 'slows',
    summary: '400 mg of caffeine 6 hours before bed cut measured sleep by more than an hour, and people did not notice it themselves.',
    howToUse: 'Keep caffeine (coffee, energy drinks, pre-workout) to more than 6 hours before bedtime.',
    claimIds: ['caffeine_6h'],
  },
  {
    id: 'alcohol',
    name: 'Alcohol after training',
    verdict: 'slows',
    summary: 'A large amount of alcohol after training reduced muscle protein synthesis even when protein was taken too (study of 8 men, about 12 drinks).',
    howToUse: 'Avoid heavy drinking after hard sessions, especially when building muscle is the goal.',
    claimIds: ['alcohol_mps'],
  },
  {
    id: 'nsaids',
    name: 'Painkillers like ibuprofen, every day',
    verdict: 'slows',
    summary: 'A high daily dose (1,200 mg) for 8 weeks gave about half the muscle growth of a low aspirin dose and impaired strength gains.',
    howToUse: 'Do not use them routinely for normal training soreness. If you need them for pain or a medical reason, follow your doctor or pharmacist.',
    claimIds: ['nsaid_blunts'],
  },
  {
    id: 'antioxidants',
    name: 'High-dose vitamin C and E',
    verdict: 'slows',
    summary: 'High doses (1,000 mg C, 235 mg E) blunted training-induced mitochondrial changes, though fitness test results were not affected.',
    howToUse: 'Get vitamins from food; do not take high-dose antioxidant pills to speed recovery.',
    claimIds: ['antioxidant_blunts'],
  },
  {
    id: 'running_before_legs',
    name: 'Lots of running alongside lifting',
    verdict: 'slows',
    summary: 'Combining strength training with running (not cycling) reduced muscle and strength gains; more and longer endurance sessions mattered more.',
    howToUse: 'If muscle or strength is your goal, prefer cycling for cardio and keep long runs away from leg days.',
    claimIds: ['concurrent_running'],
  },
];
