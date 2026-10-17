import { Award, Clock, Languages, MapPin, Monitor, ShieldCheck } from 'lucide-react';
import { useI18n, type MessageKey } from '@/lib/i18n';
import type { CoachProfile } from '@/lib/coach/api';
import { Avatar } from './ui';

const FORMAT_KEY: Record<string, MessageKey> = { online: 'setup.formatOnline', in_person: 'setup.formatInPerson', hybrid: 'setup.formatHybrid' };

export const specialtyKey = (s: string) => `spec.${s}` as MessageKey;
/** Languages a coach can say they speak (ISO 639-1); names come from the browser in the reader's language. */
export const SPOKEN_LANGUAGES = ['en', 'ar', 'es', 'fr', 'de', 'pt', 'tr', 'it', 'nl', 'pl', 'ru', 'uk', 'fa', 'ur', 'hi', 'bn', 'zh', 'ja', 'ko', 'id', 'ms', 'sv', 'el', 'he', 'ku', 'so', 'sw'] as const;
export function languageName(code: string, uiLang: string): string {
  try { return new Intl.DisplayNames([uiLang], { type: 'language' }).of(code) ?? code; } catch { return code; }
}

/** What athletes see about a coach: before joining and on My coach. Credentials are labelled as self-declared. */
export function CoachProfileCard({ p, compact = false }: { p: CoachProfile; compact?: boolean }) {
  const { t, lang } = useI18n();
  const name = p.brand_name || p.display_name || '';
  const agreed = p.terms_accepted_at ? new Date(p.terms_accepted_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  return (
    <div className="overflow-hidden rounded-3xl border border-ink-border bg-ink-surface" data-testid="coach-profile-card">
      <div className="bg-gradient-to-br from-lime/[0.10] to-transparent p-5">
        <div className="flex items-center gap-4">
          <Avatar id={p.coach_id} name={p.display_name} url={p.avatar_url} size={60} />
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-cloud" dir="auto">{name}</div>
            {p.brand_name && p.display_name && <div className="truncate text-xs text-cloud-dim" dir="auto">{p.display_name}</div>}
            {p.headline && <div className="mt-1 text-sm font-medium text-lime" dir="auto">{p.headline}</div>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-cloud-dim">
          {p.years != null && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{t('setup.yearsShown', { n: p.years })}</span>}
          {p.format && <span className="flex items-center gap-1.5"><Monitor className="h-3.5 w-3.5" />{t(FORMAT_KEY[p.format])}</span>}
          {p.location && <span className="flex items-center gap-1.5" dir="auto"><MapPin className="h-3.5 w-3.5" />{p.location}</span>}
          {p.languages.length > 0 && <span className="flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" />{p.languages.map((c) => languageName(c, lang)).join(' · ')}</span>}
        </div>
      </div>

      <div className="space-y-4 p-5 pt-4">
        {p.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.specialties.map((s) => <span key={s} className="rounded-full border border-lime/30 bg-lime/[0.06] px-2.5 py-1 text-[11px] font-medium text-cloud">{t(specialtyKey(s))}</span>)}
          </div>
        )}
        {p.bio && <p dir="auto" className="whitespace-pre-line text-sm leading-relaxed text-cloud">{p.bio}</p>}
        {!compact && p.philosophy && (
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-cloud-muted">{t('setup.philosophyShown')}</div>
            <p dir="auto" className="border-s-2 border-lime/50 ps-3 text-sm italic leading-relaxed text-cloud-dim">{p.philosophy}</p>
          </div>
        )}
        {!compact && (p.certifications.length > 0 || p.insured || p.dietitian) && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cloud-muted"><Award className="h-3.5 w-3.5" />{t('setup.credentialsShown')}</div>
            <ul className="space-y-1 text-xs text-cloud">
              {p.certifications.map((c, i) => (
                <li key={i} dir="auto">• {c.name}{c.issuer ? ` — ${c.issuer}` : ''}{c.year ? ` (${c.year})` : ''}</li>
              ))}
              {p.dietitian && <li>• {t('setup.dietitianShown')}</li>}
              {p.insured && <li>• {t('setup.insuredShown')}</li>}
            </ul>
            <p className="mt-1.5 text-[10px] leading-relaxed text-cloud-muted">{t('setup.selfDeclared')}</p>
          </div>
        )}
        {p.terms_ok && agreed && (
          <div className="flex items-center gap-2 rounded-xl bg-ink-elevated px-3 py-2 text-[11px] text-cloud-dim">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 text-lime" />{t('setup.agreedRules', { date: agreed })}
          </div>
        )}
      </div>
    </div>
  );
}
