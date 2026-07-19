import { describe, expect, it } from "vitest";

import {
  buildCombatRoundEndProcessPlan,
  buildOrderedParticipantIteration,
} from "./combatRoundEndProcesses";
import {
  combatRoundStateSchema,
  rollCombatRoundEndDistanceControl,
  undoLatestCombatRoundCommand,
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

describe("combat round-end process plans", () => {
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
    expect(Object.isFrozen(first)).toBe(true);
    expect(JSON.stringify(source)).toBe(before);
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

  it("keeps pair rolls parallel and locks participant review behind distance", () => {
    const plan = buildCombatRoundEndProcessPlan(
      state(review({ proposedDistances: [pendingDistance()] })),
    );
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
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "hero" },
        commandType: "roll_round_end_health_check",
        healthRollId: "health:hero",
        participantId: "hero",
        projection: healthProjection,
        proposalId: "health:hero",
      }),
    ).toMatchObject({ ok: true, task: { kind: "health_review" } });
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
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        commandType: "commit_round_end_participant_review",
        participantId: "hero",
        projection: effectProjection,
      }),
    ).toMatchObject({ ok: true, task: { kind: "effect_review" } });
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "hero" },
        commandType: "commit_round_end_participant_review",
        participantId: "hero",
        projection: effectProjection,
      }),
    ).toMatchObject({ code: "gm_only", ok: false });
  });

  it("keeps player-safe Round End tasks actionable without transporting proposal details", () => {
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
    expect(tasks.find((task) => task.kind === "health_review")?.identity).not.toHaveProperty(
      "proposalId",
    );
    expect(tasks.find((task) => task.kind === "health_review")?.identity).not.toHaveProperty(
      "healthRollId",
    );
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
      roll: { dieResult: 10, openEndedD10s: [], rollD20: 10 },
      state: source,
    }).state;
    expect(buildCombatRoundEndProcessPlan(rolled).processes[0]?.stages[0]?.tasks).toHaveLength(1);

    const undone = undoLatestCombatRoundCommand({ state: rolled });
    expect(undone).toBeDefined();
    expect(buildCombatRoundEndProcessPlan(undone!)).toEqual(buildCombatRoundEndProcessPlan(source));
  });
});
