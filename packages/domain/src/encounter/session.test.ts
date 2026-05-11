import { describe, expect, it } from "vitest";

import { encounterSessionSchema } from "./session";

describe("encounter session normalization invariants", () => {
  it("normalizes older roleplay session JSON with safe defaults and legacy difficulty values", () => {
    const session = encounterSessionSchema.parse({
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "encounter-participant-1",
          label: "Quiet Scout",
          participantType: "scenario",
          scenarioParticipantId: "scenario-participant-1",
        },
      ],
      roleplayState: {
        actionLog: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            difficulty: "none",
            id: "log-1",
            participantId: "encounter-participant-1",
            silent: true,
            summary: "GM rolled Perception.",
            type: "gm_skill_roll",
          },
        ],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            difficulty: "critical_plus",
            id: "roll-1",
            participantId: "encounter-participant-1",
            silent: false,
            skillId: "perception",
            skillLabel: "Perception",
          },
        ],
      },
      status: "planned",
      title: "Market shadows",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(session.roleplayState).toMatchObject({
      gmMessage: "",
      participantDescriptions: {},
      visibility: {},
    });
    expect(session.roleplayState?.pendingSkillRolls[0]).toMatchObject({
      difficulty: "legendary",
      mode: "difficulty",
      opponentSilent: false,
      otherMod: 0,
      useDbMod: false,
      useGenMod: false,
      useObSkillMod: false,
    });
    expect(session.roleplayState?.actionLog[0]).toMatchObject({
      difficulty: undefined,
      fumble: false,
      mode: "difficulty",
      openEndedD10s: [],
      opponentFumble: false,
      opponentOpenEndedD10s: [],
      opponentSilent: false,
      partial: false,
      silent: true,
    });
  });

  it("keeps encounter participant identity separate from scenario participant identity", () => {
    const session = encounterSessionSchema.parse({
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "encounter-participant-1",
          label: "Quiet Scout",
          participantType: "scenario",
          scenarioParticipantId: "scenario-participant-1",
        },
        {
          id: "encounter-participant-2",
          label: "Gate Guard",
          participantType: "scenario",
          scenarioParticipantId: "scenario-participant-2",
        },
      ],
      roleplayState: {
        actionLog: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            id: "log-1",
            participantId: "encounter-participant-1",
            summary: "Quiet Scout tested Stealth.",
            type: "gm_skill_roll",
          },
        ],
        participantDescriptions: {
          "encounter-participant-1": {
            detailedDescription: "Keeps to the shadows.",
            name: "Cloaked figure",
            shortDescription: "A hooded traveler.",
          },
        },
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "roll-1",
            participantId: "encounter-participant-1",
            skillId: "stealth",
            skillLabel: "Stealth",
          },
        ],
        visibility: {
          "encounter-participant-1": {
            "encounter-participant-2": true,
          },
        },
      },
      status: "planned",
      title: "Market shadows",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(session.participants[0]?.id).toBe("encounter-participant-1");
    expect(session.participants[0]?.scenarioParticipantId).toBe("scenario-participant-1");
    expect(session.roleplayState?.pendingSkillRolls[0]?.participantId).toBe("encounter-participant-1");
    expect(session.roleplayState?.actionLog[0]?.participantId).toBe("encounter-participant-1");
    expect(session.roleplayState?.participantDescriptions).toHaveProperty("encounter-participant-1");
    expect(session.roleplayState?.visibility["encounter-participant-1"]?.["encounter-participant-2"]).toBe(true);
    expect(session.roleplayState?.participantDescriptions).not.toHaveProperty("scenario-participant-1");
    expect(session.roleplayState?.visibility).not.toHaveProperty("scenario-participant-1");
  });
});
