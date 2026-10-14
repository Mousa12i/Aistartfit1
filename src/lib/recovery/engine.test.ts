import { describe, expect, it } from 'vitest';
import { computeMuscleRecovery, mapExerciseFromPersistedMuscles, type SetLogForRecovery } from './engine';

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
