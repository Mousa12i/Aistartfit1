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
  // ---- added 2026-10-15: each checked against its abstract / record page ----
  stultskolehmainen2014: {
    id: 'stultskolehmainen2014',
    short: 'Stults-Kolehmainen et al., 2014',
    citation: 'Stults-Kolehmainen MA, Bartholomew JB, Sinha R. Chronic psychological stress impairs recovery of muscular function and somatic sensations over a 96-hour period. J Strength Cond Res. 2014;28(7):2007–2017.',
    url: doi('10.1519/JSC.0000000000000335'),
  },
  nosaka2011: {
    id: 'nosaka2011',
    short: 'Nosaka & Aoki, 2011',
    citation: 'Nosaka K, Aoki MS. Repeated bout effect: research update and future perspective. Brazilian Journal of Biomotricity. 2011;5(1):5–15.',
    url: 'https://ro.ecu.edu.au/ecuworks2011/697',
  },
  wilson2012: {
    id: 'wilson2012',
    short: 'Wilson et al., 2012',
    citation: 'Wilson JM, Marin PJ, Rhea MR, Wilson SMC, Loenneke JP, Anderson JC. Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. J Strength Cond Res. 2012;26(8):2293–2307.',
    url: 'https://search.pedro.org.au/search-results/record-detail/34457',
  },
  drake2013: {
    id: 'drake2013',
    short: 'Drake et al., 2013',
    citation: 'Drake C, et al. Study of 400 mg caffeine taken 0, 3 or 6 hours before bed (J Clin Sleep Med, 2013), as reported by the American Academy of Sleep Medicine.',
    url: 'https://sleepeducation.org/late-afternoon-and-early-evening-caffeine-can-disrupt-sleep/',
  },
  cunha2023: {
    id: 'cunha2023',
    short: 'Sleep interventions review, 2023',
    citation: 'The impact of sleep interventions on athletic performance: a systematic review. Sports Medicine – Open. 2023.',
    url: 'https://doaj.org/article/5ee80b4fd72f4fa790b4324f051df07c',
  },
  schoenfeld2018meal: {
    id: 'schoenfeld2018meal',
    short: 'Schoenfeld & Aragon, 2018',
    citation: 'Schoenfeld BJ, Aragon AA. How much protein can the body use in a single meal for muscle-building? Implications for daily protein distribution. J Int Soc Sports Nutr. 2018;15:10.',
    url: doi('10.1186/s12970-018-0215-1'),
  },
  kerksick2017: {
    id: 'kerksick2017',
    short: 'Kerksick et al., 2017 (ISSN)',
    citation: 'Kerksick CM, et al. International Society of Sports Nutrition position stand: nutrient timing. J Int Soc Sports Nutr. 2017.',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5596471/',
  },
  res2012: {
    id: 'res2012',
    short: 'Res et al., 2012',
    citation: 'Res PT, Groen B, Pennings B, et al. Protein ingestion before sleep improves postexercise overnight recovery. Med Sci Sports Exerc. 2012;44(8):1560–1569.',
    url: doi('10.1249/MSS.0b013e31824cc363'),
  },
  kreider2017: {
    id: 'kreider2017',
    short: 'Kreider et al., 2017 (ISSN)',
    citation: 'Kreider RB, Kalman DS, Antonio J, et al. International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine. J Int Soc Sports Nutr. 2017;14.',
    url: doi('10.1186/s12970-017-0173-z'),
  },
  hill2021: {
    id: 'hill2021',
    short: 'Hill et al., 2021',
    citation: 'Hill JA, Keane KM, Quinlan R, Howatson G. Tart cherry supplementation and recovery from strenuous exercise: a systematic review and meta-analysis. Int J Sport Nutr Exerc Metab. 2021;31(2):154–167.',
    url: doi('10.1123/ijsnem.2020-0145'),
  },
  lilja2018: {
    id: 'lilja2018',
    short: 'Lilja et al. (Karolinska), 2017',
    citation: 'Lilja M, et al. Karolinska Institutet trial of high-dose ibuprofen (1,200 mg/day) vs low-dose aspirin (75 mg/day) during 8 weeks of resistance training, as reported by Karolinska Institutet.',
    url: 'https://news.ki.se/anti-inflammatory-drugs-can-inhibit-muscle-growth',
  },
  parr2014: {
    id: 'parr2014',
    short: 'Parr et al., 2014',
    citation: 'Parr EB, et al. Alcohol ingestion impairs maximal post-exercise rates of myofibrillar protein synthesis following a single bout of concurrent training. PLoS One. 2014;9(2):e88384.',
    url: doi('10.1371/journal.pone.0088384'),
  },
  paulsen2014: {
    id: 'paulsen2014',
    short: 'Paulsen et al., 2014',
    citation: 'Paulsen G, et al. Randomised, double-blind trial of vitamin C and E supplementation during 11 weeks of endurance training (J Physiol, 2014), as reported by The Physiological Society.',
    url: 'https://www.physoc.org/?p=70729',
  },
  coleman2024: {
    id: 'coleman2024',
    short: 'Coleman et al., 2024',
    citation: 'Coleman M, et al. Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations. PeerJ. 2024;12:e16777.',
    url: doi('10.7717/peerj.16777'),
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
    // ---- added 2026-10-15: stress, new exercises, sleep, nutrition, what slows recovery ----
    study(
      'stress_recovery',
      'In 31 students followed for 96 hours after a hard leg session, higher psychological stress was associated with slower recovery of maximal strength, energy, fatigue and soreness; the authors concluded that people under high stress may need longer to recover.',
      ['stultskolehmainen2014'],
    ),
    design(
      'stress_rule',
      'StartFit rule: if a check-in from today or yesterday reports high stress (8–10 of 10, or "stressed"/"very stressed"), the recovery time is extended by 10%. The study shows the direction of the effect, not its size, so 10% is our cautious choice.',
    ),
    study(
      'repeated_bout',
      'After unaccustomed eccentric exercise, muscles are damaged more than when the same exercise is repeated later: the first bout protects against damage from the next one (the "repeated bout effect"), and the protection can last up to several months.',
      ['nosaka2011'],
    ),
    design(
      'novelty_rule',
      'StartFit rule: if your last session for a muscle included an exercise that mainly trains it and that you had not done in the previous 8 weeks, 12 hours are added (not on top of the extra for high soreness). It only applies once you have 4 or more weeks of logged history, because before that we cannot know what is new to you.',
    ),
    study(
      'concurrent_running',
      'A meta-analysis of 21 studies found that combining strength training with running, but not cycling, reduced gains in muscle size and strength, and that more frequent and longer endurance sessions were linked with smaller strength, size and power gains.',
      ['wilson2012'],
    ),
    study(
      'sleep_extension_naps',
      'A systematic review of 25 studies in athletes found that sleeping longer at night and napping were the most effective sleep interventions for performance; sleep hygiene advice alone, and removing electronic devices at night, showed no effect in the few studies available.',
      ['cunha2023'],
    ),
    study(
      'caffeine_6h',
      'In 12 healthy sleepers, 400 mg of caffeine (about 2–3 cups of coffee) taken 6 hours before bed reduced measured total sleep by more than one hour, and people did not notice the disruption themselves.',
      ['drake2013'],
    ),
    study(
      'protein_per_meal',
      'To maximise muscle building, a review recommended about 0.4 g of protein per kg of body weight per meal across at least four meals, reaching at least 1.6 g/kg/day, with 2.2 g/kg/day as an upper daily intake.',
      ['schoenfeld2018meal'],
    ),
    study(
      'post_exercise_protein',
      'The ISSN position stand reports that 20–40 g of protein (0.25–0.40 g/kg per dose) every 3–4 hours most favourably affects muscle protein synthesis, that high-quality protein from right after exercise to 2 hours later stimulates it strongly, and that 30–40 g of casein before sleep raises muscle protein synthesis overnight.',
      ['kerksick2017'],
    ),
    study(
      'presleep_protein',
      'In 16 young men who trained in the evening, 40 g of casein 30 minutes before sleep improved whole-body protein balance overnight; muscle protein synthesis was about 22% higher, a borderline-significant result.',
      ['res2012'],
    ),
    study(
      'fast_refuel',
      'When there are less than 4 hours to recover before the next session, the ISSN recommends aggressive carbohydrate refeeding of about 1.2 g/kg per hour (or 0.8 g/kg/h with 0.2–0.4 g/kg/h of protein).',
      ['kerksick2017'],
    ),
    study(
      'creatine_recovery',
      'The ISSN position stand states that creatine supplementation may improve recovery and help tolerate heavy training, and is safe and well tolerated in healthy people at the doses studied.',
      ['kreider2017'],
    ),
    study(
      'tart_cherry',
      'A meta-analysis of 14 studies found tart cherry supplementation improved recovery of muscle strength (moderate effect) and slightly reduced soreness (small effect), with no effect on creatine kinase.',
      ['hill2021'],
    ),
    study(
      'nsaid_blunts',
      'In young adults training their thighs for 8 weeks, a high daily dose of ibuprofen (1,200 mg) led to about half the muscle growth of a low dose of aspirin (75 mg), and also impaired strength gains.',
      ['lilja2018'],
    ),
    study(
      'alcohol_mps',
      'In 8 active men, drinking a large amount of alcohol (1.5 g/kg, about 12 standard drinks) after training reduced muscle protein synthesis, even when protein was taken with it.',
      ['parr2014'],
    ),
    study(
      'antioxidant_blunts',
      'In a randomised, double-blind trial of 54 people doing 11 weeks of endurance training, high-dose vitamin C (1,000 mg) and E (235 mg) blunted the rise in mitochondrial proteins, although maximal oxygen uptake and running test results were not affected.',
      ['paulsen2014'],
    ),
    study(
      'deload_full_stop',
      'In a 9-week trial of 39 trained young adults, stopping resistance training for one week mid-programme gave similar muscle growth but somewhat smaller lower-body strength gains than training straight through (not conclusive); the authors suggest using full breaks sparingly when maximal strength is the goal.',
      ['coleman2024'],
    ),
    design(
      'tonight_rule',
      'StartFit rule: tonight’s plan suggests enough time in bed for 7+ hours (more after a short night), no caffeine in the 6 hours before bed, and, on a training day, part of your remaining protein as a 30–40 g serving before sleep.',
    ),
    design(
      'feedback_rule',
      'StartFit rule: when you tell us a muscle feels ready while the estimate is under 70%, or still sore while it is 90% or more, that muscle’s personal multiplier moves 0.05 towards what you felt (kept between 0.7 and 1.4). It is a slow, bounded adjustment, not a measurement.',
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
