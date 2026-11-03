import { z } from "zod";

import type { CombatResultConsequence } from "./combatResultPresentation";

const idSchema = z.string().min(1);

/** Source-rule prefix of every generated bucket row that carries this penalty. */
export const ATTACK_PHASE_DEFENSIVE_PENALTY_SOURCE_RULE = "attack-phase-defensive-penalty";

/**
 * True for the generated DB/Parry row that carries the attack-phase defensive penalty.
 *
 * The rule is per phase: a character who attacks in a phase defends at -4% for that phase. The
 * attack opportunity that created the row is its **provenance**, not a restriction on when it
 * applies, and must never narrow the row's applicability. A defence is always resolved against an
 * incoming attack, so the evaluation context names the *attacker's* opportunity; the row names its
 * owner's own. The two can never be equal, which excluded this penalty from every defence
 * resolution (#884).
 *
 * Nothing is lost by dropping the dimension. A declared attack opportunity is identified by
 * `round:<n>:participant:<id>:<phase>:<slot>` and `slot` is derived from `phase`
 * (`buildCombatRoundAttackOpportunityId`/`buildCombatRoundDeclaredAttackOpportunities`), so there
 * is exactly one per participant per phase per round and the opportunity id carries no information
 * beyond the round, participant and phase dimensions the row already states.
 */
export function isAttackPhaseDefensivePenaltySourceRule(sourceRule?: string): boolean {
  return sourceRule?.startsWith(ATTACK_PHASE_DEFENSIVE_PENALTY_SOURCE_RULE) === true;
}

export const combatAttackPhasePenaltyCommitmentSchema = z.enum([
  "provisional",
  "uncommitted",
  "committed",
]);
export type CombatAttackPhasePenaltyCommitment = z.infer<
  typeof combatAttackPhasePenaltyCommitmentSchema
>;

export const combatAttackPhaseExecutionStateSchema = z.enum([
  "pending",
  "executed",
  "cancelled",
  "backed_out",
  "invalidated",
  "skipped",
  "legacy",
]);
export type CombatAttackPhaseExecutionState = z.infer<typeof combatAttackPhaseExecutionStateSchema>;

export const combatAttackPhasePenaltyReasonSchema = z.enum([
  "ordinary_committed_attack",
  "double_attack_second_cancelled",
  "simultaneous_attack_backout",
  "invalid_before_commitment",
  "invalid_after_commitment",
  "skipped_before_commitment",
  "skipped_after_commitment",
  "unsupported_legacy_process",
]);
export type CombatAttackPhasePenaltyReason = z.infer<typeof combatAttackPhasePenaltyReasonSchema>;

export const combatAttackPhasePenaltyExceptionSchema = z.enum([
  "none",
  "double_attack_second_cancelled",
  "simultaneous_attack_backout",
  "direct_counter_future",
]);
export type CombatAttackPhasePenaltyException = z.infer<
  typeof combatAttackPhasePenaltyExceptionSchema
>;

export const combatAttackPhaseDefensivePenaltySchema = z.object({
  activationCutoff: z.literal("phase_start"),
  application: z.literal("percentage"),
  attackIndex: z.number().int().positive(),
  attackOpportunityId: idSchema,
  attackProcessId: idSchema,
  commitment: combatAttackPhasePenaltyCommitmentSchema,
  completeness: z.enum(["complete", "legacy_partial"]),
  duration: z.literal("phase"),
  executionState: combatAttackPhaseExecutionStateSchema,
  id: idSchema,
  initiativeGroupId: idSchema.optional(),
  participantId: idSchema,
  penalty: z.number().int().min(-4).max(0),
  phase: z.enum(["phase1", "phase2"]),
  reason: combatAttackPhasePenaltyReasonSchema,
  roundNumber: z.number().int().positive(),
  sourceActionId: idSchema.optional(),
  sourceException: combatAttackPhasePenaltyExceptionSchema,
  targetParticipantId: idSchema.optional(),
});
export type CombatAttackPhaseDefensivePenalty = z.infer<
  typeof combatAttackPhaseDefensivePenaltySchema
>;

export interface CombatAttackPhasePenaltyOpportunity {
  readonly actionId?: string;
  readonly attackIndex?: number;
  readonly id: string;
  readonly phase: "phase1" | "phase2";
  readonly slot: "attack_1" | "attack_2";
  readonly status: "cancelled" | "committed";
  readonly targetParticipantId?: string;
}

export function buildCombatAttackPhasePenaltyId(input: { attackOpportunityId: string }): string {
  return `attack-phase-penalty:${input.attackOpportunityId}`;
}

/**
 * Resolves the defensive consequence of one canonical weapon-attack opportunity.
 *
 * The opportunity proves that the server accepted a legal attack source and target. Declaration
 * action ids are retained only as provenance and never decide whether the penalty exists.
 */
export function resolveCombatAttackPhaseDefensivePenalty(input: {
  commitment: CombatAttackPhasePenaltyCommitment;
  executionState?: CombatAttackPhaseExecutionState;
  initiativeGroupId?: string;
  opportunity: CombatAttackPhasePenaltyOpportunity;
  participantId: string;
  reason?: CombatAttackPhasePenaltyReason;
  roundNumber: number;
  sourceException?: CombatAttackPhasePenaltyException;
}): CombatAttackPhaseDefensivePenalty {
  const attackIndex =
    input.opportunity.attackIndex ?? (input.opportunity.slot === "attack_1" ? 1 : 2);
  const executionState =
    input.executionState ?? (input.opportunity.status === "cancelled" ? "cancelled" : "pending");
  const sourceException = input.sourceException ?? "none";
  const reason =
    input.reason ??
    (sourceException === "double_attack_second_cancelled"
      ? "double_attack_second_cancelled"
      : sourceException === "simultaneous_attack_backout"
        ? "simultaneous_attack_backout"
        : "ordinary_committed_attack");
  const isCommitted = input.commitment === "committed";
  const isProvisional = input.commitment === "provisional";
  const hasCanonicalOpportunity = isCommitted || isProvisional;
  const isSourceDefinedReducedPenalty =
    sourceException === "double_attack_second_cancelled" ||
    sourceException === "simultaneous_attack_backout";
  const penalty = !hasCanonicalOpportunity ? 0 : isSourceDefinedReducedPenalty ? -2 : -4;

  return combatAttackPhaseDefensivePenaltySchema.parse({
    activationCutoff: "phase_start",
    application: "percentage",
    attackIndex,
    attackOpportunityId: input.opportunity.id,
    attackProcessId: `round:${input.roundNumber}:participant:${input.participantId}:attack:${input.opportunity.id}`,
    commitment: input.commitment,
    completeness:
      executionState === "legacy" || reason === "unsupported_legacy_process"
        ? "legacy_partial"
        : "complete",
    duration: "phase",
    executionState,
    id: buildCombatAttackPhasePenaltyId({ attackOpportunityId: input.opportunity.id }),
    initiativeGroupId: input.initiativeGroupId,
    participantId: input.participantId,
    penalty,
    phase: input.opportunity.phase,
    reason,
    roundNumber: input.roundNumber,
    sourceActionId: input.opportunity.actionId,
    sourceException,
    targetParticipantId: input.opportunity.targetParticipantId,
  });
}

export function resolveCombatAttackPhaseDefensivePenalties(input: {
  commitment: CombatAttackPhasePenaltyCommitment;
  opportunities: readonly CombatAttackPhasePenaltyOpportunity[];
  participantId: string;
  roundNumber: number;
}): CombatAttackPhaseDefensivePenalty[] {
  return input.opportunities.map((opportunity) =>
    resolveCombatAttackPhaseDefensivePenalty({
      commitment: input.commitment,
      opportunity,
      participantId: input.participantId,
      roundNumber: input.roundNumber,
    }),
  );
}

export function replaceCombatAttackPhaseDefensivePenalty(input: {
  existing: readonly CombatAttackPhaseDefensivePenalty[];
  next: CombatAttackPhaseDefensivePenalty;
}): CombatAttackPhaseDefensivePenalty[] {
  return [
    ...input.existing.filter(
      (penalty) => penalty.attackOpportunityId !== input.next.attackOpportunityId,
    ),
    input.next,
  ].sort(
    (left, right) =>
      left.attackIndex - right.attackIndex ||
      left.attackOpportunityId.localeCompare(right.attackOpportunityId),
  );
}

export function buildCombatAttackPhasePenaltyResultConsequences(
  penalty: CombatAttackPhaseDefensivePenalty,
): {
  committedConsequences: CombatResultConsequence[];
  standardConsequences: CombatResultConsequence[];
} {
  const standard: CombatResultConsequence = {
    affectedParticipantId: penalty.participantId,
    key: "attackPhaseDefensivePenalty",
    label: "Attack DB/Parry",
    unit: "percentage_points",
    value: -4,
  };

  return {
    committedConsequences: [{ ...standard, value: penalty.penalty }],
    standardConsequences: [standard],
  };
}
