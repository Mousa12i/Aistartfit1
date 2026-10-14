import { z } from 'zod';
import rulesJson from './recovery-rules.json';
import catalogJson from './muscle-catalog.json';

const exerciseMappingSchema = z.object({ primary: z.array(z.string()), secondary: z.array(z.string()) });
const muscleSchema = z.object({
  id: z.string(),
  label: z.string(),
  region: z.string(),
  views: z.array(z.enum(['front', 'back'])),
  anatomyAssetRegionIds: z.array(z.string()),
  drawnOnMap: z.boolean(),
  exerciseMapping: exerciseMappingSchema,
  recoveryModel: z.object({ defaultRecoveryHours: z.number().nullable(), evidenceStatus: z.string(), requiresWorkoutHistory: z.boolean() }),
});
const catalogSchema = z.object({ schemaVersion: z.number(), muscles: z.array(muscleSchema) });
const rulesSchema = z.object({ schemaVersion: z.number(), inputLimits: z.record(z.string(), z.record(z.string(), z.number())), readiness: z.object({ numericScore: z.literal(false), disclaimer: z.string(), independentInputs: z.array(z.string()), evaluationOrder: z.array(z.object({ id: z.string(), output: z.string(), when: z.string() })), uiLabels: z.record(z.string(), z.string()), forbiddenLabels: z.array(z.string()), mustDisplay: z.array(z.string()) }), hrv: z.record(z.string(), z.unknown()), restingHr: z.record(z.string(), z.unknown()), sleep: z.record(z.string(), z.unknown()), trainingLoad: z.record(z.string(), z.unknown()), nutrition: z.record(z.string(), z.unknown()), muscleStates: z.record(z.string(), z.unknown()) });

export type RecoveryCatalogMuscle = z.infer<typeof muscleSchema>;
export type RecoveryRules = z.infer<typeof rulesSchema>;

export function loadRecoveryData(exerciseIds: Iterable<string>, assetRegionIds: Iterable<string>): { rules: RecoveryRules; muscles: RecoveryCatalogMuscle[] } {
  const rules = rulesSchema.parse(rulesJson);
  const { muscles } = catalogSchema.parse(catalogJson);
  const ids = new Set<string>();
  for (const muscle of muscles) {
    if (ids.has(muscle.id)) throw new Error(`Duplicate recovery muscle ID: ${muscle.id}`);
    ids.add(muscle.id);
  }
  const exercises = new Set(exerciseIds);
  const regions = new Set(assetRegionIds);
  for (const muscle of muscles) {
    for (const exerciseId of [...muscle.exerciseMapping.primary, ...muscle.exerciseMapping.secondary]) {
      if (!exercises.has(exerciseId)) throw new Error(`Unknown recovery exercise ID: ${exerciseId}`);
    }
    for (const region of muscle.anatomyAssetRegionIds) {
      if (!regions.has(region)) throw new Error(`Unknown anatomy asset region: ${region}`);
    }
  }
  return { rules, muscles };
}

export function getBundledRecoveryData(): { rules: RecoveryRules; muscles: RecoveryCatalogMuscle[] } {
  return loadRecoveryData(
    new Set([...muscleCatalogExerciseIds]),
    new Set([...muscleCatalogAssetRegions]),
  );
}

const muscleCatalogExerciseIds = new Set([
  '732c41cd-a29f-4a6a-8bb5-4d68133ef241', '79ee3156-6088-437d-96f1-c686ed22eb95', '6386036f-ff41-43ef-ad32-4e6d84b40a44',
  'b91c8f18-e506-4f4a-9883-e508aae9fb0f', 'b4bba031-26e0-4a22-bd27-44bc4a7e7fbb', '5998aebf-d1e6-4a6c-a530-0c9ef9af4c4d',
  '31c594c3-915b-4b0b-b640-fa9caa96490d', 'd95156ae-f3b6-43ef-ad70-c770125a4621',
]);
const muscleCatalogAssetRegions = new Set(['chest', 'front-deltoids', 'back-deltoids', 'biceps', 'triceps', 'forearm', 'abs', 'obliques', 'trapezius', 'upper-back', 'lower-back', 'gluteal', 'quadriceps', 'hamstring', 'adductor', 'calves']);
