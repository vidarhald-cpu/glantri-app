import { describe, expect, it } from "vitest";

import type { ScenarioParticipant } from "../campaign/scenario";

import {
  buildEncounterSessionRevision,
  buildEncounterSessionSummary,
  canTransitionEncounterStatus,
  encounterStatusSchema,
  encounterSessionSchema,
  encounterSessionSummarySchema,
  roleplayStateSchema,
  buildPlayerSafeRoleplayState,
  buildPlayerSafeRoleplayStateForUser,
  formatEncounterParticipantMembershipLabel,
  isUserAssignedToEncounterMembership,
  resolveEncounterParticipantForViewer,
  resolveEncounterParticipantMembership,
  type EncounterParticipant,
  type EncounterSession,
} from "./session";

function scenarioParticipant(input: {
  characterId?: string;
  controlledByUserId?: string;
  id: string;
  isActive?: boolean;
  name?: string;
}): ScenarioParticipant {
  return {
    controlledByUserId: input.controlledByUserId,
    characterId: input.characterId,
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
  characterId?: string;
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
    characterId: input.characterId,
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
    status: "draft",
    title: "Market shadows",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  });
}

describe("encounter session normalization invariants", () => {
  it("normalizes legacy statuses and enforces the common lifecycle", () => {
    expect(encounterStatusSchema.parse("setup")).toBe("draft");
    expect(encounterStatusSchema.parse("planned")).toBe("draft");
    expect(encounterStatusSchema.parse("complete")).toBe("completed");
    expect(canTransitionEncounterStatus("draft", "active")).toBe(true);
    expect(canTransitionEncounterStatus("draft", "archived")).toBe(true);
    expect(canTransitionEncounterStatus("active", "paused")).toBe(true);
    expect(canTransitionEncounterStatus("paused", "active")).toBe(true);
    expect(canTransitionEncounterStatus("paused", "completed")).toBe(true);
    expect(canTransitionEncounterStatus("completed", "archived")).toBe(true);
    expect(canTransitionEncounterStatus("active", "completed")).toBe(false);
    expect(canTransitionEncounterStatus("archived", "active")).toBe(false);
  });

  it("projects strict compact summary and revision contracts without session history", () => {
    const fullEncounter = encounter({
      campaignId: "campaign-1",
      description: "Private encounter detail",
      participants: [
        encounterParticipant({
          id: "participant-1",
          label: "The Gladiator",
          scenarioParticipantId: "scenario-participant-1",
        }),
      ],
      status: "active",
    });
    const summary = buildEncounterSessionSummary(fullEncounter, {
      viewerAssigned: true,
    });

    expect(summary).toEqual({
      campaignId: "campaign-1",
      createdAt: fullEncounter.createdAt,
      id: fullEncounter.id,
      scenarioId: "scenario-1",
      status: "active",
      title: "Market shadows",
      updatedAt: fullEncounter.updatedAt,
      viewerAssigned: true,
    });
    expect(summary).not.toHaveProperty("actionLog");
    expect(summary).not.toHaveProperty("combatRoundState");
    expect(summary).not.toHaveProperty("participants");
    expect(
      encounterSessionSummarySchema.safeParse({
        ...summary,
        commands: [],
      }).success,
    ).toBe(false);
    expect(buildEncounterSessionRevision(summary)).toEqual({
      encounterId: fullEncounter.id,
      revision: fullEncounter.updatedAt,
      status: "active",
      updatedAt: fullEncounter.updatedAt,
    });
  });

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
      status: "draft",
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
      status: "draft",
      title: "Market shadows",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(session.participants[0]?.id).toBe("encounter-participant-1");
    expect(session.participants[0]?.scenarioParticipantId).toBe("scenario-participant-1");
    expect(session.roleplayState?.pendingSkillRolls[0]?.participantId).toBe(
      "encounter-participant-1",
    );
    expect(session.roleplayState?.actionLog[0]?.participantId).toBe("encounter-participant-1");
    expect(session.roleplayState?.participantDescriptions).toHaveProperty(
      "encounter-participant-1",
    );
    expect(
      session.roleplayState?.visibility["encounter-participant-1"]?.["encounter-participant-2"],
    ).toBe(true);
    expect(session.roleplayState?.participantDescriptions).not.toHaveProperty(
      "scenario-participant-1",
    );
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
    expect(membership.participants.map((participant) => participant.scenarioParticipantId)).toEqual(
      ["participant-1"],
    );
    expect(
      formatEncounterParticipantMembershipLabel({
        encounter: encounter(),
        scenarioParticipants: [scenarioParticipant({ id: "participant-1" })],
      }),
    ).toBe("1 active scenario participants (default)");
  });

  it("keeps explicit membership strict even when the explicit list is empty", () => {
    const explicitEmptyEncounter = encounter({
      participantMembershipMode: "explicit",
      participants: [],
    });
    const membership = resolveEncounterParticipantMembership({
      encounter: explicitEmptyEncounter,
      scenarioParticipants: [
        scenarioParticipant({ controlledByUserId: "player-1", id: "participant-1" }),
      ],
    });

    expect(membership.source).toBe("explicit");
    expect(membership.participants).toEqual([]);
    expect(
      isUserAssignedToEncounterMembership({
        encounter: explicitEmptyEncounter,
        scenarioParticipants: [
          scenarioParticipant({ controlledByUserId: "player-1", id: "participant-1" }),
        ],
        userId: "player-1",
      }),
    ).toBe(false);
    expect(
      formatEncounterParticipantMembershipLabel({
        encounter: explicitEmptyEncounter,
        scenarioParticipants: [scenarioParticipant({ id: "participant-1" })],
      }),
    ).toBe("0 assigned");
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

    expect(
      isUserAssignedToEncounterMembership({
        encounter: explicitEncounter,
        scenarioParticipants: [playerParticipant],
        userId: "player-1",
      }),
    ).toBe(true);
  });

  it("resolves explicit and implicit viewer membership to one canonical participant identity", () => {
    const playerParticipant = scenarioParticipant({
      characterId: "character-gladiator",
      controlledByUserId: "player-1",
      id: "scenario-participant-gladiator",
    });
    const explicitEncounter = encounter({
      participantMembershipMode: "explicit",
      participants: [
        encounterParticipant({
          characterId: "character-gladiator",
          id: "encounter-participant-gladiator",
          label: "The Gladiator",
          scenarioParticipantId: "scenario-participant-gladiator",
        }),
      ],
    });

    expect(
      resolveEncounterParticipantForViewer({
        encounter: explicitEncounter,
        requestedParticipantId: "character-gladiator",
        scenarioParticipants: [playerParticipant],
        viewer: { kind: "player", userId: "player-1" },
      }),
    ).toMatchObject({
      access: "player_controlled",
      encounterParticipantId: "encounter-participant-gladiator",
      membershipSource: "explicit",
      scenarioParticipantId: "scenario-participant-gladiator",
    });
    expect(
      resolveEncounterParticipantForViewer({
        encounter: encounter(),
        requestedParticipantId: "scenario-participant-gladiator",
        scenarioParticipants: [playerParticipant],
        viewer: { kind: "player", userId: "player-1" },
      }),
    ).toMatchObject({
      encounterParticipantId: "scenario-fallback-scenario-participant-gladiator",
      membershipSource: "defaultFallback",
    });
  });

  it("rejects inactive, unrelated and ambiguous viewer participant aliases", () => {
    const playerParticipant = scenarioParticipant({
      characterId: "shared-character",
      controlledByUserId: "player-1",
      id: "participant-1",
    });
    const unrelatedParticipant = scenarioParticipant({
      characterId: "other-character",
      controlledByUserId: "player-2",
      id: "participant-2",
    });

    expect(
      resolveEncounterParticipantForViewer({
        encounter: encounter(),
        requestedParticipantId: playerParticipant.id,
        scenarioParticipants: [playerParticipant],
        viewer: { kind: "player", userId: "player-2" },
      }),
    ).toBeUndefined();
    expect(
      resolveEncounterParticipantForViewer({
        encounter: encounter(),
        requestedParticipantId: "inactive",
        scenarioParticipants: [scenarioParticipant({ id: "inactive", isActive: false })],
        viewer: { kind: "player", userId: "player-1" },
      }),
    ).toBeUndefined();
    expect(
      resolveEncounterParticipantForViewer({
        characterId: "shared-character",
        encounter: encounter(),
        scenarioParticipants: [
          playerParticipant,
          scenarioParticipant({
            characterId: "shared-character",
            controlledByUserId: "player-1",
            id: "participant-duplicate",
          }),
          unrelatedParticipant,
        ],
        viewer: { kind: "player", userId: "player-1" },
      }),
    ).toBeUndefined();
  });

  it("resolves two player viewers independently without crossing participant ownership", () => {
    const first = scenarioParticipant({ controlledByUserId: "player-1", id: "participant-1" });
    const second = scenarioParticipant({ controlledByUserId: "player-2", id: "participant-2" });
    const explicitEncounter = encounter({
      participantMembershipMode: "explicit",
      participants: [
        encounterParticipant({
          id: "encounter-participant-1",
          label: "First",
          scenarioParticipantId: first.id,
        }),
        encounterParticipant({
          id: "encounter-participant-2",
          label: "Second",
          scenarioParticipantId: second.id,
        }),
      ],
    });
    const scenarioParticipants = [first, second];

    expect(
      resolveEncounterParticipantForViewer({
        encounter: explicitEncounter,
        requestedParticipantId: first.id,
        scenarioParticipants,
        viewer: { kind: "player", userId: "player-1" },
      })?.encounterParticipantId,
    ).toBe("encounter-participant-1");
    expect(
      resolveEncounterParticipantForViewer({
        encounter: explicitEncounter,
        requestedParticipantId: second.id,
        scenarioParticipants,
        viewer: { kind: "player", userId: "player-2" },
      })?.encounterParticipantId,
    ).toBe("encounter-participant-2");
    expect(
      resolveEncounterParticipantForViewer({
        encounter: explicitEncounter,
        requestedParticipantId: second.id,
        scenarioParticipants,
        viewer: { kind: "player", userId: "player-1" },
      }),
    ).toBeUndefined();
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
      roleplayState: roleplayStateSchema.parse({
        actionLog: [
          {
            autoSuccess: false,
            createdAt: "2026-01-01T00:04:00.000Z",
            fumble: false,
            id: "own-stat-result",
            mode: "difficulty",
            openEndedD10s: [],
            opponentFumble: false,
            opponentOpenEndedD10s: [],
            opponentSilent: false,
            partial: false,
            participantId: "scenario-scenario-participant-gladiator",
            pendingRollId: "own-stat-check",
            statId: "dex",
            statLabel: "Dex",
            statValue: 14,
            silent: false,
            summary: "The Gladiator rolled Dex Stat check.",
            supportOpenEndedD10s: [],
            type: "stat_check_result",
          },
          {
            autoSuccess: false,
            createdAt: "2026-01-01T00:03:00.000Z",
            fumble: false,
            id: "guard-stat-result",
            mode: "difficulty",
            openEndedD10s: [],
            opponentFumble: false,
            opponentOpenEndedD10s: [],
            opponentSilent: false,
            partial: false,
            participantId: "scenario-scenario-participant-guard",
            pendingRollId: "guard-stat-check",
            statId: "will",
            statLabel: "Will",
            statValue: 18,
            silent: false,
            summary: "City guard rolled Will Stat check.",
            supportOpenEndedD10s: [],
            type: "stat_check_result",
          },
        ],
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
        pendingStatChecks: [
          {
            assignedAt: "2026-01-01T00:02:00.000Z",
            difficulty: "medium",
            id: "own-stat-check",
            participantId: "scenario-scenario-participant-gladiator",
            statId: "dex",
            statLabel: "Dex",
            statValue: 14,
          },
          {
            assignedAt: "2026-01-01T00:01:00.000Z",
            difficulty: "hard",
            id: "guard-stat-check",
            participantId: "scenario-scenario-participant-guard",
            statId: "will",
            statLabel: "Will",
            statValue: 18,
          },
        ],
        visibility: {
          "scenario-scenario-participant-gladiator": {
            "scenario-scenario-participant-guard": true,
          },
        },
      }),
    });

    const safeState = buildPlayerSafeRoleplayStateForUser({
      encounter: session,
      scenarioParticipants: [playerParticipant, visibleParticipant, hiddenParticipant],
      userId: "player-1",
    });
    const identityFreeSafeState = buildPlayerSafeRoleplayState(session.roleplayState!);

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
    expect(safeState.pendingStatChecks.map((check) => check.id)).toEqual(["own-stat-check"]);
    expect(safeState.actionLog.map((entry) => entry.id)).toEqual(["own-stat-result"]);
    expect(identityFreeSafeState.pendingStatChecks).toEqual([]);
    expect(identityFreeSafeState.actionLog).toEqual([]);
    expect(JSON.stringify(safeState)).not.toContain("GM-only hidden identity");
    expect(JSON.stringify(safeState)).not.toContain("guard-stat-check");
  });

  it("projects Skill rolls by owner, public rank visibility, and uninvolved perspective", () => {
    const ownerParticipant = scenarioParticipant({
      controlledByUserId: "player-owner",
      id: "scenario-owner",
      name: "Owner hero",
    });
    const otherParticipant = scenarioParticipant({
      controlledByUserId: "player-other",
      id: "scenario-other",
      name: "Other hero",
    });
    const observerParticipant = scenarioParticipant({
      controlledByUserId: "player-observer",
      id: "scenario-observer",
      name: "Observer hero",
    });
    const scenarioParticipants = [ownerParticipant, otherParticipant, observerParticipant];
    const session = encounter({
      participantMembershipMode: "explicit",
      participants: [
        encounterParticipant({
          id: "encounter-owner",
          label: "Owner hero",
          scenarioParticipantId: ownerParticipant.id,
        }),
        encounterParticipant({
          id: "encounter-other",
          label: "Other hero",
          scenarioParticipantId: otherParticipant.id,
        }),
        encounterParticipant({
          id: "encounter-observer",
          label: "Observer hero",
          scenarioParticipantId: observerParticipant.id,
        }),
      ],
      roleplayState: roleplayStateSchema.parse({
        actionLog: [
          {
            calculationText: "owner-private-calculation",
            createdAt: "2026-01-01T00:12:00.000Z",
            dieResult: 18,
            id: "owner-current-result",
            numericSubtotal: 42,
            otherMod: 9,
            participantId: "encounter-owner",
            pendingRollId: "owner-private-pending",
            rollD20: 18,
            rollSetId: "private-current-stack",
            skillId: "perception",
            skillLabel: "Perception",
            skillValue: 15,
            summary: "Owner hero rolled Perception.",
            type: "gm_skill_roll",
          },
          {
            calculationText: "other-private-calculation",
            createdAt: "2026-01-01T00:11:00.000Z",
            dieResult: 17,
            id: "other-current-result",
            numericSubtotal: 35,
            otherMod: 7,
            participantId: "encounter-other",
            pendingRollId: "other-private-pending",
            rollD20: 17,
            rollSetId: "private-current-stack",
            skillId: "tracking",
            skillLabel: "Tracking",
            skillValue: 11,
            summary: "Other hero rolled Tracking.",
            type: "gm_skill_roll",
          },
          {
            createdAt: "2026-01-01T00:10:00.000Z",
            id: "other-private-assignment",
            participantId: "encounter-other",
            pendingRollId: "other-private-pending",
            rollSetId: "private-current-stack",
            skillId: "tracking",
            skillLabel: "Tracking",
            summary: "Assigned Tracking roll.",
            type: "skill_roll_assigned",
          },
          {
            calculationText: "historical-private-calculation",
            createdAt: "2026-01-01T00:09:00.000Z",
            dieResult: 20,
            id: "other-historical-result",
            numericSubtotal: 99,
            participantId: "encounter-other",
            rollSetId: "private-historical-stack",
            skillId: "stealth",
            skillLabel: "Stealth",
            summary: "Other hero rolled Stealth.",
            type: "gm_skill_roll",
          },
          {
            calculationText: "opposed-private-calculation",
            createdAt: "2026-01-01T00:08:00.000Z",
            dieResult: 16,
            id: "other-opposed-result",
            mode: "opposed",
            numericSubtotal: 51,
            participantId: "encounter-other",
            rollSetId: "private-opposed-stack",
            side: "actor",
            skillId: "dodge",
            skillLabel: "Dodge",
            summary: "Other hero rolled Dodge.",
            type: "gm_skill_roll",
          },
          {
            calculationText: "silent-private-calculation",
            createdAt: "2026-01-01T00:07:00.000Z",
            dieResult: 19,
            id: "other-silent-result",
            numericSubtotal: 88,
            participantId: "encounter-other",
            rollSetId: "private-current-stack",
            silent: true,
            skillId: "listen",
            skillLabel: "Listen",
            summary: "Other hero silently rolled Listen.",
            type: "gm_skill_roll",
          },
          {
            createdAt: "2026-01-01T00:06:00.000Z",
            id: "owner-stat-result",
            participantId: "encounter-owner",
            pendingRollId: "owner-stat-check",
            statId: "dex",
            statLabel: "Dex",
            statValue: 14,
            summary: "Owner hero rolled Dex Stat check.",
            type: "stat_check_result",
          },
          {
            createdAt: "2026-01-01T00:05:00.000Z",
            id: "other-stat-result",
            participantId: "encounter-other",
            pendingRollId: "other-stat-check",
            statId: "will",
            statLabel: "Will",
            statValue: 18,
            summary: "Other hero rolled Will Stat check.",
            type: "stat_check_result",
          },
        ],
        currentRankedRollStackId: "private-current-stack",
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:04:00.000Z",
            id: "owner-private-pending",
            otherMod: 9,
            participantId: "encounter-owner",
            rollSetId: "private-current-stack",
            skillId: "perception",
            skillLabel: "Perception",
            skillValue: 15,
          },
          {
            assignedAt: "2026-01-01T00:03:00.000Z",
            id: "other-private-pending",
            otherMod: 7,
            participantId: "encounter-other",
            rollSetId: "private-current-stack",
            skillId: "tracking",
            skillLabel: "Tracking",
            skillValue: 11,
          },
          {
            assignedAt: "2026-01-01T00:02:00.000Z",
            id: "owner-silent-pending",
            participantId: "encounter-owner",
            rollSetId: "private-current-stack",
            silent: true,
            skillId: "stealth",
            skillLabel: "Stealth",
          },
        ],
        pendingStatChecks: [
          {
            assignedAt: "2026-01-01T00:01:00.000Z",
            difficulty: "medium",
            id: "owner-stat-check",
            participantId: "encounter-owner",
            statId: "dex",
            statLabel: "Dex",
            statValue: 14,
          },
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            difficulty: "hard",
            id: "other-stat-check",
            participantId: "encounter-other",
            statId: "will",
            statLabel: "Will",
            statValue: 18,
          },
        ],
        visibility: {
          "encounter-other": { "encounter-owner": true },
          "encounter-owner": { "encounter-other": true },
        },
      }),
    });

    const project = (userId: string) =>
      buildPlayerSafeRoleplayStateForUser({ encounter: session, scenarioParticipants, userId });
    const owner = project("player-owner");
    const other = project("player-other");
    const observer = project("player-observer");
    const ownerPublicOtherResult = owner.actionLog.find(
      (entry) => entry.id === "other-current-result",
    );
    const otherPublicOwnerResult = other.actionLog.find(
      (entry) => entry.id === "owner-current-result",
    );

    expect(owner.pendingSkillRolls.map((roll) => roll.id)).toEqual(["owner-private-pending"]);
    expect(owner.pendingStatChecks.map((check) => check.id)).toEqual(["owner-stat-check"]);
    expect(owner.actionLog.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["owner-current-result", "owner-stat-result", "other-current-result"]),
    );
    expect(owner.actionLog.map((entry) => entry.id)).not.toEqual(
      expect.arrayContaining([
        "other-private-assignment",
        "other-historical-result",
        "other-opposed-result",
        "other-silent-result",
        "other-stat-result",
      ]),
    );
    expect(owner.actionLog.find((entry) => entry.id === "owner-current-result")).toMatchObject({
      calculationText: "owner-private-calculation",
      dieResult: 18,
      pendingRollId: "owner-private-pending",
    });
    expect(ownerPublicOtherResult).toMatchObject({
      numericSubtotal: 35,
      participantId: "encounter-other",
      skillId: "tracking",
      skillLabel: "Tracking",
      summary: "Public Skill result.",
    });
    expect(ownerPublicOtherResult).not.toHaveProperty("calculationText");
    expect(ownerPublicOtherResult).not.toHaveProperty("dieResult");
    expect(ownerPublicOtherResult).not.toHaveProperty("otherMod");
    expect(ownerPublicOtherResult).not.toHaveProperty("pendingRollId");
    expect(ownerPublicOtherResult).not.toHaveProperty("skillValue");

    expect(other.pendingSkillRolls.map((roll) => roll.id)).toEqual(["other-private-pending"]);
    expect(otherPublicOwnerResult).toMatchObject({
      numericSubtotal: 42,
      participantId: "encounter-owner",
      skillLabel: "Perception",
      summary: "Public Skill result.",
    });
    expect(otherPublicOwnerResult).not.toHaveProperty("calculationText");
    expect(otherPublicOwnerResult).not.toHaveProperty("dieResult");
    expect(otherPublicOwnerResult).not.toHaveProperty("pendingRollId");

    expect(observer.pendingSkillRolls).toEqual([]);
    expect(observer.pendingStatChecks).toEqual([]);
    expect(observer.actionLog).toEqual([]);
    expect(observer.currentRankedRollStackId).toBe("player-safe-empty-ranked-roll-stack");
    expect(JSON.stringify(observer)).not.toContain("private-current-stack");
    expect(JSON.stringify(observer)).not.toContain("private-pending");
    expect(JSON.stringify(observer)).not.toContain("private-calculation");
    expect(JSON.stringify(observer)).not.toContain("other-current-result");

    expect(project("player-owner")).toEqual(owner);
    expect(project("player-other")).toEqual(other);
    expect(project("player-observer")).toEqual(observer);
    const staleRestrictedSession = encounter({
      ...session,
      roleplayState: roleplayStateSchema.parse({
        actionLog: [
          {
            calculationText: "stale-legacy-opposed-calculation",
            createdAt: "2025-12-31T23:59:30.000Z",
            dieResult: 19,
            id: "stale-legacy-opposed-result",
            numericSubtotal: 81,
            participantId: "encounter-other",
            rollSetId: "stale-private-stack",
            skillId: "stealth",
            skillLabel: "Stealth",
            summary: "Legacy opposed result.",
            type: "gm_skill_roll",
          },
          {
            calculationText: "stale-private-calculation",
            createdAt: "2025-12-31T23:59:00.000Z",
            dieResult: 20,
            id: "stale-private-result",
            mode: "opposed",
            numericSubtotal: 77,
            participantId: "encounter-other",
            rollSetId: "stale-private-stack",
            side: "actor",
            skillId: "stealth",
            skillLabel: "Stealth",
            summary: "Other hero rolled Stealth.",
            type: "gm_skill_roll",
          },
        ],
        currentRankedRollStackId: "stale-private-stack",
        pendingSkillRolls: [
          {
            assignedAt: "2025-12-31T23:58:00.000Z",
            id: "stale-private-pending",
            participantId: "encounter-other",
            rollSetId: "stale-private-stack",
            skillId: "stealth",
            skillLabel: "Stealth",
          },
        ],
        visibility: session.roleplayState?.visibility,
      }),
      updatedAt: "2025-12-31T23:59:00.000Z",
    });
    const staleOwner = buildPlayerSafeRoleplayStateForUser({
      encounter: staleRestrictedSession,
      scenarioParticipants,
      userId: "player-owner",
    });
    expect(staleOwner.actionLog).toEqual([]);
    expect(staleOwner.pendingSkillRolls).toEqual([]);
    expect(staleOwner.currentRankedRollStackId).toBe("player-safe-empty-ranked-roll-stack");
    expect(JSON.stringify(staleOwner)).not.toContain("stale-private");
    expect(buildPlayerSafeRoleplayState(session.roleplayState!)).toMatchObject({
      actionLog: [],
      currentRankedRollStackId: "player-safe-empty-ranked-roll-stack",
      pendingSkillRolls: [],
      pendingStatChecks: [],
    });
  });
});
