// @vitest-environment happy-dom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CombatResultEnvelope } from "@glantri/domain";

import { CombatStepResultList } from "./CombatStepResultList";

function resultEnvelope(): CombatResultEnvelope {
  return {
    actionType: "adjust_distance_committed",
    affectedParticipants: [],
    calculationReferences: [],
    committedConsequences: [],
    conciseOutcome: { details: [], label: "Distance committed" },
    participants: [],
    privateDiagnostics: [],
    provenance: {
      completeness: "complete",
      occurredAt: null,
      sourceIds: [],
      sourceKind: "canonical",
    },
    publicCombatNote: "The combatants circle toward the doorway.",
    resultId: "distance-result",
    round: 1,
    schemaVersion: 1,
    sequence: 1,
    standardConsequences: [],
    step: "phase_1_actions",
    subordinateEventReferences: [],
    targets: [],
    visibility: {
      calculationAccess: "none",
      outcomeScope: "involved",
      privateDiagnosticsIncluded: false,
    },
  };
}

describe("CombatStepResultList", () => {
  it("renders accumulated outcomes with calculations collapsed by default", () => {
    render(
      <CombatStepResultList
        presentation={{
          boundary: "phase1_resolution",
          emptyState: "No results recorded for this character in the current step.",
          encounterId: "encounter-1",
          encounterRevision: "revision-1",
          entries: [
            {
              calculations: [
                {
                  calculationId: "calculation-1",
                  calculationType: "dodge",
                  completeness: "legacy_incomplete",
                  derivedValues: [{ label: "Dodge total", value: 17 }],
                  die: { openEndedComponents: [], rolledValue: 7 },
                  finalResult: { label: "Result", value: 24 },
                  label: "Dodge roll",
                  missingFacts: ["stat", "skill.xp"],
                  modifiers: [],
                  preDieTotal: { label: "Skill total", value: 17 },
                  visibility: "own",
                },
              ],
              category: "contest",
              heading: "Contest result",
              id: "entry-1",
              sourceEventIds: ["event-1"],
              state: "final",
              summary: "The Gladiator won the distance contest.",
            },
          ],
          participantId: "gladiator",
          phase: "phase1",
          roundNumber: 1,
        }}
      />,
    );

    expect(screen.getByRole("region", { name: "Current step results" })).toBeTruthy();
    expect(screen.getByText("The Gladiator won the distance contest.")).toBeTruthy();
    const summary = screen.getByText("Dodge roll calculation");
    expect(summary.closest("details")?.open).toBe(false);
    fireEvent.click(summary);
    expect(summary.closest("details")?.open).toBe(true);
    expect(screen.getByText("Dodge total: 17")).toBeTruthy();
  });

  it("renders the canonical current-step empty state", () => {
    render(
      <CombatStepResultList
        presentation={{
          boundary: "phase2_modifier_review",
          emptyState: "No results recorded for this character in the current step.",
          encounterId: "encounter-1",
          encounterRevision: "revision-2",
          entries: [],
          participantId: "gladiator",
          phase: "phase2",
          roundNumber: 1,
        }}
      />,
    );

    expect(
      screen.getByText("No results recorded for this character in the current step."),
    ).toBeTruthy();
  });

  it("renders the public combat note from the canonical current result envelope", () => {
    render(
      <CombatStepResultList
        presentation={{
          boundary: "phase1_resolution",
          emptyState: "No results recorded for this character in the current step.",
          encounterId: "encounter-1",
          encounterRevision: "revision-1",
          entries: [
            {
              calculations: [],
              category: "contest",
              heading: "Distance committed",
              id: "entry-1",
              resultEnvelopes: [resultEnvelope()],
              sourceEventIds: ["distance-result"],
              state: "final",
              summary: "The combatants changed distance.",
            },
          ],
          participantId: "gladiator",
          phase: "phase1",
          roundNumber: 1,
        }}
      />,
    );

    expect(screen.getByText("Combat note:")).toBeTruthy();
    expect(screen.getByText("The combatants circle toward the doorway.")).toBeTruthy();
  });
});
