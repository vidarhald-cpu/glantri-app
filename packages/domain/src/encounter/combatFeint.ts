import { z } from "zod";

import {
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
} from "../campaign/scenario";

const idSchema = z.string().min(1);

export const combatFeintMethodSchema = z.enum(["movement", "weapon"]);
export type CombatFeintMethod = z.infer<typeof combatFeintMethodSchema>;

export const combatFeintFeasibilitySchema = z.enum([
  "pending",
  "possible",
  "possible_with_adjustment",
  "impossible",
]);
export type CombatFeintFeasibility = z.infer<typeof combatFeintFeasibilitySchema>;

export const combatFeintStatusSchema = z.enum([
  "awaiting_feasibility",
  "awaiting_rolls",
  "awaiting_review",
  "committed",
  "impossible",
]);
export type CombatFeintStatus = z.infer<typeof combatFeintStatusSchema>;

export const combatFeintRollResultSchema = z.object({
  adjustment: z.number().int().default(0),
  characteristic: z.enum(["dex", "int"]),
  characteristicValue: z.number().int(),
  finalTotal: z.number().int(),
  id: idSchema,
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  participantId: idSchema,
  rollD20: z.number().int().min(1).max(20),
  rollTotal: z.number().int(),
  rolledAt: z.string().datetime(),
  rolledByUserId: idSchema.optional(),
  skillId: idSchema,
  skillLabel: z.string().min(1),
  skillXp: z.number().int(),
});
export type CombatFeintRollResult = z.infer<typeof combatFeintRollResultSchema>;

export const combatFeintTableResultSchema = z.object({
  attackerPhase1DbParryModifier: z.number().int(),
  band: z.enum([
    "defender_strong",
    "defender_edge",
    "balanced",
    "attacker_edge",
    "attacker_strong",
  ]),
  defenderObDbModifier: z.number().int(),
});
export type CombatFeintTableResult = z.infer<typeof combatFeintTableResultSchema>;

export const combatFeintReviewSchema = z.object({
  gmAttackerDbParryModifier: z.number().int().optional(),
  gmDefenderObDbModifier: z.number().int().optional(),
  notes: z.string().optional(),
  proposedAttackerDbParryModifier: z.number().int(),
  proposedDefenderObDbModifier: z.number().int(),
});
export type CombatFeintReview = z.infer<typeof combatFeintReviewSchema>;

export const combatFeintProposalSchema = z.object({
  attackerParticipantId: idSchema,
  attackerRoll: combatFeintRollResultSchema.optional(),
  attackerRollRecorded: z.boolean().default(false),
  attackerSkillId: idSchema,
  attackerSkillLabel: z.string().min(1),
  committedAt: z.string().datetime().optional(),
  committedByUserId: idSchema.optional(),
  defenderParticipantId: idSchema,
  defenderRoll: combatFeintRollResultSchema.optional(),
  defenderRollRecorded: z.boolean().default(false),
  defenderSkillId: idSchema,
  defenderSkillLabel: z.string().min(1),
  description: z.string().optional(),
  difference: z.number().int().optional(),
  feasibility: combatFeintFeasibilitySchema.default("pending"),
  feasibilityAdjustment: z.number().int().default(0),
  feasibilityNote: z.string().optional(),
  id: idSchema,
  method: combatFeintMethodSchema,
  pairId: idSchema,
  phase1OpportunityId: idSchema,
  phase2AttackOpportunityId: idSchema,
  review: combatFeintReviewSchema.optional(),
  roundNumber: z.number().int().positive(),
  status: combatFeintStatusSchema.default("awaiting_feasibility"),
  tableResult: combatFeintTableResultSchema.optional(),
});
export type CombatFeintProposal = z.infer<typeof combatFeintProposalSchema>;

export function buildCombatFeintProposalId(input: {
  attackerParticipantId: string;
  roundNumber: number;
}): string {
  return `combat-feint:round:${input.roundNumber}:attacker:${input.attackerParticipantId}`;
}

function feintModifierId(input: {
  bucket: "db-parry" | "ob-skill";
  participantId: string;
  phase: "phase1" | "phase2";
  proposalId: string;
}): string {
  return `generated:feint:${input.proposalId}:${input.participantId}:${input.phase}:${input.bucket}`;
}

export function isCombatFeintGeneratedModifier(entry: ScenarioCombatModifierEntry): boolean {
  return entry.sourceRule?.startsWith("feint:") === true || entry.id.startsWith("generated:feint:");
}

export function removeCombatFeintGeneratedModifiers(
  combatContext: ScenarioParticipantCombatContext | undefined,
  proposalId: string,
): ScenarioParticipantCombatContext {
  const context = scenarioParticipantCombatContextSchema.parse(combatContext ?? {});
  const belongsToProposal = (entry: ScenarioCombatModifierEntry) =>
    isCombatFeintGeneratedModifier(entry) && entry.sourceRule?.startsWith(`feint:${proposalId}:`);
  return scenarioParticipantCombatContextSchema.parse({
    ...context,
    modifierBuckets: {
      ...context.modifierBuckets,
      situationDb: context.modifierBuckets.situationDb.filter((entry) => !belongsToProposal(entry)),
      situationObSkill: context.modifierBuckets.situationObSkill.filter(
        (entry) => !belongsToProposal(entry),
      ),
    },
  });
}

function buildFeintModifier(input: {
  bucket: "db-parry" | "ob-skill";
  participantId: string;
  phase: "phase1" | "phase2";
  proposalId: string;
  value: number;
}): ScenarioCombatModifierEntry {
  return scenarioCombatModifierEntrySchema.parse({
    durationRounds: 1,
    generated: true,
    id: feintModifierId(input),
    notes: "feint",
    scope: "until",
    sourceActionId: "feint_attack",
    sourcePhase: input.phase,
    sourceRule: `feint:${input.proposalId}:${input.participantId}:${input.phase}:${input.bucket}`,
    value: input.value,
  });
}

export function applyCommittedCombatFeintModifiers(input: {
  attackerCombatContext?: ScenarioParticipantCombatContext;
  defenderCombatContext?: ScenarioParticipantCombatContext;
  proposal: CombatFeintProposal;
}): {
  attackerCombatContext: ScenarioParticipantCombatContext;
  defenderCombatContext: ScenarioParticipantCombatContext;
  modifierIds: string[];
} {
  if (input.proposal.status !== "committed" || !input.proposal.review) {
    throw new RangeError("Feint result must be committed before applying modifiers.");
  }
  const attackerValue =
    input.proposal.review.gmAttackerDbParryModifier ??
    input.proposal.review.proposedAttackerDbParryModifier;
  const defenderValue =
    input.proposal.review.gmDefenderObDbModifier ??
    input.proposal.review.proposedDefenderObDbModifier;
  const attackerContext = removeCombatFeintGeneratedModifiers(
    input.attackerCombatContext,
    input.proposal.id,
  );
  const defenderContext = removeCombatFeintGeneratedModifiers(
    input.defenderCombatContext,
    input.proposal.id,
  );
  const attackerDb = buildFeintModifier({
    bucket: "db-parry",
    participantId: input.proposal.attackerParticipantId,
    phase: "phase1",
    proposalId: input.proposal.id,
    value: attackerValue,
  });
  const defenderOb = buildFeintModifier({
    bucket: "ob-skill",
    participantId: input.proposal.defenderParticipantId,
    phase: "phase2",
    proposalId: input.proposal.id,
    value: defenderValue,
  });
  const defenderDb = buildFeintModifier({
    bucket: "db-parry",
    participantId: input.proposal.defenderParticipantId,
    phase: "phase2",
    proposalId: input.proposal.id,
    value: defenderValue,
  });
  return {
    attackerCombatContext: scenarioParticipantCombatContextSchema.parse({
      ...attackerContext,
      modifierBuckets: {
        ...attackerContext.modifierBuckets,
        situationDb: [...attackerContext.modifierBuckets.situationDb, attackerDb],
      },
    }),
    defenderCombatContext: scenarioParticipantCombatContextSchema.parse({
      ...defenderContext,
      modifierBuckets: {
        ...defenderContext.modifierBuckets,
        situationDb: [...defenderContext.modifierBuckets.situationDb, defenderDb],
        situationObSkill: [...defenderContext.modifierBuckets.situationObSkill, defenderOb],
      },
    }),
    modifierIds: [attackerDb.id, defenderOb.id, defenderDb.id],
  };
}
