import {
  getCombatDeclarationActionLabel,
  type CombatNpcDeclarationProposal,
  type CombatNpcDeclarationProposalReason,
} from "@glantri/domain";

export interface CombatNpcDeclarationProposalPresentation {
  reason?: string;
  sourceLabel: string;
  summary: string;
}

function firstReasonMessage(reason: CombatNpcDeclarationProposalReason): string {
  switch (reason) {
    case "target_invalid":
      return "Previous target is no longer valid.";
    case "weapon_invalid":
      return "Previous weapon is no longer available.";
    case "attack_mode_invalid":
      return "Previous attack mode is no longer valid.";
    case "maneuver_invalid":
      return "Previous maneuver is no longer valid.";
    case "movement_invalid":
      return "Previous movement declaration is no longer valid.";
    case "secondary_action_invalid":
    case "relationship_invalid":
      return "Previous secondary action requires review.";
    case "participant_inactive":
    case "participant_incapable":
    case "restrictions_changed":
      return "Current circumstances require a new declaration.";
    case "participant_not_gm_controlled":
      return "This participant is not GM controlled.";
    case "source_command_missing":
    case "source_identity_incomplete":
      return "Previous declaration is incomplete.";
    case "unsupported_declaration":
      return "Previous declaration is not supported for carry-forward.";
    case "current_declaration_exists":
      return "A current declaration is already accepted.";
    case "declaration_review_required":
      return "Declaration requires GM review.";
  }
}

function proposedTargetId(proposal: CombatNpcDeclarationProposal): string | undefined {
  const declaration = proposal.sourceDeclaration;
  return (
    declaration.feint?.targetParticipantId ??
    declaration.adjustDistance?.targetParticipantId ??
    declaration.phaseContexts?.phase1?.targetParticipantId ??
    declaration.phaseContexts?.phase2?.targetParticipantId ??
    declaration.secondaryActionContext?.targetParticipantId ??
    declaration.combatContext?.selectedOpponentId
  );
}

export function buildCombatNpcDeclarationProposalPresentation(input: {
  participantLabelsById: ReadonlyMap<string, string>;
  proposal: CombatNpcDeclarationProposal;
}): CombatNpcDeclarationProposalPresentation {
  const declaration = input.proposal.sourceDeclaration;
  const action = getCombatDeclarationActionLabel(declaration.actionId);
  const targetId = proposedTargetId(input.proposal);
  const target = targetId ? input.participantLabelsById.get(targetId) : undefined;
  const feintMethod =
    declaration.actionId === "feint_attack" && declaration.feint
      ? declaration.feint.method === "weapon"
        ? "Weapon Feint"
        : "Movement Feint"
      : undefined;
  const parts = [action, feintMethod, target ? `against ${target}` : undefined].filter(Boolean);
  return {
    reason: input.proposal.validation.reasons[0]
      ? firstReasonMessage(input.proposal.validation.reasons[0])
      : undefined,
    sourceLabel: `Proposed from Round ${input.proposal.sourceRoundNumber}`,
    summary: parts.join(" · "),
  };
}
