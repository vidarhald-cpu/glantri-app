import { describe, expect, it } from "vitest";

import type { CombatProgressionProjection, CombatProgressionTask } from "@glantri/domain";

import { selectCurrentCombatModifierValidationTask } from "./combatModifierValidationTaskSelection";

function task(participantId: string): CombatProgressionTask {
  return {
    allowedActors: ["combatant", "gm"],
    automation: {
      authority: { kind: "unknown" },
      eligibility: "unsupported",
      schemaVersion: 1,
      taskId: `attack:${participantId}`,
      warnings: [],
      workClass: "not_applicable",
    },
    blockerIds: [],
    executionGroupId: "tied-attacks",
    expectedCommand: "roll_attack",
    id: `attack:${participantId}`,
    identity: { executionGroupId: "tied-attacks", phase: "phase1" },
    kind: "attack",
    owner: { kind: "combatant", label: participantId, participantId },
    processId: "phase1",
    stageId: "attack",
    state: "executable",
    trackerFacet: {
      owner: { kind: "combatant", label: participantId, participantId },
      step: "A1",
    },
  };
}

describe("combat modifier validation task selection", () => {
  it("selects a later tied task owned by the player instead of dropping validation", () => {
    const projection = {
      boundary: {
        kind: "phase1_resolution",
        processes: [
          {
            id: "phase1",
            kind: "phase_resolution",
            stages: [
              {
                executionGroups: [
                  {
                    id: "tied-attacks",
                    mode: "parallel_all",
                    tasks: [task("gladiator"), task("scyrian")],
                  },
                ],
                id: "attack",
                kind: "attack",
              },
            ],
          },
        ],
      },
    } as unknown as CombatProgressionProjection;

    expect(
      selectCurrentCombatModifierValidationTask({
        allowedParticipantIds: new Set(["scyrian"]),
        kind: "attack",
        projection,
      })?.id,
    ).toBe("attack:scyrian");
    expect(
      selectCurrentCombatModifierValidationTask({
        kind: "attack",
        projection,
      })?.id,
    ).toBe("attack:gladiator");
  });
});
