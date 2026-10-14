// A small text PDF writer: real, selectable text in the standard Helvetica fonts (no font files
// needed), clickable links and A4 pages. Characters outside Windows-1252 are replaced, so it is
// used for English content such as training plans and their references.
//
// Glyph widths are the Adobe Helvetica / Helvetica-Bold metrics for codes 32-255 (WinAnsiEncoding).

const HELVETICA = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0, 556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 500, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500];
const HELVETICA_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 0, 556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 556, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556];
/** Unicode code points above 255 that WinAnsiEncoding can still show. */
const WIN_ANSI_EXTRA: Record<number, number> = {"338": 140, "339": 156, "352": 138, "353": 154, "376": 159, "381": 142, "382": 158, "402": 131, "710": 136, "732": 152, "8211": 150, "8212": 151, "8216": 145, "8217": 146, "8218": 130, "8220": 147, "8221": 148, "8222": 132, "8224": 134, "8225": 135, "8226": 149, "8230": 133, "8240": 137, "8249": 139, "8250": 155, "8364": 128, "8482": 153};
const REPLACEMENTS: Record<string, string> = { '≤': '<=', '≥': '>=', '→': '->', '←': '<-', '−': '-', '\u00a0': ' ', '\u2009': ' ', '\u202f': ' ', '✓': 'v' };

export const PAGE = { width: 595.28, height: 841.89 };

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

/** Unicode string -> WinAnsi byte values (unsupported characters become "?"). */
export function toWinAnsi(str: string): number[] {
  const out: number[] = [];
  for (const ch of str) {
    const rep = REPLACEMENTS[ch];
    if (rep) {
      for (const c of rep) out.push(c.charCodeAt(0));
      continue;
    }
    const cp = ch.codePointAt(0)!;
    if (cp >= 32 && cp <= 126) out.push(cp);
    else if (cp >= 160 && cp <= 255) out.push(cp);
    else if (WIN_ANSI_EXTRA[cp] != null) out.push(WIN_ANSI_EXTRA[cp]);
    else if (cp === 9) out.push(32);
    else out.push(63);
  }
  return out;
}

export function textWidth(str: string, size: number, bold = false): number {
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  let w = 0;
  for (const b of toWinAnsi(str)) w += table[b - 32] ?? 556;
  return (w / 1000) * size;
}

/** Greedy word wrap using the real glyph widths. Long words are split. */
export function wrapText(str: string, size: number, width: number, bold = false): string[] {
  const lines: string[] = [];
  for (const para of str.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (textWidth(test, size, bold) <= width) {
        line = test;
        continue;
      }
      if (line) lines.push(line);
      if (textWidth(word, size, bold) <= width) {
        line = word;
      } else {
        let chunk = '';
        for (const ch of word) {
          if (textWidth(chunk + ch, size, bold) > width && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      }
    }
    lines.push(line);
  }
  return lines;
}

function pdfString(str: string): string {
  let s = '(';
  for (const b of toWinAnsi(str)) {
    if (b === 40 || b === 41 || b === 92) s += `\\${String.fromCharCode(b)}`;
    else if (b < 32 || b > 126) s += `\\${b.toString(8).padStart(3, '0')}`;
    else s += String.fromCharCode(b);
  }
  return `${s})`;
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();

interface Page {
  ops: string[];
  links: { x: number; y: number; w: number; h: number; url: string }[];
}

export class TextPdf {
  private pages: Page[] = [];
  private current!: Page;

  constructor(private title: string) {
    this.addPage();
  }

  addPage(): void {
    this.current = { ops: [], links: [] };
    this.pages.push(this.current);
  }

  get pageCount(): number {
    return this.pages.length;
  }

  /** Draw on an earlier page (used for "page x of y" footers). */
  onPage(index: number, draw: () => void): void {
    const keep = this.current;
    this.current = this.pages[index];
    draw();
    this.current = keep;
  }

  /** y is measured from the top of the page (baseline of the text). */
  text(str: string, x: number, yTop: number, size: number, opts: { bold?: boolean; color?: Rgb; align?: 'left' | 'right' | 'center' } = {}): void {
    const w = textWidth(str, size, opts.bold);
    const left = opts.align === 'right' ? x - w : opts.align === 'center' ? x - w / 2 : x;
    const [r, g, b] = opts.color ?? [0.1, 0.12, 0.11];
    this.current.ops.push(
      `BT /${opts.bold ? 'F2' : 'F1'} ${num(size)} Tf ${num(r)} ${num(g)} ${num(b)} rg ${num(left)} ${num(PAGE.height - yTop)} Td ${pdfString(str)} Tj ET`,
    );
  }

  rect(x: number, yTop: number, w: number, h: number, color: Rgb): void {
    const [r, g, b] = color;
    this.current.ops.push(`${num(r)} ${num(g)} ${num(b)} rg ${num(x)} ${num(PAGE.height - yTop - h)} ${num(w)} ${num(h)} re f`);
  }

  line(x1: number, y1Top: number, x2: number, y2Top: number, color: Rgb, width = 0.5): void {
    const [r, g, b] = color;
    this.current.ops.push(`${num(r)} ${num(g)} ${num(b)} RG ${num(width)} w ${num(x1)} ${num(PAGE.height - y1Top)} m ${num(x2)} ${num(PAGE.height - y2Top)} l S`);
  }

  /** A clickable area (top-left origin) that opens a URL. */
  link(x: number, yTop: number, w: number, h: number, url: string): void {
    this.current.links.push({ x, y: PAGE.height - yTop - h, w, h, url });
  }

  toBytes(): Uint8Array {
    const enc = new TextEncoder();
    const parts: Uint8Array[] = [];
    const offsets: number[] = [];
    let length = 0;
    const push = (s: string) => {
      const b = enc.encode(s);
      parts.push(b);
      length += b.length;
    };
    const obj = (id: number, body: string) => {
      offsets[id] = length;
      push(`${id} 0 obj\n${body}\nendobj\n`);
    };

    push('%PDF-1.4\n');
    // 1 catalog, 2 pages, 3 font, 4 bold font, 5 info, then per page: page, content, links...
    let next = 6;
    const pageIds: number[] = [];
    const plan = this.pages.map((p) => {
      const pageId = next++;
      const contentId = next++;
      const linkIds = p.links.map(() => next++);
      pageIds.push(pageId);
      return { p, pageId, contentId, linkIds };
    });

    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    // Document info uses PDFDocEncoding, which only matches WinAnsi outside 0x80-0x9F: keep the title plain.
    const plainTitle = this.title.replace(/[\u2013\u2014]/g, '-').replace(/[^\x20-\x7e\u00a0-\u00ff]/g, '');
    obj(5, `<< /Title ${pdfString(plainTitle)} /Producer (StartFit) /Creator (StartFit plan engine) >>`);

    for (const { p, pageId, contentId, linkIds } of plan) {
      const annots = linkIds.length ? ` /Annots [${linkIds.map((id) => `${id} 0 R`).join(' ')}]` : '';
      obj(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R${annots} >>`,
      );
      const stream = p.ops.join('\n');
      obj(contentId, `<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}\nendstream`);
      p.links.forEach((l, i) => {
        obj(
          linkIds[i],
          `<< /Type /Annot /Subtype /Link /Rect [${num(l.x)} ${num(l.y)} ${num(l.x + l.w)} ${num(l.y + l.h)}] /Border [0 0 0] /A << /S /URI /URI ${pdfString(l.url)} >> >>`,
        );
      });
    }

    const xref = length;
    let table = `xref\n0 ${next}\n0000000000 65535 f \n`;
    for (let id = 1; id < next; id++) table += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
    push(table);
    push(`trailer\n<< /Size ${next} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

    const out = new Uint8Array(length);
    let pos = 0;
    for (const part of parts) {
      out.set(part, pos);
      pos += part.length;
    }
    return out;
  }
}
