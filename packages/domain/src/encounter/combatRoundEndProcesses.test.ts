import { describe, expect, it } from "vitest";

import {
  buildCombatRoundEndProcessPlan,
  buildOrderedParticipantIteration,
} from "./combatRoundEndProcesses";
import {
  combatRoundStateSchema,
  combatRoundEndDistanceProposalSchema,
  rollCombatRoundEndDistanceControl,
  sortCombatRoundEndDistanceProposals,
  undoLatestCombatRoundCommand,
  type CombatRoundEndDistanceRollResult,
  type CombatRoundState,
} from "./combatRoundManager";
import {
  authorizeCombatProgressionTask,
  buildCombatProgressionProjection,
  projectCombatProgressionPresentation,
} from "./combatProgressionProjection";

function state(review?: Record<string, unknown>): CombatRoundState {
  return combatRoundStateSchema.parse({
    currentCursor: { participantId: "hero", roundNumber: 3, step: "SU" },
    currentStep: "round_summary",
    participants: [
      { label: "Hero", participantId: "hero", scenarioParticipantId: "scenario-hero" },
      { label: "Guard", participantId: "guard", scenarioParticipantId: "scenario-guard" },
    ],
    roundEndReview: review,
    roundNumber: 3,
  });
}

function initiativeOrderedState(reviewInput?: Record<string, unknown>): CombatRoundState {
  const source = state(reviewInput);
  return combatRoundStateSchema.parse({
    ...source,
    currentCursor: { participantId: "hero", roundNumber: 3, step: "SU" },
    participants: source.participants.map((participant) => ({
      ...participant,
      initiatives: {
        phase2: participant.participantId === "guard" ? 10 : 4,
      },
    })),
  });
}

function participantReview(
  participantId: string,
  status: "complete" | "health_roll_pending" | "review_ready",
) {
  return {
    participantId,
    proposedHealthRolls:
      status === "health_roll_pending"
        ? [
            {
              bleedType: "external",
              difficulty: 26,
              healthStat: 12,
              id: `health:${participantId}`,
              label: "Health check",
              participantId,
              sourceEffectId: `bleed:${participantId}`,
              status: "pending",
            },
          ]
        : [],
    status,
  };
}

function review(
  input: {
    guardStatus?: "complete" | "health_roll_pending" | "review_ready";
    heroStatus?: "complete" | "health_roll_pending" | "review_ready";
    proposedDistances?: readonly Record<string, unknown>[];
  } = {},
) {
  return {
    participantReviews: {
      guard: participantReview("guard", input.guardStatus ?? "complete"),
      hero: participantReview("hero", input.heroStatus ?? "review_ready"),
    },
    proposedDistances: input.proposedDistances ?? [],
    roundNumber: 3,
  };
}

function pendingDistance() {
  return {
    appliesFromRound: 4,
    currentDistance: 2,
    id: "distance:hero:guard",
    pairKey: "guard::hero",
    participantA: { participantId: "hero", status: "pending" },
    participantAId: "hero",
    participantB: { participantId: "guard", status: "pending" },
    participantBId: "guard",
    requiresContest: true,
    status: "pending_rolls",
  };
}

function distanceRollResult(input: {
  baseSkill: number;
  dieResult: number;
  opponentParticipantId: string;
  participantId: string;
  rolledAt: string;
}): CombatRoundEndDistanceRollResult {
  return {
    dodgeSkillTotal: input.baseSkill,
    finalTotal: input.baseSkill + input.dieResult,
    generalFatigueModifier: 0,
    openEndedD10s: [],
    rolledAt: input.rolledAt,
    rolledAtRound: 3,
    rolledBy: "gm_proxy",
    rollD20: input.dieResult,
    rollTotal: input.dieResult,
    skillContestCalculation: {
      baseSkill: input.baseSkill,
      calculationId: `round-end-distance:${input.participantId}`,
      completeness: "partial",
      contestType: "round_end_adjust_distance",
      derivedIntegerAdjustment: 0,
      finalResult: input.baseSkill + input.dieResult,
      governingStat: { id: "dex", label: "Dexterity", value: input.baseSkill },
      missingContributionPoints: ["movement_mm", "encumbrance"],
      openEndedDie: {
        openEndedD10s: [],
        rollD20: input.dieResult,
        rollTotal: input.dieResult,
      },
      opponentParticipantId: input.opponentParticipantId,
      participantId: input.participantId,
      percentageContributions: [],
      preDieTotal: input.baseSkill,
      role: "contestant",
      skill: { id: "dodge", label: "Dodge", totalXp: 0 },
      totalPercentageAdjustment: 0,
      visibility: "roller_and_gm",
    },
  };
}

describe("combat round-end process plans", () => {
  it("sorts copied active distance proposals by normalized pair and proposal identity", () => {
    const proposal = (
      pairKey: string,
      id: string,
      participantAId: string,
      participantBId: string,
    ) =>
      combatRoundEndDistanceProposalSchema.parse({
        appliesFromRound: 4,
        currentDistance: 2,
        currentDistanceSource: "canonical",
        id,
        pairKey,
        participantA: { participantId: participantAId, status: "pending" },
        participantAId,
        participantB: { participantId: participantBId, status: "pending" },
        participantBId,
        requiresContest: true,
        status: "pending_rolls",
      });
    const persisted = [
      proposal("mage::orc", "proposal-b", "mage", "orc"),
      proposal("guard::hero", "proposal-z", "guard", "hero"),
      proposal("guard::hero", "proposal-a", "guard", "hero"),
    ];

    expect(sortCombatRoundEndDistanceProposals(persisted).map((entry) => entry.id)).toEqual([
      "proposal-a",
      "proposal-z",
      "proposal-b",
    ]);
    expect(persisted.map((entry) => entry.id)).toEqual(["proposal-b", "proposal-z", "proposal-a"]);
  });

  it("builds an immutable deterministic prepare process without mutating state", () => {
    const source = state();
    const before = JSON.stringify(source);
    const first = buildCombatRoundEndProcessPlan(source);
    const second = buildCombatRoundEndProcessPlan(source);

    expect(second).toEqual(first);
    expect(first.processes[0]?.stages[0]?.tasks[0]).toMatchObject({
      expectedCommand: "prepare_round_end_review",
      kind: "round_end_prepare",
      ownerRole: "gm",
    });
    expect(first.processes[0]?.stages[0]?.tasks[0]?.trackerParticipantId).toBeUndefined();
    expect(Object.isFrozen(first)).toBe(true);
    expect(JSON.stringify(source)).toBe(before);

    const projection = buildCombatProgressionProjection(source);
    const task = projection.boundary.processes[0]?.stages[0]?.tasks[0];
    expect(task?.trackerFacet).toEqual({ owner: undefined, step: "SU" });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "prepare_round_end_review",
        executionGroupId: task?.executionGroupId,
        projection,
        taskId: task?.id,
      }),
    ).toMatchObject({ ok: true, task: { id: task?.id, kind: "round_end_prepare" } });
  });

  it("normalizes stable ordered participant iteration", () => {
    expect(
      buildOrderedParticipantIteration({
        completedParticipantIds: new Set(["hero"]),
        participantIds: ["hero", "guard", "mage"],
        preferredParticipantId: "mage",
      }),
    ).toEqual([
      { participantId: "hero", state: "complete" },
      { participantId: "guard", state: "pending" },
      { participantId: "mage", state: "active" },
    ]);
  });

  it("starts and continues SU in the same committed order rendered by the tracker", () => {
    const first = buildCombatRoundEndProcessPlan(
      initiativeOrderedState(review({ guardStatus: "review_ready", heroStatus: "review_ready" })),
    );
    expect(first.activeParticipantId).toBe("guard");
    expect(
      first.processes
        .find((process) => process.kind === "participant_review")
        ?.stages.map((entry) => [entry.key, entry.state]),
    ).toEqual([
      ["guard", "active"],
      ["hero", "pending"],
    ]);

    const second = buildCombatRoundEndProcessPlan(
      initiativeOrderedState(review({ guardStatus: "complete", heroStatus: "review_ready" })),
    );
    expect(second.activeParticipantId).toBe("hero");
  });

  it("keeps pair rolls parallel and locks participant review behind distance", () => {
    const source = state(review({ proposedDistances: [pendingDistance()] }));
    const plan = buildCombatRoundEndProcessPlan(source);
    const distance = plan.processes.find((process) => process.kind === "distance");
    const participants = plan.processes.find((process) => process.kind === "participant_review");

    expect(distance?.stages.find((stage) => stage.kind === "roll")).toMatchObject({
      executionStrategy: "parallel_all",
      state: "active",
      tasks: [
        { ownerParticipantId: "hero", pairId: "guard::hero" },
        { ownerParticipantId: "guard", pairId: "guard::hero" },
      ],
    });
    expect(participants?.stages.every((stage) => stage.state !== "active")).toBe(true);
    expect(plan.activeParticipantId).toBeUndefined();

    const projection = buildCombatProgressionProjection(source);
    const heroTask = projection.boundary.processes
      .flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find(
        (task) =>
          task.kind === "distance_roll" &&
          task.owner?.kind === "combatant" &&
          task.owner.participantId === "hero",
      );
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "hero" },
        commandType: "roll_round_end_distance_control",
        executionGroupId: heroTask?.executionGroupId,
        opponentParticipantId: "guard",
        pairId: "guard::hero",
        participantId: "hero",
        projection,
        proposalId: "distance:hero:guard",
        taskId: heroTask?.id,
      }),
    ).toMatchObject({ ok: true, task: { id: heroTask?.id, kind: "distance_roll" } });
  });

  it("composes participant, Health, effect, and explicit transition processes", () => {
    const healthPlan = buildCombatRoundEndProcessPlan(
      state(review({ heroStatus: "health_roll_pending" })),
    );
    expect(healthPlan.processes.map((process) => process.kind)).toEqual([
      "distance",
      "participant_review",
      "health_review",
      "effect_review",
      "observation",
      "round_end",
    ]);
    expect(
      healthPlan.processes.find((process) => process.kind === "health_review")?.stages[0]?.tasks[0],
    ).toMatchObject({
      healthRollId: "health:hero",
      kind: "health_review",
      ownerParticipantId: "hero",
    });
    expect(
      healthPlan.processes.find((process) => process.kind === "effect_review")?.stages[0]?.state,
    ).toBe("pending");

    const effectPlan = buildCombatRoundEndProcessPlan(state(review()));
    expect(
      effectPlan.processes.find((process) => process.kind === "effect_review")?.stages[0]?.tasks[0],
    ).toMatchObject({
      expectedCommand: "commit_round_end_participant_review",
      kind: "effect_review",
      ownerRole: "gm",
      ownerParticipantId: "hero",
    });

    const completePlan = buildCombatRoundEndProcessPlan(state(review({ heroStatus: "complete" })));
    expect(completePlan.complete).toBe(true);
    expect(completePlan.processes.at(-1)?.stages[0]?.tasks[0]).toMatchObject({
      expectedCommand: "complete_round",
      kind: "gm_advance_boundary",
    });
  });

  it("authorizes projected Health and effect tasks with exact participant identity", () => {
    const healthProjection = buildCombatProgressionProjection(
      state(review({ heroStatus: "health_roll_pending" })),
    );
    const healthTask = healthProjection.boundary.processes
      .flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.kind === "health_review");
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "hero" },
        commandType: "roll_round_end_health_check",
        executionGroupId: healthTask?.executionGroupId,
        healthRollId: "health:hero",
        participantId: "hero",
        projection: healthProjection,
        proposalId: "health:hero",
        taskId: healthTask?.id,
      }),
    ).toMatchObject({ ok: true, task: { id: healthTask?.id, kind: "health_review" } });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "guard" },
        commandType: "roll_round_end_health_check",
        healthRollId: "health:hero",
        participantId: "hero",
        projection: healthProjection,
        proposalId: "health:hero",
      }),
    ).toMatchObject({ code: "wrong_participant", ok: false });

    const effectProjection = buildCombatProgressionProjection(state(review()));
    const effectTask = effectProjection.boundary.processes
      .flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.kind === "effect_review");
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "commit_round_end_participant_review",
        executionGroupId: effectTask?.executionGroupId,
        participantId: "hero",
        projection: effectProjection,
        taskId: effectTask?.id,
      }),
    ).toMatchObject({ ok: true, task: { id: effectTask?.id, kind: "effect_review" } });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "hero" },
        commandType: "commit_round_end_participant_review",
        participantId: "hero",
        projection: effectProjection,
      }),
    ).toMatchObject({ code: "gm_only", ok: false });
  });

  it("keeps player-safe Round End tasks actionable with identity but without proposal details", () => {
    const projection = buildCombatProgressionProjection(
      state(review({ heroStatus: "health_roll_pending" })),
    );
    const player = projectCombatProgressionPresentation({
      projection,
      viewer: {
        controlledParticipantIds: new Set(["hero"]),
        kind: "player",
        visibleParticipantIds: new Set(["hero", "guard"]),
      },
    });
    const tasks = player.processes.flatMap((process) =>
      process.stages.flatMap((processStage) => processStage.tasks),
    );

    expect(tasks).toContainEqual(
      expect.objectContaining({
        actorAccess: { combatant: true, gm: true },
        kind: "health_review",
        owner: expect.objectContaining({ participantId: "hero" }),
      }),
    );
    expect(tasks.find((task) => task.kind === "health_review")?.identity).toMatchObject({
      healthRollId: "health:hero",
      proposalId: "health:hero",
    });
    expect(JSON.stringify(player)).not.toContain("bleed:hero");
  });

  it("reconstructs identically after reload and does not advance the round", () => {
    const source = state(review({ heroStatus: "complete" }));
    const reloaded = combatRoundStateSchema.parse(JSON.parse(JSON.stringify(source)));
    expect(buildCombatRoundEndProcessPlan(reloaded)).toEqual(
      buildCombatRoundEndProcessPlan(source),
    );
    expect(reloaded.roundNumber).toBe(3);
    expect(reloaded.currentStep).toBe("round_summary");
  });

  it("reopens the same projected pair work after undo", () => {
    const source = state(review({ proposedDistances: [pendingDistance()] }));
    const rolled = rollCombatRoundEndDistanceControl({
      command: { createdAt: "2026-07-19T10:00:00.000Z" },
      distanceProposalId: "distance:hero:guard",
      participantId: "hero",
      result: distanceRollResult({
        baseSkill: 0,
        dieResult: 10,
        opponentParticipantId: "guard",
        participantId: "hero",
        rolledAt: "2026-07-19T10:00:00.000Z",
      }),
      state: source,
    }).state;
    expect(buildCombatRoundEndProcessPlan(rolled).processes[0]?.stages[0]?.tasks).toHaveLength(1);

    const undone = undoLatestCombatRoundCommand({ state: rolled });
    expect(undone).toBeDefined();
    expect(buildCombatRoundEndProcessPlan(undone!)).toEqual(buildCombatRoundEndProcessPlan(source));
  });
});
