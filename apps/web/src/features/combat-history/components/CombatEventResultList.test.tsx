// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "@testing-library/react";
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

  it("renders identical outcome rows without duplicate React keys", () => {
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

    expect(screen.getAllByText("Hit: No")).toHaveLength(2);
    expect(
      consoleError.mock.calls.some((call) => String(call[0]).includes("same key")),
    ).toBe(false);
  });

  it("keeps identical facts across events and outcome/calculation sections in chronological order", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <CombatEventResultList
        events={[
          event("attack-later", 2, { publicOutcome: { hit: false } }),
          event("attack-first", 1, {
            privateCalculation: { hit: false },
            publicOutcome: { hit: false },
          }),
        ]}
      />,
    );

    expect(screen.getAllByText("Hit: No")).toHaveLength(3);
    expect(screen.getAllByText("Attack recorded.")).toHaveLength(2);
    const articles = screen.getAllByRole("article");
    expect(articles[0]?.textContent).toContain("Calculation");
    expect(articles[1]?.textContent).not.toContain("Calculation");
    expect(
      consoleError.mock.calls.some((call) => String(call[0]).includes("same key")),
    ).toBe(false);
  });
});
