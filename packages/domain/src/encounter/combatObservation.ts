import { z } from "zod";

import { rollOpenEndedD20, type OpenEndedD20Roll } from "../dice/openEndedD20";
import type {
  CombatModifierContribution,
  CombatModifierContributionBucket,
} from "./combatModifierContributions";
import type {
  CombatSkillContestPercentageContribution,
  CombatSkillContestRole,
  CombatSkillContestType,
} from "./combatSkillContest";

const idSchema = z.string().min(1);

export const combatObservationAppliedModifierSchema = z.object({
  bucket: z.enum(["general_fatigue", "skill_ob"]),
  label: z.string().min(1),
  sourceId: idSchema.optional(),
  value: z.number().int(),
});
export type CombatObservationAppliedModifier = z.infer<
  typeof combatObservationAppliedModifierSchema
>;

export const combatObservationRollBasisSchema = z.object({
  appliedModifiers: z.array(combatObservationAppliedModifierSchema).default([]),
  baseValue: z.number().int(),
  effectiveSkillValue: z.number().int().optional(),
  intelligenceValue: z.number().int().default(0),
  intelligenceXp: z.number().int().default(0),
  percentageAdjustment: z.number().int().default(0),
  percentageModifierTotal: z.number().int().default(0),
  skillId: idSchema,
  skillLabel: z.string().min(1),
  skillXp: z.number().int().default(0),
});
export type CombatObservationRollBasis = z.input<typeof combatObservationRollBasisSchema>;

export const combatObservationRollSchema = z.object({
  appliedModifiers: z.array(combatObservationAppliedModifierSchema).default([]),
  baseValue: z.number().int(),
  effectiveSkillValue: z.number().int().optional(),
  finalTotal: z.number().int(),
  intelligenceValue: z.number().int().default(0),
  intelligenceXp: z.number().int().default(0),
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  percentageAdjustment: z.number().int().default(0),
  percentageModifierTotal: z.number().int().default(0),
  rollD20: z.number().int().min(1).max(20),
  rollTotal: z.number().int(),
  skillId: idSchema,
  skillLabel: z.string().min(1),
  skillXp: z.number().int().default(0),
});
export type CombatObservationRoll = z.infer<typeof combatObservationRollSchema>;

export const combatObservationAttemptSchema = z.object({
  bestBonusAfter: z.number().int().min(0).max(3),
  candidateBonus: z.number().int().min(0).max(3),
  completedAttemptNumber: z.number().int().positive(),
  completedAt: z.string().datetime(),
  completedAtRevision: z.string().min(1),
  difference: z.number().int(),
  id: idSchema,
  observerRoll: combatObservationRollSchema,
  requiredQualifyingRounds: z.number().int().positive(),
  roundNumber: z.number().int().positive(),
  targetRoll: combatObservationRollSchema.optional(),
});
export type CombatObservationAttempt = z.infer<typeof combatObservationAttemptSchema>;

export const combatObservationRelationshipSchema = z.object({
  bestBonus: z.number().int().min(0).max(3).default(0),
  completedAttempts: z.number().int().nonnegative().default(0),
  id: idSchema,
  lastAttempt: combatObservationAttemptSchema.optional(),
  lastCompletedAttemptRevision: z.string().min(1).optional(),
  observerParticipantId: idSchema,
  roundsTowardNextAttempt: z.number().int().nonnegative().default(0),
  targetParticipantId: idSchema,
});
export type CombatObservationRelationship = z.infer<
  typeof combatObservationRelationshipSchema
>;

export const combatObservationRoundUndoFactSchema = z.object({
  previousRelationship: combatObservationRelationshipSchema.optional(),
  relationshipId: idSchema,
});
export type CombatObservationRoundUndoFact = z.infer<
  typeof combatObservationRoundUndoFactSchema
>;

export function buildCombatObservationRelationshipId(input: {
  observerParticipantId: string;
  targetParticipantId: string;
}): string {
  return `observation:${encodeURIComponent(input.observerParticipantId)}:${encodeURIComponent(
    input.targetParticipantId,
  )}`;
}

export function getCombatObservationRequiredRounds(completedAttempts: number): number {
  if (!Number.isInteger(completedAttempts) || completedAttempts < 0) {
    throw new RangeError("Completed observation attempts must be a non-negative integer.");
  }
  return completedAttempts === 0 ? 3 : completedAttempts === 1 ? 6 : 10;
}

export function resolveCombatObservationCandidateBonus(difference: number): 0 | 1 | 2 | 3 {
  if (!Number.isInteger(difference)) {
    throw new RangeError("Observation difference must be an integer.");
  }
  if (difference <= 0) return 0;
  if (difference <= 5) return 0;
  if (difference <= 10) return 1;
  if (difference <= 15) return 2;
  return 3;
}

function toObservationRoll(
  basis: CombatObservationRollBasis,
  roll: OpenEndedD20Roll,
): CombatObservationRoll {
  const normalized = combatObservationRollBasisSchema.parse(basis);
  return combatObservationRollSchema.parse({
    appliedModifiers: normalized.appliedModifiers,
    baseValue: normalized.baseValue,
    effectiveSkillValue: normalized.effectiveSkillValue ?? normalized.baseValue,
    finalTotal: (normalized.effectiveSkillValue ?? normalized.baseValue) + roll.dieResult,
    intelligenceValue: normalized.intelligenceValue,
    intelligenceXp: normalized.intelligenceXp,
    openEndedD10s: roll.openEndedD10s,
    percentageAdjustment: normalized.percentageAdjustment,
    percentageModifierTotal: normalized.percentageModifierTotal,
    rollD20: roll.rollD20,
    rollTotal: roll.dieResult,
    skillId: normalized.skillId,
    skillLabel: normalized.skillLabel,
    skillXp: normalized.skillXp,
  });
}

export function resolveCombatObservationAttempt(input: {
  completedAt: string;
  completedAtRevision: string;
  observerBasis: CombatObservationRollBasis;
  observerParticipantId: string;
  previousRelationship?: CombatObservationRelationship;
  rng?: () => number;
  roundNumber: number;
  targetBasis: CombatObservationRollBasis;
  targetParticipantId: string;
}): CombatObservationRelationship {
  const relationship =
    input.previousRelationship ??
    combatObservationRelationshipSchema.parse({
      id: buildCombatObservationRelationshipId(input),
      observerParticipantId: input.observerParticipantId,
      targetParticipantId: input.targetParticipantId,
    });
  const requiredQualifyingRounds = getCombatObservationRequiredRounds(
    relationship.completedAttempts,
  );
  const observerRoll = toObservationRoll(
    input.observerBasis,
    rollOpenEndedD20(input.rng),
  );
  const targetRoll = toObservationRoll(input.targetBasis, rollOpenEndedD20(input.rng));
  const difference = observerRoll.finalTotal - targetRoll.finalTotal;
  const candidateBonus = resolveCombatObservationCandidateBonus(difference);
  const bestBonusAfter = Math.max(relationship.bestBonus, candidateBonus);
  const completedAttemptNumber = relationship.completedAttempts + 1;
  const attempt = combatObservationAttemptSchema.parse({
    bestBonusAfter,
    candidateBonus,
    completedAttemptNumber,
    completedAt: input.completedAt,
    completedAtRevision: input.completedAtRevision,
    difference,
    id: `${relationship.id}:attempt:${completedAttemptNumber}`,
    observerRoll,
    requiredQualifyingRounds,
    roundNumber: input.roundNumber,
    targetRoll,
  });

  return combatObservationRelationshipSchema.parse({
    ...relationship,
    bestBonus: bestBonusAfter,
    completedAttempts: completedAttemptNumber,
    lastAttempt: attempt,
    lastCompletedAttemptRevision: input.completedAtRevision,
    roundsTowardNextAttempt: 0,
  });
}

export function buildCombatObservationModifierContributions(input: {
  encounterId?: string;
  observerCombatantId: string;
  observerParticipantId: string;
  opponentCombatantId: string;
  opponentParticipantId: string;
  relationships: readonly CombatObservationRelationship[];
}): CombatModifierContribution[] {
  const relationship = input.relationships.find(
    (entry) =>
      entry.observerParticipantId === input.observerCombatantId &&
      entry.targetParticipantId === input.opponentCombatantId &&
      entry.bestBonus > 0,
  );
  if (!relationship) return [];

  const makeContribution = (
    bucket: Extract<CombatModifierContributionBucket, "skill_ob" | "db_parry">,
  ): CombatModifierContribution => ({
    applicability: {
      opponentParticipantId: input.opponentParticipantId,
      participantId: input.observerParticipantId,
    },
    bucket,
    editPolicy: "source_only",
    id: `${relationship.id}:modifier:${bucket}`,
    label: "Observe Opponent",
    lifetime: {
      kind: "encounter",
      status: "active",
    },
    notes: `Observed opponent: ${input.opponentParticipantId}`,
    ownerParticipantId: input.observerParticipantId,
    readOnly: true,
    schemaVersion: 1,
    sourceEncounterId: input.encounterId,
    sourceId: relationship.id,
    sourceKind: "system_derived",
    value: relationship.bestBonus,
  });

  return [makeContribution("skill_ob"), makeContribution("db_parry")];
}

/**
 * Resolves the single relationship contribution permitted in a Skill Contest.
 * Weapon Resolution's Skill/OB and DB/Parry rows must never both flow into one
 * skill roll.
 */
export function buildCombatObservationSkillContestContribution(input: {
  contestType: CombatSkillContestType;
  observerCombatantId: string;
  opponentCombatantId: string;
  relationships: readonly CombatObservationRelationship[];
  role: CombatSkillContestRole;
}): CombatSkillContestPercentageContribution | undefined {
  if (
    input.role !== "resisting_opponent" ||
    !["adjust_distance_attack", "round_end_adjust_distance"].includes(input.contestType)
  ) {
    return undefined;
  }

  const relationship = input.relationships.find(
    (entry) =>
      entry.observerParticipantId === input.observerCombatantId &&
      entry.targetParticipantId === input.opponentCombatantId &&
      entry.bestBonus > 0,
  );
  if (!relationship) return undefined;

  return {
    category: "relationship",
    id: `${relationship.id}:skill-contest:defensive-maneuver`,
    label: "Observe Opponent",
    provenance: "Ordered observer-to-target relationship",
    sourceId: relationship.id,
    unit: "percentage",
    value: relationship.bestBonus,
  };
}

/** Player-safe read model: observer-owned status and own contest facts; target calculation stays GM-only. */
export function buildPlayerSafeCombatObservationRelationships(input: {
  controlledParticipantIds: ReadonlySet<string>;
  relationships: readonly CombatObservationRelationship[];
}): CombatObservationRelationship[] {
  return input.relationships
    .filter((relationship) =>
      input.controlledParticipantIds.has(relationship.observerParticipantId),
    )
    .map((relationship) =>
      combatObservationRelationshipSchema.parse({
        ...relationship,
        lastAttempt: relationship.lastAttempt
          ? { ...relationship.lastAttempt, targetRoll: undefined }
          : undefined,
      }),
    );
}

/**
 * Player-safe completed observation results. The observer owns the command and may
 * see their own roll plus the resulting candidate/best bonus. The target roll is
 * deliberately GM-only and the observed participant receives no result at all.
 */
export function buildPlayerSafeCombatObservationAttempts(input: {
  attempts: readonly CombatObservationAttempt[];
  controlledParticipantIds: ReadonlySet<string>;
  relationships: readonly CombatObservationRelationship[];
}): CombatObservationAttempt[] {
  const ownedRelationshipIds = new Set(
    input.relationships
      .filter((relationship) =>
        input.controlledParticipantIds.has(relationship.observerParticipantId),
      )
      .map((relationship) => relationship.id),
  );

  return input.attempts.flatMap((attempt) => {
    const relationshipId = attempt.id.slice(0, attempt.id.lastIndexOf(":attempt:"));
    if (!ownedRelationshipIds.has(relationshipId)) return [];
    return [
      combatObservationAttemptSchema.parse({
        ...attempt,
        targetRoll: undefined,
      }),
    ];
  });
}
