import { describe, expect, it } from "vitest";

import {
  getCurrentExecutableCombatTasks,
  runCombatDeterministicTransitionSuffix,
  type CombatDeterministicTransitionProjection,
} from "./combatDeterministicTransitions";
import type { CombatParticipationProjection } from "./combatParticipation";
import type { CombatProgressionProjection } from "./combatProgressionProjection";

function projection(input: {
  counter: number;
  deterministic?: boolean;
  revision?: string;
}): CombatDeterministicTransitionProjection<{ counter: number }> {
  const revision = input.revision ?? `revision-${input.counter}`;
  const workClass = input.deterministic === false ? "human_decision" : "deterministic_transition";
  const participation = {
    encounterId: "encounter-1",
    encounterRevision: revision,
    facts: [],
    roundNumber: 1,
    schemaVersion: 1,
    sequence: input.counter,
  } satisfies CombatParticipationProjection;
  const task = {
    allowedActors: ["gm"],
    automation: {
      authority: { kind: "ownerless" },
      eligibility: "not_allowed",
      participationFactId: `fact-${input.counter}`,
      schemaVersion: 1,
      stopReason: "deterministic_already_handled",
      taskId: `task-${input.counter}`,
      warnings: [],
      workClass: "not_applicable",
    },
    blockerIds: [],
    executionGroupId: `group-${input.counter}`,
    expectedCommand: "advance_combat_boundary",
    id: `task-${input.counter}`,
    identity: { executionGroupId: `group-${input.counter}` },
    kind: "gm_advance_boundary",
    owner: { id: "gm", kind: "gm", label: "Game Master" },
    participation: {
      completeness: "complete",
      factId: `fact-${input.counter}`,
      ordering: "ownerless_boundary",
      ownership: { kind: "ownerless" },
      reason: "deterministic_boundary",
      status: "required",
      workClass,
    },
    processId: "process",
    stageId: "stage",
    state: "executable",
    trackerFacet: { step: "DE" },
  } as const;
  const progression = {
    blockers: [],
    boundary: {
      blockerIds: [],
      id: "boundary",
      kind: "declaration",
      processes: [
        {
          boundaryId: "boundary",
          id: "process",
          kind: "boundary_transition",
          stages: [
            {
              executionGroups: [
                {
                  activationBoundary: { id: "boundary", kind: "declaration", roundNumber: 1 },
                  blockerIds: [],
                  completionState: "incomplete",
                  diagnostics: [],
                  executionStrategy: "gm_review",
                  futureActivationBoundary: undefined,
                  id: task.executionGroupId,
                  position: 0,
                  stageId: "stage",
                  tasks: [task],
                },
              ],
              executionStrategy: "gm_review",
              id: "stage",
              kind: "boundary",
              processId: "process",
              state: "active",
              tasks: [task],
            },
          ],
        },
      ],
      roundNumber: 1,
    },
    diagnostics: [],
    roundNumber: 1,
  } satisfies CombatProgressionProjection;
  return { participation, progression, revision, state: { counter: input.counter } };
}

describe("deterministic combat transition suffix", () => {
  it("ignores optional executable tasks retained in a completed declaration stage", () => {
    const current = projection({ counter: 0 });
    const activeProcess = current.progression.boundary.processes[0]!;
    const activeStage = activeProcess.stages[0]!;
    const optionalEditTask = {
      ...activeStage.tasks[0]!,
      executionGroupId: "completed-declaration-edit-group",
      id: "completed-declaration-edit-task",
      kind: "submit_declaration" as const,
      participation: undefined,
    };
    const progression: CombatProgressionProjection = {
      ...current.progression,
      boundary: {
        ...current.progression.boundary,
        processes: [
          {
            ...activeProcess,
            stages: [
              {
                ...activeStage,
                executionGroups: [
                  {
                    ...activeStage.executionGroups[0]!,
                    completionState: "complete",
                    id: optionalEditTask.executionGroupId,
                    tasks: [optionalEditTask],
                  },
                ],
                id: "completed-declaration-input",
                state: "complete",
                tasks: [optionalEditTask],
              },
              activeStage,
            ],
          },
        ],
      },
    };

    expect(getCurrentExecutableCombatTasks(progression).map((task) => task.id)).toEqual(["task-0"]);
  });

  it("stops before newly emerged human work", async () => {
    const result = await runCombatDeterministicTransitionSuffix({
      execute: async ({ projection: current }) => ({
        revision: `revision-${current.state.counter + 1}`,
        state: { counter: current.state.counter + 1 },
      }),
      initial: projection({ counter: 0 }),
      project: ({ state, revision }) =>
        projection({ counter: state.counter, deterministic: false, revision }),
    });

    expect(result.executedTaskIds).toEqual(["task-0"]);
    expect(result.stopReason).toBe("blocked_or_human_work");
  });

  it("stops a pathological deterministic loop at the finite safety bound", async () => {
    const commandIds: string[] = [];
    const result = await runCombatDeterministicTransitionSuffix({
      execute: async ({ commandId, projection: current }) => {
        commandIds.push(commandId);
        return {
          revision: `revision-${current.state.counter + 1}`,
          state: { counter: current.state.counter + 1 },
        };
      },
      initial: projection({ counter: 0 }),
      limit: 3,
      project: ({ state, revision }) => projection({ counter: state.counter, revision }),
    });

    expect(result.executedTaskIds).toEqual(["task-0", "task-1", "task-2"]);
    expect(new Set(commandIds).size).toBe(3);
    expect(result.stopReason).toBe("safety_limit");
  });
});
