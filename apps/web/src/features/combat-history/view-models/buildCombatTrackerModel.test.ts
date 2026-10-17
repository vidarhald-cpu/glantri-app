import {
  COMBAT_ROUND_STEPS,
  type CombatProgressionTaskKind,
  type CombatRoundAttackRollResult,
} from "@glantri/domain";
import { describe, expect, it } from "vitest";

import type { CombatTrackerCellFacts } from "../types";
import { buildCombatTrackerCellKey, buildCombatTrackerModel } from "./buildCombatTrackerModel";

function facts(overrides: Partial<CombatTrackerCellFacts> = {}): CombatTrackerCellFacts {
  return {
    commands: [],
    inspectable: true,
    participantId: "participant-a",
    participantLabel: "Aldren",
    roundNumber: 1,
    selected: false,
    status: "pending",
    step: "select_actions",
    ...overrides,
  };
}

function live(taskKind: CombatProgressionTaskKind = "attack") {
  const exceptional = new Set<CombatProgressionTaskKind>([
    "adjust_distance_attacker_roll",
    "adjust_distance_defender_roll",
    "combat_experience",
    "distance_roll",
    "health_review",
    "parry",
  ]).has(taskKind);
  return {
    attention: exceptional ? ("exceptional" as const) : ("ordinary" as const),
    current: true,
    executable: true,
    executionGroupIds: ["group-1"],
    gmProxyAvailable: true,
    hover: {
      actionLabel: taskKind,
      gmActionRequired: taskKind === "effect_review",
      requiredActorLabel: taskKind === "effect_review" ? "Game Master" : "Aldren",
      text:
        taskKind === "effect_review"
          ? "Awaiting GM: Review round-end effects for Aldren."
          : `${taskKind} required for Aldren.`,
      waiting: false,
    },
    ownerParticipantIds: ["participant-a"],
    processIds: ["process-1"],
    stageIds: ["stage-1"],
    taskIds: ["task-1"],
    taskKinds: [taskKind],
    waiting: false,
  } as const;
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
      facts({
        progression: live(),
        selected: true,
        step: "phase_1_actions",
      }),
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

  it("keeps declared A1 actions at not-reached until initiative opens the phase", () => {
    const result = model([
      facts({
        adjustDistance: { currentDistance: 3, requestedDistance: 2, status: "pending" },
        step: "phase_1_actions",
      }),
    ]);
    expect(result.cells["1:participant-a:phase_1_actions"]).toMatchObject({
      marker: "·",
      markerKind: "not_reached",
    });
  });

  it("keeps a submitted declaration complete while its ordinary GM transition is current", () => {
    const result = model([
      facts({
        progression: live("gm_advance_boundary"),
        status: "submitted",
        step: "select_actions",
      }),
    ]);

    expect(result.cells["1:participant-a:select_actions"]).toMatchObject({
      attention: "ordinary",
      marker: "✓",
      status: "completed",
    });
  });

  it("separates ordinary declaration input from exceptional CE attention", () => {
    const result = model([
      facts({ progression: live("submit_declaration"), step: "select_actions" }),
      facts({
        participantId: "participant-b",
        participantLabel: "Bera",
        progression: live("combat_experience"),
        step: "select_actions",
      }),
    ]);

    expect(result.cells["1:participant-a:select_actions"]).toMatchObject({
      attention: "ordinary",
      marker: "·",
    });
    expect(result.cells["1:participant-b:select_actions"]).toMatchObject({
      attention: "exceptional",
      marker: "?",
    });
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

  it("isolates completed attack and initiative facts from a new declaration round", () => {
    const attackResult = {
      grazing: false,
      hit: false,
      tableResult: "Miss",
      weaponName: "Long sword",
    } as CombatRoundAttackRollResult;
    const result = buildCombatTrackerModel({
      cellFacts: [
        facts({
          attackAttackerLabel: "Aldren",
          attackDefenderLabel: "Bera",
          attackResult,
          roundNumber: 2,
          status: "complete",
          step: "phase_1_actions",
        }),
        facts({
          initiativeCommitted: true,
          initiativeRollRecorded: true,
          initiativeTotal: 7,
          roundNumber: 2,
          status: "complete",
          step: "initiative_phase_1",
        }),
        ...COMBAT_ROUND_STEPS.map((step) =>
          facts({
            inspectable: step === "select_actions",
            progression: step === "select_actions" ? live("submit_declaration") : undefined,
            roundNumber: 3,
            step,
          }),
        ),
      ],
      rounds: [{ roundNumber: 2 }, { currentStep: "select_actions", roundNumber: 3 }],
      rows: [{ label: "Aldren", participantId: "participant-a", selected: true }],
      steps: ["select_actions", "initiative_phase_1", "phase_1_actions"],
    });

    expect(result.cells["2:participant-a:phase_1_actions"]).toMatchObject({
      inspectable: true,
      marker: "M",
    });
    expect(result.cells["2:participant-a:initiative_phase_1"]).toMatchObject({
      marker: "7",
    });
    expect(result.cells["3:participant-a:select_actions"]).toMatchObject({
      current: true,
      marker: "·",
    });
    expect(result.currentTaskCellKey).toBe("3:participant-a:select_actions");
    expect(result.cells["3:participant-a:initiative_phase_1"]).toMatchObject({
      inspectable: false,
      marker: "·",
    });
    expect(result.cells["3:participant-a:phase_1_actions"]).toMatchObject({
      inspectable: false,
      marker: "·",
    });
    for (const step of COMBAT_ROUND_STEPS.filter((step) => step !== "select_actions")) {
      expect(result.cells[`3:participant-a:${step}`]).toMatchObject({
        inspectable: false,
        marker: "·",
      });
    }
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

  it("marks a committed distance adjustment complete without using an attack marker", () => {
    const result = model([
      facts({
        adjustDistance: {
          committedDistance: 2,
          currentDistance: 3,
          defenderLabel: "Bera",
          requestedDistance: 2,
          status: "committed",
        },
        status: "complete",
        step: "phase_1_actions",
      }),
    ]);

    const cell = result.cells["1:participant-a:phase_1_actions"];
    expect(cell).toMatchObject({ marker: "✓", markerKind: "complete" });
    expect(cell.hoverText).toContain("completed a distance adjustment against Bera");
    expect(cell.hoverText).toContain("Distance: 3 → 2");
  });

  it("marks an unresolved distance adjustment pending", () => {
    const result = model([
      facts({
        adjustDistance: {
          currentDistance: 3,
          defenderLabel: "Bera",
          requestedDistance: 2,
          status: "pending",
        },
        progression: live("adjust_distance_attacker_roll"),
        step: "phase_1_actions",
      }),
    ]);

    expect(result.cells["1:participant-a:phase_1_actions"]).toMatchObject({
      marker: "?",
      markerKind: "required",
    });
  });

  it("renders initiative totals and pending markers with the existing legend meanings", () => {
    const result = model([
      facts({
        initiativeCommitted: true,
        initiativeTotal: 8,
        status: "gmEdited",
        step: "initiative_phase_1",
      }),
      facts({
        participantId: "participant-b",
        participantLabel: "Bera",
        progression: {
          ...live("distance_roll"),
          ownerParticipantIds: ["participant-b"],
        },
        step: "round_summary",
      }),
    ]);

    expect(result.cells["1:participant-a:initiative_phase_1"]).toMatchObject({
      initiativeValue: true,
      marker: "8",
      markerKind: "roll_result",
    });
    expect(result.cells["1:participant-b:round_summary"].marker).toBe("?");
    expect(result.legend.map((item) => item.kind)).toEqual([
      "not_reached",
      "required",
      "complete",
      "skipped",
      "attack_hit",
      "attack_miss",
      "roll_result",
    ]);
  });

  it("renders bulk-skipped initiative as skipped rather than as a fabricated roll total", () => {
    const result = model([
      facts({
        initiativeCommitted: true,
        initiativeResolutionType: "bulk_skipped",
        initiativeRollRecorded: true,
        initiativeTotal: 0,
        status: "skipped",
        step: "initiative_phase_1",
      }),
    ]);
    const cell = result.cells["1:participant-a:initiative_phase_1"];

    expect(cell).toMatchObject({
      initiativeValue: false,
      marker: "–",
      markerKind: "skipped",
    });
    expect(cell.hoverText).toContain("initiative bulk skipped by GM; effective initiative 0");
  });

  it("marks a recorded initiative roll complete without exposing its uncommitted value", () => {
    const result = model([
      facts({
        initiativeCommitted: false,
        initiativeRollRecorded: true,
        initiativeTotal: 8,
        status: "submitted",
        step: "initiative_phase_1",
      }),
    ]);

    expect(result.cells["1:participant-a:initiative_phase_1"]).toMatchObject({
      attention: "ordinary",
      initiativeValue: false,
      hoverText: expect.stringContaining("initiative roll recorded"),
      marker: "✓",
    });
    expect(result.cells["1:participant-a:initiative_phase_1"].hoverText).not.toContain("8");
  });

  it("keeps an initiative cell unopened until its roll is recorded", () => {
    const result = model([
      facts({
        initiativeCommitted: false,
        initiativeRollRecorded: false,
        step: "initiative_phase_1",
      }),
    ]);

    expect(result.cells["1:participant-a:initiative_phase_1"]).toMatchObject({
      initiativeValue: false,
      marker: "·",
    });
  });

  it("keeps Adjust Distance roll completion on the participant who recorded it", () => {
    const result = model([
      facts({
        adjustDistanceRollRecorded: true,
        step: "phase_1_actions",
      }),
      facts({
        participantId: "participant-b",
        participantLabel: "Bera",
        progression: {
          ...live("adjust_distance_defender_roll"),
          ownerParticipantIds: ["participant-b"],
        },
        step: "phase_1_actions",
      }),
    ]);

    expect(result.cells["1:participant-a:phase_1_actions"]).toMatchObject({
      marker: "✓",
      status: "completed",
    });
    expect(result.cells["1:participant-b:phase_1_actions"]).toMatchObject({
      marker: "?",
      status: "open",
    });
  });

  it("renders projected routine effect review as ordinary current SU work", () => {
    const result = buildCombatTrackerModel({
      cellFacts: [facts({ progression: live("effect_review"), step: "round_summary" })],
      rounds: [{ currentStep: "round_summary", roundNumber: 1 }],
      rows: [{ label: "Aldren", participantId: "participant-a", selected: true }],
      steps: ["round_summary"],
    });

    expect(result.cells["1:participant-a:round_summary"]).toMatchObject({
      current: true,
      hoverText: expect.stringContaining("Awaiting GM: Review round-end effects for Aldren"),
      marker: "·",
      markerKind: "not_reached",
      status: "open",
    });
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

  // Forgejo #676. The domain step outcome normally supplies the sentence for this cell, but the
  // tracker also derives one from the resolution alone when no outcome is passed. In that path a
  // Parry step that found no eligible source must not be described as a step that was never
  // needed, which is what the neighbouring `not_applicable` branch would otherwise say.
  it("distinguishes a Parry step with no eligible source from one that was never needed", () => {
    const parryCell = (parryResolution: Record<string, unknown>) =>
      model([
        facts({
          phaseResolutionResult: { parryResolution } as never,
          status: "pending",
          step: "review_phase_2_actions",
        }),
      ]).cells["1:participant-a:review_phase_2_actions"];

    expect(
      parryCell({ noEligibleParrySource: true, status: "not_applicable" }).hoverText,
    ).toContain("no Parry available; advanced to damage.");
    expect(parryCell({ status: "not_applicable" }).hoverText).toContain("parry not needed.");
    expect(parryCell({ status: "resolved", success: false }).hoverText).toContain("parry failed.");
  });

  it("keeps inspectability in the projected model", () => {
    const result = model([facts({ inspectable: false })]);

    expect(result.cells["1:participant-a:select_actions"].inspectable).toBe(false);
  });
});
