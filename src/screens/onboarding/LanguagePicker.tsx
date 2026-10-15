import { useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LANGUAGES, useI18n, type LangCode } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

/** Asked right after sign-in, before anything else, and reused in Settings. */
export function LanguagePicker({ onDone }: { onDone?: () => void }) {
  const { lang, setLanguage, t } = useI18n();
  const [picked, setPicked] = useState<LangCode>(lang);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await setLanguage(picked);
      onDone?.();
    } catch {
      setError(translate(picked, 'lang.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-10 pt-12" data-testid="language-picker">
      <div className="mx-auto max-w-md" dir={LANGUAGES.find((l) => l.code === picked)?.dir}>
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/10 text-lime"><Globe className="h-6 w-6" /></span>
        {/* The heading follows the highlighted language, so people see their own language as they choose */}
        <h1 className="text-display-sm font-bold text-cloud" dir={LANGUAGES.find((l) => l.code === picked)?.dir}>{translate(picked, 'lang.pickTitle')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-cloud-dim" dir={LANGUAGES.find((l) => l.code === picked)?.dir}>{translate(picked, 'lang.pickSubtitle')}</p>
        <div className="mt-5 grid gap-2" role="radiogroup" aria-label={t('lang.settingsTitle')}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={picked === l.code}
              onClick={() => setPicked(l.code)}
              data-testid={`lang-${l.code}`}
              className={cn(
                'flex items-center justify-between rounded-xl border px-4 py-3.5 text-start transition-colors',
                picked === l.code ? 'border-lime/60 bg-lime/10' : 'border-ink-border bg-ink-surface hover:border-cloud-dim/40',
              )}
            >
              <span>
                <span className="block text-[15px] font-semibold text-cloud" dir={l.dir}>{l.native}</span>
                {l.native !== l.english && <span className="text-[11px] text-cloud-dim" dir="ltr">{l.english}</span>}
              </span>
              {picked === l.code && <Check className="h-5 w-5 text-lime" />}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-xs text-rust">{error}</p>}
        <button type="button" onClick={() => void save()} disabled={saving} data-testid="lang-continue" className="mt-5 w-full rounded-xl bg-lime py-3.5 text-sm font-bold text-ink-bg disabled:opacity-50">
          {saving ? '…' : translate(picked, 'common.continue')}
        </button>
      </div>
    </div>
  );
}
