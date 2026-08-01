import { z } from "zod";

import {
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
} from "../campaign/scenario";
import type { SkillDefinition, SkillSpecialization } from "../content/skills";
import { combatSkillContestCalculationSchema } from "./combatSkillContest";
import type { CombatSkillContestCalculation } from "./combatSkillContest";
import {
  attachCanonicalLifecycleToModifierBucketRow,
  type CanonicalCombatModifierCompatibilityContext,
} from "./combatModifierLifecycleCompatibility";

const idSchema = z.string().min(1);

export const combatFeintMethodSchema = z.enum(["movement", "weapon"]);
export type CombatFeintMethod = z.infer<typeof combatFeintMethodSchema>;

/**
 * Weapon templates historically name either a canonical combat skill or one of
 * that skill's specializations. Feint rolls currently use the canonical skill
 * profile, so resolve a specialization name through its declared parent rather
 * than trusting a client-selected skill id.
 */
export function resolveCombatFeintWeaponSkillDefinition(input: {
  skills: readonly SkillDefinition[];
  specializations?: readonly SkillSpecialization[];
  weaponSkill?: string | null;
}): SkillDefinition | undefined {
  const weaponSkill = input.weaponSkill?.trim().toLowerCase();
  if (!weaponSkill) return undefined;
  const direct = input.skills.find((skill) => skill.name.trim().toLowerCase() === weaponSkill);
  if (direct) return direct;
  const specialization = input.specializations?.find(
    (candidate) => candidate.name.trim().toLowerCase() === weaponSkill,
  );
  return specialization
    ? input.skills.find((skill) => skill.id === specialization.skillId)
    : undefined;
}

export const combatFeintFeasibilitySchema = z.enum([
  "pending",
  "possible",
  "possible_with_adjustment",
  "impossible",
]);
export type CombatFeintFeasibility = z.infer<typeof combatFeintFeasibilitySchema>;

export const combatFeintStatusSchema = z.enum([
  "awaiting_action_turn",
  "awaiting_feasibility",
  "awaiting_rolls",
  "awaiting_review",
  "committed",
  "impossible",
]);
export type CombatFeintStatus = z.infer<typeof combatFeintStatusSchema>;

export const COMBAT_FEINT_OUTCOME_TABLE = [
  {
    attackerPhase1DbParryModifier: -4,
    band: "defender_strong",
    defenderPhase2ObDbModifier: 2,
    differenceLabel: "≤ -16",
    maximumDifference: -16,
  },
  {
    attackerPhase1DbParryModifier: -2,
    band: "defender_edge",
    defenderPhase2ObDbModifier: 0,
    differenceLabel: "-15 to -6",
    maximumDifference: -6,
  },
  {
    attackerPhase1DbParryModifier: -1,
    band: "balanced",
    defenderPhase2ObDbModifier: 0,
    differenceLabel: "-5 to 0",
    maximumDifference: 0,
  },
  {
    attackerPhase1DbParryModifier: 0,
    band: "attacker_edge",
    defenderPhase2ObDbModifier: -2,
    differenceLabel: "1 to 10",
    maximumDifference: 10,
  },
  {
    attackerPhase1DbParryModifier: 0,
    band: "attacker_strong",
    defenderPhase2ObDbModifier: -4,
    differenceLabel: "≥ 11",
    maximumDifference: null,
  },
] as const;

export type CombatFeintOutcomeTableRow = (typeof COMBAT_FEINT_OUTCOME_TABLE)[number];

const combatFeintSkillContestCalculationSchema: z.ZodType<
  CombatSkillContestCalculation,
  z.ZodTypeDef,
  z.input<typeof combatSkillContestCalculationSchema>
> = combatSkillContestCalculationSchema;

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
  skillContestCalculation: combatFeintSkillContestCalculationSchema.optional(),
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
  gmDefenderDbParryModifier: z.number().int().optional(),
  gmDefenderObDbModifier: z.number().int().optional(),
  gmDefenderSkillObModifier: z.number().int().optional(),
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
  status: combatFeintStatusSchema.default("awaiting_action_turn"),
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
  encounterId?: string;
  participantId: string;
  phase: "phase1" | "phase2";
  proposalId: string;
  value: number;
  lifecycleContext?: CanonicalCombatModifierCompatibilityContext;
}): ScenarioCombatModifierEntry {
  const sourceRound = input.proposalId.match(/:round:(\d+):/)?.[1];
  const entry = scenarioCombatModifierEntrySchema.parse({
    application: "percentage",
    durationRounds: 1,
    ...(sourceRound ? { expiresAtRound: Number(sourceRound) } : {}),
    generated: true,
    id: feintModifierId(input),
    notes: "feint",
    scope: "until",
    sourceActionId: "feint_attack",
    sourceEncounterId: input.encounterId,
    sourcePhase: input.phase,
    sourceProposalId: input.proposalId,
    ...(sourceRound ? { sourceRoundNumber: Number(sourceRound) } : {}),
    sourceRule: `feint:${input.proposalId}:${input.participantId}:${input.phase}:${input.bucket}`,
    sourceType: "feint",
    ...(input.phase === "phase2"
      ? { resultGroupId: input.proposalId, resultGroupKind: "ob_db" as const }
      : {}),
    value: input.value,
  });
  return input.lifecycleContext
    ? scenarioCombatModifierEntrySchema.parse(
        attachCanonicalLifecycleToModifierBucketRow({
          bucket: input.bucket === "ob-skill" ? "situation_ob_skill" : "situation_db",
          context: input.lifecycleContext,
          entry,
          ownerParticipantId: input.participantId,
        }),
      )
    : entry;
}

function getCombatFeintModifierRound(entry: ScenarioCombatModifierEntry): number | undefined {
  if (!isCombatFeintGeneratedModifier(entry)) return undefined;
  if (entry.expiresAtRound !== undefined) return entry.expiresAtRound;
  const round = entry.sourceRule?.match(/feint:combat-feint:round:(\d+):/)?.[1];
  return round ? Number(round) : undefined;
}

/**
 * Feint rows are scenario-participant projections for one combat round. New-round
 * normalization removes only expired Feint rows; imported, manual, and unrelated
 * generated rows remain owned by their existing lifecycles.
 */
export function expireCombatFeintGeneratedModifiersBeforeRound(
  combatContext: ScenarioParticipantCombatContext | undefined,
  roundNumber: number,
): ScenarioParticipantCombatContext {
  const context = scenarioParticipantCombatContextSchema.parse(combatContext ?? {});
  const keep = (entry: ScenarioCombatModifierEntry) => {
    const sourceRound = getCombatFeintModifierRound(entry);
    return sourceRound === undefined || sourceRound >= roundNumber;
  };
  return scenarioParticipantCombatContextSchema.parse({
    ...context,
    modifierBuckets: {
      ...context.modifierBuckets,
      situationDb: context.modifierBuckets.situationDb.filter(keep),
      situationObSkill: context.modifierBuckets.situationObSkill.filter(keep),
    },
  });
}

export function applyCommittedCombatFeintModifiers(input: {
  attackerCombatContext?: ScenarioParticipantCombatContext;
  defenderCombatContext?: ScenarioParticipantCombatContext;
  encounterId?: string;
  lifecycleContext?: CanonicalCombatModifierCompatibilityContext;
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
  const defenderObValue =
    input.proposal.review.gmDefenderSkillObModifier ??
    input.proposal.review.gmDefenderObDbModifier ??
    input.proposal.review.proposedDefenderObDbModifier;
  const defenderDbValue =
    input.proposal.review.gmDefenderDbParryModifier ??
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
    encounterId: input.encounterId,
    participantId: input.proposal.attackerParticipantId,
    phase: "phase1",
    proposalId: input.proposal.id,
    value: attackerValue,
    lifecycleContext: input.lifecycleContext,
  });
  const defenderOb = buildFeintModifier({
    bucket: "ob-skill",
    encounterId: input.encounterId,
    participantId: input.proposal.defenderParticipantId,
    phase: "phase2",
    proposalId: input.proposal.id,
    value: defenderObValue,
    lifecycleContext: input.lifecycleContext,
  });
  const defenderDb = buildFeintModifier({
    bucket: "db-parry",
    encounterId: input.encounterId,
    participantId: input.proposal.defenderParticipantId,
    phase: "phase2",
    proposalId: input.proposal.id,
    value: defenderDbValue,
    lifecycleContext: input.lifecycleContext,
  });
  const attackerRows = attackerValue === 0 ? [] : [attackerDb];
  const defenderObRows = defenderObValue === 0 ? [] : [defenderOb];
  const defenderDbRows = defenderDbValue === 0 ? [] : [defenderDb];
  return {
    attackerCombatContext: scenarioParticipantCombatContextSchema.parse({
      ...attackerContext,
      modifierBuckets: {
        ...attackerContext.modifierBuckets,
        situationDb: [...attackerContext.modifierBuckets.situationDb, ...attackerRows],
      },
    }),
    defenderCombatContext: scenarioParticipantCombatContextSchema.parse({
      ...defenderContext,
      modifierBuckets: {
        ...defenderContext.modifierBuckets,
        situationDb: [...defenderContext.modifierBuckets.situationDb, ...defenderDbRows],
        situationObSkill: [
          ...defenderContext.modifierBuckets.situationObSkill,
          ...defenderObRows,
        ],
      },
    }),
    modifierIds: [...attackerRows, ...defenderObRows, ...defenderDbRows].map((entry) => entry.id),
  };
}
