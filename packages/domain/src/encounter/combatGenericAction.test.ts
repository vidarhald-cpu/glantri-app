import { describe, expect, it } from "vitest";

import {
  activateCombatGenericAction,
  advanceCombatGenericActionsToRound,
  combatGenericActionSchema,
  declareCombatGenericAction,
  finishCombatGenericAction,
  projectCombatGenericActionsForPlayer,
  reviewCombatGenericAction,
  recordCombatGenericActionRoll,
  updateCombatGenericActionIntent,
  type CombatGenericAction,
  type CombatGenericActionRollRequest,
} from "./combatGenericAction";

const at = "2026-08-14T18:00:00.000Z";
const skillRoll: CombatGenericActionRollRequest = {
  basis: {
    avgStats: 14,
    baseValue: 21,
    derivedXp: 1,
    groupXp: 4,
    kind: "skill",
    skillId: "perception",
    skillLabel: "Perception",
    skillXp: 2,
    unknownSkillPenalty: 0,
  },
  difficulty: 26,
};
function declared(
  input: {
    duration?: CombatGenericAction["duration"];
    id?: string;
    preset?: CombatGenericAction["preset"];
    rollRequest?: CombatGenericActionRollRequest;
  } = {},
): CombatGenericAction[] {
  return declareCombatGenericAction({
    action: {
      createdAt: at,
      duration: input.duration ?? { kind: "round" },
      id: input.id ?? "action-1",
      intent: "Look carefully around the ruined gate.",
      ownerParticipantId: "hero",
      preset: input.preset,
      reference:
        input.preset === "environmental_movement"
          ? { description: "doorway", kind: "environment" }
          : undefined,
      rollRequest: input.rollRequest,
    },
    actions: [],
  });
}

function active(
  input: {
    duration?: CombatGenericAction["duration"];
    id?: string;
    preset?: CombatGenericAction["preset"];
    rollRequest?: CombatGenericActionRollRequest;
  } = {},
): CombatGenericAction[] {
  const actions = declared(input);
  const reviewed = reviewCombatGenericAction({
    actionId: input.id ?? "action-1",
    actions,
    duration: input.duration ?? { kind: "round" },
    reference:
      input.preset === "environmental_movement"
        ? { description: "doorway", kind: "environment" }
        : undefined,
    reviewedAt: at,
    rollRequest: input.rollRequest,
  });
  return activateCombatGenericAction({
    actionId: input.id ?? "action-1",
    activatedAt: at,
    actions: reviewed,
    roundNumber: 3,
    step: "select_actions",
  });
}

describe("generic Combat actions", () => {
  it("records Look around with canonical Perception and a visible numeric Difficulty", () => {
    const actions = declared({ preset: "look_around", rollRequest: skillRoll });
    expect(actions[0]).toMatchObject({
      awarenessContext: { kind: "survey" },
      intent: "Look carefully around the ruined gate.",
      preset: "look_around",
      rollRequest: { basis: { kind: "skill", skillId: "perception" }, difficulty: 26 },
      status: "declared",
    });
  });

  it("keeps Survey context while accepting an authoritative GM roll adjustment", () => {
    const actions = declared({ preset: "look_around", rollRequest: skillRoll });
    const reviewed = reviewCombatGenericAction({
      actionId: "action-1",
      actions,
      duration: { kind: "gm_decided" },
      reviewedAt: at,
      rollRequest: {
        basis: {
          baseValue: 14,
          kind: "stat",
          statId: "dex",
          statLabel: "Dex",
        },
        difficulty: 31,
      },
    });

    expect(reviewed[0]).toMatchObject({
      awarenessContext: { kind: "survey" },
      duration: { kind: "gm_decided" },
      preset: "look_around",
      rollRequest: { basis: { kind: "stat", statId: "dex" }, difficulty: 31 },
      status: "reviewed",
    });
  });

  it("supports a simple no-roll action and explicit GM completion", () => {
    const actions = active({ duration: { kind: "gm_decided" } });
    const finished = finishCombatGenericAction({
      actionId: "action-1",
      actions,
      at,
      resolution: {
        resolvedAt: at,
        text: "The gate is forced open.",
        visibleToParticipantIds: ["hero"],
      },
      roundNumber: 4,
      step: "select_actions",
      status: "completed",
    });
    expect(finished[0]).toMatchObject({
      resolution: { text: "The gate is forced open." },
      status: "completed",
    });
    expect(finished[0]?.rollResult).toBeUndefined();
  });

  it("updates a declared task description without replacing GM adjudication state", () => {
    const reviewed = reviewCombatGenericAction({
      actionId: "task-1",
      actions: declareCombatGenericAction({
        action: {
          createdAt: at,
          declarationKind: "perform_task",
          duration: { kind: "gm_decided" },
          id: "task-1",
          intent: "Bar the gate.",
          ownerParticipantId: "hero",
        },
        actions: [],
      }),
      duration: { kind: "rounds", rounds: 3 },
      reviewedAt: at,
      rollRequest: skillRoll,
    });
    const updated = updateCombatGenericActionIntent({
      actionId: "task-1",
      actions: reviewed,
      intent: "Bar the gate and brace it with the cart.",
      updatedAt: "2026-08-14T18:01:00.000Z",
    });

    expect(updated[0]).toMatchObject({
      declarationKind: "perform_task",
      duration: { kind: "rounds", rounds: 3 },
      id: "task-1",
      intent: "Bar the gate and brace it with the cart.",
      progress: { completedRounds: 0, totalRounds: 3 },
      rollRequest: skillRoll,
      status: "reviewed",
    });
  });

  it("progresses a fixed multi-round task once per accepted round and preserves interruption", () => {
    const actions = active({ duration: { kind: "rounds", rounds: 3 } });
    const round4 = advanceCombatGenericActionsToRound({
      actions,
      advancedAt: at,
      nextRoundNumber: 4,
    });
    const duplicate = advanceCombatGenericActionsToRound({
      actions: round4,
      advancedAt: at,
      nextRoundNumber: 4,
    });
    expect(duplicate[0]?.progress).toMatchObject({ completedRounds: 1, totalRounds: 3 });
    const interrupted = finishCombatGenericAction({
      actionId: "action-1",
      actions: duplicate,
      at,
      status: "interrupted",
    });
    expect(interrupted[0]?.status).toBe("interrupted");
  });

  it("rejects completion until fixed round and phase timing has crossed its canonical boundary", () => {
    const oneRound = active({ duration: { kind: "round" } });
    const resolution = {
      resolvedAt: at,
      text: "The task completes.",
      visibleToParticipantIds: ["hero"],
    };
    expect(() =>
      finishCombatGenericAction({
        actionId: "action-1",
        actions: oneRound,
        at,
        resolution,
        roundNumber: 3,
        status: "completed",
        step: "round_summary",
      }),
    ).toThrow("before its reviewed timing completes");

    const progressed = advanceCombatGenericActionsToRound({
      actions: oneRound,
      advancedAt: at,
      nextRoundNumber: 4,
    });
    expect(
      finishCombatGenericAction({
        actionId: "action-1",
        actions: progressed,
        at,
        resolution,
        roundNumber: 4,
        status: "completed",
        step: "select_actions",
      })[0]?.status,
    ).toBe("completed");

    const phase = active({ duration: { kind: "phase", phase: "phase1" } });
    expect(() =>
      finishCombatGenericAction({
        actionId: "action-1",
        actions: phase,
        at,
        resolution,
        roundNumber: 3,
        status: "completed",
        step: "phase_1_actions",
      }),
    ).toThrow("before its reviewed timing completes");
    expect(
      finishCombatGenericAction({
        actionId: "action-1",
        actions: phase,
        at,
        resolution,
        roundNumber: 3,
        status: "completed",
        step: "phase_1_damage",
      })[0]?.status,
    ).toBe("completed");
  });

  it("reloads multi-round environmental movement without duplicate progress or a reroll", () => {
    const actions = active({
      duration: { kind: "rounds", rounds: 3 },
      preset: "environmental_movement",
    });
    const reloaded = actions.map((action) =>
      combatGenericActionSchema.parse(JSON.parse(JSON.stringify(action))),
    );
    const round4 = advanceCombatGenericActionsToRound({
      actions: reloaded,
      advancedAt: at,
      nextRoundNumber: 4,
    });
    const duplicate = advanceCombatGenericActionsToRound({
      actions: round4,
      advancedAt: "2026-08-14T18:01:00.000Z",
      nextRoundNumber: 4,
    });

    expect(duplicate[0]).toMatchObject({
      preset: "environmental_movement",
      progress: { completedRounds: 1, totalRounds: 3 },
      reference: { description: "doorway", kind: "environment" },
      status: "active",
    });
    // The rollover never stamps the opportunity marker: stamping the round being entered closed
    // the owner's opportunity for the whole of that round and every round after it (#344).
    expect(duplicate[0]?.progress.lastProgressedRoundNumber).toBeUndefined();
    expect(duplicate[0]?.rollResult).toBeUndefined();
  });

  it("caches one server-resolved roll and retains its canonical Skill basis", () => {
    const skillActions = active({ preset: "look_around", rollRequest: skillRoll });
    const skillResult = recordCombatGenericActionRoll({
      actionId: "action-1",
      actions: skillActions,
      result: {
        achievedLevelId: "medium_plus",
        achievedLevelLabel: "Medium +",
        calculationText: "Perception 21 + roll 8 = 29 vs Difficulty 26",
        dieResult: 8,
        finalTotal: 29,
        openEndedD10s: [],
        rollD20: 8,
        rolledAt: at,
        success: true,
      },
    });
    const repeated = recordCombatGenericActionRoll({
      actionId: "action-1",
      actions: skillResult,
      result: {
        achievedLevelId: "godly",
        achievedLevelLabel: "Godly",
        calculationText: "replacement",
        dieResult: 99,
        finalTotal: 120,
        openEndedD10s: [10],
        rollD20: 20,
        rolledAt: "2026-08-14T18:01:00.000Z",
        success: true,
      },
    });

    expect(repeated[0]?.rollResult).toEqual(skillResult[0]?.rollResult);
    expect(skillResult[0]?.rollResult).toMatchObject({ finalTotal: 29, success: true });
    expect(skillResult[0]?.rollRequest?.basis).toMatchObject({
      baseValue: 21,
      kind: "skill",
      skillId: "perception",
    });
  });

  it("omits hidden references and GM-only results from unauthorized player projections", () => {
    const actions = finishCombatGenericAction({
      actionId: "action-1",
      actions: active({ duration: { kind: "gm_decided" } }),
      at,
      resolution: {
        resolvedAt: at,
        text: "A hidden watcher is behind the wall.",
        visibleToParticipantIds: [],
      },
      roundNumber: 4,
      step: "select_actions",
      status: "completed",
    }).map((action) => ({
      ...action,
      reference: { kind: "participant" as const, label: "Hidden watcher", participantId: "hidden" },
    }));

    const player = projectCombatGenericActionsForPlayer({
      actions,
      controlledParticipantIds: new Set(["hero"]),
      visibleParticipantIds: new Set(["hero"]),
    });
    const uninvolved = projectCombatGenericActionsForPlayer({
      actions,
      controlledParticipantIds: new Set(["other"]),
      visibleParticipantIds: new Set(["hero", "other"]),
    });
    const hiddenOwnerResult = projectCombatGenericActionsForPlayer({
      actions: actions.map((action) => ({
        ...action,
        ownerParticipantId: "hidden-owner",
        resolution: {
          resolvedAt: at,
          text: "You hear a sound behind the wall.",
          visibleToParticipantIds: ["other"],
        },
      })),
      controlledParticipantIds: new Set(["other"]),
      visibleParticipantIds: new Set(["other"]),
    });
    expect(player).toHaveLength(1);
    expect(player[0]?.reference).toBeUndefined();
    expect(player[0]?.resolution).toBeUndefined();
    expect(uninvolved).toEqual([]);
    expect(hiddenOwnerResult).toEqual([]);
  });

  it("projects only the receiving player's result audience and strips server actor ids", () => {
    const actions = finishCombatGenericAction({
      actionId: "action-1",
      actions: recordCombatGenericActionRoll({
        actionId: "action-1",
        actions: active({ duration: { kind: "gm_decided" }, rollRequest: skillRoll }),
        result: {
          achievedLevelId: "medium",
          achievedLevelLabel: "Medium",
          calculationText: "Perception 21 + roll 8 = 29 vs Difficulty 26",
          dieResult: 8,
          finalTotal: 29,
          openEndedD10s: [],
          rollD20: 8,
          rolledAt: at,
          rolledByUserId: "player-user-id",
          success: true,
        },
      }),
      at,
      resolution: {
        resolvedAt: at,
        resolvedByUserId: "gm-user-id",
        text: "You notice fresh tracks.",
        visibleToParticipantIds: ["hero", "hidden-recipient"],
      },
      roundNumber: 4,
      step: "select_actions",
      status: "completed",
    });

    const player = projectCombatGenericActionsForPlayer({
      actions,
      controlledParticipantIds: new Set(["hero"]),
      visibleParticipantIds: new Set(["hero"]),
    });
    expect(player[0]?.resolution).toEqual({
      resolvedAt: at,
      text: "You notice fresh tracks.",
      visibleToParticipantIds: ["hero"],
    });
    expect(player[0]?.rollResult?.rolledByUserId).toBeUndefined();
  });
});
