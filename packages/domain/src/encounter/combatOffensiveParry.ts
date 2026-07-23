import { z } from "zod";

const idSchema = z.string().min(1);

export const offensiveParryRollPurposeSchema = z.enum([
  "offensive_parry_brawling",
  "escape_continued_contact",
]);
export type OffensiveParryRollPurpose = z.infer<typeof offensiveParryRollPurposeSchema>;

export const offensiveParryBrawlingRollSchema = z.object({
  brawlingBaseValue: z.number().int(),
  brawlingSkillXp: z.number().int(),
  characteristicAverage: z.number().int(),
  finalTotal: z.number().int(),
  generalModifier: z.number().int(),
  id: idSchema,
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  participantId: idSchema,
  parryQualityModifier: z.number().int().default(0),
  rollD20: z.number().int().min(1).max(20),
  rollPurpose: offensiveParryRollPurposeSchema,
  rollTotal: z.number().int(),
  rolledAt: z.string().datetime(),
  rolledByUserId: idSchema.optional(),
  skillId: z.literal("brawling"),
  skillLabel: z.literal("Brawling"),
  skillModifier: z.number().int(),
});
export type OffensiveParryBrawlingRoll = z.infer<
  typeof offensiveParryBrawlingRollSchema
>;

export const offensiveParryContestSchema = z.object({
  affectedParticipantId: idSchema,
  attackResultId: idSchema,
  brawlingContestResultId: idSchema,
  controllerParticipantId: idSchema,
  declarationId: idSchema,
  id: idSchema,
  initiatorRoll: offensiveParryBrawlingRollSchema.optional(),
  initiatorRollRecorded: z.boolean().default(false),
  opportunityId: idSchema,
  parryQualityModifier: z.number().int(),
  parryQualityTableRow: z.string().min(1),
  parryResultId: idSchema,
  phase: z.enum(["phase1", "phase2"]),
  responderRoll: offensiveParryBrawlingRollSchema.optional(),
  responderRollRecorded: z.boolean().default(false),
  roundNumber: z.number().int().positive(),
  status: z.enum(["awaiting_rolls", "resolved", "cancelled"]).default("awaiting_rolls"),
  winnerParticipantId: idSchema.optional(),
});
export type OffensiveParryContest = z.infer<typeof offensiveParryContestSchema>;

export const continuedContactSchema = z.object({
  affectedParticipantId: idSchema,
  brawlingContestResultId: idSchema,
  controllerParticipantId: idSchema,
  establishedPhase: z.enum(["phase1", "phase2"]),
  establishedRound: z.number().int().positive(),
  id: idSchema,
  sourceActionId: z.literal("offensive_parry"),
  sourceAttackResultId: idSchema,
  sourceDeclarationId: idSchema,
  sourceOpportunityId: idSchema,
  sourceParryResultId: idSchema,
  status: z.enum(["active", "ended"]).default("active"),
});
export type ContinuedContact = z.infer<typeof continuedContactSchema>;

export const unbalancedCombatConditionSchema = z.object({
  affectedParticipantId: idSchema,
  establishedRound: z.number().int().positive(),
  id: idSchema,
  modifierValue: z.literal(-2),
  sourceActionId: z.literal("offensive_parry"),
  sourceContinuedContactId: idSchema,
  status: z.enum(["active", "ended"]).default("active"),
});
export type UnbalancedCombatCondition = z.infer<typeof unbalancedCombatConditionSchema>;

export function buildOffensiveParryContestId(input: {
  parryResultId: string;
}): string {
  return `${input.parryResultId}:offensive-parry:brawling`;
}

export function buildOffensiveParryContestResultId(input: {
  contestId: string;
}): string {
  return `${input.contestId}:result`;
}

export function buildContinuedContactId(input: { contestId: string }): string {
  return `${input.contestId}:continued-contact`;
}

export function buildUnbalancedConditionId(input: {
  continuedContactId: string;
}): string {
  return `${input.continuedContactId}:unbalanced`;
}

/**
 * Source: docs/rules/combat-action-rule-inventory.md, "Offensive parry brawling
 * modifier table" (combat PDF p. 7). The margin is successful parry total minus
 * the parry target number.
 */
export function resolveOffensiveParryQualityModifier(parryMargin: number): {
  modifier: number;
  tableRow: "0_to_5" | "6_to_10" | "11_to_15" | "16_plus";
} {
  if (!Number.isInteger(parryMargin) || parryMargin < 0) {
    throw new RangeError("Offensive Parry requires a non-negative successful parry margin.");
  }
  if (parryMargin <= 5) return { modifier: 0, tableRow: "0_to_5" };
  if (parryMargin <= 10) return { modifier: 1, tableRow: "6_to_10" };
  if (parryMargin <= 15) return { modifier: 2, tableRow: "11_to_15" };
  return { modifier: 4, tableRow: "16_plus" };
}

export function resolveOffensiveParryContestWinner(input: {
  controllerParticipantId: string;
  controllerTotal: number;
  responderParticipantId: string;
  responderTotal: number;
}): string | undefined {
  if (input.controllerTotal > input.responderTotal) return input.controllerParticipantId;
  if (input.responderTotal > input.controllerTotal) return input.responderParticipantId;
  return undefined;
}

export function isUnbalancedModifierExcluded(input: {
  affectedParticipantId: string;
  ownerParticipantId: string;
  rollPurpose?: string;
}): boolean {
  return (
    input.ownerParticipantId === input.affectedParticipantId &&
    input.rollPurpose === "escape_continued_contact"
  );
}
