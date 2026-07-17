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

  it("preserves attack markers and stored identity/result hover facts", () => {
    const attackResult = {
      grazing: true,
      hit: false,
      lookupTotal: 37,
      tableResult: "Grazing hit",
      weaponName: "Long sword",
    } as CombatRoundAttackRollResult;
    const result = model([
      facts({
        attackAttackerLabel: "Aldren",
        attackDefenderLabel: "Bera",
        attackResult,
        status: "complete",
        step: "phase_1_actions",
      }),
    ]);
    const cell = result.cells["1:participant-a:phase_1_actions"];

    expect(cell.marker).toBe("H");
    expect(cell.markerKind).toBe("attack_hit");
    expect(cell.hoverText).toContain(
      "Aldren attacked Bera with Long sword: grazing hit; Grazing hit.",
    );
  });

  it("renders a stored attack miss as M even when the step status is incomplete", () => {
    const result = model([
      facts({
        attackAttackerLabel: "Aldren",
        attackDefenderLabel: "Bera",
        attackResult: {
          grazing: false,
          hit: false,
          tableResult: "Miss",
          weaponName: "Long sword",
        } as CombatRoundAttackRollResult,
        status: "pending",
        step: "phase_1_actions",
      }),
    ]);

    expect(result.cells["1:participant-a:phase_1_actions"]).toMatchObject({
      marker: "M",
      markerKind: "attack_miss",
    });
    expect(result.cells["1:participant-a:phase_1_actions"].hoverText).toContain(
      "Aldren attacked Bera with Long sword: miss; Miss.",
    );
  });

  it("marks a committed Feint action complete instead of treating it as a skipped attack", () => {
    const result = model([
      facts({
        feint: {
          defenderLabel: "Bera",
          defenderPhase2Modifier: -2,
          method: "weapon",
          status: "committed",
        },
        status: "complete",
        step: "phase_1_actions",
      }),
    ]);
    const cell = result.cells["1:participant-a:phase_1_actions"];
    expect(cell).toMatchObject({ marker: "✓", markerKind: "complete" });
    expect(cell.hoverText).toContain("completed a weapon feint against Bera");
    expect(cell.hoverText).toContain("OB/DB -2 in Phase 2");
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

  it("explains automatic non-required steps without calling them skipped", () => {
    const result = model([
      facts({
        status: "pending",
        step: "review_phase_2_actions",
        stepOutcome: {
          category: "not_required",
          message: "No parry required. The incoming attack missed.",
          reason: "incoming_attack_missed",
        },
      }),
    ]);
    const cell = result.cells["1:participant-a:review_phase_2_actions"];

    expect(cell.marker).toBe("–");
    expect(cell.hoverText).toContain("No parry required. The incoming attack missed.");
    expect(cell.hoverText).not.toContain("skipped");
  });

  it("keeps inspectability in the projected model", () => {
    const result = model([facts({ inspectable: false })]);

    expect(result.cells["1:participant-a:select_actions"].inspectable).toBe(false);
  });
});
