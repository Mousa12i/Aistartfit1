import { describe, expect, it } from 'vitest';
import { buildContext, buildSystemPrompt, NO_EVIDENCE_TEXT, parseModelJson, planExerciseIds, sanitizeReply, searchTerms } from './coach';
import { COACH_CLAIMS } from './evidence.generated';

const ok = {
  claimIds: new Set(COACH_CLAIMS.map((c) => c.id)),
  exerciseIds: new Set(['ex-squat', 'ex-press', 'ex-row']),
  dayCount: 3,
  hasPlan: true,
  existingMemory: ['Has dumbbells up to 30 kg'],
};

describe('training coach output checks', () => {
  it('keeps blocks that cite known claims or library rows and drops the rest', () => {
    const r = sanitizeReply(
      {
        blocks: [
          { text: 'Volume matters', basis: 'evidence', claim_ids: ['vol_dose'] },
          { text: 'Invented study says 37% more', basis: 'evidence', claim_ids: ['made_up_2025'] },
          { text: 'Squats train quads and glutes', basis: 'library', exercise_ids: ['ex-squat'] },
          { text: 'Some exercise not in the library', basis: 'library', exercise_ids: ['ex-unknown'] },
          { text: 'A fact with no basis', basis: 'science' },
        ],
      },
      ok,
    );
    expect(r.blocks.map((b) => b.text)).toEqual(['Volume matters', 'Squats train quads and glutes']);
    expect(r.dropped).toBe(3);
  });

  it('answers honestly when nothing survives', () => {
    const r = sanitizeReply({ blocks: [{ text: 'x', basis: 'evidence', claim_ids: ['nope'] }] }, ok);
    expect(r.blocks).toEqual([{ text: NO_EVIDENCE_TEXT, basis: 'general', claimIds: [], exerciseIds: [] }]);
    expect(sanitizeReply(null, ok).blocks[0].text).toBe(NO_EVIDENCE_TEXT);
  });

  it('limits general talk', () => {
    const r = sanitizeReply({ blocks: [1, 2, 3].map((i) => ({ text: `hello ${i}`, basis: 'general' })) }, ok);
    expect(r.blocks.length).toBe(2);
  });

  it('validates actions strictly', () => {
    const r = sanitizeReply(
      {
        blocks: [{ text: 'Swap it', basis: 'plan' }],
        actions: [
          { type: 'swap_exercise', dayIndex: 0, exerciseId: 'ex-squat', newExerciseId: 'ex-press' },
          { type: 'swap_exercise', dayIndex: 0, exerciseId: 'ex-squat', newExerciseId: 'ex-unknown' },
          { type: 'set_sets', dayIndex: 1, exerciseId: 'ex-row', sets: 40 },
          { type: 'set_sets', dayIndex: 7, exerciseId: 'ex-row', sets: 3 },
          { type: 'set_reps', dayIndex: 1, exerciseId: 'ex-row', repsMin: 12, repsMax: 8 },
          { type: 'set_rest', dayIndex: 2, exerciseId: 'ex-row', restSeconds: 120 },
          { type: 'delete_everything', dayIndex: 0, exerciseId: 'ex-row' },
        ],
      },
      ok,
    );
    expect(r.actions).toEqual([
      { type: 'swap_exercise', dayIndex: 0, exerciseId: 'ex-squat', newExerciseId: 'ex-press' },
      { type: 'set_rest', dayIndex: 2, exerciseId: 'ex-row', restSeconds: 120 },
    ]);
  });

  it('ignores actions and plan talk when there is no plan', () => {
    const r = sanitizeReply({ blocks: [{ text: 'Your plan', basis: 'plan' }], actions: [{ type: 'set_rest', dayIndex: 0, exerciseId: 'ex-row', restSeconds: 90 }] }, { ...ok, hasPlan: false, dayCount: 0 });
    expect(r.actions).toEqual([]);
    expect(r.blocks[0].text).toBe(NO_EVIDENCE_TEXT);
  });

  it('saves only new, valid memories', () => {
    const r = sanitizeReply(
      {
        blocks: [{ text: 'Noted', basis: 'general' }],
        memory: [
          { category: 'injury', content: 'Left knee hurts on deep squats' },
          { category: 'equipment', content: 'Has dumbbells up to 30 kg' },
          { category: 'secret', content: 'x' },
        ],
      },
      ok,
    );
    expect(r.memory).toEqual([{ category: 'injury', content: 'Left knee hurts on deep squats' }]);
  });

  it('parses JSON with code fences or extra text', () => {
    expect(parseModelJson('```json\n{"blocks":[]}\n```')).toEqual({ blocks: [] });
    expect(parseModelJson('Here: {"ask":["How many days?"]} thanks')).toEqual({ ask: ['How many days?'] });
    expect(parseModelJson('not json')).toBeNull();
  });

  it('builds the prompt with every claim and the context with library rows', () => {
    const prompt = buildSystemPrompt(COACH_CLAIMS);
    for (const c of COACH_CLAIMS) expect(prompt).toContain(`[${c.id}]`);
    const ctx = buildContext({
      now: '2026-10-14',
      profile: null,
      draft: { goal: 'muscle' },
      missing: ['schedule'],
      memory: [],
      plan: null,
      history: null,
      recentSessions: [],
      checkins: [],
      pain: [],
      nutritionMode: null,
      library: [{ id: 'ex-squat', name: 'Barbell Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['adductors'], equipment: ['barbell', 'rack'], flags: ['spinal_load'], difficulty: 'beginner', steps: ['Set the bar'] }],
    });
    expect(ctx).toContain('ex-squat | Barbell Squat | squat | quads,glutes');
    expect(ctx).toContain('MISSING: schedule');
  });

  it('finds library search words and plan exercise ids', () => {
    expect(searchTerms('Is the Romanian deadlift better than leg curls for hamstrings?')).toEqual(['romanian', 'deadlift', 'better', 'than', 'leg', 'curls']);
    expect(planExerciseIds({ days: [{ exercises: [{ exerciseId: 'a', alternatives: [{ exerciseId: 'b' }] }] }] })).toEqual(['a', 'b']);
  });
});
