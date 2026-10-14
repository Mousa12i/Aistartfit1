import { ChevronLeft } from 'lucide-react';
import { PRIVACY_POLICY } from '@/lib/legal/privacy-policy';

export function PrivacyPolicyPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-ink-bg pb-16" data-testid="privacy-policy">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink-border bg-ink-bg/95 px-5 py-4 backdrop-blur-xl">
        <button type="button" onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-cloud">{PRIVACY_POLICY.title}</h1>
      </div>
      <article className="mx-auto max-w-2xl space-y-6 px-5 pt-5 text-sm leading-relaxed text-cloud-dim">
        <p className="text-xs">Version {PRIVACY_POLICY.version}</p>
        {PRIVACY_POLICY.sections.map((s) => (
          <section key={s.id} id={s.id}>
            <h2 className="mb-2 text-base font-semibold text-cloud">{s.title}</h2>
            {s.paragraphs?.map((p, i) => <p key={i} className="mb-2">{p}</p>)}
            {s.table && (
              <div className="my-2 overflow-x-auto rounded-xl border border-ink-border">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-ink-surface text-cloud">
                    <tr>{s.table.head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((r, i) => (
                      <tr key={i} className="border-t border-ink-border align-top">
                        {r.map((c, j) => <td key={j} className={j === 0 ? 'px-3 py-2 font-medium text-cloud' : 'px-3 py-2'}>{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.bullets && (
              <ul className="list-disc space-y-1 pl-5">
                {s.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
          </section>
        ))}
      </article>
    </div>
  );
}
