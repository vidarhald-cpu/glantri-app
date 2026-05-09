import { beforeEach, describe, expect, it } from "vitest";

import { createPrismaCharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createTestCharacter, createTestUser } from "../testing/factories";
import { CharacterEquipmentWriteService } from "./characterEquipmentWriteService";

const prisma = getTestPrismaClient();

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("CharacterEquipmentWriteService integration tests (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("CharacterEquipmentWriteService integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    it("initializes default locations and a loadout for a new character", async () => {
      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id);
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);

      const state = await service.ensureCharacterEquipmentInitialized(character.id);

      expect(state.loadouts.length).toBeGreaterThan(0);
      expect(state.loadouts[0]?.isActive).toBe(true);
      expect(state.locations.length).toBeGreaterThan(0);
    });

    it("adds an equipment item from a valid template and persists it", async () => {
      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id);
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);

      await service.ensureCharacterEquipmentInitialized(character.id);

      const state = await service.ensureCharacterEquipmentInitialized(character.id);
      const withYouLocation = state.locations.find(
        (loc) => loc.availabilityClass === "with_you" && loc.parentLocationId === null
      );
      expect(withYouLocation).toBeDefined();

      const item = await service.addCharacterEquipmentItem(character.id, {
        templateId: "weapon-template-dagger",
        quantity: 1,
        initialLocationId: withYouLocation!.id,
        initialCarryMode: "equipped"
      });

      expect(item.characterId).toBe(character.id);
      expect(item.category).toBe("weapon");
      expect(item.conditionState).toBe("intact");
    });

    it("throws when adding an item with an unknown template", async () => {
      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id);
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);

      const state = await service.ensureCharacterEquipmentInitialized(character.id);
      const location = state.locations[0]!;

      await expect(
        service.addCharacterEquipmentItem(character.id, {
          templateId: "template-does-not-exist",
          quantity: 1,
          initialLocationId: location.id,
          initialCarryMode: "stored"
        })
      ).rejects.toThrow("Equipment template not found.");
    });

    it("isolates equipment state between different characters", async () => {
      const user = await createTestUser(prisma!);
      const charA = await createTestCharacter(prisma!, user.id);
      const charB = await createTestCharacter(prisma!, user.id);
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);

      const stateA = await service.ensureCharacterEquipmentInitialized(charA.id);
      const locationA = stateA.locations.find((l) => l.availabilityClass === "with_you" && !l.parentLocationId)!;
      await service.addCharacterEquipmentItem(charA.id, {
        templateId: "weapon-template-dagger",
        quantity: 1,
        initialLocationId: locationA.id,
        initialCarryMode: "equipped"
      });

      const stateB = await service.ensureCharacterEquipmentInitialized(charB.id);

      expect(stateB.items.length).toBe(0);
    });
  });
}
