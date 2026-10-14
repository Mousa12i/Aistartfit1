// Draws the nutrition report on A4-sized canvases, then packs them into a PDF.

import { A4_PT, canvasesToPdfBlob } from './pdf';
import { formatShortDate, parseDateKey } from './dates';

export interface ReportDay {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  waterMl: number;
  entries: number;
  kcalTarget: number;
  proteinTarget: number;
  training: boolean;
  mealsLogged: number;
  proteinMeals: number;
}

export interface ReportData {
  userName: string;
  from: string;
  to: string;
  generatedAt: Date;
  noNumbers: boolean;
  goalLabel: string;
  targets: { kcal: number; protein: number; carbs: number; fat: number; fiber: number; waterMl: number; maintenance: number; maintenanceSource: 'formula' | 'adaptive' };
  days: ReportDay[];
  weight: { start: number | null; end: number | null; pctPerWeek: number | null; unit: 'kg' | 'lb' } | null;
  topFoods: { name: string; count: number; kcal: number; protein: number }[];
  nutrients: { label: string; value: number; unit: string; decimals: number; pct: number | null; coverage: number; limit: boolean }[];
  insights: { title: string; body: string }[];
  references: string[];
}

const SCALE = 1240 / A4_PT.width; // ≈150 dpi
const W = A4_PT.width;
const H = A4_PT.height;
const M = 40;
const FONT = 'Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans Arabic", sans-serif';

const C = {
  ink: '#101614',
  text: '#1D2420',
  dim: '#5D6A63',
  faint: '#9AA59F',
  line: '#E3E8E5',
  panel: '#F4F7F5',
  lime: '#7FC31B',
  limeDark: '#4E7F0C',
  gold: '#D9930B',
  sky: '#2E86C1',
  rust: '#C93C41',
  white: '#FFFFFF',
};

class Writer {
  pages: HTMLCanvasElement[] = [];
  ctx!: CanvasRenderingContext2D;
  y = M;

  constructor() {
    this.newPage();
  }

  newPage() {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * SCALE);
    canvas.height = Math.round(H * SCALE);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = C.white;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    this.pages.push(canvas);
    this.ctx = ctx;
    this.y = M;
  }

  ensure(height: number) {
    if (this.y + height > H - M - 18) this.newPage();
  }

  font(size: number, weight = 400) {
    this.ctx.font = `${weight} ${size}px ${FONT}`;
  }

  text(str: string, x: number, y: number, opts: { size?: number; weight?: number; color?: string; align?: CanvasTextAlign } = {}) {
    this.font(opts.size ?? 10, opts.weight ?? 400);
    this.ctx.fillStyle = opts.color ?? C.text;
    this.ctx.textAlign = opts.align ?? 'left';
    this.ctx.fillText(str, x, y);
    this.ctx.textAlign = 'left';
  }

  /** Wrap text into the given width at the current position and move down. */
  paragraph(str: string, x: number, width: number, opts: { size?: number; weight?: number; color?: string; lineHeight?: number } = {}): void {
    const size = opts.size ?? 9.5;
    const lh = opts.lineHeight ?? size * 1.45;
    this.font(size, opts.weight ?? 400);
    const lines: string[] = [];
    let line = '';
    for (const word of str.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (this.ctx.measureText(test).width > width && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    for (const l of lines) {
      this.ensure(lh);
      this.text(l, x, this.y + size, { size, weight: opts.weight, color: opts.color });
      this.y += lh;
    }
  }

  /** Section heading; `keepWith` reserves room for the first lines of the section so a heading never ends a page. */
  heading(str: string, keepWith = 30) {
    this.ensure(44 + keepWith);
    this.y += 10;
    this.text(str, M, this.y + 13, { size: 13, weight: 700, color: C.ink });
    this.y += 22;
    this.ctx.fillStyle = C.lime;
    this.ctx.fillRect(M, this.y, 28, 2.5);
    this.y += 12;
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, fill: string) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  truncate(str: string, width: number, size: number, weight = 400): string {
    this.font(size, weight);
    if (this.ctx.measureText(str).width <= width) return str;
    let s = str;
    while (s.length > 1 && this.ctx.measureText(`${s}…`).width > width) s = s.slice(0, -1);
    return `${s}…`;
  }
}

const n0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : Math.round(v).toLocaleString('en-GB'));
const n1 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : (Math.round(v * 10) / 10).toLocaleString('en-GB'));
const nd = (v: number, decimals: number) => v.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: Math.max(0, Math.min(2, decimals)) });

export async function renderNutritionReport(data: ReportData): Promise<Blob> {
  const w = new Writer();
  const logged = data.days.filter((d) => d.entries > 0);
  const avg = (pick: (d: ReportDay) => number | null) => {
    const vals = logged.map(pick).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  // Header band
  w.ctx.fillStyle = C.ink;
  w.ctx.fillRect(0, 0, W, 96);
  w.text('START', M, 42, { size: 18, weight: 800, color: C.white });
  w.font(18, 800);
  const startWidth = w.ctx.measureText('START').width;
  w.text('FIT', M + startWidth, 42, { size: 18, weight: 800, color: '#A6FF32' });
  w.text('Nutrition report', M, 66, { size: 12, weight: 500, color: '#C9D3CD' });
  w.text(`${formatShortDate(data.from)} – ${formatShortDate(data.to)} ${parseDateKey(data.to).getFullYear()}`, W - M, 42, { size: 12, weight: 700, color: C.white, align: 'right' });
  w.text(`Generated ${data.generatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, W - M, 66, { size: 9, color: '#C9D3CD', align: 'right' });
  w.y = 120;
  w.text(data.userName || 'StartFit athlete', M, w.y, { size: 15, weight: 700, color: C.ink });
  w.text(data.noNumbers ? 'Balanced mode (numbers hidden)' : `Goal: ${data.goalLabel}`, W - M, w.y, { size: 10, weight: 600, color: C.limeDark, align: 'right' });
  w.y += 22;

  // KPI cards
  const kpis: { label: string; value: string; sub: string }[] = data.noNumbers
    ? [
        { label: 'Days logged', value: `${logged.length}/${data.days.length}`, sub: 'days with food logged' },
        { label: 'Meals per day', value: n1(avg((d) => d.mealsLogged)), sub: 'average, logged days' },
        { label: 'Meals with protein', value: n1(avg((d) => d.proteinMeals)), sub: 'average per day' },
        { label: 'Water', value: n1((avg((d) => d.waterMl) ?? 0) / 250), sub: 'glasses per day' },
      ]
    : [
        { label: 'Calories', value: n0(avg((d) => d.kcal)), sub: `avg/day · target ${n0(data.targets.kcal)}` },
        { label: 'Protein', value: `${n0(avg((d) => d.protein))} g`, sub: `avg/day · target ${n0(data.targets.protein)} g` },
        { label: 'Days logged', value: `${logged.length}/${data.days.length}`, sub: 'days with food logged' },
        {
          label: 'Weight trend',
          value: data.weight?.start != null && data.weight.end != null ? `${data.weight.end - data.weight.start > 0 ? '+' : ''}${n1(data.weight.end - data.weight.start)} ${data.weight.unit}` : '—',
          sub:
            data.weight?.pctPerWeek != null
              ? `${data.weight.pctPerWeek > 0 ? '+' : ''}${data.weight.pctPerWeek.toFixed(2)}% per week`
              : data.weight?.start != null && data.weight.end != null
                ? 'change in trend weight'
                : 'not enough weigh-ins',
        },
      ];
  const gap = 10;
  const cardW = (W - 2 * M - gap * 3) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * (cardW + gap);
    w.roundRect(x, w.y, cardW, 70, 8, C.panel);
    w.text(k.label.toUpperCase(), x + 10, w.y + 17, { size: 7.5, weight: 700, color: C.dim });
    w.text(k.value, x + 10, w.y + 42, { size: 17, weight: 800, color: C.ink });
    w.text(w.truncate(k.sub, cardW - 20, 7.5), x + 10, w.y + 59, { size: 7.5, color: C.dim });
  });
  w.y += 88;

  // Daily chart
  const chartH = 150;
  w.heading(data.noNumbers ? 'Meals logged each day' : 'Calories each day', chartH + 30);
  const top = w.y;
  const chartX = M + 28;
  const chartW = W - M - chartX;
  const values = data.days.map((d) => (data.noNumbers ? d.mealsLogged : d.kcal));
  const targetLine = data.noNumbers ? 4 : data.targets.kcal;
  const maxV = Math.max(targetLine * 1.2, ...values, 1);
  const barGap = data.days.length > 20 ? 2 : 4;
  const barW = Math.max(3, (chartW - barGap * (data.days.length - 1)) / Math.max(1, data.days.length));
  [0, 0.5, 1].forEach((f) => {
    const yy = top + chartH - chartH * f;
    w.ctx.strokeStyle = C.line;
    w.ctx.lineWidth = 0.6;
    w.ctx.beginPath();
    w.ctx.moveTo(chartX, yy);
    w.ctx.lineTo(chartX + chartW, yy);
    w.ctx.stroke();
    w.text(n0(maxV * f), chartX - 4, yy + 3, { size: 7, color: C.faint, align: 'right' });
  });
  data.days.forEach((d, i) => {
    const v = values[i];
    const h = (v / maxV) * chartH;
    const x = chartX + i * (barW + barGap);
    const over = !data.noNumbers && d.kcal > d.kcalTarget * 1.1;
    w.roundRect(x, top + chartH - h, barW, Math.max(h, v > 0 ? 1.5 : 0), Math.min(3, barW / 2), d.entries === 0 ? C.line : over ? C.gold : C.lime);
    if (data.days.length <= 14 || i % Math.ceil(data.days.length / 10) === 0) {
      w.text(formatShortDate(d.date), x + barW / 2, top + chartH + 12, { size: 6.5, color: C.faint, align: 'center' });
    }
  });
  const ty = top + chartH - (targetLine / maxV) * chartH;
  w.ctx.strokeStyle = C.limeDark;
  w.ctx.setLineDash([4, 3]);
  w.ctx.lineWidth = 1;
  w.ctx.beginPath();
  w.ctx.moveTo(chartX, ty);
  w.ctx.lineTo(chartX + chartW, ty);
  w.ctx.stroke();
  w.ctx.setLineDash([]);
  w.text(data.noNumbers ? 'regular meals' : `target ${n0(targetLine)}`, chartX + chartW, ty - 4, { size: 7, weight: 600, color: C.limeDark, align: 'right' });
  w.y = top + chartH + 24;

  if (!data.noNumbers) {
    // Macro split
    w.heading('Average macro split', 70);
    const p = avg((d) => d.protein) ?? 0;
    const c = avg((d) => d.carbs) ?? 0;
    const f = avg((d) => d.fat) ?? 0;
    const energy = p * 4 + c * 4 + f * 9 || 1;
    const parts = [
      { label: 'Protein', g: p, kcal: p * 4, color: C.lime, target: data.targets.protein },
      { label: 'Carbs', g: c, kcal: c * 4, color: C.gold, target: data.targets.carbs },
      { label: 'Fat', g: f, kcal: f * 9, color: C.sky, target: data.targets.fat },
    ];
    w.ensure(70);
    let x = M;
    const barWidth = W - 2 * M;
    parts.forEach((part) => {
      const pw = (part.kcal / energy) * barWidth;
      w.ctx.fillStyle = part.color;
      w.ctx.fillRect(x, w.y, pw, 12);
      x += pw;
    });
    w.y += 28;
    parts.forEach((part, i) => {
      const cx = M + i * ((W - 2 * M) / 3);
      w.ctx.fillStyle = part.color;
      w.ctx.fillRect(cx, w.y - 7, 8, 8);
      w.text(`${part.label}: ${n0(part.g)} g (${Math.round((part.kcal / energy) * 100)}%) · target ${n0(part.target)} g`, cx + 13, w.y, { size: 8.5, color: C.text });
    });
    w.y += 18;
    w.paragraph(
      `Maintenance used: ${n0(data.targets.maintenance)} kcal (${data.targets.maintenanceSource === 'adaptive' ? 'estimated from your logged intake and weight trend' : 'Mifflin–St Jeor equation × activity'}). Fibre target ${n0(data.targets.fiber)} g; water ${n1(data.targets.waterMl / 1000)} L.`,
      M,
      W - 2 * M,
      { size: 8.5, color: C.dim },
    );
  }

  // Daily table
  w.heading('Day by day', 17 * 3);
  const cols = data.noNumbers
    ? [
        { key: 'Date', w: 110 },
        { key: 'Items', w: 70 },
        { key: 'Meals', w: 70 },
        { key: 'Protein meals', w: 100 },
        { key: 'Water', w: 80 },
        { key: 'Training', w: 85 },
      ]
    : [
        { key: 'Date', w: 72 },
        { key: 'kcal', w: 52 },
        { key: 'Protein', w: 52 },
        { key: 'Carbs', w: 48 },
        { key: 'Fat', w: 44 },
        { key: 'Fibre', w: 44 },
        { key: 'Sugars', w: 48 },
        { key: 'Sodium', w: 58 },
        { key: 'Water', w: 50 },
        { key: 'Train', w: 47 },
      ];
  const rowH = 17;
  const drawHeader = () => {
    w.ensure(rowH * 2);
    w.roundRect(M, w.y, W - 2 * M, rowH, 4, C.panel);
    let x = M + 6;
    cols.forEach((col) => {
      w.text(col.key, x, w.y + 11.5, { size: 7.5, weight: 700, color: C.dim });
      x += col.w;
    });
    w.y += rowH;
  };
  drawHeader();
  data.days.forEach((d) => {
    if (w.y + rowH > H - M - 18) {
      w.newPage();
      drawHeader();
    }
    const cells = data.noNumbers
      ? [formatShortDate(d.date), String(d.entries), String(d.mealsLogged), String(d.proteinMeals), `${Math.floor(d.waterMl / 250)} glasses`, d.training ? 'Yes' : '']
      : [
          formatShortDate(d.date),
          d.entries ? n0(d.kcal) : '—',
          d.entries ? `${n0(d.protein)} g` : '—',
          d.entries ? `${n0(d.carbs)} g` : '—',
          d.entries ? `${n0(d.fat)} g` : '—',
          d.entries && d.fiber != null ? `${n0(d.fiber)} g` : '—',
          d.entries && d.sugar != null ? `${n0(d.sugar)} g` : '—',
          d.entries && d.sodium != null ? `${n0(d.sodium)} mg` : '—',
          d.waterMl ? `${n1(d.waterMl / 1000)} L` : '—',
          d.training ? 'Yes' : '',
        ];
    let x = M + 6;
    cells.forEach((cell, i) => {
      const over = !data.noNumbers && i === 1 && d.entries > 0 && d.kcal > d.kcalTarget * 1.1;
      w.text(cell, x, w.y + 11.5, { size: 8, color: over ? C.gold : d.entries ? C.text : C.faint, weight: i === 0 ? 600 : 400 });
      x += cols[i].w;
    });
    w.ctx.fillStyle = C.line;
    w.ctx.fillRect(M, w.y + rowH - 0.5, W - 2 * M, 0.5);
    w.y += rowH;
  });

  if (!data.noNumbers && data.nutrients.length) {
    w.heading('Vitamins, minerals and limits (average per logged day)', 60);
    const colValue = M + 205; // right edge of the amount column
    const barX = M + 218;
    const barW = 150;
    const colPct = barX + barW + 8;
    const drawNutrientHeader = () => {
      w.roundRect(M, w.y, W - 2 * M, 16, 4, C.panel);
      w.text('Nutrient', M + 6, w.y + 11, { size: 7.5, weight: 700, color: C.dim });
      w.text('Average', colValue, w.y + 11, { size: 7.5, weight: 700, color: C.dim, align: 'right' });
      w.text('Against Daily Value or limit', barX, w.y + 11, { size: 7.5, weight: 700, color: C.dim });
      w.text('Data', W - M - 6, w.y + 11, { size: 7.5, weight: 700, color: C.dim, align: 'right' });
      w.y += 20;
    };
    drawNutrientHeader();
    data.nutrients.forEach((nu) => {
      if (w.y + 17 > H - M - 18) {
        w.newPage();
        drawNutrientHeader();
      }
      w.text(w.truncate(nu.label, 140, 8.5), M + 6, w.y + 10, { size: 8.5, color: C.text });
      w.text(`${nd(nu.value, nu.decimals)} ${nu.unit}`, colValue, w.y + 10, { size: 8.5, weight: 600, color: C.text, align: 'right' });
      if (nu.pct != null) {
        w.roundRect(barX, w.y + 4, barW, 7, 3.5, C.panel);
        const fill = Math.min(1, nu.pct / 100) * barW;
        w.roundRect(barX, w.y + 4, Math.max(fill, 2), 7, 3.5, nu.limit && nu.pct > 100 ? C.rust : C.lime);
        w.text(`${Math.round(nu.pct)}%${nu.limit ? ' of limit' : ' of DV'}`, colPct, w.y + 10, { size: 7.5, color: nu.limit && nu.pct > 100 ? C.rust : C.dim });
      }
      w.text(`${Math.round(nu.coverage * 100)}%`, W - M - 6, w.y + 10, { size: 7.5, color: nu.coverage < 0.95 ? C.gold : C.faint, align: 'right' });
      w.ctx.fillStyle = C.line;
      w.ctx.fillRect(M, w.y + 16.5, W - 2 * M, 0.5);
      w.y += 17;
    });
    w.y += 4;
    w.paragraph(
      'Data = share of the energy you logged that came from foods with a value for that nutrient. Below 95% (in amber), the true intake is likely higher than shown.',
      M,
      W - 2 * M,
      { size: 7.5, color: C.dim, lineHeight: 10.5 },
    );
  }

  if (data.topFoods.length) {
    w.heading('Most logged foods', 16 * 4);
    data.topFoods.forEach((food, i) => {
      w.ensure(18);
      w.text(`${i + 1}.`, M, w.y + 10, { size: 8.5, color: C.faint });
      w.text(w.truncate(food.name, 300, 8.5), M + 16, w.y + 10, { size: 8.5, color: C.text });
      w.text(`${food.count}×`, M + 350, w.y + 10, { size: 8.5, color: C.dim, align: 'right' });
      if (!data.noNumbers) w.text(`${n0(food.kcal)} kcal · ${n0(food.protein)} g protein in total`, W - M, w.y + 10, { size: 8, color: C.dim, align: 'right' });
      w.y += 16;
    });
  }

  if (data.insights.length) {
    w.heading('What stood out', 50);
    data.insights.forEach((ins) => {
      w.ensure(36);
      w.text(ins.title, M, w.y + 10, { size: 9.5, weight: 700, color: C.ink });
      w.y += 14;
      w.paragraph(ins.body, M, W - 2 * M, { size: 8.5, color: C.dim });
      w.y += 6;
    });
  }

  w.heading('Method and sources');
  w.paragraph(
    'Targets: resting energy from the Mifflin–St Jeor equation multiplied by an activity factor, adjusted for your goal (about 7,700 kcal per kg of weight change) and, once enough data exists, replaced by an estimate from your logged intake and weight trend. Protein, fat and fibre follow the ranges in the sources below. Vitamin and mineral percentages use FDA Daily Values (a labelling reference, not a personal requirement). Totals are only as complete as the food data logged.',
    M,
    W - 2 * M,
    { size: 8.5, color: C.dim },
  );
  w.y += 6;
  data.references.forEach((ref) => {
    w.paragraph(`• ${ref}`, M, W - 2 * M, { size: 7.5, color: C.dim, lineHeight: 10.5 });
    w.y += 2;
  });
  w.y += 8;
  w.paragraph('General information only, not medical advice. If you have a health condition, are pregnant, or are under 18, check any plan with a qualified professional.', M, W - 2 * M, {
    size: 8,
    weight: 600,
    color: C.text,
  });

  // Footers
  w.pages.forEach((canvas, i) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = `400 7.5px ${FONT}`;
    ctx.fillStyle = C.faint;
    ctx.textAlign = 'left';
    ctx.fillText('StartFit · Nutrition report', M, H - 22);
    ctx.textAlign = 'right';
    ctx.fillText(`Page ${i + 1} of ${w.pages.length}`, W - M, H - 22);
  });

  return canvasesToPdfBlob(w.pages);
}
