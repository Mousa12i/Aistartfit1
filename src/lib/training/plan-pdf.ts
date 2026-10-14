// The downloadable training plan: a real text PDF (selectable text, clickable DOI links) built from
// the engine's plan. Every scientific statement in it comes from evidence.ts and carries a numbered
// reference; StartFit design choices are listed separately and never cited as studies.

import { CLAIMS, TRAINING_REFERENCES, type Claim } from './evidence';
import { PLAN_GOAL_LABELS, type TrainingPlan } from './plan-types';
import { WEEKDAY_NAMES } from './engine-config';
import { PAGE, TextPdf, hexToRgb, textWidth, wrapText, type Rgb } from './pdf-text';
import type { Reference } from '../nutrition/evidence';

export const M = 44;
export const CW = PAGE.width - 2 * M;
const BOTTOM = PAGE.height - 50;

export const C = {
  ink: hexToRgb('#101614'),
  text: hexToRgb('#1D2420'),
  dim: hexToRgb('#5D6A63'),
  faint: hexToRgb('#9AA59F'),
  line: hexToRgb('#E3E8E5'),
  panel: hexToRgb('#F4F7F5'),
  lime: hexToRgb('#7FC31B'),
  limeDark: hexToRgb('#4E7F0C'),
  amber: hexToRgb('#FFF4DC'),
  amberText: hexToRgb('#7A5200'),
  link: hexToRgb('#1F5FA8'),
};

const LEVEL_LABELS = { new: 'New to training', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

/** Page layout helpers shared by the StartFit PDFs (training plan, recovery report). */
export class Layout {
  y = M;
  constructor(public pdf: TextPdf) {}

  ensure(h: number) {
    if (this.y + h > BOTTOM) {
      this.pdf.addPage();
      this.y = M;
    }
  }

  heading(str: string, keepWith = 40) {
    this.ensure(34 + keepWith);
    this.y += 10;
    this.pdf.text(str, M, this.y + 12, 14, { bold: true, color: C.ink });
    this.y += 18;
    this.pdf.rect(M, this.y, 28, 2.5, C.lime);
    this.y += 12;
  }

  sub(str: string, keepWith = 30) {
    this.ensure(18 + keepWith);
    this.pdf.text(str, M, this.y + 11, 11, { bold: true, color: C.ink });
    this.y += 17;
  }

  para(str: string, opts: { size?: number; bold?: boolean; color?: Rgb; x?: number; width?: number; gap?: number } = {}) {
    const size = opts.size ?? 9.5;
    const lh = size * 1.42;
    const x = opts.x ?? M;
    for (const line of wrapText(str, size, opts.width ?? CW - (x - M), opts.bold)) {
      this.ensure(lh);
      this.pdf.text(line, x, this.y + size, size, { bold: opts.bold, color: opts.color ?? C.text });
      this.y += lh;
    }
    this.y += opts.gap ?? 4;
  }

  bullet(str: string, opts: { size?: number; color?: Rgb } = {}) {
    const size = opts.size ?? 9.5;
    const lh = size * 1.42;
    const lines = wrapText(str, size, CW - 12);
    lines.forEach((line, i) => {
      this.ensure(lh);
      if (i === 0) this.pdf.text('•', M + 1, this.y + size, size, { color: C.limeDark });
      this.pdf.text(line, M + 12, this.y + size, size, { color: opts.color ?? C.text });
      this.y += lh;
    });
    this.y += 2;
  }

  /** A box with a tinted background and wrapped text lines. */
  box(title: string, lines: string[], bg: Rgb, fg: Rgb) {
    const size = 9.2;
    const lh = size * 1.42;
    const wrapped = lines.flatMap((l) => wrapText(`• ${l}`, size, CW - 24));
    const h = 26 + wrapped.length * lh + 6;
    if (h < BOTTOM - M) this.ensure(h);
    this.pdf.rect(M, this.y, CW, Math.min(h, BOTTOM - this.y), bg);
    this.pdf.text(title, M + 12, this.y + 18, 10.5, { bold: true, color: fg });
    this.y += 26;
    for (const l of wrapped) {
      this.ensure(lh);
      this.pdf.text(l, M + 12, this.y + size, size, { color: fg });
      this.y += lh;
    }
    this.y += 12;
  }

  /** Table with fixed column widths; first row is the header. */
  table(cols: { label: string; width: number; align?: 'left' | 'right' }[], rows: string[][], opts: { size?: number; sub?: (string | null)[] } = {}) {
    const size = opts.size ?? 9;
    const lh = size * 1.35;
    const header = () => {
      this.ensure(18 + lh * 2);
      this.pdf.rect(M, this.y, CW, 17, C.panel);
      let x = M + 6;
      for (const c of cols) {
        const tx = c.align === 'right' ? x + c.width - 12 : x;
        this.pdf.text(c.label, tx, this.y + 12, 8, { bold: true, color: C.dim, align: c.align === 'right' ? 'right' : 'left' });
        x += c.width;
      }
      this.y += 20;
    };
    header();
    rows.forEach((row, ri) => {
      const cells = row.map((cell, ci) => wrapText(cell, size, cols[ci].width - 12, ci === 0));
      const sub = opts.sub?.[ri] ? wrapText(opts.sub[ri]!, 7.8, cols[0].width + (cols[1]?.width ?? 0) - 12) : [];
      const height = Math.max(...cells.map((c) => c.length)) * lh + sub.length * 7.8 * 1.35 + 6;
      if (this.y + height > BOTTOM) {
        this.pdf.addPage();
        this.y = M;
        header();
      }
      let x = M + 6;
      cells.forEach((lines, ci) => {
        const c = cols[ci];
        lines.forEach((line, li) => {
          const tx = c.align === 'right' ? x + c.width - 12 : x;
          this.pdf.text(line, tx, this.y + size + li * lh, size, { bold: ci === 0, color: C.text, align: c.align === 'right' ? 'right' : 'left' });
        });
        x += c.width;
      });
      let subY = this.y + Math.max(...cells.map((c) => c.length)) * lh;
      for (const s of sub) {
        this.pdf.text(s, M + 6, subY + 7.8, 7.8, { color: C.dim });
        subY += 7.8 * 1.35;
      }
      this.y += height;
      this.pdf.line(M, this.y - 2, M + CW, this.y - 2, C.line);
    });
    this.y += 8;
  }
}

export interface PlanPdfOptions {
  personName?: string | null;
  generatedAt?: Date;
}

/** Numbered reference list in order of first use. */
export function referenceNumbers(claimIds: string[]): { order: Reference[]; numberOf: (claimId: string) => number[] } {
  const order: Reference[] = [];
  const index = new Map<string, number>();
  for (const id of claimIds) {
    for (const r of CLAIMS[id]?.refs ?? []) {
      if (!index.has(r) && TRAINING_REFERENCES[r]) {
        order.push(TRAINING_REFERENCES[r]);
        index.set(r, order.length);
      }
    }
  }
  return { order, numberOf: (claimId: string) => (CLAIMS[claimId]?.refs ?? []).map((r) => index.get(r)!).filter(Boolean) };
}

export function renderPlanPdf(plan: TrainingPlan, opts: PlanPdfOptions = {}): Uint8Array {
  const generated = opts.generatedAt ?? new Date(plan.generatedAt);
  const pdf = new TextPdf(`StartFit training plan - ${plan.title}`);
  const L = new Layout(pdf);

  // ---------- cover ----------
  pdf.rect(0, 0, PAGE.width, 92, C.ink);
  pdf.text('StartFit', M, 38, 12, { bold: true, color: C.lime });
  pdf.text('Training plan', M, 64, 22, { bold: true, color: [1, 1, 1] });
  pdf.text(
    `${opts.personName ? `${opts.personName} · ` : ''}Built ${generated.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    PAGE.width - M,
    64,
    9.5,
    { color: [0.85, 0.9, 0.87], align: 'right' },
  );
  L.y = 112;
  L.para(plan.title, { size: 15, bold: true, color: C.ink, gap: 2 });
  L.para(plan.summary, { size: 10, color: C.dim, gap: 10 });

  const facts: [string, string][] = [
    ['Goal', PLAN_GOAL_LABELS[plan.effectiveGoal] + (plan.effectiveGoal !== plan.goal ? ` (you asked for: ${PLAN_GOAL_LABELS[plan.goal]})` : '')],
    ['Experience', LEVEL_LABELS[plan.level]],
    ['Strength days', `${plan.strengthDays} per week · about ${plan.sessionMinutes} minutes each`],
    ['Cardio', plan.cardioTargetMinutes ? `${plan.cardioMinutesPerWeek} min/week now, building to ${plan.cardioTargetMinutes}` : 'Not included'],
  ];
  for (const [k, v] of facts) {
    L.ensure(16);
    pdf.text(k, M, L.y + 10, 9, { bold: true, color: C.dim });
    for (const line of wrapText(v, 9.5, CW - 110)) {
      pdf.text(line, M + 110, L.y + 10, 9.5, { color: C.text });
      L.y += 14;
    }
  }
  L.y += 8;

  const safety = plan.notes.filter((n) => n.kind === 'safety').map((n) => n.text);
  L.box(
    'Safety first',
    [
      ...safety,
      'Stop and get medical help for chest pain, fainting, unusual breathlessness, or pain that is severe, sharp or getting worse.',
      'This plan is general guidance built from your answers. It is not medical advice and does not replace a clinician who knows your health.',
    ],
    C.amber,
    C.amberText,
  );
  const adjust = plan.notes.filter((n) => n.kind !== 'safety').map((n) => n.text);
  if (adjust.length) L.box('Notes about your plan', adjust, C.panel, C.text);

  // ---------- references, numbered by first use ----------
  const studyClaims = [...new Set([...plan.rationale.map((r) => r.claimId), ...plan.claimIds])].filter((id) => CLAIMS[id]?.kind === 'study');
  const refs = referenceNumbers(studyClaims);
  const cite = (claimId: string) => {
    const nums = refs.numberOf(claimId);
    return nums.length ? ` [${nums.join(', ')}]` : '';
  };

  // ---------- the week ----------
  L.heading('Your week', 60);
  const week = Array.from({ length: 7 }, (_, d) => {
    const s = plan.days.find((x) => x.weekday === d);
    const c = plan.cardio.filter((x) => x.weekday === d);
    const parts = [s ? s.label.replace(/^Day \d+ · /, '') : null, ...c.map((x) => `${x.label} ${x.minutes} min`)].filter(Boolean);
    return [WEEKDAY_NAMES[d], parts.length ? parts.join(' + ') : 'Rest'];
  });
  L.table([{ label: 'Day', width: 70 }, { label: 'Session', width: CW - 70 }], week);
  L.para('The weekdays are a suggestion. Keep at least one day between sessions that train the same muscles hard when you can.', { size: 8.5, color: C.dim });

  for (const day of plan.days) {
    L.sub(`${day.label} (${WEEKDAY_NAMES[day.weekday]}) · about ${day.estimatedMinutes} min`, 60);
    L.para(`Warm-up: ${day.warmup}`, { size: 8.5, color: C.dim, gap: 3 });
    L.table(
      [
        { label: 'Exercise', width: CW - 230 },
        { label: 'Sets × target', width: 120 },
        { label: 'Reps in reserve', width: 60, align: 'right' },
        { label: 'Rest', width: 50, align: 'right' },
      ],
      day.exercises.map((e) => [e.name, `${e.sets} × ${e.reps}`, e.timed ? '–' : `${e.rir}`, `${e.restSeconds} s`]),
      {
        sub: day.exercises.map((e) => {
          const bits = [e.note, e.alternatives.length ? `Swap options: ${e.alternatives.slice(0, 3).map((a) => a.name).join(', ')}` : null].filter(Boolean);
          return bits.length ? bits.join(' ') : null;
        }),
      },
    );
  }

  if (plan.cardio.length) {
    L.heading('Cardio', 50);
    L.table(
      [{ label: 'Day', width: 60 }, { label: 'Session', width: CW - 200 }, { label: 'Minutes', width: 60, align: 'right' }, { label: 'Effort', width: 80 }],
      plan.cardio.map((c) => [WEEKDAY_NAMES[c.weekday], c.label, `${c.minutes}`, c.intensity]),
      { sub: plan.cardio.map((c) => c.note) },
    );
    if (plan.cardioRamp.length && plan.cardioRamp[0] < plan.cardioTargetMinutes) {
      L.para(`Weekly cardio minutes, weeks 1–${plan.cardioRamp.length}: ${plan.cardioRamp.join(' → ')}.`, { size: 9 });
    }
  }

  // ---------- volume ----------
  L.heading('Weekly sets per muscle group', 60);
  L.para('Sets are counted as 1 for the muscle an exercise trains directly and ½ for muscles that help.' + cite('vol_fractional'), { size: 9 });
  L.table(
    [{ label: 'Muscle group', width: CW - 230 }, { label: 'Sets / week', width: 80, align: 'right' }, { label: 'Target', width: 80, align: 'right' }, { label: 'Status', width: 70 }],
    plan.volume.map((v) => [
      v.label + (v.priority ? ' (priority)' : ''),
      `${v.sets}`,
      v.high > 0 ? `${v.low}–${v.high}` : 'no target',
      v.high <= 0 ? '' : v.status === 'in_range' ? 'in range' : v.status === 'low' ? 'below' : 'above',
    ]),
  );

  // ---------- progression ----------
  L.heading('How to progress', 60);
  for (const r of plan.progressionRules) L.bullet(r);
  L.y += 4;
  L.table(
    [{ label: 'Week', width: 50 }, { label: 'Focus', width: 140 }, { label: 'Sets', width: (CW - 190) / 2 }, { label: 'Effort', width: (CW - 190) / 2 }],
    plan.progression.map((w) => [`${w.week}`, w.label, w.setsNote, w.rirNote]),
  );

  // ---------- why ----------
  L.heading('Why the plan looks like this', 60);
  for (const r of plan.rationale) {
    const claim: Claim | undefined = CLAIMS[r.claimId];
    if (!claim || claim.kind !== 'study') continue;
    L.ensure(40);
    L.para(r.decision, { size: 9.5, bold: true, gap: 1 });
    L.para(claim.text + cite(r.claimId), { size: 9, color: C.dim, gap: 7 });
  }
  const shown = new Set(plan.rationale.map((r) => r.claimId));
  const otherStudies = plan.claimIds.filter((id) => !shown.has(id) && CLAIMS[id]?.kind === 'study');
  if (otherStudies.length) {
    L.sub('Other evidence behind the plan', 40);
    for (const id of otherStudies) L.bullet(CLAIMS[id].text + cite(id), { size: 9 });
  }
  const design = [...new Set([...plan.claimIds, ...plan.rationale.map((r) => r.claimId)])].filter((id) => CLAIMS[id]?.kind === 'design');
  if (design.length) {
    L.sub('StartFit design choices (not study results)', 40);
    for (const id of design) L.bullet(CLAIMS[id].text, { size: 9 });
  }

  // ---------- references ----------
  L.heading('References', 40);
  refs.order.forEach((ref, i) => {
    const label = `[${i + 1}] `;
    const lines = wrapText(ref.citation, 8.6, CW - 24);
    L.ensure(lines.length * 12.5 + 14);
    pdf.text(label, M, L.y + 8.6, 8.6, { bold: true, color: C.ink });
    for (const line of lines) {
      pdf.text(line, M + 24, L.y + 8.6, 8.6, { color: C.text });
      L.y += 12.2;
    }
    const w = textWidth(ref.url, 8.6);
    pdf.text(ref.url, M + 24, L.y + 8.6, 8.6, { color: C.link });
    pdf.link(M + 24, L.y, w, 11, ref.url);
    L.y += 17;
  });

  // ---------- footers ----------
  const total = pdf.pageCount;
  for (let i = 0; i < total; i++) {
    pdf.onPage(i, () => {
      pdf.line(M, PAGE.height - 36, PAGE.width - M, PAGE.height - 36, C.line);
      pdf.text('StartFit training plan · general guidance, not medical advice', M, PAGE.height - 24, 7.5, { color: C.faint });
      pdf.text(`Page ${i + 1} of ${total}`, PAGE.width - M, PAGE.height - 24, 7.5, { color: C.faint, align: 'right' });
    });
  }
  return pdf.toBytes();
}

export function planPdfFilename(plan: TrainingPlan): string {
  return `startfit-training-plan-${plan.generatedAt.slice(0, 10)}.pdf`;
}
