// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "@testing-library/react";
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
  it("preserves panel placement while rendering historical values without form controls", () => {
    const { container } = render(
      <PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />,
    );

    expect(screen.getByText("Single attack")).toBeTruthy();
    expect(screen.getByText("Maintain distance to opponent")).toBeTruthy();
    expect(screen.getByText("Hold the bridge")).toBeTruthy();
    expect(screen.getByText("Long sword")).toBeTruthy();
    expect(screen.getByText("Thrust")).toBeTruthy();
    expect(screen.getAllByText("Sword / shield")).toHaveLength(2);
    expect(screen.getByText("General/Fatigue")).toBeTruthy();
    expect(screen.getByText("Historical context")).toBeTruthy();
    expect(screen.getByLabelText(/Historical result/)).toBeTruthy();
    expect(container.textContent).not.toContain("Bucket Key");
    expect(container.textContent).not.toContain("Source Rule");
    expect(container.textContent).not.toContain("internal-rule-key");
    expect(container.textContent).not.toContain("another-internal-rule-key");
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
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

  it("renders read-only historical context in the normal action-area position", () => {
    render(<PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />);

    const modifierPanel = screen.getByText("Combat modifiers").closest("section");
    const currentActionPanel = screen.getByText("Historical context").closest("section");
    const actionResultPanel = screen.getByLabelText(/Historical result/);
    expect(modifierPanel?.parentElement).toBe(currentActionPanel?.parentElement);
    expect(currentActionPanel?.parentElement).toBe(actionResultPanel.parentElement);
    expect(Array.from(currentActionPanel?.parentElement?.children ?? [])).toEqual([
      modifierPanel,
      currentActionPanel,
      actionResultPanel,
    ]);

    expect(screen.queryByText("Current action")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
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

    expect(container.textContent).toContain("No target");
    expect(container.textContent).not.toContain("Hidden opponent");
  });

  it("renders archived observation progress and established bonus inside existing panels", () => {
    const observed = snapshot();
    observed.panels.actionSelector = {
      actionId: "parry",
      actionLabel: "Parry",
      secondaryActionId: "observe_opponent",
      secondaryActionLabel: "Observe opponent",
      secondaryActionTargetParticipantId: "visible",
    };
    render(
      <PlayerCombatHistoryInspector
        events={[]}
        observationRelationships={[
          {
            bestBonus: 1,
            completedAttempts: 1,
            id: "observation:aria:visible",
            observerParticipantId: "aria",
            roundsTowardNextAttempt: 4,
            targetParticipantId: "visible",
          },
        ]}
        observationTargetLabels={{ visible: "Visible opponent" }}
        snapshot={observed}
      />,
    );

    expect(screen.getByText("Observation progress")).toBeTruthy();
    expect(screen.getByText("Visible opponent: 4 / 6 · best +1% · attempts 1")).toBeTruthy();
    expect(screen.getByText("Observe Opponent · Visible opponent")).toBeTruthy();
    expect(screen.getAllByText("Historical context")).toHaveLength(1);
  });
});
