import { describe, expect, it } from 'vitest';
import { buildCoachNote, buildTonightPlan, timeMinusHours } from './coach-note';
import type { MuscleRecoveryState } from '../engine';

function m(muscle: MuscleRecoveryState['muscle'], pct: number | null, hoursNeeded = 48, since = 24): MuscleRecoveryState {
  return {
    muscle, recoveryPercent: pct, hoursSinceLastTrained: pct == null ? null : since, hoursNeeded,
    status: pct == null ? 'no_data' : pct < 50 ? 'red' : pct < 90 ? 'orange' : 'green',
    lastTrainedDate: null, weeklyEffectiveSets: 0, weeklySetBand: 'low', sessionEffectiveSets: 0, hasSessionVolumeWarning: false,
    personalMultiplier: 1, newExercises: [],
    modifiers: { rirExtra: 0, volumeExtra: 0, sorenessExtra: 0, noveltyExtra: 0, sleepMultiplier: 1, stressMultiplier: 1, personalMultiplier: 1 },
  };
}

describe('coach note', () => {
  it('asks for a workout when nothing is tracked', () => {
    const n = buildCoachNote({ muscles: [m('quads', null)], sleepLastNight: null, nextWorkout: null });
    expect(n.lines).toEqual(['Log a workout and I will start tracking how each muscle recovers.']);
    expect(n.focus).toBeNull();
  });

  it('lists ready and recovering muscles with hours left from the engine', () => {
    const n = buildCoachNote({ muscles: [m('upper_chest', 100), m('quads', 50, 48, 24), m('calves', 95)], sleepLastNight: 7.5, nextWorkout: null });
    expect(n.lines[0]).toBe('You slept 7h 30m.');
    expect(n.lines[1]).toBe('Ready: Upper Chest, Calves.');
    expect(n.lines[2]).toBe('Still recovering: Quadriceps 50% (about 24h to go).');
  });

  it('flags next-workout muscles under 50%', () => {
    const n = buildCoachNote({ muscles: [m('quads', 40), m('upper_chest', 100)], sleepLastNight: 5.25, nextWorkout: { name: 'Legs', muscles: ['quads'] } });
    expect(n.lines[0]).toContain('short night');
    expect(n.focus).toBe('Your next workout (Legs) trains Quadriceps, still under 50%: go lighter on it or swap to recovered muscles today.');
  });
});

describe('tonight plan', () => {
  it('computes the caffeine cutoff 6 hours before bed, across midnight', () => {
    expect(timeMinusHours('23:00', 6)).toBe('17:00');
    expect(timeMinusHours('01:30', 6)).toBe('19:30');
  });
  it('suggests pre-sleep protein only on training days', () => {
    expect(buildTonightPlan({ sleepLastNight: 8, bedtime: '23:00', trainedToday: true, proteinToday: 92.4 }).protein).toBe('You have logged 92 g of protein today. You trained today: keep a 30–40 g protein serving for before bed.');
    expect(buildTonightPlan({ sleepLastNight: 6, bedtime: '22:30', trainedToday: false, proteinToday: null }).sleep).toContain('Last night was 6h');
  });
});
