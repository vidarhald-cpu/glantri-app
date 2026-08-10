import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  COMBAT_ROUND_STEPS,
  getCombatRoundStepForProgressionBoundary,
  type CombatHistoryProjection,
  type CombatProgressionPresentationProjection,
  type CombatRoundStep,
  type ProjectedCombatHistoryEvent,
} from "@glantri/domain";

import type {
  CombatTrackerCellView,
  CombatTrackerFacetPresentation,
  CombatTrackerLiveFacet,
  CombatTrackerMarkerKind,
  CombatTrackerModel,
} from "../types";
import {
  buildCombatTrackerCellKey,
  COMBAT_TRACKER_MARKER_MEANINGS,
} from "./buildCombatTrackerModel";
import { buildCombatProgressionTrackerIndex } from "./buildCombatProgressionTrackerModel";
import {
  getCombatTrackerFacetStatus,
  getCombatTrackerPendingMarkerKind,
} from "./combatTrackerTaskPresentation";
import { hasProjectedCombatTrackerCompletionEvidence } from "./combatTrackerCompletionEvidence";

export interface CombatHistoryInspectionSelection {
  participantId: string;
  roundNumber: number;
  step: CombatRoundStep;
}

function outcomeBoolean(
  event: ProjectedCombatHistoryEvent | undefined,
  key: "grazing" | "hit",
): boolean {
  return Boolean(event?.facts.involvedOutcome?.[key] ?? event?.facts.publicOutcome[key]);
}

function markerForEvents(input: {
  events: readonly ProjectedCombatHistoryEvent[];
  historical: boolean;
  initiativeCommitted: boolean;
  liveFacet?: CombatTrackerLiveFacet;
  stageReached: boolean;
  step: CombatRoundStep;
  stepOutcome?: CombatHistoryProjection["activeRound"]["snapshots"][number]["stepOutcome"];
}): { kind: CombatTrackerMarkerKind; marker: string } {
  if (!input.stageReached) return { kind: "not_reached", marker: "·" };

  const initiative = input.events.find((event) => event.type === "initiative");
  const initiativeTotal =
    initiative?.facts.privateCalculation?.total ??
    initiative?.facts.involvedOutcome?.total ??
    initiative?.facts.publicOutcome.total;
  if (initiative?.status === "skipped") {
    return { kind: "skipped", marker: "–" };
  }
  if (input.initiativeCommitted && typeof initiativeTotal === "number") {
    return { kind: "roll_result", marker: String(initiativeTotal) };
  }
  if (initiative) {
    return { kind: "complete", marker: "✓" };
  }

  const attack = input.events.find((event) => event.type === "attack");
  if (attack) {
    const hit = outcomeBoolean(attack, "hit") || outcomeBoolean(attack, "grazing");
    return { kind: hit ? "attack_hit" : "attack_miss", marker: hit ? "H" : "M" };
  }

  const feintEvent = [...input.events]
    .reverse()
    .find((event) =>
      ["feint_committed", "feint_impossible", "feint_result", "feint_roll"].includes(event.type),
    );
  if (feintEvent?.type === "feint_committed") {
    return { kind: "complete", marker: "✓" };
  }
  if (feintEvent?.type === "feint_impossible") {
    return { kind: "skipped", marker: "–" };
  }
  if (feintEvent && !input.liveFacet?.current) return { kind: "not_reached", marker: "·" };
  const adjustDistanceEvent = [...input.events]
    .reverse()
    .find((event) => event.type.startsWith("adjust_distance_"));
  if (adjustDistanceEvent?.type === "adjust_distance_committed") {
    return { kind: "complete", marker: "✓" };
  }
  if (adjustDistanceEvent?.type === "adjust_distance_roll" && !input.liveFacet?.current) {
    return { kind: "complete", marker: "✓" };
  }
  if (adjustDistanceEvent && !input.liveFacet?.current) return { kind: "not_reached", marker: "·" };

  const skipped = input.events.some(
    (event) => event.status === "skipped" || event.status === "not_applicable",
  );
  if (skipped) return { kind: "skipped", marker: "–" };
  if (input.stepOutcome) return { kind: "skipped", marker: "–" };
  if (
    input.liveFacet?.current &&
    input.liveFacet.taskKinds.includes("gm_advance_boundary") &&
    hasProjectedCombatTrackerCompletionEvidence({ events: input.events, step: input.step })
  ) {
    return { kind: "complete", marker: "✓" };
  }
  if (input.liveFacet?.current) {
    const kind = getCombatTrackerPendingMarkerKind(input.liveFacet);
    return { kind, marker: kind === "required" ? "?" : "·" };
  }
  const hasRecordedCompletion = initiative
    ? input.initiativeCommitted
    : hasProjectedCombatTrackerCompletionEvidence({ events: input.events, step: input.step });
  if (hasRecordedCompletion) return { kind: "complete", marker: "✓" };
  return { kind: "not_reached", marker: "·" };
}

function initiativeIsCommitted(input: {
  historical: boolean;
  progression?: CombatProgressionPresentationProjection;
  step: CombatRoundStep;
}): boolean {
  if (input.historical) return true;
  if (input.step !== "initiative_phase_1" && input.step !== "initiative_phase_2") return false;
  const boundary = input.progression?.boundary.kind;
  if (!boundary) return false;
  const boundaryOrder: readonly CombatProgressionPresentationProjection["boundary"]["kind"][] = [
    "declaration",
    "phase1_modifier_review",
    "phase1_initiative",
    "phase1_resolution",
    "phase2_modifier_review",
    "phase2_initiative",
    "phase2_resolution",
    "round_end",
    "round_boundary",
  ];
  const committedAfter =
    input.step === "initiative_phase_1" ? "phase1_initiative" : "phase2_initiative";
  return boundaryOrder.indexOf(boundary) > boundaryOrder.indexOf(committedAfter);
}

function projectedFact(event: ProjectedCombatHistoryEvent, key: string): unknown {
  return event.facts.involvedOutcome?.[key] ?? event.facts.publicOutcome[key];
}

export function formatProjectedCombatTrackerHoverDetail(
  events: readonly ProjectedCombatHistoryEvent[],
  options: { revealInitiativeTotal?: boolean } = {},
): string | undefined {
  if (events.some((event) => event.type === "feint_impossible")) {
    return "feint ruled impossible; no roll required.";
  }
  const initiative = events.find((event) => event.type === "initiative");
  const initiativeResolutionType =
    initiative &&
    (projectedFact(initiative, "resolutionType") ??
      initiative.facts.privateCalculation?.resolutionType);
  if (initiativeResolutionType === "bulk_skipped") {
    return "initiative bulk skipped by GM; effective initiative 0.";
  }
  if (initiativeResolutionType === "gm_skipped") {
    return "initiative skipped by GM; effective initiative 0.";
  }
  const skipped = events.find(
    (event) => event.status === "skipped" || event.status === "not_applicable",
  );
  if (skipped) return skipped.status === "skipped" ? "skipped." : "not applicable.";

  const initiativeTotal =
    initiative &&
    (projectedFact(initiative, "total") ?? initiative.facts.privateCalculation?.total);
  if (initiative && !options.revealInitiativeTotal) return "initiative roll recorded.";
  if (typeof initiativeTotal === "number") return `initiative total ${initiativeTotal}.`;

  const attack = events.find((event) => event.type === "attack");
  if (attack) {
    const attacker = attack.identities.find(
      (identity) => identity.role === "attacker" || identity.role === "actor",
    )?.displayName;
    const defender = attack.identities.find(
      (identity) => identity.role === "defender" || identity.role === "target",
    )?.displayName;
    const weapon = projectedFact(attack, "weaponName");
    const tableResult = projectedFact(attack, "tableResult");
    const outcome =
      typeof tableResult === "string"
        ? tableResult
        : projectedFact(attack, "grazing") === true
          ? "Grazing hit"
          : projectedFact(attack, "hit") === true
            ? "Hit"
            : "Miss";
    return attacker && defender
      ? `${attacker} attacked ${defender}${typeof weapon === "string" ? ` with ${weapon}` : ""}: ${outcome}.`
      : `attack: ${outcome.toLowerCase()}.`;
  }

  const parry = events.find((event) => event.type === "parry");
  if (parry) {
    const status = projectedFact(parry, "status");
    if (status === "not_required" || status === "not_needed") return "parry not needed.";
    const success = projectedFact(parry, "success");
    if (typeof success === "boolean") return success ? "parry succeeded." : "parry failed.";
    return status === "pending" ? "parry pending." : "parry resolved.";
  }

  const damage = [...events]
    .reverse()
    .find((event) => event.type === "damage_committed" || event.type === "damage_proposed");
  if (damage) {
    if (damage.type === "damage_committed" || damage.status === "committed") {
      return "damage committed.";
    }
    return damage.status === "not_applicable" ? "damage not applicable." : "damage pending.";
  }

  const feint = [...events]
    .reverse()
    .find((event) =>
      [
        "feint_committed",
        "feint_impossible",
        "feint_result",
        "feint_roll",
        "feint_feasibility",
      ].includes(event.type),
    );
  if (feint) {
    if (feint.type === "feint_committed") {
      const attacker = feint.identities.find(
        (identity) => identity.role === "attacker" || identity.role === "actor",
      )?.displayName;
      const defender = feint.identities.find(
        (identity) => identity.role === "defender" || identity.role === "target",
      )?.displayName;
      const methodFact = projectedFact(feint, "method");
      const method = typeof methodFact === "string" ? methodFact.toLowerCase() : undefined;
      const modifier = projectedFact(feint, "defenderPhase2SkillObModifier");
      return attacker && defender
        ? `${attacker} completed a ${method ?? ""} feint against ${defender}. Result: defender OB/DB ${typeof modifier === "number" && modifier >= 0 ? "+" : ""}${typeof modifier === "number" ? modifier : "adjusted"} in Phase 2.`.replace(
            "a  feint",
            "a feint",
          )
        : "feint result committed.";
    }
    if (feint.type === "feint_result") return "feint result awaiting GM review.";
    if (feint.type === "feint_roll") return "feint opposed roll in progress.";
    return "feint opposed rolls pending.";
  }

  const adjustment = [...events]
    .reverse()
    .find((event) => event.type.startsWith("adjust_distance_"));
  if (adjustment) {
    if (adjustment.type === "adjust_distance_committed") {
      const previous = projectedFact(adjustment, "previousDistance");
      const committed = projectedFact(adjustment, "committedDistance");
      return `distance adjustment complete${typeof previous === "number" && typeof committed === "number" ? `: ${previous} → ${committed}` : ""}.`;
    }
    if (adjustment.type === "adjust_distance_result")
      return "distance adjustment awaiting GM review.";
    return "distance-adjustment response or rolls pending.";
  }

  const declaration = events.find((event) => event.type === "declaration");
  if (declaration) return "action declared.";
  return undefined;
}

export function getProjectedCombatHistoryCellEvents(input: {
  history: CombatHistoryProjection;
  selection: CombatHistoryInspectionSelection;
}): ProjectedCombatHistoryEvent[] {
  const round = [...input.history.archivedRounds, input.history.activeRound].find(
    (candidate) => candidate.roundNumber === input.selection.roundNumber,
  );
  return (round?.events ?? [])
    .filter(
      (event) =>
        event.ownerParticipantId === input.selection.participantId &&
        event.step === input.selection.step,
    )
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
}

export function buildProjectedCombatTrackerModel(input: {
  history: CombatHistoryProjection;
  operationalParticipantId?: string;
  selected?: CombatHistoryInspectionSelection;
}): CombatTrackerModel {
  const progressionIndex = buildCombatProgressionTrackerIndex(input.history.progression);
  const activeRoundNumber = input.history.activeRound.roundNumber;
  const currentStep =
    progressionIndex.currentStep ??
    (input.history.progression
      ? getCombatRoundStepForProgressionBoundary(input.history.progression.boundary.kind)
      : undefined);
  const rounds = [...input.history.archivedRounds, input.history.activeRound].map((round) => ({
    currentStep: round.roundNumber === activeRoundNumber ? currentStep : undefined,
    roundNumber: round.roundNumber,
  }));
  const cells: Record<string, CombatTrackerCellView> = {};
  const cellEventsByKey = new Map<string, ProjectedCombatHistoryEvent[]>();
  const snapshotByKey = new Map<
    string,
    CombatHistoryProjection["activeRound"]["snapshots"][number]
  >();
  for (const round of [...input.history.archivedRounds, input.history.activeRound]) {
    for (const event of round.events) {
      if (!event.ownerParticipantId) continue;
      const key = buildCombatTrackerCellKey({
        participantId: event.ownerParticipantId,
        roundNumber: round.roundNumber,
        step: event.step,
      });
      cellEventsByKey.set(key, [...(cellEventsByKey.get(key) ?? []), event]);
    }
    for (const snapshot of round.snapshots) {
      snapshotByKey.set(
        buildCombatTrackerCellKey({
          participantId: snapshot.participant.participantId,
          roundNumber: round.roundNumber,
          step: snapshot.step,
        }),
        snapshot,
      );
    }
  }
  for (const events of cellEventsByKey.values()) {
    events.sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
  }

  const executionOrder = input.history.progression?.executionOrder?.participantIds;
  const orderIndex = new Map(executionOrder?.map((participantId, index) => [participantId, index]));
  const rows = [...input.history.rows].sort((left, right) => {
    if (!orderIndex?.size) return 0;
    return (
      (orderIndex.get(left.participantId) ?? Number.MAX_SAFE_INTEGER) -
      (orderIndex.get(right.participantId) ?? Number.MAX_SAFE_INTEGER)
    );
  });
  const currentTaskCellKey = rows
    .map((row) =>
      currentStep
        ? buildCombatTrackerCellKey({
            participantId: row.participantId,
            roundNumber: activeRoundNumber,
            step: currentStep,
          })
        : undefined,
    )
    .find((cellKey) => cellKey !== undefined && progressionIndex.byCellKey[cellKey]?.current);
  const canonicalOwnerParticipantId = rows.find((row) => {
    if (!currentStep) return false;
    const cellKey = buildCombatTrackerCellKey({
      participantId: row.participantId,
      roundNumber: activeRoundNumber,
      step: currentStep,
    });
    return progressionIndex.byCellKey[cellKey]?.current;
  })?.participantId;
  const requestedOperationalParticipantId = input.operationalParticipantId;
  const requestedOperationalParticipantIsVisible = rows.some(
    (row) => row.participantId === requestedOperationalParticipantId,
  );
  const operationalParticipantId =
    canonicalOwnerParticipantId ??
    (requestedOperationalParticipantId && requestedOperationalParticipantIsVisible
      ? requestedOperationalParticipantId
      : undefined);
  const operationalSelection =
    currentStep && operationalParticipantId
      ? {
          participantId: operationalParticipantId,
          roundNumber: activeRoundNumber,
          step: currentStep,
        }
      : undefined;
  const selectedRoundIsActive = input.selected?.roundNumber === activeRoundNumber;
  const selectedStepIndex = input.selected ? COMBAT_ROUND_STEPS.indexOf(input.selected.step) : -1;
  const currentStepIndex = currentStep ? COMBAT_ROUND_STEPS.indexOf(currentStep) : -1;
  const selectedStageReached =
    input.selected !== undefined &&
    (!selectedRoundIsActive || currentStepIndex < 0 || selectedStepIndex <= currentStepIndex);
  const cursorSelection = selectedStageReached ? input.selected : operationalSelection;
  const operationalCursorCellKey = operationalSelection
    ? buildCombatTrackerCellKey(operationalSelection)
    : undefined;

  for (const row of rows) {
    for (const round of [...input.history.archivedRounds, input.history.activeRound]) {
      for (const step of COMBAT_ROUND_STEPS) {
        const selection = {
          participantId: row.participantId,
          roundNumber: round.roundNumber,
          step,
        };
        const cellKey = buildCombatTrackerCellKey(selection);
        const cellEvents = cellEventsByKey.get(cellKey) ?? [];
        const participantResultEvents = cellEvents.filter(
          (event) => event.type !== "round_boundary",
        );
        const snapshot = snapshotByKey.get(cellKey);
        const liveFacet =
          round.roundNumber === activeRoundNumber ? progressionIndex.byCellKey[cellKey] : undefined;
        const current = Boolean(liveFacet?.current);
        const selected =
          cursorSelection?.participantId === row.participantId &&
          cursorSelection.roundNumber === round.roundNumber &&
          cursorSelection.step === step;
        const historical = round.roundNumber !== activeRoundNumber;
        const stageReached =
          historical ||
          currentStepIndex < 0 ||
          COMBAT_ROUND_STEPS.indexOf(step) <= currentStepIndex;
        const initiativeCommitted = initiativeIsCommitted({
          historical: round.roundNumber !== activeRoundNumber,
          progression: input.history.progression,
          step,
        });
        const marker = markerForEvents({
          events: participantResultEvents,
          historical: round.roundNumber !== activeRoundNumber,
          initiativeCommitted,
          liveFacet,
          stageReached,
          step,
          stepOutcome: snapshot?.stepOutcome,
        });
        const inspectable =
          stageReached &&
          (current || selected || Boolean(snapshot) || participantResultEvents.length > 0);
        const hoverDetail =
          liveFacet?.hover.text ??
          snapshot?.stepOutcome?.message ??
          formatProjectedCombatTrackerHoverDetail(participantResultEvents, {
            revealInitiativeTotal: initiativeCommitted,
          });
        const fallbackHoverText = inspectable ? "Recorded history is incomplete." : "Not opened.";
        const hover =
          liveFacet?.hover ??
          ({
            actionLabel: COMBAT_ROUND_STEP_ABBREVIATIONS[step],
            gmActionRequired: false,
            text: hoverDetail ?? fallbackHoverText,
            waiting: false,
          } as const);
        cells[cellKey] = {
          attention: liveFacet?.attention ?? "ordinary",
          cellKey,
          completed: !["not_reached", "required"].includes(marker.kind),
          current,
          executable: Boolean(liveFacet?.executable),
          executionGroupIds: liveFacet?.executionGroupIds ?? [],
          gmProxyAvailable: Boolean(liveFacet?.gmProxyAvailable),
          historical,
          hover,
          hoverText: `${row.displayName} · Round ${round.roundNumber} · ${COMBAT_ROUND_STEP_ABBREVIATIONS[step]}: ${
            hover.text
          }`,
          initiativeValue: marker.kind === "roll_result",
          inspectable,
          marker: marker.marker as CombatTrackerFacetPresentation["marker"],
          markerKind: marker.kind,
          participantId: row.participantId,
          ownerParticipantIds: liveFacet?.ownerParticipantIds ?? [],
          processIds: liveFacet?.processIds ?? [],
          roundNumber: round.roundNumber,
          selected,
          status: getCombatTrackerFacetStatus({ historical, liveFacet, markerKind: marker.kind }),
          stageIds: liveFacet?.stageIds ?? [],
          step,
          taskIds: liveFacet?.taskIds ?? [],
          taskKinds: liveFacet?.taskKinds ?? [],
          waiting: Boolean(liveFacet?.waiting),
        };
      }
    }
  }

  return {
    cells,
    currentTaskCellKey,
    legend: COMBAT_TRACKER_MARKER_MEANINGS,
    operationalCursorCellKey,
    rounds,
    rows: rows.map((row) => ({
      label: row.displayName,
      participantId: row.participantId,
      selected: cursorSelection?.participantId === row.participantId,
    })),
    selectedCellKey: cursorSelection ? buildCombatTrackerCellKey(cursorSelection) : undefined,
    steps: COMBAT_ROUND_STEPS,
  };
}
