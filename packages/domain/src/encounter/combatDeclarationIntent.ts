import { z } from "zod";

import { combatDistanceSchema } from "./combatDistance";
import { combatItemInteractionOperationSchema } from "./combatGenericAction";

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

/**
 * Item identity carried on a secondary declaration, Forgejo issue #323 (M7).
 *
 * This is **identification only**. It names the Item, the act to perform on it and — for `pass` —
 * the recipient, exactly as the canonical Item action already names them. It carries no label, no
 * state and no visibility: every one of those is resolved server-side by
 * `CombatItemInteractionService.resolveDeclaration`, which remains the sole authority for Item
 * identity, `expectedItemRevision` staleness rejection and transaction semantics. Nothing a client
 * sends here is trusted beyond being the selection the authority is asked to resolve.
 *
 * `expectedItemRevision` is the client's read of the Item at selection time. The authority rejects
 * a stale one with `CombatItemUnavailableError`; this schema deliberately does not second-guess it.
 *
 * Scoped to secondary `small_action` by Product Owner ruling of 2026-09-25. `equip_unequip` is
 * explicitly deferred: it materializes no generic action today, so it has nowhere to carry this.
 */
export const combatDeclarationItemIntentSchema = z.object({
  expectedItemRevision: z.string().datetime(),
  itemId: idSchema,
  operation: combatItemInteractionOperationSchema,
  recipientParticipantId: idSchema.optional(),
});
export type CombatDeclarationItemIntent = z.infer<typeof combatDeclarationItemIntentSchema>;

export const combatDeclarationSecondaryIntentSchema = z.object({
  actionId: idSchema,
  description: z.string().trim().min(1).max(2000).optional(),
  item: combatDeclarationItemIntentSchema.optional(),
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
