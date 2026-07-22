import { describe, expect, it } from "vitest";

import {
  buildCombatRoundAttackRollResult,
  combatRoundStateSchema,
  recordCombatRoundAttackResult,
  recordCombatRoundGlobalParticipantCommand,
  undoLatestCombatRoundCommand,
  type CombatRoundCursorStep,
  type CombatRoundState,
  type CombatRoundStep,
} from "./combatRoundManager";
import {
  advanceCombatProgressionBoundary,
  authorizeCombatProgressionTask,
  buildCombatProgressionProjection,
  projectCombatProgressionPresentation,
  type CombatProgressionBoundaryKind,
} from "./combatProgressionProjection";

function participant(id: string, label: string) {
  return {
    characterId: `character-${id}`,
    label,
    participantId: id,
    scenarioParticipantId: `scenario-${id}`,
  };
}

function state(
  input: {
    cursorParticipantId?: string;
    cursorStep?: CombatRoundCursorStep;
    currentStep?: CombatRoundStep;
    overrides?: Record<string, unknown>;
    participantOverrides?: Record<string, unknown>[];
    roundNumber?: number;
  } = {},
): CombatRoundState {
  const roundNumber = input.roundNumber ?? 2;
  const participants = [participant("hero", "Hero"), participant("guard", "Guard")].map(
    (entry, index) => ({ ...entry, ...(input.participantOverrides?.[index] ?? {}) }),
  );
  return combatRoundStateSchema.parse({
    currentCursor: input.cursorStep
      ? {
          participantId: input.cursorParticipantId,
          roundNumber,
          step: input.cursorStep,
        }
      : undefined,
    currentStep: input.currentStep ?? "select_actions",
    participants,
    roundNumber,
    ...input.overrides,
  });
}

function taskKinds(projection: ReturnType<typeof buildCombatProgressionProjection>) {
  return projection.boundary.processes.flatMap((process) =>
    process.stages.flatMap((stage) => stage.tasks.map((task) => task.kind)),
  );
}

describe("CombatProgressionProjection", () => {
  it("waits after completed declarations and advances to M1 only through the GM task", () => {
    const waiting = state({
      cursorParticipantId: "guard",
      cursorStep: "DE",
      participantOverrides: [
        {
          declaration: { actionId: "move_only", roundNumber: 2, submittedBy: "player" },
          stepStatuses: { select_actions: "submitted" },
        },
        {
          declaration: { actionId: "move_only", roundNumber: 2, submittedBy: "player" },
          stepStatuses: { select_actions: "submitted" },
        },
      ],
    });
    const projection = buildCombatProgressionProjection(waiting);
    const task = projection.boundary.processes
      .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((candidate) => candidate.kind === "gm_advance_boundary");

    expect(waiting.currentStep).toBe("select_actions");
    expect(task).toMatchObject({
      allowedActors: ["gm"],
      expectedCommand: "advance_combat_boundary",
      state: "executable",
      transition: {
        currentBoundary: "declaration",
        targetBoundary: "phase1_modifier_review",
      },
    });
    const playerView = projectCombatProgressionPresentation({
      projection,
      viewer: {
        controlledParticipantIds: new Set(["hero"]),
        kind: "player",
        visibleParticipantIds: new Set(["hero", "guard"]),
      },
    });
    expect(playerView.awaitingGmTransition).toBe(true);
    expect(
      playerView.processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks)),
    ).not.toContainEqual(expect.objectContaining({ kind: "gm_advance_boundary" }));
    expect(() =>
      advanceCombatProgressionBoundary({
        command: { createdAt: "2026-07-19T10:00:00.000Z", createdByUserId: "gm" },
        expectedBoundary: "declaration",
        expectedTaskId: "stale:boundary-task",
        state: waiting,
        targetBoundary: "phase1_modifier_review",
      }),
    ).toThrow("projected combat boundary task changed");

    const advanced = advanceCombatProgressionBoundary({
      command: { createdAt: "2026-07-19T10:00:00.000Z", createdByUserId: "gm" },
      expectedBoundary: "declaration",
      expectedTaskId: task?.id,
      state: waiting,
      targetBoundary: "phase1_modifier_review",
    });
    expect(advanced.currentStep).toBe("review_action_modifiers");
    expect(advanced.currentCursor?.step).toBe("M1");
    expect(advanced.commands.at(-1)).toMatchObject({
      facts: {
        currentBoundary: "declaration",
        targetBoundary: "phase1_modifier_review",
      },
      type: "advance_combat_boundary",
    });

    const undone = undoLatestCombatRoundCommand({ state: advanced });
    expect(undone?.currentStep).toBe("select_actions");
    expect(undone?.currentCursor?.step).toBe("DE");
    expect(buildCombatProgressionProjection(undone!)).toEqual(projection);
  });

  it.each([
    ["phase1", "A1", "phase_1_actions", "phase1_resolution", "phase2_modifier_review", "M2"],
    ["phase2", "A2", "phase_2_actions", "phase2_resolution", "round_end", "SU"],
  ] as const)(
    "keeps completed %s resolution waiting until the GM opens %s",
    (phase, cursorStep, currentStep, boundary, targetBoundary, targetCursor) => {
      const waiting = state({ cursorParticipantId: "hero", cursorStep, currentStep });
      const reloaded = combatRoundStateSchema.parse(JSON.parse(JSON.stringify(waiting)));
      const projection = buildCombatProgressionProjection(waiting);
      const task = projection.boundary.processes
        .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
        .find((candidate) => candidate.kind === "gm_advance_boundary");

      expect(projection.boundary.kind).toBe(boundary);
      expect(task?.transition).toMatchObject({ currentBoundary: boundary, targetBoundary });
      expect(buildCombatProgressionProjection(reloaded)).toEqual(projection);
      expect(() =>
        advanceCombatProgressionBoundary({
          command: { createdAt: "2026-07-19T10:00:00.000Z" },
          expectedBoundary: boundary,
          state: waiting,
          targetBoundary: "round_boundary",
        }),
      ).toThrow("requested combat boundary target");

      const advanced = advanceCombatProgressionBoundary({
        command: { createdAt: "2026-07-19T10:00:00.000Z" },
        expectedBoundary: boundary,
        state: waiting,
        targetBoundary,
      });
      expect(advanced.currentCursor?.step).toBe(targetCursor);
      expect(buildCombatProgressionProjection(advanced).boundary.kind).toBe(targetBoundary);
      expect(advanced.currentStep).toBe(
        phase === "phase1" ? "review_phase_2_modifiers" : "round_summary",
      );
    },
  );

  it("projects the first unresolved Phase 2 modifier review when the cursor row is complete", () => {
    const current = state({
      cursorParticipantId: "hero",
      cursorStep: "M2",
      currentStep: "review_phase_2_modifiers",
      participantOverrides: [
        { stepStatuses: { review_phase_2_modifiers: "gmEdited" } },
        { stepStatuses: {} },
      ],
    });
    const projection = buildCombatProgressionProjection(current);
    const reviewTask = projection.boundary.processes
      .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((candidate) => candidate.kind === "modifier_review");

    expect(reviewTask).toMatchObject({
      allowedActors: ["gm"],
      expectedCommand: "review_modifiers_phase2",
      identity: { phase: "phase2" },
      owner: { kind: "combatant", participantId: "guard" },
      presentationContext: {
        actor: { participantId: "guard" },
      },
      state: "executable",
      trackerFacet: { owner: { participantId: "guard" }, step: "M2" },
    });
  });

  it.each([
    [
      "M1",
      "review_action_modifiers",
      "review_action_modifiers",
      "phase1_modifier_review",
      "phase1_initiative",
      "initiative_phase_1",
    ],
    [
      "M2",
      "review_phase_2_modifiers",
      "review_phase_2_modifiers",
      "phase2_modifier_review",
      "phase2_initiative",
      "initiative_phase_2",
    ],
  ] as const)(
    "keeps completed %s modifier review waiting for the GM",
    (cursorStep, currentStep, statusStep, boundary, targetBoundary, expectedStep) => {
      const waiting = state({
        cursorParticipantId: "hero",
        cursorStep,
        currentStep,
        participantOverrides: [
          { stepStatuses: { [statusStep]: "gmEdited" } },
          { stepStatuses: { [statusStep]: "gmEdited" } },
        ],
      });
      const projection = buildCombatProgressionProjection(waiting);
      expect(projection.boundary.kind).toBe(boundary);
      expect(taskKinds(projection)).toContain("gm_advance_boundary");

      const advanced = advanceCombatProgressionBoundary({
        command: { createdAt: "2026-07-19T10:00:00.000Z", createdByUserId: "gm" },
        expectedBoundary: boundary,
        state: waiting,
        targetBoundary,
      });
      expect(advanced.currentStep).toBe(expectedStep);
    },
  );

  it("rejects player, blocked, stale, and skipped boundary transitions", () => {
    const blocked = buildCombatProgressionProjection(
      state({ cursorParticipantId: "hero", cursorStep: "DE" }),
    );
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "advance_combat_boundary",
        currentBoundary: "declaration",
        projection: blocked,
        targetBoundary: "phase1_modifier_review",
      }),
    ).toMatchObject({ code: "task_not_found", ok: false });

    const waiting = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "A1",
        currentStep: "phase_1_actions",
      }),
    );
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "hero" },
        commandType: "advance_combat_boundary",
        currentBoundary: "phase1_resolution",
        projection: waiting,
        targetBoundary: "phase2_modifier_review",
      }),
    ).toMatchObject({ code: "gm_only", ok: false });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "advance_combat_boundary",
        currentBoundary: "phase2_resolution",
        projection: waiting,
        targetBoundary: "round_end",
      }),
    ).toMatchObject({ code: "stale_boundary", ok: false });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "advance_combat_boundary",
        currentBoundary: "phase1_resolution",
        projection: waiting,
        targetBoundary: "round_end",
      }),
    ).toMatchObject({ code: "wrong_target", ok: false });
  });

  it("builds the declaration boundary, process, stage, strategy, ownership, and blockers", () => {
    const projection = buildCombatProgressionProjection(
      state({ cursorParticipantId: "hero", cursorStep: "DE" }),
    );

    expect(projection.boundary.kind).toBe("declaration");
    expect(projection.boundary.processes.map((process) => process.kind)).toEqual(["declaration"]);
    const stage = projection.boundary.processes[0]?.stages[0];
    expect(stage).toMatchObject({ executionStrategy: "parallel_all", kind: "input" });
    expect(stage?.tasks).toHaveLength(2);
    expect(stage?.tasks[0]).toMatchObject({
      allowedActors: ["combatant", "gm"],
      expectedCommand: "declare_action",
      kind: "submit_declaration",
      owner: {
        characterId: "character-hero",
        kind: "combatant",
        label: "Hero",
        participantId: "hero",
        scenarioParticipantId: "scenario-hero",
      },
      state: "executable",
      trackerFacet: { owner: { participantId: "hero" }, step: "DE" },
    });
    expect(
      projection.blockers.some((blocker) => blocker.type === "participant_input_pending"),
    ).toBe(true);
    expect(projection.boundary.blockerIds).toEqual(
      projection.blockers.map((blocker) => blocker.id),
    );
  });

  it.each<
    [CombatRoundCursorStep, CombatRoundStep, CombatProgressionBoundaryKind, string | undefined]
  >([
    ["DE", "select_actions", "declaration", undefined],
    ["M1", "review_action_modifiers", "phase1_modifier_review", undefined],
    ["i1", "initiative_phase_1", "phase1_initiative", undefined],
    ["A1", "phase_1_actions", "phase1_resolution", "hero"],
    ["M2", "review_phase_2_modifiers", "phase2_modifier_review", undefined],
    ["i2", "initiative_phase_2", "phase2_initiative", undefined],
    ["A2", "phase_2_actions", "phase2_resolution", "hero"],
    ["SU", "round_summary", "round_end", "hero"],
    ["SU", "round_summary", "round_boundary", undefined],
  ])("maps %s to the %s boundary", (cursorStep, currentStep, expected, cursorParticipantId) => {
    const projection = buildCombatProgressionProjection(
      state({ cursorParticipantId, cursorStep, currentStep }),
    );
    expect(projection.boundary.kind).toBe(expected);
  });

  it("maps initiative to grouped rolls and an explicit GM commit stage", () => {
    const rolling = buildCombatProgressionProjection(
      state({ cursorParticipantId: "hero", cursorStep: "i1", currentStep: "initiative_phase_1" }),
    );
    expect(rolling.boundary.processes[0]?.stages[0]).toMatchObject({
      executionStrategy: "initiative_groups",
      kind: "roll",
      state: "active",
    });
    expect(taskKinds(rolling)).toEqual(["roll_initiative", "roll_initiative"]);

    const committed = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "i1",
        currentStep: "initiative_phase_1",
        participantOverrides: [{ initiatives: { phase1: 8 } }, { initiatives: { phase1: 4 } }],
      }),
    );
    expect(committed.boundary.processes[0]?.stages[2]).toMatchObject({
      executionStrategy: "gm_review",
      kind: "commit",
      state: "active",
    });
    expect(taskKinds(committed)).toContain("commit_initiative");
  });

  it("projects Combat Experience as a dependency without changing declaration behavior", () => {
    const projection = buildCombatProgressionProjection(
      state({ cursorParticipantId: "hero", cursorStep: "DE", roundNumber: 1 }),
    );
    expect(projection.boundary.processes.map((process) => process.kind)).toEqual([
      "combat_experience",
      "declaration",
    ]);
    expect(taskKinds(projection)).toEqual([
      "combat_experience",
      "combat_experience",
      "combat_experience",
      "submit_declaration",
      "submit_declaration",
    ]);
    expect(projection.blockers.some((blocker) => blocker.type === "gm_commit_pending")).toBe(true);
    expect(
      projection.boundary.processes[1]?.stages[0]?.tasks.every((task) => task.state === "waiting"),
    ).toBe(true);
    expect(
      projection.boundary.processes[0]?.stages[0]?.tasks
        .filter((task) => task.owner?.kind === "combatant")
        .map((task) => task.presentationContext?.difficulty),
    ).toEqual([26, 26]);
  });

  it("maps the adapter-derived standard attack stages without advancing state", () => {
    const projection = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "A1",
        currentStep: "phase_1_actions",
        overrides: {
          phaseResolutionCursor: { participantId: "hero", phase: "phase1", substep: "attack" },
        },
        participantOverrides: [
          {
            declaration: {
              actionId: "attack_parry",
              phaseContexts: { phase1: { targetParticipantId: "guard" } },
              roundNumber: 2,
              submittedBy: "player",
            },
          },
        ],
      }),
    );
    const process = projection.boundary.processes[0];
    expect(process?.kind).toBe("attack");
    expect(
      process?.stages.map(({ executionStrategy, kind, state }) => ({
        executionStrategy,
        kind,
        state,
      })),
    ).toEqual([
      { executionStrategy: "single_task", kind: "attack", state: "active" },
      { executionStrategy: "single_task", kind: "defense", state: "pending" },
      { executionStrategy: "single_task", kind: "hit_location", state: "pending" },
      { executionStrategy: "gm_review", kind: "damage", state: "pending" },
      { executionStrategy: "single_task", kind: "critical", state: "pending" },
      { executionStrategy: "gm_review", kind: "commit", state: "pending" },
    ]);
    expect(process?.planId).toContain("single_attack:attack:");
    expect(process?.stages[0]?.tasks[0]).toMatchObject({
      expectedCommand: "roll_attack",
      kind: "attack",
      owner: { participantId: "hero" },
    });
    expect(process?.stages[0]?.executionGroups).toHaveLength(1);
    expect(process?.stages[0]?.executionGroups[0]?.tasks[0]).toBe(process?.stages[0]?.tasks[0]);
    expect(projection.phaseResolutionCursorEquivalent).toEqual({
      participantId: "hero",
      phase: "phase1",
      substep: "attack",
    });
  });

  it("projects invalid targets and missing proposals as structured blockers and diagnostics", () => {
    const invalidAttack = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "A1",
        currentStep: "phase_1_actions",
        overrides: {
          phaseResolutionCursor: { participantId: "hero", phase: "phase1", substep: "attack" },
        },
        participantOverrides: [
          {
            declaration: {
              actionId: "attack_parry",
              phaseContexts: { phase1: { targetParticipantId: "missing" } },
              roundNumber: 2,
              submittedBy: "player",
            },
          },
        ],
      }),
    );
    expect(invalidAttack.blockers.some((blocker) => blocker.type === "invalid_target")).toBe(true);
    expect(
      invalidAttack.diagnostics.some((diagnostic) => diagnostic.code === "repair_required"),
    ).toBe(true);

    const missingProposal = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "A1",
        currentStep: "phase_1_actions",
        overrides: {
          phaseResolutionCursor: { participantId: "hero", phase: "phase1", substep: "feint" },
        },
        participantOverrides: [
          {
            declaration: { actionId: "feint_attack", roundNumber: 2, submittedBy: "player" },
          },
        ],
      }),
    );
    expect(missingProposal.boundary.processes[0]?.kind).toBe("feint");
    expect(missingProposal.blockers.some((blocker) => blocker.type === "proposal_pending")).toBe(
      true,
    );
    expect(
      missingProposal.diagnostics.some(
        (diagnostic) => diagnostic.code === "proposal_disagrees_with_task",
      ),
    ).toBe(true);
  });

  it("exposes exact compatibility adapters and cursor conflict diagnostics", () => {
    const projection = buildCombatProgressionProjection(
      state({ cursorParticipantId: "hero", cursorStep: "A1", currentStep: "select_actions" }),
    );
    expect(projection.currentCursorEquivalent).toEqual({
      participantId: "hero",
      roundNumber: 2,
      step: "A1",
    });
    expect(projection.currentTaskEquivalent).toEqual({
      cursorStep: "A1",
      participantId: "hero",
      roundNumber: 2,
      step: "phase_1_actions",
    });
    expect(
      projection.diagnostics.some((entry) => entry.code === "cursor_disagrees_with_process"),
    ).toBe(true);
  });

  it("projects participant review and the explicit round boundary task", () => {
    const participantReview = (participantId: string, status: "complete" | "review_ready") => ({
      participantId,
      status,
    });
    const review = {
      participantReviews: {
        guard: participantReview("guard", "complete"),
        hero: participantReview("hero", "review_ready"),
      },
      roundNumber: 2,
    };
    const pending = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "SU",
        currentStep: "round_summary",
        overrides: { roundEndReview: review },
      }),
    );
    const effectReview = pending.boundary.processes.find(
      (process) => process.kind === "effect_review",
    );
    expect(pending.boundary.processes.map((process) => process.kind)).toEqual([
      "distance",
      "participant_review",
      "health_review",
      "effect_review",
      "round_end",
    ]);
    expect(effectReview?.stages[0]?.tasks[0]).toMatchObject({
      allowedActors: ["gm"],
      expectedCommand: "commit_round_end_participant_review",
      identity: { participantId: "hero" },
      kind: "effect_review",
      owner: { kind: "gm" },
      trackerFacet: { owner: { participantId: "hero" }, step: "SU" },
    });

    const boundary = buildCombatProgressionProjection(
      state({
        cursorStep: "SU",
        currentStep: "round_summary",
        overrides: {
          roundEndReview: {
            ...review,
            participantReviews: {
              guard: participantReview("guard", "complete"),
              hero: participantReview("hero", "complete"),
            },
          },
        },
      }),
    );
    expect(boundary.boundary.kind).toBe("round_boundary");
    expect(taskKinds(boundary)).toEqual(["gm_advance_boundary"]);
    expect(
      boundary.boundary.processes
        .flatMap((process) => process.stages)
        .flatMap((stage) => stage.tasks)[0]?.expectedCommand,
    ).toBe("complete_round");
  });

  it("is deterministic, reload-idempotent, deeply immutable, and does not persist itself", () => {
    const source = state({ cursorParticipantId: "hero", cursorStep: "DE" });
    const sourceBefore = JSON.stringify(source);
    const first = buildCombatProgressionProjection(source);
    const second = buildCombatProgressionProjection(source);
    const reloaded = combatRoundStateSchema.parse(JSON.parse(JSON.stringify(source)));

    expect(second).toEqual(first);
    expect(buildCombatProgressionProjection(reloaded)).toEqual(first);
    expect(JSON.stringify(source)).toBe(sourceBefore);
    expect("combatProgressionProjection" in source).toBe(false);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.boundary.processes[0]?.stages[0]?.executionGroups)).toBe(true);
    expect(Object.isFrozen(first.boundary.processes[0]?.stages[0]?.executionGroups[0])).toBe(true);
    expect(Object.isFrozen(first.boundary.processes[0]?.stages[0]?.tasks)).toBe(true);
    expect(() => {
      (first.boundary.processes as unknown as unknown[]).push({});
    }).toThrow(TypeError);
  });

  it("places every task in exactly one deterministic execution group", () => {
    const source = state({ cursorParticipantId: "hero", cursorStep: "DE" });
    const first = buildCombatProgressionProjection(source);
    const reloaded = buildCombatProgressionProjection(
      combatRoundStateSchema.parse(JSON.parse(JSON.stringify(source))),
    );
    const stages = first.boundary.processes.flatMap((process) => process.stages);
    const groups = stages.flatMap((stage) => stage.executionGroups);
    const groupedTasks = groups.flatMap((group) => group.tasks);

    expect(groups.length).toBeGreaterThan(1);
    expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length);
    expect(new Set(groupedTasks.map((task) => task.id)).size).toBe(groupedTasks.length);
    for (const stage of stages) {
      expect(stage.executionGroups.map((group) => group.position)).toEqual(
        stage.executionGroups.map((_, position) => position),
      );
      expect(stage.tasks).toEqual(stage.executionGroups.flatMap((group) => group.tasks));
      for (const group of stage.executionGroups) {
        expect(group.tasks.length).toBeGreaterThan(0);
        expect(group.executionStrategy).toBe(stage.executionStrategy);
        expect(group.activationBoundary).toEqual({
          id: first.boundary.id,
          kind: first.boundary.kind,
          roundNumber: first.roundNumber,
        });
        expect(group.blockerIds).toEqual(
          [...new Set(group.tasks.flatMap((task) => task.blockerIds))].sort(),
        );
        expect(group.diagnostics).toEqual([]);
        expect("futureActivationBoundary" in group).toBe(true);
        expect(group.futureActivationBoundary).toBeUndefined();
        for (const task of group.tasks) {
          expect(task).toMatchObject({
            executionGroupId: group.id,
            identity: { executionGroupId: group.id },
            stageId: stage.id,
          });
        }
      }
    }
    expect(reloaded.boundary.processes).toEqual(first.boundary.processes);
  });

  it("returns to the same projection after command-stack undo", () => {
    const before = state({
      cursorParticipantId: "hero",
      cursorStep: "M1",
      currentStep: "review_action_modifiers",
    });
    const after = recordCombatRoundGlobalParticipantCommand({
      commandId: "review-hero",
      createdAt: "2026-07-19T10:00:00.000Z",
      participantId: "hero",
      state: before,
      step: "review_action_modifiers",
    });
    const undone = undoLatestCombatRoundCommand({ state: after });

    expect(undone).toBeDefined();
    expect(buildCombatProgressionProjection(undone!)).toEqual(
      buildCombatProgressionProjection(before),
    );
  });
});

describe("authorizeCombatProgressionTask", () => {
  const player = (participantId: string) => ({ kind: "combatant" as const, participantId });
  const gm = { kind: "gm" as const };

  it("accepts the projected player declaration and rejects another participant", () => {
    const projection = buildCombatProgressionProjection(
      state({ cursorParticipantId: "hero", cursorStep: "DE" }),
    );

    const authorized = authorizeCombatProgressionTask({
      actor: player("hero"),
      commandType: "declare_action",
      participantId: "hero",
      projection,
    });
    expect(authorized).toMatchObject({ ok: true, task: { kind: "submit_declaration" } });
    if (!authorized.ok) throw new Error("Expected declaration authorization to succeed.");
    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "declare_action",
        executionGroupId: authorized.task.executionGroupId,
        participantId: "hero",
        projection,
      }),
    ).toEqual(authorized);
    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "declare_action",
        participantId: "guard",
        projection,
      }),
    ).toMatchObject({ code: "wrong_participant", ok: false });
  });

  it("preserves GM declaration proxy/edit and player single-submit rules during DE", () => {
    const projection = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "DE",
        participantOverrides: [
          {
            declaration: {
              actionId: "move_only",
              roundNumber: 2,
              submittedBy: "player",
            },
            stepStatuses: { select_actions: "submitted" },
          },
        ],
      }),
    );

    expect(
      authorizeCombatProgressionTask({
        actor: gm,
        commandType: "declare_action",
        participantId: "hero",
        projection,
      }),
    ).toMatchObject({ ok: true, task: { allowedActors: ["gm"] } });
    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "declare_action",
        participantId: "hero",
        projection,
      }),
    ).toMatchObject({ code: "gm_only", ok: false });
  });

  it("authorizes only a ready initiative participant in the open phase", () => {
    const projection = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "i1",
        currentStep: "initiative_phase_1",
      }),
    );

    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "roll_initiative_phase1",
        participantId: "hero",
        phase: "phase1",
        projection,
      }),
    ).toMatchObject({ ok: true, task: { identity: { phase: "phase1" } } });
    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "roll_initiative_phase1",
        participantId: "guard",
        phase: "phase1",
        projection,
      }),
    ).toMatchObject({ code: "wrong_participant", ok: false });
    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "roll_initiative_phase1",
        participantId: "hero",
        phase: "phase1",
        projection: buildCombatProgressionProjection(
          state({ cursorParticipantId: "hero", cursorStep: "DE" }),
        ),
      }),
    ).toMatchObject({ code: "boundary_closed", ok: false });
  });

  it("keeps initiative commit GM-only and unavailable while rolls are pending", () => {
    const pending = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "i1",
        currentStep: "initiative_phase_1",
      }),
    );
    const ready = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "i1",
        currentStep: "initiative_phase_1",
        participantOverrides: [{ initiatives: { phase1: 8 } }, { initiatives: { phase1: 4 } }],
      }),
    );

    expect(
      authorizeCombatProgressionTask({
        actor: gm,
        commandType: "commit_phase_initiative_resolution",
        phase: "phase1",
        projection: pending,
      }),
    ).toMatchObject({ code: "task_not_found", ok: false });
    expect(
      authorizeCombatProgressionTask({
        actor: gm,
        commandType: "commit_phase_initiative_resolution",
        phase: "phase1",
        projection: ready,
      }),
    ).toMatchObject({ ok: true, task: { kind: "commit_initiative" } });
    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "commit_phase_initiative_resolution",
        phase: "phase1",
        projection: ready,
      }),
    ).toMatchObject({ code: "gm_only", ok: false });
  });

  it("matches an attack by current combatant, phase, opportunity, process, and stage", () => {
    const projection = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "A1",
        currentStep: "phase_1_actions",
        overrides: {
          phaseResolutionCursor: { participantId: "hero", phase: "phase1", substep: "attack" },
        },
        participantOverrides: [
          {
            declaration: {
              actionId: "attack_parry",
              attackOpportunities: [
                {
                  id: "hero-phase1-attack",
                  origin: "declared",
                  phase: "phase1",
                  slot: "attack_1",
                  status: "committed",
                  targetParticipantId: "guard",
                },
              ],
              roundNumber: 2,
              submittedBy: "player",
            },
          },
        ],
      }),
    );

    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "roll_attack",
        opportunityId: "hero-phase1-attack",
        participantId: "hero",
        phase: "phase1",
        projection,
      }),
    ).toMatchObject({
      ok: true,
      task: {
        identity: { opportunityId: "hero-phase1-attack", phase: "phase1" },
        kind: "attack",
      },
    });
    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "roll_attack",
        opportunityId: "future-attack",
        participantId: "hero",
        phase: "phase1",
        projection,
      }),
    ).toMatchObject({ code: "stale_opportunity", ok: false });
    expect(
      authorizeCombatProgressionTask({
        actor: gm,
        commandType: "roll_attack",
        opportunityId: "hero-phase1-attack",
        participantId: "hero",
        phase: "phase1",
        projection,
      }),
    ).toMatchObject({ ok: true });
  });

  it("matches parry by defender and attack result and rejects a stale attack", () => {
    const attackResult = {
      ...buildCombatRoundAttackRollResult({
        actionId: "attack_parry",
        attackerParticipantId: "hero",
        defenderDb: 0,
        defenderParticipantId: "guard",
        ob: 80,
        phase: "phase1",
        rollD20: 20,
        rollTotal: 20,
        rolledAt: "2026-07-19T10:00:00.000Z",
        weaponName: "Sword",
      }),
      attackOpportunityId: "hero-phase1-attack",
    };
    const projection = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "guard",
        cursorStep: "P1",
        currentStep: "phase_1_actions",
        overrides: {
          phaseResolutionCursor: { participantId: "guard", phase: "phase1", substep: "parry" },
        },
        participantOverrides: [
          {
            attackResults: { phase1: attackResult },
            declaration: {
              actionId: "attack_parry",
              attackOpportunities: [
                {
                  id: "hero-phase1-attack",
                  origin: "declared",
                  phase: "phase1",
                  slot: "attack_1",
                  status: "committed",
                  targetParticipantId: "guard",
                },
              ],
              roundNumber: 2,
              submittedBy: "player",
            },
          },
        ],
      }),
    );
    const task = projection.boundary.processes[0]?.stages[1]?.tasks[0];
    expect(task?.identity.attackResultId).toBeDefined();

    expect(
      authorizeCombatProgressionTask({
        actor: player("guard"),
        attackResultId: task?.identity.attackResultId,
        commandType: "roll_parry",
        opportunityId: "hero-phase1-attack",
        participantId: "guard",
        phase: "phase1",
        projection,
      }),
    ).toMatchObject({ ok: true, task: { owner: { participantId: "guard" } } });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        attackResultId: task?.identity.attackResultId,
        commandType: "roll_parry",
        executionGroupId: task?.executionGroupId,
        opportunityId: "hero-phase1-attack",
        participantId: "guard",
        phase: "phase1",
        projection,
        taskId: task?.id,
      }),
    ).toMatchObject({ ok: true, task: { owner: { participantId: "guard" } } });
    expect(
      authorizeCombatProgressionTask({
        actor: player("guard"),
        attackResultId: "stale-attack",
        commandType: "roll_parry",
        participantId: "guard",
        phase: "phase1",
        projection,
      }),
    ).toMatchObject({ code: "stale_opportunity", ok: false });
    expect(
      authorizeCombatProgressionTask({
        actor: player("guard"),
        attackResultId: task?.identity.attackResultId,
        commandType: "roll_parry",
        participantId: "guard",
        phase: "phase1",
        projection,
        taskId: "stale-parry-task",
      }),
    ).toMatchObject({ code: "task_not_found", ok: false });
  });

  it("projects the recorded hit as one live defender task with canonical attack context", () => {
    const initial = state({
      cursorParticipantId: "hero",
      cursorStep: "A1",
      currentStep: "phase_1_actions",
      overrides: {
        phaseResolutionCursor: { participantId: "hero", phase: "phase1", substep: "attack" },
      },
      participantOverrides: [
        {
          declaration: {
            actionId: "attack_parry",
            phaseContexts: { phase1: { targetParticipantId: "scenario-guard" } },
            roundNumber: 2,
            submittedBy: "player",
          },
        },
      ],
    });
    const hit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "hero",
      defenderDb: 0,
      defenderParticipantId: "guard",
      ob: 80,
      phase: "phase1",
      rollD20: 20,
      rollTotal: 20,
      rolledAt: "2026-07-19T10:00:00.000Z",
      weaponName: "Long Sword",
    });
    const afterHit = recordCombatRoundAttackResult({
      command: { createdAt: hit.rolledAt },
      participantId: "hero",
      result: hit,
      state: initial,
      submittedBy: "gm",
    });
    const projection = buildCombatProgressionProjection(afterHit);
    const tasks = projection.boundary.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks),
    );

    expect(afterHit.currentCursor).toMatchObject({ participantId: "guard", step: "P1" });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      allowedActors: ["combatant", "gm"],
      expectedCommand: "roll_parry",
      identity: {
        attackResultId: "2:phase1:hero:guard",
        opponentParticipantId: "hero",
        phase: "phase1",
      },
      kind: "parry",
      owner: { participantId: "guard" },
      presentationContext: {
        actor: { participantId: "hero" },
        target: { participantId: "guard" },
        weapon: { label: "Long Sword" },
      },
      state: "executable",
      trackerFacet: { owner: { participantId: "guard" }, step: "P1" },
    });
  });

  it("authorizes the adapter-derived Double Attack decision for its owner or GM", () => {
    const phase1Result = buildCombatRoundAttackRollResult({
      actionId: "double_attack",
      attackerParticipantId: "hero",
      defenderDb: 20,
      defenderParticipantId: "guard",
      ob: 0,
      phase: "phase1",
      rollD20: 1,
      rollTotal: 1,
      rolledAt: "2026-07-19T10:00:00.000Z",
      weaponName: "Sword",
    });
    const projection = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "M2",
        currentStep: "review_phase_2_modifiers",
        participantOverrides: [
          {
            attackResults: { phase1: phase1Result },
            declaration: {
              actionId: "double_attack",
              phaseContexts: {
                phase1: { targetParticipantId: "guard" },
                phase2: { targetParticipantId: "guard" },
              },
              roundNumber: 2,
              submittedBy: "player",
            },
          },
        ],
      }),
    );
    const opportunityId = projection.boundary.processes
      .flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.kind === "double_attack_decision")?.identity.opportunityId;

    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "decide_double_attack_phase2",
        opportunityId,
        participantId: "hero",
        phase: "phase2",
        projection,
      }),
    ).toMatchObject({ ok: true, task: { kind: "double_attack_decision" } });
    expect(
      authorizeCombatProgressionTask({
        actor: gm,
        commandType: "decide_double_attack_phase2",
        opportunityId,
        participantId: "hero",
        phase: "phase2",
        projection,
      }),
    ).toMatchObject({ ok: true });
    expect(
      authorizeCombatProgressionTask({
        actor: player("guard"),
        commandType: "decide_double_attack_phase2",
        opportunityId,
        participantId: "hero",
        phase: "phase2",
        projection,
      }),
    ).toMatchObject({ code: "wrong_participant", ok: false });
  });

  it("rejects blocked source facts and only diagnostics relevant to the matching task", () => {
    const blocked = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "A1",
        currentStep: "phase_1_actions",
        overrides: {
          phaseResolutionCursor: { participantId: "hero", phase: "phase1", substep: "attack" },
        },
      }),
    );
    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "roll_attack",
        participantId: "hero",
        phase: "phase1",
        projection: blocked,
      }),
    ).toMatchObject({ code: "task_not_ready", ok: false });

    const declaration = buildCombatProgressionProjection(
      state({ cursorParticipantId: "hero", cursorStep: "DE" }),
    );
    const withUnrelatedDiagnostic = {
      ...declaration,
      diagnostics: [
        ...declaration.diagnostics,
        {
          code: "repair_required" as const,
          message: "Unrelated migration warning.",
          relatedIds: ["another-boundary:task"],
          severity: "warning" as const,
        },
      ],
    };
    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "declare_action",
        participantId: "hero",
        projection: withUnrelatedDiagnostic,
      }),
    ).toMatchObject({ ok: true });
    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "declare_action",
        participantId: "hero",
        projection: {
          ...withUnrelatedDiagnostic,
          diagnostics: [
            {
              code: "cursor_disagrees_with_process",
              message: "Relevant cursor contradiction.",
              relatedIds: [declaration.boundary.id],
              severity: "warning",
            },
          ],
        },
      }),
    ).toMatchObject({ code: "task_not_ready", ok: false });
  });

  it("does not authorize unmigrated commands or mutate the immutable projection", () => {
    const projection = buildCombatProgressionProjection(
      state({ cursorParticipantId: "hero", cursorStep: "DE" }),
    );
    const before = JSON.stringify(projection);

    expect(
      authorizeCombatProgressionTask({
        actor: player("hero"),
        commandType: "roll_hit_location",
        participantId: "hero",
        projection,
      }),
    ).toMatchObject({ code: "task_not_found", ok: false });
    expect(JSON.stringify(projection)).toBe(before);
  });

  it("publishes initiative execution order only after the GM commit boundary closes", () => {
    const participantOverrides = [6, 4].map((total) => ({
      initiatives: {
        phase1: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [total],
          rollTotal: total,
          total,
        },
      },
    }));
    const commitPending = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "i1",
        currentStep: "initiative_phase_1",
        participantOverrides,
      }),
    );
    const committed = buildCombatProgressionProjection(
      state({
        cursorParticipantId: "hero",
        cursorStep: "A1",
        currentStep: "phase_1_actions",
        participantOverrides,
      }),
    );

    expect(commitPending.executionOrder).toBeUndefined();
    expect(committed.executionOrder).toEqual({
      participantIds: ["hero", "guard"],
      phase: "phase1",
    });
  });

  it("builds player-safe task presentation with semantic parity and no private internals", () => {
    const projection = buildCombatProgressionProjection(
      state({ cursorParticipantId: "hero", cursorStep: "DE" }),
    );
    const gm = projectCombatProgressionPresentation({ projection, viewer: { kind: "gm" } });
    const playerView = projectCombatProgressionPresentation({
      projection,
      viewer: {
        controlledParticipantIds: new Set(["hero"]),
        kind: "player",
        visibleParticipantIds: new Set(["hero"]),
      },
    });
    const gmHeroTask = gm.processes
      .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((task) => task.owner?.kind === "combatant" && task.owner.participantId === "hero");
    const playerTasks = playerView.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks),
    );
    const playerGroups = playerView.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.executionGroups),
    );

    expect(playerTasks).toHaveLength(1);
    expect(playerGroups).toHaveLength(1);
    expect(playerGroups[0]?.tasks).toEqual(playerTasks);
    expect(playerGroups[0]).toMatchObject({
      blocked: false,
      completionState: "incomplete",
      executionStrategy: "parallel_all",
      id: playerTasks[0]?.executionGroupId,
      position: 0,
    });
    expect(playerTasks[0]).toMatchObject({
      expectedCommand: "declare_action",
      id: gmHeroTask?.id,
      kind: "submit_declaration",
      owner: { participantId: "hero" },
      state: gmHeroTask?.state,
      trackerFacet: { owner: { participantId: "hero" }, step: "DE" },
    });
    const serialized = JSON.stringify(playerView);
    expect(serialized).not.toContain("guard");
    expect(serialized).not.toContain("blocker");
    expect(serialized).not.toContain("diagnostic");
    expect(serialized).not.toContain("proposalId");
  });

  it("fails closed for relevant projection contradictions without exposing diagnostics", () => {
    const projection = buildCombatProgressionProjection(
      state({ cursorParticipantId: "hero", cursorStep: "A1", currentStep: "select_actions" }),
    );
    const presentation = projectCombatProgressionPresentation({
      projection,
      viewer: { kind: "gm" },
    });

    expect(presentation.taskVisibility).toBe("conflicted");
    expect(JSON.stringify(presentation)).not.toContain("cursor_disagrees_with_process");
  });

  it("projects and authorizes only the current Feint participant task", () => {
    const feintState = state({
      cursorParticipantId: "hero",
      cursorStep: "A1",
      currentStep: "phase_1_actions",
      overrides: {
        feintProposals: [
          {
            attackerParticipantId: "hero",
            attackerSkillId: "dodge",
            attackerSkillLabel: "Dodge",
            defenderParticipantId: "guard",
            defenderSkillId: "sword",
            defenderSkillLabel: "Sword",
            id: "feint-proposal",
            method: "movement",
            pairId: "hero::guard",
            phase1OpportunityId: "feint-opportunity",
            phase2AttackOpportunityId: "feint-attack",
            roundNumber: 2,
            status: "awaiting_rolls",
          },
        ],
        phaseResolutionCursor: { participantId: "hero", phase: "phase1", substep: "feint" },
      },
      participantOverrides: [
        {
          declaration: {
            actionId: "feint_attack",
            attackOpportunities: [
              {
                id: "feint-attack",
                origin: "feint_attack",
                phase: "phase2",
                slot: "attack_2",
                status: "committed",
                targetParticipantId: "guard",
              },
            ],
            feint: {
              attackerSkillId: "dodge",
              attackerSkillLabel: "Dodge",
              defenderSkillId: "sword",
              defenderSkillLabel: "Sword",
              method: "movement",
              targetParticipantId: "guard",
            },
            phaseContexts: { phase2: { targetParticipantId: "guard" } },
            roundNumber: 2,
            submittedBy: "player",
          },
        },
      ],
    });
    const projection = buildCombatProgressionProjection(feintState);
    const process = projection.boundary.processes[0];
    const tasks = process?.stages.flatMap((stage) => stage.tasks) ?? [];

    expect(process).toMatchObject({
      kind: "feint",
      planId: "round:2:action:hero:feint_attack:maneuver:feint-proposal",
    });
    expect(process?.stages.map(({ kind, state }) => ({ kind, state }))).toEqual([
      { kind: "attacker_roll", state: "active" },
      { kind: "defender_roll", state: "pending" },
      { kind: "proposal_review", state: "pending" },
      { kind: "proposal_commit", state: "pending" },
    ]);
    expect(process?.stages.some((stage) => stage.kind === "feasibility")).toBe(false);
    expect(tasks).toEqual([
      expect.objectContaining({
        expectedCommand: "roll_feint",
        identity: expect.objectContaining({
          opponentParticipantId: "guard",
          opportunityId: "feint-opportunity",
          pairId: "hero::guard",
          proposalId: "feint-proposal",
        }),
        kind: "feint_attacker_roll",
        owner: expect.objectContaining({ participantId: "hero" }),
      }),
    ]);
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "hero" },
        commandType: "roll_feint",
        opponentParticipantId: "guard",
        opportunityId: "feint-opportunity",
        pairId: "hero::guard",
        participantId: "hero",
        phase: "phase1",
        projection,
        proposalId: "feint-proposal",
      }),
    ).toMatchObject({ ok: true });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "guard" },
        commandType: "roll_feint",
        pairId: "hero::guard",
        participantId: "hero",
        phase: "phase1",
        projection,
        proposalId: "feint-proposal",
      }),
    ).toMatchObject({ code: "wrong_participant", ok: false });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "roll_feint",
        pairId: "hero::guard",
        participantId: "hero",
        phase: "phase1",
        projection,
        proposalId: "feint-proposal",
      }),
    ).toMatchObject({ ok: true });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "commit_feint_result",
        pairId: "hero::guard",
        phase: "phase1",
        projection,
        proposalId: "feint-proposal",
      }),
    ).toMatchObject({ code: "task_not_found", ok: false });
  });

  it("projects Adjust Distance response, adjustment, rolls, and commit as exact tasks", () => {
    const baseProposal = {
      attackerParticipantId: "hero",
      currentDistance: 3,
      defenderParticipantId: "guard",
      direction: "closer" as const,
      id: "distance-proposal",
      pairId: "guard::hero",
      phase1OpportunityId: "distance-opportunity",
      phase2AttackOpportunityId: "distance-attack",
      requestedDistance: 2,
      roundNumber: 2,
    };
    const buildState = (proposal: Record<string, unknown>) =>
      state({
        cursorParticipantId: "hero",
        cursorStep: "A1",
        currentStep: "phase_1_actions",
        overrides: {
          adjustDistanceProposals: [{ ...baseProposal, ...proposal }],
          phaseResolutionCursor: {
            participantId: "hero",
            phase: "phase1",
            substep: "adjust_distance",
          },
        },
        participantOverrides: [
          {
            declaration: {
              actionId: "adjust_range_attack",
              adjustDistance: {
                currentDistance: 3,
                requestedDistance: 2,
                targetParticipantId: "guard",
              },
              attackOpportunities: [
                {
                  id: "distance-attack",
                  origin: "adjust_range_attack",
                  phase: "phase2",
                  slot: "attack_2",
                  status: "committed",
                  targetParticipantId: "guard",
                },
              ],
              phaseContexts: { phase2: { targetParticipantId: "guard" } },
              roundNumber: 2,
              submittedBy: "player",
            },
          },
        ],
      });
    const responseProjection = buildCombatProgressionProjection(
      buildState({ status: "awaiting_defender_response" }),
    );
    const responseTask = responseProjection.boundary.processes
      .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .at(0);
    expect(responseTask).toMatchObject({
      expectedCommand: "respond_adjust_distance",
      identity: expect.objectContaining({
        opponentParticipantId: "hero",
        opportunityId: "distance-opportunity",
        pairId: "guard::hero",
        proposalId: "distance-proposal",
      }),
      kind: "adjust_distance_response",
      opponent: { label: "Hero", participantId: "hero" },
      owner: { participantId: "guard" },
      trackerFacet: { owner: { participantId: "guard" }, step: "A1" },
    });
    const gmPresentation = projectCombatProgressionPresentation({
      projection: responseProjection,
      viewer: { kind: "gm" },
    });
    const hiddenOpponentPresentation = projectCombatProgressionPresentation({
      projection: responseProjection,
      viewer: {
        controlledParticipantIds: new Set(["guard"]),
        kind: "player",
        visibleParticipantIds: new Set(["guard"]),
      },
    });
    const gmResponseTask = gmPresentation.processes
      .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((task) => task.kind === "adjust_distance_response");
    const playerResponseTask = hiddenOpponentPresentation.processes
      .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((task) => task.kind === "adjust_distance_response");
    expect(gmResponseTask?.opponent).toMatchObject({ label: "Hero", participantId: "hero" });
    expect(gmResponseTask).toMatchObject({
      expectedCommand: "respond_adjust_distance",
      identity: expect.objectContaining({
        opportunityId: "distance-opportunity",
        proposalId: "distance-proposal",
      }),
      presentationContext: {
        actionKind: "adjust_distance_attack",
        actor: { participantId: "hero" },
        distance: { current: 3, direction: "closer", requested: 2 },
        responder: { participantId: "guard" },
        target: { participantId: "guard" },
      },
    });
    expect(playerResponseTask).toMatchObject({
      kind: "adjust_distance_response",
      opponent: undefined,
      owner: { participantId: "guard" },
      presentationContext: {
        actionKind: "adjust_distance_attack",
        actor: undefined,
        distance: { current: 3, direction: "closer", requested: 2 },
        responder: { participantId: "guard" },
        target: { participantId: "guard" },
      },
      trackerFacet: { owner: { participantId: "guard" } },
    });
    expect(JSON.stringify(hiddenOpponentPresentation)).not.toContain("hero");
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "guard" },
        commandType: "respond_adjust_distance",
        opponentParticipantId: "hero",
        opportunityId: "distance-opportunity",
        pairId: "guard::hero",
        participantId: "guard",
        phase: "phase1",
        projection: responseProjection,
        proposalId: "distance-proposal",
      }),
    ).toMatchObject({ ok: true });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "hero" },
        commandType: "respond_adjust_distance",
        pairId: "guard::hero",
        participantId: "guard",
        phase: "phase1",
        projection: responseProjection,
        proposalId: "distance-proposal",
      }),
    ).toMatchObject({ code: "wrong_participant", ok: false });

    const adjustmentProjection = buildCombatProgressionProjection(
      buildState({ defenderResponse: "oppose", status: "awaiting_gm_adjustment" }),
    );
    expect(taskKinds(adjustmentProjection)).toEqual(["adjust_distance_adjustment"]);
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "hero" },
        commandType: "review_adjust_distance_roll_adjustment",
        pairId: "guard::hero",
        phase: "phase1",
        projection: adjustmentProjection,
        proposalId: "distance-proposal",
      }),
    ).toMatchObject({ code: "gm_only", ok: false });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "review_adjust_distance_roll_adjustment",
        pairId: "wrong-pair",
        phase: "phase1",
        projection: adjustmentProjection,
        proposalId: "distance-proposal",
      }),
    ).toMatchObject({ code: "stale_proposal", ok: false });

    const rollProjection = buildCombatProgressionProjection(
      buildState({
        defenderResponse: "oppose",
        gmRollAdjustment: { participantId: "hero", value: 1 },
        status: "awaiting_rolls",
      }),
    );
    const rollStage = rollProjection.boundary.processes
      .flatMap((process) => process.stages)
      .find((stage) => stage.kind === "opposed_rolls");
    expect(rollStage).toMatchObject({
      executionStrategy: "parallel_all",
      state: "active",
    });
    expect(rollStage?.executionGroups).toHaveLength(1);
    expect(rollStage?.executionGroups[0]?.tasks.map((task) => task.kind)).toEqual([
      "adjust_distance_attacker_roll",
      "adjust_distance_defender_roll",
    ]);
    expect(
      new Set(rollStage?.executionGroups[0]?.tasks.map((task) => task.executionGroupId)),
    ).toEqual(new Set([rollStage?.executionGroups[0]?.id]));
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "hero" },
        commandType: "roll_adjust_distance",
        pairId: "guard::hero",
        participantId: "hero",
        phase: "phase1",
        projection: rollProjection,
        proposalId: "distance-proposal",
      }),
    ).toMatchObject({ ok: true });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "guard" },
        commandType: "roll_adjust_distance",
        pairId: "guard::hero",
        participantId: "guard",
        phase: "phase1",
        projection: rollProjection,
        proposalId: "distance-proposal",
      }),
    ).toMatchObject({ ok: true });

    const attackerRecordedProjection = buildCombatProgressionProjection(
      buildState({
        attackerRoll: {
          dodgeSkillTotal: 6,
          finalTotal: 17,
          id: "distance-attacker-roll",
          participantId: "hero",
          rollD20: 11,
          rollTotal: 11,
          rolledAt: "2026-07-19T10:00:00.000Z",
        },
        attackerRollRecorded: true,
        defenderResponse: "oppose",
        gmRollAdjustment: { participantId: "hero", value: 1 },
        status: "awaiting_rolls",
      }),
    );
    const remainingRollGroup = attackerRecordedProjection.boundary.processes
      .flatMap((process) => process.stages)
      .find((stage) => stage.kind === "opposed_rolls")?.executionGroups[0];
    expect(remainingRollGroup?.id).toBe(rollStage?.executionGroups[0]?.id);
    expect(remainingRollGroup?.tasks.map((task) => task.kind)).toEqual([
      "adjust_distance_defender_roll",
    ]);

    const commitProjection = buildCombatProgressionProjection(
      buildState({
        attackerRoll: {
          dodgeSkillTotal: 6,
          finalTotal: 17,
          id: "distance-attacker-roll",
          participantId: "hero",
          rollD20: 11,
          rollTotal: 11,
          rolledAt: "2026-07-19T10:00:00.000Z",
        },
        attackerRollRecorded: true,
        defenderResponse: "oppose",
        defenderRoll: {
          dodgeSkillTotal: 5,
          finalTotal: 14,
          id: "distance-defender-roll",
          participantId: "guard",
          rollD20: 9,
          rollTotal: 9,
          rolledAt: "2026-07-19T10:00:01.000Z",
        },
        defenderRollRecorded: true,
        gmRollAdjustment: { participantId: "hero", value: 1 },
        standardOutcome: "successful",
        standardProposedDistance: 2,
        status: "awaiting_review",
      }),
    );
    expect(taskKinds(commitProjection)).toEqual(["adjust_distance_commit"]);
    const commitTask = commitProjection.boundary.processes
      .flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.kind === "adjust_distance_commit");
    expect(commitTask).toMatchObject({
      allowedActors: ["gm"],
      expectedCommand: "commit_adjust_distance",
      identity: expect.objectContaining({
        opportunityId: "distance-opportunity",
        pairId: "guard::hero",
        proposalId: "distance-proposal",
      }),
      owner: { kind: "gm" },
      state: "executable",
      trackerFacet: { owner: undefined, step: "A1" },
    });
    const playerCommitTasks = ["hero", "guard"].map((participantId) =>
      projectCombatProgressionPresentation({
        projection: commitProjection,
        viewer: {
          controlledParticipantIds: new Set([participantId]),
          kind: "player",
          visibleParticipantIds: new Set(["hero", "guard"]),
        },
      })
        .processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
        .find((task) => task.kind === "adjust_distance_commit"),
    );
    expect(playerCommitTasks).toEqual([
      expect.objectContaining({
        actorAccess: { combatant: false, gm: true },
        id: commitTask?.id,
        state: "executable",
      }),
      expect.objectContaining({
        actorAccess: { combatant: false, gm: true },
        id: commitTask?.id,
        state: "executable",
      }),
    ]);
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "commit_adjust_distance",
        pairId: "guard::hero",
        phase: "phase1",
        projection: commitProjection,
        proposalId: "distance-proposal",
      }),
    ).toMatchObject({ ok: true });
  });
});
