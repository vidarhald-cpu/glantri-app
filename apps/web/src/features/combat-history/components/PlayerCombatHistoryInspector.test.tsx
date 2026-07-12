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
            ],
            label: "General/Fatigue",
            total: -2,
          },
        ],
      },
      phase1: {
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
        phaseContext: createEmptyPlayerEncounterCombatContext(),
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
  it("reuses the normal read-only selector, phase, modifier, and result panels", () => {
    const { container } = render(
      <PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />,
    );

    expect((screen.getByLabelText("Action") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Movement") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Description") as HTMLInputElement).value).toBe(
      "Hold the bridge",
    );
    expect(screen.getByText("Long sword")).toBeTruthy();
    expect(screen.getAllByText("Sword / shield")).toHaveLength(2);
    expect(screen.getByText("General/Fatigue")).toBeTruthy();
    expect(screen.getByLabelText("Action result")).toBeTruthy();
    expect(container.textContent).not.toContain("Bucket Key");
    expect(container.textContent).not.toContain("Source Rule");
    expect(container.textContent).not.toContain("internal-rule-key");
    expect(container.textContent).not.toContain("Current action");
  });

  it("shows explicit panel messages instead of generic projected-data summaries", () => {
    const empty = snapshot();
    empty.panels.actionSelector = {};
    empty.panels.phase1 = {};
    empty.panels.modifiers = {};
    render(<PlayerCombatHistoryInspector events={[]} snapshot={empty} />);

    expect(screen.getAllByText("Historical data was not recorded for this panel.").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("Action Label")).toBeNull();
    expect(screen.queryByText("Attack Summary")).toBeNull();
  });

  it("does not render identities absent from the projected snapshot", () => {
    const { container } = render(
      <PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />,
    );

    expect(container.textContent).toContain("Visible opponent");
    expect(container.textContent).not.toContain("Hidden opponent");
  });
});
