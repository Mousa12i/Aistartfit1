// Tiny dependency-free PDF writer: one JPEG image per page. Pages are drawn on
// <canvas> first, so any language (including Arabic) renders exactly as on screen.

export interface PdfImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export const A4_PT = { width: 595.28, height: 841.89 };

export function buildPdf(images: PdfImage[], pageWidth = A4_PT.width, pageHeight = A4_PT.height): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const beginObject = (id: number) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
  };

  // Header with a binary comment so transfer tools treat the file as binary.
  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const pageCount = images.length;
  const pageIds = images.map((_, i) => 3 + i * 3);
  const w = pageWidth.toFixed(2);
  const h = pageHeight.toFixed(2);

  beginObject(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  beginObject(2);
  push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>\nendobj\n`);

  images.forEach((img, i) => {
    const pageId = 3 + i * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;

    beginObject(pageId);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );

    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    beginObject(contentId);
    push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream\nendobj\n`);

    beginObject(imageId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`,
    );
    push(img.bytes);
    push('\nendstream\nendobj\n');
  });

  const objectCount = 3 + pageCount * 3;
  const xrefOffset = length;
  let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
  for (let id = 1; id < objectCount; id++) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<PdfImage> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Could not render the report page.'));
          return;
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        resolve({ bytes, width: canvas.width, height: canvas.height });
      },
      'image/jpeg',
      quality,
    );
  });
}

export async function canvasesToPdfBlob(canvases: HTMLCanvasElement[]): Promise<Blob> {
  const images: PdfImage[] = [];
  for (const c of canvases) images.push(await canvasToJpeg(c));
  const bytes = buildPdf(images);
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
