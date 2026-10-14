// Every statement the training engine, the PDF and the AI coach make about science comes from this file.
//
// - REFERENCES: the papers. Each one was found through its DOI record.
// - CLAIMS: the exact wording that may be shown to a person, tied to the reference(s) that support it.
//   A claim says only what the source supports. Where a rule is a StartFit design choice rather than
//   a study result, its kind is 'design' and the wording says so; it never borrows a citation.
//
// The AI coach may only cite claim ids from this file (the server rejects anything else), and the
// plan PDF prints the references behind every claim it uses.

import type { Reference } from '../nutrition/evidence';

const doi = (d: string) => `https://doi.org/${d}`;

export const TRAINING_REFERENCES: Record<string, Reference> = {
  schoenfeld2017vol: {
    id: 'schoenfeld2017vol',
    short: 'Schoenfeld et al., 2017',
    citation: 'Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci. 2017;35(11):1073–1082.',
    url: doi('10.1080/02640414.2016.1210197'),
  },
  pelland2026: {
    id: 'pelland2026',
    short: 'Pelland et al., 2026',
    citation: 'Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. The resistance training dose response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gains. Sports Med. 2026;56(2):481–505.',
    url: doi('10.1007/s40279-025-02344-w'),
  },
  iversen2021: {
    id: 'iversen2021',
    short: 'Iversen et al., 2021',
    citation: 'Iversen VM, Norum M, Schoenfeld BJ, Fimland MS. No time to lift? Designing time-efficient training programs for strength and hypertrophy: a narrative review. Sports Med. 2021;51(10):2079–2095.',
    url: doi('10.1007/s40279-021-01490-1'),
  },
  schoenfeld2016freq: {
    id: 'schoenfeld2016freq',
    short: 'Schoenfeld et al., 2016',
    citation: 'Schoenfeld BJ, Ogborn D, Krieger JW. Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. Sports Med. 2016;46(11):1689–1697.',
    url: doi('10.1007/s40279-016-0543-8'),
  },
  schoenfeld2019freq: {
    id: 'schoenfeld2019freq',
    short: 'Schoenfeld et al., 2019',
    citation: 'Schoenfeld BJ, Grgic J, Krieger J. How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis of studies examining the effects of resistance training frequency. J Sports Sci. 2019;37(11):1286–1295.',
    url: doi('10.1080/02640414.2018.1555906'),
  },
  grgic2018freq: {
    id: 'grgic2018freq',
    short: 'Grgic et al., 2018 (frequency)',
    citation: 'Grgic J, Schoenfeld BJ, Davies TB, Lazinica B, Krieger JW, Pedisic Z. Effect of resistance training frequency on gains in muscular strength: a systematic review and meta-analysis. Sports Med. 2018;48(5):1207–1220.',
    url: doi('10.1007/s40279-018-0872-x'),
  },
  schoenfeld2017load: {
    id: 'schoenfeld2017load',
    short: 'Schoenfeld et al., 2017 (load)',
    citation: 'Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and hypertrophy adaptations between low- vs. high-load resistance training: a systematic review and meta-analysis. J Strength Cond Res. 2017;31(12):3508–3523.',
    url: doi('10.1519/JSC.0000000000002200'),
  },
  refalo2023: {
    id: 'refalo2023',
    short: 'Refalo et al., 2023',
    citation: 'Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy: a systematic review with meta-analysis. Sports Med. 2023;53(3):649–665.',
    url: doi('10.1007/s40279-022-01784-y'),
  },
  robinson2024: {
    id: 'robinson2024',
    short: 'Robinson et al., 2024',
    citation: 'Robinson ZP, Pelland JC, Remmert JF, et al. Exploring the dose-response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy: a series of meta-regressions. Sports Med. 2024;54(9):2209–2231.',
    url: doi('10.1007/s40279-024-02069-2'),
  },
  grgic2018rest: {
    id: 'grgic2018rest',
    short: 'Grgic et al., 2018 (rest)',
    citation: 'Grgic J, Schoenfeld BJ, Skrepnik M, Davies TB, Mikulic P. Effects of rest interval duration in resistance training on measures of muscular strength: a systematic review. Sports Med. 2018;48(1):137–151.',
    url: doi('10.1007/s40279-017-0788-x'),
  },
  schoenfeld2016rest: {
    id: 'schoenfeld2016rest',
    short: 'Schoenfeld et al., 2016 (rest)',
    citation: 'Schoenfeld BJ, Pope ZK, Benik FM, et al. Longer interset rest periods enhance muscle strength and hypertrophy in resistance-trained men. J Strength Cond Res. 2016;30(7):1805–1812.',
    url: doi('10.1519/JSC.0000000000001272'),
  },
  helms2016rir: {
    id: 'helms2016rir',
    short: 'Helms et al., 2016',
    citation: 'Helms ER, Cronin J, Storey A, Zourdos MC. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J. 2016;38(4):42–49.',
    url: doi('10.1519/SSC.0000000000000218'),
  },
  zourdos2016rir: {
    id: 'zourdos2016rir',
    short: 'Zourdos et al., 2016',
    citation: 'Zourdos MC, Klemp A, Dolan C, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res. 2016;30(1):267–275.',
    url: doi('10.1519/JSC.0000000000001049'),
  },
  plotkin2022: {
    id: 'plotkin2022',
    short: 'Plotkin et al., 2022',
    citation: 'Plotkin D, Coleman M, Van Every D, et al. Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations. PeerJ. 2022;10:e14142.',
    url: doi('10.7717/peerj.14142'),
  },
  acsm2009: {
    id: 'acsm2009',
    short: 'ACSM, 2009',
    citation: 'American College of Sports Medicine. American College of Sports Medicine position stand: progression models in resistance training for healthy adults. Med Sci Sports Exerc. 2009;41(3):687–708.',
    url: doi('10.1249/MSS.0b013e3181915670'),
  },
  bell2023deload: {
    id: 'bell2023deload',
    short: 'Bell et al., 2023',
    citation: 'Bell L, Strafford BW, Coleman M, Androulakis Korakakis P, Nolan D. Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach. Sports Med Open. 2023;9:87.',
    url: doi('10.1186/s40798-023-00633-0'),
  },
  who2020: {
    id: 'who2020',
    short: 'Bull et al., 2020 (WHO)',
    citation: 'Bull FC, Al-Ansari SS, Biddle S, et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. Br J Sports Med. 2020;54(24):1451–1462.',
    url: doi('10.1136/bjsports-2020-102955'),
  },
  garber2011: {
    id: 'garber2011',
    short: 'Garber et al., 2011 (ACSM)',
    citation: 'Garber CE, Blissmer B, Deschenes MR, et al. American College of Sports Medicine position stand: quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy adults: guidance for prescribing exercise. Med Sci Sports Exerc. 2011;43(7):1334–1359.',
    url: doi('10.1249/MSS.0b013e318213fefb'),
  },
  wewege2017: {
    id: 'wewege2017',
    short: 'Wewege et al., 2017',
    citation: 'Wewege M, van den Berg R, Ward RE, Keech A. The effects of high-intensity interval training vs. moderate-intensity continuous training on body composition in overweight and obese adults: a systematic review and meta-analysis. Obes Rev. 2017;18(6):635–646.',
    url: doi('10.1111/obr.12532'),
  },
  wewege2022: {
    id: 'wewege2022',
    short: 'Wewege et al., 2022',
    citation: 'Wewege MA, Desai I, Honey C, et al. The effect of resistance training in healthy adults on body fat percentage, fat mass and visceral fat: a systematic review and meta-analysis. Sports Med. 2022;52(2):287–300.',
    url: doi('10.1007/s40279-021-01562-2'),
  },
  schumann2022: {
    id: 'schumann2022',
    short: 'Schumann et al., 2022',
    citation: 'Schumann M, Feuerbacher JF, Sünkeler M, et al. Compatibility of concurrent aerobic and strength training for skeletal muscle size and function: an updated systematic review and meta-analysis. Sports Med. 2022;52(3):601–612.',
    url: doi('10.1007/s40279-021-01587-7'),
  },
  knowles2018: {
    id: 'knowles2018',
    short: 'Knowles et al., 2018',
    citation: 'Knowles OE, Drinkwater EJ, Urwin CS, Lamon S, Aisbett B. Inadequate sleep and muscle strength: implications for resistance training. J Sci Med Sport. 2018;21(9):959–968.',
    url: doi('10.1016/j.jsams.2018.01.012'),
  },
  fradkin2010: {
    id: 'fradkin2010',
    short: 'Fradkin et al., 2010',
    citation: 'Fradkin AJ, Zazryn TR, Smoliga JM. Effects of warming-up on physical performance: a systematic review with meta-analysis. J Strength Cond Res. 2010;24(1):140–148.',
    url: doi('10.1519/JSC.0b013e3181c643a0'),
  },
  lauersen2014: {
    id: 'lauersen2014',
    short: 'Lauersen et al., 2014',
    citation: 'Lauersen JB, Bertelsen DM, Andersen LB. The effectiveness of exercise interventions to prevent sports injuries: a systematic review and meta-analysis of randomised controlled trials. Br J Sports Med. 2014;48(11):871–877.',
    url: doi('10.1136/bjsports-2013-092538'),
  },
  hayden2021: {
    id: 'hayden2021',
    short: 'Hayden et al., 2021 (Cochrane)',
    citation: 'Hayden JA, Ellis J, Ogilvie R, Malmivaara A, van Tulder MW. Exercise therapy for chronic low back pain. Cochrane Database Syst Rev. 2021;9:CD009790.',
    url: doi('10.1002/14651858.CD009790.pub2'),
  },
  riebe2015: {
    id: 'riebe2015',
    short: 'Riebe et al., 2015 (ACSM)',
    citation: 'Riebe D, Franklin BA, Thompson PD, et al. Updating ACSM\'s recommendations for exercise preparticipation health screening. Med Sci Sports Exerc. 2015;47(11):2473–2479.',
    url: doi('10.1249/MSS.0000000000000664'),
  },
  acog2020: {
    id: 'acog2020',
    short: 'ACOG, 2020',
    citation: 'American College of Obstetricians and Gynecologists. ACOG Committee Opinion No. 804: physical activity and exercise during pregnancy and the postpartum period. Obstet Gynecol. 2020;135(4):e178–e188.',
    url: doi('10.1097/AOG.0000000000003772'),
  },
  fragala2019: {
    id: 'fragala2019',
    short: 'Fragala et al., 2019 (NSCA)',
    citation: 'Fragala MS, Cadore EL, Dorgo S, et al. Resistance training for older adults: position statement from the National Strength and Conditioning Association. J Strength Cond Res. 2019;33(8):2019–2052.',
    url: doi('10.1519/JSC.0000000000003230'),
  },
  faigenbaum2009: {
    id: 'faigenbaum2009',
    short: 'Faigenbaum et al., 2009 (NSCA)',
    citation: 'Faigenbaum AD, Kraemer WJ, Blimkie CJ, et al. Youth resistance training: updated position statement paper from the National Strength and Conditioning Association. J Strength Cond Res. 2009;23(5 Suppl):S60–S79.',
    url: doi('10.1519/JSC.0b013e31819df407'),
  },
};

export type ClaimKind = 'study' | 'design';

export interface Claim {
  id: string;
  kind: ClaimKind;
  /** Exact wording shown to people. */
  text: string;
  /** References that support the wording (empty for design choices). */
  refs: string[];
}

const study = (id: string, text: string, refs: string[]): Claim => ({ id, kind: 'study', text, refs });
const design = (id: string, text: string): Claim => ({ id, kind: 'design', text, refs: [] });

export const CLAIMS: Record<string, Claim> = Object.fromEntries(
  [
    // ---- weekly volume ----
    study(
      'vol_dose',
      'More weekly hard sets per muscle group go with more muscle growth, with diminishing returns. In one meta-analysis, people doing 10 or more weekly sets per muscle gained more on average than people doing fewer than 5 (9.8% vs 5.4%), although that category difference was not robust in sensitivity analyses.',
      ['schoenfeld2017vol'],
    ),
    study(
      'vol_fractional',
      'A 2026 meta-regression found that more weekly volume increases both muscle size and strength with diminishing returns, and that counting a set as one set for the main muscle and half a set for helping muscles (fractional counting) fitted the results best. StartFit counts sets this way.',
      ['pelland2026'],
    ),
    study(
      'vol_minimum',
      'About 4 or more hard sets per muscle group per week has been described as a time-efficient minimum for strength and muscle, using loads of roughly 6–15 repetitions maximum, and weekly volume matters more than how it is split across days.',
      ['iversen2021'],
    ),
    design(
      'vol_session_cap',
      'StartFit design choice, not a study result: no more than about 10 effective sets for one muscle in one session, so sessions stay manageable and each set is taken seriously.',
    ),
    // ---- frequency ----
    study(
      'freq_hypertrophy',
      'Meta-analyses disagree a little on frequency. A 2016 analysis found training a muscle twice a week grew more muscle than once a week, on a volume-equated basis. A 2019 analysis found no significant difference when volume was equated, and a 2026 meta-regression found frequency had a negligible effect on growth. Training each muscle on two or more days is therefore a safe default, mainly useful for spreading the weekly sets.',
      ['pelland2026', 'schoenfeld2019freq', 'schoenfeld2016freq'],
    ),
    study(
      'freq_strength',
      'Higher training frequencies gave greater strength gains in a meta-analysis, but when volume was equated there was no significant effect of frequency on strength.',
      ['grgic2018freq'],
    ),
    study(
      'acsm_days',
      'The ACSM position stand on progression recommends training 2–3 days a week for novices, 3–4 days for intermediate and 4–5 days for advanced training.',
      ['acsm2009'],
    ),
    // ---- load and effort ----
    study(
      'load_range',
      'Low loads (60% of the one-repetition maximum or less) and high loads (above 60%) produced similar muscle growth, while high loads produced greater gains in maximal (1RM) strength.',
      ['schoenfeld2017load'],
    ),
    study(
      'failure_optional',
      'A meta-analysis found no clear advantage of training to complete failure over stopping short of it for muscle growth.',
      ['refalo2023'],
    ),
    study(
      'failure_proximity',
      'A series of meta-regressions found that muscle growth tended to improve the closer sets were taken to failure, while strength gains were similar across the range.',
      ['robinson2024'],
    ),
    study(
      'rir_scale',
      'Rating each set by how many more repetitions you could have done (repetitions in reserve, RIR) has been proposed as a resistance-training effort scale that lets loads be adjusted set by set to how you perform on the day.',
      ['helms2016rir'],
    ),
    design(
      'rir_start_easier',
      'StartFit design choice: new lifters start with more repetitions in reserve (3 or more) because judging effort takes practice, then move closer to failure as their technique and effort judgement improve.',
    ),
    // ---- rest ----
    study(
      'rest_intervals',
      'A systematic review found strength gains were greater with rests of more than 2 minutes in trained people, while 60–120 seconds worked for untrained people.',
      ['grgic2018rest'],
    ),
    study(
      'rest_hypertrophy',
      'In resistance-trained men, 3-minute rests between sets produced greater strength and thigh-muscle growth than 1-minute rests.',
      ['schoenfeld2016rest'],
    ),
    // ---- progression ----
    study(
      'progress_both',
      'Adding load and adding repetitions are both workable ways to progress, with similar muscle growth in a controlled trial.',
      ['plotkin2022'],
    ),
    study(
      'progress_increase',
      'The ACSM position stand recommends a 2–10% increase in load when you can perform the current workload for one to two repetitions over the desired number.',
      ['acsm2009'],
    ),
    study(
      'exercise_order',
      'The ACSM position stand recommends doing large-muscle-group exercises before small ones, and multiple-joint exercises before single-joint exercises.',
      ['acsm2009'],
    ),
    study(
      'deload_concept',
      'A deload is a planned reduction in training stress. An international expert consensus found no agreed fixed timing or length, so deloads are best used when tiredness or performance say so.',
      ['bell2023deload'],
    ),
    design(
      'deload_rule',
      'StartFit design choice: a lighter week with roughly half the sets, same movements and easy loads, offered after week 5 or earlier if performance drops for 2 sessions in a row.',
    ),
    // ---- cardio and body composition ----
    study(
      'who_activity',
      'WHO 2020 guidelines: all adults should do 150–300 minutes of moderate-intensity or 75–150 minutes of vigorous-intensity physical activity a week, and regular muscle-strengthening activity is recommended for all age groups.',
      ['who2020'],
    ),
    study(
      'hiit_time',
      'High-intensity intervals and moderate continuous cardio produced similar, modest body-composition changes in overweight adults, and intervals took less time.',
      ['wewege2017'],
    ),
    study(
      'concurrent',
      'Adding aerobic training to strength training did not reduce muscle growth or maximal strength in a meta-analysis, but explosive strength was reduced, especially when both were done in the same session. Separating them by about 3 hours or more is suggested.',
      ['schumann2022'],
    ),
    study(
      'rt_body_fat',
      'Resistance training in healthy adults lowered body-fat percentage and fat mass in a meta-analysis (about −1.5 percentage points of body fat and −0.55 kg of fat mass on average).',
      ['wewege2022'],
    ),
    study(
      'injury_prevention',
      'In trials of exercise to prevent sports injuries, strength training reduced injuries, while stretching alone did not.',
      ['lauersen2014'],
    ),
    study(
      'sleep_strength',
      'Inadequate sleep impairs maximal strength, especially in compound (multi-joint) lifts.',
      ['knowles2018'],
    ),
    study(
      'warmup',
      'A systematic review with meta-analysis found that warming up improved performance in 79% of the outcomes examined, with little evidence that it is harmful.',
      ['fradkin2010'],
    ),
    // ---- health, age, pregnancy ----
    study(
      'screening_acsm',
      'ACSM pre-participation screening is based on three things: your current level of physical activity, any signs or symptoms and/or known cardiovascular, metabolic or kidney disease, and how hard you intend to exercise.',
      ['riebe2015'],
    ),
    study(
      'pregnancy_eval',
      'ACOG advises a thorough clinical evaluation before recommending an exercise program during pregnancy.',
      ['acog2020'],
    ),
    study(
      'youth_rt',
      'The NSCA has published an updated position statement on resistance training for children and teenagers. The extra care in this plan for under-18s (moderate loads, no maximal lifts, supervision) is a StartFit precaution.',
      ['faigenbaum2009'],
    ),
    study(
      'older_rt',
      'The NSCA position statement presents resistance training as an effective way for older adults to counter age-related losses in muscle mass, strength and function, and gives evidence-based recommendations for it.',
      ['fragala2019'],
    ),
    study(
      'neuromotor',
      'ACSM recommends that adults also do neuromotor exercise involving balance, agility and coordination on 2–3 days a week, alongside cardio and resistance exercise.',
      ['garber2011'],
    ),
    study(
      'back_pain_exercise',
      'A Cochrane review found moderate-certainty evidence that exercise therapy is probably effective for reducing pain in chronic low back pain compared with no treatment, usual care or placebo; the effect on daily function was small.',
      ['hayden2021'],
    ),
    // ---- app rules (no study claimed) ----
    design(
      'pain_precaution',
      'StartFit precaution, not treatment: while an area hurts, exercises that load it in painful positions are left out. Pain that is severe, getting worse, or comes with numbness or weakness needs a clinician.',
    ),
    design(
      'pregnancy_modifications',
      'StartFit precaution: during pregnancy the plan avoids exercises done lying flat on the back or face down, jumping, balance risks and training to failure. Your clinician decides what is right for you.',
    ),
    design(
      'vol_targets_design',
      'StartFit design choice: the weekly set ranges for each experience level sit inside what the studies support (a minimum of about 4 sets, more for experienced lifters, diminishing returns at high volumes) and are then trimmed to fit your time.',
    ),
    design(
      'nutrition_link',
      'StartFit link, not a study result: when your nutrition plan is a cut, weekly sets aim for the lower part of your range; when you are bulking, the upper part.',
    ),
    design(
      'estimate_time',
      'Session length is an estimate from sets, repetitions and rest times, not a measurement.',
    ),
    // ---- short on time / training at home ----
    study(
      'time_efficient',
      'A review of time-efficient training recommends prioritising bilateral multi-joint exercises and exercise-specific warm-ups; supersets, drop sets and rest-pause roughly halve training time while keeping training volume, and are probably better for muscle growth than for maximal strength.',
      ['iversen2021'],
    ),
    design(
      'time_fit_rule',
      'StartFit rule: to fit a session into the time you have, the app first shortens the warm-up to exercise-specific warm-up sets, then pairs exercises for different muscles as supersets (never the first main lift), then trims accessory exercises to 2 sets, and only then leaves out the last accessory exercises. Your first main lift always stays.',
    ),
    design(
      'home_swap_rule',
      'StartFit rule: when you train at home, each exercise you cannot do is swapped for the library exercise that trains the most of the same muscles with your equipment, keeping its sets. When the swap is lighter (bands or body weight instead of heavy loads), the rep range is raised and sets are taken closer to failure.',
    ),
  ].map((c) => [c.id, c]),
);

export function claimById(id: string): Claim | undefined {
  return CLAIMS[id];
}

/** References behind a list of claim ids, in first-use order and without repeats. */
export function referencesForClaims(claimIds: string[]): Reference[] {
  const seen = new Set<string>();
  const out: Reference[] = [];
  for (const id of claimIds) {
    for (const ref of CLAIMS[id]?.refs ?? []) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      const r = TRAINING_REFERENCES[ref];
      if (r) out.push(r);
    }
  }
  return out;
}
