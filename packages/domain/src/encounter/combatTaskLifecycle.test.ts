import { describe, expect, it } from "vitest";

import {
  advanceCombatRoundStep,
  advanceCombatTaskAtOpportunity,
  authorizeCombatProgressionTask,
  buildCombatLogProjection,
  buildCombatProgressionProjection,
  cancelCombatTaskAtDeclarationBoundary,
  combatDeclarationPrimaryIntentSchema,
  combatRoundStateSchema,
  commitCombatRoundEndParticipantReview,
  finishCombatTaskAtOpportunity,
  getCombatRoundOpenPerformTaskForParticipant,
  prepareCombatRoundEndReview,
  projectCombatLogForViewer,
  resolveCombatTaskAtOpportunity,
  reviewCombatTaskAtOpportunity,
  rollCombatTaskAtOpportunity,
  undoLatestCombatRoundCommand,
  type CombatGenericAction,
  type CombatGenericActionDuration,
  type CombatRoundState,
} from "../index";

const at = "2026-01-01T00:00:00.000Z";
const later = "2026-01-01T00:05:00.000Z";

const statRoll = {
  basis: { baseValue: 14, kind: "stat" as const, statId: "dex" as const, statLabel: "Dex" },
  difficulty: 26,
};

function task(overrides: Partial<CombatGenericAction> = {}): CombatGenericAction {
  return {
    createdAt: at,
    createdByUserId: "user-gm",
    declarationKind: "perform_task",
    duration: { kind: "gm_decided" },
    id: "round:1:participant:a:declaration:perform_task",
    intent: "Force the portcullis winch.",
    ownerParticipantId: "a",
    lastUpdatedAt: at,
    progress: { completedRounds: 0 },
    status: "declared",
    ...overrides,
  } as CombatGenericAction;
}

function state(
  input: { action?: CombatGenericAction; roundNumber?: number } = {},
): CombatRoundState {
  const roundNumber = input.roundNumber ?? 1;
  return combatRoundStateSchema.parse({
    currentCursor: { participantId: "a", roundNumber, step: "A1" },
    currentStep: "phase_1_actions",
    encounterId: "encounter-1",
    genericActions: [input.action ?? task()],
    participants: [
      {
        declaration: { actionId: "perform_task", roundNumber, submittedBy: "player" },
        label: "Aline",
        participantId: "a",
      },
      { label: "Brand", participantId: "b" },
    ],
    phaseResolutionCursor: { participantId: "a", phase: "phase1", substep: "perform_task" },
    phaseResolutionStatuses: { a: { phase1: { substep: "perform_task", updatedAt: at } } },
    roundNumber,
    selectedParticipantId: "a",
    selectedStep: "phase_1_actions",
  });
}

function currentTask(source: CombatRoundState) {
  const projection = buildCombatProgressionProjection(source);
  const tasks = projection.boundary.processes
    .flatMap((process) => process.stages)
    .flatMap((stage) => stage.executionGroups)
    .flatMap((group) => group.tasks);
  expect(tasks).toHaveLength(1);
  return { projection, task: tasks[0]! };
}

function reviewed(input: {
  duration: CombatGenericActionDuration;
  source?: CombatRoundState;
  withRoll?: boolean;
}) {
  return reviewCombatTaskAtOpportunity({
    actionId: task().id,
    command: { createdAt: at, createdByUserId: "user-gm" },
    duration: input.duration,
    participantId: "a",
    phase: "phase1",
    rollRequest: input.withRoll === false ? undefined : statRoll,
    state: input.source ?? state(),
    updatedAt: at,
  });
}

describe("canonical Perform Task lifecycle (A1a)", () => {
  it("projects the declared task at the owner's primary-action opportunity", () => {
    const { projection, task: projected } = currentTask(state());
    expect(projection.boundary.kind).toBe("phase1_resolution");
    expect(projected).toMatchObject({
      allowedActors: ["gm"],
      expectedCommand: "review_combat_task",
      kind: "combat_task_review",
      state: "executable",
    });
    expect(projected.identity.actionId).toBe(task().id);
    expect(projected.processId).toContain("process:perform_task");
  });

  it("moves through review, roll and resolve at the same opportunity", () => {
    const afterReview = reviewed({ duration: { kind: "round" } });
    expect(afterReview.action.status).toBe("active");
    expect(afterReview.command.type).toBe("review_combat_task");

    const rollTask = currentTask(afterReview.state).task;
    expect(rollTask).toMatchObject({
      expectedCommand: "roll_combat_task",
      kind: "combat_task_roll",
    });

    const afterRoll = rollCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-a" },
      participantId: "a",
      phase: "phase1",
      result: {
        achievedLevelId: "success",
        achievedLevelLabel: "Success",
        calculationText: "14 + 12 = 26",
        dieResult: 12,
        finalTotal: 26,
        openEndedD10s: [],
        rollD20: 12,
        rolledAt: later,
        success: true,
      },
      state: afterReview.state,
      updatedAt: later,
    });
    const resolveTask = currentTask(afterRoll.state).task;
    expect(resolveTask).toMatchObject({
      allowedActors: ["gm"],
      expectedCommand: "resolve_combat_task",
      kind: "combat_task_resolve",
    });
  });

  it("resolves a one-round task at the actor's own primary-action opportunity", () => {
    const afterReview = reviewed({ duration: { kind: "round" } });
    const resolved = resolveCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase: "phase1",
      resultText: "The winch groans and the portcullis lifts a hand's width.",
      state: afterReview.state,
      updatedAt: later,
      visibleToParticipantIds: ["b"],
    });
    expect(resolved.action).toMatchObject({
      progress: { completedRounds: 1, lastProgressedRoundNumber: 1, totalRounds: 1 },
      status: "completed",
    });
    expect(resolved.state.events.filter((event) => event.type === "task_resolved")).toHaveLength(1);
    expect(
      getCombatRoundOpenPerformTaskForParticipant({
        participantId: "a",
        phase: "phase1",
        state: resolved.state,
      }),
    ).toBeUndefined();
  });

  it("advances an N-round task once per round and completes after exactly N advances", () => {
    let current = reviewed({ duration: { kind: "rounds", rounds: 3 }, withRoll: false }).state;

    for (const roundNumber of [1, 2]) {
      const projected = currentTask(current).task;
      expect(projected.kind).toBe("combat_task_advance");
      const advanced = advanceCombatTaskAtOpportunity({
        actionId: task().id,
        command: { createdAt: later, createdByUserId: "user-a" },
        participantId: "a",
        phase: "phase1",
        state: current,
        submittedBy: "player",
        updatedAt: later,
      });
      expect(advanced.action.progress).toMatchObject({
        completedRounds: roundNumber,
        lastProgressedRoundNumber: roundNumber,
        totalRounds: 3,
      });
      // The consumed opportunity is closed for the rest of this round.
      expect(
        getCombatRoundOpenPerformTaskForParticipant({
          participantId: "a",
          phase: "phase1",
          state: advanced.state,
        }),
      ).toBeUndefined();
      current = state({ action: advanced.action, roundNumber: roundNumber + 1 });
    }

    const finalTask = currentTask(current).task;
    expect(finalTask.kind).toBe("combat_task_resolve");
    expect(() =>
      advanceCombatTaskAtOpportunity({
        actionId: task().id,
        command: { createdAt: later },
        participantId: "a",
        phase: "phase1",
        state: current,
        submittedBy: "gm",
        updatedAt: later,
      }),
    ).toThrow(/completes at this opportunity/);

    const resolved = resolveCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase: "phase1",
      resultText: "The winch finally gives.",
      state: current,
      updatedAt: later,
      visibleToParticipantIds: [],
    });
    expect(resolved.action).toMatchObject({
      progress: { completedRounds: 3, totalRounds: 3 },
      status: "completed",
    });
  });

  it("refuses a second advance in the same round", () => {
    const advanced = advanceCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later },
      participantId: "a",
      phase: "phase1",
      state: reviewed({ duration: { kind: "rounds", rounds: 2 }, withRoll: false }).state,
      submittedBy: "player",
      updatedAt: later,
    });
    expect(() =>
      advanceCombatTaskAtOpportunity({
        actionId: task().id,
        command: { createdAt: later },
        participantId: "a",
        phase: "phase1",
        state: advanced.state,
        submittedBy: "player",
        updatedAt: later,
      }),
    ).toThrow(/no longer holds the actor's action opportunity/);
  });

  it("lets GM adjudication interrupt an active task", () => {
    const interrupted = finishCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      kind: "interrupt",
      participantId: "a",
      phase: "phase1",
      state: reviewed({ duration: { kind: "rounds", rounds: 4 }, withRoll: false }).state,
      updatedAt: later,
    });
    expect(interrupted.action.status).toBe("interrupted");
    expect(interrupted.command.type).toBe("interrupt_combat_task");
  });
});

describe("Perform Task resolve timing", () => {
  function resolveAt(source: CombatRoundState) {
    return resolveCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase: "phase1",
      resultText: "The winch gives.",
      state: source,
      updatedAt: later,
      visibleToParticipantIds: [],
    });
  }

  function advanceAt(source: CombatRoundState) {
    return advanceCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-a" },
      participantId: "a",
      phase: "phase1",
      state: source,
      submittedBy: "player",
      updatedAt: later,
    });
  }

  it("refuses to resolve a two-round task at its first opportunity", () => {
    const afterReview = reviewed({ duration: { kind: "rounds", rounds: 2 }, withRoll: false });
    expect(afterReview.action.progress).toMatchObject({ completedRounds: 0, totalRounds: 2 });
    expect(() => resolveAt(afterReview.state)).toThrow(
      /cannot resolve before its reviewed timing completes/,
    );
  });

  it("refuses to resolve a three-round task at its first and second opportunities", () => {
    const afterReview = reviewed({ duration: { kind: "rounds", rounds: 3 }, withRoll: false });
    expect(() => resolveAt(afterReview.state)).toThrow(
      /cannot resolve before its reviewed timing completes/,
    );

    const advanced = advanceAt(afterReview.state);
    expect(advanced.action.progress).toMatchObject({ completedRounds: 1, totalRounds: 3 });
    expect(() => resolveAt(state({ action: advanced.action, roundNumber: 2 }))).toThrow(
      /cannot resolve before its reviewed timing completes/,
    );
  });

  it("leaves the refused state untouched", () => {
    const afterReview = reviewed({ duration: { kind: "rounds", rounds: 2 }, withRoll: false });
    const commandCount = afterReview.state.commands.length;
    const eventCount = afterReview.state.events.length;
    expect(() => resolveAt(afterReview.state)).toThrow();
    expect(afterReview.state.commands).toHaveLength(commandCount);
    expect(afterReview.state.events).toHaveLength(eventCount);
    expect(afterReview.state.genericActions[0]).toMatchObject({
      progress: { completedRounds: 0 },
      status: "active",
    });
  });

  it("still resolves a two-round task at its final opportunity", () => {
    const afterReview = reviewed({ duration: { kind: "rounds", rounds: 2 }, withRoll: false });
    const advanced = advanceAt(afterReview.state);
    const resolved = resolveAt(state({ action: advanced.action, roundNumber: 2 }));
    expect(resolved.action).toMatchObject({
      progress: { completedRounds: 2, totalRounds: 2 },
      status: "completed",
    });
  });

  it("still resolves a gm_decided task at any opportunity", () => {
    const afterReview = reviewed({ duration: { kind: "gm_decided" }, withRoll: false });
    expect(resolveAt(afterReview.state).action.status).toBe("completed");
  });
});

/**
 * Regression suite for Forgejo #344.
 *
 * Every next-round state here is produced by the **production** rollover — `advanceCombatRoundStep`
 * calling `advanceCombatGenericActionsToRound` — and never by the hand-written `state()` helper the
 * rest of this file uses. That helper is why the defect survived six gates: it fabricated a
 * next-round shape the rollover never emits, so the assertions never saw the stamped
 * `lastProgressedRoundNumber` that closed the opportunity for good.
 */
describe("Perform Task across a real round rollover (#344)", () => {
  function stepUntil(source: CombatRoundState, target: CombatRoundState["currentStep"]) {
    let current = source;
    for (let guard = 0; guard < 12; guard += 1) {
      if (current.currentStep === target) return current;
      current = advanceCombatRoundStep(current);
    }
    throw new Error(`Never reached ${target} through advanceCombatRoundStep.`);
  }

  function completeRoundEndReview(source: CombatRoundState): CombatRoundState {
    const prepared = prepareCombatRoundEndReview({
      command: { createdAt: later, createdByUserId: "user-gm" },
      state: source,
    });
    return prepared.participants.reduce((current, participant) => {
      if (
        current.roundEndReview?.participantReviews[participant.participantId]?.status === "complete"
      ) {
        return current;
      }
      return commitCombatRoundEndParticipantReview({
        command: { createdAt: later, createdByUserId: "user-gm" },
        participantId: participant.participantId,
        scenarioParticipantId: `scenario-${participant.participantId}`,
        state: current,
      }).state;
    }, prepared);
  }

  /**
   * Carries the encounter across one real round boundary and stops at the next round's Phase 1
   * action opportunity. Every transition is `advanceCombatRoundStep`; nothing about the task's
   * next-round progress is written by the test.
   */
  function rollOverToNextRound(source: CombatRoundState): CombatRoundState {
    const atRoundSummary = stepUntil(source, "round_summary");
    const nextRound = advanceCombatRoundStep(completeRoundEndReview(atRoundSummary));
    expect(nextRound.roundNumber).toBe(source.roundNumber + 1);
    expect(nextRound.currentStep).toBe("select_actions");
    return stepUntil(nextRound, "phase_1_actions");
  }

  function openTask(source: CombatRoundState) {
    return getCombatRoundOpenPerformTaskForParticipant({
      participantId: "a",
      phase: "phase1",
      state: source,
    });
  }

  function projectedTaskKinds(source: CombatRoundState): string[] {
    return buildCombatProgressionProjection(source)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.executionGroups)
      .flatMap((group) => group.tasks)
      .filter((entry) => entry.id.includes(task().id))
      .map((entry) => entry.kind);
  }

  function resolveAt(source: CombatRoundState) {
    return resolveCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase: "phase1",
      resultText: "The winch finally gives.",
      state: source,
      updatedAt: later,
      visibleToParticipantIds: [],
    });
  }

  it("leaves the round-2 opportunity open after a plain rollover, with no GM advance at all", () => {
    const roundOne = reviewed({ duration: { kind: "rounds", rounds: 2 }, withRoll: false }).state;
    const roundTwo = rollOverToNextRound(roundOne);

    const carried = roundTwo.genericActions[0]!;
    // The rollover counts the elapsed round and must not stamp the opportunity marker.
    expect(carried.progress).toMatchObject({
      completedRounds: 1,
      startedRoundNumber: 1,
      totalRounds: 2,
    });
    expect(carried.progress.lastProgressedRoundNumber).toBeUndefined();
    expect(carried.status).toBe("active");

    expect(openTask(roundTwo)?.id).toBe(task().id);
    expect(projectedTaskKinds(roundTwo)).toEqual(["combat_task_resolve"]);

    const resolved = resolveAt(roundTwo);
    expect(resolved.action).toMatchObject({
      progress: { completedRounds: 2, lastProgressedRoundNumber: 2, totalRounds: 2 },
      status: "completed",
    });
    expect(resolved.state.events.filter((event) => event.type === "task_resolved")).toHaveLength(1);
  });

  it("does not let a GM advance in round 1 consume the round-2 opportunity as well", () => {
    const advanced = advanceCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-a" },
      participantId: "a",
      phase: "phase1",
      state: reviewed({ duration: { kind: "rounds", rounds: 2 }, withRoll: false }).state,
      submittedBy: "player",
      updatedAt: later,
    });
    expect(advanced.action.progress).toMatchObject({
      completedRounds: 1,
      lastProgressedRoundNumber: 1,
    });
    expect(openTask(advanced.state)).toBeUndefined();

    const roundTwo = rollOverToNextRound(advanced.state);
    const carried = roundTwo.genericActions[0]!;
    // The round the GM already spent is counted once, not twice.
    expect(carried.progress).toMatchObject({
      completedRounds: 1,
      lastProgressedRoundNumber: 1,
      totalRounds: 2,
    });
    expect(openTask(roundTwo)?.id).toBe(task().id);
    expect(resolveAt(roundTwo).action.status).toBe("completed");
  });

  it("offers the GM a control at every round of a three-round task, across two real rollovers", () => {
    const roundOne = reviewed({ duration: { kind: "rounds", rounds: 3 }, withRoll: false }).state;
    expect(projectedTaskKinds(roundOne)).toEqual(["combat_task_advance"]);

    const roundTwo = rollOverToNextRound(roundOne);
    expect(roundTwo.genericActions[0]!.progress).toMatchObject({ completedRounds: 1 });
    expect(openTask(roundTwo)?.id).toBe(task().id);
    expect(projectedTaskKinds(roundTwo)).toEqual(["combat_task_advance"]);
    expect(() => resolveAt(roundTwo)).toThrow(
      /cannot resolve before its reviewed timing completes/,
    );

    const roundThree = rollOverToNextRound(roundTwo);
    expect(roundThree.genericActions[0]!.progress).toMatchObject({ completedRounds: 2 });
    expect(openTask(roundThree)?.id).toBe(task().id);
    expect(projectedTaskKinds(roundThree)).toEqual(["combat_task_resolve"]);
    expect(resolveAt(roundThree).action).toMatchObject({
      progress: { completedRounds: 3, totalRounds: 3 },
      status: "completed",
    });
  });

  it("leaves a phase duration's progress untouched by the rollover", () => {
    const roundOne = reviewed({
      duration: { kind: "phase", phase: "phase2" },
      withRoll: false,
    }).state;
    const before = roundOne.genericActions[0]!;
    const after = rollOverToNextRound(roundOne).genericActions[0]!;

    expect(after.progress).toEqual(before.progress);
    expect(after.progress).toMatchObject({ completedRounds: 0 });
    expect(after.progress.lastProgressedRoundNumber).toBeUndefined();
    expect(after.progress.totalRounds).toBeUndefined();
    expect(after.lastUpdatedAt).toBe(before.lastUpdatedAt);
    expect(after.status).toBe("active");
  });

  it("leaves a gm_decided duration's progress untouched by the rollover", () => {
    const roundOne = reviewed({ duration: { kind: "gm_decided" }, withRoll: false }).state;
    const before = roundOne.genericActions[0]!;
    const after = rollOverToNextRound(roundOne).genericActions[0]!;

    expect(after.progress).toEqual(before.progress);
    expect(after.progress).toMatchObject({ completedRounds: 0 });
    expect(after.progress.lastProgressedRoundNumber).toBeUndefined();
    expect(after.lastUpdatedAt).toBe(before.lastUpdatedAt);
    expect(openTask(rollOverToNextRound(roundOne))?.id).toBe(task().id);
  });
});

describe("open Perform Task selection with more than one live task", () => {
  const roundOneTask = task();
  const roundTwoTask = task({
    createdAt: later,
    id: "round:2:participant:a:declaration:perform_task",
    intent: "Brace the winch handle.",
    lastUpdatedAt: later,
  });

  function twoTaskState(actions: readonly CombatGenericAction[]): CombatRoundState {
    return combatRoundStateSchema.parse({
      ...state({ roundNumber: 2 }),
      genericActions: actions,
    });
  }

  function selected(actions: readonly CombatGenericAction[]) {
    return getCombatRoundOpenPerformTaskForParticipant({
      phase: "phase1",
      participantId: "a",
      state: twoTaskState(actions),
    });
  }

  it("selects the current round's declaration rather than the stale earlier one", () => {
    expect(selected([roundOneTask, roundTwoTask])?.id).toBe(roundTwoTask.id);
  });

  it("selects the same task whichever order the two are stored in", () => {
    expect(selected([roundTwoTask, roundOneTask])?.id).toBe(roundTwoTask.id);
  });

  it("keeps an in-progress task ahead of a newer untouched declaration", () => {
    const inProgress = task({
      progress: { completedRounds: 1, lastProgressedRoundNumber: 1, totalRounds: 3 },
      status: "active",
    });
    expect(selected([inProgress, roundTwoTask])?.id).toBe(inProgress.id);
    expect(selected([roundTwoTask, inProgress])?.id).toBe(inProgress.id);
  });

  it("returns the remaining task once the selected one reaches a terminal status", () => {
    const cancelled = task({
      createdAt: later,
      id: roundTwoTask.id,
      lastUpdatedAt: later,
      status: "cancelled",
    });
    expect(selected([roundOneTask, cancelled])?.id).toBe(roundOneTask.id);
  });

  it("never selects another participant's task", () => {
    const foreign = task({
      createdAt: later,
      id: "round:2:participant:b:declaration:perform_task",
      lastUpdatedAt: later,
      ownerParticipantId: "b",
    });
    expect(selected([roundOneTask, foreign])?.id).toBe(roundOneTask.id);
  });
});

describe("Perform Task command authorization (M3)", () => {
  const source = state();

  it("authorizes only the exact projected task, group and boundary", () => {
    const { projection, task: projected } = currentTask(source);
    expect(
      authorizeCombatProgressionTask({
        actionId: projected.identity.actionId,
        actor: { kind: "gm" },
        commandType: "review_combat_task",
        executionGroupId: projected.executionGroupId,
        participantId: "a",
        phase: "phase1",
        projection,
        taskId: projected.id,
      }),
    ).toMatchObject({ ok: true });

    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "review_combat_task",
        executionGroupId: projected.executionGroupId,
        phase: "phase1",
        projection,
        taskId: "some-other-task",
      }),
    ).toMatchObject({ code: "task_mismatch", ok: false });

    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "review_combat_task",
        executionGroupId: "some-other-group",
        phase: "phase1",
        projection,
        taskId: projected.id,
      }),
    ).toMatchObject({ code: "execution_group_mismatch", ok: false });

    expect(
      authorizeCombatProgressionTask({
        actionId: "some-other-action",
        actor: { kind: "gm" },
        commandType: "review_combat_task",
        phase: "phase1",
        projection,
      }),
    ).toMatchObject({ code: "identity_mismatch", ok: false });

    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "a" },
        commandType: "review_combat_task",
        phase: "phase1",
        projection,
        taskId: projected.id,
      }),
    ).toMatchObject({ code: "gm_only", ok: false });
  });

  it("refuses a resolve command while the review task is projected", () => {
    const { projection, task: projected } = currentTask(source);
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "resolve_combat_task",
        phase: "phase1",
        projection,
        taskId: projected.id,
      }),
    ).toMatchObject({ code: "task_not_found", ok: false });
  });

  it("refuses a lifecycle command outside the Phase 1 resolution boundary", () => {
    const declarationState = combatRoundStateSchema.parse({
      ...source,
      currentCursor: { participantId: "a", roundNumber: 1, step: "DE" },
      currentStep: "select_actions",
      phaseResolutionCursor: undefined,
    });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "review_combat_task",
        phase: "phase1",
        projection: buildCombatProgressionProjection(declarationState),
      }),
    ).toMatchObject({ code: "boundary_closed", ok: false });
  });
});

describe("Perform Task undo (M4)", () => {
  it("restores exactly the pre-resolution state from compact inverse facts", () => {
    const before = reviewed({ duration: { kind: "round" } }).state;
    const resolved = resolveCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase: "phase1",
      resultText: "The winch groans.",
      state: before,
      updatedAt: later,
      visibleToParticipantIds: ["b"],
    });
    expect(resolved.state.events).toHaveLength(1);

    const undone = undoLatestCombatRoundCommand({ state: resolved.state });
    expect(undone).toBeDefined();
    expect(undone!.events).toHaveLength(0);
    expect(undone).toEqual(combatRoundStateSchema.parse(before));
  });

  it("round-trips every new persisted command class", () => {
    const afterReview = reviewed({ duration: { kind: "rounds", rounds: 2 }, withRoll: false });
    const base = combatRoundStateSchema.parse(state());
    expect(undoLatestCombatRoundCommand({ state: afterReview.state })).toEqual(base);

    const advanced = advanceCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later },
      participantId: "a",
      phase: "phase1",
      state: afterReview.state,
      submittedBy: "player",
      updatedAt: later,
    });
    expect(undoLatestCombatRoundCommand({ state: advanced.state })).toEqual(
      combatRoundStateSchema.parse(afterReview.state),
    );

    const cancelled = finishCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later },
      kind: "cancel",
      participantId: "a",
      phase: "phase1",
      state: afterReview.state,
      updatedAt: later,
    });
    expect(undoLatestCombatRoundCommand({ state: cancelled.state })).toEqual(
      combatRoundStateSchema.parse(afterReview.state),
    );
  });

  it("writes compact versioned inverse facts and never a CombatRoundState snapshot", () => {
    const resolved = resolveCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase: "phase1",
      resultText: "The winch groans.",
      state: reviewed({ duration: { kind: "round" } }).state,
      updatedAt: later,
      visibleToParticipantIds: [],
    });
    for (const command of resolved.state.commands) {
      expect(command.facts).not.toHaveProperty("previousState");
      const undoFacts = command.facts.taskUndo as Record<string, unknown>;
      expect(undoFacts.version).toBe(1);
      expect(undoFacts).not.toHaveProperty("participants");
      expect(undoFacts).not.toHaveProperty("commands");
      expect(undoFacts).not.toHaveProperty("events");
    }
  });
});

describe("Perform Task Combat Log projection (M4)", () => {
  function resolvedState() {
    return resolveCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase: "phase1",
      resultText: "The winch groans and the portcullis lifts.",
      state: reviewed({ duration: { kind: "round" } }).state,
      updatedAt: later,
      visibleToParticipantIds: [],
    }).state;
  }

  it("renders the resolved task with its canonical summary facts", () => {
    const projection = buildCombatLogProjection({
      encounterId: "encounter-1",
      sourceRevision: later,
      state: resolvedState(),
    });
    const entry = projection.events.find((event) => event.summaryFacts.kind === "task_resolved");
    expect(entry).toBeDefined();
    expect(entry!.summaryFacts).toMatchObject({ kind: "task_resolved", taskId: task().id });
    expect(entry!.summary).toContain("The winch groans and the portcullis lifts.");
    expect(entry!.audienceParticipantIds).toEqual(["a"]);
  });

  it("delivers the authored result only to its audience", () => {
    const projection = buildCombatLogProjection({
      encounterId: "encounter-1",
      sourceRevision: later,
      state: resolvedState(),
    });
    const owner = projectCombatLogForViewer({
      projection,
      viewer: {
        controlledParticipantIds: new Set(["a"]),
        kind: "player",
        visibleParticipantIds: new Set(["a", "b"]),
      },
    });
    const bystander = projectCombatLogForViewer({
      projection,
      viewer: {
        controlledParticipantIds: new Set(["b"]),
        kind: "player",
        visibleParticipantIds: new Set(["a", "b"]),
      },
    });
    expect(owner.events.some((event) => event.summaryFacts.kind === "task_resolved")).toBe(true);
    expect(bystander.events.some((event) => event.summaryFacts.kind === "task_resolved")).toBe(
      false,
    );
  });
});

describe("Perform Task declaration contract (M1, M2)", () => {
  it("leaves combatDeclarationPrimaryIntentSchema identical to its baseline members", () => {
    expect(Object.keys(combatDeclarationPrimaryIntentSchema.shape).sort()).toEqual([
      "actionId",
      "description",
      "taskId",
    ]);
  });

  it("applies look_around as a preset of the Perform Task declaration through GM review", () => {
    const reviewedLookAround = reviewCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: at, createdByUserId: "user-gm" },
      duration: { kind: "round" },
      participantId: "a",
      phase: "phase1",
      preset: "look_around",
      rollRequest: {
        basis: {
          avgStats: 12,
          baseValue: 30,
          derivedXp: 0,
          groupXp: 0,
          kind: "skill",
          skillId: "perception",
          skillLabel: "Perception",
          skillXp: 0,
          unknownSkillPenalty: 0,
        },
        difficulty: 26,
      },
      state: state(),
      updatedAt: at,
    });
    expect(reviewedLookAround.action).toMatchObject({
      awarenessContext: { kind: "survey" },
      declarationKind: "perform_task",
      preset: "look_around",
      rollRequest: { basis: { kind: "skill", skillId: "perception" } },
    });
    // No new declaration action id is introduced.
    expect(reviewedLookAround.state.participants[0]?.declaration?.actionId).toBe("perform_task");
  });

  it("refuses the look_around preset without the canonical Perception basis", () => {
    expect(() =>
      reviewCombatTaskAtOpportunity({
        actionId: task().id,
        command: { createdAt: at },
        duration: { kind: "round" },
        participantId: "a",
        phase: "phase1",
        preset: "look_around",
        rollRequest: statRoll,
        state: state(),
        updatedAt: at,
      }),
    ).toThrow(/canonical Perception skill/);
  });
});

describe("one primary action per round with two live Perform Tasks", () => {
  const firstTask = task();
  const secondTask = task({
    createdAt: later,
    id: "round:1:participant:a:declaration:perform_task:second",
    intent: "Brace the winch handle.",
    lastUpdatedAt: later,
  });

  function twoLiveTaskState(
    input: {
      actions?: readonly CombatGenericAction[];
      roundNumber?: number;
    } = {},
  ): CombatRoundState {
    return combatRoundStateSchema.parse({
      ...state({ roundNumber: input.roundNumber ?? 1 }),
      genericActions: input.actions ?? [firstTask, secondTask],
    });
  }

  function open(source: CombatRoundState) {
    return getCombatRoundOpenPerformTaskForParticipant({
      participantId: "a",
      phase: "phase1",
      state: source,
    });
  }

  function reviewAndResolve(input: { actionId: string; source: CombatRoundState }) {
    const afterReview = reviewCombatTaskAtOpportunity({
      actionId: input.actionId,
      command: { createdAt: at, createdByUserId: "user-gm" },
      duration: { kind: "round" },
      participantId: "a",
      phase: "phase1",
      state: input.source,
      updatedAt: at,
    });
    return resolveCombatTaskAtOpportunity({
      actionId: input.actionId,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase: "phase1",
      resultText: "The winch groans.",
      state: afterReview.state,
      updatedAt: later,
      visibleToParticipantIds: [],
    });
  }

  it("closes the participant's opportunity for the whole round, not merely for the resolved task", () => {
    const source = twoLiveTaskState();
    const selected = open(source);
    expect(selected?.id).toBe(secondTask.id);

    const resolved = reviewAndResolve({ actionId: selected!.id, source });

    // The other task has never progressed, so its own progress still looks open — but the
    // participant's Phase 1 primary-action opportunity is spent for this round.
    expect(resolved.state.genericActions.find((action) => action.id === firstTask.id)).toEqual(
      firstTask,
    );
    expect(resolved.state.phaseResolutionStatuses.a?.phase1?.substep).toBe("done");
    expect(open(resolved.state)).toBeUndefined();
  });

  it("refuses a second Perform Task command in the same round", () => {
    const resolved = reviewAndResolve({ actionId: secondTask.id, source: twoLiveTaskState() });

    expect(() =>
      reviewCombatTaskAtOpportunity({
        actionId: firstTask.id,
        command: { createdAt: later, createdByUserId: "user-gm" },
        duration: { kind: "round" },
        participantId: "a",
        phase: "phase1",
        state: resolved.state,
        updatedAt: later,
      }),
    ).toThrow(/no longer holds the actor's action opportunity/);

    expect(() =>
      resolveCombatTaskAtOpportunity({
        actionId: firstTask.id,
        command: { createdAt: later, createdByUserId: "user-gm" },
        participantId: "a",
        phase: "phase1",
        resultText: "And the other one too.",
        state: resolved.state,
        updatedAt: later,
        visibleToParticipantIds: [],
      }),
    ).toThrow(/no longer holds the actor's action opportunity/);

    expect(
      resolved.state.events.filter(
        (event) => event.type === "task_resolved" && event.roundNumber === 1,
      ),
    ).toHaveLength(1);
    expect(
      resolved.state.genericActions.filter((action) => action.status === "completed"),
    ).toHaveLength(1);
  });

  it("does not lose the unselected task — it is executable again next round", () => {
    const resolved = reviewAndResolve({ actionId: secondTask.id, source: twoLiveTaskState() });
    // A new round clears phaseResolutionStatuses, which reopens the participant's opportunity.
    const nextRound = twoLiveTaskState({
      actions: resolved.state.genericActions,
      roundNumber: 2,
    });
    expect(open(nextRound)?.id).toBe(firstTask.id);
  });

  it("reopens the opportunity exactly when the consuming command is undone", () => {
    const source = twoLiveTaskState();
    const afterReview = reviewCombatTaskAtOpportunity({
      actionId: secondTask.id,
      command: { createdAt: at, createdByUserId: "user-gm" },
      duration: { kind: "round" },
      participantId: "a",
      phase: "phase1",
      state: source,
      updatedAt: at,
    });
    const resolved = resolveCombatTaskAtOpportunity({
      actionId: secondTask.id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase: "phase1",
      resultText: "The winch groans.",
      state: afterReview.state,
      updatedAt: later,
      visibleToParticipantIds: [],
    });
    expect(open(resolved.state)).toBeUndefined();

    const undone = undoLatestCombatRoundCommand({ state: resolved.state });
    expect(undone).toEqual(combatRoundStateSchema.parse(afterReview.state));
    expect(open(undone!)?.id).toBe(secondTask.id);
  });
});

describe("the spent-opportunity gate does not depend on the executability source", () => {
  const firstTask = task();
  const secondTask = task({
    createdAt: later,
    id: "round:1:participant:a:declaration:perform_task:second",
    intent: "Brace the winch handle.",
    lastUpdatedAt: later,
  });

  /**
   * `observe_opponent` is a Phase 1 executability source with no substep of its own, so the cursor
   * machinery clears the participant's `done` status and re-derives it as `perform_task`. The
   * substep gate alone is bypassed by exactly that; completion evidence is not, because it reads
   * the immutable command log.
   */
  function twoLiveTaskState(input: { declarationActionId: string; roundNumber?: number }) {
    const roundNumber = input.roundNumber ?? 1;
    return combatRoundStateSchema.parse({
      currentCursor: { participantId: "a", roundNumber, step: "A1" },
      currentStep: "phase_1_actions",
      encounterId: "encounter-1",
      genericActions: [firstTask, secondTask],
      participants: [
        {
          declaration: {
            actionId: input.declarationActionId,
            roundNumber,
            submittedBy: "player",
          },
          label: "Aline",
          participantId: "a",
        },
        { label: "Brand", participantId: "b" },
      ],
      phaseResolutionCursor: { participantId: "a", phase: "phase1", substep: "perform_task" },
      phaseResolutionStatuses: { a: { phase1: { substep: "perform_task", updatedAt: at } } },
      roundNumber,
      selectedParticipantId: "a",
      selectedStep: "phase_1_actions",
    });
  }

  function open(source: CombatRoundState) {
    return getCombatRoundOpenPerformTaskForParticipant({
      participantId: "a",
      phase: "phase1",
      state: source,
    });
  }

  function review(input: { actionId: string; source: CombatRoundState }) {
    return reviewCombatTaskAtOpportunity({
      actionId: input.actionId,
      command: { createdAt: at, createdByUserId: "user-gm" },
      duration: { kind: "round" },
      participantId: "a",
      phase: "phase1",
      state: input.source,
      updatedAt: at,
    });
  }

  function reviewAndResolve(input: { actionId: string; source: CombatRoundState }) {
    return resolveCombatTaskAtOpportunity({
      actionId: input.actionId,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase: "phase1",
      resultText: "The winch groans.",
      state: review(input).state,
      updatedAt: later,
      visibleToParticipantIds: [],
    });
  }

  it("holds the opportunity closed when the participant stays executable through observe_opponent", () => {
    const resolved = reviewAndResolve({
      actionId: secondTask.id,
      source: twoLiveTaskState({ declarationActionId: "observe_opponent" }),
    });

    // The cursor machinery genuinely re-derives the mutable substep here — that is the bypass the
    // substep gate alone could not survive.
    expect(resolved.state.phaseResolutionStatuses.a?.phase1?.substep).toBe("perform_task");
    // Completion evidence is immutable, so the opportunity stays spent anyway.
    expect(open(resolved.state)).toBeUndefined();

    expect(() =>
      reviewCombatTaskAtOpportunity({
        actionId: firstTask.id,
        command: { createdAt: later, createdByUserId: "user-gm" },
        duration: { kind: "round" },
        participantId: "a",
        phase: "phase1",
        state: resolved.state,
        updatedAt: later,
      }),
    ).toThrow(/no longer holds the actor's action opportunity/);

    expect(() =>
      resolveCombatTaskAtOpportunity({
        actionId: firstTask.id,
        command: { createdAt: later, createdByUserId: "user-gm" },
        participantId: "a",
        phase: "phase1",
        resultText: "And the other one too.",
        state: resolved.state,
        updatedAt: later,
        visibleToParticipantIds: [],
      }),
    ).toThrow(/no longer holds the actor's action opportunity/);

    expect(
      resolved.state.events.filter(
        (event) => event.type === "task_resolved" && event.roundNumber === 1,
      ),
    ).toHaveLength(1);
    expect(
      resolved.state.genericActions.filter((action) => action.status === "completed"),
    ).toHaveLength(1);
    // The unselected task is untouched.
    expect(resolved.state.genericActions.find((action) => action.id === firstTask.id)).toEqual(
      firstTask,
    );
  });

  it("still keeps the substep gate, which completion evidence does not subsume", () => {
    // A committed feint, break-off, adjust-distance or disarm spends the Phase 1 primary action by
    // setting `done` with an action step status of `complete`. None of them leaves a command the
    // completion-evidence helper recognises, so evidence alone would hand the task back.
    const spentByAnotherPrimaryAction = combatRoundStateSchema.parse({
      ...twoLiveTaskState({ declarationActionId: "perform_task" }),
      participants: [
        {
          declaration: { actionId: "perform_task", roundNumber: 1, submittedBy: "player" },
          label: "Aline",
          participantId: "a",
          stepStatuses: { phase_1_actions: "complete" },
        },
        { label: "Brand", participantId: "b" },
      ],
      phaseResolutionStatuses: { a: { phase1: { substep: "done", updatedAt: later } } },
    });

    // No completion evidence exists in this state at all.
    expect(spentByAnotherPrimaryAction.commands).toHaveLength(0);
    expect(open(spentByAnotherPrimaryAction)).toBeUndefined();
  });

  it("reopens on undo and does not lose the unselected task, through the observe_opponent source", () => {
    const source = twoLiveTaskState({ declarationActionId: "observe_opponent" });
    const afterReview = review({ actionId: secondTask.id, source });
    const resolved = resolveCombatTaskAtOpportunity({
      actionId: secondTask.id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase: "phase1",
      resultText: "The winch groans.",
      state: afterReview.state,
      updatedAt: later,
      visibleToParticipantIds: [],
    });
    expect(open(resolved.state)).toBeUndefined();

    const undone = undoLatestCombatRoundCommand({ state: resolved.state });
    expect(undone).toEqual(combatRoundStateSchema.parse(afterReview.state));
    expect(open(undone!)?.id).toBe(secondTask.id);

    // Next round: `phaseResolutionStatuses` clears and the round-scoped evidence falls away, so
    // the task that was never selected is still there and becomes executable again.
    const nextRound = combatRoundStateSchema.parse({
      ...twoLiveTaskState({ declarationActionId: "observe_opponent", roundNumber: 2 }),
      genericActions: resolved.state.genericActions,
    });
    expect(open(nextRound)?.id).toBe(firstTask.id);
  });
});

/**
 * Product Owner ruling of 2026-09-22 on Forgejo issue #287: `{ kind: "phase", phase }` is a
 * one-opportunity Perform Task scheduled for the actor's primary-action opportunity in the named
 * phase. `phase1` resolves only at Phase 1, `phase2` only at Phase 2, never the other way, and
 * phase duration is not equivalent to `round` or `rounds: N`.
 */
describe("phase duration schedules the named primary-action opportunity", () => {
  function phase2State(
    input: { action?: CombatGenericAction; roundNumber?: number } = {},
  ): CombatRoundState {
    const roundNumber = input.roundNumber ?? 1;
    return combatRoundStateSchema.parse({
      ...state({ action: input.action, roundNumber }),
      currentCursor: { participantId: "a", roundNumber, step: "A2" },
      currentStep: "phase_2_actions",
      phaseResolutionCursor: { participantId: "a", phase: "phase2", substep: "perform_task" },
      phaseResolutionStatuses: {
        a: {
          phase1: { substep: "done", updatedAt: at },
          phase2: { substep: "perform_task", updatedAt: at },
        },
      },
      selectedStep: "phase_2_actions",
    });
  }

  function openAt(phase: "phase1" | "phase2", source: CombatRoundState) {
    return getCombatRoundOpenPerformTaskForParticipant({
      participantId: "a",
      phase,
      state: source,
    });
  }

  function resolveAt(phase: "phase1" | "phase2", source: CombatRoundState) {
    return resolveCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      phase,
      resultText: "The winch gives.",
      state: source,
      updatedAt: later,
      visibleToParticipantIds: [],
    });
  }

  function scheduled(duration: CombatGenericActionDuration): CombatGenericAction {
    return task({ duration, progress: { completedRounds: 0, totalRounds: 1 }, status: "active" });
  }

  it("resolves a phase1 task only at the Phase 1 opportunity", () => {
    const action = scheduled({ kind: "phase", phase: "phase1" });
    expect(openAt("phase1", state({ action }))?.id).toBe(action.id);
    expect(openAt("phase2", phase2State({ action }))).toBeUndefined();

    const resolved = resolveAt("phase1", state({ action }));
    expect(resolved.action.status).toBe("completed");
    expect(resolved.command.phase).toBe("phase1");
  });

  it("refuses a phase1 task at the Phase 2 opportunity", () => {
    expect(() =>
      resolveAt("phase2", phase2State({ action: scheduled({ kind: "phase", phase: "phase1" }) })),
    ).toThrow(/scheduled for the actor's Phase 1 primary-action opportunity/);
  });

  it("resolves a phase2 task only at the Phase 2 opportunity", () => {
    const action = scheduled({ kind: "phase", phase: "phase2" });
    expect(openAt("phase1", state({ action }))).toBeUndefined();
    expect(openAt("phase2", phase2State({ action }))?.id).toBe(action.id);

    const resolved = resolveAt("phase2", phase2State({ action }));
    expect(resolved.action.status).toBe("completed");
    expect(resolved.command.phase).toBe("phase2");
    const event = resolved.state.events.find((entry) => entry.type === "task_resolved");
    expect(event).toMatchObject({ phase: "phase2", step: "phase_2_actions" });
  });

  it("refuses a phase2 task at the Phase 1 opportunity", () => {
    expect(() =>
      resolveAt("phase1", state({ action: scheduled({ kind: "phase", phase: "phase2" }) })),
    ).toThrow(/scheduled for the actor's Phase 2 primary-action opportunity/);
  });

  it("makes phase observably different from round and from rounds: N", () => {
    // `round` and `rounds: N` use the actor's normal primary-action opportunity — Phase 1 — and are
    // refused at Phase 2. Only a `phase` duration can name Phase 2 at all.
    for (const duration of [
      { kind: "round" } as const,
      { kind: "rounds", rounds: 2 } as const,
      { kind: "gm_decided" } as const,
    ]) {
      const action = task({ duration, status: "active" });
      expect(openAt("phase1", state({ action }))?.id).toBe(action.id);
      expect(openAt("phase2", phase2State({ action }))).toBeUndefined();
    }

    const phase2Task = scheduled({ kind: "phase", phase: "phase2" });
    expect(openAt("phase1", state({ action: phase2Task }))).toBeUndefined();
    expect(openAt("phase2", phase2State({ action: phase2Task }))?.id).toBe(phase2Task.id);
  });

  it("defers the Phase 1 opportunity when review schedules the task into Phase 2", () => {
    const afterReview = reviewCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: at, createdByUserId: "user-gm" },
      duration: { kind: "phase", phase: "phase2" },
      participantId: "a",
      phase: "phase1",
      state: state(),
      updatedAt: at,
    });
    expect(afterReview.action.duration).toEqual({ kind: "phase", phase: "phase2" });
    expect(afterReview.command.facts.scheduledPhase).toBe("phase2");
    // Phase 1 is closed for this participant so the resolution cursor moves on, and the task is
    // not resolvable there.
    expect(afterReview.state.phaseResolutionStatuses.a?.phase1?.substep).toBe("done");
    expect(openAt("phase1", afterReview.state)).toBeUndefined();
    expect(() => resolveAt("phase1", afterReview.state)).toThrow(
      /scheduled for the actor's Phase 2 primary-action opportunity/,
    );

    // The same task is executable at its named Phase 2 opportunity in the same round.
    const atPhase2 = phase2State({ action: afterReview.action });
    expect(openAt("phase2", atPhase2)?.id).toBe(task().id);
    const resolved = resolveAt("phase2", atPhase2);
    expect(resolved.action.status).toBe("completed");
    // One primary action, not two: Phase 2 is now spent as well.
    expect(openAt("phase2", resolved.state)).toBeUndefined();
    expect(resolved.state.events.filter((event) => event.type === "task_resolved")).toHaveLength(1);
  });

  it("undoes the deferring review exactly", () => {
    const source = state();
    const afterReview = reviewCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: at, createdByUserId: "user-gm" },
      duration: { kind: "phase", phase: "phase2" },
      participantId: "a",
      phase: "phase1",
      state: source,
      updatedAt: at,
    });
    expect(undoLatestCombatRoundCommand({ state: afterReview.state })).toEqual(
      combatRoundStateSchema.parse(source),
    );
  });

  it("undoes a Phase 2 resolution exactly", () => {
    const atPhase2 = phase2State({ action: scheduled({ kind: "phase", phase: "phase2" }) });
    const resolved = resolveAt("phase2", atPhase2);
    expect(undoLatestCombatRoundCommand({ state: resolved.state })).toEqual(
      combatRoundStateSchema.parse(atPhase2),
    );
  });

  it("uses existing GM adjudication when the named opportunity cannot be completed", () => {
    const atPhase2 = phase2State({ action: scheduled({ kind: "phase", phase: "phase2" }) });
    const cancelled = finishCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      kind: "cancel",
      participantId: "a",
      phase: "phase2",
      state: atPhase2,
      updatedAt: later,
    });
    expect(cancelled.action.status).toBe("cancelled");
    expect(cancelled.command.type).toBe("cancel_combat_task");
    expect(cancelled.command.phase).toBe("phase2");
    // No silent resolution at the other phase: nothing resolved, and the task is gone from both.
    expect(cancelled.state.events.filter((event) => event.type === "task_resolved")).toHaveLength(
      0,
    );
    expect(openAt("phase1", cancelled.state)).toBeUndefined();
    expect(openAt("phase2", cancelled.state)).toBeUndefined();

    const interrupted = finishCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      kind: "interrupt",
      participantId: "a",
      phase: "phase2",
      state: atPhase2,
      updatedAt: later,
    });
    expect(interrupted.action.status).toBe("interrupted");
    expect(interrupted.command.phase).toBe("phase2");
  });

  it("never grants two primary actions across the two phases", () => {
    // A Phase 2 task does not make Phase 1 executable, and a spent Phase 2 opportunity is not
    // reopened by the untouched Phase 1 status.
    const action = scheduled({ kind: "phase", phase: "phase2" });
    const atPhase2 = phase2State({ action });
    const resolved = resolveAt("phase2", atPhase2);
    expect(resolved.state.phaseResolutionStatuses.a?.phase2?.substep).toBe("done");
    expect(openAt("phase1", resolved.state)).toBeUndefined();
    expect(openAt("phase2", resolved.state)).toBeUndefined();
    expect(() => resolveAt("phase2", resolved.state)).toThrow(
      /no longer holds the actor's action opportunity/,
    );
  });

  it("projects the task at the Phase 2 boundary and authorizes it there", () => {
    const action = scheduled({ kind: "phase", phase: "phase2" });
    const { projection, task: projected } = currentTask(phase2State({ action }));
    expect(projection.boundary.kind).toBe("phase2_resolution");
    expect(projected).toMatchObject({
      expectedCommand: "resolve_combat_task",
      kind: "combat_task_resolve",
      state: "executable",
    });
    expect(
      authorizeCombatProgressionTask({
        actionId: projected.identity.actionId,
        actor: { kind: "gm" },
        commandType: "resolve_combat_task",
        executionGroupId: projected.executionGroupId,
        participantId: "a",
        phase: "phase2",
        projection,
        taskId: projected.id,
      }),
    ).toMatchObject({ ok: true });
    // The Phase 1 boundary does not authorize it.
    expect(
      authorizeCombatProgressionTask({
        actionId: projected.identity.actionId,
        actor: { kind: "gm" },
        commandType: "resolve_combat_task",
        executionGroupId: projected.executionGroupId,
        participantId: "a",
        phase: "phase1",
        projection,
        taskId: projected.id,
      }),
    ).toMatchObject({ ok: false });
  });
});

/**
 * The declaration-surface escape required by rule decision 0007 ruling 3. It is the same
 * `cancel_combat_task` command as the opportunity cancel, issued at the other boundary a GM can
 * meet the one-live-task refusal at, and the two boundaries are mutually exclusive.
 */
describe("declaration-boundary Combat Task cancellation (A1b)", () => {
  function declarationState(overrides: Partial<CombatGenericAction> = {}): CombatRoundState {
    return combatRoundStateSchema.parse({
      currentCursor: { participantId: "a", roundNumber: 2, step: "DE" },
      currentStep: "select_actions",
      encounterId: "encounter-1",
      genericActions: [task({ ...overrides })],
      participants: [
        { label: "Aline", participantId: "a" },
        { label: "Brand", participantId: "b" },
      ],
      roundNumber: 2,
      selectedParticipantId: "a",
      selectedStep: "select_actions",
    });
  }

  it("cancels the live task without spending the actor's primary action", () => {
    const source = declarationState();
    const outcome = cancelCombatTaskAtDeclarationBoundary({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      state: source,
      updatedAt: later,
    });

    expect(outcome.action.status).toBe("cancelled");
    expect(outcome.command.type).toBe("cancel_combat_task");
    expect(outcome.state.currentStep).toBe(source.currentStep);
    expect(outcome.state.currentCursor).toEqual(source.currentCursor);
    expect(outcome.state.selectedStep).toBe(source.selectedStep);
    expect(outcome.state.phaseResolutionCursor).toEqual(source.phaseResolutionCursor);
    expect(outcome.state.phaseResolutionStatuses).toEqual(source.phaseResolutionStatuses);
    expect(outcome.state.participants).toEqual(source.participants);
    expect(outcome.state.events).toEqual(source.events);
    expect(outcome.command.facts.taskUndo).toMatchObject({ boundary: "declaration", version: 1 });
    expect(outcome.command.facts).not.toHaveProperty("previousState");
  });

  /**
   * The in-round escape hatch (Forgejo issue #311). The declaration-boundary cancel writes a
   * `cancel_combat_task` command with `consumesOpportunity: false`, and the command-log witness in
   * `getCombatRoundOpenPerformTaskForParticipant` used to read that command as evidence that the
   * actor's primary action for the phase had been spent — so a replacement Task declared in the
   * same round was filtered out by the very cancel meant to free the opportunity. A command
   * recording a declaration boundary in its compact inverse facts is not that evidence. The
   * opportunity-boundary cancel, which does spend the opportunity, still is.
   */
  it("leaves the actor's opportunity open for a replacement task declared in the same round", () => {
    const source = declarationState();
    const cancelled = cancelCombatTaskAtDeclarationBoundary({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      state: source,
      updatedAt: later,
    });

    expect(
      getCombatRoundOpenPerformTaskForParticipant({
        participantId: "a",
        phase: "phase1",
        state: cancelled.state,
      }),
    ).toBeUndefined();

    const replacement = task({
      createdAt: later,
      id: "round:1:participant:a:declaration:perform_task:replacement:2",
      intent: "Bar the gate instead.",
    });
    const withReplacement = combatRoundStateSchema.parse({
      ...cancelled.state,
      genericActions: [...cancelled.state.genericActions, replacement],
    });

    expect(
      getCombatRoundOpenPerformTaskForParticipant({
        participantId: "a",
        phase: "phase1",
        state: withReplacement,
      }),
    ).toMatchObject({ id: replacement.id, status: "declared" });
  });

  it("keeps the opportunity-boundary cancel closing the actor's opportunity", () => {
    const cancelled = finishCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      kind: "cancel",
      participantId: "a",
      phase: "phase1",
      state: state(),
      updatedAt: later,
    });
    const replacement = task({
      createdAt: later,
      id: "round:1:participant:a:declaration:perform_task:replacement:2",
      intent: "Bar the gate instead.",
    });
    const withReplacement = combatRoundStateSchema.parse({
      ...cancelled.state,
      genericActions: [...cancelled.state.genericActions, replacement],
    });

    expect(cancelled.command.facts.taskUndo).toMatchObject({ boundary: "opportunity" });
    expect(
      getCombatRoundOpenPerformTaskForParticipant({
        participantId: "a",
        phase: "phase1",
        state: withReplacement,
      }),
      "an opportunity-boundary cancel spends the primary action for the round",
    ).toBeUndefined();
  });

  it("undoes to byte-equal prior state", () => {
    const source = declarationState();
    const outcome = cancelCombatTaskAtDeclarationBoundary({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      participantId: "a",
      state: source,
      updatedAt: later,
    });
    const undone = undoLatestCombatRoundCommand({ state: outcome.state });

    expect(JSON.stringify(undone)).toBe(JSON.stringify(combatRoundStateSchema.parse(source)));
  });

  it("refuses a task that is not this participant's live Perform Task", () => {
    for (const overrides of [
      { status: "cancelled" as const },
      { status: "completed" as const },
      { ownerParticipantId: "b" },
      { declarationKind: undefined },
    ]) {
      expect(() =>
        cancelCombatTaskAtDeclarationBoundary({
          actionId: task().id,
          command: { createdAt: later, createdByUserId: "user-gm" },
          participantId: "a",
          state: declarationState(overrides),
          updatedAt: later,
        }),
      ).toThrow(/no live Combat Task to cancel/);
    }
  });

  it("refuses while the task holds the actor's current action opportunity, where Current action owns the cancel", () => {
    expect(() =>
      cancelCombatTaskAtDeclarationBoundary({
        actionId: task().id,
        command: { createdAt: later, createdByUserId: "user-gm" },
        participantId: "a",
        state: state(),
        updatedAt: later,
      }),
    ).toThrow(/Cancel it from Current action/);
  });

  it("leaves the opportunity cancel the only path at the opportunity", () => {
    const outcome = finishCombatTaskAtOpportunity({
      actionId: task().id,
      command: { createdAt: later, createdByUserId: "user-gm" },
      kind: "cancel",
      participantId: "a",
      phase: "phase1",
      state: state(),
      updatedAt: later,
    });

    expect(outcome.action.status).toBe("cancelled");
    expect(outcome.command.facts.taskUndo).toMatchObject({ boundary: "opportunity" });
    expect(outcome.state.phaseResolutionStatuses.a?.phase1?.substep).toBe("done");
  });
});
