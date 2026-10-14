import { describe, expect, it } from 'vitest';
import { generatePlan } from './engine';
import { CLAIMS, TRAINING_REFERENCES } from './evidence';
import { validatePlan, usableContextFor, weeklySetsFromLibrary, estimateDayMinutes } from './validate';
import { applyPlanAction } from './plan-actions';
import { screenForTraining } from './screening';
import { isLyingExercise, EQUIPMENT_PRESETS } from './engine-library';
import { PAIN_AREA_FLAGS, type MuscleGroupKey, type PainArea } from './taxonomy';
import { baseIntake, testLibrary } from './test-fixtures';
import type { ExperienceLevel } from './curated';
import type { PlanGoal, TrainingIntake, TrainingPlan } from './plan-types';

const lib = testLibrary();
const NOW = new Date('2026-10-14T09:00:00Z');

function ready(intake: TrainingIntake): TrainingPlan {
  const r = generatePlan(intake, lib, { now: NOW });
  if (r.status !== 'ready') throw new Error(`expected a plan, got hold: ${r.screening.holdReasons.join(' ')}`);
  return r.plan;
}

function errorsOf(intake: TrainingIntake, plan: TrainingPlan) {
  const screening = screenForTraining(intake);
  return validatePlan(plan, lib, usableContextFor(intake, screening), screening).filter((i) => i.level === 'error');
}

describe('evidence', () => {
  it('every study claim cites known references and every design claim cites none', () => {
    for (const c of Object.values(CLAIMS)) {
      if (c.kind === 'study') {
        expect(c.refs.length, c.id).toBeGreaterThan(0);
        for (const r of c.refs) expect(TRAINING_REFERENCES[r], `${c.id} -> ${r}`).toBeDefined();
      } else {
        expect(c.refs, c.id).toEqual([]);
        expect(/StartFit/.test(c.text) || c.id === 'estimate_time', c.id).toBe(true);
      }
    }
  });

  it('every reference links to its DOI', () => {
    for (const r of Object.values(TRAINING_REFERENCES)) expect(r.url.startsWith('https://doi.org/10.'), r.id).toBe(true);
  });
});

describe('plan engine', () => {
  it('is deterministic', () => {
    const a = ready(baseIntake());
    const b = ready(baseIntake());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('builds a valid plan for a typical gym beginner', () => {
    const intake = baseIntake();
    const plan = ready(intake);
    expect(plan.days.length).toBe(3);
    expect(errorsOf(intake, plan)).toEqual([]);
    for (const row of plan.volume.filter((r) => r.high > 0)) expect(row.status, row.group).not.toBe('low');
    for (const id of plan.claimIds) expect(CLAIMS[id], id).toBeDefined();
  });

  it('reports volume that matches the library', () => {
    const plan = ready(baseIntake({ experience: 'intermediate', daysPerWeek: 4 }));
    const v = weeklySetsFromLibrary(plan, lib);
    for (const row of plan.volume) expect(row.sets, row.group).toBeCloseTo(v[row.group as MuscleGroupKey] ?? 0, 1);
  });

  it('caps strength days by experience and turns extra days into cardio', () => {
    const plan = ready(baseIntake({ experience: 'new', daysPerWeek: 6 }));
    expect(plan.strengthDays).toBe(3);
    expect(plan.cardio.length).toBeGreaterThan(0);
    const adv = ready(baseIntake({ experience: 'advanced', daysPerWeek: 6, sessionMinutes: 75 }));
    expect(adv.strengthDays).toBe(5);
  });

  it('keeps every session inside the time available', () => {
    for (const minutes of [20, 30, 45, 60, 90]) {
      const intake = baseIntake({ sessionMinutes: minutes, experience: 'intermediate', daysPerWeek: 4 });
      const plan = ready(intake);
      for (const d of plan.days) {
        expect(d.estimatedMinutes, `${minutes} min ${d.label}`).toBeLessThanOrEqual(minutes + 2);
        expect(d.exercises.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('never uses equipment the person does not have', () => {
    const intake = baseIntake({ equipment: EQUIPMENT_PRESETS.home_basic.tags, experience: 'beginner' });
    const plan = ready(intake);
    expect(errorsOf(intake, plan)).toEqual([]);
    const names = plan.days.flatMap((d) => d.exercises.map((e) => e.name)).join(' ');
    expect(names).not.toMatch(/Cable|Machine|Lat Pulldown|Leg Press|Barbell/);
  });

  it('explains what is missing with no equipment', () => {
    const plan = ready(baseIntake({ equipment: ['bodyweight'], experience: 'new', goal: 'general', daysPerWeek: 2, sessionMinutes: 30 }));
    expect(plan.notes.some((n) => /No suitable exercise|would let the plan include/.test(n.text))).toBe(true);
  });

  it('leaves out movements that load a painful area', () => {
    const areas: PainArea[] = ['shoulder', 'lower_back', 'knee', 'wrist', 'elbow'];
    for (const area of areas) {
      const intake = baseIntake({ pain: [{ area, level: 'moderate' }], experience: 'intermediate', daysPerWeek: 4 });
      const plan = ready(intake);
      expect(errorsOf(intake, plan), area).toEqual([]);
      for (const d of plan.days) {
        for (const e of d.exercises) {
          const ex = lib.byId.get(e.exerciseId)!;
          for (const f of PAIN_AREA_FLAGS[area]) expect(ex.flags.includes(f), `${area}: ${ex.name} has ${f}`).toBe(false);
        }
      }
    }
  });

  it('holds the plan for symptoms until a clinician has cleared the person', () => {
    const intake = baseIntake();
    intake.screening.symptoms.chestPain = true;
    expect(generatePlan(intake, lib, { now: NOW }).status).toBe('hold');
    intake.screening.clearedByClinician = true;
    const plan = ready(intake);
    for (const d of plan.days) for (const e of d.exercises) if (!e.timed) expect(e.rir).toBeGreaterThanOrEqual(3);
    expect(plan.cardio.every((c) => c.intensity !== 'vigorous')).toBe(true);
  });

  it('holds for known disease in someone not exercising, but not for a regular exerciser', () => {
    const inactive = baseIntake({ currentActivity: 'inactive' });
    inactive.screening.knownDisease.metabolic = true;
    expect(generatePlan(inactive, lib, { now: NOW }).status).toBe('hold');
    const regular = baseIntake({ currentActivity: 'regular' });
    regular.screening.knownDisease.metabolic = true;
    const r = generatePlan(regular, lib, { now: NOW });
    expect(r.status).toBe('ready');
  });

  it('pregnancy: hold until cleared, then no lying, impact or failure work', () => {
    const intake = baseIntake({ sex: 'female', goal: 'fat_loss' });
    intake.screening.pregnancy = 'pregnant';
    expect(generatePlan(intake, lib, { now: NOW }).status).toBe('hold');
    intake.screening.clearedByClinician = true;
    const plan = ready(intake);
    expect(plan.effectiveGoal).toBe('general');
    for (const d of plan.days) {
      for (const e of d.exercises) {
        const ex = lib.byId.get(e.exerciseId)!;
        expect(isLyingExercise(ex), ex.name).toBe(false);
        expect(ex.flags.includes('impact'), ex.name).toBe(false);
        if (!e.timed) expect(e.rir, ex.name).toBeGreaterThanOrEqual(3);
      }
    }
    expect(errorsOf(intake, plan)).toEqual([]);
  });

  it('adds balance work for older adults and keeps sets short of failure', () => {
    const plan = ready(baseIntake({ age: 72, goal: 'general', experience: 'new', currentActivity: 'some', sessionMinutes: 45 }));
    expect(plan.days.every((d) => d.exercises.some((e) => e.pattern === 'balance'))).toBe(true);
    for (const d of plan.days) for (const e of d.exercises) if (!e.timed) expect(e.rir).toBeGreaterThanOrEqual(2);
  });

  it('does not plan fat loss for under-18s', () => {
    const plan = ready(baseIntake({ age: 16, goal: 'fat_loss', experience: 'new' }));
    expect(plan.effectiveGoal).toBe('general');
  });

  it('refuses ages under 13', () => {
    expect(generatePlan(baseIntake({ age: 11 }), lib, { now: NOW }).status).toBe('hold');
  });

  it('gives priority muscles more weekly sets', () => {
    const normal = ready(baseIntake({ experience: 'intermediate', daysPerWeek: 4, sessionMinutes: 75 }));
    const focused = ready(baseIntake({ experience: 'intermediate', daysPerWeek: 4, sessionMinutes: 75, priorityMuscles: ['shoulders'] }));
    const s = (p: TrainingPlan) => p.volume.find((r) => r.group === 'shoulders')!.sets;
    expect(s(focused)).toBeGreaterThan(s(normal));
  });

  it('cardio follows the WHO range and builds up gradually from inactivity', () => {
    const plan = ready(baseIntake({ currentActivity: 'inactive', experience: 'new', goal: 'general' }));
    expect(plan.cardioTargetMinutes).toBeGreaterThanOrEqual(150);
    expect(plan.cardioTargetMinutes).toBeLessThanOrEqual(300);
    expect(plan.cardioRamp[0]).toBeLessThan(plan.cardioTargetMinutes);
    expect(plan.cardioRamp[plan.cardioRamp.length - 1]).toBe(plan.cardioTargetMinutes);
    expect(plan.cardioMinutesPerWeek).toBe(plan.cardioRamp[0]);
  });

  it('survives every combination of goal, level, days, time and equipment without invalid plans', () => {
    const goals: PlanGoal[] = ['muscle', 'strength', 'fat_loss', 'general', 'endurance'];
    const levels: ExperienceLevel[] = ['new', 'beginner', 'intermediate', 'advanced'];
    const presets = Object.values(EQUIPMENT_PRESETS).map((p) => p.tags);
    let count = 0;
    for (const goal of goals)
      for (const experience of levels)
        for (const daysPerWeek of [1, 2, 3, 4, 5, 6])
          for (const sessionMinutes of [20, 45, 90])
            for (const equipment of presets) {
              const intake = baseIntake({ goal, experience, daysPerWeek, sessionMinutes, equipment });
              const plan = ready(intake);
              const errors = errorsOf(intake, plan);
              expect(errors, `${goal}/${experience}/${daysPerWeek}d/${sessionMinutes}min`).toEqual([]);
              for (const d of plan.days) expect(estimateDayMinutes(d)).toBeLessThanOrEqual(sessionMinutes + 0.01 + (d.exercises.some((e) => e.pattern === 'balance') ? 3 : 0));
              count++;
            }
    expect(count).toBe(5 * 4 * 6 * 3 * 4);
  });
});

describe('plan changes', () => {
  const intake = baseIntake({ experience: 'intermediate', daysPerWeek: 4 });
  const screening = screenForTraining(intake);
  const ctx = usableContextFor(intake, screening);

  it('swaps an exercise for one of its listed alternatives', () => {
    const plan = ready(intake);
    const e = plan.days[0].exercises[0];
    const alt = e.alternatives[0];
    const r = applyPlanAction(plan, { type: 'swap_exercise', dayIndex: 0, exerciseId: e.exerciseId, newExerciseId: alt.exerciseId }, lib, ctx, screening);
    expect(r.ok).toBe(true);
    expect(r.plan.days[0].exercises[0].exerciseId).toBe(alt.exerciseId);
    expect(plan.days[0].exercises[0].exerciseId).toBe(e.exerciseId); // original untouched
  });

  it('rejects a change that breaks a safety limit', () => {
    const painIntake = baseIntake({ experience: 'intermediate', daysPerWeek: 4, pain: [{ area: 'shoulder', level: 'moderate' }] });
    const s2 = screenForTraining(painIntake);
    const c2 = usableContextFor(painIntake, s2);
    const plan = ready(painIntake);
    const overhead = [...lib.byId.values()].find((x) => !x.hidden && x.flags.includes('overhead') && x.equipment.every((t) => t === 'dumbbell'))!;
    const r = applyPlanAction(plan, { type: 'add_exercise', dayIndex: 0, exerciseId: overhead.id, sets: 3, repsMin: 8, repsMax: 12 }, lib, c2, s2);
    expect(r.ok).toBe(false);
  });

  it('rejects impossible numbers and unknown exercises', () => {
    const plan = ready(intake);
    const e = plan.days[0].exercises[0];
    expect(applyPlanAction(plan, { type: 'set_sets', dayIndex: 0, exerciseId: e.exerciseId, sets: 12 }, lib, ctx, screening).ok).toBe(false);
    expect(applyPlanAction(plan, { type: 'set_rest', dayIndex: 0, exerciseId: e.exerciseId, restSeconds: 2 }, lib, ctx, screening).ok).toBe(false);
    expect(applyPlanAction(plan, { type: 'swap_exercise', dayIndex: 0, exerciseId: e.exerciseId, newExerciseId: 'nope' }, lib, ctx, screening).ok).toBe(false);
    expect(applyPlanAction(plan, { type: 'set_sets', dayIndex: 9, exerciseId: e.exerciseId, sets: 3 }, lib, ctx, screening).ok).toBe(false);
  });

  it('recomputes weekly volume after a change', () => {
    const plan = ready(intake);
    const e = plan.days[0].exercises[0];
    const r = applyPlanAction(plan, { type: 'set_sets', dayIndex: 0, exerciseId: e.exerciseId, sets: e.sets + 1 }, lib, ctx, screening);
    expect(r.ok).toBe(true);
    const before = plan.volume.reduce((s, v) => s + v.sets, 0);
    const after = r.plan.volume.reduce((s, v) => s + v.sets, 0);
    expect(after).toBeGreaterThan(before);
  });
});

describe('plan PDF', () => {
  it('is a text PDF with every cited reference and its DOI link', async () => {
    const { renderPlanPdf, referenceNumbers } = await import('./plan-pdf');
    const plan = ready(baseIntake({ experience: 'intermediate', daysPerWeek: 4, sleepHours: 6, pain: [{ area: 'knee', level: 'mild' }] }));
    const bytes = renderPlanPdf(plan, { personName: 'Test' });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const studyClaims = plan.claimIds.concat(plan.rationale.map((r) => r.claimId)).filter((id) => CLAIMS[id]?.kind === 'study');
    const { order } = referenceNumbers([...new Set(studyClaims)]);
    expect(order.length).toBeGreaterThan(5);
    for (const ref of order) expect(text).toContain(`/URI (${ref.url})`);
    for (const d of plan.days) for (const e of d.exercises) expect(text).toContain(e.name.replace(/[()\\]/g, (c) => `\\${c}`));
  });
});
