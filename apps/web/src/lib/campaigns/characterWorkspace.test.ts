import { describe, expect, it } from "vitest";

import type { EncounterSession, ScenarioParticipant } from "@glantri/domain";

import {
  buildGmCharacterWorkspaceCandidates,
  resolvePlayerCharacterWorkspaceCandidate,
} from "./characterWorkspace";

function participant(input: {
  characterId?: string;
  controlledByUserId?: string;
  displayOrder?: number;
  id: string;
  isActive?: boolean;
  name: string;
  role?: ScenarioParticipant["role"];
  scenarioId?: string;
  sourceType?: ScenarioParticipant["sourceType"];
}): ScenarioParticipant {
  return {
    characterId: input.characterId,
    controlledByUserId: input.controlledByUserId,
    createdAt: "2026-05-16T00:00:00.000Z",
    displayOrder: input.displayOrder,
    id: input.id,
    isActive: input.isActive ?? true,
    joinSource: "gm_added",
    role: input.role ?? "player_character",
    scenarioId: input.scenarioId ?? "scenario-1",
    snapshot: {
      displayName: input.name,
    },
    sourceType: input.sourceType ?? "character",
    state: {
      combat: {
        attacksThisRound: 0,
        declaredAction: undefined,
        defenseMode: "none",
        incomingAttack: undefined,
        parryAvailable: true,
        parrySource: undefined,
      },
      conditions: [],
      health: {
        bleeding: 0,
        currentHp: 10,
        dead: false,
        maxHp: 10,
        unconscious: false,
        wounds: 0,
      },
      modifiers: [],
      resources: {},
      snapshotVersion: 1,
    },
    updatedAt: "2026-05-16T00:00:00.000Z",
  };
}

function encounter(input: {
  participantIds?: string[];
  participantMembershipMode?: EncounterSession["participantMembershipMode"];
} = {}): EncounterSession {
  return {
    actionLog: [],
    campaignId: "campaign-1",
    createdAt: "2026-05-16T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "roleplay",
    participantMembershipMode: input.participantMembershipMode,
    participants: (input.participantIds ?? []).map((participantId, index) => ({
      id: `encounter-participant-${participantId}`,
      initiative: 0,
      label: participantId,
      order: index,
      participantType: "scenario",
      scenarioParticipantId: participantId,
    })),
    scenarioId: "scenario-1",
    status: "active",
    title: "Market shadows",
    turnOrderMode: "manual",
    updatedAt: "2026-05-16T00:00:00.000Z",
  };
}

describe("character workspace read model", () => {
  it("resolves the player's controlled encounter participant without exposing a selector", () => {
    const gladiator = participant({
      characterId: "character-gladiator",
      controlledByUserId: "player-1",
      id: "participant-gladiator",
      name: "The Gladiator",
    });
    const guard = participant({
      characterId: "character-guard",
      id: "participant-guard",
      name: "City guard",
      role: "npc",
    });

    const selected = resolvePlayerCharacterWorkspaceCandidate({
      activeEncounter: encounter({ participantIds: [guard.id, gladiator.id] }),
      scenarioParticipants: [guard, gladiator],
      userId: "player-1",
    });

    expect(selected?.characterId).toBe("character-gladiator");
    expect(selected?.label).toBe("The Gladiator");
  });

  it("denies player character resolution when explicit encounter membership excludes them", () => {
    const gladiator = participant({
      characterId: "character-gladiator",
      controlledByUserId: "player-1",
      id: "participant-gladiator",
      name: "The Gladiator",
    });
    const guard = participant({
      characterId: "character-guard",
      id: "participant-guard",
      name: "City guard",
      role: "npc",
    });

    const selected = resolvePlayerCharacterWorkspaceCandidate({
      activeEncounter: encounter({
        participantIds: [guard.id],
        participantMembershipMode: "explicit",
      }),
      scenarioParticipants: [guard, gladiator],
      userId: "player-1",
    });

    expect(selected).toBeUndefined();
  });

  it("builds GM inspection candidates from the encounter roster when an encounter is selected", () => {
    const scenarioParticipants = [
      participant({
        characterId: "character-gladiator",
        displayOrder: 2,
        id: "participant-gladiator",
        name: "The Gladiator",
      }),
      participant({
        characterId: "character-guard",
        displayOrder: 1,
        id: "participant-guard",
        name: "City guard",
        role: "npc",
      }),
      participant({
        characterId: "character-offscreen",
        id: "participant-offscreen",
        name: "Offscreen witness",
        role: "npc",
      }),
    ];

    const candidates = buildGmCharacterWorkspaceCandidates({
      activeEncounter: encounter({
        participantIds: ["participant-gladiator", "participant-guard"],
        participantMembershipMode: "explicit",
      }),
      scenarioParticipants,
    });

    expect(candidates.map((candidate) => candidate.label)).toEqual([
      "City guard",
      "The Gladiator",
    ]);
  });

  it("excludes active scenario participants without a reusable character sheet", () => {
    const candidates = buildGmCharacterWorkspaceCandidates({
      scenarioId: "scenario-1",
      scenarioParticipants: [
        participant({
          characterId: "character-gladiator",
          id: "participant-gladiator",
          name: "The Gladiator",
        }),
        participant({
          id: "participant-template",
          name: "Template guard",
          role: "npc",
          sourceType: "entity",
        }),
      ],
    });

    expect(candidates.map((candidate) => candidate.label)).toEqual(["The Gladiator"]);
  });
});
