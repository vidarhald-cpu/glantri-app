// @vitest-environment happy-dom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CombatStepResultList } from "./CombatStepResultList";

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
                  collapsedByDefault: true,
                  id: "calculation-1",
                  lines: ["Skill: Dodge 17", "Result: 24"],
                  title: "Dodge roll",
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
    expect(screen.getByText("Skill: Dodge 17")).toBeTruthy();
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
});
