import { describe, expect, it } from 'vitest';
import { formatTrainingContext } from './training-context';

describe('shared training context for the coaches', () => {
  it('tells the coaches the person is training at home and with what', () => {
    const t = formatTrainingContext({
      routine: { name: 'Full Body · Home', assignedAt: '2026-10-14T10:00:00Z', home: { sourceName: 'Full Body', equipment: ['bodyweight', 'dumbbell', 'band'] }, days: [{ label: 'Day 1', exercises: ['Goblet Squat 3×8-12'] }] },
      shortened: [{ date: '2026-10-13', note: 'fitted to 30 min. Left out: Curl.' }],
      lighterWeek: null,
    });
    expect(t).toContain('HOME VERSION of the gym routine "Full Body"');
    expect(t).toContain('body weight, dumbbells, resistance band');
    expect(t).toContain('Goblet Squat 3×8-12');
    expect(t).toContain('SHORT ON TIME');
  });
  it('says plainly when there is no routine', () => {
    expect(formatTrainingContext({ routine: null, shortened: [], lighterWeek: { startsOn: '2026-10-14', endsOn: '2026-10-20' } })).toContain('LIGHTER WEEK ACTIVE');
  });
});
