import {
  CharacterLoadoutSchema,
  EquipmentItemSchema,
  EquipmentSpecialPropertiesSchema,
  StorageLocationSchema,
  type CharacterLoadout as DomainCharacterLoadout,
  type EquipmentItem,
  type EquipmentSpecialProperties,
  type ItemStorageAssignment,
  type StorageLocation,
} from "@glantri/domain";
import { createDefaultEquipmentLocations } from "@glantri/content";
import { Prisma } from "@prisma/client";

import { prisma } from "../client";

function parseSpecialProperties(
  value: unknown,
): EquipmentSpecialProperties | null {
  if (value == null) {
    return null;
  }

  return EquipmentSpecialPropertiesSchema.parse(value);
}

function parseStringArrayOrNull(value: unknown): string[] | null {
  if (value == null) {
    return null;
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("Expected JSON string array.");
  }

  return value;
}

function serializeJsonArray(
  value: string[] | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  return value == null ? Prisma.JsonNull : value;
}

function serializeSpecialProperties(
  value: EquipmentSpecialProperties | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  return value == null
    ? Prisma.JsonNull
    : (value as unknown as Prisma.InputJsonValue);
}

function mapEquipmentItem(record: {
  acquiredFrom: string | null;
  category: string;
  characterId: string;
  conditionState: string;
  displayName: string | null;
  durabilityCurrent: number | null;
  durabilityMax: number | null;
  encumbranceOverride: number | null;
  id: string;
  isEquipped: boolean | null;
  isFavorite: boolean | null;
  isStackable: boolean;
  locationId: string;
  carryMode: string;
  material: string;
  notes: string | null;
  quality: string;
  quantity: number;
  specialPropertiesJson: unknown;
  specificityType: string;
  statusTagsJson: unknown;
  templateId: string;
  valueOverride: number | null;
}): EquipmentItem {
  return EquipmentItemSchema.parse({
    acquiredFrom: record.acquiredFrom,
    category: record.category,
    characterId: record.characterId,
    conditionState: record.conditionState,
    displayName: record.displayName,
    durabilityCurrent: record.durabilityCurrent,
    durabilityMax: record.durabilityMax,
    encumbranceOverride: record.encumbranceOverride,
    id: record.id,
    isEquipped: record.isEquipped,
    isFavorite: record.isFavorite,
    isStackable: record.isStackable,
    material: record.material,
    notes: record.notes,
    quality: record.quality,
    quantity: record.quantity,
    specialProperties: parseSpecialProperties(record.specialPropertiesJson),
    specificityType: record.specificityType,
    statusTags: parseStringArrayOrNull(record.statusTagsJson),
    storageAssignment: {
      carryMode: record.carryMode,
      locationId: record.locationId,
    },
    templateId: record.templateId,
    valueOverride: record.valueOverride,
  });
}

function mapStorageLocation(record: {
  characterId: string;
  id: string;
  isAccessibleInEncounter: boolean;
  isMobile: boolean;
  name: string;
  notes: string | null;
  parentLocationId: string | null;
  type: string;
}): StorageLocation {
  return StorageLocationSchema.parse({
    characterId: record.characterId,
    id: record.id,
    isAccessibleInEncounter: record.isAccessibleInEncounter,
    isMobile: record.isMobile,
    name: record.name,
    notes: record.notes,
    parentLocationId: record.parentLocationId,
    type: record.type,
  });
}

function mapLoadout(record: {
  activeAmmoItemIds: string[];
  activeMissileWeaponItemId: string | null;
  activePrimaryWeaponItemId: string | null;
  activeSecondaryWeaponItemId: string | null;
  characterId: string;
  id: string;
  isActive: boolean;
  name: string;
  notes: string | null;
  quickAccessItemIdsJson: unknown;
  readyShieldItemId: string | null;
  wornArmorItemId: string | null;
}): DomainCharacterLoadout {
  return CharacterLoadoutSchema.parse({
    activeAmmoItemIds: record.activeAmmoItemIds,
    activeMissileWeaponItemId: record.activeMissileWeaponItemId,
    activePrimaryWeaponItemId: record.activePrimaryWeaponItemId,
    activeSecondaryWeaponItemId: record.activeSecondaryWeaponItemId,
    characterId: record.characterId,
    id: record.id,
    isActive: record.isActive,
    name: record.name,
    notes: record.notes,
    quickAccessItemIds: parseStringArrayOrNull(record.quickAccessItemIdsJson) ?? [],
    readyShieldItemId: record.readyShieldItemId,
    wornArmorItemId: record.wornArmorItemId,
  });
}

export interface CharacterEquipmentRepository {
  createCharacterStorageLocation(location: StorageLocation): Promise<StorageLocation>;
  createCharacterEquipmentItem(item: EquipmentItem): Promise<EquipmentItem>;
  updateCharacterEquipmentItem(item: EquipmentItem): Promise<EquipmentItem>;
  moveCharacterEquipmentItem(
    characterId: string,
    itemId: string,
    storageAssignment: ItemStorageAssignment,
  ): Promise<EquipmentItem>;
  upsertCharacterLoadout(loadout: DomainCharacterLoadout): Promise<DomainCharacterLoadout>;
  ensureDefaultEquipmentLocations(characterId: string): Promise<StorageLocation[]>;
  getCharacterEquipmentItems(characterId: string): Promise<EquipmentItem[]>;
  getCharacterStorageLocations(characterId: string): Promise<StorageLocation[]>;
  getCharacterLoadouts(characterId: string): Promise<DomainCharacterLoadout[]>;
  getCharacterEquipmentState(characterId: string): Promise<{
    items: EquipmentItem[];
    loadouts: DomainCharacterLoadout[];
    locations: StorageLocation[];
  }>;
}

export function createPrismaCharacterEquipmentRepository(): CharacterEquipmentRepository {
  return {
    async createCharacterStorageLocation(location) {
      const created = await prisma.characterStorageLocation.create({
        data: {
          characterId: location.characterId,
          id: location.id,
          isAccessibleInEncounter: location.isAccessibleInEncounter,
          isMobile: location.isMobile,
          name: location.name,
          notes: location.notes ?? null,
          parentLocationId: location.parentLocationId ?? null,
          type: location.type,
        },
      });

      return mapStorageLocation(created);
    },
    async createCharacterEquipmentItem(item) {
      const created = await prisma.characterEquipmentItem.create({
        data: {
          acquiredFrom: item.acquiredFrom ?? null,
          category: item.category,
          characterId: item.characterId,
          conditionState: item.conditionState,
          displayName: item.displayName ?? null,
          durabilityCurrent: item.durabilityCurrent ?? null,
          durabilityMax: item.durabilityMax ?? null,
          encumbranceOverride: item.encumbranceOverride ?? null,
          id: item.id,
          isEquipped: item.isEquipped ?? null,
          isFavorite: item.isFavorite ?? null,
          isStackable: item.isStackable,
          locationId: item.storageAssignment.locationId,
          carryMode: item.storageAssignment.carryMode,
          material: item.material,
          notes: item.notes ?? null,
          quality: item.quality,
          quantity: item.quantity,
          specialPropertiesJson: serializeSpecialProperties(item.specialProperties),
          specificityType: item.specificityType,
          statusTagsJson: serializeJsonArray(item.statusTags),
          templateId: item.templateId,
          valueOverride: item.valueOverride ?? null,
        },
      });

      return mapEquipmentItem(created);
    },
    async updateCharacterEquipmentItem(item) {
      const updated = await prisma.characterEquipmentItem.update({
        data: {
          acquiredFrom: item.acquiredFrom ?? null,
          category: item.category,
          conditionState: item.conditionState,
          displayName: item.displayName ?? null,
          durabilityCurrent: item.durabilityCurrent ?? null,
          durabilityMax: item.durabilityMax ?? null,
          encumbranceOverride: item.encumbranceOverride ?? null,
          isEquipped: item.isEquipped ?? null,
          isFavorite: item.isFavorite ?? null,
          isStackable: item.isStackable,
          locationId: item.storageAssignment.locationId,
          carryMode: item.storageAssignment.carryMode,
          material: item.material,
          notes: item.notes ?? null,
          quality: item.quality,
          quantity: item.quantity,
          specialPropertiesJson: serializeSpecialProperties(item.specialProperties),
          specificityType: item.specificityType,
          statusTagsJson: serializeJsonArray(item.statusTags),
          templateId: item.templateId,
          valueOverride: item.valueOverride ?? null,
        },
        where: {
          id: item.id,
        },
      });

      return mapEquipmentItem(updated);
    },
    async moveCharacterEquipmentItem(characterId, itemId, storageAssignment) {
      const result = await prisma.characterEquipmentItem.updateMany({
        data: {
          carryMode: storageAssignment.carryMode,
          isEquipped: storageAssignment.carryMode === "equipped",
          locationId: storageAssignment.locationId,
        },
        where: {
          characterId,
          id: itemId,
        },
      });

      if (result.count === 0) {
        throw new Error("Equipment item not found for character.");
      }

      const updated = await prisma.characterEquipmentItem.findUnique({
        where: {
          id: itemId,
        },
      });

      if (!updated) {
        throw new Error("Equipment item not found after move.");
      }

      return mapEquipmentItem(updated);
    },
    async upsertCharacterLoadout(loadout) {
      const upserted = await prisma.characterLoadout.upsert({
        create: {
          activeAmmoItemIds: loadout.activeAmmoItemIds,
          activeMissileWeaponItemId: loadout.activeMissileWeaponItemId ?? null,
          activePrimaryWeaponItemId: loadout.activePrimaryWeaponItemId ?? null,
          activeSecondaryWeaponItemId: loadout.activeSecondaryWeaponItemId ?? null,
          characterId: loadout.characterId,
          id: loadout.id,
          isActive: loadout.isActive,
          name: loadout.name,
          notes: loadout.notes ?? null,
          quickAccessItemIdsJson: loadout.quickAccessItemIds,
          readyShieldItemId: loadout.readyShieldItemId ?? null,
          wornArmorItemId: loadout.wornArmorItemId ?? null,
        },
        update: {
          activeAmmoItemIds: loadout.activeAmmoItemIds,
          activeMissileWeaponItemId: loadout.activeMissileWeaponItemId ?? null,
          activePrimaryWeaponItemId: loadout.activePrimaryWeaponItemId ?? null,
          activeSecondaryWeaponItemId: loadout.activeSecondaryWeaponItemId ?? null,
          isActive: loadout.isActive,
          name: loadout.name,
          notes: loadout.notes ?? null,
          quickAccessItemIdsJson: loadout.quickAccessItemIds,
          readyShieldItemId: loadout.readyShieldItemId ?? null,
          wornArmorItemId: loadout.wornArmorItemId ?? null,
        },
        where: {
          id: loadout.id,
        },
      });

      return mapLoadout(upserted);
    },
    async ensureDefaultEquipmentLocations(characterId) {
      const defaults = createDefaultEquipmentLocations(characterId);

      await prisma.$transaction(
        defaults.map((location) =>
          prisma.characterStorageLocation.upsert({
            create: {
              characterId: location.characterId,
              id: location.id,
              isAccessibleInEncounter: location.isAccessibleInEncounter,
              isMobile: location.isMobile,
              name: location.name,
              notes: location.notes ?? null,
              parentLocationId: location.parentLocationId ?? null,
              type: location.type,
            },
            update: {
              isAccessibleInEncounter: location.isAccessibleInEncounter,
              isMobile: location.isMobile,
              name: location.name,
              notes: location.notes ?? null,
              parentLocationId: location.parentLocationId ?? null,
              type: location.type,
            },
            where: {
              id: location.id,
            },
          }),
        ),
      );

      return this.getCharacterStorageLocations(characterId);
    },
    async getCharacterEquipmentItems(characterId) {
      const items = await prisma.characterEquipmentItem.findMany({
        orderBy: {
          createdAt: "asc",
        },
        where: {
          characterId,
        },
      });

      return items.map(mapEquipmentItem);
    },
    async getCharacterStorageLocations(characterId) {
      const locations = await prisma.characterStorageLocation.findMany({
        orderBy: {
          createdAt: "asc",
        },
        where: {
          characterId,
        },
      });

      return locations.map(mapStorageLocation);
    },
    async getCharacterLoadouts(characterId) {
      const loadouts = await prisma.characterLoadout.findMany({
        orderBy: [
          {
            isActive: "desc",
          },
          {
            createdAt: "asc",
          },
        ],
        where: {
          characterId,
        },
      });

      return loadouts.map(mapLoadout);
    },
    async getCharacterEquipmentState(characterId) {
      const [items, locations, loadouts] = await Promise.all([
        this.getCharacterEquipmentItems(characterId),
        this.getCharacterStorageLocations(characterId),
        this.getCharacterLoadouts(characterId),
      ]);

      return {
        items,
        loadouts,
        locations,
      };
    },
  };
}
