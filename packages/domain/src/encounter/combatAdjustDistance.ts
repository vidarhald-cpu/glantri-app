import { z } from "zod";

import { combatDistanceSchema } from "./combatDistance";
import { combatSkillContestCalculationSchema } from "./combatSkillContest";

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

export const combatAdjustDistanceResultTableRowIdSchema = z.enum([
  "defender_allows",
  "initiator_wins",
  "tie_or_opponent_wins",
]);
export type CombatAdjustDistanceResultTableRowId = z.infer<
  typeof combatAdjustDistanceResultTableRowIdSchema
>;

export interface CombatAdjustDistanceResultTableRow {
  readonly distanceResult: "current" | "requested";
  readonly id: CombatAdjustDistanceResultTableRowId;
  readonly outcome: "successful" | "unsuccessful" | "allowed";
  readonly result: string;
  readonly rollCondition: string;
}

/**
 * Canonical Adjust Distance result table. The resolver, review UI, and committed
 * result presentation consume this same structured source.
 */
export const COMBAT_ADJUST_DISTANCE_RESULT_TABLE = Object.freeze([
  Object.freeze({
    distanceResult: "requested",
    id: "defender_allows",
    outcome: "allowed",
    result: "Requested distance",
    rollCondition: "Opponent allows",
  }),
  Object.freeze({
    distanceResult: "requested",
    id: "initiator_wins",
    outcome: "successful",
    result: "Requested distance",
    rollCondition: "Initiator margin 1 or more",
  }),
  Object.freeze({
    distanceResult: "current",
    id: "tie_or_opponent_wins",
    outcome: "unsuccessful",
    result: "Current distance",
    rollCondition: "Tie or opponent wins",
  }),
] satisfies readonly CombatAdjustDistanceResultTableRow[]);

export function getCombatAdjustDistanceResultTableRowIdForOutcome(
  outcome: "successful" | "unsuccessful" | "allowed",
): CombatAdjustDistanceResultTableRowId {
  return outcome === "allowed"
    ? "defender_allows"
    : outcome === "successful"
      ? "initiator_wins"
      : "tie_or_opponent_wins";
}

export const combatAdjustDistanceAppliedModifierSchema = z.object({
  bucket: z.enum(["general_fatigue", "skill_ob"]),
  id: idSchema,
  label: z.string().min(1),
  sourceId: idSchema.optional(),
  value: z.number().int(),
});
export type CombatAdjustDistanceAppliedModifier = z.infer<
  typeof combatAdjustDistanceAppliedModifierSchema
>;

export const combatAdjustDistanceRollResultSchema = z.object({
  appliedModifiers: z.array(combatAdjustDistanceAppliedModifierSchema).optional(),
  dodgeSkillLabel: z.string().min(1).optional(),
  dodgeSkillXp: z.number().int().optional(),
  dodgeSkillTotal: z.number().int(),
  dodgeStatLabel: z.string().min(1).optional(),
  dodgeStatValue: z.number().int().optional(),
  finalTotal: z.number().int(),
  generalFatigueModifier: z.number().int().default(0),
  id: idSchema,
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  participantId: idSchema,
  rollD20: z.number().int().min(1).max(20),
  rollTotal: z.number().int(),
  rolledAt: z.string().datetime(),
  rolledByUserId: idSchema.optional(),
  // The GM's adjustment is a signed, deliberate roll input.  The rules suggest
  // a small range, but the application must not police the GM's judgment.
  situationalAdjustment: z.number().int().default(0),
  skillContestCalculation: combatSkillContestCalculationSchema.optional(),
  totalModifiers: z.number().int().optional(),
  preDieTotal: z.number().int().optional(),
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
      value: z.number().int().default(0),
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
  standardTableRowId: combatAdjustDistanceResultTableRowIdSchema.optional(),
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
  tableRowId: CombatAdjustDistanceResultTableRowId;
} {
  const currentDistance = combatDistanceSchema.parse(input.currentDistance);
  const requestedDistance = combatDistanceSchema.parse(input.requestedDistance);
  if (input.defenderAllowed) {
    const row = COMBAT_ADJUST_DISTANCE_RESULT_TABLE[0];
    return { outcome: row.outcome, proposedDistance: requestedDistance, tableRowId: row.id };
  }
  if (input.attackerTotal === undefined || input.defenderTotal === undefined) {
    throw new RangeError("Both Dodge rolls are required to resolve the distance adjustment.");
  }
  const difference = input.attackerTotal - input.defenderTotal;
  const row =
    difference > 0
      ? COMBAT_ADJUST_DISTANCE_RESULT_TABLE[1]
      : COMBAT_ADJUST_DISTANCE_RESULT_TABLE[2];
  return {
    difference,
    outcome: row.outcome,
    proposedDistance: row.distanceResult === "requested" ? requestedDistance : currentDistance,
    tableRowId: row.id,
  };
}
