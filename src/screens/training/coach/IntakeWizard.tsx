import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chip, FieldLabel, Notice, Panel, Stepper, Toggle } from '@/screens/nutrition/ui';
import { INTAKE_FIELD_LABELS, type IntakeDraft, type IntakeField } from '@/lib/training/intake';
import { emptyScreening, SCREENING_QUESTIONS } from '@/lib/training/screening';
import { EQUIPMENT_PRESETS, ALL_EQUIPMENT } from '@/lib/training/engine-library';
import { EQUIP_LABELS, MUSCLE_GROUPS, PAIN_AREA_LABELS, type EquipTag, type MuscleGroupKey, type PainArea } from '@/lib/training/taxonomy';
import { CARDIO_MODE_LABELS, PLAN_GOAL_LABELS, type CardioMode, type HealthScreening, type PainLevel, type PlanGoal } from '@/lib/training/plan-types';
import type { ExperienceLevel } from '@/lib/training/curated';

const GOAL_HINTS: Record<PlanGoal, string> = {
  muscle: 'More muscle size, with strength alongside.',
  strength: 'Lift heavier on the main lifts.',
  fat_loss: 'Lose fat while keeping muscle (works with your nutrition plan).',
  general: 'Health, fitness and feeling capable day to day.',
  endurance: 'Better cardio fitness, with two strength days.',
};

const LEVELS: { value: ExperienceLevel; label: string; hint: string }[] = [
  { value: 'new', label: 'New', hint: 'Never lifted, or not for over a year' },
  { value: 'beginner', label: 'Beginner', hint: 'Lifting regularly for less than a year' },
  { value: 'intermediate', label: 'Intermediate', hint: '1–3 years of regular, progressive training' },
  { value: 'advanced', label: 'Advanced', hint: '3+ years; progress now comes slowly' },
];

const PRIORITY_GROUPS: MuscleGroupKey[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];
const PAIN_AREAS = Object.keys(PAIN_AREA_LABELS) as PainArea[];
const EQUIP_CHOICES = ALL_EQUIPMENT.filter((t) => t !== 'bodyweight' && t !== 'other' && t !== 'foam_roller');

function setPath(s: HealthScreening, path: string, value: boolean): HealthScreening {
  const next = JSON.parse(JSON.stringify(s)) as HealthScreening;
  const [a, b] = path.split('.');
  if (b) (next as unknown as Record<string, Record<string, boolean>>)[a][b] = value;
  else (next as unknown as Record<string, boolean>)[a] = value;
  return next;
}

function getPath(s: HealthScreening, path: string): boolean {
  const [a, b] = path.split('.');
  const v = b ? (s as unknown as Record<string, Record<string, boolean>>)[a]?.[b] : (s as unknown as Record<string, boolean>)[a];
  return !!v;
}

export function IntakeWizard({
  draft,
  steps,
  onChange,
  onDone,
  onCancel,
}: {
  draft: IntakeDraft;
  steps: IntakeField[];
  onChange: (d: IntakeDraft) => void;
  onDone: (d: IntakeDraft) => void;
  onCancel?: () => void;
}) {
  const [i, setI] = useState(0);
  const step = steps[Math.min(i, steps.length - 1)];
  const screening = draft.screening ?? emptyScreening();
  const set = (patch: Partial<IntakeDraft>) => onChange({ ...draft, ...patch });

  const valid = useMemo(() => {
    switch (step) {
      case 'goal':
        return !!draft.goal;
      case 'experience':
        return !!draft.experience;
      case 'schedule':
        return draft.daysPerWeek != null && draft.sessionMinutes != null;
      case 'equipment':
        return !!draft.equipment?.length;
      case 'age':
        return draft.age != null && draft.age >= 10 && draft.age <= 100;
      case 'sex':
        return !!draft.sexAnswered;
      case 'activity':
        return !!draft.currentActivity;
      case 'screening':
        return true;
      case 'pain':
        return Array.isArray(draft.pain);
      default:
        return true;
    }
  }, [step, draft]);

  const next = () => {
    let d = draft;
    if (step === 'screening') {
      d = { ...draft, screening: { ...screening, completedAt: new Date().toISOString() } };
      onChange(d);
    }
    if (i >= steps.length - 1) onDone(d);
    else setI(i + 1);
  };

  if (!step) return null;

  return (
    <div className="pb-6">
      <div className="mb-4 flex items-center gap-1.5" aria-label={`Step ${i + 1} of ${steps.length}`}>
        {steps.map((s, k) => (
          <span key={s} className={cn('h-1.5 flex-1 rounded-full', k <= i ? 'bg-lime' : 'bg-ink-elevated')} />
        ))}
      </div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-lime">
        Question {i + 1} of {steps.length}
      </p>
      <h2 className="mb-4 text-lg font-bold text-cloud">{INTAKE_FIELD_LABELS[step]}</h2>

      {step === 'goal' && (
        <div className="space-y-2">
          {(Object.keys(PLAN_GOAL_LABELS) as PlanGoal[]).map((g) => (
            <Panel key={g} onClick={() => set({ goal: g })} className={cn('p-3.5', draft.goal === g && 'border-lime/60 bg-lime/5')}>
              <p className="text-sm font-semibold text-cloud">{PLAN_GOAL_LABELS[g]}</p>
              <p className="text-[11px] text-cloud-dim">{GOAL_HINTS[g]}</p>
            </Panel>
          ))}
          <div className="pt-3">
            <FieldLabel>Muscles to bring up (optional)</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_GROUPS.map((g) => {
                const on = (draft.priorityMuscles ?? []).includes(g);
                return (
                  <Chip
                    key={g}
                    active={on}
                    onClick={() => {
                      const cur = draft.priorityMuscles ?? [];
                      set({ priorityMuscles: on ? cur.filter((x) => x !== g) : cur.length >= 3 ? cur : [...cur, g] });
                    }}
                  >
                    {MUSCLE_GROUPS[g].label}
                  </Chip>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-cloud-dim">Up to 3. They get extra weekly sets.</p>
          </div>
        </div>
      )}

      {step === 'experience' && (
        <div className="space-y-2">
          {LEVELS.map((l) => (
            <Panel key={l.value} onClick={() => set({ experience: l.value })} className={cn('p-3.5', draft.experience === l.value && 'border-lime/60 bg-lime/5')}>
              <p className="text-sm font-semibold text-cloud">{l.label}</p>
              <p className="text-[11px] text-cloud-dim">{l.hint}</p>
            </Panel>
          ))}
        </div>
      )}

      {step === 'schedule' && (
        <div className="space-y-5">
          <div>
            <FieldLabel>Days a week you can train</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Chip key={n} active={draft.daysPerWeek === n} onClick={() => set({ daysPerWeek: n })}>
                  {n}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Minutes per session</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {[20, 30, 45, 60, 75, 90, 120].map((n) => (
                <Chip key={n} active={draft.sessionMinutes === n} onClick={() => set({ sessionMinutes: n })}>
                  {n}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Cardio you like (optional)</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CARDIO_MODE_LABELS) as CardioMode[]).map((m) => {
                const on = (draft.cardioModes ?? []).includes(m);
                return (
                  <Chip key={m} active={on} onClick={() => set({ cardioModes: on ? (draft.cardioModes ?? []).filter((x) => x !== m) : [...(draft.cardioModes ?? []), m] })}>
                    {CARDIO_MODE_LABELS[m]}
                  </Chip>
                );
              })}
            </div>
            <div className="mt-3">
              <Toggle checked={draft.cardio === 'none'} onChange={(v) => set({ cardio: v ? 'none' : 'auto' })} label="Leave cardio out of my plan" />
            </div>
          </div>
        </div>
      )}

      {step === 'equipment' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            {(Object.entries(EQUIPMENT_PRESETS) as [keyof typeof EQUIPMENT_PRESETS, { label: string; tags: EquipTag[] }][]).map(([k, p]) => {
              const on = !!draft.equipment && p.tags.length === draft.equipment.length && p.tags.every((t) => draft.equipment!.includes(t));
              return (
                <Panel key={k} onClick={() => set({ equipment: [...p.tags] })} className={cn('p-3', on && 'border-lime/60 bg-lime/5')}>
                  <p className="text-sm font-semibold text-cloud">{p.label}</p>
                </Panel>
              );
            })}
          </div>
          <div>
            <FieldLabel>Or pick exactly what you have</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {EQUIP_CHOICES.map((t) => {
                const on = (draft.equipment ?? []).includes(t);
                return (
                  <Chip
                    key={t}
                    active={on}
                    onClick={() => {
                      const cur = new Set<EquipTag>(draft.equipment ?? ['bodyweight']);
                      cur.add('bodyweight');
                      if (on) cur.delete(t);
                      else cur.add(t);
                      set({ equipment: [...cur] });
                    }}
                  >
                    {EQUIP_LABELS[t]}
                  </Chip>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 'age' && (
        <div className="space-y-4">
          <Stepper label="Age" value={draft.age ?? 30} onChange={(v) => set({ age: Math.round(v) })} step={1} min={10} max={100} suffix="years" />
          <p className="text-[11px] text-cloud-dim">Age changes the safety rules: plans for under-18s and over-65s are built with extra care.</p>
        </div>
      )}

      {step === 'sex' && (
        <div className="space-y-2">
          {[
            { v: 'female' as const, l: 'Female' },
            { v: 'male' as const, l: 'Male' },
            { v: null, l: 'Prefer not to say' },
          ].map((o) => (
            <Panel key={o.l} onClick={() => set({ sex: o.v, sexAnswered: true })} className={cn('p-3.5', draft.sexAnswered && draft.sex === o.v && 'border-lime/60 bg-lime/5')}>
              <p className="text-sm font-semibold text-cloud">{o.l}</p>
            </Panel>
          ))}
          <p className="text-[11px] text-cloud-dim">Only used to ask about pregnancy in the health check.</p>
        </div>
      )}

      {step === 'activity' && (
        <div className="space-y-4">
          <div className="space-y-2">
            {[
              { v: 'inactive' as const, l: 'Not exercising now', h: 'No planned exercise most weeks' },
              { v: 'some' as const, l: 'Some exercise', h: 'Planned exercise some weeks, or only recently started' },
              { v: 'regular' as const, l: 'Regular exercise', h: 'Planned exercise most weeks for the last few months' },
            ].map((o) => (
              <Panel key={o.v} onClick={() => set({ currentActivity: o.v })} className={cn('p-3.5', draft.currentActivity === o.v && 'border-lime/60 bg-lime/5')}>
                <p className="text-sm font-semibold text-cloud">{o.l}</p>
                <p className="text-[11px] text-cloud-dim">{o.h}</p>
              </Panel>
            ))}
          </div>
          <div>
            <FieldLabel>Average sleep per night (optional)</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {[5, 6, 7, 8, 9].map((h) => (
                <Chip key={h} active={draft.sleepHours === h} onClick={() => set({ sleepHours: draft.sleepHours === h ? null : h })}>
                  {h === 5 ? '5 or less' : h === 9 ? '9+' : `${h}`} h
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'screening' && (
        <div className="space-y-3">
          <Notice tone="info">Answer yes if it applies to you now. This is a safety screen, not a diagnosis; your answers stay in your account.</Notice>
          {SCREENING_QUESTIONS.map((q) => (
            <Toggle key={q.id} checked={getPath(screening, q.path)} onChange={(v) => set({ screening: setPath(screening, q.path, v) })} label={q.text} />
          ))}
          {draft.sex !== 'male' && (
            <div>
              <FieldLabel>Pregnancy</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'no' as const, l: 'Not pregnant' },
                  { v: 'pregnant' as const, l: 'Pregnant' },
                  { v: 'postpartum' as const, l: 'Gave birth in the last 6 months' },
                ].map((o) => (
                  <Chip key={o.v} active={screening.pregnancy === o.v} onClick={() => set({ screening: { ...screening, pregnancy: o.v } })}>
                    {o.l}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {(Object.values(screening.symptoms).some(Boolean) ||
            Object.values(screening.knownDisease).some(Boolean) ||
            screening.doctorSaidAvoidExercise ||
            screening.recentSurgeryOrInjury ||
            screening.uncontrolledHighBloodPressure ||
            screening.pregnancy === 'pregnant') && (
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-3.5">
              <Toggle
                checked={screening.clearedByClinician}
                onChange={(v) => set({ screening: { ...screening, clearedByClinician: v } })}
                label="A doctor or other clinician has checked this and said I can exercise"
                description="Only tick this if it is true. Their limits come before any plan."
              />
            </div>
          )}
        </div>
      )}

      {step === 'pain' && (
        <div className="space-y-3">
          <Panel onClick={() => set({ pain: [] })} className={cn('p-3.5', Array.isArray(draft.pain) && draft.pain.length === 0 && 'border-lime/60 bg-lime/5')}>
            <p className="text-sm font-semibold text-cloud">No pain or injuries right now</p>
          </Panel>
          <p className="text-[11px] text-cloud-dim">Or tap each area that hurts and choose how much:</p>
          {PAIN_AREAS.map((a) => {
            const entry = (draft.pain ?? []).find((p) => p.area === a);
            return (
              <div key={a} className="flex items-center justify-between gap-2 rounded-xl border border-ink-border bg-ink-surface px-3 py-2">
                <span className="text-sm text-cloud">{PAIN_AREA_LABELS[a]}</span>
                <div className="flex gap-1.5">
                  {(['mild', 'moderate', 'severe'] as PainLevel[]).map((lvl) => (
                    <Chip
                      key={lvl}
                      active={entry?.level === lvl}
                      onClick={() => {
                        const others = (draft.pain ?? []).filter((p) => p.area !== a);
                        set({ pain: entry?.level === lvl ? others : [...others, { area: a, level: lvl }] });
                      }}
                    >
                      {lvl}
                    </Chip>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {(i > 0 || onCancel) && (
          <button
            type="button"
            onClick={() => (i > 0 ? setI(i - 1) : onCancel?.())}
            className="flex items-center gap-1.5 rounded-xl bg-ink-elevated px-4 py-3 text-sm font-medium text-cloud"
          >
            <ArrowLeft className="h-4 w-4" /> {i > 0 ? 'Back' : 'Cancel'}
          </button>
        )}
        <button
          type="button"
          disabled={!valid}
          onClick={next}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime px-4 py-3 text-sm font-bold text-ink-bg disabled:opacity-40"
        >
          {i >= steps.length - 1 ? (
            <>
              <Check className="h-4 w-4" /> Build my plan
            </>
          ) : (
            <>
              Next <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
