import type { RecoveryMuscle } from './muscles';

export interface EvidenceSource {
  id: string;
  citation: string;
  paraphrased: string;
  confidence: 'High' | 'Moderate' | 'Low';
  category: 'recovery_time' | 'sleep' | 'protein' | 'volume' | 'rir_accuracy' | 'hrv' | 'acwr' | 'doms_treatment';
}

export const EVIDENCE_SOURCES: EvidenceSource[] = [
  {
    id: 'moran_navarro_2017',
    citation: 'Moran-Navarro et al. 2017, Eur J Appl Physiol',
    paraphrased: 'Training to failure slows neuromuscular and metabolic recovery by about 24-48 hours compared to non-failure sets at equal volume. Sets taken close to failure (RIR <= 1) may extend recovery time by up to a day.',
    confidence: 'High',
    category: 'recovery_time',
  },
  {
    id: 'knowles_2018',
    citation: 'Knowles et al. 2018, J Sci Med Sport',
    paraphrased: 'Consecutive nights of sleep restriction can reduce force production in multi-joint lifts. Short sleep over multiple nights impairs recovery and performance.',
    confidence: 'Moderate',
    category: 'sleep',
  },
  {
    id: 'saner_2020',
    citation: 'Saner et al. 2020',
    paraphrased: 'Five nights of approximately 4 hours of sleep lowered myofibrillar protein synthesis, suggesting that chronic sleep deprivation directly impairs muscle repair.',
    confidence: 'Moderate',
    category: 'sleep',
  },
  {
    id: 'schoenfeld_2017',
    citation: 'Schoenfeld, Ogborn, Krieger 2017 and Pelland et al. meta-regressions',
    paraphrased: 'Weekly training sets show a dose-response relationship with hypertrophy, but with diminishing returns. Per-session returns flatten around approximately 11 fractional (effective) sets for a single muscle.',
    confidence: 'High',
    category: 'volume',
  },
  {
    id: 'halperin_rir',
    citation: 'Halperin et al., Sports Med',
    paraphrased: 'People misjudge reps in reserve by about 1 rep on average. Accuracy improves the closer a set is taken to failure. RIR values should be treated as approximate.',
    confidence: 'Moderate',
    category: 'rir_accuracy',
  },
  {
    id: 'bosquet_2008',
    citation: 'Bosquet et al. 2008 (BJSM) and Bellenger et al. 2016',
    paraphrased: 'Resting heart rate and HRV changes with overreaching are small and can sit within normal day-to-day variation. These metrics should only be interpreted against a personal baseline, not population norms.',
    confidence: 'Low',
    category: 'hrv',
  },
  {
    id: 'manresa_rocamora_2021',
    citation: 'Manresa-Rocamora 2021',
    paraphrased: 'HRV-guided training programming shows only a small margin of benefit over fixed programming. HRV is a supplementary signal, not a primary one.',
    confidence: 'Low',
    category: 'hrv',
  },
  {
    id: 'acwr_literature',
    citation: 'Acute:Chronic Workload Ratio literature',
    paraphrased: 'The ACWR is a contextual monitoring indicator for training load management. It is not a validated injury predictor and should not be presented as one.',
    confidence: 'Low',
    category: 'acwr',
  },
  {
    id: 'dupuy_2018',
    citation: 'Dupuy et al. 2018, Front Physiol (99 studies)',
    paraphrased: 'Massage is the most effective intervention for DOMS and perceived fatigue. Massage and cold exposure are best for reducing inflammation. Stretching and EMS showed no significant effect on DOMS.',
    confidence: 'High',
    category: 'doms_treatment',
  },
  {
    id: 'morton_2018',
    citation: 'Morton et al. 2018, BJSM',
    paraphrased: 'Protein intake benefits for muscle accretion plateau around 1.6 g/kg/day. Higher intake does not meaningfully increase muscle protein synthesis in most training contexts.',
    confidence: 'High',
    category: 'protein',
  },
];

export function getEvidenceByCategory(category: EvidenceSource['category']): EvidenceSource | undefined {
  return EVIDENCE_SOURCES.find((s) => s.category === category);
}

export function getEvidenceById(id: string): EvidenceSource | undefined {
  return EVIDENCE_SOURCES.find((s) => s.id === id);
}

export interface ExplanationSheet {
  title: string;
  formula: string;
  sourceId: string;
  confidence: 'High' | 'Moderate' | 'Low';
  notes?: string;
}

export function explainRecoveryPercent(muscle: RecoveryMuscle, hoursSince: number, hoursNeeded: number): ExplanationSheet {
  return {
    title: 'Muscle Recovery %',
    formula: `recovery% = clamp(${hoursSince.toFixed(1)}h since training / ${hoursNeeded}h needed × 100, 0, 100)`,
    sourceId: 'moran_navarro_2017',
    confidence: 'High',
    notes: `${muscle} base recovery: ${hoursNeeded}h. Modifiers applied for training intensity, volume, soreness, and sleep.`,
  };
}

export function explainHoursNeeded(muscle: RecoveryMuscle, baseHours: number, modifiers: { rirExtra: number; volumeExtra: number; sorenessExtra: number; sleepMultiplier: number; personalMultiplier: number }): ExplanationSheet {
  const total = (baseHours + modifiers.rirExtra + modifiers.volumeExtra + modifiers.sorenessExtra) * modifiers.sleepMultiplier * modifiers.personalMultiplier;
  return {
    title: 'Recovery Time Estimate',
    formula: `(${baseHours}h base + ${modifiers.rirExtra}h intensity + ${modifiers.volumeExtra}h volume + ${modifiers.sorenessExtra}h soreness) × ${modifiers.sleepMultiplier.toFixed(2)} sleep × ${modifiers.personalMultiplier.toFixed(2)} personal = ${total.toFixed(0)}h`,
    sourceId: 'moran_navarro_2017',
    confidence: 'High',
    notes: 'Sets with RIR <= 1 add up to +24h. High per-session volume adds time. Soreness >= 7 extends recovery. Average sleep < 6h over last 2 nights adds 15%.',
  };
}

export function explainWeeklySets(muscle: RecoveryMuscle, effectiveSets: number): ExplanationSheet {
  const band = effectiveSets < 4 ? 'Low' : effectiveSets <= 10 ? 'Efficient' : effectiveSets <= 20 ? 'Productive' : 'Diminishing';
  return {
    title: 'Weekly Effective Sets',
    formula: `${effectiveSets} effective sets → ${band} band (< 4 Low, 5-10 Efficient, 10-20 Productive, > 20 Diminishing)`,
    sourceId: 'schoenfeld_2017',
    confidence: 'High',
    notes: 'Effective sets = working sets weighted by contribution (primary 1.0, secondary 0.5). Warm-up sets excluded. Per-session returns flatten around ~11 fractional sets.',
  };
}

export function explainLoadTrend(acwr: number | null): ExplanationSheet {
  if (acwr == null) {
    return {
      title: 'Load Trend (ACWR)',
      formula: 'Not enough data — requires 4+ weeks of training logs',
      sourceId: 'acwr_literature',
      confidence: 'Low',
      notes: 'ACWR = acute (7-day) load / chronic (prior 21-day) average. 0.8-1.3 steady, > 1.5 spike. This is a monitoring indicator, not an injury predictor.',
    };
  }
  const band = acwr < 0.8 ? 'Undertraining' : acwr <= 1.3 ? 'Steady' : acwr <= 1.5 ? 'Elevated' : 'Spike';
  return {
    title: 'Load Trend (ACWR)',
    formula: `Acute 7d load / Chronic prior 21d average = ${acwr.toFixed(2)} → ${band}`,
    sourceId: 'acwr_literature',
    confidence: 'Low',
    notes: '0.8-1.3 steady, > 1.5 spike. Contextual monitoring indicator only — not a validated injury predictor.',
  };
}

export function explainReadiness(availableInputs: number, totalInputs: number): ExplanationSheet {
  return {
    title: 'Readiness Score',
    formula: `Weighted average of ${availableInputs} of ${totalInputs} available inputs (muscle recovery, sleep, soreness, resting HR/HRV, performance) — weights renormalized`,
    sourceId: 'bosquet_2008',
    confidence: 'Low',
    notes: availableInputs < 2 ? 'Fewer than 2 inputs available — shown as "No data".' : `Based on ${availableInputs} of ${totalInputs} inputs. Confidence increases with more inputs.`,
  };
}

export function explainPerformanceCheck(): ExplanationSheet {
  return {
    title: 'Performance-Verified Recovery',
    formula: 'Compare estimated 1RM (or reps at same load and RIR) of first working set vs rolling baseline for that muscle. Drop > 5% flags residual fatigue.',
    sourceId: 'moran_navarro_2017',
    confidence: 'Moderate',
    notes: 'This is a proxy for neuromuscular recovery, not a direct measure. RIR accuracy varies (Halperin et al.).',
  };
}

export function explainProtein(proteinG: number, weightKg: number): ExplanationSheet {
  const gPerKg = proteinG / weightKg;
  return {
    title: 'Protein Target',
    formula: `${proteinG}g / ${weightKg}kg bodyweight = ${gPerKg.toFixed(1)} g/kg (target range: 1.6-2.2 g/kg)`,
    sourceId: 'morton_2018',
    confidence: 'High',
    notes: 'Protein benefit plateaus around 1.6 g/kg/day. Higher intake does not meaningfully increase muscle protein synthesis in most contexts.',
  };
}
