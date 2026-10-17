import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  type CombatRoundStep,
  type CombatRoundStepStatus,
} from "@glantri/domain";

import type {
  CombatTrackerCellFacts,
  CombatTrackerCellView,
  CombatTrackerFacetPresentation,
  CombatTrackerLegendItem,
  CombatTrackerMarkerKind,
  CombatTrackerModel,
  CombatTrackerRoundView,
  CombatTrackerRowView,
} from "../types";
import {
  getCombatTrackerFacetStatus,
  getCombatTrackerPendingMarkerKind,
} from "./combatTrackerTaskPresentation";
import { getCombatTrackerStatusCompletionKind } from "./combatTrackerCompletionEvidence";

export const COMBAT_TRACKER_MARKER_MEANINGS: readonly CombatTrackerLegendItem[] = [
  {
    kind: "not_reached",
    label: "no outcome / unopened / ordinary pending",
    marker: "·",
    title: "No recorded outcome, unopened work, or ordinary pending work.",
  },
  {
    kind: "required",
    label: "exceptional required work / response",
    marker: "?",
    title: "Exceptional required work or response currently needs attention.",
  },
  {
    kind: "complete",
    label: "completed / submitted / reviewed",
    marker: "✓",
    title: "Completed, submitted, or reviewed.",
  },
  {
    kind: "skipped",
    label: "final unsuccessful / skipped / cancelled / not applicable",
    marker: "–",
    title: "Final unsuccessful, skipped, cancelled, or not applicable.",
  },
  {
    kind: "attack_hit",
    label: "attack hit",
    marker: "H",
    title: "Attack hit.",
  },
  { kind: "attack_miss", label: "attack missed", marker: "M", title: "Attack missed." },
  {
    kind: "roll_result",
    label: "committed initiative",
    marker: "8",
    title: "Committed initiative.",
  },
] as const;

export function buildCombatTrackerCellKey(input: {
  participantId: string;
  roundNumber: number;
  step: CombatRoundStep;
}): string {
  return `${input.roundNumber}:${input.participantId}:${input.step}`;
}

function attackPhase(step: CombatRoundStep): boolean {
  return step === "phase_1_actions" || step === "phase_2_actions";
}

function markerMeaning(kind: CombatTrackerMarkerKind): CombatTrackerLegendItem {
  return (
    COMBAT_TRACKER_MARKER_MEANINGS.find((meaning) => meaning.kind === kind) ??
    COMBAT_TRACKER_MARKER_MEANINGS.at(-1)!
  );
}

export function getCombatTrackerCellMarkerKind(
  input: CombatTrackerCellFacts,
): CombatTrackerMarkerKind {
  if (
    input.initiativeResolutionType === "bulk_skipped" ||
    input.initiativeResolutionType === "gm_skipped"
  )
    return "skipped";
  if (input.initiativeCommitted && input.initiativeTotal !== undefined) return "roll_result";
  if (input.initiativeRollRecorded) return "complete";
  if (
    !attackPhase(input.step) &&
    input.progression?.current &&
    input.progression.taskKinds.includes("gm_advance_boundary") &&
    getCombatTrackerStatusCompletionKind(input.status) === "complete"
  ) {
    return "complete";
  }
  if (input.step === "phase_1_actions" && input.feint) {
    if (input.feint.status === "committed") return "complete";
    if (input.feint.status === "impossible") return "skipped";
    return getCombatTrackerPendingMarkerKind(input.progression);
  }
  if (input.step === "phase_1_actions" && input.adjustDistanceRollRecorded) {
    return "complete";
  }
  if (input.step === "phase_1_actions" && input.adjustDistance) {
    return input.adjustDistance.status === "committed"
      ? "complete"
      : getCombatTrackerPendingMarkerKind(input.progression);
  }
  if (input.stepOutcome) return "skipped";
  if (attackPhase(input.step)) {
    if (input.attackResult)
      return input.attackResult.hit || input.attackResult.grazing ? "attack_hit" : "attack_miss";
    if (
      input.actionResultStatus === "skipped" ||
      input.actionResultStatus === "no_attack" ||
      input.status === "skipped" ||
      input.status === "locked"
    )
      return "skipped";
    if (getCombatTrackerStatusCompletionKind(input.status) === "complete") return "skipped";
    return input.progression?.current
      ? getCombatTrackerPendingMarkerKind(input.progression)
      : getCombatTrackerStatusCompletionKind(input.status);
  }
  if (input.step === "review_phase_2_actions" || input.step === "review_phase_2_damage") {
    const parryStatus = input.phaseResolutionResult?.parryResolution.status;
    if (parryStatus === "resolved") return "complete";
    if (
      parryStatus === "not_applicable" ||
      input.actionResultStatus === "no_attack" ||
      input.actionResultStatus === "skipped" ||
      input.status === "skipped" ||
      input.status === "locked"
    )
      return "skipped";
    if (input.progression?.current) return getCombatTrackerPendingMarkerKind(input.progression);
    if (getCombatTrackerStatusCompletionKind(input.status) === "complete") return "skipped";
  }
  if (input.step === "phase_1_damage" || input.step === "phase_2_damage") {
    const resolution = input.phaseResolutionResult;
    if (resolution?.damageProposal.status === "committed") return "complete";
    if (
      resolution?.damageRoll.status === "not_required" ||
      input.actionResultStatus === "no_attack" ||
      input.actionResultStatus === "skipped" ||
      input.status === "skipped" ||
      input.status === "locked"
    )
      return "skipped";
    if (input.progression?.current) return getCombatTrackerPendingMarkerKind(input.progression);
    if (getCombatTrackerStatusCompletionKind(input.status) === "complete") return "skipped";
  }
  return input.progression?.current
    ? getCombatTrackerPendingMarkerKind(input.progression)
    : getCombatTrackerStatusCompletionKind(input.status);
}

function initiativeSource(input: CombatTrackerCellFacts): string {
  if (input.status !== "gmEdited") return "";
  const type =
    input.step === "initiative_phase_1"
      ? "roll_initiative_phase1"
      : input.step === "initiative_phase_2"
        ? "roll_initiative_phase2"
        : undefined;
  if (!type) return ", resolved by GM";
  const command = [...input.commands]
    .reverse()
    .find(
      (candidate) =>
        candidate.type === type &&
        candidate.participantId === input.participantId &&
        candidate.roundNumber === input.roundNumber,
    );
  const source = typeof command?.facts.source === "string" ? command.facts.source : undefined;
  const status = typeof command?.facts.status === "string" ? command.facts.status : undefined;
  if (source === "gm_override" || status === "gm_override") return ", GM override";
  if (source === "gm_proxy" || status === "gmEdited") return ", rolled by GM";
  return command ? "" : ", resolved by GM";
}

function declarationDetail(input: CombatTrackerCellFacts): string | undefined {
  if (input.step !== "select_actions") return undefined;
  const command = [...input.commands]
    .reverse()
    .find(
      (candidate) =>
        candidate.type === "declare_action" &&
        candidate.participantId === input.participantId &&
        candidate.roundNumber === input.roundNumber,
    );
  const source = typeof command?.facts.source === "string" ? command.facts.source : undefined;
  const status = typeof command?.facts.status === "string" ? command.facts.status : undefined;
  if (source === "gm_override" || status === "gm_override") return "GM override.";
  if (
    input.declarationSubmittedBy === "player" ||
    status === "submitted" ||
    input.status === "submitted"
  )
    return "declared by player.";
  if (input.declarationSubmittedBy === "gm" || status === "gmEdited" || input.status === "gmEdited")
    return "declared by GM.";
  return undefined;
}

function statusLabel(status: CombatRoundStepStatus): string {
  return status === "gmEdited" ? "GM edited" : status[0].toUpperCase() + status.slice(1);
}

function stepNoun(step: CombatRoundStep): string {
  const nouns: Record<CombatRoundStep, string> = {
    pre_declaration: "Combat Experience check",
    select_actions: "declaration",
    review_action_modifiers: "phase 1 modifiers",
    initiative_phase_1: "initiative",
    phase_1_actions: "attack/action",
    review_phase_2_actions: "parry/defense",
    phase_1_damage: "damage/effects",
    review_phase_2_modifiers: "phase 2 modifiers",
    initiative_phase_2: "initiative",
    phase_2_actions: "attack/action",
    review_phase_2_damage: "parry/defense",
    phase_2_damage: "damage/effects",
    round_summary: "round-end review",
  };
  return nouns[step];
}

function cellDetail(input: CombatTrackerCellFacts): string {
  if (input.initiativeResolutionType === "bulk_skipped")
    return "initiative bulk skipped by GM; effective initiative 0.";
  if (input.initiativeResolutionType === "gm_skipped")
    return "initiative skipped by GM; effective initiative 0.";
  if (input.initiativeRollRecorded && !input.initiativeCommitted)
    return "initiative roll recorded; awaiting GM commit.";
  if (input.progression?.current) {
    return input.progression.hover.text;
  }
  if (input.initiativeTotal !== undefined)
    return `initiative ${input.initiativeTotal}${initiativeSource(input)}.`;
  if (input.step === "phase_1_actions" && input.feint) {
    if (input.feint.status === "committed") {
      const target = input.feint.defenderLabel ? ` against ${input.feint.defenderLabel}` : "";
      const modifier = input.feint.defenderPhase2Modifier;
      const result =
        typeof modifier === "number"
          ? ` Result: defender OB/DB ${modifier >= 0 ? "+" : ""}${modifier} in Phase 2.`
          : "";
      return `completed a ${input.feint.method} feint${target}.${result}`;
    }
    if (input.feint.status === "impossible") return "feint ruled impossible.";
    return input.feint.status === "pending"
      ? "feint opposed rolls/review pending."
      : "feint pending.";
  }
  if (input.step === "phase_1_actions" && input.adjustDistanceRollRecorded) {
    return "Dodge roll recorded for the distance contest.";
  }
  if (input.step === "phase_1_actions" && input.adjustDistance) {
    const target = input.adjustDistance.defenderLabel
      ? ` against ${input.adjustDistance.defenderLabel}`
      : "";
    return input.adjustDistance.status === "committed"
      ? `completed a distance adjustment${target}. Distance: ${input.adjustDistance.currentDistance} → ${input.adjustDistance.committedDistance ?? input.adjustDistance.currentDistance}.`
      : "distance-adjustment response, rolls, or review pending.";
  }
  if (input.stepOutcome) return input.stepOutcome.message;
  if (input.attackResult) {
    const outcome = input.attackResult.grazing
      ? "grazing hit"
      : input.attackResult.hit
        ? "hit"
        : "miss";
    const identities =
      input.attackAttackerLabel && input.attackDefenderLabel
        ? `${input.attackAttackerLabel} attacked ${input.attackDefenderLabel} with ${input.attackResult.weaponName}: `
        : "attack ";
    return `${identities}${outcome}; ${input.attackResult.tableResult}.`;
  }
  const parry = input.phaseResolutionResult?.parryResolution;
  if (input.step === "review_phase_2_actions" || input.step === "review_phase_2_damage") {
    if (parry?.status === "resolved") return parry.success ? "parry succeeded." : "parry failed.";
    // Forgejo #676. A step that was reached and found no eligible Parry source is not a step that
    // was never needed, and the tracker has to say which of the two actually happened.
    if (parry?.noEligibleParrySource) return "no Parry available; advanced to damage.";
    if (
      parry?.status === "not_applicable" ||
      input.status === "skipped" ||
      input.status === "locked"
    )
      return "parry not needed.";
    if (parry?.status === "pending") return "parry roll pending.";
  }
  if (input.step === "phase_1_damage" || input.step === "phase_2_damage") {
    if (input.phaseResolutionResult?.damageProposal.status === "committed")
      return "damage/effects review committed.";
    if (
      input.phaseResolutionResult?.damageRoll.status === "not_required" ||
      input.status === "skipped" ||
      input.status === "locked"
    )
      return "damage not applicable.";
    if (input.phaseResolutionResult) return "location/critical/damage review pending.";
  }
  const declaration = declarationDetail(input);
  if (declaration) return declaration;
  if (input.status === "skipped")
    return attackPhase(input.step) ? "attack skipped." : "skipped/not applicable.";
  if (input.status === "locked") return "locked/not applicable.";
  if (input.status === "pending")
    return input.step === "select_actions"
      ? "declaration pending."
      : input.step === "initiative_phase_1"
        ? "phase 1 initiative roll pending."
        : input.step === "initiative_phase_2"
          ? "phase 2 initiative roll pending."
          : input.step === "round_summary"
            ? "round-end review pending."
            : "not reached.";
  const noun = stepNoun(input.step);
  if (input.status === "gmEdited") return `${noun} resolved by GM.`;
  if (input.status === "submitted") return `${noun} submitted.`;
  if (input.status === "ready") return `${noun} ready for review.`;
  if (input.status === "complete") return `${noun} complete.`;
  return `${statusLabel(input.status).toLowerCase()}.`;
}

export function buildCombatTrackerModel(input: {
  activeRoundNumber?: number;
  cellFacts: readonly CombatTrackerCellFacts[];
  rounds: readonly CombatTrackerRoundView[];
  rows: readonly CombatTrackerRowView[];
  steps: readonly CombatRoundStep[];
}): CombatTrackerModel {
  const cells: Record<string, CombatTrackerCellView> = {};
  const activeRoundNumber =
    input.activeRoundNumber ?? Math.max(...input.rounds.map((round) => round.roundNumber));
  for (const facts of input.cellFacts) {
    const markerKind = getCombatTrackerCellMarkerKind(facts);
    const marker: CombatTrackerFacetPresentation["marker"] =
      markerKind === "roll_result" &&
      facts.initiativeCommitted &&
      facts.initiativeTotal !== undefined
        ? (String(facts.initiativeTotal) as CombatTrackerFacetPresentation["marker"])
        : (markerMeaning(markerKind).marker as CombatTrackerFacetPresentation["marker"]);
    const cellKey = buildCombatTrackerCellKey(facts);
    const historical = facts.roundNumber !== activeRoundNumber;
    const detail = cellDetail(facts);
    const hover =
      facts.progression?.hover ??
      ({
        actionLabel: stepNoun(facts.step),
        gmActionRequired: false,
        text: detail,
        waiting: false,
      } as const);
    cells[cellKey] = {
      attention: facts.progression?.attention ?? "ordinary",
      cellKey,
      completed: !["not_reached", "required"].includes(markerKind),
      current: Boolean(facts.progression?.current),
      executable: Boolean(facts.progression?.executable),
      executionGroupIds: facts.progression?.executionGroupIds ?? [],
      gmProxyAvailable: Boolean(facts.progression?.gmProxyAvailable),
      historical,
      hover,
      hoverText: `${facts.participantLabel} · Round ${facts.roundNumber} · ${COMBAT_ROUND_STEP_ABBREVIATIONS[facts.step]}: ${hover.text}`,
      initiativeValue: Boolean(
        markerKind === "roll_result" &&
        facts.initiativeCommitted &&
        facts.initiativeTotal !== undefined,
      ),
      inspectable: facts.inspectable,
      marker,
      markerKind,
      participantId: facts.participantId,
      ownerParticipantIds: facts.progression?.ownerParticipantIds ?? [],
      processIds: facts.progression?.processIds ?? [],
      roundNumber: facts.roundNumber,
      selected: facts.selected,
      status: getCombatTrackerFacetStatus({
        historical,
        liveFacet: facts.progression,
        markerKind,
      }),
      stageIds: facts.progression?.stageIds ?? [],
      step: facts.step,
      taskIds: facts.progression?.taskIds ?? [],
      taskKinds: facts.progression?.taskKinds ?? [],
      waiting: Boolean(facts.progression?.waiting),
    };
  }
  const currentTaskCellKey = Object.values(cells).find(
    (cell) =>
      input.cellFacts.find((facts) => buildCombatTrackerCellKey(facts) === cell.cellKey)
        ?.progression?.current,
  )?.cellKey;
  return {
    cells,
    currentTaskCellKey,
    legend: COMBAT_TRACKER_MARKER_MEANINGS,
    operationalCursorCellKey: currentTaskCellKey,
    rounds: [...input.rounds],
    rows: [...input.rows],
    selectedCellKey: Object.values(cells).find((cell) => cell.selected)?.cellKey,
    steps: input.steps,
  };
}
