// Turns the built exercise library into the SQL of the library migration.
// The SQL is idempotent: running it again (or on a database that already holds the
// dataset rows imported earlier) updates rows in place and never deletes anything,
// so routines, workout logs and recovery data that point at exercises keep working.

import type { RecoveryMuscle } from '@/lib/recovery/muscles';
import type { EquipTag, ExtraMuscle, MovementPattern, SafetyFlag } from './taxonomy';
import { PATTERN_LABELS, EQUIP_LABELS, SAFETY_FLAG_LABELS, EXTRA_MUSCLE_LABELS } from './taxonomy';
import { DUPLICATES } from './library-overrides';
import type { LibraryEntry } from './library-build';

const FINE_MUSCLES: RecoveryMuscle[] = [
  'upper_chest',
  'lower_chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'lats',
  'mid_back',
  'lower_back',
  'traps',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
];

function q(v: string | null | undefined): string {
  if (v === null || v === undefined) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

function arr(values: readonly string[]): string {
  if (!values.length) return "'{}'::text[]";
  return `ARRAY[${values.map(q).join(',')}]::text[]`;
}

function bool(b: boolean): string {
  return b ? 'true' : 'false';
}

function int(n: number | null): string {
  return n === null ? 'NULL' : String(Math.round(n));
}

/** Columns written for every library row, in a fixed order. */
const COLUMNS = [
  'source_id',
  'name',
  'description',
  'instructions',
  'safety_notes',
  'primary_muscle',
  'secondary_muscles',
  'equipment',
  'difficulty',
  'category',
  'force_type',
  'mechanic',
  'primary_muscles',
  'secondary_muscles_raw',
  'image_url',
  'image_urls',
  'movement_pattern',
  'exercise_type',
  'default_sets',
  'default_reps',
  'default_rest_seconds',
  'pattern',
  'muscles_primary',
  'muscles_secondary',
  'muscles_extra',
  'equipment_tags',
  'safety_flags',
  'is_unilateral',
  'is_hidden',
  'aliases',
  'core_slot',
  'core_rank',
  'taxonomy_source',
  'is_custom',
] as const;

function rowValues(e: LibraryEntry): string[] {
  const p = e.profile;
  return [
    q(e.sourceId),
    q(e.name),
    q(e.description),
    arr(e.instructions),
    q(e.safetyNotes),
    q(e.coarsePrimary),
    arr(e.coarseSecondary),
    q(e.legacyEquipment),
    q(e.difficulty),
    q(e.category),
    q(e.forceType),
    q(p.mechanic),
    e.rawPrimary ? arr(e.rawPrimary) : 'NULL',
    e.rawSecondary ? arr(e.rawSecondary) : 'NULL',
    q(e.imageUrls[0] ?? null),
    arr(e.imageUrls),
    q(p.pattern),
    q(p.mechanic ?? 'other'),
    int(e.prescription.sets),
    q(e.prescription.reps),
    int(e.prescription.restSeconds),
    q(p.pattern),
    arr(p.primary),
    arr(p.secondary),
    arr(p.extra),
    arr(p.equipment),
    arr(p.flags),
    bool(p.unilateral),
    bool(e.hidden && !e.canonicalKey),
    arr(e.aliases),
    q(e.coreSlot),
    int(e.coreRank),
    q(p.confidence === 'verified' ? 'reviewed' : 'auto'),
    'false',
  ];
}

const UPDATABLE = COLUMNS.filter((c) => c !== 'source_id' && c !== 'is_custom');

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function upsert(entries: LibraryEntry[]): string {
  return chunk(entries, 200)
    .map(
      (part) =>
        `INSERT INTO public.exercises (${COLUMNS.join(', ')}) VALUES\n` +
        part.map((e) => `(${rowValues(e).join(', ')})`).join(',\n') +
        `\nON CONFLICT (source_id) DO UPDATE SET\n  ${UPDATABLE.map((c) => `${c} = EXCLUDED.${c}`).join(',\n  ')};`,
    )
    .join('\n\n');
}

/** Catalogue rows already exist (inserted by earlier migrations without a source id): matched by name, then by source id. */
function catalogUpdates(entries: LibraryEntry[]): string {
  const sets = (e: LibraryEntry) => {
    const values = rowValues(e);
    // Catalogue rows keep their own description and instructions unless the review replaced them.
    return COLUMNS.map((c, i) => [c, values[i]] as const)
      .filter(([c]) => c !== 'is_custom' && c !== 'source_id' && c !== 'force_type' && c !== 'primary_muscles' && c !== 'secondary_muscles_raw' && c !== 'image_url' && c !== 'image_urls')
      .filter(([c]) => !(c === 'instructions' && e.instructions.length === 0))
      .filter(([c]) => !(c === 'description' && e.description === null))
      .filter(([c]) => c !== 'safety_notes')
      .map(([c, v]) => `${c} = ${v}`)
      .join(', ');
  };
  return entries
    .map((e) => {
      const original = e.key.slice(2);
      return (
        `UPDATE public.exercises SET source_id = ${q(e.sourceId)}, ${sets(e)}\n` +
        `  WHERE id = (SELECT id FROM public.exercises WHERE source_id = ${q(e.sourceId)} OR (source_id IS NULL AND is_custom = false AND name = ${q(original)})` +
        ` ORDER BY (source_id IS NOT NULL) DESC, created_at, id LIMIT 1);`
      );
    })
    .join('\n');
}

function duplicateUpdates(byKey: Map<string, LibraryEntry>): string {
  const pairs = Object.entries(DUPLICATES).map(([dup, canon]) => [byKey.get(dup)!.sourceId, byKey.get(canon)!.sourceId] as const);
  return (
    `UPDATE public.exercises h SET is_hidden = true, canonical_id = c.id\nFROM (VALUES\n` +
    pairs.map(([h, c]) => `  (${q(h)}, ${q(c)})`).join(',\n') +
    `\n) AS m(hidden_source_id, canonical_source_id)\nJOIN public.exercises c ON c.source_id = m.canonical_source_id\nWHERE h.source_id = m.hidden_source_id;`
  );
}

function checkList(values: readonly string[]): string {
  return `ARRAY[${values.map(q).join(', ')}]::text[]`;
}

export function librarySql(entries: LibraryEntry[], byKey: Map<string, LibraryEntry>, header: string): string {
  const dataset = entries.filter((e) => e.origin === 'dataset');
  const catalog = entries.filter((e) => e.origin === 'catalog');
  const additions = entries.filter((e) => e.origin === 'startfit');
  const patterns = Object.keys(PATTERN_LABELS) as MovementPattern[];
  const equipment = Object.keys(EQUIP_LABELS) as EquipTag[];
  const flags = Object.keys(SAFETY_FLAG_LABELS) as SafetyFlag[];
  const extras = Object.keys(EXTRA_MUSCLE_LABELS) as ExtraMuscle[];

  return `${header}

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS pattern text,
  ADD COLUMN IF NOT EXISTS muscles_primary text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS muscles_secondary text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS muscles_extra text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipment_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS safety_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_unilateral boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canonical_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS core_slot text,
  ADD COLUMN IF NOT EXISTS core_rank integer,
  ADD COLUMN IF NOT EXISTS taxonomy_source text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_taxonomy_valid;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_taxonomy_valid CHECK (
  (pattern IS NULL OR pattern = ANY (${checkList(patterns)}))
  AND muscles_primary <@ ${checkList(FINE_MUSCLES)}
  AND muscles_secondary <@ ${checkList(FINE_MUSCLES)}
  AND muscles_extra <@ ${checkList(extras)}
  AND equipment_tags <@ ${checkList(equipment)}
  AND safety_flags <@ ${checkList(flags)}
  AND taxonomy_source IN ('reviewed', 'auto', 'user')
  AND (core_rank IS NULL OR core_rank > 0)
  AND (canonical_id IS NULL OR canonical_id <> id)
);

CREATE INDEX IF NOT EXISTS exercises_pattern_idx ON public.exercises (pattern);
CREATE INDEX IF NOT EXISTS exercises_visible_idx ON public.exercises (is_hidden, name);
CREATE INDEX IF NOT EXISTS exercises_created_by_idx ON public.exercises (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS exercises_canonical_idx ON public.exercises (canonical_id) WHERE canonical_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Keep exercise_muscles (used by the recovery model) in step with the muscle columns.
--    Stretches and balance drills list the muscles they target but do not add training load.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_exercise_muscles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.exercise_muscles WHERE exercise_id = NEW.id;
  IF NEW.pattern IN ('mobility', 'balance') THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.exercise_muscles (exercise_id, muscle, contribution)
  SELECT NEW.id, m, 1.0 FROM unnest(NEW.muscles_primary) AS m
  ON CONFLICT (exercise_id, muscle) DO NOTHING;
  INSERT INTO public.exercise_muscles (exercise_id, muscle, contribution)
  SELECT NEW.id, m, 0.5 FROM unnest(NEW.muscles_secondary) AS m
  WHERE NOT (m = ANY (NEW.muscles_primary))
  ON CONFLICT (exercise_id, muscle) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_exercise_muscles() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS exercises_sync_muscles ON public.exercises;
CREATE TRIGGER exercises_sync_muscles
  AFTER INSERT OR UPDATE OF muscles_primary, muscles_secondary, pattern ON public.exercises
  FOR EACH ROW
  WHEN (cardinality(NEW.muscles_primary) + cardinality(NEW.muscles_secondary) > 0 OR NEW.pattern IS NOT NULL)
  EXECUTE FUNCTION public.sync_exercise_muscles();

-- ---------------------------------------------------------------------------
-- 3. Access rules. Before this, any signed-in user could edit any library exercise.
--    Library rows are read-only for users; custom exercises belong to the person who made them.
-- ---------------------------------------------------------------------------
UPDATE public.exercises e SET created_by = owner.user_id
FROM (
  SELECT l.exercise_id, min(s.user_id::text)::uuid AS user_id
  FROM public.workout_set_logs l
  JOIN public.workout_sessions s ON s.id = l.session_id
  GROUP BY l.exercise_id
  HAVING count(DISTINCT s.user_id) = 1
) AS owner
WHERE e.id = owner.exercise_id AND e.is_custom = true AND e.created_by IS NULL;

DROP POLICY IF EXISTS "read_exercises" ON public.exercises;
CREATE POLICY "read_exercises" ON public.exercises FOR SELECT
  TO anon, authenticated
  USING (is_custom = false OR created_by IS NULL OR created_by = auth.uid());

DROP POLICY IF EXISTS "insert_custom_exercises" ON public.exercises;
CREATE POLICY "insert_custom_exercises" ON public.exercises FOR INSERT
  TO authenticated
  WITH CHECK (is_custom = true AND created_by = auth.uid() AND is_hidden = false AND canonical_id IS NULL AND core_rank IS NULL AND source_id IS NULL);

DROP POLICY IF EXISTS "update_custom_exercises" ON public.exercises;
CREATE POLICY "update_custom_exercises" ON public.exercises FOR UPDATE
  TO authenticated
  USING (is_custom = true AND created_by = auth.uid())
  WITH CHECK (is_custom = true AND created_by = auth.uid() AND canonical_id IS NULL AND core_rank IS NULL AND source_id IS NULL);

DROP POLICY IF EXISTS "delete_custom_exercises" ON public.exercises;
CREATE POLICY "delete_custom_exercises" ON public.exercises FOR DELETE
  TO authenticated
  USING (is_custom = true AND created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Open dataset (free-exercise-db, public domain): ${dataset.length} exercises, inserted if missing, otherwise updated.
-- ---------------------------------------------------------------------------
${upsert(dataset)}

-- ---------------------------------------------------------------------------
-- 5. App catalogue: ${catalog.length} exercises from earlier migrations, classified and given stable source ids.
-- ---------------------------------------------------------------------------
${catalogUpdates(catalog)}

-- ---------------------------------------------------------------------------
-- 6. StartFit additions: ${additions.length} exercises the plan engine needs that neither source had.
-- ---------------------------------------------------------------------------
${upsert(additions)}

-- ---------------------------------------------------------------------------
-- 7. Duplicates: ${Object.keys(DUPLICATES).length} catalogue entries repeat another exercise. They are hidden from the
--    library (their names are search aliases of the kept exercise) but stay in the table, so
--    old routines and workout history still resolve.
-- ---------------------------------------------------------------------------
${duplicateUpdates(byKey)}
`;
}
