// Recovery methods library. Every "verdict" is a short summary of the cited claims, never more.

export type Verdict = 'helps' | 'some' | 'no' | 'careful';

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
};

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
];
