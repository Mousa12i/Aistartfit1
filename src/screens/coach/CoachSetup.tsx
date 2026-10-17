import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, ExternalLink, Plus, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { acceptCoachTerms, COACH_TERMS_VERSION, saveCoachProfile, type Certification, type CoachProfile } from '@/lib/coach/api';
import { COACH_RULES, MAX_SPECIALTIES, RULE_SOURCES, SPECIALTIES } from '@/lib/coach/rules';
import { CoachProfileCard, languageName, specialtyKey, SPOKEN_LANGUAGES } from './CoachProfileCard';

const field = 'w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-2.5 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none';
type Format = 'online' | 'in_person' | 'hybrid';
type Step = 'about' | 'focus' | 'credentials' | 'rules' | 'preview';

/**
 * Coach onboarding (and later editing): who you are, what you coach, credentials, the coach rules, then a preview
 * of the card athletes see. The rules step is required before athletes can join (the database checks it too).
 */
export function CoachSetup({ mode = 'onboard' }: { mode?: 'onboard' | 'edit' }) {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { t, dir, lang } = useI18n();
  const termsOk = profile?.coach_terms_version === COACH_TERMS_VERSION;
  const steps: Step[] = mode === 'edit' && termsOk ? ['about', 'focus', 'credentials', 'preview'] : ['about', 'focus', 'credentials', 'rules', 'preview'];
  const [i, setI] = useState(0);
  const step = steps[i];

  const [name, setName] = useState(profile?.display_name ?? '');
  const [brand, setBrand] = useState(profile?.coach_brand_name ?? '');
  const [headline, setHeadline] = useState(profile?.coach_headline ?? '');
  const [years, setYears] = useState(profile?.coach_years != null ? String(profile.coach_years) : '');
  const [format, setFormat] = useState<Format | null>(profile?.coach_format ?? null);
  const [location, setLocation] = useState(profile?.coach_location ?? '');
  const [languages, setLanguages] = useState<string[]>(profile?.coach_languages?.length ? profile.coach_languages : [lang]);
  const [specialties, setSpecialties] = useState<string[]>(profile?.coach_specialties ?? []);
  const [bio, setBio] = useState(profile?.coach_bio ?? '');
  const [philosophy, setPhilosophy] = useState(profile?.coach_philosophy ?? '');
  const [certs, setCerts] = useState<Certification[]>(profile?.coach_certifications ?? []);
  const [insured, setInsured] = useState<boolean>(!!profile?.coach_insured);
  const [dietitian, setDietitian] = useState<boolean>(!!profile?.coach_dietitian);
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearsNum = years.trim() === '' ? null : Number(years);
  const yearsValid = yearsNum == null || (Number.isInteger(yearsNum) && yearsNum >= 0 && yearsNum <= 60);
  const cleanCerts = certs.map((c) => ({ name: c.name.trim(), issuer: c.issuer?.trim() || null, year: c.year })).filter((c) => c.name);
  const allAgreed = COACH_RULES.every((s) => agreed[s.id]);

  const canNext = (() => {
    if (step === 'about') return name.trim().length >= 2 && !!format && languages.length > 0 && yearsValid;
    if (step === 'focus') return specialties.length > 0 && bio.trim().length >= 40;
    if (step === 'credentials') return cleanCerts.every((c) => c.year == null || (c.year >= 1950 && c.year <= new Date().getFullYear()));
    if (step === 'rules') return allAgreed;
    return true;
  })();

  const preview: CoachProfile = useMemo(() => ({
    coach_id: user?.id ?? 'me', display_name: name.trim() || null, brand_name: brand.trim() || null, bio: bio.trim() || null,
    avatar_url: profile?.avatar_url ?? null, headline: headline.trim() || null, specialties, years: yearsNum, languages, format,
    location: location.trim() || null, philosophy: philosophy.trim() || null, certifications: cleanCerts, insured, dietitian,
    checkin_day: profile?.coach_checkin_day ?? null, terms_ok: termsOk || allAgreed,
    terms_accepted_at: termsOk ? profile?.coach_terms_accepted_at ?? null : allAgreed ? new Date().toISOString() : null,
  }), [user, name, brand, bio, profile, headline, specialties, yearsNum, languages, format, location, philosophy, cleanCerts, insured, dietitian, termsOk, allAgreed]);

  const finish = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await saveCoachProfile(user.id, {
        display_name: name.trim(), coach_brand_name: brand.trim() || null, coach_headline: headline.trim().slice(0, 80) || null,
        coach_years: yearsNum, coach_format: format, coach_location: location.trim().slice(0, 80) || null, coach_languages: languages.slice(0, 8),
        coach_specialties: specialties.slice(0, MAX_SPECIALTIES), coach_bio: bio.trim() || null, coach_philosophy: philosophy.trim().slice(0, 300) || null,
        coach_certifications: cleanCerts.slice(0, 10), coach_insured: insured, coach_dietitian: dietitian,
      });
      if (!termsOk) await acceptCoachTerms();
      await refreshProfile();
      navigate('/', { replace: true });
    } catch {
      setError(t('coach.saveError'));
      setBusy(false);
    }
  };

  const toggle = (list: string[], set: (v: string[]) => void, v: string, max: number) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v]);

  return (
    <div className="flex min-h-screen flex-col bg-ink-bg" dir={dir} data-testid="coach-setup">
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <button type="button" onClick={() => (i === 0 ? (mode === 'edit' ? navigate(-1) : undefined) : setI(i - 1))} disabled={i === 0 && mode !== 'edit'} aria-label={t('common.back')}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim disabled:opacity-30">
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-elevated">
          <div className="h-full rounded-full bg-lime transition-all duration-500" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
        <span className="w-10 text-end text-xs tabular-nums text-cloud-dim" dir="ltr">{i + 1}/{steps.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
        {step === 'about' && (
          <Section title={t('setup.aboutTitle')} subtitle={t(mode === 'edit' ? 'setup.editSubtitle' : 'setup.aboutSubtitle')}>
            <Label text={t('setup.name')} />
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} dir="auto" data-testid="setup-name" />
            <Label text={t('setup.brand')} hint={t('setup.optional')} />
            <input className={field} value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={60} placeholder={t('setup.brandPh')} dir="auto" />
            <Label text={t('setup.headline')} hint={t('setup.optional')} />
            <input className={field} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} placeholder={t('setup.headlinePh')} dir="auto" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label text={t('setup.years')} />
                <input className={cn(field, !yearsValid && 'border-rust')} value={years} onChange={(e) => setYears(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} inputMode="numeric" placeholder="5" dir="ltr" data-testid="setup-years" />
              </div>
              <div>
                <Label text={t('setup.location')} hint={t('setup.optional')} />
                <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} placeholder={t('setup.locationPh')} dir="auto" />
              </div>
            </div>
            <Label text={t('setup.format')} />
            <div className="grid grid-cols-3 gap-2">
              {(['online', 'in_person', 'hybrid'] as Format[]).map((f) => (
                <Chip key={f} active={format === f} onClick={() => setFormat(f)} testId={`setup-format-${f}`}>
                  {t(f === 'online' ? 'setup.formatOnline' : f === 'in_person' ? 'setup.formatInPerson' : 'setup.formatHybrid')}
                </Chip>
              ))}
            </div>
            <Label text={t('setup.languages')} hint={t('setup.upTo', { n: 8 })} />
            <div className="flex flex-wrap gap-1.5">
              {SPOKEN_LANGUAGES.map((c) => (
                <Chip key={c} small active={languages.includes(c)} onClick={() => toggle(languages, setLanguages, c, 8)}>{languageName(c, lang)}</Chip>
              ))}
            </div>
          </Section>
        )}

        {step === 'focus' && (
          <Section title={t('setup.focusTitle')} subtitle={t('setup.focusSubtitle')}>
            <Label text={t('setup.specialties')} hint={t('setup.upTo', { n: MAX_SPECIALTIES })} />
            <div className="flex flex-wrap gap-1.5">
              {SPECIALTIES.map((s) => (
                <Chip key={s} small active={specialties.includes(s)} onClick={() => toggle(specialties, setSpecialties, s, MAX_SPECIALTIES)} testId={`setup-spec-${s}`}>{t(specialtyKey(s))}</Chip>
              ))}
            </div>
            {specialties.includes('return_to_training') && <p className="mt-2 text-[11px] leading-relaxed text-gold">{t('setup.returnNote')}</p>}
            <Label text={t('setup.bio')} hint={t('setup.bioHint')} />
            <textarea className={cn(field, 'min-h-[130px] resize-none')} value={bio} onChange={(e) => setBio(e.target.value.slice(0, 600))} placeholder={t('setup.bioPh')} dir="auto" data-testid="setup-bio" />
            <div className="mt-1 text-end text-[10px] text-cloud-muted" dir="ltr">{bio.trim().length}/600</div>
            <Label text={t('setup.philosophy')} hint={t('setup.optional')} />
            <textarea className={cn(field, 'min-h-[80px] resize-none')} value={philosophy} onChange={(e) => setPhilosophy(e.target.value.slice(0, 300))} placeholder={t('setup.philosophyPh')} dir="auto" />
          </Section>
        )}

        {step === 'credentials' && (
          <Section title={t('setup.credTitle')} subtitle={t('setup.credSubtitle')}>
            <div className="space-y-2">
              {certs.map((c, k) => (
                <div key={k} className="rounded-2xl border border-ink-border bg-ink-surface p-3">
                  <div className="flex items-center gap-2">
                    <input className={field} value={c.name} onChange={(e) => setCerts(certs.map((x, j) => (j === k ? { ...x, name: e.target.value.slice(0, 100) } : x)))} placeholder={t('setup.certName')} dir="auto" />
                    <button type="button" onClick={() => setCerts(certs.filter((_, j) => j !== k))} aria-label={t('setup.remove')} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_90px] gap-2">
                    <input className={field} value={c.issuer ?? ''} onChange={(e) => setCerts(certs.map((x, j) => (j === k ? { ...x, issuer: e.target.value.slice(0, 80) } : x)))} placeholder={t('setup.certIssuer')} dir="auto" />
                    <input className={field} value={c.year ?? ''} inputMode="numeric" onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 4); setCerts(certs.map((x, j) => (j === k ? { ...x, year: v ? Number(v) : null } : x))); }} placeholder={t('setup.certYear')} dir="ltr" />
                  </div>
                </div>
              ))}
            </div>
            {certs.length < 10 && (
              <button type="button" onClick={() => setCerts([...certs, { name: '', issuer: null, year: null }])} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-border py-3 text-sm font-semibold text-lime" data-testid="setup-add-cert">
                <Plus className="h-4 w-4" />{t('setup.addCert')}
              </button>
            )}
            <div className="mt-5 space-y-2">
              <Toggle checked={insured} onChange={setInsured} label={t('setup.insured')} hint={t('setup.insuredHint')} />
              <Toggle checked={dietitian} onChange={setDietitian} label={t('setup.dietitian')} hint={t('setup.dietitianHint')} />
            </div>
            <p className="mt-4 rounded-xl bg-ink-elevated p-3 text-[11px] leading-relaxed text-cloud-dim">{t('setup.honestNote')}</p>
          </Section>
        )}

        {step === 'rules' && (
          <Section title={t('rules.title')} subtitle={t('rules.subtitle')}>
            <RulesList agreed={agreed} onToggle={(id) => setAgreed((a) => ({ ...a, [id]: !a[id] }))} />
          </Section>
        )}

        {step === 'preview' && (
          <Section title={t('setup.previewTitle')} subtitle={t('setup.previewSubtitle')}>
            <CoachProfileCard p={preview} />
          </Section>
        )}
      </div>

      <div className="border-t border-ink-border px-5 pb-8 pt-3">
        {error && <p className="mb-2 text-center text-xs text-rust">{error}</p>}
        <button type="button" disabled={!canNext || busy} onClick={() => (step === 'preview' ? finish() : setI(i + 1))} data-testid="setup-next"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lime text-sm font-bold text-ink-bg disabled:opacity-40">
          {step === 'preview' ? t(mode === 'edit' ? 'common.save' : 'setup.finish') : step === 'rules' ? t('rules.agree') : t('common.continue')}
          {step !== 'preview' && <ChevronRight className="h-5 w-5 rtl:rotate-180" />}
        </button>
      </div>
    </div>
  );
}

/** The rules with their sources; with onToggle each section gets an "I agree" box. */
export function RulesList({ agreed, onToggle }: { agreed?: Record<string, boolean>; onToggle?: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3" data-testid="coach-rules">
      {COACH_RULES.map((s) => {
        const ok = !!agreed?.[s.id];
        const sources = [...new Set(s.rules.flatMap((r) => r.sources))].map((id) => RULE_SOURCES[id]).filter(Boolean);
        return (
          <section key={s.id} className={cn('rounded-2xl border p-4', onToggle && ok ? 'border-lime/40 bg-lime/[0.04]' : 'border-ink-border bg-ink-surface')}>
            <h3 className="mb-2 text-sm font-bold text-cloud">{t(s.title)}</h3>
            <ul className="space-y-2">
              {s.rules.map((r) => <li key={r.key} className="flex gap-2 text-xs leading-relaxed text-cloud"><span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-lime" />{t(r.key)}</li>)}
            </ul>
            {sources.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {sources.map((src) => (
                  <a key={src.id} href={src.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md bg-ink-elevated px-2 py-0.5 text-[10px] text-cloud-dim hover:text-lime">
                    {src.short}<ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ))}
              </div>
            )}
            {onToggle && (
              <button type="button" role="checkbox" aria-checked={ok} onClick={() => onToggle(s.id)} data-testid={`rules-agree-${s.id}`}
                className="mt-3 flex w-full items-center gap-2.5 rounded-xl bg-ink-bg px-3 py-2.5 text-start text-xs font-semibold text-cloud">
                <span className={cn('flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border', ok ? 'border-lime bg-lime text-ink-bg' : 'border-ink-border')}>{ok && <Check className="h-3.5 w-3.5" />}</span>
                {t('rules.agreeSection')}
              </button>
            )}
          </section>
        );
      })}
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-cloud-muted"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{t('rules.footer')}</p>
    </div>
  );
}

/** /coach/rules: the rules to read again at any time. */
export function CoachRulesPage() {
  const navigate = useNavigate();
  const { t, dir, lang } = useI18n();
  const { profile } = useAuth();
  const at = profile?.coach_terms_accepted_at ? new Date(profile.coach_terms_accepted_at).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-16 pt-5" dir={dir}>
      <header className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label={t('common.back')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></button>
        <h1 className="text-[22px] font-bold text-cloud">{t('rules.title')}</h1>
      </header>
      {at && <p className="mb-4 text-xs text-cloud-dim">{t('rules.acceptedOn', { date: at })}</p>}
      <RulesList />
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="animate-fade-in-up">
      <h2 className="text-display-md text-cloud">{title}</h2>
      <p className="mb-5 mt-1 text-sm leading-relaxed text-cloud-dim">{subtitle}</p>
      {children}
    </div>
  );
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return <div className="mb-1.5 mt-4 flex items-baseline justify-between gap-2 text-xs font-medium text-cloud-dim first:mt-0"><span>{text}</span>{hint && <span className="text-[10px] text-cloud-muted">{hint}</span>}</div>;
}

function Chip({ active, onClick, children, small, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} aria-pressed={active}
      className={cn('rounded-xl border font-medium transition-colors', small ? 'px-3 py-1.5 text-xs' : 'py-2.5 text-sm', active ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border bg-ink-surface text-cloud-dim')}>
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 rounded-2xl border border-ink-border bg-ink-surface p-3.5 text-start">
      <span className={cn('mt-0.5 flex h-6 w-10 flex-shrink-0 items-center rounded-full p-0.5 transition-colors', checked ? 'bg-lime' : 'bg-ink-elevated')}>
        <span className={cn('h-5 w-5 rounded-full bg-white transition-transform', checked ? 'translate-x-4 rtl:-translate-x-4' : '')} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-cloud">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-cloud-dim">{hint}</span>
      </span>
    </button>
  );
}

