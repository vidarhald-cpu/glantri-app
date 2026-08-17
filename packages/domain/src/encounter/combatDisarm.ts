import { z } from "zod";

import { combatSkillContestCalculationSchema } from "./combatSkillContest";

const idSchema = z.string().min(1);

export const combatDisarmMethodSchema = z.enum(["reactive_parry", "proactive"]);
export type CombatDisarmMethod = z.infer<typeof combatDisarmMethodSchema>;

export const combatDisarmWeaponSnapshotSchema = z.object({
  capability: z.enum(["none", "trap"]),
  controlRating: z.number().int().min(1).max(6),
  itemId: idSchema,
  itemRevision: z.string().datetime(),
  label: z.string().min(1),
  parryModifier: z.number().int(),
  templateId: idSchema,
});
export type CombatDisarmWeaponSnapshot = z.infer<typeof combatDisarmWeaponSnapshotSchema>;

export const combatDisarmDeclarationSchema = z.object({
  actingWeapon: combatDisarmWeaponSnapshotSchema.extend({ capability: z.literal("trap") }),
  method: combatDisarmMethodSchema,
  phase: z.enum(["phase1", "phase2"]),
  targetParticipantId: idSchema,
  targetWeapon: combatDisarmWeaponSnapshotSchema,
});
export type CombatDisarmDeclaration = z.infer<typeof combatDisarmDeclarationSchema>;

export const combatDisarmSkillChoiceSchema = z.enum(["weapon_skill", "parry"]);
export type CombatDisarmSkillChoice = z.infer<typeof combatDisarmSkillChoiceSchema>;

export const combatDisarmCharacteristicChoiceSchema = z.enum(["strength", "dexterity"]);
export type CombatDisarmCharacteristicChoice = z.infer<
  typeof combatDisarmCharacteristicChoiceSchema
>;

export const combatDisarmResultBandSchema = z.enum([
  "no_effect",
  "unbalanced",
  "disarmed",
  "disarmed_unbalanced",
]);
export type CombatDisarmResultBand = z.infer<typeof combatDisarmResultBandSchema>;

export interface CombatDisarmResultTableRow {
  readonly disarmed: boolean;
  readonly id: CombatDisarmResultBand;
  readonly label: string;
  readonly maximum?: number;
  readonly minimum?: number;
  readonly unbalanced: boolean;
}

/** Source: combat PDF p. 8, difference in the disarming character's favour. */
export const COMBAT_DISARM_RESULT_TABLE: readonly CombatDisarmResultTableRow[] = Object.freeze([
  Object.freeze({
    disarmed: false,
    id: "no_effect" as const,
    label: "No effect",
    maximum: 5,
    unbalanced: false,
  }),
  Object.freeze({
    disarmed: false,
    id: "unbalanced" as const,
    label: "Unbalanced (1 round)",
    maximum: 10,
    minimum: 6,
    unbalanced: true,
  }),
  Object.freeze({
    disarmed: true,
    id: "disarmed" as const,
    label: "Disarmed",
    maximum: 15,
    minimum: 11,
    unbalanced: false,
  }),
  Object.freeze({
    disarmed: true,
    id: "disarmed_unbalanced" as const,
    label: "Disarmed and Unbalanced (1 round)",
    minimum: 16,
    unbalanced: true,
  }),
]);

export function resolveCombatDisarmResult(difference: number): CombatDisarmResultTableRow {
  if (!Number.isInteger(difference)) throw new RangeError("Disarm difference must be an integer.");
  // A holder win or tie cannot produce an effect; the printed first band starts at zero.
  if (difference <= 5) return COMBAT_DISARM_RESULT_TABLE[0]!;
  const row = COMBAT_DISARM_RESULT_TABLE.find(
    (candidate) =>
      (candidate.minimum === undefined || difference >= candidate.minimum) &&
      (candidate.maximum === undefined || difference <= candidate.maximum),
  );
  if (!row) throw new RangeError("Disarm result is outside the canonical table.");
  return row;
}

export function resolveCombatDisarmContactQualityModifier(parryMargin: number): {
  modifier: 0 | 1 | 2 | 4;
  tableRow: "0_to_5" | "6_to_10" | "11_to_15" | "16_plus";
} {
  if (!Number.isInteger(parryMargin) || parryMargin < 0) {
    throw new RangeError("Disarm contact quality requires a successful non-negative margin.");
  }
  if (parryMargin <= 5) return { modifier: 0, tableRow: "0_to_5" };
  if (parryMargin <= 10) return { modifier: 1, tableRow: "6_to_10" };
  if (parryMargin <= 15) return { modifier: 2, tableRow: "11_to_15" };
  return { modifier: 4, tableRow: "16_plus" };
}

export type CombatDisarmContactGate =
  | {
      method: "reactive_parry";
      incomingAttackResultId?: string;
      prepared: boolean;
      successfulParryMargin?: number;
    }
  | {
      activeContinuedContact: boolean;
      attackHit: boolean;
      method: "proactive";
    };

export function evaluateCombatDisarmContactGate(input: CombatDisarmContactGate): {
  contactQualityModifier: 0 | 1 | 2 | 4;
  eligible: boolean;
  reason?: "not_prepared" | "no_incoming_attack" | "parry_failed" | "proactive_attack_missed";
} {
  if (input.method === "reactive_parry") {
    if (!input.prepared)
      return { contactQualityModifier: 0, eligible: false, reason: "not_prepared" };
    if (!input.incomingAttackResultId) {
      return { contactQualityModifier: 0, eligible: false, reason: "no_incoming_attack" };
    }
    if (input.successfulParryMargin === undefined || input.successfulParryMargin < 0) {
      return { contactQualityModifier: 0, eligible: false, reason: "parry_failed" };
    }
    return {
      contactQualityModifier: resolveCombatDisarmContactQualityModifier(input.successfulParryMargin)
        .modifier,
      eligible: true,
    };
  }
  return input.attackHit || input.activeContinuedContact
    ? { contactQualityModifier: 0, eligible: true }
    : { contactQualityModifier: 0, eligible: false, reason: "proactive_attack_missed" };
}

export const combatDisarmRollSchema = z.object({
  calculation: combatSkillContestCalculationSchema,
  characteristicChoice: combatDisarmCharacteristicChoiceSchema,
  finalTotal: z.number().int(),
  id: idSchema,
  participantId: idSchema,
  rolledAt: z.string().datetime(),
  rolledByUserId: idSchema.optional(),
  skillChoice: combatDisarmSkillChoiceSchema,
});
export type CombatDisarmRoll = z.infer<typeof combatDisarmRollSchema>;

export const combatDisarmAttemptSchema = z.object({
  actingParticipantId: idSchema,
  actingRoll: combatDisarmRollSchema.optional(),
  actingWeaponItemId: idSchema,
  actingWeaponTemplateId: idSchema,
  attackResultId: idSchema.optional(),
  contactQualityModifier: z.number().int().min(0).max(4).default(0),
  continuedContactId: idSchema.optional(),
  difference: z.number().int().optional(),
  disarmCapability: z.literal("trap"),
  id: idSchema,
  method: combatDisarmMethodSchema,
  parryResultId: idSchema.optional(),
  phase: z.enum(["phase1", "phase2"]),
  resistingParticipantId: idSchema,
  resistingRoll: combatDisarmRollSchema.optional(),
  result: z
    .object({
      disarmed: z.boolean(),
      tableRowId: combatDisarmResultBandSchema,
      unbalanced: z.boolean(),
    })
    .optional(),
  roundNumber: z.number().int().positive(),
  status: z.enum([
    "awaiting_contact",
    "awaiting_rolls",
    "awaiting_commit",
    "committed",
    "cancelled",
  ]),
  targetWeaponItemId: idSchema,
  targetWeaponItemRevision: z.string().datetime(),
  targetWeaponTemplateId: idSchema,
});
export type CombatDisarmAttempt = z.infer<typeof combatDisarmAttemptSchema>;

export const combatDisarmUnbalancedConditionSchema = z.object({
  affectedParticipantId: idSchema,
  establishedRound: z.number().int().positive(),
  expiresAfterRound: z.number().int().positive(),
  id: idSchema,
  modifierValue: z.literal(-2),
  sourceActionId: z.enum(["disarm", "parry_disarm"]),
  sourceDisarmAttemptId: idSchema,
  status: z.enum(["active", "ended"]).default("active"),
});
export type CombatDisarmUnbalancedCondition = z.infer<typeof combatDisarmUnbalancedConditionSchema>;

export function buildCombatDisarmAttemptId(input: {
  actingParticipantId: string;
  phase: "phase1" | "phase2";
  roundNumber: number;
  targetWeaponItemId: string;
}): string {
  return `disarm:round:${input.roundNumber}:${input.phase}:actor:${input.actingParticipantId}:item:${input.targetWeaponItemId}`;
}

export function buildCombatDisarmUnbalancedConditionId(input: {
  attemptId: string;
  affectedParticipantId: string;
}): string {
  return `${input.attemptId}:unbalanced:${input.affectedParticipantId}`;
}

export function resolveCombatDisarmAttempt(input: { actingTotal: number; resistingTotal: number }) {
  const difference = input.actingTotal - input.resistingTotal;
  const row = resolveCombatDisarmResult(difference);
  return {
    difference,
    result: {
      disarmed: row.disarmed,
      tableRowId: row.id,
      unbalanced: row.unbalanced,
    },
  } as const;
}
