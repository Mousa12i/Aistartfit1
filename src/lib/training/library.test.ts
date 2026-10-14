import { describe, expect, it } from 'vitest';
import { buildLibrary, type CatalogExercise, type DatasetExercise } from './library-build';
import { CORE_SLOTS, LEVEL_ORDER } from './curated';
import { NON_VOLUME_PATTERNS } from './taxonomy';
import datasetJson from '../../../data/free-exercise-db.json';
import catalogJson from '../../../data/startfit-catalog.json';

const dataset = datasetJson as unknown as DatasetExercise[];
const catalog = catalogJson as unknown as CatalogExercise[];
const { entries, byKey } = buildLibrary(dataset, catalog);
const visible = entries.filter((e) => !e.hidden);

describe('exercise library', () => {
  it('builds without unresolved references', () => {
    expect(entries.length).toBeGreaterThan(1300);
    expect(visible.length).toBeGreaterThan(1100);
  });

  it('has unique source ids and unique visible names', () => {
    expect(new Set(entries.map((e) => e.sourceId)).size).toBe(entries.length);
    const names = visible.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('hidden duplicates always point at a visible canonical exercise', () => {
    for (const e of entries.filter((x) => x.canonicalKey)) {
      const target = byKey.get(e.canonicalKey!);
      expect(target, e.name).toBeDefined();
      expect(target!.hidden, e.name).toBe(false);
    }
  });

  it('every visible strength exercise has real muscles and instructions', () => {
    for (const e of visible) {
      expect(e.instructions.length, e.name).toBeGreaterThan(0);
      if (!NON_VOLUME_PATTERNS.includes(e.profile.pattern)) {
        // rotator cuff, serratus, neck and hip-flexor work only trains small stabilisers (not counted as volume)
        expect(e.profile.primary.length + e.profile.extra.length, e.name).toBeGreaterThan(0);
      }
    }
  });

  it('never counts a muscle as both direct and indirect', () => {
    for (const e of entries) {
      const overlap = e.profile.primary.filter((m) => e.profile.secondary.includes(m));
      expect(overlap, e.name).toEqual([]);
    }
  });

  it('the curated core covers every slot with usable bodyweight-or-gym options', () => {
    for (const [slot, def] of Object.entries(CORE_SLOTS)) {
      expect(def.candidates.length, slot).toBeGreaterThanOrEqual(['carry', 'balance'].includes(slot) ? 2 : 3);
      for (const cand of def.candidates) {
        const entry = byKey.get(cand.key);
        expect(entry, `${slot}: ${cand.key}`).toBeDefined();
        expect(entry!.hidden, `${slot}: ${cand.key}`).toBe(false);
        expect(entry!.coreSlot, cand.key).toBe(slot);
        expect(LEVEL_ORDER[cand.minLevel]).toBeGreaterThanOrEqual(0);
      }
      // a person with no equipment must always have at least one option, except where the movement needs kit
      const noKit = def.candidates.some((cand) => cand.needs.some((set) => set.every((t) => t === 'bodyweight')));
      if (!['lateral_raise', 'rear_delt', 'traps', 'biceps', 'triceps', 'carry', 'horizontal_pull', 'vertical_pull', 'chest_fly', 'hip_adduction', 'hip_abduction', 'quad_isolation', 'hamstring_curl', 'incline_press', 'shoulder_press', 'lower_back'].includes(slot)) {
        expect(noKit, `${slot} has no equipment-free option`).toBe(true);
      }
    }
  });

  it('prescriptions are sane', () => {
    for (const e of visible) {
      expect(e.prescription.sets, e.name).toBeGreaterThanOrEqual(1);
      expect(e.prescription.sets, e.name).toBeLessThanOrEqual(5);
      expect(e.prescription.restSeconds, e.name).toBeLessThanOrEqual(300);
    }
  });
});
