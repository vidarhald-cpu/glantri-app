import { describe, expect, it } from "vitest";

import {
  advanceCombatProgressionBoundary,
  authorizeCombatProgressionTask,
  buildCombatRoundCommandEnvelope,
  buildCombatObservationModifierContributions,
  buildCombatObservationSkillContestContribution,
  buildCombatProgressionProjection,
  buildCombatRoundEndProcessPlan,
  buildPlayerSafeCombatObservationAttempts,
  buildPlayerSafeCombatObservationRelationships,
  commitCombatRoundEndParticipantReview,
  combatRoundStateSchema,
  getBlockingCombatObservationAttempts,
  getCombatObservationManualReviews,
  getPendingCombatObservationAttempts,
  getCombatObservationRequiredRounds,
  getNextCombatRoundEndTask,
  markCombatObservationManualReviewRequired,
  recordCombatObservationRoll,
  projectCombatProgressionPresentation,
  resolveCombatModifierContributions,
  resolveCombatObservationAttempt,
  resolveCombatObservationCandidateBonus,
  resolveCombatObservationRoundBoundary,
  restoreCombatObservationRelationships,
  undoLatestCombatRoundCommand,
  type CombatRoundState,
} from "../index";

const at = "2026-01-01T00:00:00.000Z";

function participant(participantId: string, targetParticipantId?: string) {
  return {
    declaration: targetParticipantId
      ? {
          actionId: "parry",
          roundNumber: 1,
          secondaryActions: [{ action: "observe_opponent", targetParticipantId }],
          secondaryActionContext: { action: "observe_opponent", targetParticipantId },
          secondaryActionId: "observe_opponent",
          submittedBy: "player",
        }
      : undefined,
    label: participantId,
    participantId,
  };
}

function state(
  input: {
    attackerParticipantId?: "b" | "c";
    hit?: boolean;
    parrySuccess?: boolean;
    relationships?: CombatRoundState["observationRelationships"];
    secondTarget?: boolean;
  } = {},
): CombatRoundState {
  const attackerParticipantId = input.attackerParticipantId ?? "b";
  const attackResult =
    input.hit === undefined
      ? undefined
      : {
          actionId: "attack_parry",
          attackerParticipantId,
          defenderDb: 0,
          defenderParticipantId: "a",
          grazing: false,
          hit: input.hit,
          kind: "attackRoll" as const,
          lookupTotal: input.hit ? 20 : 0,
          marginOverMissThreshold: input.hit ? 1 : -1,
          ob: 0,
          phase: "phase1" as const,
          rollD20: 10,
          rollTotal: 10,
          rolledAt: at,
          tableResult: input.hit ? "Hit" : "Miss",
          weaponName: "Sword",
        };
  return combatRoundStateSchema.parse({
    currentStep: "round_summary",
    encounterId: "encounter-1",
    observationRelationships: input.relationships,
    participants: [
      participant("a", "b"),
      {
        ...participant("b", input.secondTarget ? "a" : undefined),
        attackResults:
          attackResult && attackerParticipantId === "b" ? { phase1: attackResult } : {},
      },
      ...(input.secondTarget || attackerParticipantId === "c"
        ? [
            {
              ...participant("c"),
              attackResults:
                attackResult && attackerParticipantId === "c" ? { phase1: attackResult } : {},
            },
          ]
        : []),
    ],
    phaseResolutionResults:
      attackResult && input.parrySuccess !== undefined
        ? [
            {
              attackResultId: `1:phase1:${attackerParticipantId}:a`,
              attackerParticipantId,
              damageProposal: { proposedEffects: [], status: "not_ready" },
              damageRoll: {
                status: input.parrySuccess ? "not_required" : "pending",
              },
              defenderParticipantId: "a",
              parryResolution: {
                status: "resolved",
                success: input.parrySuccess,
              },
              phase: "phase1",
              roundNumber: 1,
              updatedAt: at,
            },
          ]
        : [],
    roundNumber: 1,
  });
}

function resolveRound(current: CombatRoundState) {
  return resolveCombatObservationRoundBoundary({
    state: current,
  });
}

function nextRound(current: CombatRoundState): CombatRoundState {
  return combatRoundStateSchema.parse({
    ...current,
    observationAttempts: [],
    participants: current.participants.map((entry) => ({
      ...entry,
      declaration: entry.declaration
        ? { ...entry.declaration, roundNumber: current.roundNumber + 1 }
        : undefined,
    })),
    roundNumber: current.roundNumber + 1,
  });
}

function completeObservationAttempt(current: CombatRoundState): CombatRoundState {
  const pending = getPendingCombatObservationAttempts(current)[0];
  expect(pending).toBeDefined();
  return recordCombatObservationRoll({
    command: { createdAt: at },
    completedAtRevision: at,
    executionGroupId: `observation:${current.roundNumber}`,
    observerBasis: { baseValue: 15, skillId: "dodge", skillLabel: "Dodge" },
    observerParticipantId: pending!.observerParticipantId,
    observationAttemptId: pending!.attemptId,
    relationshipId: pending!.relationshipId,
    rng: () => 0.5,
    state: current,
    targetBasis: { baseValue: 10, skillId: "sword", skillLabel: "Sword" },
    targetParticipantId: pending!.targetParticipantId,
  }).state;
}

function completeQualifyingRounds(initial: CombatRoundState, count: number): CombatRoundState {
  let current = initial;
  for (let index = 0; index < count; index += 1) {
    const pending = getPendingCombatObservationAttempts(current);
    current = pending.length ? completeObservationAttempt(current) : resolveRound(current).state;
    if (index < count - 1) current = nextRound(current);
  }
  return current;
}

describe("Observe Opponent", () => {
  it("records concise observer-only SU progress and no-progress outcomes", () => {
    const finishReviews = (current: CombatRoundState) => {
      const prepared = combatRoundStateSchema.parse({
        ...current,
        currentCursor: { participantId: "a", roundNumber: 1, step: "SU" },
        roundEndReview: {
          participantReviews: {
            a: { participantId: "a", status: "review_ready" },
            b: { participantId: "b", status: "review_ready" },
          },
          roundNumber: 1,
        },
      });
      const observerReview = commitCombatRoundEndParticipantReview({
        command: { createdAt: at },
        participantId: "a",
        scenarioParticipantId: "scenario-a",
        state: prepared,
      }).state;
      return commitCombatRoundEndParticipantReview({
        command: { createdAt: at },
        participantId: "b",
        scenarioParticipantId: "scenario-b",
        state: observerReview,
      }).state;
    };

    const progress = finishReviews(state());
    const progressEvent = progress.events.find(
      (event) =>
        event.type === "observation" &&
        event.facts.involvedOutcome.observationStatus === "progress",
    );
    expect(progressEvent).toMatchObject({
      facts: {
        involvedOutcome: {
          requiredQualifyingRounds: 3,
          roundsTowardNextAttempt: 1,
        },
      },
      ownerParticipantId: "a",
      visibility: { involvedParticipantIds: ["a"], outcomeScope: "gm_only" },
    });
    const observerReviewEvent = progress.events.find(
      (event) => event.type === "participant_su_review" && event.ownerParticipantId === "a",
    );
    expect(progressEvent!.sequence).toBeLessThan(observerReviewEvent!.sequence);

    const noProgress = finishReviews(state({ hit: true }));
    expect(noProgress.events.find((event) => event.type === "observation")).toMatchObject({
      facts: {
        involvedOutcome: {
          observationNoProgressReason: "observer_hit",
          observationStatus: "no_progress",
          roundsTowardNextAttempt: 0,
        },
      },
    });
  });

  it("uses the final defended attack outcome for observation qualification", () => {
    const relationship = [
      {
        bestBonus: 0,
        completedAttempts: 0,
        id: "observation:a:b",
        observerParticipantId: "a",
        roundsTowardNextAttempt: 2,
        targetParticipantId: "b",
      },
    ];
    expect(
      getPendingCombatObservationAttempts(state({ hit: false, relationships: relationship })),
    ).toHaveLength(1);
    expect(
      getPendingCombatObservationAttempts(
        state({ hit: true, parrySuccess: true, relationships: relationship }),
      ),
    ).toHaveLength(1);
    expect(
      getPendingCombatObservationAttempts(
        state({ hit: true, parrySuccess: false, relationships: relationship }),
      ),
    ).toEqual([]);
    expect(
      getPendingCombatObservationAttempts(
        state({
          attackerParticipantId: "c",
          hit: true,
          relationships: relationship,
        }),
      ),
    ).toHaveLength(1);

    const advanced = resolveCombatObservationRoundBoundary({
      state: state({ hit: true, parrySuccess: true }),
    });
    expect(advanced.state.observationRelationships[0]?.roundsTowardNextAttempt).toBe(1);
    expect(
      restoreCombatObservationRelationships({
        relationships: advanced.state.observationRelationships,
        undoFacts: advanced.undoFacts,
      }),
    ).toEqual([]);
  });

  it("records a nonduplicative pending status when the observation period completes", () => {
    const ready = state({
      relationships: [
        {
          bestBonus: 0,
          completedAttempts: 0,
          id: "observation:a:b",
          observerParticipantId: "a",
          roundsTowardNextAttempt: 2,
          targetParticipantId: "b",
        },
      ],
    });
    const completedReview = commitCombatRoundEndParticipantReview({
      command: { createdAt: at },
      participantId: "a",
      scenarioParticipantId: "scenario-a",
      state: combatRoundStateSchema.parse({
        ...ready,
        currentCursor: { participantId: "a", roundNumber: 1, step: "SU" },
        roundEndReview: {
          participantReviews: {
            a: { participantId: "a", status: "review_ready" },
            b: { participantId: "b", status: "review_ready" },
          },
          roundNumber: 1,
        },
      }),
    }).state;
    expect(
      getNextCombatRoundEndTask({
        state: combatRoundStateSchema.parse({
          ...ready,
          currentCursor: { participantId: "a", roundNumber: 1, step: "SU" },
          roundEndReview: {
            participantReviews: {
              a: { participantId: "a", status: "review_ready" },
              b: { participantId: "b", status: "review_ready" },
            },
            roundNumber: 1,
          },
        }),
      }),
    ).toEqual({ kind: "participant_review", participantId: "a" });
    expect(getNextCombatRoundEndTask({ state: completedReview })).toMatchObject({
      kind: "observation_roll",
      participantId: "a",
    });
    expect(completedReview.events.find((event) => event.type === "observation")).toMatchObject({
      facts: {
        involvedOutcome: {
          observationAttemptId: "observation:a:b:attempt:1",
          observationStatus: "period_complete",
          roundsTowardNextAttempt: 3,
        },
      },
      status: "recorded",
    });
    expect(
      completedReview.events.find(
        (event) => event.type === "participant_su_review" && event.ownerParticipantId === "a",
      )?.status,
    ).toBe("proposed");
    const rolled = completeObservationAttempt(completedReview);
    const orderedObserverEvents = rolled.events
      .filter((event) => event.ownerParticipantId === "a")
      .sort((left, right) => left.sequence - right.sequence);
    expect(
      orderedObserverEvents.map((event) => [
        event.type,
        event.facts.involvedOutcome.observationStatus,
        event.status,
      ]),
    ).toEqual([
      ["observation", "period_complete", "recorded"],
      ["observation", undefined, "recorded"],
      ["participant_su_review", undefined, "committed"],
    ]);
    const undone = undoLatestCombatRoundCommand({ state: rolled });
    expect(
      undone?.events
        .filter((event) => event.ownerParticipantId === "a")
        .sort((left, right) => left.sequence - right.sequence)
        .map((event) => [event.type, event.facts.involvedOutcome.observationStatus, event.status]),
    ).toEqual([
      ["observation", "period_complete", "recorded"],
      ["participant_su_review", undefined, "proposed"],
    ]);
  });

  it("keeps legacy declarations without secondary actions valid and supports ordered pairs", () => {
    const plain = combatRoundStateSchema.parse({
      participants: [participant("a"), participant("b")],
      roundNumber: 1,
    });
    expect(plain.participants[0]?.declaration).toBeUndefined();

    const result = resolveRound(state({ secondTarget: true }));
    expect(
      result.state.observationRelationships.map((relationship) => [
        relationship.observerParticipantId,
        relationship.targetParticipantId,
      ]),
    ).toEqual([
      ["a", "b"],
      ["b", "a"],
    ]);
  });

  it("retains separate progress when one observer changes to another target", () => {
    const first = resolveRound(state({ secondTarget: true })).state;
    const changed = combatRoundStateSchema.parse({
      ...first,
      participants: first.participants.map((entry) =>
        entry.participantId === "a" ? participant("a", "c") : entry,
      ),
    });
    const second = resolveRound(changed).state;

    expect(
      second.observationRelationships
        .filter((relationship) => relationship.observerParticipantId === "a")
        .map((relationship) => ({
          progress: relationship.roundsTowardNextAttempt,
          target: relationship.targetParticipantId,
        })),
    ).toEqual([
      { progress: 1, target: "b" },
      { progress: 1, target: "c" },
    ]);
  });

  it("derives no modifier contribution against an unrelated opponent", () => {
    expect(
      buildCombatObservationModifierContributions({
        encounterId: "encounter-1",
        observerCombatantId: "a",
        observerParticipantId: "scenario-a",
        opponentCombatantId: "c",
        opponentParticipantId: "scenario-c",
        relationships: [
          {
            bestBonus: 3,
            completedAttempts: 1,
            id: "observation:a:b",
            observerParticipantId: "a",
            roundsTowardNextAttempt: 0,
            targetParticipantId: "b",
          },
        ],
      }),
    ).toEqual([]);
  });

  it("uses 3, 6, then capped 10-round attempt thresholds", () => {
    expect([0, 1, 2, 12].map(getCombatObservationRequiredRounds)).toEqual([3, 6, 10, 10]);
    let current = completeQualifyingRounds(state(), 3);
    expect(current.observationRelationships[0]).toMatchObject({
      completedAttempts: 1,
      roundsTowardNextAttempt: 0,
    });
    current = completeQualifyingRounds(nextRound(current), 6);
    expect(current.observationRelationships[0]).toMatchObject({
      completedAttempts: 2,
      roundsTowardNextAttempt: 0,
    });
    current = completeQualifyingRounds(nextRound(current), 10);
    expect(current.observationRelationships[0]).toMatchObject({
      completedAttempts: 3,
      roundsTowardNextAttempt: 0,
    });
  });

  it("projects one observer-owned SU task and resolves the hidden roll in one command", () => {
    const progressed = completeQualifyingRounds(state(), 2);
    const ready = combatRoundStateSchema.parse({
      ...nextRound(progressed),
      currentCursor: {
        participantId: "a",
        roundNumber: progressed.roundNumber + 1,
        step: "SU",
      },
      roundEndReview: {
        participantReviews: {
          a: { participantId: "a", status: "complete" },
          b: { participantId: "b", status: "complete" },
        },
        roundNumber: progressed.roundNumber + 1,
      },
      selectedParticipantId: "a",
      selectedStep: "round_summary",
    });
    const projection = buildCombatProgressionProjection(ready);
    const tasks = projection.boundary.processes
      .flatMap((process) => process.stages)
      .flatMap((stage) => stage.executionGroups)
      .flatMap((group) => group.tasks)
      .filter((task) => task.kind === "observation_roll");

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      allowedActors: ["combatant", "gm"],
      identity: {
        observationAttemptId: "observation:a:b:attempt:1",
        opponentParticipantId: "b",
        participantId: "a",
        relationshipId: "observation:a:b",
      },
      owner: { kind: "combatant", participantId: "a" },
    });
    const observerPresentation = projectCombatProgressionPresentation({
      projection,
      viewer: {
        controlledParticipantIds: new Set(["a"]),
        kind: "player",
        visibleParticipantIds: new Set(["a", "b"]),
      },
    });
    const targetPresentation = projectCombatProgressionPresentation({
      projection,
      viewer: {
        controlledParticipantIds: new Set(["b"]),
        kind: "player",
        visibleParticipantIds: new Set(["a", "b"]),
      },
    });
    expect(
      observerPresentation.processes.flatMap((process) =>
        process.stages.flatMap((stage) => stage.executionGroups.flatMap((group) => group.tasks)),
      ),
    ).toHaveLength(1);
    expect(
      targetPresentation.processes.flatMap((process) =>
        process.stages.flatMap((stage) => stage.executionGroups.flatMap((group) => group.tasks)),
      ),
    ).toEqual([]);
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "a" },
        commandType: "roll_observation",
        executionGroupId: tasks[0]?.executionGroupId,
        observationAttemptId: tasks[0]?.identity.observationAttemptId,
        opponentParticipantId: "b",
        participantId: "a",
        projection,
        relationshipId: tasks[0]?.identity.relationshipId,
        taskId: tasks[0]?.id,
      }),
    ).toMatchObject({ ok: true });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "roll_observation",
        executionGroupId: tasks[0]?.executionGroupId,
        observationAttemptId: tasks[0]?.identity.observationAttemptId,
        opponentParticipantId: "b",
        participantId: "a",
        projection,
        relationshipId: tasks[0]?.identity.relationshipId,
        taskId: tasks[0]?.id,
      }),
    ).toMatchObject({ ok: true });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "b" },
        commandType: "roll_observation",
        executionGroupId: tasks[0]?.executionGroupId,
        observationAttemptId: tasks[0]?.identity.observationAttemptId,
        opponentParticipantId: "b",
        participantId: "a",
        projection,
        relationshipId: tasks[0]?.identity.relationshipId,
        taskId: tasks[0]?.id,
      }),
    ).toMatchObject({ code: "wrong_participant", ok: false });

    const rolled = recordCombatObservationRoll({
      command: { createdAt: at },
      completedAtRevision: at,
      executionGroupId: tasks[0]!.executionGroupId,
      observerBasis: {
        appliedModifiers: [{ bucket: "general_fatigue", label: "Combat Experience", value: 1 }],
        baseValue: 30,
        effectiveSkillValue: 31,
        intelligenceValue: 11,
        intelligenceXp: 3,
        percentageAdjustment: 1,
        percentageModifierTotal: 1,
        skillId: "dodge",
        skillLabel: "Dodge",
        skillXp: 16,
      },
      observerParticipantId: "a",
      observationAttemptId: tasks[0]!.identity.observationAttemptId!,
      relationshipId: tasks[0]!.identity.relationshipId!,
      rng: () => 0.5,
      state: ready,
      targetBasis: {
        baseValue: 0,
        intelligenceValue: 8,
        intelligenceXp: 0,
        skillId: "sword",
        skillLabel: "Sword",
        skillXp: -8,
      },
      targetParticipantId: "b",
    });

    expect(
      rolled.state.commands.filter((command) => command.type === "roll_observation"),
    ).toHaveLength(1);
    expect(rolled.attempt.targetRoll).toBeDefined();
    const observationEvent = rolled.state.events.find(
      (event) =>
        event.type === "observation" && event.facts.involvedOutcome.difference !== undefined,
    );
    expect(observationEvent?.facts.rollerPrivate).toMatchObject({
      appliedModifiers: [{ bucket: "general_fatigue", label: "Combat Experience", value: 1 }],
      intelligenceValue: 11,
      intelligenceXp: 3,
      skillLabel: "Dodge",
      skillXp: 16,
    });
    expect(observationEvent?.facts.rollerPrivate).not.toHaveProperty("skillId");
    expect(observationEvent?.facts.gmReview.targetCalculation).toMatchObject({
      intelligenceValue: 8,
      skillLabel: "Sword",
      skillXp: -8,
    });
    const boundaryTask = buildCombatProgressionProjection(rolled.state)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.kind === "gm_advance_boundary");
    expect(boundaryTask).toMatchObject({
      expectedCommand: "complete_round",
      state: "executable",
      transition: {
        currentBoundary: "round_boundary",
        targetBoundary: "declaration",
      },
    });
    expect(
      buildCombatRoundCommandEnvelope({ state: rolled.state, viewer: { kind: "gm" } }).currentTask,
    ).toMatchObject({
      cursorStep: "SU",
      participantId: undefined,
      roundNumber: ready.roundNumber,
      step: "round_summary",
    });
    expect(
      buildPlayerSafeCombatObservationAttempts({
        attempts: rolled.state.observationAttempts,
        controlledParticipantIds: new Set(["a"]),
        relationships: rolled.state.observationRelationships,
      })[0]?.targetRoll,
    ).toBeUndefined();
    expect(
      buildPlayerSafeCombatObservationAttempts({
        attempts: rolled.state.observationAttempts,
        controlledParticipantIds: new Set(["b"]),
        relationships: rolled.state.observationRelationships,
      }),
    ).toEqual([]);

    const undone = undoLatestCombatRoundCommand({ state: rolled.state });
    expect(undone?.observationAttempts).toEqual([]);
    expect(undone?.observationRelationships).toEqual(ready.observationRelationships);
    expect(getPendingCombatObservationAttempts(undone!)).toHaveLength(1);
    expect(
      buildCombatProgressionProjection(undone!)
        .boundary.processes.flatMap((process) => process.stages)
        .flatMap((stage) => stage.tasks)
        .some((task) => task.kind === "gm_advance_boundary"),
    ).toBe(false);
  });

  it("authorizes the current boundary descriptor before applying non-threshold progress", () => {
    const ready = combatRoundStateSchema.parse({
      ...state({
        relationships: [
          {
            bestBonus: 3,
            completedAttempts: 1,
            id: "observation:a:b",
            observerParticipantId: "a",
            roundsTowardNextAttempt: 4,
            targetParticipantId: "b",
          },
        ],
      }),
      currentCursor: {
        roundNumber: 1,
        step: "SU",
      },
      roundEndReview: {
        participantReviews: {
          a: { participantId: "a", status: "complete" },
          b: { participantId: "b", status: "complete" },
        },
        roundNumber: 1,
      },
      selectedParticipantId: "a",
      selectedStep: "round_summary",
    });
    const projection = buildCombatProgressionProjection(ready);
    const boundaryTask = projection.boundary.processes
      .flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.kind === "gm_advance_boundary");

    expect(boundaryTask).toMatchObject({
      expectedCommand: "complete_round",
      state: "executable",
      transition: {
        currentBoundary: "round_boundary",
        targetBoundary: "declaration",
      },
    });

    const prematurelyProgressed = resolveCombatObservationRoundBoundary({ state: ready }).state;
    expect(
      buildCombatProgressionProjection(prematurelyProgressed)
        .boundary.processes.flatMap((process) => process.stages)
        .flatMap((stage) => stage.tasks)
        .some((task) => task.id === boundaryTask?.id),
    ).toBe(false);

    const advanced = advanceCombatProgressionBoundary({
      command: { createdAt: at, createdByUserId: "gm" },
      expectedBoundary: "round_boundary",
      expectedCommandType: "complete_round",
      expectedExecutionGroupId: boundaryTask!.executionGroupId,
      expectedTaskId: boundaryTask!.id,
      state: ready,
      targetBoundary: "declaration",
    });

    expect(advanced.roundNumber).toBe(2);
    expect(advanced.observationRelationships).toContainEqual(
      expect.objectContaining({
        id: "observation:a:b",
        roundsTowardNextAttempt: 5,
      }),
    );
    expect(advanced.rounds[0]?.observationRelationships).toContainEqual(
      expect.objectContaining({
        id: "observation:a:b",
        roundsTowardNextAttempt: 5,
      }),
    );
  });

  it("pauses a hit round without erasing progress and counts a miss", () => {
    const first = resolveRound(state()).state;
    const hit = resolveRound(
      state({
        hit: true,
        relationships: first.observationRelationships,
      }),
    ).state;
    expect(hit.observationRelationships[0]?.roundsTowardNextAttempt).toBe(1);

    const miss = resolveRound(
      state({
        hit: false,
        relationships: hit.observationRelationships,
      }),
    ).state;
    expect(miss.observationRelationships[0]?.roundsTowardNextAttempt).toBe(2);
  });

  it("maps margins and retains the best non-additive bonus", () => {
    expect([-2, 0, 5, 6, 10, 11, 15, 16].map(resolveCombatObservationCandidateBonus)).toEqual([
      0, 0, 0, 1, 1, 2, 2, 3,
    ]);
    let current = completeQualifyingRounds(state(), 3);
    expect(current.observationRelationships[0]?.bestBonus).toBe(0);

    current.observationRelationships[0]!.bestBonus = 3;
    current = completeQualifyingRounds(nextRound(current), 6);
    expect(current.observationRelationships[0]).toMatchObject({
      bestBonus: 3,
      completedAttempts: 2,
    });

    const stronger = resolveCombatObservationAttempt({
      completedAt: at,
      completedAtRevision: at,
      observerBasis: { baseValue: 30, skillId: "dodge", skillLabel: "Dodge" },
      observerParticipantId: "a",
      previousRelationship: {
        bestBonus: 1,
        completedAttempts: 1,
        id: "observation:a:b",
        observerParticipantId: "a",
        roundsTowardNextAttempt: 6,
        targetParticipantId: "b",
      },
      rng: () => 0.5,
      roundNumber: 2,
      targetBasis: { baseValue: 0, skillId: "sword", skillLabel: "Sword" },
      targetParticipantId: "b",
    });
    expect(stronger.bestBonus).toBe(3);

    const weaker = resolveCombatObservationAttempt({
      completedAt: at,
      completedAtRevision: at,
      observerBasis: { baseValue: 0, skillId: "dodge", skillLabel: "Dodge" },
      observerParticipantId: "a",
      previousRelationship: stronger,
      rng: () => 0.5,
      roundNumber: 3,
      targetBasis: { baseValue: 30, skillId: "sword", skillLabel: "Sword" },
      targetParticipantId: "b",
    });
    expect(weaker.bestBonus).toBe(3);
  });

  it("derives one offensive and one defensive pair-scoped contribution", () => {
    const relationships = [
      {
        bestBonus: 2,
        completedAttempts: 1,
        id: "observation:a:b",
        observerParticipantId: "a",
        roundsTowardNextAttempt: 0,
        targetParticipantId: "b",
      },
    ];
    const contributions = buildCombatObservationModifierContributions({
      encounterId: "encounter",
      observerCombatantId: "a",
      observerParticipantId: "scenario-a",
      opponentCombatantId: "b",
      opponentParticipantId: "scenario-b",
      relationships,
    });
    expect(contributions).toHaveLength(2);
    expect(
      resolveCombatModifierContributions({
        bucket: "skill_ob",
        context: {
          opponentParticipantId: "scenario-b",
          ownerParticipantId: "scenario-a",
          rollType: "attack",
        },
        contributions,
      }).total,
    ).toBe(2);
    expect(
      resolveCombatModifierContributions({
        bucket: "db_parry",
        context: {
          opponentParticipantId: "scenario-b",
          ownerParticipantId: "scenario-a",
          rollType: "parry",
        },
        contributions,
      }).total,
    ).toBe(2);
    expect(
      resolveCombatModifierContributions({
        bucket: "skill_ob",
        context: {
          opponentParticipantId: "scenario-c",
          ownerParticipantId: "scenario-a",
        },
        contributions,
      }).total,
    ).toBe(0);
  });

  it("applies Observe to a resisting Skill Contest role only", () => {
    const relationships = [
      {
        bestBonus: 1,
        completedAttempts: 1,
        id: "observation:a:b",
        observerParticipantId: "a",
        roundsTowardNextAttempt: 0,
        targetParticipantId: "b",
      },
      {
        bestBonus: 3,
        completedAttempts: 1,
        id: "observation:b:a",
        observerParticipantId: "b",
        roundsTowardNextAttempt: 0,
        targetParticipantId: "a",
      },
    ];

    expect(
      buildCombatObservationSkillContestContribution({
        contestType: "adjust_distance_attack",
        observerCombatantId: "a",
        opponentCombatantId: "b",
        relationships,
        role: "initiator",
      }),
    ).toBeUndefined();
    expect(
      buildCombatObservationSkillContestContribution({
        contestType: "adjust_distance_attack",
        observerCombatantId: "a",
        opponentCombatantId: "b",
        relationships,
        role: "resisting_opponent",
      }),
    ).toMatchObject({ category: "relationship", value: 1 });
    expect(
      buildCombatObservationSkillContestContribution({
        contestType: "adjust_distance_attack",
        observerCombatantId: "a",
        opponentCombatantId: "c",
        relationships,
        role: "resisting_opponent",
      }),
    ).toBeUndefined();
    expect(
      buildCombatObservationSkillContestContribution({
        contestType: "adjust_distance_attack",
        observerCombatantId: "b",
        opponentCombatantId: "a",
        relationships,
        role: "resisting_opponent",
      }),
    ).toMatchObject({ value: 3 });
    expect(
      buildCombatObservationSkillContestContribution({
        contestType: "weapon_feint",
        observerCombatantId: "b",
        opponentCombatantId: "a",
        relationships,
        role: "feint_defender",
      }),
    ).toMatchObject({ category: "relationship", value: 3 });
    expect(
      buildCombatObservationSkillContestContribution({
        contestType: "movement_feint",
        observerCombatantId: "a",
        opponentCombatantId: "b",
        relationships,
        role: "movement_feint_initiator",
      }),
    ).toBeUndefined();
  });

  it("restores exact prior relationships from compact boundary undo facts", () => {
    const before = resolveRound(state()).state;
    const after = resolveRound(before);
    expect(
      restoreCombatObservationRelationships({
        relationships: after.state.observationRelationships,
        undoFacts: after.undoFacts,
      }),
    ).toEqual(before.observationRelationships);
    expect(JSON.stringify(after.undoFacts)).not.toContain("commands");
  });

  it("shows only the observer's own relationship and hides the target calculation", () => {
    const current = completeQualifyingRounds(state(), 3);

    const observerSafe = buildPlayerSafeCombatObservationRelationships({
      controlledParticipantIds: new Set(["a"]),
      relationships: current.observationRelationships,
    });
    expect(observerSafe).toHaveLength(1);
    expect(observerSafe[0]).toMatchObject({
      observerParticipantId: "a",
      targetParticipantId: "b",
    });
    expect(observerSafe[0]?.lastAttempt?.observerRoll).toBeDefined();
    expect(observerSafe[0]?.lastAttempt?.targetRoll).toBeUndefined();

    const targetSafe = buildPlayerSafeCombatObservationRelationships({
      controlledParticipantIds: new Set(["b"]),
      relationships: current.observationRelationships,
    });
    expect(targetSafe).toEqual([]);
  });
});

describe("Observe Opponent — Pass or Parry", () => {
  function observerWithPrimaryAction(input: {
    primaryAction: "attack_parry" | "parry" | "pass";
    targetParticipantId: string;
  }) {
    return {
      declaration: {
        actionId: input.primaryAction,
        roundNumber: 1,
        secondaryActions: [
          { action: "observe_opponent", targetParticipantId: input.targetParticipantId },
        ],
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: input.targetParticipantId,
        },
        secondaryActionId: "observe_opponent",
        submittedBy: "player",
      },
      label: "a",
      participantId: "a",
    };
  }

  function stateWithPrimaryAction(
    primaryAction: "attack_parry" | "parry" | "pass",
  ): CombatRoundState {
    return combatRoundStateSchema.parse({
      currentStep: "round_summary",
      encounterId: "encounter-1",
      participants: [
        observerWithPrimaryAction({ primaryAction, targetParticipantId: "b" }),
        { label: "b", participantId: "b" },
      ],
      roundNumber: 1,
    });
  }

  it("progresses an Observe relationship declared with Pass, exactly as with Parry", () => {
    const passProgress = resolveCombatObservationRoundBoundary({
      state: stateWithPrimaryAction("pass"),
    }).state;
    const parryProgress = resolveCombatObservationRoundBoundary({
      state: stateWithPrimaryAction("parry"),
    }).state;

    // The live defect this closes: Pass + Observe was offered by
    // combatDeclarationCompatibility.ts and then silently produced nothing.
    expect(passProgress.observationRelationships).toHaveLength(1);
    expect(passProgress.observationRelationships[0]).toMatchObject({
      bestBonus: 0,
      completedAttempts: 0,
      id: "observation:a:b",
      observerParticipantId: "a",
      roundsTowardNextAttempt: 1,
      targetParticipantId: "b",
    });
    expect(passProgress.observationRelationships).toEqual(parryProgress.observationRelationships);
  });

  it("reaches the first threshold attempt from Pass after the same three qualifying rounds", () => {
    let current = stateWithPrimaryAction("pass");
    expect(getPendingCombatObservationAttempts(current)).toEqual([]);

    current = nextRound(resolveCombatObservationRoundBoundary({ state: current }).state);
    expect(getPendingCombatObservationAttempts(current)).toEqual([]);

    current = nextRound(resolveCombatObservationRoundBoundary({ state: current }).state);
    const pending = getPendingCombatObservationAttempts(current);

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      attemptId: "observation:a:b:attempt:1",
      observerParticipantId: "a",
      relationshipId: "observation:a:b",
      requiredQualifyingRounds: 3,
      targetParticipantId: "b",
    });
  });

  it("widens nothing beyond Pass — other primary actions still yield no Observe progress", () => {
    const attackParry = resolveCombatObservationRoundBoundary({
      state: stateWithPrimaryAction("attack_parry"),
    });

    expect(attackParry.state.observationRelationships).toEqual([]);
    expect(attackParry.undoFacts).toEqual([]);
    expect(getPendingCombatObservationAttempts(attackParry.state)).toEqual([]);
  });

  it("leaves the Observe schedule, bonus bands and best-bonus retention unchanged", () => {
    // Schedule 3 / 6 / 10 — combatObservation.ts is not modified by this slice.
    expect(getCombatObservationRequiredRounds(0)).toBe(3);
    expect(getCombatObservationRequiredRounds(1)).toBe(6);
    expect(getCombatObservationRequiredRounds(2)).toBe(10);
    expect(getCombatObservationRequiredRounds(3)).toBe(10);

    // Bonus bands.
    expect(resolveCombatObservationCandidateBonus(-1)).toBe(0);
    expect(resolveCombatObservationCandidateBonus(0)).toBe(0);
    expect(resolveCombatObservationCandidateBonus(5)).toBe(0);
    expect(resolveCombatObservationCandidateBonus(6)).toBe(1);
    expect(resolveCombatObservationCandidateBonus(10)).toBe(1);
    expect(resolveCombatObservationCandidateBonus(11)).toBe(2);
    expect(resolveCombatObservationCandidateBonus(15)).toBe(2);
    expect(resolveCombatObservationCandidateBonus(16)).toBe(3);

    // `max(existing, candidate)` retention: a weaker later result cannot destroy a good one.
    const strongRelationship = resolveCombatObservationAttempt({
      completedAt: at,
      completedAtRevision: at,
      observerBasis: { baseValue: 40, skillId: "dodge", skillLabel: "Dodge" },
      observerParticipantId: "a",
      rng: () => 0.5,
      roundNumber: 1,
      targetBasis: { baseValue: 0, skillId: "sword", skillLabel: "Sword" },
      targetParticipantId: "b",
    });
    const afterWeakAttempt = resolveCombatObservationAttempt({
      completedAt: at,
      completedAtRevision: at,
      observerBasis: { baseValue: 0, skillId: "dodge", skillLabel: "Dodge" },
      observerParticipantId: "a",
      previousRelationship: strongRelationship,
      rng: () => 0.5,
      roundNumber: 2,
      targetBasis: { baseValue: 40, skillId: "sword", skillLabel: "Sword" },
      targetParticipantId: "b",
    });

    expect(strongRelationship.bestBonus).toBe(3);
    expect(afterWeakAttempt.lastAttempt?.candidateBonus).toBe(0);
    expect(afterWeakAttempt.bestBonus).toBe(3);
  });
});

/**
 * #948 (Product Owner ruling of 2026-11-05) — the narrow persisted "manual review required"
 * state for an Observe task whose required inputs cannot be derived.
 *
 * Two questions about the same attempt, kept apart. The round's **progression** stops treating a
 * marked attempt as blocking, so the participants after its observer become executable and the NPC
 * batch continues. The **Observation** is not resolved and not completed: it stays listed, the
 * relationship's `completedAttempts` is untouched, no attempt record exists, and the GM can still
 * resolve it by hand once the data is there.
 *
 * Every assertion that depends on the marker has its disabled twin here: the same drive with no
 * marker written, which is the behaviour before this state existed.
 */
describe("Observe Opponent set aside for manual review (#948)", () => {
  const markedAt = "2026-01-02T00:00:00.000Z";
  const atThreshold = (observerParticipantId: string, targetParticipantId: string) => ({
    bestBonus: 0,
    completedAttempts: 0,
    id: `observation:${observerParticipantId}:${targetParticipantId}`,
    observerParticipantId,
    roundsTowardNextAttempt: 2,
    targetParticipantId,
  });
  const owners = (attempts: readonly { observerParticipantId: string }[]) =>
    attempts.map((attempt) => attempt.observerParticipantId);

  /** Three participants; `a` and `c` both observe `b`, and both reach their first attempt now. */
  function twoObserverRound(input: { roundNumber?: number } = {}): CombatRoundState {
    const roundNumber = input.roundNumber ?? 1;
    const observer = (participantId: string) => {
      const base = participant(participantId, "b");
      return { ...base, declaration: { ...base.declaration, roundNumber } };
    };
    return combatRoundStateSchema.parse({
      currentCursor: { participantId: "a", roundNumber, step: "SU" },
      currentStep: "round_summary",
      observationRelationships: [atThreshold("a", "b"), atThreshold("c", "b")],
      participants: [observer("a"), { label: "b", participantId: "b" }, observer("c")],
      roundEndReview: {
        participantReviews: {
          a: { participantId: "a", status: "complete" },
          b: { participantId: "b", status: "complete" },
          c: { participantId: "c", status: "complete" },
        },
        roundNumber,
      },
      roundNumber,
    });
  }

  function mark(current: CombatRoundState, observerParticipantId: string): CombatRoundState {
    const pending = getPendingCombatObservationAttempts(current).find(
      (attempt) => attempt.observerParticipantId === observerParticipantId,
    );
    expect(pending).toBeDefined();
    return markCombatObservationManualReviewRequired({
      attemptId: pending!.attemptId,
      markedAt,
      markedByUserId: "user-gm",
      missingData: ["intelligence_characteristic"],
      reason: "observation_basis_data_missing",
      state: current,
    }).state;
  }

  const observationTaskOwners = (current: CombatRoundState, stageKind: "contest" | "review") =>
    buildCombatRoundEndProcessPlan(current)
      .processes.filter((process) => process.kind === "observation")
      .flatMap((process) => process.stages)
      .filter((stage) => stage.kind === stageKind)
      .flatMap((stage) => stage.tasks)
      .map((task) => task.ownerParticipantId);

  it("is still a pending Observe attempt, and is no longer a blocking one", () => {
    const unmarked = twoObserverRound();
    // The disabled twin: with no marker, both attempts block.
    expect(owners(getBlockingCombatObservationAttempts(unmarked))).toEqual(["a", "c"]);

    const marked = mark(unmarked, "a");
    expect(owners(getPendingCombatObservationAttempts(marked))).toEqual(["a", "c"]);
    expect(owners(getBlockingCombatObservationAttempts(marked))).toEqual(["c"]);
    expect(getCombatObservationManualReviews(marked)).toEqual([
      {
        attemptId: "observation:a:b:attempt:1",
        markedAt,
        markedByUserId: "user-gm",
        missingData: ["intelligence_characteristic"],
        observerParticipantId: "a",
        reason: "observation_basis_data_missing",
        relationshipId: "observation:a:b",
        roundNumber: 1,
        targetParticipantId: "b",
      },
    ]);
  });

  it("unpins the round-end cursor, so the next observer becomes executable", () => {
    const unmarked = twoObserverRound();
    // The disabled twin, and the measured defect this closes: `a`'s unresolved attempt pins the
    // active participant on `a`, so `c`'s Observe task never becomes executable.
    expect(buildCombatRoundEndProcessPlan(unmarked).activeParticipantId).toBe("a");
    expect(observationTaskOwners(unmarked, "contest")).toEqual(["a"]);
    expect(observationTaskOwners(unmarked, "review")).toEqual([]);
    expect(getNextCombatRoundEndTask({ state: unmarked })).toMatchObject({
      kind: "observation_roll",
      participantId: "a",
    });

    const marked = mark(unmarked, "a");
    expect(buildCombatRoundEndProcessPlan(marked).activeParticipantId).toBe("c");
    expect(observationTaskOwners(marked, "contest")).toEqual(["c"]);
    expect(getNextCombatRoundEndTask({ state: marked })).toMatchObject({
      kind: "observation_roll",
      participantId: "c",
    });
  });

  it("keeps a projected task for the marked attempt, so the GM can still resolve it", () => {
    const marked = mark(twoObserverRound(), "a");
    expect(observationTaskOwners(marked, "review")).toEqual(["a"]);

    // The manual roll authorizes against a projected task, so a task is what makes it resolvable.
    // Disabled twin: the same authorization with the attempt it does not name.
    const projection = buildCombatProgressionProjection(marked);
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "roll_observation",
        observationAttemptId: "observation:a:b:attempt:1",
        participantId: "a",
        projection,
      }).ok,
    ).toBe(true);
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "roll_observation",
        observationAttemptId: "observation:a:b:attempt:4",
        participantId: "a",
        projection,
      }).ok,
    ).toBe(false);
  });

  it("does not count as a completed or resolved Observation anywhere that counts them", () => {
    const marked = mark(mark(twoObserverRound(), "a"), "c");
    const plan = buildCombatRoundEndProcessPlan(marked);

    // 1. No attempt record, and 2. no completed attempt or bonus on either relationship.
    expect(marked.observationAttempts).toEqual([]);
    expect(
      marked.observationRelationships.map((relationship) => relationship.completedAttempts),
    ).toEqual([0, 0]);
    expect(marked.observationRelationships.map((relationship) => relationship.bestBonus)).toEqual([
      0, 0,
    ]);
    // 3. Still listed as pending, so nothing reads either one as resolved.
    expect(getPendingCombatObservationAttempts(marked)).toHaveLength(2);
    // 4. The ordered contest stage has no remaining ordered work, and the review stage is the one
    // that stays active: the round does not report the Observe contests as held.
    expect(observationTaskOwners(marked, "contest")).toEqual([]);
    expect(observationTaskOwners(marked, "review")).toEqual(["a", "c"]);
    const observation = plan.processes.find((process) => process.kind === "observation")!;
    expect(observation.stages.map((stage) => [stage.kind, stage.state])).toEqual([
      ["contest", "complete"],
      ["review", "active"],
    ]);
    // 5. The round's progression is free: the boundary is reachable by the GM's own action.
    // Automation never crosses it, because `complete_round` is classified as a GM decision.
    expect(plan.complete).toBe(true);
    expect(getNextCombatRoundEndTask({ state: marked })).toEqual({ kind: "round_boundary" });
  });

  it("re-presents the unresolved attempt in the next round rather than consuming it", () => {
    const marked = mark(twoObserverRound(), "a");
    const boundary = resolveCombatObservationRoundBoundary({ state: marked });
    const observerRelationship = boundary.state.observationRelationships.find(
      (relationship) => relationship.id === "observation:a:b",
    );

    // Crossing the boundary adds no progress and completes no attempt, so the relationship is
    // still at its threshold and the attempt is due again.
    expect(observerRelationship).toMatchObject({
      completedAttempts: 0,
      roundsTowardNextAttempt: 2,
    });
    const second = nextRound(boundary.state);
    expect(getPendingCombatObservationAttempts(second).map((entry) => entry.attemptId)).toContain(
      "observation:a:b:attempt:1",
    );
  });

  it("is round-scoped: a marker from another round is not read", () => {
    const marked = mark(twoObserverRound(), "a");
    const otherRound = combatRoundStateSchema.parse({
      ...marked,
      observationManualReviews: marked.observationManualReviews.map((review) => ({
        ...review,
        roundNumber: 7,
      })),
    });

    expect(getCombatObservationManualReviews(otherRound)).toEqual([]);
    expect(owners(getBlockingCombatObservationAttempts(otherRound))).toEqual(["a", "c"]);
    expect(buildCombatRoundEndProcessPlan(otherRound).activeParticipantId).toBe("a");
  });

  it("fails closed for a stored round that carries no marker list at all", () => {
    const stored = { ...twoObserverRound() } as Record<string, unknown>;
    delete stored.observationManualReviews;
    expect("observationManualReviews" in stored).toBe(false);

    // No migration and no backfill: the absent key reads as no markers, so every pending attempt
    // blocks exactly as it did before this state existed.
    const parsed = combatRoundStateSchema.parse(stored);
    expect(parsed.observationManualReviews).toEqual([]);
    expect(owners(getBlockingCombatObservationAttempts(parsed))).toEqual(["a", "c"]);
    expect(buildCombatRoundEndProcessPlan(parsed).activeParticipantId).toBe("a");
  });

  it("refuses to mark anything but an attempt the round actually has pending", () => {
    const current = twoObserverRound();
    expect(() =>
      markCombatObservationManualReviewRequired({
        attemptId: "observation:a:b:attempt:9",
        markedAt,
        reason: "observation_basis_data_missing",
        state: current,
      }),
    ).toThrow(RangeError);

    // The observer, target and relationship come from the pending attempt, never from the caller,
    // so a marker cannot name a contest the round does not have.
    const marked = markCombatObservationManualReviewRequired({
      attemptId: "observation:c:b:attempt:1",
      markedAt,
      reason: "observation_contest_unavailable",
      state: current,
    });
    expect(marked.review).toMatchObject({
      observerParticipantId: "c",
      relationshipId: "observation:c:b",
      targetParticipantId: "b",
    });
  });

  it("marks once: the same reason and missing data again changes nothing", () => {
    const first = mark(twoObserverRound(), "a");
    const again = markCombatObservationManualReviewRequired({
      attemptId: "observation:a:b:attempt:1",
      markedAt: "2026-01-03T00:00:00.000Z",
      missingData: ["intelligence_characteristic"],
      reason: "observation_basis_data_missing",
      state: first,
    });
    expect(again.changed).toBe(false);
    expect(again.state.observationManualReviews).toHaveLength(1);
    expect(again.state.observationManualReviews[0]!.markedAt).toBe(markedAt);

    // A different reason replaces the marker rather than adding a second one, so the GM report
    // states the reason the run actually found.
    const rereason = markCombatObservationManualReviewRequired({
      attemptId: "observation:a:b:attempt:1",
      markedAt: "2026-01-03T00:00:00.000Z",
      reason: "observation_basis_not_derivable",
      state: first,
    });
    expect(rereason.changed).toBe(true);
    expect(rereason.state.observationManualReviews).toHaveLength(1);
    expect(rereason.state.observationManualReviews[0]).toMatchObject({
      missingData: [],
      reason: "observation_basis_not_derivable",
    });
  });

  it("drops the marker when the attempt is resolved by hand", () => {
    const marked = mark(twoObserverRound(), "a");
    const resolved = recordCombatObservationRoll({
      command: { createdAt: at },
      completedAtRevision: at,
      executionGroupId: "observation:1",
      observerBasis: { baseValue: 15, skillId: "dodge", skillLabel: "Dodge" },
      observerParticipantId: "a",
      observationAttemptId: "observation:a:b:attempt:1",
      relationshipId: "observation:a:b",
      rng: () => 0.5,
      state: marked,
      targetBasis: { baseValue: 10, skillId: "sword", skillLabel: "Sword" },
      targetParticipantId: "b",
    }).state;

    expect(resolved.observationManualReviews).toEqual([]);
    expect(resolved.observationAttempts).toHaveLength(1);
    expect(
      resolved.observationRelationships.find(
        (relationship) => relationship.id === "observation:a:b",
      )?.completedAttempts,
    ).toBe(1);
  });
});
