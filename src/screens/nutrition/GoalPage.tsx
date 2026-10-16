import { useEffect, useMemo, useState } from 'react';
import { Activity, Dumbbell, Flame, Target, TrendingUp, Weight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import type { ActivityLevel } from '@/lib/types';
import { REFERENCES, type Reference } from '@/lib/nutrition/evidence';
import { TRAINING_REFERENCES } from '@/lib/training/evidence';
import { addDays, daysBetween } from '@/lib/nutrition/dates';
import { rateFeedback, weightRate, type RateStatus, type Sex } from '@/lib/nutrition/engine';
import { loadTrainingProfile, saveTrainingProfile } from '@/lib/training/api';
import { buildGoalPlan, paceRate, type BodyGoal, type Pace, type TargetIssue } from '@/lib/goal/goal-plan';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';
import { MACRO_COLORS, Notice, Page, PageHeader, Panel, Section, Segmented, Toast, fmt, inputClass } from './ui';

const GOALS: { id: BodyGoal; icon: typeof Flame; title: MessageKey; body: MessageKey }[] = [
  { id: 'cut', icon: Flame, title: 'goal.cutTitle', body: 'goal.cutBody' },
  { id: 'lose_weight', icon: Activity, title: 'goal.loseTitle', body: 'goal.loseBody' },
  { id: 'bulk', icon: TrendingUp, title: 'goal.bulkTitle', body: 'goal.bulkBody' },
  { id: 'recomp', icon: Target, title: 'goal.recompTitle', body: 'goal.recompBody' },
];

const ACTIVITIES: { id: ActivityLevel; label: MessageKey }[] = [
  { id: 'sedentary', label: 'goal.actSedentary' },
  { id: 'light', label: 'goal.actLight' },
  { id: 'moderate', label: 'goal.actModerate' },
  { id: 'active', label: 'goal.actActive' },
  { id: 'very_active', label: 'goal.actVeryActive' },
];

const STATUS_KEY: Record<RateStatus, MessageKey> = {
  on_track: 'goal.statusOnTrack',
  too_fast: 'goal.statusTooFast',
  too_slow: 'goal.statusTooSlow',
  wrong_direction: 'goal.statusWrongWay',
  stable: 'goal.statusStable',
  drifting: 'goal.statusDrifting',
};

const ISSUE_KEY: Record<TargetIssue, MessageKey> = {
  not_below: 'goal.issueNotBelow',
  not_above: 'goal.issueNotAbove',
  underweight: 'goal.issueUnderweight',
  long: 'goal.issueLong',
};

const ALL_REFS: Record<string, Reference> = { ...REFERENCES, ...TRAINING_REFERENCES };

const TRAINING_FOR_GOAL = { cut: 'fat_loss', lose_weight: 'fat_loss', bulk: 'muscle_gain', recomp: 'muscle_gain' } as const;

function numOrNull(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
}

/** Cut, bulk, lose weight or recomp: the nutrition and training engines set up together from one goal. */
export function GoalPage() {
  const n = useNutrition();
  const { go, goPath } = useNutritionNav();
  const { updateProfile, refreshProfile } = useAuth();
  const { t, lang, dir } = useI18n();
  const { settings, safety, today, stats, profile } = n;

  const planRunning = n.planConfirmed && settings.goal_mode !== 'maintain';
  const [goal, setGoal] = useState<BodyGoal | null>(null);
  const [pace, setPace] = useState<Pace>('standard');
  const [weight, setWeight] = useState(String(n.latestTrendKg ?? profile?.weight_kg ?? ''));
  const [height, setHeight] = useState(String(profile?.height_cm ?? ''));
  const [age, setAge] = useState(String(profile?.age ?? ''));
  const [sex, setSex] = useState<Sex | null>(settings.sex);
  const [activity, setActivity] = useState<ActivityLevel | null>(profile?.activity_level ?? null);
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [startedNow, setStartedNow] = useState(false);

  useEffect(() => {
    if (sex == null && settings.sex) setSex(settings.sex);
  }, [settings.sex, sex]);

  const weightKg = numOrNull(weight);
  const heightCm = numOrNull(height);
  const ageYears = numOrNull(age);
  const detailsReady = weightKg != null && weightKg >= 30 && weightKg <= 300 && heightCm != null && heightCm >= 120 && heightCm <= 230
    && ageYears != null && ageYears >= 13 && ageYears <= 100 && activity != null && sex != null;

  const disabled = (g: BodyGoal) => (safety.noWeightGoals && g !== 'recomp') || (safety.noDeficit && (g === 'cut' || g === 'lose_weight'));

  const plan = useMemo(() => {
    if (!goal || !detailsReady || disabled(goal)) return null;
    return buildGoalPlan({
      goal,
      pace,
      stats: { ...stats, weightKg: weightKg!, heightCm: heightCm!, age: Math.round(ageYears!), sex: sex!, activity: activity! },
      targetKg: numOrNull(target),
      current: { ...n.planSettings, adaptiveTdee: null },
      trainingDaysPerWeek: n.trainingDaysPerWeek,
      today,
      noDeficit: safety.noDeficit,
      noWeightGoals: safety.noWeightGoals,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, pace, detailsReady, weightKg, heightCm, ageYears, sex, activity, target, stats, n.planSettings, n.trainingDaysPerWeek, today, safety]);

  const formatDate = (key: string) => {
    try {
      return new Date(`${key}T12:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return key;
    }
  };

  const start = async () => {
    if (!plan || !goal || !plan.target.ok) return;
    setSaving(true);
    setError(null);
    try {
      const profileUpdate = {
        weight_kg: weightKg,
        height_cm: heightCm,
        age: Math.round(ageYears!),
        activity_level: activity,
        fitness_goal: TRAINING_FOR_GOAL[goal],
      };
      const res = await updateProfile(profileUpdate);
      if (res.error) throw new Error(res.error);
      if (weightKg != null && (n.latestTrendKg == null || Math.abs(weightKg - n.latestTrendKg) >= 0.1)) {
        await n.addWeight(weightKg, today);
      }
      await n.saveSettings({
        goal_mode: plan.settings.mode,
        rate_pct: plan.settings.ratePct,
        sex,
        kcal_override: null,
        protein_g_per_kg: null,
        // A new goal starts a fresh maintenance estimate from the formula; the weekly check-in refines it.
        adaptive_tdee: null,
        adaptive_updated_at: null,
        diet_break_until: null,
        mode_started_at: today,
      });
      // The training coach reads these answers, so its plan follows the same goal.
      const saved = await loadTrainingProfile().catch(() => null);
      if (saved?.available) {
        await saveTrainingProfile({ ...saved.draft, goal: plan.mapping.trainingGoal, nutritionMode: plan.settings.mode, weightKg, heightCm }, saved.screening);
      }
      await refreshProfile();
      setStartedNow(true);
      setToast(t('goal.started'));
    } catch {
      setError(t('goal.saveError'));
    } finally {
      setSaving(false);
    }
  };

  // Progress of the plan that is already running.
  const progress = useMemo(() => {
    if (!planRunning || !settings.mode_started_at) return null;
    const week = Math.max(1, Math.floor(daysBetween(settings.mode_started_at, today) / 7) + 1);
    const rate = weightRate(n.weights.map((w) => ({ date: w.date, kg: w.kg })), today, 21);
    const feedback = rate ? rateFeedback(settings.goal_mode, settings.rate_pct, rate.pctPerWeek) : null;
    return { week, rate, feedback };
  }, [planRunning, settings.mode_started_at, settings.goal_mode, settings.rate_pct, n.weights, today]);

  const expectedKg = plan ? Math.abs(plan.weeklyChangeKg) : 0;
  const paceOptions: { value: Pace; label: string }[] = [
    { value: 'gentle', label: t('goal.paceGentle') },
    { value: 'standard', label: t('goal.paceStandard') },
    { value: 'faster', label: t('goal.paceFaster') },
  ];

  return (
    <Page>
      <div dir={dir}>
        <PageHeader title={t('goal.title')} subtitle={t('goal.subtitle')} onBack={() => go('hub')} />

        {progress && (
          <Panel className="mb-4 p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-lime">{t('goal.progressTitle')}</div>
            <div className="text-sm font-semibold text-cloud">{t('goal.progressWeek', { week: progress.week })}</div>
            {progress.rate && progress.feedback ? (
              <>
                <div className="mt-1 text-xs text-cloud-dim">
                  {t('goal.progressRate', { pct: progress.rate.pctPerWeek.toFixed(2), target: settings.rate_pct.toFixed(2) })}
                </div>
                <div className={cn('mt-2 text-sm font-medium', progress.feedback.status === 'on_track' || progress.feedback.status === 'stable' ? 'text-lime' : 'text-amber-300')}>
                  {t(STATUS_KEY[progress.feedback.status])}
                </div>
              </>
            ) : (
              <div className="mt-1 text-xs text-cloud-dim">{t('goal.progressNeedData')}</div>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => go('weight')} className="rounded-lg bg-ink-elevated px-3 py-2 text-xs font-semibold text-cloud">
                <Weight className="me-1 inline h-3.5 w-3.5" />
                {t('goal.logWeight')}
              </button>
              <button type="button" onClick={() => go('plan')} className="rounded-lg bg-ink-elevated px-3 py-2 text-xs font-semibold text-cloud">
                {t('goal.openPlan')}
              </button>
            </div>
          </Panel>
        )}

        {safety.noWeightGoals && <Notice tone="warn">{t('goal.blockedWeightGoals')}</Notice>}
        {!safety.noWeightGoals && safety.noDeficit && <Notice tone="warn">{t('goal.blockedDeficit')}</Notice>}

        <Section title={t('goal.qGoal')} className="mt-2">
          <div className="grid grid-cols-2 gap-2.5" data-testid="goal-options">
            {GOALS.map((g) => {
              const Icon = g.icon;
              const off = disabled(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={off}
                  data-testid={`goal-${g.id}`}
                  onClick={() => { setGoal(g.id); setStartedNow(false); }}
                  className={cn(
                    'rounded-2xl border p-3.5 text-start transition-colors',
                    goal === g.id ? 'border-lime bg-lime/10' : 'border-ink-border bg-ink-surface hover:border-lime/40',
                    off && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <Icon className={cn('mb-2 h-5 w-5', goal === g.id ? 'text-lime' : 'text-cloud-dim')} />
                  <div className="text-sm font-semibold text-cloud">{t(g.title)}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-cloud-dim">{t(g.body)}</div>
                </button>
              );
            })}
          </div>
        </Section>

        {goal && (
          <Section title={t('goal.qDetails')} className="mt-5">
            <Panel className="space-y-3 p-4">
              <p className="text-[11px] text-cloud-dim">{t('goal.detailsNote')}</p>
              <div className="grid grid-cols-3 gap-2">
                <NumberField label={t('goal.weight')} value={weight} onChange={setWeight} testId="goal-weight" />
                <NumberField label={t('goal.height')} value={height} onChange={setHeight} testId="goal-height" />
                <NumberField label={t('goal.age')} value={age} onChange={setAge} testId="goal-age" />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-medium text-cloud-dim">{t('goal.sex')}</div>
                <Segmented<Sex>
                  options={[
                    { value: 'male', label: t('goal.sexMale') },
                    { value: 'female', label: t('goal.sexFemale') },
                    { value: 'unspecified', label: t('goal.sexNone') },
                  ]}
                  value={sex ?? ('' as Sex)}
                  onChange={setSex}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-medium text-cloud-dim">{t('goal.activity')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {ACTIVITIES.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setActivity(a.id)}
                      className={cn('rounded-full border px-3 py-1.5 text-xs', activity === a.id ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')}
                    >
                      {t(a.label)}
                    </button>
                  ))}
                </div>
              </div>
              {goal !== 'recomp' && (
                <NumberField label={t('goal.target')} value={target} onChange={setTarget} testId="goal-target" />
              )}
            </Panel>
          </Section>
        )}

        {goal && goal !== 'recomp' && detailsReady && (
          <Section title={t('goal.qPace')} className="mt-5">
            <Segmented<Pace> options={paceOptions} value={pace} onChange={setPace} />
            <p className="mt-2 text-xs text-cloud-dim">
              {t('goal.paceLine', {
                pct: paceRate(goal, pace, stats.experience).toFixed(2),
                kg: ((weightKg! * paceRate(goal, pace, stats.experience)) / 100).toFixed(2),
              })}
            </p>
            <p className="mt-1 text-[11px] text-cloud-muted">{t(goal === 'bulk' ? 'goal.paceBulkNote' : 'goal.paceCutNote')}</p>
          </Section>
        )}

        {goal && !detailsReady && <p className="mt-4 text-xs text-cloud-dim">{t('goal.needDetails')}</p>}

        {plan && (
          <Section title={t('goal.result')} className="mt-6">
            <div className="space-y-3" data-testid="goal-result">
              <Panel className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label={t('goal.kcalTraining')} value={`${fmt(plan.trainingDay.kcal)} ${t('goal.kcal')}`} />
                  <Stat label={t('goal.kcalRest')} value={`${fmt(plan.restDay.kcal)} ${t('goal.kcal')}`} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Macro label={t('goal.protein')} grams={plan.trainingDay.protein} color={MACRO_COLORS.protein} />
                  <Macro label={t('goal.carbs')} grams={plan.trainingDay.carbs} color={MACRO_COLORS.carbs} />
                  <Macro label={t('goal.fat')} grams={plan.trainingDay.fat} color={MACRO_COLORS.fat} />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-cloud-dim">{t('goal.maintenance', { kcal: fmt(plan.trainingDay.maintenance) })}</p>
              </Panel>

              <Panel className="p-4">
                <div className="text-sm font-semibold text-cloud">
                  {plan.weeklyChangeKg < 0
                    ? t('goal.expectLoss', { kg: expectedKg.toFixed(2) })
                    : plan.weeklyChangeKg > 0
                      ? t('goal.expectGain', { kg: expectedKg.toFixed(2) })
                      : t('goal.expectSame')}
                </div>
                {plan.weeks != null && plan.target.ok && (
                  <div className="mt-1 text-xs text-lime">{t('goal.weeksTo', { weeks: plan.weeks, date: formatDate(addDays(today, plan.weeks * 7)) })}</div>
                )}
                {plan.timeline.length > 1 && plan.ratePct > 0 && <Timeline points={plan.timeline} />}
                {plan.target.issue && (
                  <Notice tone={plan.target.ok ? 'info' : 'warn'}>
                    {t(ISSUE_KEY[plan.target.issue], { bmi: plan.target.bmi ?? '', weeks: plan.weeks ?? '' })}
                  </Notice>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-cloud-muted">{t('goal.timelineNote')}</p>
              </Panel>

              {plan.trainingDay.notes.length > 0 && (
                <Panel className="p-4">
                  <div className="mb-1 text-[11px] font-medium text-cloud-dim">{t('goal.calcNotes')}</div>
                  <ul className="space-y-1 text-xs text-cloud" dir="ltr">
                    {plan.trainingDay.notes.map((note) => <li key={note.text}>• {note.text}</li>)}
                  </ul>
                </Panel>
              )}

              <Panel className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cloud">
                  <Dumbbell className="h-4 w-4 text-lime" /> {t('goal.trainingTitle')}
                </div>
                <ul className="space-y-1.5 text-xs leading-relaxed text-cloud-dim">
                  <li>• {t('goal.trainLift')}</li>
                  {plan.mapping.nutritionMode === 'cut' && <li>• {t('goal.trainKeepHeavy')}</li>}
                  {goal === 'lose_weight' && <li>• {t('goal.trainCardio')}</li>}
                  <li>• {t('goal.trainProgress')}</li>
                </ul>
              </Panel>

              <Panel className="p-4">
                <div className="mb-2 text-sm font-semibold text-cloud">{t('goal.checkTitle')}</div>
                <ol className="list-decimal space-y-1.5 ps-4 text-xs leading-relaxed text-cloud-dim">
                  <li>{t('goal.check1')}</li>
                  <li>{t('goal.check2')}</li>
                  <li>{t('goal.check3')}</li>
                </ol>
              </Panel>

              <div>
                <div className="mb-1.5 text-[11px] font-medium text-cloud-dim">{t('goal.sources')}</div>
                <div className="flex flex-wrap gap-1.5" dir="ltr">
                  {plan.refs.map((id) => ALL_REFS[id]).filter(Boolean).map((r) => (
                    <a key={r.id} href={r.url} target="_blank" rel="noreferrer" title={r.citation} className="rounded-md bg-ink-elevated px-2 py-0.5 text-[10px] text-cloud-dim hover:text-lime">
                      {r.short}
                    </a>
                  ))}
                </div>
              </div>

              {error && <Notice tone="warn">{error}</Notice>}

              {startedNow ? (
                <div className="space-y-2">
                  <Notice tone="success">{t('goal.started')}</Notice>
                  <button type="button" onClick={() => goPath('/training/coach')} className="w-full rounded-2xl bg-lime py-3.5 text-sm font-bold text-ink-bg" data-testid="goal-build-training">
                    {t('goal.buildTraining')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={saving || !plan.target.ok || !n.settingsAvailable}
                  onClick={start}
                  data-testid="goal-start"
                  className="w-full rounded-2xl bg-lime py-3.5 text-sm font-bold text-ink-bg disabled:opacity-50"
                >
                  {t('goal.start')}
                </button>
              )}
            </div>
          </Section>
        )}
        <Toast message={toast} onDone={() => setToast(null)} />
      </div>
    </Page>
  );
}

function NumberField({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-cloud-dim">{label}</span>
      <input value={value} inputMode="decimal" dir="ltr" onChange={(e) => onChange(e.target.value)} className={cn(inputClass, 'py-2.5')} data-testid={testId} />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-elevated p-3">
      <div className="text-[11px] text-cloud-dim">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums text-cloud" dir="ltr">{value}</div>
    </div>
  );
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <div className="rounded-xl bg-ink-elevated p-2">
      <div className="text-base font-bold tabular-nums" style={{ color }} dir="ltr">{fmt(grams)} g</div>
      <div className="text-[10px] text-cloud-dim">{label}</div>
    </div>
  );
}

/** A small line of the expected weight, week by week. */
function Timeline({ points }: { points: { week: number; kg: number }[] }) {
  const w = 300;
  const h = 70;
  const min = Math.min(...points.map((p) => p.kg));
  const max = Math.max(...points.map((p) => p.kg));
  const span = Math.max(max - min, 0.5);
  const x = (i: number) => 6 + (i / (points.length - 1)) * (w - 12);
  const y = (kg: number) => 8 + (1 - (kg - min) / span) * (h - 22);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <div className="mt-3" dir="ltr">
      <svg viewBox={`0 0 ${w} ${h - 14}`} className="w-full" role="img" aria-label={`${points[0].kg} kg → ${last.kg} kg`}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-lime" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-cloud-dim">
        <span>{points[0].kg} kg</span>
        <span>{last.kg} kg</span>
      </div>
    </div>
  );
}

/** Entry card for the goal plan (Home and the Nutrition hub). */
export function GoalEntryCard({ onOpen }: { onOpen: () => void }) {
  const { t, dir } = useI18n();
  return (
    <button
      type="button"
      dir={dir}
      onClick={onOpen}
      data-testid="goal-entry"
      className="flex w-full items-center gap-3 rounded-2xl border border-lime/30 bg-lime/5 p-4 text-start transition-colors hover:border-lime/60"
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-lime/15 text-lime">
        <Flame className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-cloud">{t('goal.title')}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-cloud-dim">{t('goal.entryBody')}</div>
      </div>
    </button>
  );
}
