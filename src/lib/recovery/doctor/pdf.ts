// Recovery Doctor PDF: a real text PDF (selectable text, clickable reference links).
// Two versions: 'personal' (what to do, your patterns) and 'clinician' (a factual record of the self-reported
// data: pain reports with their details, return-to-training sessions, session loads, check-ins).
// Every scientific statement comes from evidence.ts with a numbered reference; StartFit rules are listed
// separately and never cited as studies.

import { TextPdf, PAGE, hexToRgb, textWidth, wrapText } from '../../training/pdf-text';
import { Layout, M, CW, C } from '../../training/plan-pdf';
import type { Reference } from '../../nutrition/evidence';
import { MUSCLE_LABELS } from '../muscles';
import type { MuscleRecoveryState } from '../engine';
import type { PainLog } from '../store';
import { RECOVERY_CLAIMS, RECOVERY_REFERENCES } from './evidence';
import type { DoctorState } from './build';
import { WELLNESS_ITEMS, wellnessScore } from './wellness';
import { addDays } from './dates';
import { sessionLoad } from './load';
import { fingerprintLines } from './insights';
import { RTT_STAGES } from './rtt';

export type RecoveryPdfKind = 'personal' | 'clinician';

const LEVEL_TEXT = { go: 'Go - train as planned', adjust: 'Train, but adjust', easy: 'Easy day', stop: 'Stop - get checked first', need_checkin: 'No check-in today' } as const;
const RED = hexToRgb('#FDE8E8');
const RED_TEXT = hexToRgb('#8A1C1C');

function refNumbers(claimIds: string[]) {
  const order: Reference[] = [];
  const index = new Map<string, number>();
  for (const id of claimIds) {
    for (const r of RECOVERY_CLAIMS[id]?.refs ?? []) {
      if (!index.has(r) && RECOVERY_REFERENCES[r]) {
        order.push(RECOVERY_REFERENCES[r]);
        index.set(r, order.length);
      }
    }
  }
  return {
    order,
    cite: (claimId: string) => {
      const nums = (RECOVERY_CLAIMS[claimId]?.refs ?? []).map((r) => index.get(r)).filter(Boolean);
      return nums.length ? ` [${nums.join(', ')}]` : '';
    },
  };
}

const d = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export interface RecoveryPdfInput {
  kind: RecoveryPdfKind;
  state: DoctorState;
  muscles: MuscleRecoveryState[];
  painLogs: PainLog[];
  personName?: string | null;
  generatedAt?: Date;
}

export function renderRecoveryPdf(input: RecoveryPdfInput): Uint8Array {
  const { state, kind } = input;
  const generated = input.generatedAt ?? new Date();
  const clinician = kind === 'clinician';
  const pdf = new TextPdf(clinician ? 'StartFit recovery record for a clinician' : 'StartFit recovery report');
  const L = new Layout(pdf);

  // claims used anywhere in this report, in order
  const used = [
    ...state.decision.claimIds,
    'wellness_subjective',
    'wellness_scale',
    'srpe_valid',
    'monotony_strain',
    'monotony_rule',
    'acwr_caution',
    'recovery_estimate',
    'failure_recovery',
    'sleep_7h',
    'sleep_loss_perf',
    'sleep_debt_rule',
    ...state.deload.claimIds,
    'triage_rule',
    'rhabdo_signs',
    'pain_monitoring',
    'rtt_rule',
    ...(clinician ? [] : ['nof1_rule']),
  ];
  const claimIds = [...new Set(used)].filter((id) => RECOVERY_CLAIMS[id]);
  const refs = refNumbers(claimIds.filter((id) => RECOVERY_CLAIMS[id].kind === 'study'));

  // ---------- cover ----------
  pdf.rect(0, 0, PAGE.width, 92, C.ink);
  pdf.text('StartFit', M, 38, 12, { bold: true, color: C.lime });
  pdf.text(clinician ? 'Recovery record for a clinician' : 'Recovery report', M, 64, 22, { bold: true, color: [1, 1, 1] });
  pdf.text(
    `${input.personName ? `${input.personName} · ` : ''}${generated.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    PAGE.width - M,
    64,
    9.5,
    { color: [0.85, 0.9, 0.87], align: 'right' },
  );
  L.y = 112;
  L.para(
    clinician
      ? 'This record lists what the person logged in the StartFit app (self-reported) and the app\'s rule-based estimates. It is not a diagnosis. Pain triage in the app is a screening rule; recovery percentages are estimates from logged training, not measurements.'
      : 'Your recovery at a glance: today\'s decision, how you feel against your own usual, sleep, training load, muscle recovery estimates and what to focus on next.',
    { size: 9.5, color: C.dim, gap: 10 },
  );

  // ---------- red flags first ----------
  const redPain = input.painLogs.filter((p) => p.triage_level === 'red');
  if (redPain.length) {
    L.box(
      'Red-flag symptoms reported',
      redPain.slice(0, 6).map((p) => `${d(p.recorded_at.slice(0, 10))}: ${p.body_area}, pain ${p.severity}/10${p.notes ? ` - ${p.notes}` : ''}`),
      RED,
      RED_TEXT,
    );
  }

  // ---------- today ----------
  L.heading("Today's decision", 60);
  L.para(LEVEL_TEXT[state.decision.level], { size: 12, bold: true, color: C.ink, gap: 3 });
  for (const r of state.decision.reasons) L.bullet(r.text + r.claimIds.map((id) => refs.cite(id)).join(''), { size: 9 });
  if (!clinician) for (const a of state.decision.actions) L.bullet(`To do: ${a}`, { size: 9 });
  L.para('How the decision is made is a StartFit rule (see "StartFit rules" below).', { size: 8.5, color: C.dim });

  // ---------- check-ins ----------
  L.heading('Morning check-ins (last 14 days)', 60);
  L.para(`Five questions scored 1-5 (5 = best); total 5-25.${refs.cite('wellness_subjective')}${state.wellnessToday?.baseline ? ` Usual: ${state.wellnessToday.baseline.mean} ± ${state.wellnessToday.baseline.sd} over ${state.wellnessToday.baseline.n} days.` : state.fingerprint.wellness ? ` Usual: ${state.fingerprint.wellness.mean} ± ${state.fingerprint.wellness.sd}.` : ' Personal baseline needs 7 check-ins.'}`, { size: 9 });
  const from14 = addDays(state.today, -13);
  const recentW = state.wellnessEntries.filter((e) => e.date >= from14).reverse();
  if (recentW.length) {
    L.table(
      [
        { label: 'Date', width: 62 },
        { label: 'Sleep h', width: 52, align: 'right' },
        ...WELLNESS_ITEMS.map((k) => ({ label: k[0].toUpperCase() + k.slice(1), width: 62, align: 'right' as const })),
        { label: 'Total', width: CW - 62 - 52 - 62 * 5, align: 'right' },
      ],
      recentW.map((e) => [d(e.date), e.sleepHours == null ? '-' : `${e.sleepHours}`, ...WELLNESS_ITEMS.map((k) => (e[k] == null ? '-' : `${e[k]}`)), `${wellnessScore(e) ?? '-'}`]),
      { size: 8.6 },
    );
  } else L.para('No check-ins in the last 14 days.', { size: 9, color: C.dim });

  // ---------- sleep ----------
  L.heading('Sleep', 50);
  const s = state.sleep;
  L.para(
    s.nights
      ? `Last ${s.nights} logged nights: average ${s.average} h, ${s.nightsUnder7} under 7 h, sleep debt ${s.debt} h${s.spread != null ? `, varying by ±${s.spread} h` : ''}.`
      : 'No sleep logged in the last 14 days.',
    { size: 9.5 },
  );
  L.para(`Adults should sleep 7 or more hours per night on a regular basis.${refs.cite('sleep_7h')} Acute sleep loss lowered exercise performance by about 7.6% on average.${refs.cite('sleep_loss_perf')}`, { size: 9, color: C.dim });

  // ---------- load ----------
  L.heading('Training load (8 weeks)', 60);
  L.para(`Session load = session RPE (0-10) × minutes.${refs.cite('srpe_valid')} Monotony = mean daily load ÷ its standard deviation; strain = weekly load × monotony.${refs.cite('monotony_strain')} The acute:chronic workload ratio is not used to predict injury.${refs.cite('acwr_caution')}`, { size: 9 });
  L.table(
    [
      { label: 'Week ending', width: 90 },
      { label: 'Sessions', width: 70, align: 'right' },
      { label: 'Minutes', width: 70, align: 'right' },
      { label: 'Rated', width: 60, align: 'right' },
      { label: 'Load', width: 70, align: 'right' },
      { label: 'Monotony', width: 70, align: 'right' },
      { label: 'Strain', width: CW - 430, align: 'right' },
    ],
    state.series.map((w) => [d(w.end), `${w.sessions}`, `${w.minutes}`, `${w.ratedSessions}`, w.ratedSessions ? `${w.load}` : '-', w.monotony == null ? '-' : `${w.monotony}`, w.strain == null ? '-' : `${w.strain}`]),
    { size: 8.8 },
  );

  if (clinician) {
    const from28 = addDays(state.today, -27);
    const recentS = state.sessions.filter((x) => x.date >= from28).sort((a, b) => b.date.localeCompare(a.date));
    if (recentS.length) {
      L.sub('Sessions, last 28 days', 40);
      L.table(
        [{ label: 'Date', width: 90 }, { label: 'Minutes', width: 90, align: 'right' }, { label: 'Session RPE', width: 110, align: 'right' }, { label: 'Load', width: CW - 290, align: 'right' }],
        recentS.map((x) => [d(x.date), `${x.minutes}`, x.rpe == null ? 'not rated' : `${x.rpe}`, `${sessionLoad(x) ?? '-'}`]),
        { size: 8.8 },
      );
    }
  }

  // ---------- muscles ----------
  L.heading('Muscle recovery estimates', 60);
  L.para(`Estimated from logged sets, effort, soreness, sleep and personal history; not a measurement.${refs.cite('failure_recovery')}`, { size: 9, color: C.dim });
  const ms = input.muscles.filter((m) => m.recoveryPercent != null).sort((a, b) => a.recoveryPercent! - b.recoveryPercent!);
  if (ms.length) {
    L.table(
      [{ label: 'Muscle', width: 140 }, { label: 'Recovered', width: 80, align: 'right' }, { label: 'Hours left', width: 80, align: 'right' }, { label: 'Last trained', width: 90 }, { label: 'Sets last session', width: CW - 390, align: 'right' }],
      ms.map((m) => [
        MUSCLE_LABELS[m.muscle],
        `${Math.round(m.recoveryPercent!)}%`,
        m.hoursSinceLastTrained == null ? '-' : `${Math.max(0, Math.ceil(m.hoursNeeded - m.hoursSinceLastTrained))}`,
        m.lastTrainedDate ? d(m.lastTrainedDate.slice(0, 10)) : '-',
        m.sessionEffectiveSets.toFixed(1),
      ]),
      { size: 8.8 },
    );
  } else L.para('No logged training yet.', { size: 9, color: C.dim });

  // ---------- strength ----------
  if (state.trends.length) {
    L.heading('Strength trends', 50);
    L.table(
      [{ label: 'Exercise', width: CW - 230 }, { label: 'Sessions', width: 70, align: 'right' }, { label: 'Latest e1RM', width: 80, align: 'right' }, { label: 'Change', width: 80, align: 'right' }],
      state.trends.map((t) => [t.name, `${t.points.length}`, `${t.latest} kg`, t.changePercent == null ? '-' : `${t.changePercent > 0 ? '+' : ''}${t.changePercent}%`]),
      { size: 8.8 },
    );
    L.para('Estimated 1RM = weight × (1 + (reps + reps in reserve) ÷ 30), best set per session.', { size: 8.5, color: C.dim });
  }

  // ---------- lighter week ----------
  L.heading('Lighter-week check', 50);
  L.para(state.activeDeload ? `A lighter week is active from ${d(state.activeDeload.starts_on)} to ${d(state.activeDeload.ends_on)}.` : state.deload.suggest ? `${state.deload.metCount} signs point to a lighter week.` : `No lighter week suggested (${state.deload.metCount} of 2 signs).`, { size: 9.5, bold: true });
  for (const sig of state.deload.signals) L.bullet(`${sig.met ? 'Yes' : 'No'} - ${sig.text}`, { size: 9 });
  L.para(`Overtraining has no single accepted marker; diagnosis depends on clinical outcome and excluding other causes.${refs.cite('ots_consensus')}`, { size: 8.8, color: C.dim });

  // ---------- pain and return to training ----------
  L.heading(clinician ? 'Pain reports (self-reported)' : 'Pain and return to training', 50);
  if (input.painLogs.length) {
    if (clinician) {
      L.table(
        [{ label: 'Date', width: 60 }, { label: 'Area', width: 90 }, { label: 'Pain', width: 40, align: 'right' }, { label: 'Details', width: CW - 250 }, { label: 'Triage', width: 60 }],
        input.painLogs.slice(0, 20).map((p) => [
          d(p.recorded_at.slice(0, 10)),
          p.body_area,
          `${p.severity}/10`,
          [
            p.onset && `onset: ${p.onset}`,
            p.pain_type && `type: ${p.pain_type}`,
            p.during_exercise != null && (p.during_exercise ? 'during exercise' : 'not during exercise'),
            p.swelling && 'swelling',
            p.bruising && 'bruising',
            p.rom_loss && 'loss of movement',
            p.duration_hours != null && `${p.duration_hours} h`,
            p.notes,
          ]
            .filter(Boolean)
            .join('; ') || '-',
          p.triage_level,
        ]),
        { size: 8.4 },
      );
    } else {
      for (const p of input.painLogs.slice(0, 6)) L.bullet(`${d(p.recorded_at.slice(0, 10))}: ${p.body_area}, ${p.severity}/10, triage ${p.triage_level}`, { size: 9 });
    }
  } else L.para('No pain reports.', { size: 9, color: C.dim });
  for (const r of state.rtt) {
    L.sub(`Return to training: ${r.area} (${r.status}, stage ${r.stage} of 4 - ${RTT_STAGES[r.stage - 1].title})`, 40);
    if (r.entries.length) {
      L.table(
        [{ label: 'Date', width: 80 }, { label: 'Stage', width: 60, align: 'right' }, { label: 'Pain during', width: 100, align: 'right' }, { label: 'Next morning', width: 100, align: 'right' }, { label: 'Worse next morning', width: CW - 340 }],
        r.entries.map((e) => [d(e.date), `${e.stage}`, `${e.painDuring}/10`, e.painNextMorning == null ? '-' : `${e.painNextMorning}/10`, e.morningWorse == null ? 'not logged' : e.morningWorse ? 'yes' : 'no']),
        { size: 8.8 },
      );
    }
    L.para(`App advice: ${r.evaluation.text}`, { size: 9 });
  }
  L.para(`In a randomised trial, continuing activity guided by a pain-monitoring model gave the same improvement as rest, with no negative effects shown.${refs.cite('pain_monitoring')} The thresholds used here are a StartFit rule.`, { size: 8.8, color: C.dim });

  // ---------- personal ----------
  if (!clinician) {
    L.heading('This week and next', 50);
    for (const f of state.weekly.focus) L.bullet(f, { size: 9.5 });
    const fp = fingerprintLines(state.fingerprint);
    if (fp.length) {
      L.sub('Your recovery fingerprint', 30);
      for (const l of fp) L.bullet(l, { size: 9 });
    }
    const patterns = state.whatWorks.filter((c) => c.result !== 'not_enough_data');
    if (patterns.length) {
      L.sub('What works for you (your own data, not proof of cause)', 30);
      for (const c of patterns) L.bullet(`${c.title}: ${c.summary} (${c.nA} vs ${c.nB} days)`, { size: 9 });
    }
  }

  // ---------- rules ----------
  L.heading('StartFit rules (not study results)', 40);
  for (const id of claimIds.filter((x) => RECOVERY_CLAIMS[x].kind === 'design')) L.bullet(RECOVERY_CLAIMS[id].text, { size: 8.6 });

  // ---------- references ----------
  L.heading('References', 40);
  refs.order.forEach((ref, i) => {
    const lines = wrapText(ref.citation, 8.6, CW - 24);
    L.ensure(lines.length * 12.5 + 14);
    pdf.text(`[${i + 1}] `, M, L.y + 8.6, 8.6, { bold: true, color: C.ink });
    for (const line of lines) {
      pdf.text(line, M + 24, L.y + 8.6, 8.6, { color: C.text });
      L.y += 12.2;
    }
    const w = textWidth(ref.url, 8.6);
    pdf.text(ref.url, M + 24, L.y + 8.6, 8.6, { color: C.link });
    pdf.link(M + 24, L.y, w, 11, ref.url);
    L.y += 17;
  });

  const total = pdf.pageCount;
  for (let i = 0; i < total; i++) {
    pdf.onPage(i, () => {
      pdf.line(M, PAGE.height - 36, PAGE.width - M, PAGE.height - 36, C.line);
      pdf.text(`StartFit ${clinician ? 'recovery record' : 'recovery report'} · self-reported data and estimates, not a diagnosis`, M, PAGE.height - 24, 7.5, { color: C.faint });
      pdf.text(`Page ${i + 1} of ${total}`, PAGE.width - M, PAGE.height - 24, 7.5, { color: C.faint, align: 'right' });
    });
  }
  return pdf.toBytes();
}

export function recoveryPdfFilename(kind: RecoveryPdfKind, today: string): string {
  return `startfit-recovery-${kind === 'clinician' ? 'clinician-record' : 'report'}-${today}.pdf`;
}
