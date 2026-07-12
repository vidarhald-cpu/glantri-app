import type { CombatRoundAttackRollResult } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import type { CombatTrackerCellFacts } from "../types";
import { buildCombatTrackerCellKey, buildCombatTrackerModel } from "./buildCombatTrackerModel";

function facts(overrides: Partial<CombatTrackerCellFacts> = {}): CombatTrackerCellFacts {
  return {
    activeTask: false,
    commands: [],
    current: false,
    inspectable: true,
    participantId: "participant-a",
    participantLabel: "Aldren",
    pendingDistanceControlCommitCount: 0,
    pendingDistanceControlRollCount: 0,
    pendingHealthCheckRollCount: 0,
    phaseCombatExperienceMarkerRequired: false,
    roundNumber: 1,
    selected: false,
    status: "pending",
    step: "select_actions",
    ...overrides,
  };
}

function model(cellFacts: CombatTrackerCellFacts[]) {
  return buildCombatTrackerModel({
    cellFacts,
    rounds: [{ currentStep: "phase_1_actions", roundNumber: 1 }],
    rows: [{ label: "Aldren", participantId: "participant-a", selected: true }],
    steps: ["select_actions", "initiative_phase_1", "phase_1_actions"],
  });
}

describe("buildCombatTrackerModel", () => {
  it("builds stable rows, rounds, keys, and current/selected flags", () => {
    const result = model([
      facts({ activeTask: true, current: true, selected: true, step: "phase_1_actions" }),
    ]);
    const key = buildCombatTrackerCellKey({
      participantId: "participant-a",
      roundNumber: 1,
      step: "phase_1_actions",
    });

    expect(key).toBe("1:participant-a:phase_1_actions");
    expect(result.rows).toEqual([
      { label: "Aldren", participantId: "participant-a", selected: true },
    ]);
    expect(result.rounds[0]).toEqual({ currentStep: "phase_1_actions", roundNumber: 1 });
    expect(result.cells[key]).toMatchObject({ current: true, selected: true });
    expect(result.currentTaskCellKey).toBe(key);
    expect(result.selectedCellKey).toBe(key);
  });

  it("preserves attack markers and snapshot-supplied hover facts", () => {
    const attackResult = {
      grazing: true,
      hit: false,
      lookupTotal: 37,
      tableResult: "Grazing hit",
    } as CombatRoundAttackRollResult;
    const result = model([
      facts({
        attackResult,
        status: "complete",
        step: "phase_1_actions",
      }),
    ]);
    const cell = result.cells["1:participant-a:phase_1_actions"];

    expect(cell.marker).toBe("H");
    expect(cell.markerKind).toBe("attack_hit");
    expect(cell.hoverText).toContain("attack grazing hit: Grazing hit; lookup 37");
  });

  it("renders initiative totals and pending markers with the existing legend meanings", () => {
    const result = model([
      facts({ initiativeTotal: 8, status: "gmEdited", step: "initiative_phase_1" }),
      facts({
        participantId: "participant-b",
        participantLabel: "Bera",
        pendingDistanceControlRollCount: 1,
        step: "round_summary",
      }),
    ]);

    expect(result.cells["1:participant-a:initiative_phase_1"]).toMatchObject({
      initiativeValue: true,
      marker: "8",
      markerKind: "roll_result",
    });
    expect(result.cells["1:participant-b:round_summary"].marker).toBe("?");
    expect(result.legend.map((item) => item.kind)).toEqual(["required", "roll_result"]);
  });

  it("keeps inspectability in the projected model", () => {
    const result = model([facts({ inspectable: false })]);

    expect(result.cells["1:participant-a:select_actions"].inspectable).toBe(false);
  });
});
