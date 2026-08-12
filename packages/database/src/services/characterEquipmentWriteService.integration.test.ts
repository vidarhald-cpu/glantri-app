import { beforeEach, describe, expect, it } from "vitest";

import { createPrismaCharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createTestCampaign, createTestCharacter, createTestUser } from "../testing/factories";
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
        (loc) => loc.availabilityClass === "with_you" && loc.parentLocationId === null,
      );
      expect(withYouLocation).toBeDefined();

      const item = await service.addCharacterEquipmentItem(character.id, {
        templateId: "weapon-template-dagger",
        quantity: 1,
        initialLocationId: withYouLocation!.id,
        initialCarryMode: "equipped",
      });

      expect(item.characterId).toBe(character.id);
      expect(item.category).toBe("weapon");
      expect(item.conditionState).toBe("intact");
    });

    it("round-trips typed item facts without changing the shared template", async () => {
      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id);
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);
      const state = await service.ensureCharacterEquipmentInitialized(character.id);
      const location = state.locations.find(
        (entry) => entry.availabilityClass === "with_you" && !entry.parentLocationId,
      )!;

      const created = await service.createCharacterEquipmentItem({
        category: "weapon",
        characterId: character.id,
        conditionState: "intact",
        holderCharacterId: character.id,
        id: "item-silverston-sword",
        isStackable: false,
        itemFacts: {
          activeMechanics: [{ id: "ob", kind: "final_attack_ob_delta", value: 1 }],
          descriptiveTraits: [
            {
              category: "engraving",
              id: "arms",
              text: "Arms of House Silverston",
              visibility: "revealed",
            },
          ],
          templateOverrides: [{ id: "initiative", kind: "weapon_initiative_override", value: 1 }],
          unsupportedCapabilities: [
            {
              id: "oath",
              name: "Call the house oath",
              rulesText: "Cast X once per day",
            },
          ],
          version: 1,
        },
        material: "steel",
        quality: "extraordinary",
        quantity: 1,
        specificityType: "specific",
        storageAssignment: {
          carryMode: "on_person",
          locationId: location.id,
        },
        templateId: "weapon-template-dagger",
      });
      const reloaded = await repo.getCanonicalEquipmentItemById(created.id);

      expect(reloaded?.itemFacts).toEqual(created.itemFacts);
      expect(reloaded?.itemFacts.activeMechanics[0]).toMatchObject({
        calculationStage: "final_attack_ob",
        value: 1,
      });
      expect(reloaded?.itemFacts.unsupportedCapabilities[0]).toMatchObject({
        rulesText: "Cast X once per day",
        visibility: "gm_only",
      });
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
          initialCarryMode: "stored",
        }),
      ).rejects.toThrow("Equipment template not found.");
    });

    it("isolates equipment state between different characters", async () => {
      const user = await createTestUser(prisma!);
      const charA = await createTestCharacter(prisma!, user.id);
      const charB = await createTestCharacter(prisma!, user.id);
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);

      const stateA = await service.ensureCharacterEquipmentInitialized(charA.id);
      const locationA = stateA.locations.find(
        (l) => l.availabilityClass === "with_you" && !l.parentLocationId,
      )!;
      await service.addCharacterEquipmentItem(charA.id, {
        templateId: "weapon-template-dagger",
        quantity: 1,
        initialLocationId: locationA.id,
        initialCarryMode: "equipped",
      });

      const stateB = await service.ensureCharacterEquipmentInitialized(charB.id);

      expect(stateB.items.length).toBe(0);
    });

    it("preserves the same item when its holder Character is deleted", async () => {
      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id);
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);
      const state = await service.ensureCharacterEquipmentInitialized(character.id);
      const location = state.locations.find(
        (entry) => entry.availabilityClass === "with_you" && !entry.parentLocationId,
      )!;
      const item = await service.addCharacterEquipmentItem(character.id, {
        initialCarryMode: "on_person",
        initialLocationId: location.id,
        quantity: 1,
        templateId: "weapon-template-dagger",
      });

      await prisma!.character.delete({ where: { id: character.id } });

      const preserved = await repo.getCanonicalEquipmentItemById(item.id);
      expect(preserved).toMatchObject({
        characterId: null,
        holderCharacterId: null,
        id: item.id,
        isEquipped: false,
        storageAssignment: null,
      });
      expect(preserved?.itemFacts).toEqual(item.itemFacts);
    });

    it("preserves the same held item when its campaign context is deleted", async () => {
      const user = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, user.id);
      const campaign = await prisma!.campaign.create({
        data: {
          description: "B1 campaign context fixture",
          gmUserId: user.id,
          name: "B1 Context",
          settingsJson: {},
          slug: "b1-context",
          status: "draft",
        },
      });
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);
      const state = await service.ensureCharacterEquipmentInitialized(character.id);
      const location = state.locations.find(
        (entry) => entry.availabilityClass === "with_you" && !entry.parentLocationId,
      )!;
      const item = await service.addCharacterEquipmentItem(character.id, {
        initialCarryMode: "on_person",
        initialLocationId: location.id,
        quantity: 1,
        templateId: "weapon-template-dagger",
      });

      await prisma!.characterEquipmentItem.update({
        data: { campaignContextId: campaign.id },
        where: { id: item.id },
      });
      await prisma!.campaign.delete({ where: { id: campaign.id } });

      const preserved = await repo.getCanonicalEquipmentItemById(item.id);
      expect(preserved).toMatchObject({
        campaignContextId: null,
        holderCharacterId: character.id,
        id: item.id,
      });
    });

    it("persists campaign unassigned and assigned items through the same canonical authority", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const holder = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, holder.id);
      const campaign = await createTestCampaign(prisma!, gm.id);
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);

      const unassigned = await service.createCampaignEquipmentItem({
        campaignId: campaign.id,
        holderCharacterId: null,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        templateId: "weapon-template-dagger",
      });
      const assigned = await service.createCampaignEquipmentItem({
        campaignId: campaign.id,
        holderCharacterId: character.id,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [
            {
              category: "engraving",
              id: "hidden-engraving",
              text: "Arms of House Silverston",
              visibility: "gm_only",
            },
          ],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        templateId: "weapon-template-fencing-sword",
      });

      const campaignItems = await repo.getCampaignEquipmentItems(campaign.id);
      const holderItems = await repo.getCharacterEquipmentItems(character.id);
      expect(campaignItems).toHaveLength(2);
      expect(campaignItems.map((item) => item.id)).toEqual(
        expect.arrayContaining([unassigned.id, assigned.id]),
      );
      expect(unassigned).toMatchObject({ holderCharacterId: null, storageAssignment: null });
      expect(holderItems.map((item) => item.id)).toContain(assigned.id);
      expect(holderItems.find((item) => item.id === assigned.id)?.id).toBe(assigned.id);
    });

    it("keeps GM-authored campaign items canonical across rejected legacy writes", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const holder = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, holder.id);
      const campaign = await createTestCampaign(prisma!, gm.id);
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);
      const assigned = await service.createCampaignEquipmentItem({
        campaignId: campaign.id,
        displayName: "GM-authored sword",
        holderCharacterId: character.id,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        notes: "Canonical GM description",
        templateId: "weapon-template-rapier",
      });

      await expect(
        service.updateCharacterEquipmentMetadata(character.id, assigned.id, {
          conditionState: "damaged",
          displayName: "Holder rewrite",
          notes: "Holder notes",
        }),
      ).rejects.toThrow("Campaign item details can only be changed from Campaign Items.");
      await expect(service.removeCharacterEquipmentItem(character.id, assigned.id)).rejects.toThrow(
        "Campaign item details can only be changed from Campaign Items.",
      );

      expect(await repo.getCanonicalEquipmentItemById(assigned.id)).toMatchObject({
        conditionState: "intact",
        displayName: "GM-authored sword",
        notes: "Canonical GM description",
      });
      expect((await repo.getCampaignEquipmentItems(campaign.id)).map((item) => item.id)).toContain(
        assigned.id,
      );
    });
  });
}
