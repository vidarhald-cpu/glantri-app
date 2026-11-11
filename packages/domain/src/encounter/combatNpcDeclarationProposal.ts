import { z } from "zod";

import {
  combatRoundDeclarationSchema,
  parseCombatRoundState,
  type CombatAttackSourceRef,
  type CombatRoundAttackOpportunity,
  type CombatRoundState,
} from "./combatRoundManager";
import {
  getCombatDeclarationAttackPhases,
  validateCombatDeclarationTargets,
} from "./combatDeclarationValidation";
import { validateCombatDeclarationCompatibility } from "./combatDeclarationCompatibility";

export const CANONICAL_COMBAT_NPC_DECLARATION_PROPOSAL_SCHEMA_VERSION = 1 as const;

export const combatNpcDeclarationProposalStatusSchema = z.enum([
  "complete",
  "invalid",
  "requires_review",
  "unsupported",
  "legacy_incomplete",
]);
export type CombatNpcDeclarationProposalStatus = z.infer<
  typeof combatNpcDeclarationProposalStatusSchema
>;

export const combatNpcDeclarationProposalReasonSchema = z.enum([
  "current_declaration_exists",
  "participant_inactive",
  "participant_incapable",
  "participant_not_gm_controlled",
  "source_command_missing",
  "source_identity_incomplete",
  "unsupported_declaration",
  "declaration_review_required",
  "target_invalid",
  "weapon_invalid",
  "attack_mode_invalid",
  "maneuver_invalid",
  "movement_invalid",
  "secondary_action_invalid",
  "relationship_invalid",
  "restrictions_changed",
]);
export type CombatNpcDeclarationProposalReason = z.infer<
  typeof combatNpcDeclarationProposalReasonSchema
>;

export const combatNpcDeclarationProposalValidationSchema = z.object({
  reasons: z.array(combatNpcDeclarationProposalReasonSchema).readonly().default([]),
  status: combatNpcDeclarationProposalStatusSchema,
});
export type CombatNpcDeclarationProposalValidation = z.infer<
  typeof combatNpcDeclarationProposalValidationSchema
>;

export const combatNpcDeclarationProposalSchema = z.object({
  encounterId: z.string().min(1),
  participantId: z.string().min(1),
  proposalRevision: z.string().min(1),
  proposalSequence: z.number().int().nonnegative(),
  roundNumber: z.number().int().positive(),
  schemaVersion: z.literal(CANONICAL_COMBAT_NPC_DECLARATION_PROPOSAL_SCHEMA_VERSION),
  sourceCommandId: z.string().min(1).optional(),
  sourceDeclaration: combatRoundDeclarationSchema,
  sourceDeclarationId: z.string().min(1).optional(),
  sourceRoundNumber: z.number().int().positive(),
  validation: combatNpcDeclarationProposalValidationSchema,
});
export type CombatNpcDeclarationProposal = z.infer<typeof combatNpcDeclarationProposalSchema>;

export const combatNpcDeclarationProposalProvenanceSchema = z.object({
  kind: z.literal("proposal_acceptance"),
  proposalSchemaVersion: z.literal(CANONICAL_COMBAT_NPC_DECLARATION_PROPOSAL_SCHEMA_VERSION),
  sourceCommandId: z.string().min(1),
  sourceDeclarationId: z.string().min(1),
  sourceRoundNumber: z.number().int().positive(),
});
export type CombatNpcDeclarationProposalProvenance = z.infer<
  typeof combatNpcDeclarationProposalProvenanceSchema
>;

export type CombatNpcDeclarationSourceStatus = "valid" | "weapon_invalid" | "attack_mode_invalid";

export interface CombatNpcDeclarationCurrentFacts {
  readonly adjustDistanceValid: boolean;
  readonly currentDeclarationExists: boolean;
  readonly declarationStillLegal: boolean;
  readonly feintValid: boolean;
  readonly feintWeaponStatus?: CombatNpcDeclarationSourceStatus;
  readonly movementValid: boolean;
  readonly participantActive: boolean;
  readonly participantCapable: boolean;
  readonly participantGmControlled: boolean;
  readonly phaseSourceStatus: Readonly<
    Partial<Record<"phase1" | "phase2", CombatNpcDeclarationSourceStatus>>
  >;
  readonly validTargetParticipantIds: ReadonlySet<string>;
}

function sourceRefFromOpportunity(
  opportunity: CombatRoundAttackOpportunity | undefined,
): CombatAttackSourceRef | undefined {
  if (
    !opportunity?.attackModeId ||
    !opportunity.weaponTemplateId ||
    !opportunity.weaponSourceSlot
  ) {
    return undefined;
  }
  if (opportunity.sourceKind === "unarmed") {
    return opportunity.weaponSourceSlot === "virtual"
      ? {
          attackModeId: opportunity.attackModeId,
          opportunitySlot: opportunity.slot,
          slot: "virtual",
          sourceKind: "unarmed",
          templateId: opportunity.weaponTemplateId,
        }
      : undefined;
  }
  const itemId = opportunity.weaponInstanceId ?? opportunity.itemId;
  return opportunity.sourceKind === "weapon" && itemId && opportunity.weaponSourceSlot !== "virtual"
    ? {
        attackModeId: opportunity.attackModeId,
        opportunitySlot: opportunity.slot,
        scenarioItemId: itemId,
        slot: opportunity.weaponSourceSlot,
        sourceKind: "weapon",
        templateId: opportunity.weaponTemplateId,
      }
    : undefined;
}

export function getCombatNpcDeclarationProposalAttackSources(
  proposal: CombatNpcDeclarationProposal,
): Readonly<Partial<Record<"phase1" | "phase2", CombatAttackSourceRef>>> {
  return Object.fromEntries(
    (["phase1", "phase2"] as const).flatMap((phase) => {
      const source = sourceRefFromOpportunity(
        proposal.sourceDeclaration.attackOpportunities?.find(
          (opportunity) => opportunity.phase === phase && opportunity.status === "committed",
        ),
      );
      return source ? [[phase, source]] : [];
    }),
  );
}

function structuralValidation(input: {
  declaration: z.infer<typeof combatRoundDeclarationSchema>;
  sourceCommandId?: string;
}): CombatNpcDeclarationProposalValidation {
  const { declaration } = input;
  if (!input.sourceCommandId || !declaration.id) {
    return { reasons: ["source_identity_incomplete"], status: "legacy_incomplete" };
  }
  if (!declaration.actionId || declaration.actionId === "other") {
    return { reasons: ["declaration_review_required"], status: "requires_review" };
  }
  const compatibility = validateCombatDeclarationCompatibility({
    movementKind: declaration.movementIntent?.mode,
    primaryAction: declaration.actionId,
    secondaryAction: declaration.secondaryActionId,
  });
  if (!compatibility.valid) {
    return { reasons: ["unsupported_declaration"], status: "unsupported" };
  }
  const targetValidation = validateCombatDeclarationTargets({
    actingParticipantId: undefined,
    actionId: declaration.actionId,
    movementKind: declaration.movementIntent?.mode,
    phaseContexts: declaration.phaseContexts,
    secondaryActionContext: declaration.secondaryActionContext,
    secondaryActionId: declaration.secondaryActionId,
    selectedOpponentId: declaration.combatContext?.selectedOpponentId,
  });
  if (!targetValidation.valid) {
    return { reasons: ["source_identity_incomplete"], status: "legacy_incomplete" };
  }
  const sources = Object.values(
    getCombatNpcDeclarationProposalAttackSources(
      combatNpcDeclarationProposalSchema.parse({
        encounterId: "structural-validation",
        participantId: "structural-validation",
        proposalRevision: "structural-validation",
        proposalSequence: 0,
        roundNumber: declaration.roundNumber + 1,
        schemaVersion: 1,
        sourceCommandId: input.sourceCommandId,
        sourceDeclaration: declaration,
        sourceDeclarationId: declaration.id,
        sourceRoundNumber: declaration.roundNumber,
        validation: { reasons: [], status: "complete" },
      }),
    ),
  );
  if (
    sources.length !==
    getCombatDeclarationAttackPhases({
      actionId: declaration.actionId,
      secondaryActionId: declaration.secondaryActionId,
    }).length
  ) {
    return { reasons: ["source_identity_incomplete"], status: "legacy_incomplete" };
  }
  if (
    declaration.actionId === "feint_attack" &&
    (!declaration.feint ||
      (declaration.feint.method === "weapon" && !declaration.feint.weaponSource))
  ) {
    return { reasons: ["source_identity_incomplete"], status: "legacy_incomplete" };
  }
  if (declaration.actionId === "adjust_range_attack" && !declaration.adjustDistance) {
    return { reasons: ["source_identity_incomplete"], status: "legacy_incomplete" };
  }
  if (
    (declaration.actionId === "disarm" || declaration.actionId === "parry_disarm") &&
    !declaration.disarm
  ) {
    return { reasons: ["source_identity_incomplete"], status: "legacy_incomplete" };
  }
  return { reasons: [], status: "complete" };
}

/** Derives one proposal from the immediately preceding archived round only. */
export function projectCombatNpcDeclarationProposal(input: {
  readonly encounterId: string;
  readonly encounterRevision: string;
  readonly participantId: string;
  readonly proposalSequence: number;
  readonly state: CombatRoundState;
}): CombatNpcDeclarationProposal | undefined {
  const state = parseCombatRoundState(input.state);
  if (state.roundNumber <= 1) return undefined;
  const currentParticipant = state.participants.find(
    (participant) => participant.participantId === input.participantId,
  );
  if (!currentParticipant || currentParticipant.declaration) return undefined;
  const sourceRound = state.rounds.at(-1);
  if (!sourceRound || sourceRound.roundNumber !== state.roundNumber - 1) return undefined;
  const sourceDeclaration = sourceRound.participants.find(
    (participant) => participant.participantId === input.participantId,
  )?.declaration;
  if (!sourceDeclaration) return undefined;
  const sourceCommand = [...sourceRound.commands]
    .reverse()
    .find(
      (command) =>
        command.type === "declare_action" && command.participantId === input.participantId,
    );
  return combatNpcDeclarationProposalSchema.parse({
    encounterId: input.encounterId,
    participantId: input.participantId,
    proposalRevision: input.encounterRevision,
    proposalSequence: input.proposalSequence,
    roundNumber: state.roundNumber,
    schemaVersion: 1,
    sourceCommandId: sourceCommand?.id,
    sourceDeclaration,
    sourceDeclarationId: sourceDeclaration.id,
    sourceRoundNumber: sourceRound.roundNumber,
    validation: structuralValidation({
      declaration: sourceDeclaration,
      sourceCommandId: sourceCommand?.id,
    }),
  });
}

function collectProposalTargetIds(proposal: CombatNpcDeclarationProposal): string[] {
  const declaration = proposal.sourceDeclaration;
  return [
    declaration.phaseContexts?.phase1?.targetParticipantId,
    declaration.phaseContexts?.phase2?.targetParticipantId,
    declaration.combatContext?.selectedOpponentId,
    declaration.feint?.targetParticipantId,
    declaration.adjustDistance?.targetParticipantId,
    declaration.secondaryActionContext?.targetParticipantId,
    ...(declaration.movementIntent?.distancePreferences.map(
      (preference) => preference.targetParticipantId,
    ) ?? []),
  ].filter((value): value is string => Boolean(value));
}

/** Applies bounded current-round facts without inferring replacements or alternate tactics. */
export function validateCombatNpcDeclarationProposal(input: {
  readonly facts: CombatNpcDeclarationCurrentFacts;
  readonly proposal: CombatNpcDeclarationProposal;
}): CombatNpcDeclarationProposal {
  const { facts, proposal } = input;
  if (proposal.validation.status !== "complete") return proposal;
  const reasons: CombatNpcDeclarationProposalReason[] = [];
  if (facts.currentDeclarationExists) reasons.push("current_declaration_exists");
  if (!facts.participantGmControlled) reasons.push("participant_not_gm_controlled");
  if (!facts.participantActive) reasons.push("participant_inactive");
  if (!facts.participantCapable) reasons.push("participant_incapable");
  if (!facts.declarationStillLegal) reasons.push("restrictions_changed");
  if (!facts.movementValid) reasons.push("movement_invalid");
  if (!facts.feintValid) reasons.push("maneuver_invalid");
  if (!facts.adjustDistanceValid) reasons.push("maneuver_invalid");
  if (
    collectProposalTargetIds(proposal).some(
      (targetParticipantId) => !facts.validTargetParticipantIds.has(targetParticipantId),
    )
  ) {
    reasons.push("target_invalid");
  }
  for (const status of Object.values(facts.phaseSourceStatus)) {
    if (status === "weapon_invalid") reasons.push("weapon_invalid");
    if (status === "attack_mode_invalid") reasons.push("attack_mode_invalid");
  }
  if (facts.feintWeaponStatus === "weapon_invalid") reasons.push("weapon_invalid");
  if (facts.feintWeaponStatus === "attack_mode_invalid") reasons.push("attack_mode_invalid");
  const uniqueReasons = [...new Set(reasons)];
  return combatNpcDeclarationProposalSchema.parse({
    ...proposal,
    validation:
      uniqueReasons.length === 0
        ? { reasons: [], status: "complete" }
        : { reasons: uniqueReasons, status: "invalid" },
  });
}
