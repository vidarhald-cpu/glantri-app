import { describe, expect, it } from "vitest";

import {
  advanceCombatTaskAtOpportunity,
  authorizeCombatProgressionTask,
  buildCombatLogProjection,
  buildCombatProgressionProjection,
  combatDeclarationPrimaryIntentSchema,
  combatRoundStateSchema,
  finishCombatTaskAtOpportunity,
  getCombatRoundOpenPerformTaskForParticipant,
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
      getCombatRoundOpenPerformTaskForParticipant({ participantId: "a", state: resolved.state }),
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
        getCombatRoundOpenPerformTaskForParticipant({ participantId: "a", state: advanced.state }),
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
        projection,
        taskId: "some-other-task",
      }),
    ).toMatchObject({ code: "task_mismatch", ok: false });

    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "review_combat_task",
        executionGroupId: "some-other-group",
        projection,
        taskId: projected.id,
      }),
    ).toMatchObject({ code: "execution_group_mismatch", ok: false });

    expect(
      authorizeCombatProgressionTask({
        actionId: "some-other-action",
        actor: { kind: "gm" },
        commandType: "review_combat_task",
        projection,
      }),
    ).toMatchObject({ code: "identity_mismatch", ok: false });

    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "a" },
        commandType: "review_combat_task",
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
        projection,
        taskId: projected.id,
      }),
    ).toMatchObject({ ok: false });
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
    return getCombatRoundOpenPerformTaskForParticipant({ participantId: "a", state: source });
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
