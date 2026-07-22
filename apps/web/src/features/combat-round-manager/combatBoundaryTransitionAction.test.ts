import { describe, expect, it } from "vitest";

import type { CombatProgressionPresentationTask } from "@glantri/domain";

import { buildCombatBoundaryTransitionAction } from "./combatBoundaryTransitionAction";

function transitionTask(
  overrides: Partial<CombatProgressionPresentationTask> = {},
): CombatProgressionPresentationTask {
  return {
    actorAccess: { combatant: false, gm: true },
    contributesToProgression: true,
    executionGroupId: "group:round-boundary",
    expectedCommand: "advance_combat_boundary",
    id: "task:round-boundary:start-next-round",
    identity: { executionGroupId: "group:round-boundary" },
    kind: "gm_advance_boundary",
    owner: { id: "gm", kind: "gm", label: "Game Master" },
    processId: "process:round-boundary",
    stageId: "stage:round-boundary",
    state: "executable",
    trackerFacet: { step: "SU" },
    transition: {
      currentBoundary: "round_boundary",
      requiredCompletedProcessIds: ["process:round-end"],
      targetBoundary: "declaration",
    },
    ...overrides,
  };
}

describe("combat boundary transition action", () => {
  it("binds the visible projected task to one immutable encounter revision", () => {
    const action = buildCombatBoundaryTransitionAction({
      encounterId: "encounter-1",
      encounterRevision: "2026-07-20T12:00:02.000Z",
      task: transitionTask(),
    });

    expect(action).toEqual({
      commandType: "advance_combat_boundary",
      encounterId: "encounter-1",
      executionGroupId: "group:round-boundary",
      expectedBoundary: "round_boundary",
      expectedRevision: "2026-07-20T12:00:02.000Z",
      targetBoundary: "declaration",
      taskId: "task:round-boundary:start-next-round",
    });
    expect(Object.isFrozen(action)).toBe(true);
  });

  it("does not make an unbound or player-only transition actionable", () => {
    expect(
      buildCombatBoundaryTransitionAction({
        encounterId: "encounter-1",
        task: transitionTask(),
      }),
    ).toBeUndefined();
    expect(
      buildCombatBoundaryTransitionAction({
        encounterId: "encounter-1",
        encounterRevision: "2026-07-20T12:00:02.000Z",
        task: transitionTask({ expectedCommand: "roll_attack" }),
      }),
    ).toBeUndefined();
    expect(
      buildCombatBoundaryTransitionAction({
        encounterId: "encounter-1",
        encounterRevision: "2026-07-20T12:00:02.000Z",
        task: transitionTask({ actorAccess: { combatant: true, gm: false } }),
      }),
    ).toBeUndefined();
  });

  it("rebinds only the refreshed task identity and revision after stale-state refresh", () => {
    const displayed = buildCombatBoundaryTransitionAction({
      encounterId: "encounter-1",
      encounterRevision: "2026-07-20T12:00:01.000Z",
      task: transitionTask(),
    });
    const stillReady = buildCombatBoundaryTransitionAction({
      encounterId: "encounter-1",
      encounterRevision: "2026-07-20T12:00:02.000Z",
      task: transitionTask(),
    });
    const semanticallyChanged = buildCombatBoundaryTransitionAction({
      encounterId: "encounter-1",
      encounterRevision: "2026-07-20T12:00:02.000Z",
      task: transitionTask({
        id: "task:phase2:advance-round-end",
        transition: {
          currentBoundary: "phase2_resolution",
          requiredCompletedProcessIds: ["process:phase2"],
          targetBoundary: "round_end",
        },
      }),
    });

    expect(stillReady).toMatchObject({
      expectedRevision: "2026-07-20T12:00:02.000Z",
      taskId: displayed?.taskId,
    });
    expect(semanticallyChanged).not.toMatchObject({
      expectedBoundary: displayed?.expectedBoundary,
      targetBoundary: displayed?.targetBoundary,
      taskId: displayed?.taskId,
    });
  });
});
