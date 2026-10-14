import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Coffee, Info, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage, type NutritionSettings } from '@/lib/nutrition/api';
import { addDays, daysBetween, formatShortDate } from '@/lib/nutrition/dates';
import {
  computeTargets,
  defaultRate,
  estimateAdaptiveTdee,
  FAT_PCT_RANGE,
  GOAL_LABELS,
  PROTEIN_RANGES,
  RATE_RANGES,
  rateFeedback,
  stepTowards,
  weightRate,
  type GoalMode,
  type PlanSettings,
  type Sex,
} from '@/lib/nutrition/engine';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';
import { Chip, Citations, MACRO_COLORS, Notice, Page, PageHeader, Panel, Section, Segmented, SetupRequired, Toast, Toggle, fmt } from './ui';

const GOAL_HELP: Record<GoalMode, string> = {
  cut: 'Lose fat while keeping muscle: a moderate deficit and high protein.',
  maintain: 'Keep your weight stable and fuel training.',
  bulk: 'Build muscle with a small surplus to limit fat gain.',
  recomp: 'Stay at maintenance with high protein — useful when newer to training or returning.',
};

type Draft = Pick<NutritionSettings, 'goal_mode' | 'rate_pct' | 'sex' | 'protein_g_per_kg' | 'fat_pct' | 'meals_per_day' | 'carb_shift' | 'kcal_override'>;

export function PlanPage() {
  const n = useNutrition();
  const { go, goPath } = useNutritionNav();
  const { settings, today, stats, safety } = n;
  const [draft, setDraft] = useState<Draft>(() => pickDraft(settings, n.profile, n.planConfirmed, stats.experience));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [customKcal, setCustomKcal] = useState(settings.kcal_override != null);

  useEffect(() => {
    setDraft(pickDraft(settings, n.profile, n.planConfirmed, stats.experience));
    setCustomKcal(settings.kcal_override != null);
  }, [settings, n.profile, n.planConfirmed, stats.experience]);

  // Data for the adaptive check-in (last 3 weeks).
  const { loadRange, days } = n;
  useEffect(() => {
    loadRange(addDays(today, -21), addDays(today, -1)).catch((err) => setError(errorMessage(err)));
  }, [today, loadRange]);

  const draftPlan: PlanSettings = {
    ...n.planSettings,
    mode: draft.goal_mode,
    ratePct: draft.rate_pct,
    proteinPerKg: draft.protein_g_per_kg,
    fatPct: draft.fat_pct,
    mealsPerDay: draft.meals_per_day,
    carbShift: draft.carb_shift,
    kcalOverride: customKcal ? draft.kcal_override : null,
  };
  const ctx = {
    today,
    date: today,
    trainingDay: n.isTrainingDay(today),
    trainingDaysPerWeek: n.trainingDaysPerWeek,
    noDeficit: safety.noDeficit,
    noWeightGoals: safety.noWeightGoals,
  };
  const preview = computeTargets({ ...stats, sex: draft.sex ?? 'unspecified' }, draftPlan, ctx);
  const saved = n.targetsFor(today);

  const dirty = JSON.stringify(normalizeDraft(draft, customKcal)) !== JSON.stringify(normalizeDraft(pickDraft(settings, null, true, stats.experience), settings.kcal_override != null)) || !n.planConfirmed;

  const adaptive = useMemo(() => {
    const intakeByDate: Record<string, number> = {};
    for (let i = 1; i <= 21; i++) {
      const key = addDays(today, -i);
      const d = days[key];
      if (d && d.entries.length) intakeByDate[key] = d.entries.reduce((s, e) => s + e.kcal, 0);
    }
    return estimateAdaptiveTdee({
      intakeByDate,
      weighIns: n.weights.map((w) => ({ date: w.date, kg: w.kg })),
      today,
      bmr: saved.bmr,
      currentTarget: saved.kcal,
    });
  }, [days, n.weights, today, saved.bmr, saved.kcal]);

  const rate = weightRate(n.weights.map((w) => ({ date: w.date, kg: w.kg })), today, 21);
  const feedback = rate ? rateFeedback(saved.mode, settings.rate_pct, rate.pctPerWeek) : null;

  const lastAdaptive = settings.adaptive_updated_at ? settings.adaptive_updated_at.slice(0, 10) : null;
  const daysSinceAdaptive = lastAdaptive ? daysBetween(lastAdaptive, today) : null;
  const adaptiveLocked = daysSinceAdaptive != null && daysSinceAdaptive < 7;

  const save = async (extra: Partial<NutritionSettings> = {}, message = 'Plan saved') => {
    setSaving(true);
    setError(null);
    try {
      const modeChanged = draft.goal_mode !== settings.goal_mode || !n.planConfirmed;
      await n.saveSettings({
        ...draft,
        kcal_override: customKcal ? draft.kcal_override : null,
        mode_started_at: modeChanged ? today : settings.mode_started_at,
        diet_break_until: draft.goal_mode === 'cut' ? settings.diet_break_until : null,
        ...extra,
      });
      setToast(message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const applyAdaptive = async () => {
    if (!adaptive.ok) return;
    const next = stepTowards(saved.maintenance, adaptive.tdee);
    await save({ adaptive_tdee: next, adaptive_updated_at: new Date().toISOString() }, `Maintenance updated to ${fmt(next)} kcal`);
  };

  const weeksInCut = settings.goal_mode === 'cut' && settings.mode_started_at ? Math.floor(daysBetween(settings.mode_started_at, today) / 7) : 0;
  const onBreak = !!settings.diet_break_until && settings.diet_break_until >= today;

  if (!n.settingsAvailable) {
    return (
      <Page>
        <PageHeader title="Plan & targets" onBack={() => go('hub')} />
        <SetupRequired feature="Saving your plan" />
      </Page>
    );
  }

  const modeOptions: { value: GoalMode; label: string; disabled: boolean }[] = (['cut', 'maintain', 'bulk', 'recomp'] as GoalMode[]).map((m) => ({
    value: m,
    label: GOAL_LABELS[m],
    disabled: (safety.noWeightGoals && m !== 'maintain') || (safety.noDeficit && m === 'cut'),
  }));
  const rateRange = RATE_RANGES[draft.goal_mode];
  const proteinRange = PROTEIN_RANGES[draft.goal_mode];
  const weeklyKg = (stats.weightKg * draft.rate_pct) / 100;

  return (
    <Page>
      <PageHeader title="Plan & targets" subtitle="Evidence-based, adjusted to your data" onBack={() => go('hub')} />

      <div className="space-y-3">
        {safety.reasons.map((r) => (
          <Notice key={r} tone={safety.noWeightGoals ? 'danger' : 'warn'}>
            {r}
          </Notice>
        ))}
        {n.statsMissing.length > 0 && (
          <Notice
            tone="info"
            title="Add your details for accurate targets"
            action={
              <button type="button" onClick={() => goPath('/edit-profile')} className="text-xs font-semibold text-lime">
                Edit profile →
              </button>
            }
          >
            Missing: {n.statsMissing.join(', ')}. Until then, typical values are used.
          </Notice>
        )}
        {error && <Notice tone="warn">{error}</Notice>}
      </div>

      {n.noNumbers ? (
        <Panel className="mt-4 p-5">
          <p className="text-sm font-semibold text-cloud">Balanced eating mode</p>
          <p className="mt-1 text-xs leading-relaxed text-cloud-dim">
            Numbers are hidden. Aim for regular meals, each with a protein source, some carbohydrate, vegetables or fruit, and a little fat. Drink regularly through
            the day.
          </p>
          <button type="button" onClick={() => go('check-in')} className="mt-3 text-xs font-semibold text-lime">
            Change in Check-in & settings →
          </button>
        </Panel>
      ) : (
        <Panel className="mt-4 overflow-hidden">
          <div className="bg-gradient-to-br from-lime/10 to-transparent p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-lime">{dirty ? 'Preview' : 'Today'} · {GOAL_LABELS[preview.mode]}</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-cloud">
              {fmt(preview.kcal)} <span className="text-base font-medium text-cloud-dim">kcal</span>
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <TargetTile label="Protein" value={preview.protein} color={MACRO_COLORS.protein} />
              <TargetTile label="Carbs" value={preview.carbs} color={MACRO_COLORS.carbs} />
              <TargetTile label="Fat" value={preview.fat} color={MACRO_COLORS.fat} />
            </div>
          </div>
          <div className="space-y-2.5 border-t border-ink-border/60 p-5 text-xs">
            <Line label="Resting energy (Mifflin–St Jeor)" value={`${fmt(preview.bmr)} kcal`} />
            <Line label={`Maintenance (${preview.maintenanceSource === 'adaptive' ? 'from your data' : 'formula × activity'})`} value={`${fmt(preview.maintenance)} kcal`} />
            <Line
              label="Goal adjustment"
              value={`${preview.dailyDelta > 0 ? '+' : ''}${fmt(preview.dailyDelta)} kcal/day${preview.carbShiftKcal ? ` (incl. ${preview.carbShiftKcal > 0 ? '+' : ''}${preview.carbShiftKcal} carb shift)` : ''}`}
            />
            <Line label="Expected change" value={`${preview.expectedWeeklyChangeKg > 0 ? '+' : ''}${preview.expectedWeeklyChangeKg.toFixed(2)} kg/week`} />
            <Line label="Protein" value={`${preview.proteinPerKg.toFixed(1)} g/kg × ${preview.proteinRefWeightKg} kg`} />
            <Line label="Protein per meal" value={`~${preview.proteinPerMeal.target} g (${preview.proteinPerMeal.low}–${preview.proteinPerMeal.high} g range)`} />
            <Line label="Fibre · Water" value={`${preview.fiber} g · ${(preview.waterMl / 1000).toFixed(1)} L`} />
            <Line label="Safety floor" value={`${fmt(preview.floorKcal)} kcal`} />
            {preview.notes.map((note) => (
              <div key={note.text} className={cn('flex gap-2 rounded-lg p-2.5 text-[11px] leading-relaxed', note.kind === 'warning' ? 'bg-gold/10 text-cloud' : 'bg-ink-elevated text-cloud-dim')}>
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                {note.text}
              </div>
            ))}
            <Citations ids={['mifflin1990', 'ruiz2021', 'iraki2019', 'morton2018', 'schoenfeld2018', 'iom2005']} className="pt-1" />
          </div>
        </Panel>
      )}

      <Section title="Your goal" className="mt-6">
        <Panel className="space-y-5 p-4">
          <div className="grid grid-cols-2 gap-2">
            {modeOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                aria-pressed={draft.goal_mode === o.value}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    goal_mode: o.value,
                    rate_pct: o.value === 'cut' || o.value === 'bulk' ? (d.goal_mode === o.value ? d.rate_pct : defaultRate(o.value, stats.experience)) : 0,
                    protein_g_per_kg: null,
                  }))
                }
                className={cn(
                  'rounded-xl border px-3 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-35',
                  draft.goal_mode === o.value ? 'border-lime bg-lime/10' : 'border-ink-border bg-ink-bg/40 hover:border-lime/30',
                )}
              >
                <p className="text-sm font-semibold text-cloud">{o.label}</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-cloud-dim">{GOAL_HELP[draft.goal_mode]}</p>

          {(draft.goal_mode === 'cut' || draft.goal_mode === 'bulk') && !n.noNumbers && (
            <RangeField
              label={draft.goal_mode === 'cut' ? 'Rate of loss' : 'Rate of gain'}
              value={draft.rate_pct}
              min={rateRange.min}
              max={rateRange.max}
              step={rateRange.step}
              display={`${draft.rate_pct.toFixed(2)}% / week ≈ ${weeklyKg.toFixed(2)} kg`}
              onChange={(v) => setDraft((d) => ({ ...d, rate_pct: v }))}
              hint={
                draft.goal_mode === 'cut'
                  ? 'Evidence-based range: 0.5–1% per week. Slower keeps more muscle when lean.'
                  : 'Novice/intermediate: 0.25–0.5% per week. Advanced lifters: slower.'
              }
            />
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-cloud">Sex (for the energy equation)</p>
            <Segmented<Sex>
              value={draft.sex ?? 'unspecified'}
              onChange={(v) => setDraft((d) => ({ ...d, sex: v }))}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'unspecified', label: 'Prefer not to say' },
              ]}
            />
          </div>
        </Panel>
      </Section>

      {!n.noNumbers && (
        <Section title="Fine-tune">
          <Panel className="space-y-5 p-4">
            <RangeField
              label="Protein"
              value={draft.protein_g_per_kg ?? proteinRange.default}
              min={proteinRange.min}
              max={proteinRange.max}
              step={0.1}
              display={`${(draft.protein_g_per_kg ?? proteinRange.default).toFixed(1)} g/kg`}
              onChange={(v) => setDraft((d) => ({ ...d, protein_g_per_kg: Math.round(v * 10) / 10 }))}
              hint={`Range for ${GOAL_LABELS[draft.goal_mode].toLowerCase()}: ${proteinRange.min}–${proteinRange.max} g/kg.`}
            />
            <RangeField
              label="Fat"
              value={draft.fat_pct ?? FAT_PCT_RANGE.default}
              min={FAT_PCT_RANGE.min}
              max={FAT_PCT_RANGE.max}
              step={1}
              display={`${draft.fat_pct ?? FAT_PCT_RANGE.default}% of calories`}
              onChange={(v) => setDraft((d) => ({ ...d, fat_pct: Math.round(v) }))}
              hint="Adults: 20–35% of energy from fat. Carbohydrate fills the remaining calories."
            />
            <div>
              <p className="mb-2 text-xs font-medium text-cloud">Meals per day</p>
              <div className="flex gap-2">
                {[3, 4, 5, 6].map((m) => (
                  <Chip key={m} active={draft.meals_per_day === m} onClick={() => setDraft((d) => ({ ...d, meals_per_day: m }))}>
                    {m}
                  </Chip>
                ))}
              </div>
            </div>
            <Toggle
              checked={draft.carb_shift}
              onChange={(v) => setDraft((d) => ({ ...d, carb_shift: v }))}
              label="More carbs on training days"
              description={`Moves carbohydrate from rest days to training days (${n.trainingDaysPerWeek} a week detected). Your weekly total stays the same.`}
            />
            <Toggle
              checked={customKcal}
              disabled={safety.noWeightGoals}
              onChange={(v) => {
                setCustomKcal(v);
                if (v && draft.kcal_override == null) setDraft((d) => ({ ...d, kcal_override: preview.kcal }));
              }}
              label="Set my own calorie target"
              description="For a plan from your dietitian or coach. The safety floor still applies."
            />
            {customKcal && (
              <input
                value={draft.kcal_override ?? ''}
                inputMode="numeric"
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/\D/g, ''));
                  setDraft((d) => ({ ...d, kcal_override: Number.isFinite(v) && v > 0 ? Math.min(6000, v) : null }));
                }}
                aria-label="Calorie target"
                className="w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-3 text-sm text-cloud focus:border-lime/50 focus:outline-none"
              />
            )}
          </Panel>
        </Section>
      )}

      <button
        type="button"
        onClick={() => save()}
        disabled={saving || !dirty || (customKcal && (draft.kcal_override ?? 0) < 1000)}
        className="sticky bottom-4 z-10 mb-6 h-12 w-full rounded-xl bg-lime text-sm font-bold text-ink-bg shadow-lime disabled:opacity-40"
      >
        {saving ? 'Saving…' : dirty ? (n.planConfirmed ? 'Save plan' : 'Save and start') : 'Saved'}
      </button>

      {!n.noNumbers && n.planConfirmed && (
        <Section title="Adaptive check-in">
          <Panel className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ink-elevated text-lime">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cloud">Your real maintenance</p>
                {adaptive.ok ? (
                  <>
                    <p className="mt-1 text-xs leading-relaxed text-cloud-dim">
                      Over the last {adaptive.windowDays} days you averaged <b className="text-cloud">{fmt(adaptive.avgIntake)} kcal</b> and your weight trend moved{' '}
                      <b className="text-cloud">
                        {adaptive.kgPerWeek > 0 ? '+' : ''}
                        {adaptive.kgPerWeek.toFixed(2)} kg/week
                      </b>
                      . That puts your maintenance at about <b className="text-cloud">{fmt(adaptive.tdee)} kcal</b> ({adaptive.confidence} confidence, {adaptive.loggedDays} logged days,{' '}
                      {adaptive.weighInCount} weigh-ins).
                    </p>
                    <p className="mt-1 text-[11px] text-cloud-muted">
                      Current maintenance: {fmt(saved.maintenance)} kcal. Changes are applied at most 250 kcal at a time.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={applyAdaptive}
                        disabled={saving || adaptiveLocked || Math.abs(adaptive.tdee - saved.maintenance) < 30}
                        className="rounded-xl bg-lime px-4 py-2.5 text-xs font-bold text-ink-bg disabled:opacity-40"
                      >
                        {Math.abs(adaptive.tdee - saved.maintenance) < 30 ? 'Already up to date' : `Update to ${fmt(stepTowards(saved.maintenance, adaptive.tdee))} kcal`}
                      </button>
                      {settings.adaptive_tdee != null && (
                        <button type="button" onClick={() => save({ adaptive_tdee: null, adaptive_updated_at: null }, 'Back to the formula estimate')} className="rounded-xl bg-ink-elevated px-4 py-2.5 text-xs font-semibold text-cloud">
                          Use formula instead
                        </button>
                      )}
                    </div>
                    {adaptiveLocked && lastAdaptive && <p className="mt-2 text-[11px] text-cloud-muted">Updated on {formatShortDate(lastAdaptive)}. Next check-in in {7 - (daysSinceAdaptive ?? 0)} days.</p>}
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-xs leading-relaxed text-cloud-dim">{adaptive.reason}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                      <Progress label="Logged days" value={adaptive.loggedDays} target={Math.ceil(adaptive.windowDays * 0.66)} />
                      <Progress label="Weigh-ins" value={adaptive.weighInCount} target={6} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </Panel>
        </Section>
      )}

      {!n.noNumbers && (
        <Section title="Rate check">
          <Panel className="p-4" onClick={() => go('weight')}>
            <div className="flex items-start gap-3">
              <TrendingUp className="mt-0.5 h-5 w-5 flex-shrink-0 text-lime" />
              <div className="min-w-0 flex-1">
                {rate && feedback ? (
                  <>
                    <p className="text-sm font-semibold text-cloud">
                      {rate.pctPerWeek > 0 ? '+' : ''}
                      {rate.pctPerWeek.toFixed(2)}% per week ({rate.kgPerWeek > 0 ? '+' : ''}
                      {rate.kgPerWeek.toFixed(2)} kg)
                    </p>
                    <p className={cn('mt-1 text-xs leading-relaxed', feedback.status === 'on_track' || feedback.status === 'stable' ? 'text-lime' : 'text-gold')}>{feedback.message}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-cloud">Not enough weigh-ins yet</p>
                    <p className="mt-1 text-xs text-cloud-dim">Weigh in 3–4 times a week for two weeks to see your rate.</p>
                  </>
                )}
              </div>
            </div>
          </Panel>
        </Section>
      )}

      {settings.goal_mode === 'cut' && n.planConfirmed && !safety.noWeightGoals && (
        <Section title="Maintenance break">
          <Panel className="p-4">
            <div className="flex items-start gap-3">
              <Coffee className="mt-0.5 h-5 w-5 flex-shrink-0 text-gold" />
              <div className="min-w-0 flex-1">
                {onBreak ? (
                  <>
                    <p className="text-sm font-semibold text-cloud">On a break until {formatShortDate(settings.diet_break_until as string)}</p>
                    <p className="mt-1 text-xs text-cloud-dim">Targets are at maintenance. Fat-loss targets resume automatically.</p>
                    <button type="button" onClick={() => save({ diet_break_until: null }, 'Break ended')} className="mt-3 rounded-xl bg-ink-elevated px-4 py-2.5 text-xs font-semibold text-cloud">
                      End break now
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-cloud">{weeksInCut >= 8 ? `${weeksInCut} weeks into fat loss` : 'Optional diet break'}</p>
                    <p className="mt-1 text-xs leading-relaxed text-cloud-dim">
                      One to two weeks at maintenance can ease hunger and help training. Results on fat loss are mixed, so this is your choice.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => save({ diet_break_until: addDays(today, 6) }, 'One-week break started')} className="rounded-xl bg-ink-elevated px-4 py-2.5 text-xs font-semibold text-cloud">
                        1 week
                      </button>
                      <button type="button" onClick={() => save({ diet_break_until: addDays(today, 13) }, 'Two-week break started')} className="rounded-xl bg-ink-elevated px-4 py-2.5 text-xs font-semibold text-cloud">
                        2 weeks
                      </button>
                    </div>
                    <Citations ids={['byrne2018', 'peos2021']} className="mt-3" />
                  </>
                )}
              </div>
            </div>
          </Panel>
        </Section>
      )}

      <button
        type="button"
        onClick={() => go('coach', { plan: 1 })}
        className="flex w-full items-center gap-3 rounded-2xl border border-lime/30 bg-gradient-to-r from-lime/15 to-transparent p-4 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime text-ink-bg">
          <Sparkles className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-cloud">Build a meal plan with AI</span>
          <span className="block text-[11px] text-cloud-dim">Matches these targets, your diet preferences and allergies</span>
        </span>
      </button>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}

/** Before a plan is saved, start from the goal chosen in the user's profile. */
function goalFromProfile(profile: { fitness_goal?: string | null; physique_goal?: string | null } | null): GoalMode {
  const fitness = profile?.fitness_goal ?? null;
  const physique = profile?.physique_goal ?? null;
  if (fitness === 'fat_loss' || physique === 'fat_loss') return 'cut';
  if (fitness === 'muscle_gain' || physique === 'hypertrophy') return 'bulk';
  if (physique === 'recomposition') return 'recomp';
  return 'maintain';
}

function pickDraft(
  s: NutritionSettings,
  profile: { fitness_goal?: string | null; physique_goal?: string | null } | null,
  confirmed: boolean,
  experience: Parameters<typeof defaultRate>[1],
): Draft {
  if (!confirmed) {
    const mode = goalFromProfile(profile);
    return {
      goal_mode: mode,
      rate_pct: defaultRate(mode, experience),
      sex: s.sex,
      protein_g_per_kg: null,
      fat_pct: null,
      meals_per_day: s.meals_per_day,
      carb_shift: false,
      kcal_override: null,
    };
  }
  return {
    goal_mode: s.goal_mode,
    rate_pct: s.rate_pct,
    sex: s.sex,
    protein_g_per_kg: s.protein_g_per_kg,
    fat_pct: s.fat_pct,
    meals_per_day: s.meals_per_day,
    carb_shift: s.carb_shift,
    kcal_override: s.kcal_override,
  };
}

function normalizeDraft(d: Draft, custom: boolean) {
  return { ...d, kcal_override: custom ? d.kcal_override : null };
}

function TargetTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-ink-bg/60 px-2 py-2.5 text-center">
      <p className="text-lg font-bold tabular-nums" style={{ color }}>
        {fmt(value)} g
      </p>
      <p className="text-[10px] text-cloud-dim">{label}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-cloud-dim">{label}</span>
      <span className="text-right font-semibold tabular-nums text-cloud">{value}</span>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium text-cloud">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-lime">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full accent-[#A6FF32]"
      />
      <div className="flex justify-between text-[10px] text-cloud-muted">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-cloud-dim">{hint}</p>}
    </div>
  );
}

function Progress({ label, value, target }: { label: string; value: number; target: number }) {
  return (
    <div className="rounded-xl bg-ink-bg/60 px-2 py-2.5">
      <p className="text-sm font-bold tabular-nums text-cloud">
        {Math.min(value, target)}/{target}
      </p>
      <p className="text-[10px] text-cloud-dim">{label}</p>
    </div>
  );
}
