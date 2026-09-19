import { z } from "zod";

import { combatDistanceSchema } from "./combatDistance";

const idSchema = z.string().min(1);

export const combatDeclarationDirectionSchema = z.enum([
  "forward",
  "forward_right",
  "right",
  "backward_right",
  "backward",
  "backward_left",
  "left",
  "forward_left",
]);
export type CombatDeclarationDirection = z.infer<typeof combatDeclarationDirectionSchema>;

export const combatDeclarationUtteranceTypeSchema = z.enum(["speak", "shout", "whisper", "other"]);
export type CombatDeclarationUtteranceType = z.infer<typeof combatDeclarationUtteranceTypeSchema>;

export const combatDeclarationPrimaryIntentSchema = z.object({
  actionId: idSchema,
  description: z.string().trim().min(1).max(2000).optional(),
  taskId: idSchema.optional(),
});
export type CombatDeclarationPrimaryIntent = z.infer<typeof combatDeclarationPrimaryIntentSchema>;

export const combatDeclarationSecondaryIntentSchema = z.object({
  actionId: idSchema,
  description: z.string().trim().min(1).max(2000).optional(),
  taskId: idSchema.optional(),
  utteranceText: z.string().trim().min(1).max(500).optional(),
  utteranceType: combatDeclarationUtteranceTypeSchema.optional(),
});
export type CombatDeclarationSecondaryIntent = z.infer<
  typeof combatDeclarationSecondaryIntentSchema
>;

export const combatDeclarationRelativePositionIntentSchema = z.discriminatedUnion("kind", [
  z.object({
    desiredDistance: combatDistanceSchema.optional(),
    kind: z.literal("keep_distance"),
    targetParticipantId: idSchema,
  }),
  z.object({
    desiredDistance: combatDistanceSchema,
    intendedSpeed: z.string().trim().min(1).max(100).optional(),
    kind: z.literal("adjust_distance"),
    targetParticipantId: idSchema,
  }),
  z.object({
    formation: z.string().trim().min(1).max(500),
    kind: z.literal("hold_formation"),
  }),
]);
export type CombatDeclarationRelativePositionIntent = z.infer<
  typeof combatDeclarationRelativePositionIntentSchema
>;

/**
 * The declaration records independent whole-round intent. Legacy executable
 * fields remain alongside this shape so old records and current mechanics can
 * continue to be read without deriving one authority from the other.
 */
export const combatDeclarationIntentSchema = z.object({
  facing: combatDeclarationDirectionSchema.optional(),
  movementDirection: combatDeclarationDirectionSchema.optional(),
  primaryAction: combatDeclarationPrimaryIntentSchema.optional(),
  relativePositions: z.array(combatDeclarationRelativePositionIntentSchema).default([]),
  secondaryAction: combatDeclarationSecondaryIntentSchema.optional(),
});
export type CombatDeclarationIntent = z.infer<typeof combatDeclarationIntentSchema>;

export function normalizeCombatDeclarationIntent(
  value: unknown,
): CombatDeclarationIntent | undefined {
  if (value === undefined || value === null) return undefined;
  return combatDeclarationIntentSchema.parse(value);
}
