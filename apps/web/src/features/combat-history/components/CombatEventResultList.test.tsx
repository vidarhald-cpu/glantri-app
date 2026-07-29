// @vitest-environment happy-dom

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CombatResultEnvelope, ProjectedCombatHistoryEvent } from "@glantri/domain";

import { CombatEventResultList } from "./CombatEventResultList";

function event(
  id: string,
  sequence: number,
  facts: ProjectedCombatHistoryEvent["facts"],
): ProjectedCombatHistoryEvent {
  return {
    completeness: "complete",
    facts,
    id,
    identities: [],
    missingFacts: [],
    occurredAt: null,
    roundNumber: 1,
    sequence,
    status: "recorded",
    step: "phase_1_actions",
    type: "attack",
  };
}

function resultEnvelope(): CombatResultEnvelope {
  return {
    actionType: "feint_committed",
    actor: {
      displayName: "The Gladiator",
      participantId: "gladiator",
      role: "actor",
      visibility: "visible",
    },
    affectedParticipants: [],
    calculationReferences: [],
    committedConsequences: [],
    conciseOutcome: { details: [], label: "Feint committed" },
    participants: [],
    privateDiagnostics: [],
    provenance: {
      completeness: "complete",
      occurredAt: null,
      sourceIds: [],
      sourceKind: "canonical",
    },
    publicCombatNote: "The opening draws the defender off balance.",
    resultId: "feint-result",
    round: 1,
    schemaVersion: 1,
    sequence: 1,
    standardConsequences: [],
    step: "phase_1_actions",
    subordinateEventReferences: [],
    targets: [],
    visibility: {
      calculationAccess: "full",
      outcomeScope: "involved",
      privateDiagnosticsIncluded: false,
    },
  };
}

describe("CombatEventResultList", () => {
  it("renders the selected-log empty state without substituting another result", () => {
    render(
      <CombatEventResultList
        emptyMessage="The selected Combat Log event has no Action Outcome details."
        events={[]}
        title="Action Outcome"
      />,
    );

    expect(screen.getByRole("region", { name: "Action Outcome" })).toBeTruthy();
    expect(
      screen.getByText("The selected Combat Log event has no Action Outcome details."),
    ).toBeTruthy();
  });

  it("renders a prebuilt archived result model without rebuilding from event input", () => {
    render(
      <CombatEventResultList
        events={[]}
        model={{
          items: [
            {
              calculationRows: [],
              id: "archived-result",
              outcomeRows: [],
              sequence: 1,
              summary: "Archived calculation snapshot",
              title: "Attack",
              type: "attack",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Archived calculation snapshot")).toBeTruthy();
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders one concise attack outcome without duplicate React keys", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <CombatEventResultList
        events={[
          event("attack-1", 1, {
            involvedOutcome: { hit: false },
            publicOutcome: { hit: false },
          }),
        ]}
      />,
    );

    expect(screen.getAllByText("Result: Miss")).toHaveLength(1);
    expect(screen.queryByText("Hit: No")).toBeNull();
    expect(consoleError.mock.calls.some((call) => String(call[0]).includes("same key"))).toBe(
      false,
    );
  });

  it("renders the public combat note from the canonical historical envelope", () => {
    render(
      <CombatEventResultList
        events={[
          {
            ...event("feint-result", 1, { publicOutcome: {} }),
            resultEnvelope: resultEnvelope(),
            type: "feint_committed",
          },
        ]}
      />,
    );

    expect(screen.getByText("Combat note:")).toBeTruthy();
    expect(screen.getByText("The opening draws the defender off balance.")).toBeTruthy();
  });

  it("keeps identical attack results across events in chronological order", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <CombatEventResultList
        events={[
          event("attack-later", 2, { publicOutcome: { hit: false } }),
          event("attack-first", 1, {
            privateCalculation: { defenderDb: 15, lookupTotal: 3, ob: 10, rollTotal: 8 },
            publicOutcome: { hit: false },
          }),
        ]}
      />,
    );

    expect(screen.getAllByText("Result: Miss")).toHaveLength(2);
    expect(screen.getAllByText("Attack recorded.")).toHaveLength(2);
    const articles = screen.getAllByRole("article");
    expect(articles[0]?.textContent).toContain("Calculation");
    expect(articles[1]?.textContent).not.toContain("Calculation");
    expect(consoleError.mock.calls.some((call) => String(call[0]).includes("same key"))).toBe(
      false,
    );
  });

  it("keeps each event calculation independently collapsed by default", () => {
    render(
      <CombatEventResultList
        events={[
          event("attack-first", 1, {
            privateCalculation: { defenderDb: 15, lookupTotal: 3, ob: 10, rollTotal: 8 },
            publicOutcome: { hit: false },
          }),
          event("attack-second", 2, {
            privateCalculation: { defenderDb: 12, lookupTotal: 6, ob: 11, rollTotal: 7 },
            publicOutcome: { hit: true },
          }),
        ]}
      />,
    );

    const articles = screen.getAllByRole("article");
    const firstToggle = within(articles[0]!).getByRole("button", { name: "Calculation" });
    const secondToggle = within(articles[1]!).getByRole("button", { name: "Calculation" });

    expect(firstToggle.getAttribute("aria-expanded")).toBe("false");
    expect(secondToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("OB 10 + roll 8 - DB 15 = 3")).toBeNull();

    fireEvent.click(firstToggle);
    expect(firstToggle.getAttribute("aria-expanded")).toBe("true");
    expect(secondToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("OB 10 + roll 8 - DB 15 = 3")).toBeTruthy();
    expect(screen.queryByText("OB 11 + roll 7 - DB 12 = 6")).toBeNull();

    fireEvent.click(firstToggle);
    expect(firstToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("OB 10 + roll 8 - DB 15 = 3")).toBeNull();
  });
});
