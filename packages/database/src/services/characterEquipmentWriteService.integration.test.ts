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

    it("transfers one canonical item atomically and clears every source loadout reference", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const sourceUser = await createTestUser(prisma!);
      const targetUser = await createTestUser(prisma!);
      const source = await createTestCharacter(prisma!, sourceUser.id);
      const target = await createTestCharacter(prisma!, targetUser.id);
      const campaign = await createTestCampaign(prisma!, gm.id);
      await prisma!.campaignRosterEntry.createMany({
        data: [source, target].map((character) => ({
          campaignId: campaign.id,
          category: "pc" as const,
          createdByUserId: gm.id,
          sourceId: character.id,
          sourceType: "character" as const,
        })),
      });

      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);
      await service.ensureCharacterEquipmentInitialized(source.id);
      expect(await repo.getCharacterStorageLocations(target.id)).toHaveLength(0);
      const item = await service.createCampaignEquipmentItem({
        campaignId: campaign.id,
        displayName: "Silverston",
        holderCharacterId: source.id,
        itemFacts: {
          activeMechanics: [
            {
              calculationStage: "final_attack_ob",
              id: "ob",
              kind: "final_attack_ob_delta",
              scope: "all_attack_modes",
              unit: "ob_points",
              value: 1,
              visibility: "gm_only",
            },
          ],
          descriptiveTraits: [
            {
              category: "engraving",
              id: "arms",
              text: "Arms of House Silverston",
              visibility: "revealed",
            },
          ],
          templateOverrides: [
            {
              id: "initiative",
              kind: "weapon_initiative_override",
              scope: "all_attack_modes",
              unit: "initiative_points",
              value: 1,
              visibility: "revealed",
            },
          ],
          unsupportedCapabilities: [
            {
              id: "oath",
              name: "House oath",
              rulesText: "Cast a guiding light once per day.",
              visibility: "gm_only",
            },
          ],
          version: 1,
        },
        notes: "Carried through the northern pass.",
        templateId: "weapon-template-rapier",
      });
      const factsBefore = item.itemFacts;
      const sourceLoadout = (await repo.getCharacterLoadouts(source.id))[0]!;
      await prisma!.characterEquipmentItem.update({
        data: {
          carryMode: "equipped",
          isEquipped: true,
          locationId: `${source.id}:loc-equipped`,
          previousCarryMode: "on_person",
          previousLocationId: `${source.id}:loc-person`,
        },
        where: { id: item.id },
      });
      await prisma!.characterLoadout.update({
        data: {
          activeAmmoItemIds: [item.id, item.id],
          activeMissileWeaponItemId: item.id,
          activePrimaryWeaponItemId: item.id,
          activeSecondaryWeaponItemId: item.id,
          quickAccessItemIdsJson: [item.id, item.id],
          readyShieldItemId: item.id,
          wornArmorItemId: item.id,
        },
        where: { id: sourceLoadout.id },
      });

      const transferred = await service.transferCampaignEquipmentItem({
        campaignId: campaign.id,
        itemId: item.id,
        sourceCharacterId: source.id,
        targetCharacterId: target.id,
      });

      expect(transferred).toMatchObject({
        campaignContextId: campaign.id,
        displayName: "Silverston",
        holderCharacterId: target.id,
        id: item.id,
        isEquipped: false,
        notes: "Carried through the northern pass.",
        previousStorageAssignment: null,
        storageAssignment: {
          carryMode: "on_person",
          locationId: `${target.id}:loc-person`,
        },
        templateId: "weapon-template-rapier",
      });
      expect(transferred.itemFacts).toEqual(factsBefore);
      expect(await repo.getCharacterStorageLocations(target.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: `${target.id}:loc-person`, type: "person_system" }),
        ]),
      );
      expect(await prisma!.characterEquipmentItem.count({ where: { id: item.id } })).toBe(1);
      expect(await repo.getCharacterEquipmentItems(source.id)).toHaveLength(0);
      expect((await repo.getCharacterEquipmentItems(target.id)).map((entry) => entry.id)).toEqual([
        item.id,
      ]);
      expect((await repo.getCharacterLoadouts(source.id))[0]).toMatchObject({
        activeAmmoItemIds: [],
        activeMissileWeaponItemId: null,
        activePrimaryWeaponItemId: null,
        activeSecondaryWeaponItemId: null,
        quickAccessItemIds: [],
        readyShieldItemId: null,
        wornArmorItemId: null,
      });
      await expect(
        repo.upsertCharacterLoadout({
          ...(await repo.getCharacterLoadouts(source.id))[0]!,
          activePrimaryWeaponItemId: item.id,
        }),
      ).rejects.toThrow("no longer held by this Character");
    });

    it("rolls back invalid and cross-campaign targets without changing the source", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const sourceUser = await createTestUser(prisma!);
      const targetUser = await createTestUser(prisma!);
      const outsiderUser = await createTestUser(prisma!);
      const source = await createTestCharacter(prisma!, sourceUser.id);
      const target = await createTestCharacter(prisma!, targetUser.id);
      const outsider = await createTestCharacter(prisma!, outsiderUser.id);
      const campaign = await createTestCampaign(prisma!, gm.id);
      await prisma!.campaignRosterEntry.createMany({
        data: [source, target].map((character) => ({
          campaignId: campaign.id,
          category: "pc" as const,
          createdByUserId: gm.id,
          sourceId: character.id,
          sourceType: "character" as const,
        })),
      });
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);
      await service.ensureCharacterEquipmentInitialized(source.id);
      await service.ensureCharacterEquipmentInitialized(target.id);
      await service.ensureCharacterEquipmentInitialized(outsider.id);
      const item = await service.createCampaignEquipmentItem({
        campaignId: campaign.id,
        holderCharacterId: source.id,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        templateId: "weapon-template-dagger",
      });
      const before = await repo.getCanonicalEquipmentItemById(item.id);

      await expect(
        service.transferCampaignEquipmentItem({
          campaignId: campaign.id,
          itemId: item.id,
          sourceCharacterId: source.id,
          targetCharacterId: target.id,
          targetStorageLocationId: `${source.id}:loc-person`,
        }),
      ).rejects.toThrow("no valid storage");
      await expect(
        service.transferCampaignEquipmentItem({
          campaignId: campaign.id,
          itemId: item.id,
          sourceCharacterId: source.id,
          targetCharacterId: outsider.id,
        }),
      ).rejects.toThrow("campaign roster");

      expect(await repo.getCanonicalEquipmentItemById(item.id)).toEqual(before);
      expect(await prisma!.characterEquipmentItem.count({ where: { id: item.id } })).toBe(1);
    });

    it("rejects a stale double transfer without duplicating or partially moving the item", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const sourceUser = await createTestUser(prisma!);
      const targetUser = await createTestUser(prisma!);
      const source = await createTestCharacter(prisma!, sourceUser.id);
      const target = await createTestCharacter(prisma!, targetUser.id);
      const campaign = await createTestCampaign(prisma!, gm.id);
      await prisma!.campaignRosterEntry.createMany({
        data: [source, target].map((character) => ({
          campaignId: campaign.id,
          category: "pc" as const,
          sourceId: character.id,
          sourceType: "character" as const,
        })),
      });
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);
      await service.ensureCharacterEquipmentInitialized(source.id);
      await service.ensureCharacterEquipmentInitialized(target.id);
      const item = await service.createCampaignEquipmentItem({
        campaignId: campaign.id,
        holderCharacterId: source.id,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        templateId: "weapon-template-dagger",
      });
      const transfer = {
        campaignId: campaign.id,
        itemId: item.id,
        sourceCharacterId: source.id,
        targetCharacterId: target.id,
      };

      await service.transferCampaignEquipmentItem(transfer);
      await expect(service.transferCampaignEquipmentItem(transfer)).rejects.toThrow(
        "no longer held by the expected Character",
      );
      expect(await prisma!.characterEquipmentItem.count({ where: { id: item.id } })).toBe(1);
      expect(await repo.getCanonicalEquipmentItemById(item.id)).toMatchObject({
        holderCharacterId: target.id,
        id: item.id,
      });
    });

    it("draws and stows one canonical Campaign Item with revision-safe idempotency", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const player = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, player.id);
      const campaign = await createTestCampaign(prisma!, gm.id);
      await prisma!.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        },
      });
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);
      await service.ensureCharacterEquipmentInitialized(character.id);
      const item = await service.createCampaignEquipmentItem({
        campaignId: campaign.id,
        holderCharacterId: character.id,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        templateId: "weapon-template-dagger",
      });

      const drawn = await repo.applyCombatItemInteraction({
        actionId: "action-draw",
        campaignId: campaign.id,
        encounterId: "encounter-1",
        expectedItemRevision: item.revision!,
        itemId: item.id,
        operation: "draw",
        ownerCharacterId: character.id,
      });
      expect(drawn).toMatchObject({
        alreadyApplied: false,
        item: {
          holderCharacterId: character.id,
          id: item.id,
          isEquipped: true,
          storageAssignment: { carryMode: "equipped" },
        },
      });
      expect((await repo.getCharacterLoadouts(character.id))[0]).toMatchObject({
        activePrimaryWeaponItemId: item.id,
      });
      const retried = await repo.applyCombatItemInteraction({
        actionId: "action-draw",
        campaignId: campaign.id,
        encounterId: "encounter-1",
        expectedItemRevision: item.revision!,
        itemId: item.id,
        operation: "draw",
        ownerCharacterId: character.id,
      });
      expect(retried).toMatchObject({ alreadyApplied: true, item: { id: item.id } });
      expect(retried.item.revision).toBe(drawn.item.revision);

      const stowed = await repo.applyCombatItemInteraction({
        actionId: "action-stow",
        campaignId: campaign.id,
        encounterId: "encounter-1",
        expectedItemRevision: drawn.item.revision!,
        itemId: item.id,
        operation: "stow",
        ownerCharacterId: character.id,
      });
      expect(stowed.item).toMatchObject({
        holderCharacterId: character.id,
        id: item.id,
        isEquipped: false,
      });
      expect((await repo.getCharacterLoadouts(character.id))[0]).toMatchObject({
        activePrimaryWeaponItemId: null,
      });
      expect(await prisma!.characterEquipmentItem.count({ where: { id: item.id } })).toBe(1);
    });

    it("drops, picks up, and passes the exact Item while cleaning source loadouts", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const firstUser = await createTestUser(prisma!);
      const secondUser = await createTestUser(prisma!);
      const first = await createTestCharacter(prisma!, firstUser.id);
      const second = await createTestCharacter(prisma!, secondUser.id);
      const campaign = await createTestCampaign(prisma!, gm.id);
      await prisma!.campaignRosterEntry.createMany({
        data: [first, second].map((character) => ({
          campaignId: campaign.id,
          category: "pc" as const,
          sourceId: character.id,
          sourceType: "character" as const,
        })),
      });
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);
      await service.ensureCharacterEquipmentInitialized(first.id);
      await service.ensureCharacterEquipmentInitialized(second.id);
      const item = await service.createCampaignEquipmentItem({
        campaignId: campaign.id,
        displayName: "Bridge dagger",
        holderCharacterId: first.id,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        templateId: "weapon-template-dagger",
      });
      const drawn = await repo.applyCombatItemInteraction({
        actionId: "action-draw",
        campaignId: campaign.id,
        encounterId: "encounter-1",
        expectedItemRevision: item.revision!,
        itemId: item.id,
        operation: "draw",
        ownerCharacterId: first.id,
      });
      const dropped = await repo.applyCombatItemInteraction({
        actionId: "action-drop",
        campaignId: campaign.id,
        encounterId: "encounter-1",
        expectedItemRevision: drawn.item.revision!,
        itemId: item.id,
        operation: "drop",
        ownerCharacterId: first.id,
      });
      expect(dropped.item).toMatchObject({
        holderCharacterId: null,
        id: item.id,
        storageAssignment: null,
      });
      expect((await repo.getCharacterLoadouts(first.id))[0]?.activePrimaryWeaponItemId).toBeNull();
      expect(await repo.getCombatItemInteractionRecords(campaign.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            availableInEncounter: true,
            item: expect.objectContaining({ id: item.id }),
            presentEncounterId: "encounter-1",
          }),
        ]),
      );

      const pickedUp = await repo.applyCombatItemInteraction({
        actionId: "action-pickup",
        campaignId: campaign.id,
        encounterId: "encounter-1",
        expectedItemRevision: dropped.item.revision!,
        itemId: item.id,
        operation: "pickup",
        ownerCharacterId: second.id,
      });
      expect(pickedUp.item).toMatchObject({
        holderCharacterId: second.id,
        id: item.id,
        storageAssignment: { carryMode: "on_person" },
      });

      const passed = await repo.applyCombatItemInteraction({
        actionId: "action-pass",
        campaignId: campaign.id,
        encounterId: "encounter-1",
        expectedItemRevision: pickedUp.item.revision!,
        itemId: item.id,
        operation: "pass",
        ownerCharacterId: second.id,
        recipientCharacterId: first.id,
      });
      expect(passed.item).toMatchObject({ holderCharacterId: first.id, id: item.id });
      expect(await prisma!.characterEquipmentItem.count({ where: { id: item.id } })).toBe(1);
    });

    it("rolls back forged revisions and invalid recipients with zero Item or loadout mutation", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const player = await createTestUser(prisma!);
      const outsiderUser = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, player.id);
      const outsider = await createTestCharacter(prisma!, outsiderUser.id);
      const campaign = await createTestCampaign(prisma!, gm.id);
      await prisma!.campaignRosterEntry.create({
        data: {
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        },
      });
      const repo = createPrismaCharacterEquipmentRepository(prisma!);
      const service = new CharacterEquipmentWriteService(repo);
      await service.ensureCharacterEquipmentInitialized(character.id);
      const item = await service.createCampaignEquipmentItem({
        campaignId: campaign.id,
        holderCharacterId: character.id,
        itemFacts: {
          activeMechanics: [],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        },
        templateId: "weapon-template-dagger",
      });
      const beforeItem = await repo.getCanonicalEquipmentItemById(item.id);
      const beforeLoadouts = await repo.getCharacterLoadouts(character.id);

      await expect(
        repo.applyCombatItemInteraction({
          actionId: "action-forged-revision",
          campaignId: campaign.id,
          encounterId: "encounter-1",
          expectedItemRevision: "2026-08-16T00:00:00.000Z",
          itemId: item.id,
          operation: "drop",
          ownerCharacterId: character.id,
        }),
      ).rejects.toThrow("Item changed");
      await expect(
        repo.applyCombatItemInteraction({
          actionId: "action-forged-recipient",
          campaignId: campaign.id,
          encounterId: "encounter-1",
          expectedItemRevision: item.revision!,
          itemId: item.id,
          operation: "pass",
          ownerCharacterId: character.id,
          recipientCharacterId: outsider.id,
        }),
      ).rejects.toThrow("no longer available");

      expect(await repo.getCanonicalEquipmentItemById(item.id)).toEqual(beforeItem);
      expect(await repo.getCharacterLoadouts(character.id)).toEqual(beforeLoadouts);
      expect(await prisma!.characterEquipmentItem.count({ where: { id: item.id } })).toBe(1);
    });
  });
}
