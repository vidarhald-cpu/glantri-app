import { describe, expect, it, vi } from "vitest";

import type { EncounterParticipant, EncounterSession } from "./session";
import {
  assignRoleplaySkillRoll,
  buildRoleplayCalculationPreview,
  normalizeRoleplayState,
  normalizeRoleplayOtherMod,
  orderRoleplayEncounterParticipants,
  rankRoleplayGmRollResults,
  recordRoleplayGmSkillRoll,
  selectAllRoleplayVisibilityForViewer,
  updateRoleplayGmMessage,
  updateRoleplayParticipantDescription,
  updateRoleplayVisibility,
} from "./roleplay";

function createSession(overrides: Partial<EncounterSession> = {}): EncounterSession {
  return {
    actionLog: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "roleplay",
    participants: [],
    status: "planned",
    title: "Market shadows",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function participant(input: Partial<EncounterParticipant> & Pick<EncounterParticipant, "id" | "label">): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    initiative: 0,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    ...input,
  };
}

describe("roleplay encounter state", () => {
  it("normalizes old encounters without roleplay state", () => {
    expect(normalizeRoleplayState(createSession())).toEqual({
      actionLog: [],
      gmMessage: "",
      participantDescriptions: {},
      pendingSkillRolls: [],
      visibility: {},
    });
  });

  it("updates GM message, visibility, row select-all, and participant descriptions", () => {
    const withMessage = updateRoleplayGmMessage({
      message: "The rain muffles every footstep.",
      session: createSession(),
    });
    expect(normalizeRoleplayState(withMessage).gmMessage).toBe("The rain muffles every footstep.");

    const withCell = updateRoleplayVisibility({
      session: withMessage,
      targetParticipantId: "target-1",
      viewerParticipantId: "viewer-1",
      visible: true,
    });
    expect(normalizeRoleplayState(withCell).visibility["viewer-1"]?.["target-1"]).toBe(true);

    const withRow = selectAllRoleplayVisibilityForViewer({
      participantIds: ["viewer-1", "target-1", "target-2"],
      session: withCell,
      viewerParticipantId: "viewer-1",
    });
    expect(normalizeRoleplayState(withRow).visibility["viewer-1"]).toEqual({
      "target-1": true,
      "target-2": true,
    });

    const withDescription = updateRoleplayParticipantDescription({
      description: {
        detailedDescription: "Recognizable court accent.",
        name: "Quiet Scholar",
        shortDescription: "Ink-stained sleeves.",
      },
      participantId: "viewer-1",
      session: withRow,
    });
    expect(normalizeRoleplayState(withDescription).participantDescriptions["viewer-1"]).toMatchObject({
      name: "Quiet Scholar",
      shortDescription: "Ink-stained sleeves.",
    });
  });

  it("stores skill roll assignments and GM rolls with silent flags", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const assigned = assignRoleplaySkillRoll({
      difficulty: "hard",
      participantId: "participant-1",
      session: createSession(),
      silent: true,
      skillId: "perception",
      skillLabel: "Perception",
      skillValue: 12,
      useDbMod: true,
      useGenMod: true,
      useObSkillMod: false,
      otherMod: -2,
    });
    const assignedState = normalizeRoleplayState(assigned);

    expect(assignedState.pendingSkillRolls[0]).toMatchObject({
      difficulty: "hard",
      otherMod: -2,
      participantId: "participant-1",
      silent: true,
      skillId: "perception",
      skillLabel: "Perception",
      skillValue: 12,
      useDbMod: true,
      useGenMod: true,
      useObSkillMod: false,
    });
    expect(assignedState.actionLog[0]).toMatchObject({
      otherMod: -2,
      silent: true,
      type: "skill_roll_assigned",
      useDbMod: true,
      useGenMod: true,
    });

    const rolled = recordRoleplayGmSkillRoll({
      calculationText: "Perception 12 + roll 12 + Other -2 = 22 · calculation pending rules.",
      difficulty: "hard",
      numericSubtotal: 22,
      otherMod: -2,
      participantId: "participant-1",
      roll: 12,
      session: assigned,
      silent: false,
      skillId: "perception",
      skillLabel: "Perception",
      useGenMod: true,
    });

    expect(normalizeRoleplayState(rolled).actionLog[0]).toMatchObject({
      calculationText: "Perception 12 + roll 12 + Other -2 = 22 · calculation pending rules.",
      numericSubtotal: 22,
      otherMod: -2,
      roll: 12,
      silent: false,
      type: "gm_skill_roll",
      useGenMod: true,
    });
  });

  it("normalizes other mods and builds honest calculation previews", () => {
    expect(normalizeRoleplayOtherMod("")).toBe(0);
    expect(normalizeRoleplayOtherMod("-2")).toBe(-2);
    expect(normalizeRoleplayOtherMod(3.8)).toBe(3);
    expect(normalizeRoleplayOtherMod("bogus")).toBe(0);

    expect(
      buildRoleplayCalculationPreview({
        difficulty: "medium",
        skillLabel: "Perception",
        skillValue: 8,
      })
    ).toMatchObject({
      calculationText: "Perception 8 + <DIE ROLL> = pending",
      difficultyText: "Difficulty: Medium · Result: calculation pending difficulty rules",
      numericSubtotal: undefined,
    });

    expect(
      buildRoleplayCalculationPreview({
        difficulty: "hard",
        otherMod: -2,
        roll: 14,
        skillLabel: "Perception",
        skillValue: 8,
      })
    ).toMatchObject({
      calculationText: "Perception 8 + roll 14 + Other -2 = 20",
      numericSubtotal: 20,
    });

    expect(
      buildRoleplayCalculationPreview({
        difficulty: "hard",
        roll: 7,
        skillLabel: "Stealth",
        skillValue: 10,
        useDbMod: true,
        useGenMod: true,
      })
    ).toMatchObject({
      calculationText: "Stealth 10 + roll 7 + Gen mod + DB mod = 17 before placeholder mods",
      hasPlaceholderMods: true,
      numericSubtotal: 17,
    });
  });

  it("ranks GM roll results by numeric subtotal", () => {
    const first = recordRoleplayGmSkillRoll({
      calculationText: "Bow 12 + roll 10 = 22",
      difficulty: "medium",
      numericSubtotal: 22,
      participantId: "participant-1",
      roll: 10,
      session: createSession(),
      silent: false,
      skillId: "bow",
      skillLabel: "Bow",
    });
    const second = recordRoleplayGmSkillRoll({
      calculationText: "Stealth 10 + roll 18 = 28",
      difficulty: "medium",
      numericSubtotal: 28,
      participantId: "participant-2",
      roll: 18,
      session: first,
      silent: true,
      skillId: "stealth",
      skillLabel: "Stealth",
    });

    expect(rankRoleplayGmRollResults(normalizeRoleplayState(second)).map((entry) => entry.skillLabel)).toEqual([
      "Stealth",
      "Bow",
    ]);
  });

  it("orders roleplay roster participants by PC, NPC, temporary/ad-hoc, then name", () => {
    const rows = orderRoleplayEncounterParticipants([
      participant({ id: "scenario-wolf", label: "Wolf", participantType: "ad-hoc" }),
      participant({ id: "scenario-b", label: "Berta", participantType: "scenario", scenarioParticipantId: "npc-2" }),
      participant({ characterId: "char-1", id: "char-1", label: "Alya", participantType: "character" }),
      participant({ id: "scenario-a", label: "Acolyte", participantType: "scenario", scenarioParticipantId: "npc-1" }),
    ]);

    expect(rows.map((row) => row.label)).toEqual(["Alya", "Acolyte", "Berta", "Wolf"]);
  });
});
