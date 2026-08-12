import { describe, expect, it } from "vitest";
import {
  CharacterLoadoutSchema,
  EquipmentItemSchema,
  StorageLocationSchema,
  type AssignedEquipmentItem,
  type CharacterLoadout,
  type StorageLocation,
} from "@glantri/domain";

import type { CharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { CharacterEquipmentWriteService } from "./characterEquipmentWriteService";

const characterId = "char-equip";

function cloneItem(item: AssignedEquipmentItem): AssignedEquipmentItem {
  return EquipmentItemSchema.parse(item);
}

function cloneLoadout(loadout: CharacterLoadout): CharacterLoadout {
  return CharacterLoadoutSchema.parse(loadout);
}

function cloneLocation(location: StorageLocation): StorageLocation {
  return StorageLocationSchema.parse(location);
}

function createRepositoryStub(input?: {
  items?: AssignedEquipmentItem[];
  loadouts?: CharacterLoadout[];
  locations?: StorageLocation[];
}) {
  const items = new Map((input?.items ?? []).map((item) => [item.id, cloneItem(item)]));
  const loadouts = new Map(
    (input?.loadouts ?? []).map((loadout) => [loadout.id, cloneLoadout(loadout)]),
  );
  const locations = new Map(
    (input?.locations ?? []).map((location) => [location.id, cloneLocation(location)]),
  );

  const repository: CharacterEquipmentRepository = {
    async createCharacterStorageLocation(location) {
      locations.set(location.id, cloneLocation(location));
      return cloneLocation(location);
    },
    async removeCharacterStorageLocation(_characterId, locationId) {
      locations.delete(locationId);
    },
    async createCharacterEquipmentItem(item) {
      items.set(item.id, cloneItem(item));
      return cloneItem(item);
    },
    async createCampaignEquipmentItem(item) {
      throw new Error(`Unexpected campaign item create: ${item.id}`);
    },
    async updateCampaignEquipmentItemAuthoring(item) {
      throw new Error(`Unexpected campaign item update: ${item.id}`);
    },
    async updateCharacterEquipmentItem(item) {
      items.set(item.id, cloneItem(item));
      return cloneItem(item);
    },
    async removeCharacterEquipmentItem(_characterId, itemId) {
      items.delete(itemId);
    },
    async moveCharacterEquipmentItem(_characterId, itemId, storageAssignment) {
      const existing = items.get(itemId);
      if (!existing) {
        throw new Error("Equipment item not found for character.");
      }
      const updated = cloneItem({
        ...existing,
        isEquipped: storageAssignment.carryMode === "equipped",
        storageAssignment,
      });
      items.set(itemId, updated);
      return cloneItem(updated);
    },
    async upsertCharacterLoadout(loadout) {
      loadouts.set(loadout.id, cloneLoadout(loadout));
      return cloneLoadout(loadout);
    },
    async ensureDefaultEquipmentLocations() {
      return Array.from(locations.values()).map(cloneLocation);
    },
    async getCharacterEquipmentItems(currentCharacterId) {
      return Array.from(items.values())
        .filter((item) => item.characterId === currentCharacterId)
        .map(cloneItem);
    },
    async getCanonicalEquipmentItemById(itemId) {
      return items.get(itemId) ?? null;
    },
    async getCampaignEquipmentItems() {
      return [];
    },
    async getCharacterStorageLocations(currentCharacterId) {
      return Array.from(locations.values())
        .filter((location) => location.characterId === currentCharacterId)
        .map(cloneLocation);
    },
    async getCharacterLoadouts(currentCharacterId) {
      return Array.from(loadouts.values())
        .filter((loadout) => loadout.characterId === currentCharacterId)
        .map(cloneLoadout);
    },
    async getCharacterEquipmentState(currentCharacterId) {
      return {
        items: await repository.getCharacterEquipmentItems(currentCharacterId),
        loadouts: await repository.getCharacterLoadouts(currentCharacterId),
        locations: await repository.getCharacterStorageLocations(currentCharacterId),
      };
    },
  };

  return { items, loadouts, repository };
}

function createLocation(input: {
  id: string;
  name: string;
  type: StorageLocation["type"];
  availabilityClass: StorageLocation["availabilityClass"];
  isAccessibleInEncounter?: boolean;
}) {
  return StorageLocationSchema.parse({
    availabilityClass: input.availabilityClass,
    characterId,
    id: input.id,
    isAccessibleInEncounter: input.isAccessibleInEncounter ?? true,
    isMobile: true,
    name: input.name,
    notes: null,
    parentLocationId: null,
    type: input.type,
  });
}

function createItem(input: {
  campaignContextId?: string | null;
  id: string;
  isStackable?: boolean;
  specificityType?: AssignedEquipmentItem["specificityType"];
  templateId: string;
  category: AssignedEquipmentItem["category"];
  storageAssignment: AssignedEquipmentItem["storageAssignment"];
}) {
  return EquipmentItemSchema.parse({
    acquiredFrom: null,
    campaignContextId: input.campaignContextId ?? null,
    category: input.category,
    characterId,
    conditionState: "intact",
    displayName: null,
    durabilityCurrent: null,
    durabilityMax: null,
    encumbranceOverride: null,
    id: input.id,
    isEquipped: input.storageAssignment.carryMode === "equipped",
    isFavorite: null,
    isStackable: input.isStackable ?? false,
    material: "steel",
    notes: null,
    previousStorageAssignment: null,
    quality: "standard",
    quantity: 1,
    specialProperties: null,
    specificityType: input.specificityType ?? "specific",
    statusTags: null,
    storageAssignment: input.storageAssignment,
    templateId: input.templateId,
    valueOverride: null,
  });
}

describe("CharacterEquipmentWriteService loadout storage restoration", () => {
  it("keeps unheld items outside the current Character creation workflow", async () => {
    const { repository } = createRepositoryStub();
    const service = new CharacterEquipmentWriteService(repository);

    await expect(
      service.createCharacterEquipmentItem({
        category: "weapon",
        characterId: null,
        conditionState: "intact",
        holderCharacterId: null,
        id: "unheld-item",
        isStackable: false,
        material: "steel",
        quality: "standard",
        quantity: 1,
        specificityType: "specific",
        storageAssignment: null,
        templateId: "weapon-template-dagger",
      }),
    ).rejects.toThrow("This pilot workflow requires a Character holder and valid holder location.");
  });

  it("returns an unequipped weapon to its prior mount location instead of backpack", async () => {
    const equippedLocation = createLocation({
      availabilityClass: "with_you",
      id: `${characterId}:loc-equipped`,
      name: "Equipped",
      type: "equipped_system",
    });
    const personLocation = createLocation({
      availabilityClass: "with_you",
      id: `${characterId}:loc-person`,
      name: "On person",
      type: "person_system",
    });
    const backpackLocation = createLocation({
      availabilityClass: "with_you",
      id: `${characterId}:loc-backpack`,
      name: "Backpack",
      type: "backpack_system",
    });
    const mountLocation = createLocation({
      availabilityClass: "with_you",
      id: `${characterId}:loc-mount`,
      isAccessibleInEncounter: false,
      name: "Mount",
      type: "mount_system",
    });

    const spear = createItem({
      category: "weapon",
      id: `${characterId}:item-spear`,
      storageAssignment: {
        carryMode: "mount",
        locationId: mountLocation.id,
      },
      templateId: "weapon-template-spear",
    });

    const { items, repository } = createRepositoryStub({
      items: [spear],
      locations: [equippedLocation, personLocation, backpackLocation, mountLocation],
    });
    const service = new CharacterEquipmentWriteService(repository);

    await service.setCharacterActiveWeapon(characterId, "primary", spear.id);

    const equippedSpear = items.get(spear.id);
    expect(equippedSpear).toMatchObject({
      isEquipped: true,
      previousStorageAssignment: {
        carryMode: "mount",
        locationId: mountLocation.id,
      },
      storageAssignment: {
        carryMode: "equipped",
        locationId: equippedLocation.id,
      },
    });

    await service.setCharacterActiveWeapon(characterId, "primary", null);

    expect(items.get(spear.id)).toMatchObject({
      isEquipped: false,
      previousStorageAssignment: null,
      storageAssignment: {
        carryMode: "mount",
        locationId: mountLocation.id,
      },
    });
    expect(items.get(spear.id)?.storageAssignment).not.toEqual({
      carryMode: "backpack",
      locationId: backpackLocation.id,
    });
  });
});

describe("CharacterEquipmentWriteService campaign item ownership", () => {
  const personLocation = createLocation({
    availabilityClass: "with_you",
    id: `${characterId}:loc-person`,
    name: "On person",
    type: "person_system",
  });

  it("denies legacy metadata, quantity, and deletion writes for canonical campaign items", async () => {
    const campaignItem = createItem({
      campaignContextId: "campaign-1",
      category: "valuables",
      id: `${characterId}:item-campaign`,
      isStackable: true,
      specificityType: "generic",
      storageAssignment: { carryMode: "on_person", locationId: personLocation.id },
      templateId: "valuable-template-gold-coins",
    });
    const { items, repository } = createRepositoryStub({
      items: [campaignItem],
      locations: [personLocation],
    });
    const service = new CharacterEquipmentWriteService(repository);

    await expect(
      service.updateCharacterEquipmentMetadata(characterId, campaignItem.id, {
        conditionState: "damaged",
        displayName: "Player rewrite",
        notes: "Player notes",
      }),
    ).rejects.toThrow("Campaign item details can only be changed from Campaign Items.");
    await expect(
      service.updateCharacterEquipmentQuantity(characterId, campaignItem.id, 10),
    ).rejects.toThrow("Campaign item details can only be changed from Campaign Items.");
    await expect(
      service.removeCharacterEquipmentItem(characterId, campaignItem.id),
    ).rejects.toThrow("Campaign item details can only be changed from Campaign Items.");

    expect(items.get(campaignItem.id)).toMatchObject({
      conditionState: "intact",
      displayName: null,
      notes: null,
      quantity: 1,
    });
  });

  it("keeps ordinary Character Equipment metadata, quantity, and deletion self-service", async () => {
    const ordinaryItem = createItem({
      category: "valuables",
      id: `${characterId}:item-ordinary`,
      isStackable: true,
      specificityType: "generic",
      storageAssignment: { carryMode: "on_person", locationId: personLocation.id },
      templateId: "valuable-template-gold-coins",
    });
    const { items, repository } = createRepositoryStub({
      items: [ordinaryItem],
      locations: [personLocation],
    });
    const service = new CharacterEquipmentWriteService(repository);

    await expect(
      service.updateCharacterEquipmentMetadata(characterId, ordinaryItem.id, {
        conditionState: "damaged",
        displayName: "Player item",
        notes: "Player notes",
      }),
    ).resolves.toMatchObject({ displayName: "Player item", notes: "Player notes" });
    await expect(
      service.updateCharacterEquipmentQuantity(characterId, ordinaryItem.id, 2),
    ).resolves.toMatchObject({ quantity: 2 });
    await expect(
      service.removeCharacterEquipmentItem(characterId, ordinaryItem.id),
    ).resolves.toBeUndefined();
    expect(items.has(ordinaryItem.id)).toBe(false);
  });
});
