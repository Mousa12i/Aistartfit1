#!/usr/bin/env node
// Writes the public privacy policy page (public/privacy.html) and the account-deletion page
// (public/delete-account.html) from src/lib/legal/privacy-policy.ts, so the web pages, the in-app page and
// the store listings always show the same text.
// delete-account.html is the "web link resource" Google Play's Data safety form asks for (Data deletion);
// it lets people ask for deletion without the app.
// Vite copies public/ into the build, so after deploying it is at https://<your-domain>/privacy.html —
// the URL to enter in App Store Connect (Privacy Policy URL) and Google Play Console (App content → Privacy policy).
//
// Usage: node scripts/generate-privacy-html.mjs   (run again after editing privacy-policy.ts)
// It warns while [[placeholders]] remain; fill them in before publishing the URL.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esbuild = await import(process.env.ESBUILD_PATH ?? 'esbuild');

const bundle = path.join(os.tmpdir(), `startfit-privacy-${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(root, 'src/lib/legal/privacy-policy.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundle,
  logLevel: 'error',
});

let mod;
try {
  mod = await import(pathToFileURL(bundle).href);
} finally {
  fs.rmSync(bundle, { force: true });
}
const { PRIVACY_POLICY, policyHasPlaceholders } = mod;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Placeholders stand out so they cannot be missed.
const text = (s) => esc(s).replace(/\[\[(.+?)\]\]/g, '<mark>[[$1]]</mark>');

const renderSection = (s) => {
    const parts = [`<section id="${esc(s.id)}">`, `<h2>${text(s.title)}</h2>`];
    for (const p of s.paragraphs ?? []) parts.push(`<p>${text(p)}</p>`);
    if (s.table) {
      parts.push('<div class="table"><table><thead><tr>');
      for (const h of s.table.head) parts.push(`<th scope="col">${text(h)}</th>`);
      parts.push('</tr></thead><tbody>');
      for (const r of s.table.rows) parts.push(`<tr>${r.map((c) => `<td>${text(c)}</td>`).join('')}</tr>`);
      parts.push('</tbody></table></div>');
    }
    if (s.bullets) parts.push(`<ul>${s.bullets.map((b) => `<li>${text(b)}</li>`).join('')}</ul>`);
    parts.push('</section>');
    return parts.join('\n');
};
const sections = PRIVACY_POLICY.sections.map(renderSection).join('\n');

const page = ({ title, description, body }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<style>
  :root { color-scheme: light dark; --bg:#ffffff; --fg:#1b1f23; --dim:#57606a; --line:#d0d7de; --head:#f6f8fa; --accent:#3f6212; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b0f12; --fg:#e6edf3; --dim:#9aa7b2; --line:#2a3540; --head:#121a20; --accent:#a3e635; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 1.8rem; line-height: 1.2; margin: 0 0 4px; }
  h2 { font-size: 1.15rem; margin: 32px 0 8px; }
  .version { color: var(--dim); font-size: .9rem; margin: 0 0 24px; }
  p, li { color: var(--fg); }
  ul { padding-left: 1.25rem; }
  .table { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; margin: 8px 0 12px; }
  table { border-collapse: collapse; width: 100%; min-width: 560px; font-size: .9rem; }
  th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-top: 1px solid var(--line); }
  thead th { background: var(--head); border-top: 0; }
  td:first-child { font-weight: 600; }
  a { color: var(--accent); }
  mark { background: #fde047; color: #1b1f23; padding: 0 2px; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;

const policyHtml = page({
  title: PRIVACY_POLICY.title,
  description: 'How StartFit collects, uses, shares and protects your data, and your rights.',
  body: `<h1>${esc(PRIVACY_POLICY.title)}</h1>\n<p class="version">Version ${esc(PRIVACY_POLICY.version)}</p>\n${sections}`,
});

const del = PRIVACY_POLICY.sections.find((s) => s.id === 'delete-account');
if (!del) throw new Error('privacy-policy.ts has no delete-account section');
const deleteHtml = page({
  title: 'Delete your StartFit account',
  description: 'How to delete your StartFit account and data, with or without the app.',
  body: `<h1>Delete your StartFit account</h1>\n<p class="version">StartFit · Version ${esc(PRIVACY_POLICY.version)}</p>\n${renderSection({ ...del, title: 'How to delete your account and data' })}\n<p>Full details: <a href="privacy.html#delete-account">StartFit Privacy Policy</a>.</p>`,
});

for (const [file, html] of [['public/privacy.html', policyHtml], ['public/delete-account.html', deleteHtml]]) {
  const out = path.join(root, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`Wrote ${file}`);
}
if (policyHasPlaceholders()) {
  console.warn('WARNING: the policy still has [[placeholders]] (highlighted in the page). Fill them in src/lib/legal/privacy-policy.ts, run this again, then publish.');
}
