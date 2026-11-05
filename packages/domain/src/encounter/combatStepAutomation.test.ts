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

  it("keeps Health/Bleed rolls and their effect-review closure inside one process-family fence", async () => {
    const healthA = processTask("health-a", "npc-a", "health:npc-a", "health_review");
    const closureA = processTask("closure-a", "npc-a", "effect:npc-a", "effect_review");
    const healthB = processTask("health-b", "npc-b", "health:npc-b", "health_review");
    const observe = processTask("observe-b", "npc-b", "observation", "observation_roll");
    const healthIdentity = combatStepAutomationRunIdentitySchema.parse({
      ...identity(),
      startExecutionGroupId: healthA.executionGroupId,
      startProcessFamily: "health_bleed",
      startProcessId: healthA.processId,
      startingStep: "round_summary",
      startTaskId: healthA.id,
    });
    const sequence = [[closureA], [healthB], [observe]];
    let executions = 0;
    const result = await runCombatStepAutomation({
      classify: ({ task: current }) => ({
        countsTowardProcessed: current.kind === "health_review",
        kind: "execute",
      }),
      execute: async () => ({
        kind: "accepted",
        projection: projection({
          revision: `revision-${executions + 2}`,
          step: "round_summary",
          tasks: sequence[executions++] ?? [],
        }),
      }),
      identity: healthIdentity,
      initial: projection({ step: "round_summary", tasks: [healthA] }),
    });

    expect(result.acceptedTasks.map((entry) => entry.taskId)).toEqual([
      "health-a",
      "closure-a",
      "health-b",
    ]);
    expect(result.processedCount).toBe(2);
    expect(result.stepComplete).toBe(true);
    expect(result.finalTask?.kind).toBe("observation_roll");
  });

  it("keeps exact Observe tasks inside one process-family fence and stops before other SU work", async () => {
    const observeA = processTask("observe-a", "npc-a", "observation", "observation_roll");
    const observeB = processTask("observe-b", "npc-b", "observation", "observation_roll");
    const boundary = processTask("boundary", "gm", "round-end", "gm_advance_boundary");
    const observeIdentity = combatStepAutomationRunIdentitySchema.parse({
      ...identity(),
      startExecutionGroupId: observeA.executionGroupId,
      startProcessFamily: "observation",
      startProcessId: observeA.processId,
      startingStep: "round_summary",
      startTaskId: observeA.id,
    });
    const sequence = [[observeB], [boundary]];
    let executions = 0;
    const result = await runCombatStepAutomation({
      classify: () => ({ countsTowardProcessed: true, kind: "execute" }),
      execute: async () => ({
        kind: "accepted",
        projection: projection({
          revision: `revision-${executions + 2}`,
          step: "round_summary",
          tasks: sequence[executions++] ?? [],
        }),
      }),
      identity: observeIdentity,
      initial: projection({ step: "round_summary", tasks: [observeA] }),
    });

    expect(result.acceptedTasks.map((entry) => entry.taskId)).toEqual(["observe-a", "observe-b"]);
    expect(result.processedCount).toBe(2);
    expect(result.stepComplete).toBe(true);
    expect(result.finalTask?.kind).toBe("gm_advance_boundary");
  });

  it("keeps maintenance rolls across exact contacts and stops before distance work", async () => {
    const controller = processTask(
      "contact-a-controller",
      "npc-a",
      "contact:a",
      "continued_contact_maintenance_roll",
    );
    const affected = processTask(
      "contact-a-affected",
      "npc-b",
      "contact:a",
      "continued_contact_maintenance_roll",
    );
    const nextContact = processTask(
      "contact-b-controller",
      "npc-c",
      "contact:b",
      "continued_contact_maintenance_roll",
    );
    const distance = processTask("distance", "npc-a", "distance", "distance_commit");
    const contactIdentity = combatStepAutomationRunIdentitySchema.parse({
      ...identity(),
      startExecutionGroupId: controller.executionGroupId,
      startProcessFamily: "continued_contact",
      startProcessId: controller.processId,
      startingStep: "round_summary",
      startTaskId: controller.id,
    });
    const sequence = [[affected], [nextContact], [distance]];
    let executions = 0;
    const result = await runCombatStepAutomation({
      classify: () => ({ countsTowardProcessed: true, kind: "execute" }),
      execute: async () => ({
        kind: "accepted",
        projection: projection({
          revision: `revision-${executions + 2}`,
          step: "round_summary",
          tasks: sequence[executions++] ?? [],
        }),
      }),
      identity: contactIdentity,
      initial: projection({ step: "round_summary", tasks: [controller] }),
    });

    expect(result.acceptedTasks.map((entry) => entry.taskId)).toEqual([
      "contact-a-controller",
      "contact-a-affected",
      "contact-b-controller",
    ]);
    expect(result.processedCount).toBe(3);
    expect(result.stepComplete).toBe(true);
    expect(result.finalTask?.kind).toBe("distance_commit");
  });

  it("keeps ordinary distance rolls in their exact family and stops before GM commit", async () => {
    const first = processTask("distance-a", "npc-a", "distance", "distance_roll");
    const second = processTask("distance-b", "npc-b", "distance", "distance_roll");
    const commit = processTask("distance-commit", "gm", "distance", "distance_commit");
    const distanceIdentity = combatStepAutomationRunIdentitySchema.parse({
      ...identity(),
      startExecutionGroupId: first.executionGroupId,
      startProcessFamily: "ordinary_distance_roll",
      startProcessId: first.processId,
      startingStep: "round_summary",
      startTaskId: first.id,
    });
    const sequence = [[second], [commit]];
    let executions = 0;
    const result = await runCombatStepAutomation({
      classify: () => ({ countsTowardProcessed: true, kind: "execute" }),
      execute: async () => ({
        kind: "accepted",
        projection: projection({
          revision: `revision-${executions + 2}`,
          step: "round_summary",
          tasks: sequence[executions++] ?? [],
        }),
      }),
      identity: distanceIdentity,
      initial: projection({ step: "round_summary", tasks: [first] }),
    });

    expect(result.acceptedTasks.map((entry) => entry.taskId)).toEqual(["distance-a", "distance-b"]);
    expect(result.processedCount).toBe(2);
    expect(result.stepComplete).toBe(true);
    expect(result.finalTask?.kind).toBe("distance_commit");
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

  /**
   * #948. One participant the run cannot resolve does not halt the remaining batch. The position
   * of that participant is driven explicitly, because a batch that only works when the
   * unresolvable row comes last is not fixed.
   */
  describe("#948 one unresolvable participant is skipped and the batch continues", () => {
    async function runBatchWithOneUnresolvable(input: {
      badIndex: number;
      decision: "skip" | "stop";
    }) {
      const participants = ["npc-a", "npc-b", "npc-c", "npc-d"];
      const tasks = participants.map((participantId) =>
        task(`observe-${participantId}`, participantId, "observation_roll"),
      );
      const badTaskId = tasks[input.badIndex]!.id;
      // A skipped task resolves nothing, so it stays in the projection; an executed one leaves it.
      let remaining = [...tasks];
      return runCombatStepAutomation({
        classify: ({ task: current }) =>
          current.id === badTaskId
            ? input.decision === "skip"
              ? {
                  kind: "skip",
                  missingData: ["intelligence_characteristic"],
                  reason: "observation_basis_data_missing",
                }
              : { kind: "stop", reason: "observation_review_required" }
            : { countsTowardProcessed: true, kind: "execute" },
        execute: async ({ task: current }) => {
          remaining = remaining.filter((candidate) => candidate.id !== current.id);
          return { kind: "accepted", projection: projection({ tasks: remaining }) };
        },
        identity: identity(),
        initial: projection({ tasks }),
      });
    }

    it.each([
      { badIndex: 0, position: "first" },
      { badIndex: 1, position: "in the middle" },
      { badIndex: 3, position: "last" },
    ])("resolves the other three when the unresolvable one is $position", async ({ badIndex }) => {
      const result = await runBatchWithOneUnresolvable({ badIndex, decision: "skip" });

      expect(result.processedCount).toBe(3);
      expect(result.acceptedTasks).toHaveLength(3);
      expect(result.skippedTasks).toHaveLength(1);
      expect(result.skippedTasks[0]).toMatchObject({
        missingData: ["intelligence_characteristic"],
        participantId: ["npc-a", "npc-b", "npc-c", "npc-d"][badIndex],
        reason: "observation_basis_data_missing",
      });
      expect(result.stopReason).toBe("end_of_step");
      // The skipped task is still there, so the step is not complete and it stays resolvable.
      expect(result.stepComplete).toBe(false);
      expect(result.finalTask?.taskId).toBe(
        `observe-${["npc-a", "npc-b", "npc-c", "npc-d"][badIndex]}`,
      );
    });

    it("negative control — the same batch halts when the condition stops instead of skipping", async () => {
      const result = await runBatchWithOneUnresolvable({ badIndex: 1, decision: "stop" });

      expect(result.processedCount).toBe(1);
      expect(result.skippedTasks).toEqual([]);
      expect(result.stopParticipantId).toBe("npc-b");
      expect(result.stopReason).toBe("observation_review_required");
    });

    it("skips every unresolvable participant rather than only the first", async () => {
      const tasks = ["npc-a", "npc-b", "npc-c"].map((participantId) =>
        task(`observe-${participantId}`, participantId, "observation_roll"),
      );
      let remaining = [...tasks];
      const result = await runCombatStepAutomation({
        classify: ({ task: current }) =>
          current.id === "observe-npc-b"
            ? { kind: "skip", reason: "observation_target_invalid" }
            : current.id === "observe-npc-c"
              ? { kind: "skip", reason: "observation_contest_unavailable" }
              : { countsTowardProcessed: true, kind: "execute" },
        execute: async ({ task: current }) => {
          remaining = remaining.filter((candidate) => candidate.id !== current.id);
          return { kind: "accepted", projection: projection({ tasks: remaining }) };
        },
        identity: identity(),
        initial: projection({ tasks }),
      });

      expect(result.processedCount).toBe(1);
      expect(result.skippedTasks.map((skipped) => [skipped.participantId, skipped.reason])).toEqual(
        [
          ["npc-b", "observation_target_invalid"],
          ["npc-c", "observation_contest_unavailable"],
        ],
      );
      expect(result.stopReason).toBe("end_of_step");
      expect(result.stepComplete).toBe(false);
    });
  });

  /**
   * #948 (Product Owner ruling of 2026-11-05). The skip has to be **recorded** for the batch to
   * continue, and `recordSkip` is where the run records it.
   *
   * This harness models the round-end pin the ruling names: the ordered contest stage exposes only
   * the first participant whose work is neither resolved nor set aside
   * (`combatRoundEndProcesses.ts`, `completedParticipantIds`), and a set-aside task keeps a
   * projected task of its own so it stays resolvable. With nothing recorded the set-aside task is
   * still the one the stage exposes, so the participants after it never become executable — which
   * is exactly what was measured before the marker existed.
   */
  describe("#948 recording the skip is what continues the batch", () => {
    const participants = ["npc-a", "npc-b", "npc-c", "npc-d"];

    async function runPinnedBatch(input: { badIndex: number; record: boolean }) {
      const all = participants.map((participantId) =>
        task(`observe:contest:${participantId}`, participantId, "observation_roll"),
      );
      const badTaskId = all[input.badIndex]!.id;
      const resolved = new Set<string>();
      const marked = new Set<string>();
      const recorded: Array<{ missingData: readonly string[]; reason: string; taskId: string }> =
        [];
      const visible = () => {
        const contest = all.find(
          (candidate) => !resolved.has(candidate.id) && !marked.has(candidate.id),
        );
        const review = all.filter((candidate) => marked.has(candidate.id));
        return [...(contest ? [contest] : []), ...review];
      };
      const result = await runCombatStepAutomation({
        classify: ({ task: current }) =>
          current.id === badTaskId
            ? {
                key: `attempt:${current.identity.participantId}`,
                kind: "skip",
                missingData: ["intelligence_characteristic"],
                reason: "observation_basis_data_missing",
              }
            : { countsTowardProcessed: true, kind: "execute" },
        execute: async ({ task: current }) => {
          resolved.add(current.id);
          return { kind: "accepted", projection: projection({ tasks: visible() }) };
        },
        identity: identity(),
        initial: projection({ tasks: all.slice(0, 1) }),
        ...(input.record
          ? {
              recordSkip: async ({ missingData, reason, task: current }) => {
                marked.add(current.id);
                recorded.push({ missingData, reason, taskId: current.id });
                return projection({ tasks: visible() });
              },
            }
          : {}),
      });
      return { recorded, result };
    }

    it.each([
      { badIndex: 0, position: "first" },
      { badIndex: 1, position: "in the middle" },
      { badIndex: 3, position: "last" },
    ])(
      "records the skip and resolves the other three when it is $position",
      async ({ badIndex }) => {
        const { recorded, result } = await runPinnedBatch({ badIndex, record: true });

        expect(result.processedCount).toBe(3);
        expect(result.skippedTasks).toHaveLength(1);
        expect(result.skippedTasks[0]).toMatchObject({
          missingData: ["intelligence_characteristic"],
          participantId: participants[badIndex],
          reason: "observation_basis_data_missing",
        });
        // Recorded exactly once, with the reason and the missing datum the GM report needs.
        expect(recorded).toEqual([
          {
            missingData: ["intelligence_characteristic"],
            reason: "observation_basis_data_missing",
            taskId: `observe:contest:${participants[badIndex]}`,
          },
        ]);
      },
    );

    /**
     * The disabled twin. Nothing about the classifier changes: only the recording is withheld, and
     * the batch stops at the set-aside participant again. The `last` row is why one position is
     * not a test — there every check rolls and the run reads as a complete success either way.
     */
    it("negative control — withholding the record pins the batch exactly as before", async () => {
      const measured: Array<{ badIndex: number; processedCount: number }> = [];
      for (const badIndex of [0, 1, 3]) {
        const { result } = await runPinnedBatch({ badIndex, record: false });
        measured.push({ badIndex, processedCount: result.processedCount });
      }

      expect(measured).toEqual([
        { badIndex: 0, processedCount: 0 },
        { badIndex: 1, processedCount: 1 },
        { badIndex: 3, processedCount: 3 },
      ]);
    });

    it("reports the same set-aside work once, however many task ids present it", async () => {
      // The real cause: a projected task id carries the boundary kind and the stage, and a
      // set-aside Observe attempt moves from the ordered contest stage to the review stage, so the
      // same attempt is presented under a second id inside one run.
      const contest = task("observe:contest:npc-a", "npc-a", "observation_roll");
      const review = task("observe:review:npc-a", "npc-a", "observation_roll");
      const other = task("observe:contest:npc-b", "npc-b", "observation_roll");
      let tasks = [contest, other];
      const result = await runCombatStepAutomation({
        classify: ({ task: current }) =>
          current.identity.participantId === "npc-a"
            ? { key: "attempt:npc-a", kind: "skip", reason: "observation_basis_data_missing" }
            : { countsTowardProcessed: true, kind: "execute" },
        execute: async () => {
          tasks = [review];
          return { kind: "accepted", projection: projection({ tasks }) };
        },
        identity: identity(),
        initial: projection({ tasks }),
        recordSkip: async () => {
          tasks = [review, other];
          return projection({ tasks });
        },
      });

      expect(result.processedCount).toBe(1);
      expect(result.skippedTasks.map((skipped) => skipped.task.taskId)).toEqual([
        "observe:contest:npc-a",
      ]);
      expect(
        result.attemptedTasks.filter((attempted) => attempted.participantId === "npc-a"),
      ).toHaveLength(1);
    });
  });
});
