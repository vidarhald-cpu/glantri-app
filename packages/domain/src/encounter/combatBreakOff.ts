import { z } from "zod";

import { combatSkillContestCalculationSchema } from "./combatSkillContest";

const idSchema = z.string().min(1);

export const combatEngagementStatusSchema = z.enum(["engaged", "disengaged"]);
export type CombatEngagementStatus = z.infer<typeof combatEngagementStatusSchema>;

export const combatEngagementSchema = z.object({
  changedAt: z.string().datetime().optional(),
  changedByCommandId: idSchema.optional(),
  participantAId: idSchema,
  participantBId: idSchema,
  pairKey: idSchema,
  reason: z.enum(["break_off", "movement_reengagement", "gm_adjudication"]).optional(),
  sourceProposalId: idSchema.optional(),
  status: combatEngagementStatusSchema.default("engaged"),
});
export type CombatEngagement = z.infer<typeof combatEngagementSchema>;

export const combatBreakOffTableRowIdSchema = z.enum([
  "defender_minus_21_or_less",
  "defender_minus_16_to_minus_20",
  "defender_minus_11_to_minus_15",
  "defender_minus_10_to_0",
  "defender_1_to_5",
  "defender_6_to_10",
  "defender_11_to_15",
  "defender_16_to_20",
  "defender_21_or_more",
]);
export type CombatBreakOffTableRowId = z.infer<typeof combatBreakOffTableRowIdSchema>;

export interface CombatBreakOffTableRow {
  readonly attackerObModifier: number;
  readonly defenderDbParryModifier: number;
  readonly escaped: boolean;
  readonly id: CombatBreakOffTableRowId;
  readonly label: string;
  readonly maximum?: number;
  readonly minimum?: number;
}

/**
 * Canonical Avbryt nærkamp table, source PDF pp. 9–10. Difference is the
 * escapee/defender Dodge result minus the engaging attacker Dodge result.
 * Values are raw percentage modifiers consumed by the workbook adjustment.
 */
export const COMBAT_BREAK_OFF_RESULT_TABLE: readonly CombatBreakOffTableRow[] = Object.freeze([
  Object.freeze({
    attackerObModifier: 0,
    defenderDbParryModifier: -4,
    escaped: false,
    id: "defender_minus_21_or_less",
    label: "Attack continues; escapee DB/Parry −4%",
    maximum: -21,
  }),
  Object.freeze({
    attackerObModifier: 0,
    defenderDbParryModifier: -3,
    escaped: false,
    id: "defender_minus_16_to_minus_20",
    label: "Attack continues; escapee DB/Parry −3%",
    maximum: -16,
    minimum: -20,
  }),
  Object.freeze({
    attackerObModifier: 0,
    defenderDbParryModifier: -2,
    escaped: false,
    id: "defender_minus_11_to_minus_15",
    label: "Attack continues; escapee DB/Parry −2%",
    maximum: -11,
    minimum: -15,
  }),
  Object.freeze({
    attackerObModifier: 0,
    defenderDbParryModifier: 0,
    escaped: false,
    id: "defender_minus_10_to_0",
    label: "Attack continues",
    maximum: 0,
    minimum: -10,
  }),
  Object.freeze({
    attackerObModifier: 0,
    defenderDbParryModifier: 0,
    escaped: true,
    id: "defender_1_to_5",
    label: "Escapee breaks off",
    maximum: 5,
    minimum: 1,
  }),
  Object.freeze({
    attackerObModifier: -1,
    defenderDbParryModifier: 0,
    escaped: true,
    id: "defender_6_to_10",
    label: "Escapee breaks off; attacker OB −1%",
    maximum: 10,
    minimum: 6,
  }),
  Object.freeze({
    attackerObModifier: -2,
    defenderDbParryModifier: 0,
    escaped: true,
    id: "defender_11_to_15",
    label: "Escapee breaks off; attacker OB −2%",
    maximum: 15,
    minimum: 11,
  }),
  Object.freeze({
    attackerObModifier: -3,
    defenderDbParryModifier: 0,
    escaped: true,
    id: "defender_16_to_20",
    label: "Escapee breaks off; attacker OB −3%",
    maximum: 20,
    minimum: 16,
  }),
  Object.freeze({
    attackerObModifier: -4,
    defenderDbParryModifier: 0,
    escaped: true,
    id: "defender_21_or_more",
    label: "Escapee breaks off; attacker OB −4%",
    minimum: 21,
  }),
]);

export function resolveCombatBreakOffTable(difference: number): CombatBreakOffTableRow {
  if (!Number.isInteger(difference))
    throw new RangeError("Break Off difference must be an integer.");
  const row = COMBAT_BREAK_OFF_RESULT_TABLE.find(
    (candidate) =>
      (candidate.minimum === undefined || difference >= candidate.minimum) &&
      (candidate.maximum === undefined || difference <= candidate.maximum),
  );
  if (!row) throw new RangeError("Break Off result is outside the canonical table.");
  return row;
}

export const combatBreakOffRollSchema = z.object({
  calculation: combatSkillContestCalculationSchema,
  finalTotal: z.number().int(),
  id: idSchema,
  participantId: idSchema,
  rolledAt: z.string().datetime(),
  rolledByUserId: idSchema.optional(),
});
export type CombatBreakOffRoll = z.infer<typeof combatBreakOffRollSchema>;

export const combatBreakOffProposalSchema = z.object({
  attackerParticipantId: idSchema,
  attackerRoll: combatBreakOffRollSchema.optional(),
  committedAt: z.string().datetime().optional(),
  committedByUserId: idSchema.optional(),
  difference: z.number().int().optional(),
  escapeeParticipantId: idSchema,
  escapeeRoll: combatBreakOffRollSchema.optional(),
  gmReview: z
    .object({
      attackerAdjustment: z.number().int().default(0),
      escapeeAdjustment: z.number().int().default(0),
      notes: z.string().max(500).optional(),
    })
    .optional(),
  id: idSchema,
  intentNote: z.string().max(500).optional(),
  pairKey: idSchema,
  result: z
    .object({
      attackerObModifier: z.number().int().min(-4).max(0),
      defenderDbParryModifier: z.number().int().min(-4).max(0),
      escaped: z.boolean(),
      tableRowId: combatBreakOffTableRowIdSchema,
    })
    .optional(),
  roundNumber: z.number().int().positive(),
  status: z
    .enum([
      "awaiting_action_turn",
      "awaiting_gm_review",
      "awaiting_rolls",
      "awaiting_commit",
      "committed",
    ])
    .default("awaiting_action_turn"),
});
export type CombatBreakOffProposal = z.infer<typeof combatBreakOffProposalSchema>;

export function buildCombatBreakOffProposalId(input: {
  attackerParticipantId: string;
  escapeeParticipantId: string;
  roundNumber: number;
}): string {
  return `break-off:round:${input.roundNumber}:escapee:${input.escapeeParticipantId}:attacker:${input.attackerParticipantId}`;
}

export function resolveCombatBreakOffProposal(input: {
  attackerTotal: number;
  escapeeTotal: number;
}) {
  const difference = input.escapeeTotal - input.attackerTotal;
  const row = resolveCombatBreakOffTable(difference);
  return {
    difference,
    result: {
      attackerObModifier: row.attackerObModifier,
      defenderDbParryModifier: row.defenderDbParryModifier,
      escaped: row.escaped,
      tableRowId: row.id,
    },
  } as const;
}
