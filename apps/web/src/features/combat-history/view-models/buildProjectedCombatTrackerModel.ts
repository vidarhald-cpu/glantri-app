import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  COMBAT_ROUND_STEPS,
  type CombatHistoryProjection,
  type CombatRoundStep,
  type ProjectedCombatHistoryEvent,
} from "@glantri/domain";

import type { CombatTrackerCellView, CombatTrackerMarkerKind, CombatTrackerModel } from "../types";
import {
  buildCombatTrackerCellKey,
  COMBAT_TRACKER_MARKER_MEANINGS,
} from "./buildCombatTrackerModel";

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
  current: boolean;
  events: readonly ProjectedCombatHistoryEvent[];
  hasSnapshot: boolean;
  stepOutcome?: CombatHistoryProjection["activeRound"]["snapshots"][number]["stepOutcome"];
}): { kind: CombatTrackerMarkerKind; marker: string } {
  const initiative = input.events.find((event) => event.type === "initiative");
  const initiativeTotal =
    initiative?.facts.privateCalculation?.total ??
    initiative?.facts.involvedOutcome?.total ??
    initiative?.facts.publicOutcome.total;
  if (typeof initiativeTotal === "number") {
    return { kind: "roll_result", marker: String(initiativeTotal) };
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
  if (feintEvent) {
    return { kind: "required", marker: "?" };
  }

  const skipped = input.events.some(
    (event) => event.status === "skipped" || event.status === "not_applicable",
  );
  if (skipped) return { kind: "skipped", marker: "–" };
  if (input.stepOutcome) return { kind: "skipped", marker: "–" };
  if (input.events.length || input.hasSnapshot) return { kind: "complete", marker: "✓" };
  if (input.current) return { kind: "required", marker: "?" };
  return { kind: "not_reached", marker: "·" };
}

function projectedFact(event: ProjectedCombatHistoryEvent, key: string): unknown {
  return event.facts.involvedOutcome?.[key] ?? event.facts.publicOutcome[key];
}

export function formatProjectedCombatTrackerHoverDetail(
  events: readonly ProjectedCombatHistoryEvent[],
): string | undefined {
  if (events.some((event) => event.type === "feint_impossible")) {
    return "feint ruled impossible; no roll required.";
  }
  const skipped = events.find(
    (event) => event.status === "skipped" || event.status === "not_applicable",
  );
  if (skipped) return skipped.status === "skipped" ? "skipped." : "not applicable.";

  const initiative = events.find((event) => event.type === "initiative");
  const initiativeTotal =
    initiative &&
    (projectedFact(initiative, "total") ?? initiative.facts.privateCalculation?.total);
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
  currentTask?: CombatHistoryInspectionSelection;
  history: CombatHistoryProjection;
  selected?: CombatHistoryInspectionSelection;
}): CombatTrackerModel {
  const rounds = [...input.history.archivedRounds, input.history.activeRound].map((round) => ({
    currentStep:
      round.roundNumber === input.history.activeRound.roundNumber
        ? input.currentTask?.step
        : undefined,
    roundNumber: round.roundNumber,
  }));
  const cells: Record<string, CombatTrackerCellView> = {};
  const markerKinds = new Set<CombatTrackerMarkerKind>();

  for (const row of input.history.rows) {
    for (const round of [...input.history.archivedRounds, input.history.activeRound]) {
      for (const step of COMBAT_ROUND_STEPS) {
        const selection = {
          participantId: row.participantId,
          roundNumber: round.roundNumber,
          step,
        };
        const cellEvents = getProjectedCombatHistoryCellEvents({
          history: input.history,
          selection,
        });
        const snapshot = round.snapshots.find(
          (candidate) =>
            candidate.participant.participantId === row.participantId && candidate.step === step,
        );
        const current =
          input.currentTask?.participantId === row.participantId &&
          input.currentTask.roundNumber === round.roundNumber &&
          input.currentTask.step === step;
        const selected =
          input.selected?.participantId === row.participantId &&
          input.selected.roundNumber === round.roundNumber &&
          input.selected.step === step;
        const marker = markerForEvents({
          current,
          events: cellEvents,
          hasSnapshot: Boolean(snapshot),
          stepOutcome: snapshot?.stepOutcome,
        });
        const cellKey = buildCombatTrackerCellKey(selection);
        const inspectable = current || Boolean(snapshot) || cellEvents.length > 0;
        const hoverDetail =
          snapshot?.stepOutcome?.message ?? formatProjectedCombatTrackerHoverDetail(cellEvents);
        markerKinds.add(marker.kind);
        cells[cellKey] = {
          cellKey,
          current,
          hoverText: `${row.displayName} · Round ${round.roundNumber} · ${COMBAT_ROUND_STEP_ABBREVIATIONS[step]}: ${
            hoverDetail ??
            (inspectable
              ? current
                ? "current task."
                : "incomplete legacy history."
              : "not reached.")
          }`,
          initiativeValue: marker.kind === "roll_result",
          inspectable,
          marker: marker.marker,
          markerKind: marker.kind,
          participantId: row.participantId,
          roundNumber: round.roundNumber,
          selected,
          step,
        };
      }
    }
  }

  return {
    cells,
    currentTaskCellKey: input.currentTask
      ? buildCombatTrackerCellKey(input.currentTask)
      : undefined,
    legend: COMBAT_TRACKER_MARKER_MEANINGS.filter((meaning) => markerKinds.has(meaning.kind)),
    rounds,
    rows: input.history.rows.map((row) => ({
      label: row.displayName,
      participantId: row.participantId,
      selected: input.selected?.participantId === row.participantId,
    })),
    selectedCellKey: input.selected ? buildCombatTrackerCellKey(input.selected) : undefined,
    steps: COMBAT_ROUND_STEPS,
  };
}
