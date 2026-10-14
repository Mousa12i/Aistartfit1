// Every scientific statement the Recovery Doctor, its PDF and the recovery AI coach make comes from this file.
//
// - RECOVERY_REFERENCES: the papers. Each one was checked against its abstract / record page (see README).
// - RECOVERY_CLAIMS: the exact wording that may be shown to a person, tied to the reference(s) that support it.
//   A claim says only what the abstract supports. Thresholds and rules that StartFit chose itself are kind
//   'design', are worded as "StartFit rule", and never borrow a citation.
//
// The recovery coach may only cite claim ids from this list (the server drops anything else).

import type { Reference } from '../../nutrition/evidence';
import { REFERENCES as NUTRITION_REFERENCES } from '../../nutrition/evidence';
import { TRAINING_REFERENCES } from '../../training/evidence';

const doi = (d: string) => `https://doi.org/${d}`;

export const RECOVERY_REFERENCES: Record<string, Reference> = {
  saw2016: {
    id: 'saw2016',
    short: 'Saw et al., 2016',
    citation: 'Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review. Br J Sports Med. 2016;50(5):281–291.',
    url: doi('10.1136/bjsports-2015-094758'),
  },
  hooper1995: {
    id: 'hooper1995',
    short: 'Hooper et al., 1995',
    citation: 'Hooper SL, Mackinnon LT, Howard A, Gordon RD, Bachmann AW. Markers for monitoring overtraining and recovery. Med Sci Sports Exerc. 1995;27(1):106–112.',
    url: doi('10.1249/00005768-199501000-00019'),
  },
  foster2001: {
    id: 'foster2001',
    short: 'Foster et al., 2001',
    citation: 'Foster C, Florhaug JA, Franklin J, et al. A new approach to monitoring exercise training. J Strength Cond Res. 2001;15(1):109–115.',
    url: doi('10.1519/00124278-200102000-00019'),
  },
  foster1998: {
    id: 'foster1998',
    short: 'Foster, 1998',
    citation: 'Foster C. Monitoring training in athletes with reference to overtraining syndrome. Med Sci Sports Exerc. 1998;30(7):1164–1168.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Monitoring+training+in+athletes+with+reference+to+overtraining+syndrome',
  },
  meeusen2013: {
    id: 'meeusen2013',
    short: 'Meeusen et al., 2013 (ECSS/ACSM)',
    citation: 'Meeusen R, Duclos M, Foster C, et al. Prevention, diagnosis and treatment of the overtraining syndrome: joint consensus statement of the European College of Sport Science and the American College of Sports Medicine. Eur J Sport Sci. 2013;13(1):1–24.',
    url: doi('10.1080/17461391.2012.730061'),
  },
  impellizzeri2021: {
    id: 'impellizzeri2021',
    short: 'Impellizzeri et al., 2021',
    citation: 'Impellizzeri FM, Woodcock S, Coutts AJ, Fanchini M, McCall A, Vigotsky AD. What role do chronic workloads play in the acute to chronic workload ratio? Time to dismiss ACWR and its underlying theory. Sports Med. 2021;51(3):581–592.',
    url: doi('10.1007/s40279-020-01378-6'),
  },
  morannavarro2017: {
    id: 'morannavarro2017',
    short: 'Morán-Navarro et al., 2017',
    citation: 'Morán-Navarro R, Pérez CE, Mora-Rodríguez R, et al. Time course of recovery following resistance training leading or not to failure. Eur J Appl Physiol. 2017;117(12):2387–2399.',
    url: doi('10.1007/s00421-017-3725-7'),
  },
  watson2015: {
    id: 'watson2015',
    short: 'Watson et al., 2015 (AASM/SRS)',
    citation: 'Watson NF, Badr MS, Belenky G, et al. Recommended amount of sleep for a healthy adult: a joint consensus statement of the American Academy of Sleep Medicine and Sleep Research Society. J Clin Sleep Med. 2015;11(6):591–592.',
    url: 'https://www.aasm.org/resources/pdf/adultsleepdurationconsensus.pdf',
  },
  craven2022: {
    id: 'craven2022',
    short: 'Craven et al., 2022',
    citation: 'Craven J, McCartney D, Desbrow B, et al. Effects of acute sleep loss on physical performance: a systematic and meta-analytical review. Sports Med. 2022;52(11):2669–2690.',
    url: doi('10.1007/s40279-022-01706-y'),
  },
  dupuy2018: {
    id: 'dupuy2018',
    short: 'Dupuy et al., 2018',
    citation: 'Dupuy O, Douzi W, Theurot D, Bosquet L, Dugué B. An evidence-based approach for choosing post-exercise recovery techniques to reduce markers of muscle damage, soreness, fatigue, and inflammation: a systematic review with meta-analysis. Front Physiol. 2018;9:403.',
    url: doi('10.3389/fphys.2018.00403'),
  },
  roberts2015: {
    id: 'roberts2015',
    short: 'Roberts et al., 2015',
    citation: 'Roberts LA, Raastad T, Markworth JF, et al. Post-exercise cold water immersion attenuates acute anabolic signalling and long-term adaptations in muscle to strength training. J Physiol. 2015;593(18):4285–4301.',
    url: doi('10.1113/JP270570'),
  },
  herbert2011: {
    id: 'herbert2011',
    short: 'Herbert et al., 2011 (Cochrane)',
    citation: 'Herbert RD, de Noronha M, Kamper SJ. Stretching to prevent or reduce muscle soreness after exercise. Cochrane Database Syst Rev. 2011;(7):CD004577.',
    url: doi('10.1002/14651858.CD004577.pub3'),
  },
  wiewelhove2019: {
    id: 'wiewelhove2019',
    short: 'Wiewelhove et al., 2019',
    citation: 'Wiewelhove T, Döweling A, Schneider C, et al. A meta-analysis of the effects of foam rolling on performance and recovery. Front Physiol. 2019;10:376.',
    url: doi('10.3389/fphys.2019.00376'),
  },
  brown2017: {
    id: 'brown2017',
    short: 'Brown et al., 2017',
    citation: 'Brown F, Gissane C, Howatson G, van Someren K, Pedlar C, Hill J. Compression garments and recovery from exercise: a meta-analysis. Sports Med. 2017;47(11):2245–2267.',
    url: doi('10.1007/s40279-017-0728-9'),
  },
  silbernagel2007: {
    id: 'silbernagel2007',
    short: 'Silbernagel et al., 2007',
    citation: 'Silbernagel KG, Thomeé R, Eriksson BI, Karlsson J. Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy: a randomized controlled study. Am J Sports Med. 2007;35(6):897–906.',
    url: doi('10.1177/0363546506298279'),
  },
  tietze2014: {
    id: 'tietze2014',
    short: 'Tietze & Borchers, 2014',
    citation: 'Tietze DC, Borchers J. Exertional rhabdomyolysis in the athlete: a clinical review. Sports Health. 2014;6(4):336–339.',
    url: doi('10.1177/1941738114523544'),
  },
  kim2016: {
    id: 'kim2016',
    short: 'Kim et al., 2016',
    citation: 'Kim J, Lee J, Kim S, Ryu HY, Cha KS, Sung DJ. Exercise-induced rhabdomyolysis mechanisms and prevention: a literature review. J Sport Health Sci. 2016;5(3):324–333.',
    url: doi('10.1016/j.jshs.2015.01.012'),
  },
  mcnulty2020: {
    id: 'mcnulty2020',
    short: 'McNulty et al., 2020',
    citation: 'McNulty KL, Elliott-Sale KJ, Dolan E, et al. The effects of menstrual cycle phase on exercise performance in eumenorrheic women: a systematic review and meta-analysis. Sports Med. 2020;50(10):1813–1827.',
    url: doi('10.1007/s40279-020-01319-3'),
  },
  // shared with the training and nutrition evidence lists (same verified records)
  knowles2018: TRAINING_REFERENCES.knowles2018,
  bell2023deload: TRAINING_REFERENCES.bell2023deload,
  morton2018: NUTRITION_REFERENCES.morton2018,
  mountjoy2023: NUTRITION_REFERENCES.mountjoy2023,
};

export type ClaimKind = 'study' | 'design';

export interface RecoveryClaim {
  id: string;
  kind: ClaimKind;
  text: string;
  refs: string[];
}

const study = (id: string, text: string, refs: string[]): RecoveryClaim => ({ id, kind: 'study', text, refs });
const design = (id: string, text: string): RecoveryClaim => ({ id, kind: 'design', text, refs: [] });

export const RECOVERY_CLAIMS: Record<string, RecoveryClaim> = Object.fromEntries(
  [
    // ---- monitoring how you feel ----
    study(
      'wellness_subjective',
      'A systematic review found that self-reported well-being reflected both short-term and longer-term training load with better sensitivity and consistency than commonly used objective measures (such as blood markers or heart rate), and that well-being usually worsened when training load rose sharply.',
      ['saw2016'],
    ),
    study(
      'wellness_hooper',
      'In swimmers followed through a season, simple self-reports of well-being were an efficient way to monitor both overtraining and recovery.',
      ['hooper1995'],
    ),
    design(
      'wellness_scale',
      'StartFit rule: the morning check-in asks five 1–5 questions (sleep quality, energy, muscle soreness, stress, mood; 5 = best). Your score is compared with your own average and spread over the last 28 days once you have at least 7 check-ins; a score more than one of your usual spreads below your average counts as "lower than usual".',
    ),
    // ---- session load ----
    study(
      'srpe_valid',
      'Session RPE (how hard the whole session felt on a 0–10 scale, multiplied by its minutes) is a valid way to measure the training load of a session.',
      ['foster2001'],
    ),
    study(
      'monotony_strain',
      'Training monotony is the week’s average daily load divided by its standard deviation, and strain is weekly load × monotony. In athletes followed over time, many illnesses happened when a person went above their own load, monotony and strain thresholds, mostly linked to strain; unremittingly heavy, monotonous training may raise the risk of overtraining.',
      ['foster1998'],
    ),
    design(
      'monotony_rule',
      'StartFit rule: monotony above 2.0 in a week with 3 or more sessions is flagged so you can add an easier day or a rest day; weekly load changes are shown as a percentage of your previous 4-week average, as information, not as an injury prediction.',
    ),
    study(
      'acwr_caution',
      'The acute:chronic workload ratio has been criticised as a framework: a 2021 analysis recommended dismissing it, because its predictive value for injury is not supported. StartFit therefore does not use it to predict injuries.',
      ['impellizzeri2021'],
    ),
    design(
      'decision_rule',
      'StartFit rule: today’s decision combines your morning check-in with your own baseline, last night’s sleep, the estimated recovery of the muscles your next workout trains, recent pain reports and this week’s monotony. One or two warning signs give "Adjust"; three or more, a check-in two of your usual spreads below your average, or under 5 hours of sleep give "Easy". "Go" = train as planned; "Adjust" = train, but stop sets 2–3 reps short of failure and skip max attempts or swap to recovered muscles; "Easy" = about half your usual sets at 3–4 reps in reserve, or light cardio and mobility; "Stop" = a red-flag symptom was reported, so get checked by a clinician first.',
    ),
    // ---- overreaching ----
    study(
      'ots_consensus',
      'The ECSS/ACSM consensus describes overtraining as a state with symptoms such as fatigue, performance decline and mood disturbances; no single marker meets all criteria to be generally accepted, the diagnosis depends on clinical outcome and exclusion of other causes, and training should avoid the combination of excessive overload plus inadequate recovery.',
      ['meeusen2013'],
    ),
    study(
      'deload_concept',
      'A deload is a planned reduction in training stress. An international expert consensus found no agreed fixed timing or length, so deloads are best used when tiredness or performance say so.',
      ['bell2023deload'],
    ),
    design(
      'deload_rule',
      'StartFit rule: a lighter week (about half the sets, same exercises, 3–4 reps in reserve) is suggested when at least two of these are true: performance on a main lift dropped more than 5% versus its recent average, 3 or more of your last 5 check-ins were lower than usual, monotony was above 2.0, or 6 or more weeks have passed since your last lighter week.',
    ),
    // ---- muscle recovery estimate ----
    study(
      'failure_recovery',
      'Training to failure considerably increases the time needed for neuromuscular function to recover; in one study, sets stopped short of failure recovered faster between 24 and 48 hours after the session.',
      ['morannavarro2017'],
    ),
    design(
      'recovery_estimate',
      'StartFit rule: the muscle recovery percentage is an estimate from your logged sets, effort (RIR), soreness, sleep and personal history (36, 48 or 72 hours as a starting point for small, medium and large muscles). It is not a measurement of muscle damage.',
    ),
    // ---- sleep ----
    study(
      'sleep_7h',
      'Adults should sleep 7 or more hours per night on a regular basis to promote optimal health; more than 9 hours may be appropriate for young adults, people recovering from sleep debt, or people who are ill.',
      ['watson2015'],
    ),
    study(
      'sleep_loss_perf',
      'A meta-analysis found that acute sleep loss lowered exercise performance by about 7.6% on average, with roughly a 0.4% drop for every extra hour awake before exercising; the effect was seen with total sleep deprivation and late-night sleep restriction, and the authors suggest prioritising morning exercise when sleep loss cannot be avoided.',
      ['craven2022'],
    ),
    study(
      'sleep_strength',
      'Inadequate sleep impairs maximal strength, especially in compound (multi-joint) lifts.',
      ['knowles2018'],
    ),
    design(
      'sleep_debt_rule',
      'StartFit rule: sleep debt is the sum of hours below 7 over the last 7 logged nights. Regularity is the spread of your sleep hours; a spread above 1 hour is shown as irregular.',
    ),
    // ---- recovery methods ----
    study(
      'massage_doms',
      'A meta-analysis of 99 studies found massage was the most effective technique for recovering from delayed-onset muscle soreness (DOMS) and fatigue.',
      ['dupuy2018'],
    ),
    study(
      'methods_doms',
      'The same meta-analysis found that cold-water immersion, contrast water therapy, cryotherapy, active recovery and compression reduced DOMS (small to large effects), and that perceived fatigue was managed effectively with compression.',
      ['dupuy2018'],
    ),
    study(
      'cwi_blunts',
      'In a 12-week strength study, strength and muscle mass increased more with active recovery than with regular cold-water immersion after sessions; the authors concluded that cold-water immersion as a regular post-exercise recovery strategy should be reconsidered.',
      ['roberts2015'],
    ),
    study(
      'stretch_no_doms',
      'A Cochrane review concluded that muscle stretching, before, after, or before and after exercise, does not produce clinically important reductions in delayed-onset muscle soreness in healthy adults.',
      ['herbert2011'],
    ),
    study(
      'foam_roll',
      'A meta-analysis found that foam rolling after exercise slightly reduced muscle pain perception (about 6%) and slightly helped sprint and strength recovery, and that the evidence justifies foam rolling more as a warm-up activity than as a recovery tool.',
      ['wiewelhove2019'],
    ),
    study(
      'compression',
      'A meta-analysis found that compression garments helped strength recovery most, especially 2–8 hours and more than 24 hours after exercise, and most effectively after resistance exercise.',
      ['brown2017'],
    ),
    study(
      'protein_plateau',
      'For building muscle with resistance training, the benefit of extra protein levels off at about 1.6 g per kg of body weight per day.',
      ['morton2018'],
    ),
    study(
      'reds',
      'The IOC consensus describes Relative Energy Deficiency in Sport (REDs): too little energy intake for the training done can impair health and performance.',
      ['mountjoy2023'],
    ),
    // ---- pain, return to training, red flags ----
    study(
      'pain_monitoring',
      'In a randomised trial of people with Achilles tendinopathy, continuing activity guided by a pain-monitoring model gave the same improvement as rest from that activity, with no negative effects shown.',
      ['silbernagel2007'],
    ),
    design(
      'rtt_rule',
      'StartFit rule (adapted from the pain-monitoring approach, not taken from the study): during an exercise, pain up to 3/10 is acceptable; the next morning pain and stiffness should be no worse than usual. Move up a stage after 2 sessions in a row that meet both; go back a stage if pain goes above 5/10 or is worse the next morning. Severe, worsening or unusual pain needs a clinician.',
    ),
    study(
      'rhabdo_signs',
      'Exertional rhabdomyolysis is uncommon but potentially fatal: the person has pain, weakness and swelling in the affected muscles, and high myoglobin can turn urine dark (tea or cola coloured). Darkened urine is a reason for hospital assessment.',
      ['tietze2014'],
    ),
    study(
      'rhabdo_risk',
      'Exercise-induced rhabdomyolysis may cause acute kidney failure; past studies linked it with excessive eccentric (lowering) work in high temperatures, abnormal electrolyte balance and nutritional deficiencies.',
      ['kim2016'],
    ),
    design(
      'triage_rule',
      'StartFit rule, not a diagnosis: any red-flag symptom (dark urine, chest pain, fainting, numbness, a joint giving way, sudden sharp pain or swelling out of proportion) means stop training and get medical help. Pain 5/10 or more, swelling, bruising or lost movement means train around the area and see a clinician if it is not improving.',
    ),
    // ---- menstrual cycle ----
    study(
      'cycle_trivial',
      'A meta-analysis found that, on average, performance may be trivially lower in the early follicular phase (the first days of the period), but the evidence was low quality and the authors concluded that general guidelines cannot be formed; a personalised approach is recommended.',
      ['mcnulty2020'],
    ),
    // ---- personal insights ----
    design(
      'nof1_rule',
      'StartFit rule: "what works for you" compares your own days (for example after 7+ hours of sleep vs less). A comparison is shown only when each side has at least 5 days, and only called a pattern when the difference is at least half of your usual day-to-day spread. These are observations from your data, not proof of cause.',
    ),
  ].map((c) => [c.id, c]),
);

export function recoveryClaim(id: string): RecoveryClaim | undefined {
  return RECOVERY_CLAIMS[id];
}

/** References behind a list of claim ids, in first-use order and without repeats. */
export function referencesForRecoveryClaims(claimIds: string[]): Reference[] {
  const seen = new Set<string>();
  const out: Reference[] = [];
  for (const id of claimIds) {
    for (const ref of RECOVERY_CLAIMS[id]?.refs ?? []) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      const r = RECOVERY_REFERENCES[ref];
      if (r) out.push(r);
    }
  }
  return out;
}
