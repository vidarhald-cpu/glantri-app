import { beforeEach, describe, expect, it } from "vitest";

import { createPrismaCharacterRepository } from "../repositories/characterRepository";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createTestUser, createTestCharacter } from "../testing/factories";
import { CharacterService } from "./characterService";

const prisma = getTestPrismaClient();

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("CharacterService integration tests (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("CharacterService integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    it("creates a character and retrieves it by owner", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const user = await createTestUser(prisma!, { email: "owner@example.com" });
      const character = await createTestCharacter(prisma!, user.id, { name: "Brave Warrior" });

      const results = await service.listCharacters(user.id);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(character.id);
      expect(results[0].name).toBe("Brave Warrior");
      expect(results[0].ownerId).toBe(user.id);
    });

    it("does not return another user's character via getOwnedCharacter", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const owner = await createTestUser(prisma!, { email: "owner@example.com" });
      const other = await createTestUser(prisma!, { email: "other@example.com" });
      const character = await createTestCharacter(prisma!, owner.id);

      const result = await service.getOwnedCharacter(other.id, character.id);

      expect(result).toBeNull();
    });

    it("lists characters filtered by ownerId", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const userA = await createTestUser(prisma!, { email: "a@example.com" });
      const userB = await createTestUser(prisma!, { email: "b@example.com" });

      await createTestCharacter(prisma!, userA.id, { name: "Character A" });
      await createTestCharacter(prisma!, userB.id, { name: "Character B" });

      const forA = await service.listCharacters(userA.id);
      const forB = await service.listCharacters(userB.id);

      expect(forA).toHaveLength(1);
      expect(forA[0].name).toBe("Character A");
      expect(forB).toHaveLength(1);
      expect(forB[0].name).toBe("Character B");
    });

    it("getOwnedCharacter returns the character when the ownerId matches", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const user = await createTestUser(prisma!, { email: "owner2@example.com" });
      const character = await createTestCharacter(prisma!, user.id, { name: "My Hero" });

      const result = await service.getOwnedCharacter(user.id, character.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(character.id);
      expect(result!.ownerId).toBe(user.id);
    });

    it("getCharacterById returns the full character build with serialized fields", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id, { level: 2, name: "Serialized Hero" });

      const result = await service.getCharacterById(character.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(character.id);
      expect(result!.name).toBe("Serialized Hero");
      expect(result!.build.id).toBe(character.id);
      expect(result!.build.progression.level).toBe(2);
      expect(Array.isArray(result!.build.progression.skills)).toBe(true);
    });

    it("saveExistingCharacter returns null when the character does not exist", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id);
      const existing = await service.getCharacterById(character.id);

      const result = await service.saveExistingCharacter({
        build: existing!.build,
        characterId: "nonexistent-character-id-xyz"
      });

      expect(result).toBeNull();
    });

    it("saveExistingCharacter updates an existing character and persists the new name", async () => {
      const repository = createPrismaCharacterRepository(prisma!);
      const service = new CharacterService(repository);

      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id, { name: "Before Update" });

      const existing = await service.getCharacterById(character.id);
      expect(existing).not.toBeNull();

      const updatedBuild = { ...existing!.build, name: "After Update" };

      const result = await service.saveExistingCharacter({
        build: updatedBuild,
        characterId: character.id
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe("After Update");
      expect(result!.id).toBe(character.id);

      const refetched = await service.getCharacterById(character.id);
      expect(refetched!.name).toBe("After Update");
    });
  });
}
