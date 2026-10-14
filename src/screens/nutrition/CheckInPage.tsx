import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Phone, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/nutrition/api';
import { formatShortDate, dateKeyFromISO } from '@/lib/nutrition/dates';
import {
  HEALTH_CONDITIONS,
  SCOFF_QUESTIONS,
  SUPPORT_LINES,
  scoreScoff,
  type ConditionId,
  type ScoffId,
  type ScreeningRecord,
} from '@/lib/nutrition/screening';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';
import { Chip, Citations, Notice, Page, PageHeader, Panel, Section, SetupRequired, Toast, Toggle, inputClass } from './ui';

const DIET_PREFS = [
  { id: 'halal', label: 'Halal' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'pescatarian', label: 'Pescatarian' },
  { id: 'dairy_free', label: 'Dairy-free' },
  { id: 'gluten_free', label: 'Gluten-free' },
];

type Answer = boolean | null;

export function CheckInPage() {
  const n = useNutrition();
  const { params, go } = useNutritionNav();
  const existing = n.settings.screening;
  const [answers, setAnswers] = useState<Record<ScoffId, Answer>>(() => initialAnswers(existing));
  const [pregnant, setPregnant] = useState<Answer>(existing ? existing.pregnant : null);
  const [under18, setUnder18] = useState<Answer>(existing ? existing.under18 : null);
  const [conditions, setConditions] = useState<ConditionId[]>(existing?.conditions ?? []);
  const [editing, setEditing] = useState(!existing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [allergyText, setAllergyText] = useState('');
  const supportRef = useRef<HTMLDivElement>(null);

  const profileAge = n.profile?.age ?? null;
  const ageKnown = profileAge != null && profileAge > 0;

  useEffect(() => {
    if (params.get('focus') === 'support') supportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [params]);

  // Settings can arrive after the page opens; show the saved check-in when they do.
  useEffect(() => {
    if (!existing) return;
    setAnswers(initialAnswers(existing));
    setPregnant(existing.pregnant);
    setUnder18(existing.under18);
    setConditions(existing.conditions ?? []);
    setEditing(false);
  }, [existing]);

  if (!n.settingsAvailable) {
    return (
      <Page>
        <PageHeader title="Check-in & settings" onBack={() => go('hub')} />
        <SetupRequired feature="The wellbeing check-in and preferences" />
      </Page>
    );
  }

  const allAnswered = SCOFF_QUESTIONS.every((q) => answers[q.id] != null) && pregnant != null && (ageKnown || under18 != null);

  const saveCheckIn = async () => {
    if (!allAnswered) {
      setError('Please answer every question (you can change answers any time).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const clean = Object.fromEntries(SCOFF_QUESTIONS.map((q) => [q.id, answers[q.id] === true])) as Record<ScoffId, boolean>;
      const { score, positive } = scoreScoff(clean);
      const record: ScreeningRecord = {
        version: 'scoff-1999',
        answers: clean,
        score,
        positive,
        under18: ageKnown ? (profileAge as number) < 18 : under18 === true,
        pregnant: pregnant === true,
        conditions,
        completedAt: new Date().toISOString(),
      };
      const firstPositive = positive && !existing?.positive;
      await n.saveSettings({
        screening: record,
        ...(firstPositive ? { no_numbers: true } : {}),
        // A positive screen pauses weight goals: switch to maintenance (this also counts as the plan being set).
        ...(positive
          ? {
              goal_mode: 'maintain' as const,
              rate_pct: 0,
              kcal_override: null,
              mode_started_at: n.settings.goal_mode === 'maintain' && n.settings.mode_started_at ? n.settings.mode_started_at : n.today,
            }
          : {}),
      });
      setEditing(false);
      if (params.get('next') === 'plan' && !positive) {
        go('plan');
        return;
      }
      setToast('Check-in saved');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const savePref = async (patch: Parameters<typeof n.saveSettings>[0], message: string) => {
    setBusy(true);
    setError(null);
    try {
      await n.saveSettings(patch);
      setToast(message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleDiet = (id: string) => {
    const has = n.settings.diet_prefs.includes(id);
    void savePref({ diet_prefs: has ? n.settings.diet_prefs.filter((d) => d !== id) : [...n.settings.diet_prefs, id] }, 'Preferences saved');
  };

  const addAllergy = () => {
    const items = allergyText
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !n.settings.allergies.some((a) => a.toLowerCase() === s.toLowerCase()));
    if (!items.length) return;
    setAllergyText('');
    void savePref({ allergies: [...n.settings.allergies, ...items].slice(0, 20) }, 'Allergies saved');
  };

  return (
    <Page>
      <PageHeader title="Check-in & settings" subtitle="Wellbeing, preferences and privacy" onBack={() => go('hub')} />

      {error && (
        <div className="mb-3">
          <Notice tone="warn">{error}</Notice>
        </div>
      )}

      <Section title="Wellbeing check-in">
        {editing ? (
          <Panel className="space-y-5 p-4">
            <p className="text-xs leading-relaxed text-cloud-dim">
              Five short questions about eating, used by doctors as a first screen. Your answers stay in your account and change how the app supports you — for
              example, it will not set weight-loss targets if they could do harm. This is not a diagnosis.
            </p>
            {SCOFF_QUESTIONS.map((q, i) => (
              <YesNo key={q.id} label={`${i + 1}. ${q.text}`} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
            ))}
            <div className="border-t border-ink-border/60 pt-4">
              <p className="mb-3 text-xs font-semibold text-cloud">A few safety questions</p>
              <div className="space-y-4">
                {ageKnown ? (
                  <p className="text-[11px] text-cloud-dim">Age from your profile: {profileAge}.</p>
                ) : (
                  <YesNo label="Are you under 18?" value={under18} onChange={setUnder18} />
                )}
                <YesNo label="Are you pregnant or breastfeeding?" value={pregnant} onChange={setPregnant} />
                <div>
                  <p className="mb-2 text-sm text-cloud">Do any of these apply? (optional)</p>
                  <div className="space-y-2">
                    {HEALTH_CONDITIONS.map((c) => {
                      const checked = conditions.includes(c.id);
                      return (
                        <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-ink-bg/50 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setConditions((prev) => (checked ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                            className="h-4 w-4 accent-[#A6FF32]"
                          />
                          <span className="text-xs text-cloud">{c.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <button type="button" onClick={saveCheckIn} disabled={busy} className="h-12 w-full rounded-xl bg-lime text-sm font-bold text-ink-bg disabled:opacity-50">
              {busy ? 'Saving…' : 'Save check-in'}
            </button>
            <Citations ids={['morgan1999', 'levinson2017']} />
          </Panel>
        ) : existing ? (
          <div className="space-y-3">
            {existing.positive ? (
              <Notice tone="danger" title="It may help to talk to someone">
                Your answers suggest food and eating might be difficult at the moment. That is more common than people think, and support helps. Weight-loss and
                weight-gain targets are paused, and numbers are hidden by default — you are in control of that below.
              </Notice>
            ) : (
              <Notice tone="success" title="Check-in complete">
                Nothing in your answers suggests a concern. You can retake it whenever things change.
              </Notice>
            )}
            {n.safety.reasons
              .filter((r) => !r.startsWith('Your check-in'))
              .map((r) => (
                <Notice key={r} tone="info">
                  {r}
                </Notice>
              ))}
            <div className="flex items-center justify-between rounded-2xl border border-ink-border bg-ink-surface px-4 py-3">
              <span className="text-xs text-cloud-dim">Completed {formatShortDate(dateKeyFromISO(existing.completedAt))}</span>
              <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-lime">
                Retake
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="How numbers are shown">
        <Panel className="p-4">
          <Toggle
            checked={n.settings.no_numbers}
            disabled={busy}
            onChange={(v) => savePref({ no_numbers: v }, v ? 'Numbers hidden' : 'Numbers shown')}
            label="Balanced mode (hide numbers)"
            description="Hides calories, macros and weight. The diary focuses on regular meals, protein at meals and water, and the coach avoids numbers."
          />
        </Panel>
      </Section>

      <Section title="Diet preferences">
        <Panel className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {DIET_PREFS.map((d) => (
              <Chip key={d.id} active={n.settings.diet_prefs.includes(d.id)} onClick={() => toggleDiet(d.id)}>
                {d.label}
              </Chip>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-cloud">Allergies and foods to avoid</p>
            <div className="flex gap-2">
              <input
                value={allergyText}
                onChange={(e) => setAllergyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAllergy();
                  }
                }}
                placeholder="e.g. peanuts, shellfish"
                aria-label="Add allergy"
                className={inputClass}
              />
              <button type="button" onClick={addAllergy} disabled={busy || !allergyText.trim()} className="flex-shrink-0 rounded-xl bg-ink-elevated px-4 text-xs font-semibold text-cloud disabled:opacity-40">
                Add
              </button>
            </div>
            {n.settings.allergies.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {n.settings.allergies.map((a) => (
                  <span key={a} className="flex items-center gap-1 rounded-full bg-rust/10 py-1 pl-3 pr-1.5 text-xs text-cloud">
                    {a}
                    <button
                      type="button"
                      aria-label={`Remove ${a}`}
                      onClick={() => savePref({ allergies: n.settings.allergies.filter((x) => x !== a) }, 'Allergies saved')}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-cloud-dim hover:text-cloud"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-cloud-muted">The AI coach uses these when suggesting meals. Always check labels yourself for allergens.</p>
          </div>
        </Panel>
      </Section>

      <div ref={supportRef}>
        <Section title="Support">
          <Panel className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-lime" />
              <p className="text-sm font-semibold text-cloud">Free, confidential help</p>
            </div>
            <ul className="space-y-2.5">
              {SUPPORT_LINES.map((s) => (
                <li key={`${s.region}-${s.name}`} className="rounded-xl bg-ink-bg/50 px-3.5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-cloud-dim">{s.region}</p>
                  <p className="text-sm text-cloud">{s.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    {s.phone && (
                      <a href={`tel:${s.phone.replace(/[^0-9+]/g, '')}`} className="flex items-center gap-1.5 text-xs font-semibold text-lime">
                        <Phone className="h-3.5 w-3.5" /> {s.phone}
                      </a>
                    )}
                    {s.hours && <span className="text-[11px] text-cloud-dim">{s.hours}</span>}
                    <a href={s.url} target="_blank" rel="noreferrer" className={cn('flex items-center gap-1 text-[11px] text-cloud-dim hover:text-cloud')}>
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-cloud-dim">If you feel unsafe or unwell right now, contact your local emergency number or your doctor.</p>
          </Panel>
        </Section>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}

function initialAnswers(existing: ScreeningRecord | null): Record<ScoffId, Answer> {
  return Object.fromEntries(SCOFF_QUESTIONS.map((q) => [q.id, existing ? existing.answers[q.id] ?? false : null])) as Record<ScoffId, Answer>;
}

function YesNo({ label, value, onChange }: { label: string; value: Answer; onChange: (v: boolean) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm leading-snug text-cloud">{label}</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
        {[
          { v: true, t: 'Yes' },
          { v: false, t: 'No' },
        ].map((o) => (
          <button
            key={o.t}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              'rounded-xl border py-2.5 text-sm font-medium transition-colors',
              value === o.v ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border bg-ink-bg/40 text-cloud-dim hover:text-cloud',
            )}
          >
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}
