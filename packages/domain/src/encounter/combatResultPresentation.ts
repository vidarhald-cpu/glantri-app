import { z } from "zod";

const idSchema = z.string().min(1);

export const combatResultConsequenceValueSchema = z.union([z.boolean(), z.number(), z.string()]);
export type CombatResultConsequenceValue = z.infer<typeof combatResultConsequenceValueSchema>;

export const combatResultConsequenceSchema = z
  .object({
    affectedParticipantId: idSchema.optional(),
    key: z.string().min(1),
    label: z.string().min(1),
    unit: z.string().min(1).optional(),
    value: combatResultConsequenceValueSchema,
  })
  .strict();
export type CombatResultConsequence = z.infer<typeof combatResultConsequenceSchema>;

export const combatResultAdjustmentEntrySchema = z
  .object({
    committedValue: combatResultConsequenceValueSchema,
    consequenceKey: z.string().min(1),
    label: z.string().min(1),
    standardValue: combatResultConsequenceValueSchema,
  })
  .strict();
export type CombatResultAdjustmentEntry = z.infer<typeof combatResultAdjustmentEntrySchema>;

export const combatResultAdjustmentMetadataSchema = z
  .object({
    adjustedBy: z.literal("gm"),
    entries: z.array(combatResultAdjustmentEntrySchema).min(1),
  })
  .strict();
export type CombatResultAdjustmentMetadata = z.infer<typeof combatResultAdjustmentMetadataSchema>;

export const combatResultCalculationReferenceSchema = z
  .object({
    kind: z.enum(["calculation_snapshot", "gm_review", "roller_private"]),
    ownerParticipantId: idSchema.optional(),
    sourceId: idSchema,
    visibility: z.enum(["gm", "involved", "owner"]),
  })
  .strict();
export type CombatResultCalculationReference = z.infer<
  typeof combatResultCalculationReferenceSchema
>;

export const combatResultPrivateDiagnosticSchema = z
  .object({
    factKeys: z.array(z.string().min(1)).default([]),
    id: idSchema,
    label: z.string().min(1),
    source: z.literal("gm_review"),
  })
  .strict();
export type CombatResultPrivateDiagnostic = z.infer<typeof combatResultPrivateDiagnosticSchema>;

/**
 * Bounded presentation facts stored with an immutable combat event. These facts describe the
 * accepted result; they do not own progression, modifiers, or any other mutable combat state.
 */
export const combatResultPresentationFactsSchema = z
  .object({
    actionInstanceId: idSchema.optional(),
    adjustment: combatResultAdjustmentMetadataSchema.optional(),
    calculationReferences: z.array(combatResultCalculationReferenceSchema).default([]),
    committedConsequences: z.array(combatResultConsequenceSchema).default([]),
    conciseOutcome: z
      .object({
        details: z.array(z.string().min(1)).default([]),
        label: z.string().min(1),
      })
      .strict()
      .optional(),
    privateDiagnostics: z.array(combatResultPrivateDiagnosticSchema).default([]),
    publicCombatNote: z.string().trim().min(1).optional(),
    standardConsequences: z.array(combatResultConsequenceSchema).default([]),
    subordinateEventReferences: z.array(idSchema).default([]),
  })
  .strict();
export type CombatResultPresentationFacts = z.infer<typeof combatResultPresentationFactsSchema>;

function consequenceByKey(
  consequences: readonly CombatResultConsequence[],
): ReadonlyMap<string, CombatResultConsequence> {
  return new Map(consequences.map((consequence) => [consequence.key, consequence]));
}

/**
 * Records only actual GM changes. It is presentation comparison, not a combat rule calculation.
 */
export function buildCombatResultAdjustmentMetadata(input: {
  committedConsequences: readonly CombatResultConsequence[];
  standardConsequences: readonly CombatResultConsequence[];
}): CombatResultAdjustmentMetadata | undefined {
  const standard = consequenceByKey(input.standardConsequences);
  const entries = input.committedConsequences.flatMap((committed) => {
    const baseline = standard.get(committed.key);
    if (!baseline || Object.is(baseline.value, committed.value)) return [];
    return [
      {
        committedValue: committed.value,
        consequenceKey: committed.key,
        label: committed.label,
        standardValue: baseline.value,
      },
    ];
  });
  return entries.length
    ? combatResultAdjustmentMetadataSchema.parse({ adjustedBy: "gm", entries })
    : undefined;
}
