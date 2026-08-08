import { describe, expect, it } from "vitest";

import type { CombatProgressionTask } from "./combatProgressionProjection";
import type { CombatRoundStep } from "./combatRoundStep";
import {
  combatStepAutomationRunIdentitySchema,
  getCombatStepAutomationCommandPrefix,
  runCombatStepAutomation,
  type CombatStepAutomationProjection,
  type CombatStepAutomationRunIdentity,
} from "./combatStepAutomation";

function task(
  id: string,
  participantId: string,
  kind = "roll_initiative",
  phase: "phase1" | "phase2" = "phase1",
) {
  return {
    allowedActors: ["gm"],
    automation: {
      authority: { kind: "gm_controlled_participant", participantId },
      eligibility: "eligible",
      schemaVersion: 1,
      taskId: id,
      warnings: [],
      workClass: "gm_roll",
    },
    blockerIds: [],
    executionGroupId: `group:${id}`,
    expectedCommand: phase === "phase1" ? "roll_initiative_phase1" : "roll_initiative_phase2",
    id,
    identity: { executionGroupId: `group:${id}`, participantId, phase },
    kind,
    owner: { id: participantId, kind: "combatant", label: participantId, participantId },
    processId: "initiative",
    stageId: "roll",
    state: "executable",
    trackerFacet: { participantId, step: phase === "phase1" ? "i1" : "i2" },
  } as unknown as CombatProgressionTask;
}

function identity(): CombatStepAutomationRunIdentity {
  return combatStepAutomationRunIdentitySchema.parse({
    encounterId: "encounter-1",
    gmActorUserId: "gm-1",
    operationFamily: "roll_remaining",
    runId: "run-1",
    schemaVersion: 1,
    startExecutionGroupId: "group:initiative-a",
    startingRevision: "revision-1",
    startingRound: 1,
    startingSequence: 4,
    startingStep: "initiative_phase_1",
    startTaskId: "initiative-a",
  });
}

function projection(input: {
  revision?: string;
  step?: CombatRoundStep;
  tasks: CombatProgressionTask[];
}): CombatStepAutomationProjection<{ value: number }> {
  return {
    revision: input.revision ?? "revision-1",
    roundNumber: 1,
    state: { value: 0 },
    step: input.step ?? "initiative_phase_1",
    tasks: input.tasks,
  };
}

function processTask(
  id: string,
  participantId: string,
  processId: string,
  kind = "combat_experience",
) {
  return { ...task(id, participantId, kind), processId };
}

describe("canonical GM step automation", () => {
  it("processes a contiguous canonical prefix and stops before player work", async () => {
    const tasks = [task("initiative-a", "npc-a"), task("initiative-b", "player-b")];
    const result = await runCombatStepAutomation({
      classify: ({ task: current }) =>
        current.owner?.kind === "combatant" && current.owner.participantId === "player-b"
          ? { kind: "stop", reason: "player_action_required" }
          : { countsTowardProcessed: true, kind: "execute" },
      execute: async () => ({
        kind: "accepted",
        projection: projection({ revision: "revision-2", tasks: tasks.slice(1) }),
      }),
      identity: identity(),
      initial: projection({ tasks }),
    });

    expect(result.processedCount).toBe(1);
    expect(result.acceptedTasks.map((entry) => entry.taskId)).toEqual(["initiative-a"]);
    expect(result.stopParticipantId).toBe("player-b");
    expect(result.stopReason).toBe("player_action_required");
  });

  it("stops at the starting-step fence after a structural completion", async () => {
    const result = await runCombatStepAutomation({
      classify: () => ({ countsTowardProcessed: false, kind: "execute" }),
      execute: async () => ({
        kind: "accepted",
        projection: projection({
          step: "phase_1_actions",
          tasks: [task("attack", "npc-a", "attack")],
        }),
      }),
      identity: identity(),
      initial: projection({ tasks: [task("commit", "gm", "commit_initiative")] }),
    });

    expect(result.stepComplete).toBe(true);
    expect(result.stopReason).toBe("end_of_step");
    expect(result.finalTask?.kind).toBe("attack");
    expect(result.acceptedTasks).toHaveLength(1);
  });

  it("stops at an exact process fence even when the structural step is unchanged", async () => {
    const combatExperience = processTask("ce-a", "npc-a", "combat-experience");
    const declaration = processTask("de-a", "npc-a", "declaration", "submit_declaration");
    const ceIdentity = combatStepAutomationRunIdentitySchema.parse({
      ...identity(),
      startExecutionGroupId: combatExperience.executionGroupId,
      startProcessId: combatExperience.processId,
      startingStep: "select_actions",
      startTaskId: combatExperience.id,
    });
    let executions = 0;
    const result = await runCombatStepAutomation({
      classify: () => ({ countsTowardProcessed: true, kind: "execute" }),
      execute: async () => {
        executions += 1;
        return {
          kind: "accepted",
          projection: projection({
            revision: "revision-2",
            step: "select_actions",
            tasks: [declaration],
          }),
        };
      },
      identity: ceIdentity,
      initial: projection({ step: "select_actions", tasks: [combatExperience] }),
    });

    expect(executions).toBe(1);
    expect(result.stepComplete).toBe(true);
    expect(result.stopReason).toBe("end_of_step");
    expect(result.finalTask?.kind).toBe("submit_declaration");
  });

  it("stops before warnings and never executes the warned task", async () => {
    let executions = 0;
    const result = await runCombatStepAutomation({
      classify: () => ({ kind: "stop", reason: "warning_requires_acknowledgement" }),
      execute: async ({ projection: current }) => {
        executions += 1;
        return { kind: "accepted", projection: current };
      },
      identity: identity(),
      initial: projection({ tasks: [task("initiative-a", "npc-a")] }),
    });

    expect(executions).toBe(0);
    expect(result.stopReason).toBe("warning_requires_acknowledgement");
  });

  it("uses stable run-bound command identities and stops at the safety limit", async () => {
    const commandIds: string[] = [];
    const repeated = task("initiative-a", "npc-a");
    const result = await runCombatStepAutomation({
      classify: () => ({ countsTowardProcessed: true, kind: "execute" }),
      execute: async ({ commandId, projection: current }) => {
        commandIds.push(commandId);
        return {
          kind: "accepted",
          projection: { ...current, revision: `${current.revision}:next` },
        };
      },
      identity: identity(),
      initial: projection({ tasks: [repeated] }),
      limit: 3,
    });

    expect(result.stopReason).toBe("safety_limit_reached");
    expect(commandIds).toHaveLength(3);
    expect(new Set(commandIds).size).toBe(3);
    expect(commandIds[0]?.startsWith(getCombatStepAutomationCommandPrefix(identity()))).toBe(true);
  });

  it("retains the latest accepted projection on a bounded persistence stop", async () => {
    const result = await runCombatStepAutomation({
      classify: () => ({ countsTowardProcessed: true, kind: "execute" }),
      execute: async () => ({
        kind: "stopped",
        projection: projection({ revision: "revision-remote", tasks: [task("other", "npc-b")] }),
        reason: "task_changed",
      }),
      identity: identity(),
      initial: projection({ tasks: [task("initiative-a", "npc-a")] }),
    });

    expect(result.acceptedTasks).toEqual([]);
    expect(result.finalRevision).toBe("revision-remote");
    expect(result.stopReason).toBe("task_changed");
  });

  it("applies the same fence to Phase 2 initiative and exposes but never processes A2", async () => {
    const phase2Identity = combatStepAutomationRunIdentitySchema.parse({
      ...identity(),
      startExecutionGroupId: "group:initiative-p2-a",
      startingStep: "initiative_phase_2",
      startTaskId: "initiative-p2-a",
    });
    const first = task("initiative-p2-a", "npc-a", "roll_initiative", "phase2");
    const second = task("initiative-p2-b", "npc-b", "roll_initiative", "phase2");
    let calls = 0;
    const result = await runCombatStepAutomation({
      classify: () => ({ countsTowardProcessed: true, kind: "execute" }),
      execute: async () => {
        calls += 1;
        return {
          kind: "accepted",
          projection:
            calls === 1
              ? projection({ step: "initiative_phase_2", tasks: [second] })
              : projection({
                  step: "phase_2_actions",
                  tasks: [task("attack-p2", "npc-a", "attack", "phase2")],
                }),
        };
      },
      identity: phase2Identity,
      initial: projection({ step: "initiative_phase_2", tasks: [first] }),
    });

    expect(result.processedCount).toBe(2);
    expect(result.stepComplete).toBe(true);
    expect(result.finalTask?.kind).toBe("attack");
    expect(calls).toBe(2);
  });
});
