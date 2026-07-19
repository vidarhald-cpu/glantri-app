// @vitest-environment happy-dom

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectedCombatHistoryEvent } from "@glantri/domain";

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

describe("CombatEventResultList", () => {
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
    expect(
      consoleError.mock.calls.some((call) => String(call[0]).includes("same key")),
    ).toBe(false);
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
    expect(
      consoleError.mock.calls.some((call) => String(call[0]).includes("same key")),
    ).toBe(false);
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
