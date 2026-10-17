import { useEffect, useState } from 'react';
import { ClipboardList, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { loadIntake, myCoachIntakeQuestions, submitIntake } from '@/lib/coach/api';
import { SYMPTOMS, screeningOutcome, type CoachIntake } from '@/lib/coach/screening';
import type { IntakeOutcome } from '@/lib/coach/insights';
import { Sheet } from './ui';

const field = 'w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-2.5 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none';

const RESULT_TONE: Record<IntakeOutcome, string> = {
  no_clearance: 'border-lime/30 bg-lime/[0.06] text-lime',
  clearance_before_vigorous: 'border-gold/40 bg-gold/[0.08] text-gold',
  clearance: 'border-gold/40 bg-gold/[0.08] text-gold',
  stop_and_clearance: 'border-rust/40 bg-rust/[0.08] text-rust',
};

/** On "My coach": asks a new athlete for their intake, or shows the result and lets them update it. */
export function IntakePrompt({ coachId, me, coachName }: { coachId: string; me: string; coachName: string }) {
  const { t, dir } = useI18n();
  const [intake, setIntake] = useState<CoachIntake | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const reload = () => loadIntake(coachId, me).then(setIntake).catch(() => setIntake(null));
  useEffect(() => { reload(); }, [coachId, me]); // eslint-disable-line react-hooks/exhaustive-deps
  if (intake === undefined) return null;

  return (
    <>
      {intake ? (
        <div className={cn('rounded-2xl border p-4', RESULT_TONE[intake.outcome])} data-testid="intake-result" dir={dir}>
          <div className="flex items-start gap-3">
            <Stethoscope className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{t(`myintake.out_${intake.outcome}` as MessageKey)}</div>
              {intake.pregnant && <p className="mt-1 text-xs text-cloud">{t('myintake.pregnantNote')}</p>}
              <p className="mt-1 text-[11px] text-cloud-dim">{t('myintake.source')}</p>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs font-semibold text-cloud underline-offset-2 hover:underline" data-testid="intake-edit">{t('myintake.edit')}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-sky/40 bg-sky/[0.06] p-4 text-start" data-testid="intake-prompt" dir={dir}>
          <ClipboardList className="h-6 w-6 flex-shrink-0 text-sky" />
          <span><span className="block text-sm font-semibold text-cloud">{t('myintake.cardTitle')}</span><span className="block text-xs text-cloud-dim">{t('myintake.cardBody', { name: coachName })}</span></span>
        </button>
      )}
      <Sheet open={open} title={t('myintake.title')} onClose={() => setOpen(false)}>
        <IntakeForm coachId={coachId} me={me} coachName={coachName} existing={intake} onSaved={() => { setOpen(false); reload(); }} />
      </Sheet>
    </>
  );
}

function YesNo({ value, onChange, testId }: { value: boolean | null; onChange: (v: boolean) => void; testId: string }) {
  const { t } = useI18n();
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {([true, false] as const).map((v) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)} aria-pressed={value === v} data-testid={`${testId}-${v ? 'yes' : 'no'}`}
          className={cn('rounded-xl border py-2.5 text-sm font-semibold', value === v ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')}>
          {v ? t('common.yes') : t('common.no')}
        </button>
      ))}
    </div>
  );
}

function IntakeForm({ coachId, me, coachName, existing, onSaved }: { coachId: string; me: string; coachName: string; existing: CoachIntake | null; onSaved: () => void }) {
  const { t, dir } = useI18n();
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries((existing?.answers ?? []).map((a) => [a.q, a.a])));
  const [goal, setGoal] = useState(existing?.goal ?? '');
  const [days, setDays] = useState(existing?.days_per_week != null ? String(existing.days_per_week) : '');
  const [minutes, setMinutes] = useState(existing?.minutes_per_session != null ? String(existing.minutes_per_session) : '');
  const [equipment, setEquipment] = useState(existing?.equipment ?? '');
  const [injuries, setInjuries] = useState(existing?.injuries ?? '');
  const [regular, setRegular] = useState<boolean | null>(existing ? existing.exercises_regularly : null);
  const [disease, setDisease] = useState<boolean | null>(existing ? existing.known_disease : null);
  const [symptoms, setSymptoms] = useState<string[]>(existing?.symptoms ?? []);
  const [noSymptoms, setNoSymptoms] = useState<boolean>(!!existing && existing.symptoms.length === 0);
  const [pregnant, setPregnant] = useState(existing?.pregnant ?? false);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { myCoachIntakeQuestions().then(setQuestions).catch(() => setQuestions([])); }, []);

  const toggle = (s: string) => {
    setNoSymptoms(false);
    setSymptoms((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  };

  const ready = regular != null && disease != null && (symptoms.length > 0 || noSymptoms) && consent;
  const preview = regular != null && disease != null && (symptoms.length > 0 || noSymptoms) ? screeningOutcome({ exercisesRegularly: regular, knownDisease: disease, symptoms }) : null;

  const save = async () => {
    setErr(null);
    if (!ready || regular == null || disease == null) { setErr(t('myintake.required')); return; }
    const d = days.trim() ? Number(days) : null;
    const m = minutes.trim() ? Number(minutes) : null;
    if (d != null && (!Number.isInteger(d) || d < 1 || d > 7)) { setErr(t('myintake.daysRange')); return; }
    if (m != null && (!Number.isInteger(m) || m < 10 || m > 240)) { setErr(t('myintake.minutesRange')); return; }
    setBusy(true);
    try {
      await submitIntake(coachId, me, {
        answers: questions.slice(0, 10).map((q) => ({ q, a: (answers[q] ?? '').trim().slice(0, 1000) })),
        goal: goal.trim().slice(0, 500) || null,
        days_per_week: d, minutes_per_session: m,
        equipment: equipment.trim().slice(0, 500) || null,
        injuries: injuries.trim().slice(0, 1000) || null,
        exercises_regularly: regular, known_disease: disease, symptoms, pregnant,
      });
      onSaved();
    } catch {
      setErr(t('coach.saveError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" dir={dir} data-testid="intake-form">
      <section className="space-y-3">
        <label className="block"><span className="mb-1 block text-[11px] text-cloud-dim">{t('myintake.goal')}</span>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} maxLength={500} className={field} dir="auto" data-testid="intake-goal" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.intakeDays')}</span><input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, '').slice(0, 1))} inputMode="numeric" className={field} dir="ltr" placeholder="1–7" /></label>
          <label><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.intakeMinutes')}</span><input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" className={field} dir="ltr" placeholder="10–240" /></label>
        </div>
        <label className="block"><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.intakeEquipment')}</span>
          <input value={equipment} onChange={(e) => setEquipment(e.target.value)} maxLength={500} className={field} dir="auto" placeholder={t('myintake.equipmentPh')} /></label>
        <label className="block"><span className="mb-1 block text-[11px] text-cloud-dim">{t('coach.intakeInjuries')}</span>
          <textarea value={injuries} onChange={(e) => setInjuries(e.target.value)} rows={2} maxLength={1000} className={field} dir="auto" placeholder={t('myintake.injuriesPh')} /></label>
        {questions.map((q) => (
          <label key={q} className="block" data-testid="intake-custom"><span className="mb-1 block text-[11px] text-cloud-dim" dir="auto">{q}</span>
            <textarea value={answers[q] ?? ''} onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })} rows={2} maxLength={1000} className={field} dir="auto" /></label>
        ))}
      </section>

      <section className="rounded-2xl border border-ink-border bg-ink-bg/60 p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-bold text-cloud"><Stethoscope className="h-4 w-4 text-sky" />{t('myintake.healthTitle')}</div>
        <p className="mb-3 text-[11px] text-cloud-muted">{t('myintake.healthHelp')}</p>
        <div className="mb-4"><div className="text-sm text-cloud">{t('myintake.qRegular')}</div><YesNo value={regular} onChange={setRegular} testId="intake-regular" /></div>
        <div className="mb-4"><div className="text-sm text-cloud">{t('myintake.qDisease')}</div><YesNo value={disease} onChange={setDisease} testId="intake-disease" /></div>
        <div className="text-sm text-cloud">{t('myintake.qSymptoms')}</div>
        <ul className="mt-2 space-y-1.5">
          {SYMPTOMS.map((s) => (
            <li key={s}>
              <button type="button" role="checkbox" aria-checked={symptoms.includes(s)} onClick={() => toggle(s)} data-testid={`symptom-${s}`}
                className={cn('flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-start text-xs', symptoms.includes(s) ? 'bg-rust/10 text-cloud' : 'bg-ink-elevated/60 text-cloud-dim')}>
                <span className={cn('mt-0.5 h-4 w-4 flex-shrink-0 rounded border', symptoms.includes(s) ? 'border-rust bg-rust' : 'border-ink-border')} />
                {t(`symptom.${s}` as MessageKey)}
              </button>
            </li>
          ))}
          <li>
            <button type="button" role="checkbox" aria-checked={noSymptoms} onClick={() => { setNoSymptoms(!noSymptoms); if (!noSymptoms) setSymptoms([]); }} data-testid="symptom-none"
              className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs font-semibold', noSymptoms ? 'bg-lime/10 text-cloud' : 'bg-ink-elevated/60 text-cloud-dim')}>
              <span className={cn('h-4 w-4 flex-shrink-0 rounded border', noSymptoms ? 'border-lime bg-lime' : 'border-ink-border')} />
              {t('myintake.noneOfThese')}
            </button>
          </li>
        </ul>
        <button type="button" role="checkbox" aria-checked={pregnant} onClick={() => setPregnant(!pregnant)} className="mt-3 flex items-center gap-2.5 text-xs text-cloud-dim" data-testid="intake-pregnant">
          <span className={cn('h-4 w-4 rounded border', pregnant ? 'border-lime bg-lime' : 'border-ink-border')} />{t('myintake.pregnant')}
        </button>
        {preview && (
          <p className={cn('mt-3 rounded-xl border px-3 py-2 text-xs font-semibold', RESULT_TONE[preview])} data-testid="intake-preview">{t(`myintake.out_${preview}` as MessageKey)}</p>
        )}
        {pregnant && <p className="mt-2 text-xs text-cloud">{t('myintake.pregnantNote')}</p>}
        <p className="mt-2 text-[10px] text-cloud-muted">{t('myintake.source')}</p>
      </section>

      <button type="button" role="checkbox" aria-checked={consent} onClick={() => setConsent(!consent)} className="flex items-start gap-2.5 text-start text-xs text-cloud" data-testid="intake-consent">
        <span className={cn('mt-0.5 h-4 w-4 flex-shrink-0 rounded border', consent ? 'border-lime bg-lime' : 'border-ink-border')} />{t('myintake.consent', { name: coachName })}
      </button>
      {err && <p className="rounded-xl bg-rust/10 px-3 py-2 text-xs text-rust">{err}</p>}
      <button type="button" onClick={save} disabled={busy || !ready} className="w-full rounded-xl bg-lime py-3.5 text-sm font-bold text-ink-bg disabled:opacity-40" data-testid="intake-submit">{t('myintake.submit')}</button>
    </div>
  );
}
