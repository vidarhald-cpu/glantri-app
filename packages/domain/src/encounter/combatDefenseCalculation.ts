import { z } from "zod";

const idSchema = z.string().min(1);

export const acceptedCombatDefenseContributionSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  sourceId: idSchema,
  value: z.number().int(),
});

export const acceptedCombatDefenseEquipmentSchema = z.object({
  equipmentModifier: z.number().int(),
  itemTemplateIds: z.array(idSchema),
  label: z.string().min(1),
  sourceKind: z.enum(["combined", "single", "unarmed"]),
});

export const acceptedCombatDefensePercentageTraceSchema = z.object({
  baseValue: z.number().int(),
  finalValue: z.number().int(),
  percentageAdjustment: z.number().int(),
  rawModifierTotal: z.number().int(),
  rawModifiers: z.array(
    z.object({
      label: z.string().min(1),
      value: z.number().int(),
    }),
  ),
});

const acceptedCombatDefenseCutoffSchema = z.object({
  cutoffInitiativeGroupId: idSchema.optional(),
  cutoffSequence: z.number().int().nonnegative(),
  effectiveDb: z.number().int(),
  schemaVersion: z.literal(1),
});

export const canonicalAcceptedCombatDefenseCalculationSchema =
  acceptedCombatDefenseCutoffSchema.extend({
    authority: z.literal("canonical_scenario_state"),
    baseDb: z.number().int(),
    completeness: z.literal("complete"),
    dynamicContributions: z.array(acceptedCombatDefenseContributionSchema),
    dynamicRawPercentage: z.number().int(),
    effectiveDm: z.number().int(),
    equipment: acceptedCombatDefenseEquipmentSchema,
    equipmentLoadoutRevision: z.string().min(1).optional(),
    flatContributions: z.array(acceptedCombatDefenseContributionSchema),
    flatDbAdjustment: z.number().int(),
    participantId: idSchema,
    percentageAdjustment: z.number().int(),
    percentageTrace: acceptedCombatDefensePercentageTraceSchema,
    sourceSnapshotId: idSchema,
    toHitModifier: z.number().int(),
  });

export const legacyAcceptedCombatDefenseCalculationSchema =
  acceptedCombatDefenseCutoffSchema.extend({
    authority: z.literal("legacy_combat_round_step_snapshot"),
    completeness: z.literal("legacy_incomplete"),
    sourceSnapshotId: idSchema.optional(),
  });

/** Immutable private calculation provenance recorded with one accepted attack command. */
export const acceptedCombatDefenseCalculationSchema = z.discriminatedUnion("authority", [
  canonicalAcceptedCombatDefenseCalculationSchema,
  legacyAcceptedCombatDefenseCalculationSchema,
]);
export type AcceptedCombatDefenseCalculation = z.infer<
  typeof acceptedCombatDefenseCalculationSchema
>;
