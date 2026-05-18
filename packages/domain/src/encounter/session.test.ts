import { describe, expect, it } from "vitest";

import type { ScenarioParticipant } from "../campaign/scenario";

import {
  encounterSessionSchema,
  buildPlayerSafeRoleplayStateForUser,
  formatEncounterParticipantMembershipLabel,
  isUserAssignedToEncounterMembership,
  resolveEncounterParticipantMembership,
  type EncounterParticipant,
  type EncounterSession,
} from "./session";

function scenarioParticipant(input: {
  controlledByUserId?: string;
  id: string;
  isActive?: boolean;
  name?: string;
}): ScenarioParticipant {
  return {
    controlledByUserId: input.controlledByUserId,
    createdAt: "2026-01-01T00:00:00.000Z",
    id: input.id,
    isActive: input.isActive ?? true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: {
      displayName: input.name ?? input.id,
    },
    sourceType: "character",
    state: {},
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as ScenarioParticipant;
}

function encounterParticipant(input: {
  id: string;
  label: string;
  scenarioParticipantId?: string;
}): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id: input.id,
    initiative: 0,
    label: input.label,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: input.scenarioParticipantId,
  };
}

function encounter(input: Partial<EncounterSession> = {}): EncounterSession {
  return encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "roleplay",
    participants: [],
    scenarioId: "scenario-1",
    status: "planned",
    title: "Market shadows",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  });
}

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

  it("falls back to active scenario participants only before explicit membership is set", () => {
    const membership = resolveEncounterParticipantMembership({
      encounter: encounter(),
      scenarioParticipants: [
        scenarioParticipant({ controlledByUserId: "player-1", id: "participant-1" }),
        scenarioParticipant({ id: "participant-2", isActive: false }),
      ],
    });

    expect(membership.source).toBe("defaultFallback");
    expect(membership.participants.map((participant) => participant.scenarioParticipantId)).toEqual([
      "participant-1",
    ]);
    expect(formatEncounterParticipantMembershipLabel({
      encounter: encounter(),
      scenarioParticipants: [scenarioParticipant({ id: "participant-1" })],
    })).toBe("1 active scenario participants (default)");
  });

  it("keeps explicit membership strict even when the explicit list is empty", () => {
    const explicitEmptyEncounter = encounter({
      participantMembershipMode: "explicit",
      participants: [],
    });
    const membership = resolveEncounterParticipantMembership({
      encounter: explicitEmptyEncounter,
      scenarioParticipants: [scenarioParticipant({ controlledByUserId: "player-1", id: "participant-1" })],
    });

    expect(membership.source).toBe("explicit");
    expect(membership.participants).toEqual([]);
    expect(isUserAssignedToEncounterMembership({
      encounter: explicitEmptyEncounter,
      scenarioParticipants: [scenarioParticipant({ controlledByUserId: "player-1", id: "participant-1" })],
      userId: "player-1",
    })).toBe(false);
    expect(formatEncounterParticipantMembershipLabel({
      encounter: explicitEmptyEncounter,
      scenarioParticipants: [scenarioParticipant({ id: "participant-1" })],
    })).toBe("0 assigned");
  });

  it("matches explicit membership by scenario participant id rather than encounter participant row id", () => {
    const playerParticipant = scenarioParticipant({
      controlledByUserId: "player-1",
      id: "scenario-participant-gladiator",
      name: "The Gladiator",
    });
    const explicitEncounter = encounter({
      participantMembershipMode: "explicit",
      participants: [
        encounterParticipant({
          id: "encounter-participant-row-gladiator",
          label: "The Gladiator",
          scenarioParticipantId: "scenario-participant-gladiator",
        }),
      ],
    });

    expect(isUserAssignedToEncounterMembership({
      encounter: explicitEncounter,
      scenarioParticipants: [playerParticipant],
      userId: "player-1",
    })).toBe(true);
  });

  it("keeps player-safe visibility and descriptions for visible encounter participants only", () => {
    const playerParticipant = scenarioParticipant({
      controlledByUserId: "player-1",
      id: "scenario-participant-gladiator",
      name: "The Gladiator",
    });
    const visibleParticipant = scenarioParticipant({
      id: "scenario-participant-guard",
      name: "City guard",
    });
    const hiddenParticipant = scenarioParticipant({
      id: "scenario-participant-spy",
      name: "Hidden spy",
    });
    const session = encounter({
      participantMembershipMode: "explicit",
      participants: [
        encounterParticipant({
          id: "scenario-scenario-participant-gladiator",
          label: "The Gladiator",
          scenarioParticipantId: "scenario-participant-gladiator",
        }),
        encounterParticipant({
          id: "scenario-scenario-participant-guard",
          label: "City guard",
          scenarioParticipantId: "scenario-participant-guard",
        }),
        encounterParticipant({
          id: "scenario-scenario-participant-spy",
          label: "Hidden spy",
          scenarioParticipantId: "scenario-participant-spy",
        }),
      ],
      roleplayState: {
        actionLog: [],
        gmMessage: "The courtyard is tense.",
        participantDescriptions: {
          "scenario-scenario-participant-guard": {
            detailedDescription: "A wary guard watches the street.",
            name: "Known guard",
            shortDescription: "Armored guard",
          },
          "scenario-scenario-participant-spy": {
            detailedDescription: "GM-only hidden identity.",
            name: "Hidden spy",
            shortDescription: "Quiet figure",
          },
        },
        pendingSkillRolls: [],
        visibility: {
          "scenario-scenario-participant-gladiator": {
            "scenario-scenario-participant-guard": true,
          },
        },
      },
    });

    const safeState = buildPlayerSafeRoleplayStateForUser({
      encounter: session,
      scenarioParticipants: [playerParticipant, visibleParticipant, hiddenParticipant],
      userId: "player-1",
    });

    expect(safeState.visibility).toEqual({
      "scenario-scenario-participant-gladiator": {
        "scenario-scenario-participant-guard": true,
      },
    });
    expect(safeState.participantDescriptions).toEqual({
      "scenario-scenario-participant-guard": {
        detailedDescription: "A wary guard watches the street.",
        name: "Known guard",
        shortDescription: "Armored guard",
      },
    });
    expect(JSON.stringify(safeState)).not.toContain("GM-only hidden identity");
  });
});
