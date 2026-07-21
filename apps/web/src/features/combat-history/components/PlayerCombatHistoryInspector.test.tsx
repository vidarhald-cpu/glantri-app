// @vitest-environment happy-dom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProjectedCombatHistorySnapshot } from "@glantri/domain";

import { createEmptyPlayerEncounterCombatContext } from "@/lib/campaigns/playerEncounter";

import { PlayerCombatHistoryInspector } from "./PlayerCombatHistoryInspector";

function snapshot(): ProjectedCombatHistorySnapshot {
  return {
    completeness: "complete",
    id: "snapshot-1",
    panels: {
      actionResult: {},
      actionSelector: {
        actionId: "attack_parry",
        actionLabel: "Single attack",
        additionalActionNotes: "Hold the bridge",
        movementId: "hold",
        movementIntent: { distancePreferences: [], mode: "hold_position" },
      },
      modifiers: {
        dbRaw: -2,
        generalFatigueRaw: 0,
        initiativeRaw: 0,
        obSkillRaw: 0,
        rows: [
          {
            bucketKey: "general",
            entries: [
              {
                durationRounds: 1,
                id: "modifier-1",
                notes: "single attack",
                scope: "until",
                sourceRule: "internal-rule-key",
                value: -2,
              },
              {
                durationRounds: 2,
                id: "modifier-2",
                notes: "second modifier",
                scope: "until",
                sourceRule: "another-internal-rule-key",
                value: 1,
              },
            ],
            label: "General/Fatigue",
            total: -2,
          },
        ],
      },
      phase1: {
        attackModeLabel: "Thrust",
        attackSummary: {
          attackMode: "C",
          dmb: "8",
          initiative: "3",
          maxCrits: "FS",
          ob: "10",
          weaponName: "Long sword",
        },
        defenseSummary: { db: "13", dm: "0", parry: "9", sourceName: "Sword / shield" },
        distanceLabel: "Distance: 3",
        phaseContext: {
          ...createEmptyPlayerEncounterCombatContext(),
          attackModeId: "mode-thrust",
        },
        targetOptions: [{ displayName: "Visible opponent", participantId: "visible" }],
      },
      phase2: {
        defenseSummary: { db: "18", dm: "0", parry: "13", sourceName: "Sword / shield" },
        phaseContext: createEmptyPlayerEncounterCombatContext(),
      },
    },
    participant: { displayName: "Aria", participantId: "aria" },
    roundNumber: 1,
    step: "phase_1_actions",
  };
}

describe("PlayerCombatHistoryInspector", () => {
  it("reuses the normal read-only selector, phase, modifier, action, and result panels", () => {
    const { container } = render(
      <PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />,
    );

    expect((screen.getByLabelText("Action") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Movement") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Description") as HTMLInputElement).value).toBe(
      "Hold the bridge",
    );
    expect(screen.getByText("Long sword")).toBeTruthy();
    expect((screen.getByLabelText("Attack mode") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Attack mode") as HTMLSelectElement).value).toBe(
      "mode-thrust",
    );
    expect(screen.getAllByText("Sword / shield")).toHaveLength(2);
    expect(screen.getByText("General/Fatigue")).toBeTruthy();
    expect(screen.getByText("Current action")).toBeTruthy();
    expect(screen.getByLabelText(/Historical result/)).toBeTruthy();
    expect(container.textContent).not.toContain("Bucket Key");
    expect(container.textContent).not.toContain("Source Rule");
    expect(container.textContent).not.toContain("internal-rule-key");
    expect(container.textContent).not.toContain("another-internal-rule-key");
  });

  it("uses the live compact modifier grid for historical headings and two-line rows", () => {
    render(<PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />);

    const headingRow = screen.getByText("Source/scope").parentElement as HTMLElement;
    expect(Array.from(headingRow.children).map((child) => child.textContent)).toEqual([
      "Source/scope",
      "Mod",
      "Dur",
    ]);
    expect(headingRow.style.display).toBe("grid");
    expect(headingRow.style.gridTemplateColumns).toBe("minmax(7rem, 1fr) 3.75rem 4.25rem");

    const modifierRows = screen
      .getAllByText("Situational")
      .map((source) => source.parentElement as HTMLElement);
    expect(modifierRows).toHaveLength(2);
    for (const row of modifierRows) {
      expect(row.style.gridTemplateColumns).toBe("minmax(7rem, 1fr) 3.75rem 4.25rem");
      const detailsRow = row.nextElementSibling as HTMLElement;
      expect(detailsRow.textContent).toContain("Details");
      expect(detailsRow.style.gridTemplateColumns).toBe("4.25rem minmax(0, 1fr)");
    }
  });

  it("renders a disabled historical Current action panel in the normal bottom-row position", () => {
    render(<PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />);

    const modifierPanel = screen.getByText("Combat modifiers").closest("section");
    const currentActionPanel = screen.getByText("Current action").closest("section");
    const actionResultPanel = screen.getByLabelText(/Historical result/);
    expect(modifierPanel?.parentElement).toBe(currentActionPanel?.parentElement);
    expect(currentActionPanel?.parentElement).toBe(actionResultPanel.parentElement);
    expect(Array.from(currentActionPanel?.parentElement?.children ?? [])).toEqual([
      modifierPanel,
      currentActionPanel,
      actionResultPanel,
    ]);

    const historicalButton = screen.getByRole("button", { name: "Historical inspection" });
    expect((historicalButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("No historical action control recorded.")).toBeTruthy();
    fireEvent.click(historicalButton);
    expect((historicalButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows explicit panel messages instead of generic projected-data summaries", () => {
    const empty = snapshot();
    empty.panels.actionSelector = {};
    empty.panels.phase1 = {};
    empty.panels.modifiers = {};
    render(<PlayerCombatHistoryInspector events={[]} snapshot={empty} />);

    expect(
      screen.getAllByText("No information available for this panel.").length,
    ).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("Action Label")).toBeNull();
    expect(screen.queryByText("Attack Summary")).toBeNull();
  });

  it("explains a recorded non-required historical step without a legacy warning", () => {
    const nonRequired = snapshot();
    nonRequired.step = "review_phase_2_actions";
    nonRequired.stepOutcome = {
      category: "not_required",
      message: "No parry required. The incoming attack missed.",
      reason: "incoming_attack_missed",
    };
    const { container } = render(
      <PlayerCombatHistoryInspector events={[]} snapshot={nonRequired} />,
    );

    expect(screen.getByText("No parry required. The incoming attack missed.")).toBeTruthy();
    expect(container.textContent).not.toContain("canonical event history");
  });

  it("does not render identities absent from the projected snapshot", () => {
    const { container } = render(
      <PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />,
    );

    expect(container.textContent).toContain("Visible opponent");
    expect(container.textContent).not.toContain("Hidden opponent");
  });
});
