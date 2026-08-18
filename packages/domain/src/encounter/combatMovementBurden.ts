import { z } from "zod";

const idSchema = z.string().min(1);

export const combatMovementModifierApplicabilitySchema = z.enum(["required", "not_applicable"]);
export type CombatMovementModifierApplicability = z.infer<
  typeof combatMovementModifierApplicabilitySchema
>;

export const combatMovementModifierManeuverSchema = z.enum([
  "adjust_distance_attack",
  "round_end_adjust_distance",
  "movement_feint",
  "weapon_feint",
  "offensive_parry_brawling",
  "continued_contact",
  "break_off",
  "observe_opponent",
  "weapon_resolution",
]);
export type CombatMovementModifierManeuver = z.infer<typeof combatMovementModifierManeuverSchema>;

export const combatMovementBurdenMissingFactSchema = z.enum([
  "characteristics",
  "equipment_state",
  "equipment_item",
  "equipment_template",
  "storage_location",
  "carrying_capacity",
  "shield",
]);
export type CombatMovementBurdenMissingFact = z.infer<typeof combatMovementBurdenMissingFactSchema>;

export const combatMovementBurdenSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  participantId: idSchema,
  sourceSnapshotId: idSchema,
  equipmentLoadoutRevision: z.string().min(1).optional(),
  carriedItems: z
    .array(
      z.object({
        effectiveEncumbrance: z.number().nonnegative(),
        itemId: idSchema,
        templateId: idSchema,
      }),
    )
    .default([]),
  totalEffectiveCarriedEncumbrance: z.number().nonnegative().optional(),
  carryingCapacityInputs: z
    .object({
      constitution: z.number(),
      size: z.number(),
      strength: z.number(),
    })
    .optional(),
  carryingCapacity: z.number().int().positive().optional(),
  carriedPercentage: z.number().int().nonnegative().optional(),
  encumbranceLevel: z.number().int().nonnegative().optional(),
  shield: z
    .object({
      itemId: idSchema,
      label: z.string().min(1),
      movementContribution: z.number().int().nonnegative(),
      templateId: idSchema,
    })
    .optional(),
  shieldMovementContribution: z.number().int().nonnegative().optional(),
  finalMovementModifier: z.number().int().nonnegative().optional(),
  completeness: z.enum(["complete", "partial"]),
  missingFacts: z.array(combatMovementBurdenMissingFactSchema).default([]),
  visibility: z.literal("owner_and_gm").default("owner_and_gm"),
  provenance: z.object({
    carriedLoadSource: z.literal("scenario_equipment_snapshot"),
    formula: z.literal("themistogenes_movement_modifier_v1"),
    sourceRange: z.literal("Calculations!L39:S42"),
    workbook: z.literal("Themistogenes 1.07.xlsx"),
  }),
});
export type CombatMovementBurdenSnapshot = z.infer<typeof combatMovementBurdenSnapshotSchema>;
