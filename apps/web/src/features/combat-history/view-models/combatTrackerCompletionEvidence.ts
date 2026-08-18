import type {
  CombatRoundStep,
  CombatRoundStepStatus,
  ProjectedCombatHistoryEvent,
} from "@glantri/domain";

import type { CombatTrackerMarkerKind } from "../types";

const COMPLETION_EVENT_TYPES_BY_STEP = {
  phase_1_actions: [
    "action_skipped",
    "attack",
    "adjust_distance_roll",
    "feint_committed",
    "feint_impossible",
    "adjust_distance_committed",
  ],
  phase_1_damage: ["damage_committed", "effect_review"],
  phase_2_actions: ["action_skipped", "attack"],
  phase_2_damage: ["damage_committed", "effect_review"],
  review_action_modifiers: ["modifier_review"],
  review_phase_2_actions: ["parry", "offensive_parry_brawling"],
  review_phase_2_damage: ["parry", "offensive_parry_brawling"],
  review_phase_2_modifiers: ["modifier_review"],
  round_summary: ["participant_su_review"],
  select_actions: ["declaration"],
} as const satisfies Partial<
  Record<CombatRoundStep, readonly ProjectedCombatHistoryEvent["type"][]>
>;

/**
 * Accepted canonical step status is the raw-state completion authority used by the GM tracker.
 * Missing work, snapshots, visibility filtering, and unrelated results are deliberately absent.
 */
export function getCombatTrackerStatusCompletionKind(
  status: CombatRoundStepStatus | undefined,
): CombatTrackerMarkerKind {
  switch (status) {
    case "submitted":
    case "gmEdited":
    case "complete":
      return "complete";
    case "locked":
    case "skipped":
      return "skipped";
    default:
      return "not_reached";
  }
}

/**
 * Player-safe history contains many result-shaped events in one tracker cell. Only an accepted
 * event that canonically completes that exact step is completion evidence for the green board.
 */
export function hasProjectedCombatTrackerCompletionEvidence(input: {
  events: readonly ProjectedCombatHistoryEvent[];
  step: CombatRoundStep;
}): boolean {
  if (input.step === "initiative_phase_1" || input.step === "initiative_phase_2") {
    return input.events.some((event) => event.type === "initiative");
  }
  const acceptedTypes = COMPLETION_EVENT_TYPES_BY_STEP[input.step];
  if (!acceptedTypes) return false;
  return input.events.some(
    (event) =>
      acceptedTypes.includes(event.type as never) &&
      event.status !== "proposed" &&
      event.type !== "round_boundary",
  );
}
