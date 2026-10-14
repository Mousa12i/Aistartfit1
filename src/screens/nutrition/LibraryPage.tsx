import { useMemo, useState } from 'react';
import { BookOpen, ChevronRight, ExternalLink, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ARTICLES, REFERENCES, SUPPLEMENTS, articleById, type ArticleCategory } from '@/lib/nutrition/evidence';
import { matchesQuery } from '@/lib/nutrition/foods';
import { useNutritionNav } from './nav';
import { Chip, EmptyState, Page, PageHeader, Panel, inputClass } from './ui';

const CATEGORIES: ('All' | ArticleCategory)[] = ['All', 'Basics', 'Training', 'Goals', 'Health & safety', 'Practical'];

const GRADE_STYLE: Record<string, string> = {
  Strong: 'bg-lime/15 text-lime',
  'Good for specific uses': 'bg-sky/15 text-sky',
  'Food-first': 'bg-gold/15 text-gold',
  'Only if deficient': 'bg-ink-elevated text-cloud',
  Weak: 'bg-rust/15 text-rust',
};

export function LibraryPage() {
  const { params, go, replace } = useNutritionNav();
  const article = articleById(params.get('a'));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');

  const list = useMemo(
    () =>
      ARTICLES.filter((a) => (category === 'All' || a.category === category) && (!query.trim() || matchesQuery(`${a.title} ${a.summary}`, query))),
    [category, query],
  );

  if (article) {
    return (
      <Page>
        <PageHeader title={article.title} subtitle={`${article.category} · ${article.readMinutes} min read`} onBack={() => replace('library')} />
        <p className="mb-5 text-sm leading-relaxed text-cloud-dim">{article.summary}</p>
        <div className="space-y-5">
          {article.sections.map((s, i) => (
            <section key={i}>
              {s.heading && <h2 className="mb-2 text-[15px] font-semibold text-cloud">{s.heading}</h2>}
              {s.paragraphs?.map((p, k) => (
                <p key={k} className="mb-2 text-sm leading-relaxed text-cloud-dim">
                  {p}
                </p>
              ))}
              {s.bullets && (
                <ul className="space-y-2">
                  {s.bullets.map((b, k) => (
                    <li key={k} className="flex gap-2.5 text-sm leading-relaxed text-cloud-dim">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-lime" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {article.id === 'supplements' && (
          <div className="mt-6 space-y-3">
            {SUPPLEMENTS.map((s) => (
              <Panel key={s.name} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-cloud">{s.name}</p>
                  <span className={cn('flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold', GRADE_STYLE[s.grade])}>{s.grade}</span>
                </div>
                <dl className="mt-2 space-y-1.5 text-xs leading-relaxed">
                  <div>
                    <dt className="inline font-medium text-cloud">Use: </dt>
                    <dd className="inline text-cloud-dim">{s.use}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-cloud">Dose: </dt>
                    <dd className="inline text-cloud-dim">{s.dose}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-cloud">Caution: </dt>
                    <dd className="inline text-cloud-dim">{s.caution}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[10px] text-cloud-muted">Source: {s.refs.map((r) => REFERENCES[r]?.short).filter(Boolean).join('; ')}</p>
              </Panel>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-ink-border bg-ink-surface p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cloud-dim">References</p>
          <ol className="space-y-3">
            {article.refs.map((id, i) => {
              const r = REFERENCES[id];
              if (!r) return null;
              return (
                <li key={id} className="flex gap-2 text-[11px] leading-relaxed text-cloud-dim">
                  <span className="text-cloud-muted">{i + 1}.</span>
                  <span>
                    {r.citation}{' '}
                    <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-lime">
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="mt-4 text-center text-[10px] text-cloud-muted">General information, not medical advice.</p>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Evidence library" subtitle={`${ARTICLES.length} guides · ${Object.keys(REFERENCES).length} checked sources`} onBack={() => go('hub')} />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cloud-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guides" aria-label="Search guides" className={cn(inputClass, 'pl-10')} />
      </div>
      <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-hide">
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No guides match" body="Try another word or category." />
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <Panel key={a.id} className="p-4" onClick={() => go('library', { a: a.id })}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-lime">
                    {a.category} · {a.readMinutes} min
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-cloud">{a.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-cloud-dim">{a.summary}</p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-cloud-muted" />
              </div>
            </Panel>
          ))}
        </div>
      )}
      <p className="mt-6 text-center text-[10px] leading-relaxed text-cloud-muted">
        Every guide lists its sources. Sources are position stands, systematic reviews, clinical trials and official guidelines.
      </p>
    </Page>
  );
}
