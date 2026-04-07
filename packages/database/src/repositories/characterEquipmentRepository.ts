import {
  CharacterLoadoutSchema,
  EquipmentItemSchema,
  EquipmentSpecialPropertiesSchema,
  StorageLocationSchema,
  type CharacterLoadout as DomainCharacterLoadout,
  type EquipmentItem,
  type EquipmentSpecialProperties,
  type StorageLocation,
} from "@glantri/domain";

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
