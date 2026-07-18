import { z } from "zod";

import { combatDistanceSchema } from "./combatDistance";

const idSchema = z.string().min(1);

export const combatAdjustDistanceDirectionSchema = z.enum(["closer", "farther", "unchanged"]);
export type CombatAdjustDistanceDirection = z.infer<typeof combatAdjustDistanceDirectionSchema>;

export const combatAdjustDistanceDefenderResponseSchema = z.enum(["pending", "oppose", "allow"]);
export type CombatAdjustDistanceDefenderResponse = z.infer<
  typeof combatAdjustDistanceDefenderResponseSchema
>;

export const combatAdjustDistanceStatusSchema = z.enum([
  "awaiting_action_turn",
  "awaiting_defender_response",
  "awaiting_gm_adjustment",
  "awaiting_rolls",
  "awaiting_review",
  "committed",
]);
export type CombatAdjustDistanceStatus = z.infer<typeof combatAdjustDistanceStatusSchema>;

export const combatAdjustDistanceRollResultSchema = z.object({
  dodgeSkillTotal: z.number().int(),
  finalTotal: z.number().int(),
  generalFatigueModifier: z.number().int().default(0),
  id: idSchema,
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  participantId: idSchema,
  rollD20: z.number().int().min(1).max(20),
  rollTotal: z.number().int(),
  rolledAt: z.string().datetime(),
  rolledByUserId: idSchema.optional(),
  situationalAdjustment: z.number().int().min(0).max(4).default(0),
});
export type CombatAdjustDistanceRollResult = z.infer<
  typeof combatAdjustDistanceRollResultSchema
>;

export const combatAdjustDistanceProposalSchema = z.object({
  attackerParticipantId: idSchema,
  attackerRoll: combatAdjustDistanceRollResultSchema.optional(),
  attackerRollRecorded: z.boolean().default(false),
  committedAt: z.string().datetime().optional(),
  committedByUserId: idSchema.optional(),
  currentDistance: combatDistanceSchema,
  defenderParticipantId: idSchema,
  defenderResponse: combatAdjustDistanceDefenderResponseSchema.default("pending"),
  defenderRoll: combatAdjustDistanceRollResultSchema.optional(),
  defenderRollRecorded: z.boolean().default(false),
  difference: z.number().int().optional(),
  direction: combatAdjustDistanceDirectionSchema,
  gmRollAdjustment: z
    .object({
      notes: z.string().optional(),
      participantId: idSchema.optional(),
      value: z.number().int().min(0).max(4).default(0),
    })
    .optional(),
  id: idSchema,
  pairId: idSchema,
  phase1OpportunityId: idSchema,
  phase2AttackOpportunityId: idSchema,
  requestedDistance: combatDistanceSchema,
  review: z
    .object({
      acceptedOutcome: z.enum(["successful", "unsuccessful", "allowed"]),
      committedDistance: combatDistanceSchema,
      notes: z.string().optional(),
    })
    .optional(),
  roundNumber: z.number().int().positive(),
  standardOutcome: z.enum(["successful", "unsuccessful", "allowed"]).optional(),
  standardProposedDistance: combatDistanceSchema.optional(),
  status: combatAdjustDistanceStatusSchema.default("awaiting_action_turn"),
});
export type CombatAdjustDistanceProposal = z.infer<typeof combatAdjustDistanceProposalSchema>;

export function getCombatAdjustDistanceDirection(input: {
  currentDistance: number;
  requestedDistance: number;
}): CombatAdjustDistanceDirection {
  return input.requestedDistance < input.currentDistance
    ? "closer"
    : input.requestedDistance > input.currentDistance
      ? "farther"
      : "unchanged";
}

export function buildCombatAdjustDistanceProposalId(input: {
  attackerParticipantId: string;
  roundNumber: number;
}): string {
  return `combat-adjust-distance:round:${input.roundNumber}:attacker:${input.attackerParticipantId}`;
}

/** Existing opposed-distance convention: only a strictly higher attacker total wins. */
export function resolveCombatAdjustDistanceStandardProposal(input: {
  attackerTotal?: number;
  currentDistance: number;
  defenderAllowed?: boolean;
  defenderTotal?: number;
  requestedDistance: number;
}): {
  difference?: number;
  outcome: "successful" | "unsuccessful" | "allowed";
  proposedDistance: z.infer<typeof combatDistanceSchema>;
} {
  const currentDistance = combatDistanceSchema.parse(input.currentDistance);
  const requestedDistance = combatDistanceSchema.parse(input.requestedDistance);
  if (input.defenderAllowed) {
    return { outcome: "allowed", proposedDistance: requestedDistance };
  }
  if (input.attackerTotal === undefined || input.defenderTotal === undefined) {
    throw new RangeError("Both Dodge rolls are required to resolve the distance adjustment.");
  }
  const difference = input.attackerTotal - input.defenderTotal;
  return difference > 0
    ? { difference, outcome: "successful", proposedDistance: requestedDistance }
    : { difference, outcome: "unsuccessful", proposedDistance: currentDistance };
}
