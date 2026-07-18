import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  type CombatRoundStep,
  type CombatRoundStepStatus,
} from "@glantri/domain";

import type {
  CombatTrackerCellFacts,
  CombatTrackerCellView,
  CombatTrackerLegendItem,
  CombatTrackerMarkerKind,
  CombatTrackerModel,
  CombatTrackerRoundView,
  CombatTrackerRowView,
} from "../types";

export const COMBAT_TRACKER_MARKER_MEANINGS: readonly CombatTrackerLegendItem[] = [
  {
    kind: "attack_hit",
    label: "attack hit",
    marker: "H",
    title: "Attack resolved as a hit or grazing hit.",
  },
  { kind: "attack_miss", label: "attack miss", marker: "M", title: "Attack resolved as a miss." },
  {
    kind: "complete",
    label: "done",
    marker: "✓",
    title: "Completed, submitted, or ready for review.",
  },
  {
    kind: "required",
    label: "required action/roll",
    marker: "?",
    title: "A required choice or roll is blocking this step.",
  },
  {
    kind: "roll_result",
    label: "roll/result value",
    marker: "8",
    title: "Recorded roll or result value.",
  },
  {
    kind: "skipped",
    label: "skipped/not applicable",
    marker: "–",
    title: "Skipped, cancelled, locked, or not applicable.",
  },
  { kind: "not_reached", label: "not reached", marker: "·", title: "Step not reached yet." },
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

function statusKind(status: string | undefined): CombatTrackerMarkerKind {
  switch (status) {
    case "submitted":
    case "gmEdited":
    case "complete":
    case "ready":
      return "complete";
    case "locked":
    case "skipped":
      return "skipped";
    default:
      return "not_reached";
  }
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
  const pendingRoundEndRollCount =
    input.pendingDistanceControlRollCount + input.pendingHealthCheckRollCount;
  if (attackPhase(input.step) && input.phaseActionOpen === false) return "not_reached";
  if (input.phaseCombatExperienceMarkerRequired || pendingRoundEndRollCount > 0) return "required";
  if (input.initiativeTotal !== undefined) return "roll_result";
  if (input.step === "phase_1_actions" && input.feint) {
    if (input.feint.status === "committed") return "complete";
    if (input.feint.status === "impossible") return "skipped";
    return "required";
  }
  if (input.step === "phase_1_actions" && input.adjustDistance) {
    return input.adjustDistance.status === "committed" ? "complete" : "required";
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
    if (statusKind(input.status) === "complete") return "skipped";
    return input.activeTask ? "required" : statusKind(input.status);
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
    if (parryStatus === "pending" || input.activeTask) return "required";
    if (statusKind(input.status) === "complete") return "skipped";
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
    if (resolution || input.activeTask) return "required";
    if (statusKind(input.status) === "complete") return "skipped";
  }
  return statusKind(input.status);
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
  const pendingRollCount =
    input.pendingDistanceControlRollCount + input.pendingHealthCheckRollCount;
  if (input.phaseCombatExperienceMarkerRequired) return "phase CE required.";
  if (pendingRollCount > 0) {
    const details = [
      input.pendingHealthCheckRollCount
        ? `${input.pendingHealthCheckRollCount} health check${input.pendingHealthCheckRollCount === 1 ? "" : "s"}`
        : undefined,
      input.pendingDistanceControlRollCount
        ? `${input.pendingDistanceControlRollCount} distance-control roll${input.pendingDistanceControlRollCount === 1 ? "" : "s"}`
        : undefined,
    ].filter(Boolean);
    return `${pendingRollCount} round-end roll${pendingRollCount === 1 ? "" : "s"} pending${details.length ? ` (${details.join(", ")})` : ""}.`;
  }
  if (input.pendingDistanceControlCommitCount > 0)
    return `${input.pendingDistanceControlCommitCount} distance-control commit${input.pendingDistanceControlCommitCount === 1 ? "" : "s"} pending.`;
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
  cellFacts: readonly CombatTrackerCellFacts[];
  rounds: readonly CombatTrackerRoundView[];
  rows: readonly CombatTrackerRowView[];
  steps: readonly CombatRoundStep[];
}): CombatTrackerModel {
  const cells: Record<string, CombatTrackerCellView> = {};
  const markerKinds = new Set<CombatTrackerMarkerKind>();
  for (const facts of input.cellFacts) {
    const markerKind = getCombatTrackerCellMarkerKind(facts);
    const marker =
      facts.initiativeTotal !== undefined
        ? String(facts.initiativeTotal)
        : markerMeaning(markerKind).marker;
    const cellKey = buildCombatTrackerCellKey(facts);
    markerKinds.add(markerKind);
    cells[cellKey] = {
      cellKey,
      current: facts.current,
      hoverText: `${facts.participantLabel} · Round ${facts.roundNumber} · ${COMBAT_ROUND_STEP_ABBREVIATIONS[facts.step]}: ${cellDetail(facts)}`,
      initiativeValue: facts.initiativeTotal !== undefined,
      inspectable: facts.inspectable,
      marker,
      markerKind,
      participantId: facts.participantId,
      roundNumber: facts.roundNumber,
      selected: facts.selected,
      step: facts.step,
    };
  }
  return {
    cells,
    currentTaskCellKey: Object.values(cells).find(
      (cell) =>
        input.cellFacts.find((facts) => buildCombatTrackerCellKey(facts) === cell.cellKey)
          ?.activeTask,
    )?.cellKey,
    legend: COMBAT_TRACKER_MARKER_MEANINGS.filter((meaning) => markerKinds.has(meaning.kind)),
    rounds: [...input.rounds],
    rows: [...input.rows],
    selectedCellKey: Object.values(cells).find((cell) => cell.selected)?.cellKey,
    steps: input.steps,
  };
}
