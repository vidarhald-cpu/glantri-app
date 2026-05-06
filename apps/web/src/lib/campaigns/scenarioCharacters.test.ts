import { describe, expect, it } from "vitest";

import type { ScenarioParticipant } from "@glantri/domain";

import type { ServerCharacterRecord } from "../api/localServiceClient";
import {
  getAvailableScenarioCharacters,
  getScenarioCharacterDefaultControllerId,
} from "./scenarioCharacters";

function createCharacter(input: {
  id: string;
  name: string;
  ownerId?: string | null;
}): ServerCharacterRecord {
  return {
    build: {
      id: input.id,
      name: input.name,
      profile: {},
      progression: { groups: [], level: 1, skillAllocations: [], skills: [] },
    } as unknown as ServerCharacterRecord["build"],
    createdAt: "2026-04-23T00:00:00.000Z",
    id: input.id,
    level: 1,
    name: input.name,
    ownerId: input.ownerId ?? null,
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
}

function createParticipant(input: {
  characterId?: string;
  id: string;
}): ScenarioParticipant {
  return {
    createdAt: "2026-04-23T00:00:00.000Z",
    id: input.id,
    isActive: true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: { displayName: "Participant" },
    sourceType: "character",
    state: {
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationObSkill: [],
          },
        },
        engaged: false,
      },
      conditions: [],
      equipment: {},
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
    updatedAt: "2026-04-23T00:00:00.000Z",
    characterId: input.characterId,
  };
}

describe("scenarioCharacters", () => {
  it("filters out characters already participating in the scenario", () => {
    const available = getAvailableScenarioCharacters({
      characters: [
        createCharacter({ id: "char-2", name: "Brigid" }),
        createCharacter({ id: "char-1", name: "Alya" }),
      ],
      participants: [createParticipant({ characterId: "char-2", id: "participant-1" })],
    });

    expect(available.map((character) => character.id)).toEqual(["char-1"]);
  });

  it("defaults controller assignment to character owner before fallback user id", () => {
    expect(
      getScenarioCharacterDefaultControllerId({
        character: createCharacter({ id: "char-1", name: "Alya", ownerId: "user-1" }),
        fallbackUserId: "gm-1",
      }),
    ).toBe("user-1");

    expect(
      getScenarioCharacterDefaultControllerId({
        character: createCharacter({ id: "char-2", name: "Brigid", ownerId: null }),
        fallbackUserId: "gm-1",
      }),
    ).toBe("gm-1");
  });
});
