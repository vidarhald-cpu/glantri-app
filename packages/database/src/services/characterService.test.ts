import { describe, expect, it } from "vitest";

import { characterBuildSchema, type CharacterBuild } from "@glantri/domain";

import type { CharacterRecord, CharacterRepository } from "../repositories/characterRepository";
import {
  CharacterMutationConflictError,
  CharacterService,
  LegacyCharacterEquipmentWriteError,
} from "./characterService";

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
      will: 10,
    },
    societyLevel: 0,
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
    specializations: [],
  },
  progressionState: {
    availablePoints: 0,
    checks: [],
    history: [],
    pendingAttempts: [],
  },
  statModifiers: {
    str: 2,
  },
};

function createRepositoryStub(existingCharacter?: CharacterRecord | null) {
  const calls = {
    createOwned: [] as Array<{
      build: CharacterBuild;
      id: string;
      level?: number;
      name: string;
      ownerId?: string | null;
    }>,
    deleteVersioned: [] as Array<{ expectedUpdatedAt: string; id: string }>,
    updateVersioned: [] as Array<{
      build: CharacterBuild;
      expectedUpdatedAt: string;
      id: string;
      level?: number;
      name: string;
      ownerId?: string | null;
    }>,
  };

  const repository: CharacterRepository = {
    createOwned: async (input) => {
      calls.createOwned.push(input);

      return {
        build: input.build,
        createdAt: "2026-04-14T00:00:00.000Z",
        id: input.id,
        level: input.level ?? 1,
        name: input.name,
        ownerId: input.ownerId ?? null,
        updatedAt: "2026-04-14T00:00:00.000Z",
      };
    },
    deleteVersioned: async (id, expectedUpdatedAt) => {
      calls.deleteVersioned.push({ expectedUpdatedAt, id });
      return existingCharacter?.id === id && existingCharacter.updatedAt === expectedUpdatedAt;
    },
    findById: async (id) =>
      existingCharacter && existingCharacter.id === id ? existingCharacter : null,
    findInGmCampaigns: async () => null,
    findOwnedById: async () => null,
    findUnderPlayerControl: async () => null,
    listAll: async () => (existingCharacter ? [existingCharacter] : []),
    listInGmCampaigns: async () => (existingCharacter ? [existingCharacter] : []),
    listByOwner: async () => [],
    updateVersioned: async (input) => {
      calls.updateVersioned.push(input);

      return {
        build: input.build,
        createdAt: "2026-04-14T00:00:00.000Z",
        id: input.id,
        level: input.level ?? 1,
        name: input.name,
        ownerId: input.ownerId ?? null,
        updatedAt: "2026-04-14T01:00:00.000Z",
      };
    },
  };

  return { calls, repository };
}

describe("CharacterService edit persistence", () => {
  it("rejects legacy CharacterBuild.equipment as current write authority", async () => {
    const existing: CharacterRecord = {
      build: baseBuild,
      createdAt: "2026-04-14T00:00:00.000Z",
      id: baseBuild.id,
      level: baseBuild.progression.level,
      name: baseBuild.name,
      ownerId: "owner-1",
      updatedAt: "2026-04-14T00:00:00.000Z",
    };
    const { calls, repository } = createRepositoryStub(existing);
    const service = new CharacterService(repository);

    await expect(
      service.saveExistingCharacter({
        build: {
          ...baseBuild,
          equipment: {
            items: [
              {
                armorValue: 0,
                equipped: false,
                id: "legacy-sword",
                itemType: "weapon",
                name: "Legacy sword",
                shieldBonus: 0,
                slot: "pack",
                weaponBonus: 0,
              },
            ],
          },
        },
        characterId: baseBuild.id,
        expectedUpdatedAt: existing.updatedAt,
      }),
    ).rejects.toBeInstanceOf(LegacyCharacterEquipmentWriteError);
    expect(calls.updateVersioned).toEqual([]);
  });
  it("loads an existing character by id from the authoritative repository path", async () => {
    const existingCharacter: CharacterRecord = {
      build: baseBuild,
      createdAt: "2026-04-14T00:00:00.000Z",
      id: "character-1",
      level: 2,
      name: "Edited Character",
      ownerId: "owner-1",
      updatedAt: "2026-04-14T00:00:00.000Z",
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
        id: "owner-1",
      },
      ownerId: "owner-1",
      updatedAt: "2026-04-14T00:00:00.000Z",
    };
    const service = new CharacterService(createRepositoryStub(existingCharacter).repository);

    await expect(service.listCharacters()).resolves.toEqual([existingCharacter]);
  });

  it("returns only owned and owning-GM campaign characters for a GM", async () => {
    const ownedCharacter: CharacterRecord = {
      build: baseBuild,
      createdAt: "2026-04-14T01:00:00.000Z",
      id: "character-1",
      level: 2,
      name: "Owned Character",
      ownerId: "gm-1",
      updatedAt: "2026-04-14T01:00:00.000Z",
    };
    const campaignCharacter: CharacterRecord = {
      ...ownedCharacter,
      build: { ...baseBuild, id: "character-2", name: "Campaign Character" },
      createdAt: "2026-04-14T00:00:00.000Z",
      id: "character-2",
      name: "Campaign Character",
      ownerId: "player-1",
    };
    const { repository } = createRepositoryStub();
    repository.listByOwner = async () => [ownedCharacter];
    repository.listInGmCampaigns = async () => [campaignCharacter, ownedCharacter];
    const service = new CharacterService(repository);

    await expect(
      service.listAccessibleCharacters({
        isAdmin: false,
        isGameMaster: true,
        userId: "gm-1",
      }),
    ).resolves.toEqual([ownedCharacter, campaignCharacter]);
  });

  it("creates a finalized character once and treats an identical retry as idempotent", async () => {
    const first = createRepositoryStub();
    const firstService = new CharacterService(first.repository);

    await firstService.saveCharacter({
      build: baseBuild,
      id: baseBuild.id,
      name: baseBuild.name,
      ownerId: "owner-1",
    });

    expect(first.calls.createOwned).toHaveLength(1);

    const existingCharacter: CharacterRecord = {
      build: characterBuildSchema.parse(baseBuild),
      createdAt: "2026-04-14T00:00:00.000Z",
      id: baseBuild.id,
      level: baseBuild.progression.level,
      name: baseBuild.name,
      ownerId: "owner-1",
      updatedAt: "2026-04-14T00:00:00.000Z",
    };
    const retry = createRepositoryStub(existingCharacter);
    const retryService = new CharacterService(retry.repository);

    await expect(
      retryService.saveCharacter({
        build: baseBuild,
        id: baseBuild.id,
        name: baseBuild.name,
        ownerId: "owner-1",
      }),
    ).resolves.toEqual(existingCharacter);
    expect(retry.calls.createOwned).toHaveLength(0);
  });

  it("saves an edited character back through the database-backed path while preserving ownerId", async () => {
    const existingCharacter: CharacterRecord = {
      build: baseBuild,
      createdAt: "2026-04-14T00:00:00.000Z",
      id: "character-1",
      level: 2,
      name: "Edited Character",
      ownerId: "owner-1",
      updatedAt: "2026-04-14T00:00:00.000Z",
    };
    const { calls, repository } = createRepositoryStub(existingCharacter);
    const service = new CharacterService(repository);
    const nextBuild: CharacterBuild = {
      ...baseBuild,
      name: "Edited Character Saved",
      progression: {
        ...baseBuild.progression,
        level: 3,
      },
    };
    const normalizedNextBuild = characterBuildSchema.parse(nextBuild);

    const saved = await service.saveExistingCharacter({
      build: nextBuild,
      characterId: "character-1",
      expectedUpdatedAt: existingCharacter.updatedAt,
    });

    expect(calls.updateVersioned).toEqual([
      {
        build: normalizedNextBuild,
        expectedUpdatedAt: existingCharacter.updatedAt,
        id: "character-1",
        level: 3,
        name: "Edited Character Saved",
        ownerId: "owner-1",
      },
    ]);
    expect(saved).toMatchObject({
      build: normalizedNextBuild,
      id: "character-1",
      ownerId: "owner-1",
    });
  });

  it("lets only a GM or admin writer change a value directly (#1068 ruling 6)", async () => {
    const existingCharacter: CharacterRecord = {
      build: baseBuild,
      createdAt: "2026-04-14T00:00:00.000Z",
      id: "character-1",
      level: 2,
      name: "Edited Character",
      ownerId: "owner-1",
      updatedAt: "2026-04-14T00:00:00.000Z",
    };
    const raised: CharacterBuild = { ...baseBuild, developedStatModifiers: { str: 2 } };

    const owner = createRepositoryStub(existingCharacter);
    const ownerSave = new CharacterService(owner.repository).saveExistingCharacter({
      build: raised,
      characterId: "character-1",
      expectedUpdatedAt: existingCharacter.updatedAt,
    });
    await expect(ownerSave).rejects.toMatchObject({
      issues: [expect.stringContaining("Only a GM or admin can change")],
    });
    expect(owner.calls.updateVersioned).toHaveLength(0);

    const gm = createRepositoryStub(existingCharacter);
    await new CharacterService(gm.repository).saveExistingCharacter({
      build: raised,
      characterId: "character-1",
      directValueEdit: true,
      expectedUpdatedAt: existingCharacter.updatedAt,
    });
    expect(gm.calls.updateVersioned[0]?.build.developedStatModifiers).toEqual({ str: 2 });
  });

  it("rejects a stale edit without invoking the repository update", async () => {
    const existingCharacter: CharacterRecord = {
      build: baseBuild,
      createdAt: "2026-04-14T00:00:00.000Z",
      id: "character-1",
      level: 2,
      name: "Edited Character",
      ownerId: "owner-1",
      updatedAt: "2026-04-14T01:00:00.000Z",
    };
    const { calls, repository } = createRepositoryStub(existingCharacter);
    const service = new CharacterService(repository);

    const rejected = service.saveExistingCharacter({
      build: { ...baseBuild, name: "Stale local edit" },
      characterId: existingCharacter.id,
      expectedUpdatedAt: "2026-04-14T00:00:00.000Z",
    });

    await expect(rejected).rejects.toBeInstanceOf(CharacterMutationConflictError);
    await expect(rejected).rejects.toMatchObject({
      code: "stale_character",
      currentCharacter: existingCharacter,
    });
    expect(calls.updateVersioned).toHaveLength(0);
  });

  it("deletes only the exact server revision", async () => {
    const existingCharacter: CharacterRecord = {
      build: baseBuild,
      createdAt: "2026-04-14T00:00:00.000Z",
      id: "character-1",
      level: 2,
      name: "Edited Character",
      ownerId: "owner-1",
      updatedAt: "2026-04-14T01:00:00.000Z",
    };
    const { calls, repository } = createRepositoryStub(existingCharacter);
    const service = new CharacterService(repository);

    await expect(
      service.deleteExistingCharacter({
        characterId: existingCharacter.id,
        expectedUpdatedAt: existingCharacter.updatedAt,
      }),
    ).resolves.toEqual(existingCharacter);
    expect(calls.deleteVersioned).toEqual([
      { expectedUpdatedAt: existingCharacter.updatedAt, id: existingCharacter.id },
    ]);
  });
});
