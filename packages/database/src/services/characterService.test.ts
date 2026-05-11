import { describe, expect, it } from "vitest";

import { characterBuildSchema, type CharacterBuild } from "@glantri/domain";

import type { CharacterRecord, CharacterRepository } from "../repositories/characterRepository";
import { CharacterService } from "./characterService";

const baseBuild: CharacterBuild = {
  equipment: { items: [] },
  id: "character-1",
  name: "Edited Character",
  profile: {
    description: "Test",
    distractionLevel: 3,
    id: "profile-1",
    label: "Profile",
    rolledStats: {
      cha: 10,
      com: 10,
      con: 10,
      dex: 10,
      health: 10,
      int: 12,
      lck: 9,
      pow: 15,
      siz: 10,
      str: 11,
      will: 10
    },
    societyLevel: 0
  },
  progression: {
    chargenMode: "standard",
    educationPoints: 0,
    flexiblePointFactor: 1,
    level: 2,
    primaryPoolSpent: 0,
    primaryPoolTotal: 60,
    secondaryPoolSpent: 0,
    secondaryPoolTotal: 0,
    skillGroups: [],
    skills: [],
    specializations: []
  },
  progressionState: {
    availablePoints: 0,
    checks: [],
    history: [],
    pendingAttempts: []
  },
  statModifiers: {
    str: 2
  }
};

function createRepositoryStub(existingCharacter?: CharacterRecord | null) {
  const calls = {
    saveOwned: [] as Array<{
      build: CharacterBuild;
      id: string;
      level?: number;
      name: string;
      ownerId?: string | null;
    }>
  };

  const repository: CharacterRepository = {
    findById: async (id) => (existingCharacter && existingCharacter.id === id ? existingCharacter : null),
    findOwnedById: async () => null,
    listAll: async () => (existingCharacter ? [existingCharacter] : []),
    listByOwner: async () => [],
    saveOwned: async (input) => {
      calls.saveOwned.push(input);

      return {
        build: input.build,
        createdAt: "2026-04-14T00:00:00.000Z",
        id: input.id,
        level: input.level ?? 1,
        name: input.name,
        ownerId: input.ownerId ?? null,
        updatedAt: "2026-04-14T00:00:00.000Z"
      };
    }
  };

  return { calls, repository };
}

describe("CharacterService edit persistence", () => {
  it("loads an existing character by id from the authoritative repository path", async () => {
    const existingCharacter: CharacterRecord = {
      build: baseBuild,
      createdAt: "2026-04-14T00:00:00.000Z",
      id: "character-1",
      level: 2,
      name: "Edited Character",
      ownerId: "owner-1",
      updatedAt: "2026-04-14T00:00:00.000Z"
    };
    const service = new CharacterService(createRepositoryStub(existingCharacter).repository);

    await expect(service.getCharacterById("character-1")).resolves.toEqual(existingCharacter);
  });

  it("lists all characters when no owner filter is provided", async () => {
    const existingCharacter: CharacterRecord = {
      build: baseBuild,
      createdAt: "2026-04-14T00:00:00.000Z",
      id: "character-1",
      level: 2,
      name: "Edited Character",
      owner: {
        displayName: "Player One",
        email: "player@example.com",
        id: "owner-1"
      },
      ownerId: "owner-1",
      updatedAt: "2026-04-14T00:00:00.000Z"
    };
    const service = new CharacterService(createRepositoryStub(existingCharacter).repository);

    await expect(service.listCharacters()).resolves.toEqual([existingCharacter]);
  });

  it("saves an edited character back through the database-backed path while preserving ownerId", async () => {
    const existingCharacter: CharacterRecord = {
      build: baseBuild,
      createdAt: "2026-04-14T00:00:00.000Z",
      id: "character-1",
      level: 2,
      name: "Edited Character",
      ownerId: "owner-1",
      updatedAt: "2026-04-14T00:00:00.000Z"
    };
    const { calls, repository } = createRepositoryStub(existingCharacter);
    const service = new CharacterService(repository);
    const nextBuild: CharacterBuild = {
      ...baseBuild,
      name: "Edited Character Saved",
      progression: {
        ...baseBuild.progression,
        level: 3
      }
    };
    const normalizedNextBuild = characterBuildSchema.parse(nextBuild);

    const saved = await service.saveExistingCharacter({
      build: nextBuild,
      characterId: "character-1"
    });

    expect(calls.saveOwned).toEqual([
      {
        build: normalizedNextBuild,
        id: "character-1",
        level: 3,
        name: "Edited Character Saved",
        ownerId: "owner-1"
      }
    ]);
    expect(saved).toMatchObject({
      build: normalizedNextBuild,
      id: "character-1",
      ownerId: "owner-1"
    });
  });
});
