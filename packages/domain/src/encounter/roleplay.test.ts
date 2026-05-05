import { describe, expect, it, vi } from "vitest";

import type { EncounterParticipant, EncounterSession } from "./session";
import {
  assignRoleplaySkillRoll,
  normalizeRoleplayState,
  orderRoleplayEncounterParticipants,
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
    });
    const assignedState = normalizeRoleplayState(assigned);

    expect(assignedState.pendingSkillRolls[0]).toMatchObject({
      difficulty: "hard",
      participantId: "participant-1",
      silent: true,
      skillId: "perception",
      skillLabel: "Perception",
      skillValue: 12,
    });
    expect(assignedState.actionLog[0]).toMatchObject({
      silent: true,
      type: "skill_roll_assigned",
    });

    const rolled = recordRoleplayGmSkillRoll({
      calculationText: "Roll 12; calculation pending rules.",
      difficulty: "hard",
      participantId: "participant-1",
      roll: 12,
      session: assigned,
      silent: false,
      skillId: "perception",
      skillLabel: "Perception",
    });

    expect(normalizeRoleplayState(rolled).actionLog[0]).toMatchObject({
      calculationText: "Roll 12; calculation pending rules.",
      roll: 12,
      silent: false,
      type: "gm_skill_roll",
    });
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
