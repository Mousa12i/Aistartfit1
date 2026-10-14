// Deterministic sample data for tests and screenshots (not used by the app itself).

import { computeMuscleRecovery, mapExerciseFromPersistedMuscles, type SetLogForRecovery } from '../engine';
import type { DailyCheckin, FullRecoveryData, PainLog, RecoverySession } from '../store';
import type { RecoveryMuscle } from '../muscles';
import { buildDoctor, type DoctorExtras, type DoctorState } from './build';
import { addDays } from './dates';

const EX: Record<string, { name: string; muscles: { muscle: RecoveryMuscle; contribution: number }[]; base: number }> = {
  bench: { name: 'Barbell Bench Press', base: 70, muscles: [{ muscle: 'upper_chest', contribution: 1 }, { muscle: 'lower_chest', contribution: 1 }, { muscle: 'triceps', contribution: 0.5 }, { muscle: 'front_delts', contribution: 0.5 }] },
  squat: { name: 'Barbell Squat', base: 90, muscles: [{ muscle: 'quads', contribution: 1 }, { muscle: 'glutes', contribution: 1 }, { muscle: 'adductors', contribution: 0.5 }] },
  row: { name: 'Barbell Row', base: 60, muscles: [{ muscle: 'lats', contribution: 1 }, { muscle: 'mid_back', contribution: 1 }, { muscle: 'biceps', contribution: 0.5 }] },
};
const DAYS: { name: string; ex: string[] }[] = [
  { name: 'Push', ex: ['bench'] },
  { name: 'Legs', ex: ['squat'] },
  { name: 'Pull', ex: ['row'] },
];

export function sampleDoctor(now = new Date('2026-10-14T09:00:00')): { state: DoctorState; full: FullRecoveryData; extras: DoctorExtras } {
  const today = '2026-10-14';
  const sessions: RecoverySession[] = [];
  const setLogs: SetLogForRecovery[] = [];
  let n = 0;
  // 7 weeks, Mon/Wed/Fri; the last week is heavier; one session per week left unrated
  for (let w = 6; w >= 0; w--) {
    for (const [k, offset] of [0, 2, 4].entries()) {
      const date = addDays(today, -(w * 7) - (6 - offset) + 1 - 1);
      if (date > today) continue;
      const day = DAYS[(n++) % 3];
      const id = `s-${date}`;
      const completed = `${date}T18:00:00.000Z`;
      sessions.push({
        id,
        completed_at: completed,
        started_at: `${date}T17:00:00.000Z`,
        duration_seconds: 3600 + (w === 0 ? 900 : 0),
        total_sets: 4,
        total_volume: null,
        plan_id: 'plan-1',
        plan_name: `PPL · ${day.name}`,
        session_rpe: k === 2 && w % 2 === 0 ? null : w === 0 ? 8 : 6 + (w % 2),
      });
      for (const exId of day.ex) {
        const e = EX[exId];
        const weight = e.base + (6 - w) * 2.5 - (w === 0 && exId === 'squat' ? 10 : 0);
        for (let s = 1; s <= 4; s++) {
          setLogs.push({ exercise_id: exId, exercise_name: e.name, set_type: 'working', rir: w === 0 ? 0 : 2, weight, reps: 8, completed: true, session_id: id, session_completed_at: completed });
        }
      }
    }
  }
  sessions.sort((a, b) => b.completed_at.localeCompare(a.completed_at));

  const checkins: DailyCheckin[] = [];
  for (let i = 34; i >= 0; i--) {
    const date = addDays(today, -i);
    const short = i % 4 === 1;
    const v = short ? 2 : i % 3 === 0 ? 4 : 3;
    checkins.push({
      id: `c-${date}`,
      user_id: 'u',
      checkin_date: date,
      sleep_hours: short ? 5.75 : 7.5 + (i % 2) * 0.5,
      hydration_l: null,
      stress: null,
      resting_hr: null,
      hrv_ms: null,
      body_weight: 80,
      protein_g: i % 2 ? 140 : 100,
      soreness: {},
      wellness_sleep: i === 0 ? 2 : v,
      wellness_energy: i === 0 ? 2 : v,
      wellness_soreness: i === 0 ? 2 : v + (i % 5 === 0 ? 1 : 0) > 5 ? 5 : v,
      wellness_stress: i === 0 ? 3 : v,
      wellness_mood: i === 0 ? 3 : v,
    });
  }
  checkins.reverse();

  const painLogs: PainLog[] = [
    { id: 'p1', user_id: 'u', body_area: 'Left knee', onset: 'gradual', pain_type: 'dull ache', severity: 5, during_exercise: true, swelling: false, bruising: false, rom_loss: false, duration_hours: 48, notes: null, triage_level: 'yellow', recorded_at: `${addDays(today, -3)}T19:00:00.000Z` },
  ];

  const mappings = new Map(Object.entries(EX).map(([id, e]) => [id, mapExerciseFromPersistedMuscles(id, e.name, e.muscles)]));
  const muscleStates = computeMuscleRecovery({ setLogs, exerciseMappings: mappings, soreness: [], sleep: [], personalMultipliers: {}, now });

  const full = {
    muscleStates,
    readiness: { status: 'insufficient_data', availableInputs: [], missingInputs: [], firedRuleId: 'R3', disclaimer: '', recordDates: [], confidence: 'Low', components: [] },
    acwr: { acwr: null, acuteLoad: 0, chronicLoad: 0, hasEnoughData: false, band: 'not_enough_data' },
    performanceChecks: [{ muscle: 'quads', baselineE1RM: 130, currentE1RM: 118, percentDrop: 9.2, isFatigued: true }],
    todayCheckin: checkins[checkins.length - 1],
    sorenessLogs: [],
    painLogs,
    recoveryProfile: [{ id: 'rp', user_id: 'u', muscle: 'quads', personal_multiplier: 1.2, sample_size: 6, confidence: 'Moderate', manually_overridden: false }],
    sleepHistory: [],
    sessions,
    setLogs,
    checkins: [...checkins].reverse(),
    exerciseMappings: mappings,
    exercises: [],
  } as unknown as FullRecoveryData;

  const extras: DoctorExtras = {
    adjustments: [],
    rtt: [
      {
        id: 'rtt1',
        area: 'Left knee',
        stage: 2,
        status: 'active',
        started_at: `${addDays(today, -6)}T10:00:00.000Z`,
        entries: [
          { date: addDays(today, -5), stage: 1, painDuring: 3, painNextMorning: 2, morningWorse: false },
          { date: addDays(today, -4), stage: 1, painDuring: 2, painNextMorning: 1, morningWorse: false },
          { date: addDays(today, -2), stage: 2, painDuring: 3, painNextMorning: 2, morningWorse: false },
        ],
      },
    ],
    cycleTracking: false,
    cycleStarts: [],
    modalityLogs: Array.from({ length: 8 }, (_, i) => ({ date: sessions[i * 2]?.completed_at.slice(0, 10) ?? today, modality: 'massage' })),
  };

  const state = buildDoctor({
    full,
    extras,
    now,
    nextWorkout: { planId: 'plan-1', planName: 'PPL', dayLabel: 'Day 2 · Legs', muscles: ['quads', 'glutes', 'hamstrings'] },
    bodyWeightKg: 80,
  });
  return { state, full, extras };
}
