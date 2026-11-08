// @vitest-environment happy-dom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildCombatCalculationPresentationFromSnapshot } from "../view-models/buildCombatCalculationPresentations";
import { CombatCalculationPanel } from "./CombatCalculationPanel";

function presentation(flags?: string[]) {
  return buildCombatCalculationPresentationFromSnapshot({
    calculationId: "panel:attack",
    calculationType: "attack",
    facts: {
      defenderDb: 12,
      lookupTotal: 83,
      ob: 81,
      openEndedD10s: [],
      rollD20: 14,
      rollTotal: 14,
      ...(flags ? { extrapolatedWorkbookAdjustments: flags } : {}),
    },
    label: "To hit",
  })!;
}

describe("CombatCalculationPanel extrapolation markers (#1002)", () => {
  it("draws a badge and the review sentence inside each flagged figure's own row", () => {
    const { container } = render(
      <CombatCalculationPanel presentation={presentation(["attacker_ob", "defender_db"])} />,
    );
    const rows = [
      ...container.querySelectorAll('[data-testid="combat-calculation-extrapolated-row"]'),
    ];
    expect(rows.map((row) => row.firstChild?.textContent)).toEqual(["OB: 81", "Defender DB: 12"]);
    for (const row of rows) {
      expect(
        row.querySelector('[data-testid="combat-calculation-extrapolation-marker"]')?.textContent,
      ).toBe("Extrapolated");
      expect(
        row.querySelector('[data-testid="combat-calculation-extrapolation-detail"]')?.textContent,
      ).toMatch(/Review this figure\.$/);
    }
  });

  it("badges only the flagged figure", () => {
    const { container } = render(
      <CombatCalculationPanel presentation={presentation(["defender_db"])} />,
    );
    const rows = container.querySelectorAll('[data-testid="combat-calculation-extrapolated-row"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.firstChild?.textContent).toBe("Defender DB: 12");
  });

  it("draws nothing extra for an unflagged result", () => {
    const { container } = render(<CombatCalculationPanel presentation={presentation()} />);
    expect(container.textContent).not.toMatch(/Extrapolated|Review this figure/);
    expect(screen.getByText("OB: 81")).toBeDefined();
  });

  it("marks the controlled (expanded) variant too", () => {
    const { container } = render(
      <CombatCalculationPanel
        expanded
        onToggle={() => undefined}
        presentation={presentation(["attacker_ob"])}
      />,
    );
    expect(container.textContent).toContain("Extrapolated");
    fireEvent.click(screen.getByRole("button"));
  });
});
