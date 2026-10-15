import { describe, expect, it } from 'vitest';
import { computeMuscleRecovery, mapExerciseFromPersistedMuscles, type SetLogForRecovery } from './engine';
import { feedbackMultiplier } from './profile';

const mapping = new Map([
  ['bench', mapExerciseFromPersistedMuscles('bench', 'Bench Press', [{ muscle: 'upper_chest', contribution: 1 }])],
]);

function log(overrides: Partial<SetLogForRecovery> = {}): SetLogForRecovery {
  return {
    exercise_id: 'bench',
    exercise_name: 'Bench Press',
    set_type: 'working',
    rir: 2,
    weight: 60,
    reps: 8,
    completed: true,
    session_id: 'session-a',
    session_completed_at: '2026-10-12T10:00:00.000Z',
    ...overrides,
  };
}

describe('production recovery engine', () => {
  it('returns no data when there are no completed sessions', () => {
    const [state] = computeMuscleRecovery({ setLogs: [], exerciseMappings: mapping, soreness: [], sleep: [], personalMultipliers: {}, now: new Date('2026-10-13T10:00:00.000Z') });
    expect(state.status).toBe('no_data');
    expect(state.recoveryPercent).toBeNull();
  });

  it('ignores abandoned, incomplete, and warm-up sets', () => {
    const [state] = computeMuscleRecovery({
      setLogs: [log({ completed: false }), log({ set_type: 'warm_up' }), log()],
      exerciseMappings: mapping,
      soreness: [],
      sleep: [],
      personalMultipliers: {},
      now: new Date('2026-10-13T10:00:00.000Z'),
    });
    expect(state.status).not.toBe('no_data');
    expect(state.weeklyEffectiveSets).toBe(1);
  });

  it('sums mapped contributions within a real session and warns above eleven effective sets', () => {
    const logs = Array.from({ length: 12 }, (_, index) => log({ session_id: 'session-a' }));
    const [state] = computeMuscleRecovery({ setLogs: logs, exerciseMappings: mapping, soreness: [], sleep: [], personalMultipliers: {}, now: new Date('2026-10-13T10:00:00.000Z') });
    expect(state.sessionEffectiveSets).toBe(12);
    expect(state.hasSessionVolumeWarning).toBe(true);
  });
});

describe('recovery engine fixes', () => {
  const now = new Date('2026-10-13T10:00:00.000Z');
  it('measures failure sets and volume from the latest session only', () => {
    const old = Array.from({ length: 14 }, () => log({ session_id: 'old', session_completed_at: '2026-10-01T10:00:00.000Z', rir: 0 }));
    const recent = Array.from({ length: 3 }, () => log({ session_id: 'new', session_completed_at: '2026-10-12T10:00:00.000Z', rir: 3 }));
    const [state] = computeMuscleRecovery({ setLogs: [...old, ...recent], exerciseMappings: mapping, soreness: [], sleep: [], personalMultipliers: {}, now });
    expect(state.sessionEffectiveSets).toBe(3);
    expect(state.hasSessionVolumeWarning).toBe(false);
    expect(state.modifiers.rirExtra).toBe(0);
    expect(state.hoursNeeded).toBe(48);
  });

  it('adds time for sets to failure in the latest session', () => {
    const recent = Array.from({ length: 3 }, () => log({ session_id: 'new', session_completed_at: '2026-10-12T10:00:00.000Z', rir: 0 }));
    const [state] = computeMuscleRecovery({ setLogs: recent, exerciseMappings: mapping, soreness: [], sleep: [], personalMultipliers: {}, now });
    expect(state.modifiers.rirExtra).toBe(18);
  });

  it('ignores soreness reported before the last session', () => {
    const recent = [log({ session_id: 'new', session_completed_at: '2026-10-12T10:00:00.000Z' })];
    const [stale] = computeMuscleRecovery({ setLogs: recent, exerciseMappings: mapping, soreness: [{ muscle: 'upper_chest', score: 9, recordedAt: '2026-10-05T10:00:00.000Z' }], sleep: [], personalMultipliers: {}, now });
    expect(stale.modifiers.sorenessExtra).toBe(0);
    const [fresh] = computeMuscleRecovery({ setLogs: recent, exerciseMappings: mapping, soreness: [{ muscle: 'upper_chest', score: 8, recordedAt: '2026-10-13T08:00:00.000Z' }], sleep: [], personalMultipliers: {}, now });
    expect(fresh.modifiers.sorenessExtra).toBe(12);
  });
});

describe('stress and new-exercise modifiers', () => {
  const now = new Date('2026-10-13T10:00:00.000Z');
  const fly = mapExerciseFromPersistedMuscles('fly', 'Cable Fly', [{ muscle: 'upper_chest', contribution: 1 }]);
  const maps = new Map([...mapping, ['fly', fly]]);
  const history = log({ session_id: 'h', session_completed_at: '2026-08-20T10:00:00.000Z' });

  it('adds 10% when high stress was reported', () => {
    const recent = [log({ session_id: 'new', session_completed_at: '2026-10-12T10:00:00.000Z' })];
    const [calm] = computeMuscleRecovery({ setLogs: recent, exerciseMappings: maps, soreness: [], sleep: [], personalMultipliers: {}, now });
    const [stressed] = computeMuscleRecovery({ setLogs: recent, exerciseMappings: maps, soreness: [], sleep: [], personalMultipliers: {}, now, highStress: true });
    expect(calm.modifiers.stressMultiplier).toBe(1);
    expect(stressed.modifiers.stressMultiplier).toBe(1.1);
    expect(stressed.hoursNeeded).toBeCloseTo(calm.hoursNeeded * 1.1, 6);
  });

  it('adds 12h for an exercise not done in the previous 8 weeks, given 4+ weeks of history', () => {
    const recent = [log({ session_id: 'new', session_completed_at: '2026-10-12T10:00:00.000Z' }), log({ exercise_id: 'fly', exercise_name: 'Cable Fly', session_id: 'new', session_completed_at: '2026-10-12T10:00:00.000Z' })];
    const [state] = computeMuscleRecovery({ setLogs: [history, ...recent], exerciseMappings: maps, soreness: [], sleep: [], personalMultipliers: {}, now });
    expect(state.newExercises).toEqual(['Cable Fly']);
    expect(state.modifiers.noveltyExtra).toBe(12);
    expect(state.hoursNeeded).toBe(48 + 12);
  });

  it('does not call exercises new without 4 weeks of history', () => {
    const recent = [log({ exercise_id: 'fly', exercise_name: 'Cable Fly', session_id: 'new', session_completed_at: '2026-10-12T10:00:00.000Z' })];
    const [state] = computeMuscleRecovery({ setLogs: recent, exerciseMappings: maps, soreness: [], sleep: [], personalMultipliers: {}, now });
    expect(state.newExercises).toEqual([]);
    expect(state.modifiers.noveltyExtra).toBe(0);
  });

  it('does not stack the new-exercise extra on top of high soreness', () => {
    const recent = [log({ exercise_id: 'fly', exercise_name: 'Cable Fly', session_id: 'new', session_completed_at: '2026-10-12T10:00:00.000Z' })];
    const [state] = computeMuscleRecovery({ setLogs: [history, ...recent], exerciseMappings: maps, soreness: [{ muscle: 'upper_chest', score: 8, recordedAt: '2026-10-13T08:00:00.000Z' }], sleep: [], personalMultipliers: {}, now });
    expect(state.modifiers.sorenessExtra).toBe(12);
    expect(state.modifiers.noveltyExtra).toBe(0);
    expect(state.newExercises).toEqual(['Cable Fly']);
  });

  it('treats an exercise done within the last 8 weeks as familiar', () => {
    const before = log({ exercise_id: 'fly', exercise_name: 'Cable Fly', session_id: 'b', session_completed_at: '2026-09-30T10:00:00.000Z' });
    const recent = [log({ exercise_id: 'fly', exercise_name: 'Cable Fly', session_id: 'new', session_completed_at: '2026-10-12T10:00:00.000Z' })];
    const [state] = computeMuscleRecovery({ setLogs: [history, before, ...recent], exerciseMappings: maps, soreness: [], sleep: [], personalMultipliers: {}, now });
    expect(state.newExercises).toEqual([]);
  });
});

describe('feel feedback', () => {
  it('moves towards what was felt only when it disagrees with the estimate', () => {
    expect(feedbackMultiplier(50, 'ready', 1)).toBe(0.95);
    expect(feedbackMultiplier(80, 'ready', 1)).toBeNull();
    expect(feedbackMultiplier(95, 'still_sore', 1)).toBe(1.05);
    expect(feedbackMultiplier(60, 'still_sore', 1)).toBeNull();
    expect(feedbackMultiplier(40, 'ready', 0.7)).toBeNull();
    expect(feedbackMultiplier(99, 'still_sore', 1.38)).toBe(1.4);
  });
});
