import type { CombatStepAutomationRunResult } from "@glantri/domain";

export interface CombatStepWorkflowStatusPresentation {
  completion?: string;
  operationLabel: string;
  processedSummary: string;
  stopMessage?: string;
  stopParticipantLabel?: string;
}

function operationLabel(result: CombatStepAutomationRunResult): string {
  if (result.identity.operationFamily === "roll_remaining") {
    return result.identity.startingStep === "initiative_phase_2"
      ? "Roll remaining GM Phase 2 initiative"
      : "Roll remaining GM Phase 1 initiative";
  }
  if (result.identity.operationFamily === "accept_remaining") {
    return result.identity.startingStep === "review_phase_2_modifiers"
      ? "Accept remaining NPC M2 reviews"
      : "Accept remaining NPC M1 reviews";
  }
  return "Complete remaining GM work";
}

function stopMessage(result: CombatStepAutomationRunResult): string | undefined {
  switch (result.stopReason) {
    case "end_of_step":
      return undefined;
    case "player_action_required":
      return "Player action required.";
    case "gm_decision_required":
      return "GM decision required.";
    case "warning_requires_acknowledgement":
      return "Review the warning before continuing.";
    case "invalid_proposal":
      return "The proposal is no longer valid.";
    case "target_invalid":
      return "The target is no longer valid.";
    case "participant_not_gm_controlled":
      return "This participant is not GM controlled.";
    case "stale_revision":
    case "task_changed":
      return "Combat state changed.";
    case "unsupported_task":
      return "This task is not supported by the workflow.";
    case "incomplete_legacy_state":
      return "This combat state requires manual review.";
    case "hidden_choice":
      return "A hidden choice requires attention.";
    case "modifier_review_required":
      return "Modifier review required.";
    case "declaration_review_required":
      return "Declaration review required.";
    case "roll_not_eligible":
      return "This roll requires manual attention.";
    case "safety_limit_reached":
      return "The workflow reached its safe task limit.";
    case "persistence_failure":
      return "Could not continue.";
  }
}

export function buildCombatStepWorkflowStatusPresentation(input: {
  participantLabelsById: ReadonlyMap<string, string>;
  result: CombatStepAutomationRunResult;
}): CombatStepWorkflowStatusPresentation {
  const { result } = input;
  const initiative = result.identity.operationFamily === "roll_remaining";
  const processedSummary = initiative
    ? `Rolled ${result.processedCount} NPC initiative${result.processedCount === 1 ? "" : "s"}.`
    : `Accepted ${result.processedCount} NPC review${result.processedCount === 1 ? "" : "s"}.`;
  const completion = result.stepComplete
    ? result.identity.startingStep === "initiative_phase_1"
      ? "Completed Phase 1 initiative."
      : result.identity.startingStep === "initiative_phase_2"
        ? "Completed Phase 2 initiative."
        : result.identity.startingStep === "review_action_modifiers"
          ? "Completed M1."
          : result.identity.startingStep === "review_phase_2_modifiers"
            ? "Completed M2."
            : "Completed the step."
    : undefined;
  return {
    completion,
    operationLabel: operationLabel(result),
    processedSummary,
    stopMessage: stopMessage(result),
    stopParticipantLabel: result.stopParticipantId
      ? (input.participantLabelsById.get(result.stopParticipantId) ?? "Participant")
      : undefined,
  };
}
