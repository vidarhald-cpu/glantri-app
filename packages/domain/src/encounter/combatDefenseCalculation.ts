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

/**
 * Which edge of the authored grid a recorded adjustment was resolved outside (#922).
 *
 * `base` and `modifier` are the edges past the grid's last authored row and column.
 * `base_below_zero` is the edge below it: the grid's first authored row is base 0, so a defence
 * below zero has no authored row at all, and the figure comes from the rule the Product Owner
 * settled in comment 20793. Mirrors `WorkbookPercentageAdjustmentAxis` in `@glantri/rules-engine`;
 * a value added there has to be added here too, or a recorded resolution carrying it stops
 * parsing.
 */
export const acceptedCombatDefenseExtrapolationAxisSchema = z.enum([
  "base",
  "base_below_zero",
  "modifier",
]);

export const acceptedCombatDefensePercentageTraceSchema = z.object({
  baseValue: z.number().int(),
  /**
   * Whether this adjustment was resolved by the open-ended rule past the edge of the authored
   * workbook grid rather than read from an authored cell (#922).
   *
   * Recorded rather than derived, and required rather than optional. The past is recorded history:
   * an extrapolated figure is part of what happened in this resolution, and the Product Owner's
   * ruling on #922 asks for every extrapolation to be flagged "so that we are sure we make the
   * right decision". A reviewer reading this record back must not have to recompute the lookup to
   * find out whether the figure came from the authored illustration or from the rule it
   * illustrates, and an absent field would read as "not extrapolated" for a record that never
   * stated it.
   */
  extrapolated: z.boolean(),
  /** The axes the adjustment ran past; empty whenever `extrapolated` is false. */
  extrapolatedAxes: z.array(acceptedCombatDefenseExtrapolationAxisSchema),
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
    /**
     * The second adjustment this defence was composed from: the same contributions without the
     * encumbrance to-hit row, which is half of the recorded `effectiveDm` (#922).
     *
     * Recorded because it is a committed figure with its own provenance. The two totals differ by
     * the to-hit contribution, so one can be read from an authored cell while the other was
     * resolved by the open-ended rule, and a record carrying only `percentageTrace` would state
     * `extrapolated: false` for a resolution half of which was extrapolated.
     */
    noToHitPercentageTrace: acceptedCombatDefensePercentageTraceSchema,
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
