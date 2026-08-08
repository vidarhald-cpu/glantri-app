import type { CombatStepAutomationRunResult } from "@glantri/domain";

export interface CombatStepWorkflowStatusPresentation {
  completion?: string;
  operationLabel: string;
  processedSummary: string;
  stopMessage?: string;
  stopParticipantLabel?: string;
}

function isCombatExperienceRun(result: CombatStepAutomationRunResult): boolean {
  if (result.identity.operationFamily !== "roll_remaining") return false;
  return result.identity.startProcessId
    ? result.identity.startProcessId.includes(":process:combat_experience")
    : result.identity.startingStep === "select_actions";
}

function operationLabel(result: CombatStepAutomationRunResult): string {
  if (result.identity.operationFamily === "roll_remaining") {
    if (isCombatExperienceRun(result)) {
      return "Roll remaining GM Combat Experience";
    }
    return result.identity.startingStep === "initiative_phase_2"
      ? "Roll remaining GM Phase 2 initiative"
      : "Roll remaining GM Phase 1 initiative";
  }
  if (result.identity.operationFamily === "accept_remaining") {
    if (result.identity.startingStep === "select_actions") {
      return "Accept remaining NPC declarations";
    }
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
      return isCombatExperienceRun(result)
        ? "Player roll required."
        : "Player action required.";
    case "gm_decision_required":
      return "GM decision required.";
    case "warning_requires_acknowledgement":
      return "Review the warning before continuing.";
    case "invalid_proposal":
      return "Previous declaration is no longer valid. GM declaration required.";
    case "target_invalid":
      return "Previous target is no longer valid. GM declaration required.";
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
    case "combat_experience_review_required":
      return "Combat Experience requires GM review.";
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
  const combatExperience = isCombatExperienceRun(result);
  const declarations =
    result.identity.operationFamily === "accept_remaining" &&
    result.identity.startingStep === "select_actions";
  const processedSummary = combatExperience
    ? `Rolled ${result.processedCount} NPC Combat Experience check${result.processedCount === 1 ? "" : "s"}.`
    : initiative
      ? `Rolled ${result.processedCount} NPC initiative${result.processedCount === 1 ? "" : "s"}.`
      : declarations
        ? `Accepted ${result.processedCount} NPC declaration${result.processedCount === 1 ? "" : "s"}.`
        : `Accepted ${result.processedCount} NPC review${result.processedCount === 1 ? "" : "s"}.`;
  const completion = result.stepComplete
    ? combatExperience
      ? "Completed Combat Experience."
      : result.identity.startingStep === "initiative_phase_1"
        ? "Completed Phase 1 initiative."
        : result.identity.startingStep === "initiative_phase_2"
          ? "Completed Phase 2 initiative."
          : result.identity.startingStep === "review_action_modifiers"
            ? "Completed M1."
            : result.identity.startingStep === "select_actions"
              ? "Completed DE."
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
