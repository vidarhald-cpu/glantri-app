// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import type { CombatLogEventPresentation } from "@glantri/domain";
import React from "react";
import { describe, expect, it } from "vitest";

import { CombatLastActionLine } from "./CombatLastActionLine";

const attack = {
  actor: { displayName: "Halgeir", participantId: "p-h" },
  category: "attack",
  encounterId: "e1",
  id: "l1",
  roundNumber: 1,
  sequence: 0,
  sourceEventIds: [],
  sourceRevision: "r1",
  state: "final",
  summary: "",
  summaryFacts: { kind: "attack_resolved", outcome: "missed" },
  target: { displayName: "GangHo", participantId: "p-g" },
} as CombatLogEventPresentation;

describe("CombatLastActionLine", () => {
  it("renders one actor-qualified line", () => {
    render(
      <CombatLastActionLine gmEvents={[]} logEvents={[attack]} participants={[]} roundNumber={1} />,
    );
    expect(screen.getByTestId("combat-last-action")).toHaveTextContent(
      "Last action: Halgeir attacked GangHo — miss",
    );
  });

  it("renders nothing without an action", () => {
    const { container } = render(
      <CombatLastActionLine gmEvents={[]} logEvents={[]} participants={[]} roundNumber={1} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
