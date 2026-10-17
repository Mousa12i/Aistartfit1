// CSV export (RFC 4180): every field quoted when needed, quotes doubled, CRLF line ends.
// Cells that start with = + - @ are prefixed with ' so spreadsheet apps do not run them as formulas
// (OWASP "CSV injection"); numbers are left as numbers.

export type Cell = string | number | boolean | null | undefined;

export function csvCell(v: Cell): string {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
