import { describe, expect, it } from "vitest";

import {
  activateCombatGenericAction,
  advanceCombatGenericActionsToRound,
  declareCombatGenericAction,
  finishCombatGenericAction,
  projectCombatGenericActionsForPlayer,
  reviewCombatGenericAction,
  recordCombatGenericActionRoll,
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
    preset?: "look_around";
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
      rollRequest: input.rollRequest,
    },
    actions: [],
  });
}

function active(
  input: {
    duration?: CombatGenericAction["duration"];
    id?: string;
    preset?: "look_around";
    rollRequest?: CombatGenericActionRollRequest;
  } = {},
): CombatGenericAction[] {
  const actions = declared(input);
  const reviewed = reviewCombatGenericAction({
    actionId: input.id ?? "action-1",
    actions,
    duration: input.duration ?? { kind: "round" },
    reviewedAt: at,
    rollRequest: input.rollRequest,
  });
  return activateCombatGenericAction({
    actionId: input.id ?? "action-1",
    activatedAt: at,
    actions: reviewed,
    roundNumber: 3,
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
    const actions = active();
    const finished = finishCombatGenericAction({
      actionId: "action-1",
      actions,
      at,
      resolution: {
        resolvedAt: at,
        text: "The gate is forced open.",
        visibleToParticipantIds: ["hero"],
      },
      status: "completed",
    });
    expect(finished[0]).toMatchObject({
      resolution: { text: "The gate is forced open." },
      status: "completed",
    });
    expect(finished[0]?.rollResult).toBeUndefined();
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
      actions: active(),
      at,
      resolution: {
        resolvedAt: at,
        text: "A hidden watcher is behind the wall.",
        visibleToParticipantIds: [],
      },
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
        actions: active({ rollRequest: skillRoll }),
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
