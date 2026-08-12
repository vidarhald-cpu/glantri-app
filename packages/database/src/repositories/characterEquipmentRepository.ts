import {
  CharacterLoadoutSchema,
  CanonicalEquipmentItemSchema,
  EquipmentItemSchema,
  EquipmentItemFactsV1Schema,
  StorageLocationSchema,
  type CharacterLoadout as DomainCharacterLoadout,
  type AssignedEquipmentItem,
  type CanonicalEquipmentItem,
  type ItemStorageAssignment,
  type StorageLocation,
} from "@glantri/domain";
import { createDefaultEquipmentLocations } from "@glantri/content";
import { Prisma, PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../client";

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

function serializeItemFacts(value: CanonicalEquipmentItem["itemFacts"]): Prisma.InputJsonValue {
  return EquipmentItemFactsV1Schema.parse(value) as unknown as Prisma.InputJsonValue;
}

function mapCanonicalEquipmentItem(record: {
  acquiredFrom: string | null;
  campaignContextId: string | null;
  category: string;
  holderCharacterId: string | null;
  conditionState: string;
  displayName: string | null;
  durabilityCurrent: number | null;
  durabilityMax: number | null;
  encumbranceOverride: number | null;
  id: string;
  isEquipped: boolean | null;
  isFavorite: boolean | null;
  isStackable: boolean;
  itemFactsJson: unknown;
  locationId: string | null;
  carryMode: string | null;
  previousLocationId: string | null;
  previousCarryMode: string | null;
  material: string;
  notes: string | null;
  quality: string;
  quantity: number;
  specificityType: string;
  statusTagsJson: unknown;
  templateId: string;
  valueOverride: number | null;
}): CanonicalEquipmentItem {
  return CanonicalEquipmentItemSchema.parse({
    acquiredFrom: record.acquiredFrom,
    campaignContextId: record.campaignContextId,
    category: record.category,
    characterId: record.holderCharacterId,
    conditionState: record.conditionState,
    displayName: record.displayName,
    durabilityCurrent: record.durabilityCurrent,
    durabilityMax: record.durabilityMax,
    encumbranceOverride: record.encumbranceOverride,
    holderCharacterId: record.holderCharacterId,
    id: record.id,
    isEquipped: record.isEquipped,
    isFavorite: record.isFavorite,
    isStackable: record.isStackable,
    itemFacts: EquipmentItemFactsV1Schema.parse(record.itemFactsJson),
    material: record.material,
    notes: record.notes,
    quality: record.quality,
    quantity: record.quantity,
    specialProperties: null,
    specificityType: record.specificityType,
    statusTags: parseStringArrayOrNull(record.statusTagsJson),
    storageAssignment:
      record.locationId && record.carryMode
        ? {
            carryMode: record.carryMode,
            locationId: record.locationId,
          }
        : null,
    previousStorageAssignment:
      record.previousLocationId && record.previousCarryMode
        ? {
            carryMode: record.previousCarryMode,
            locationId: record.previousLocationId,
          }
        : null,
    templateId: record.templateId,
    valueOverride: record.valueOverride,
  });
}

function mapEquipmentItem(
  record: Parameters<typeof mapCanonicalEquipmentItem>[0],
): AssignedEquipmentItem {
  return EquipmentItemSchema.parse(mapCanonicalEquipmentItem(record));
}

function mapStorageLocation(record: {
  availabilityClass?: string | null;
  characterId: string;
  id: string;
  isAccessibleInEncounter: boolean;
  isMobile: boolean;
  name: string;
  notes: string | null;
  parentLocationId: string | null;
  type: string;
}): StorageLocation {
  const availabilityClass =
    record.availabilityClass ?? (record.type.endsWith("_system") ? "with_you" : "elsewhere");

  return StorageLocationSchema.parse({
    availabilityClass,
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
  removeCharacterStorageLocation(characterId: string, locationId: string): Promise<void>;
  createCharacterEquipmentItem(item: AssignedEquipmentItem): Promise<AssignedEquipmentItem>;
  createCampaignEquipmentItem(item: CanonicalEquipmentItem): Promise<CanonicalEquipmentItem>;
  updateCampaignEquipmentItemAuthoring(
    item: CanonicalEquipmentItem,
  ): Promise<CanonicalEquipmentItem>;
  transferCampaignEquipmentItem(
    input: TransferCampaignEquipmentItemInput,
  ): Promise<CanonicalEquipmentItem>;
  updateCharacterEquipmentItem(item: AssignedEquipmentItem): Promise<AssignedEquipmentItem>;
  removeCharacterEquipmentItem(characterId: string, itemId: string): Promise<void>;
  moveCharacterEquipmentItem(
    characterId: string,
    itemId: string,
    storageAssignment: ItemStorageAssignment,
  ): Promise<AssignedEquipmentItem>;
  upsertCharacterLoadout(loadout: DomainCharacterLoadout): Promise<DomainCharacterLoadout>;
  ensureDefaultEquipmentLocations(characterId: string): Promise<StorageLocation[]>;
  getCharacterEquipmentItems(characterId: string): Promise<AssignedEquipmentItem[]>;
  getCanonicalEquipmentItemById(itemId: string): Promise<CanonicalEquipmentItem | null>;
  getCampaignEquipmentItems(campaignId: string): Promise<CanonicalEquipmentItem[]>;
  getCharacterStorageLocations(characterId: string): Promise<StorageLocation[]>;
  getCharacterLoadouts(characterId: string): Promise<DomainCharacterLoadout[]>;
  getCharacterEquipmentState(characterId: string): Promise<{
    items: AssignedEquipmentItem[];
    loadouts: DomainCharacterLoadout[];
    locations: StorageLocation[];
  }>;
}

export interface TransferCampaignEquipmentItemInput {
  campaignId: string;
  itemId: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  targetStorageAssignment: ItemStorageAssignment;
}

export class StaleEquipmentTransferError extends Error {
  constructor() {
    super("This item is no longer held by the expected Character.");
    this.name = "StaleEquipmentTransferError";
  }
}

export function createPrismaCharacterEquipmentRepository(
  client?: PrismaClient,
): CharacterEquipmentRepository {
  const prisma = client ?? defaultPrisma;
  return {
    async createCharacterStorageLocation(location) {
      const created = await prisma.characterStorageLocation.create({
        data: {
          availabilityClass: location.availabilityClass,
          characterId: location.characterId,
          id: location.id,
          isAccessibleInEncounter: location.isAccessibleInEncounter,
          isMobile: location.isMobile,
          name: location.name,
          notes: location.notes ?? null,
          parentLocationId: location.parentLocationId ?? null,
          type: location.type,
        } as Prisma.CharacterStorageLocationUncheckedCreateInput,
      });

      return mapStorageLocation(created);
    },
    async removeCharacterStorageLocation(characterId, locationId) {
      const result = await prisma.characterStorageLocation.deleteMany({
        where: {
          characterId,
          id: locationId,
        },
      });

      if (result.count === 0) {
        throw new Error("Storage location not found for character.");
      }
    },
    async createCharacterEquipmentItem(item) {
      const created = await prisma.characterEquipmentItem.create({
        data: {
          acquiredFrom: item.acquiredFrom ?? null,
          campaignContextId: item.campaignContextId,
          category: item.category,
          holderCharacterId: item.holderCharacterId,
          conditionState: item.conditionState,
          displayName: item.displayName ?? null,
          durabilityCurrent: item.durabilityCurrent ?? null,
          durabilityMax: item.durabilityMax ?? null,
          encumbranceOverride: item.encumbranceOverride ?? null,
          id: item.id,
          isEquipped: item.isEquipped ?? null,
          isFavorite: item.isFavorite ?? null,
          isStackable: item.isStackable,
          itemFactsJson: serializeItemFacts(item.itemFacts),
          locationId: item.storageAssignment.locationId,
          carryMode: item.storageAssignment.carryMode,
          previousLocationId: item.previousStorageAssignment?.locationId ?? null,
          previousCarryMode: item.previousStorageAssignment?.carryMode ?? null,
          material: item.material,
          notes: item.notes ?? null,
          quality: item.quality,
          quantity: item.quantity,
          specificityType: item.specificityType,
          statusTagsJson: serializeJsonArray(item.statusTags),
          templateId: item.templateId,
          valueOverride: item.valueOverride ?? null,
        },
      });

      return mapEquipmentItem(created);
    },
    async createCampaignEquipmentItem(item) {
      const created = await prisma.characterEquipmentItem.create({
        data: {
          acquiredFrom: item.acquiredFrom ?? null,
          campaignContextId: item.campaignContextId,
          category: item.category,
          holderCharacterId: item.holderCharacterId,
          conditionState: item.conditionState,
          displayName: item.displayName ?? null,
          durabilityCurrent: item.durabilityCurrent ?? null,
          durabilityMax: item.durabilityMax ?? null,
          encumbranceOverride: item.encumbranceOverride ?? null,
          id: item.id,
          isEquipped: item.isEquipped ?? null,
          isFavorite: item.isFavorite ?? null,
          isStackable: item.isStackable,
          itemFactsJson: serializeItemFacts(item.itemFacts),
          locationId: item.storageAssignment?.locationId ?? null,
          carryMode: item.storageAssignment?.carryMode ?? null,
          previousLocationId: item.previousStorageAssignment?.locationId ?? null,
          previousCarryMode: item.previousStorageAssignment?.carryMode ?? null,
          material: item.material,
          notes: item.notes ?? null,
          quality: item.quality,
          quantity: item.quantity,
          specificityType: item.specificityType,
          statusTagsJson: serializeJsonArray(item.statusTags),
          templateId: item.templateId,
          valueOverride: item.valueOverride ?? null,
        },
      });

      return mapCanonicalEquipmentItem(created);
    },
    async updateCampaignEquipmentItemAuthoring(item) {
      const result = await prisma.characterEquipmentItem.updateMany({
        data: {
          displayName: item.displayName ?? null,
          itemFactsJson: serializeItemFacts(item.itemFacts),
          notes: item.notes ?? null,
        },
        where: {
          campaignContextId: item.campaignContextId,
          id: item.id,
        },
      });

      if (result.count === 0) {
        throw new Error("Campaign item not found.");
      }

      const updated = await prisma.characterEquipmentItem.findUnique({ where: { id: item.id } });
      if (!updated) {
        throw new Error("Campaign item not found after update.");
      }

      return mapCanonicalEquipmentItem(updated);
    },
    async transferCampaignEquipmentItem(input) {
      return prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" = ${input.itemId} FOR UPDATE`,
        );
        const current = await transaction.characterEquipmentItem.findUnique({
          where: { id: input.itemId },
        });

        if (!current || current.campaignContextId !== input.campaignId) {
          throw new Error("Campaign item not found.");
        }
        if (current.holderCharacterId !== input.sourceCharacterId) {
          throw new StaleEquipmentTransferError();
        }
        if (input.sourceCharacterId === input.targetCharacterId) {
          throw new Error("Choose a different Character to receive this item.");
        }

        const rosterCount = await transaction.campaignRosterEntry.count({
          where: {
            campaignId: input.campaignId,
            sourceId: { in: [input.sourceCharacterId, input.targetCharacterId] },
            sourceType: "character",
          },
        });
        if (rosterCount !== 2) {
          throw new Error("Choose Characters from this campaign roster.");
        }

        let targetLocation = await transaction.characterStorageLocation.findFirst({
          where: {
            characterId: input.targetCharacterId,
            id: input.targetStorageAssignment.locationId,
          },
        });
        if (!targetLocation) {
          const defaultTargetLocations = createDefaultEquipmentLocations(input.targetCharacterId);
          const isStandardTarget = defaultTargetLocations.some(
            (location) => location.id === input.targetStorageAssignment.locationId,
          );
          if (!isStandardTarget) {
            throw new Error("The receiving Character has no valid storage for this transfer.");
          }

          for (const location of defaultTargetLocations) {
            await transaction.characterStorageLocation.upsert({
              create: {
                availabilityClass: location.availabilityClass,
                characterId: location.characterId,
                id: location.id,
                isAccessibleInEncounter: location.isAccessibleInEncounter,
                isMobile: location.isMobile,
                name: location.name,
                notes: location.notes ?? null,
                parentLocationId: location.parentLocationId ?? null,
                type: location.type,
              } as Prisma.CharacterStorageLocationUncheckedCreateInput,
              update: {},
              where: { id: location.id },
            });
          }
          targetLocation = await transaction.characterStorageLocation.findFirst({
            where: {
              characterId: input.targetCharacterId,
              id: input.targetStorageAssignment.locationId,
            },
          });
        }
        if (!targetLocation || input.targetStorageAssignment.carryMode === "equipped") {
          throw new Error("The receiving Character has no valid storage for this transfer.");
        }

        const sourceLoadouts = await transaction.characterLoadout.findMany({
          where: { characterId: input.sourceCharacterId },
        });
        for (const loadout of sourceLoadouts) {
          const quickAccessItemIds = parseStringArrayOrNull(loadout.quickAccessItemIdsJson) ?? [];
          await transaction.characterLoadout.update({
            data: {
              activeAmmoItemIds: loadout.activeAmmoItemIds.filter((id) => id !== input.itemId),
              activeMissileWeaponItemId:
                loadout.activeMissileWeaponItemId === input.itemId
                  ? null
                  : loadout.activeMissileWeaponItemId,
              activePrimaryWeaponItemId:
                loadout.activePrimaryWeaponItemId === input.itemId
                  ? null
                  : loadout.activePrimaryWeaponItemId,
              activeSecondaryWeaponItemId:
                loadout.activeSecondaryWeaponItemId === input.itemId
                  ? null
                  : loadout.activeSecondaryWeaponItemId,
              quickAccessItemIdsJson: quickAccessItemIds.filter((id) => id !== input.itemId),
              readyShieldItemId:
                loadout.readyShieldItemId === input.itemId ? null : loadout.readyShieldItemId,
              wornArmorItemId:
                loadout.wornArmorItemId === input.itemId ? null : loadout.wornArmorItemId,
            },
            where: { id: loadout.id },
          });
        }

        const moved = await transaction.characterEquipmentItem.updateMany({
          data: {
            carryMode: input.targetStorageAssignment.carryMode,
            holderCharacterId: input.targetCharacterId,
            isEquipped: false,
            locationId: input.targetStorageAssignment.locationId,
            previousCarryMode: null,
            previousLocationId: null,
          },
          where: {
            campaignContextId: input.campaignId,
            holderCharacterId: input.sourceCharacterId,
            id: input.itemId,
          },
        });
        if (moved.count !== 1) {
          throw new StaleEquipmentTransferError();
        }

        const updated = await transaction.characterEquipmentItem.findUnique({
          where: { id: input.itemId },
        });
        if (!updated) {
          throw new Error("Campaign item not found after transfer.");
        }

        return mapCanonicalEquipmentItem(updated);
      });
    },
    async updateCharacterEquipmentItem(item) {
      const result = await prisma.characterEquipmentItem.updateMany({
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
          previousLocationId: item.previousStorageAssignment?.locationId ?? null,
          previousCarryMode: item.previousStorageAssignment?.carryMode ?? null,
          material: item.material,
          notes: item.notes ?? null,
          quality: item.quality,
          quantity: item.quantity,
          itemFactsJson: serializeItemFacts(item.itemFacts),
          specificityType: item.specificityType,
          statusTagsJson: serializeJsonArray(item.statusTags),
          templateId: item.templateId,
          valueOverride: item.valueOverride ?? null,
        },
        where: {
          holderCharacterId: item.characterId,
          id: item.id,
        },
      });

      if (result.count !== 1) {
        throw new Error("Equipment item is no longer held by this Character.");
      }

      const updated = await prisma.characterEquipmentItem.findUnique({ where: { id: item.id } });
      if (!updated) {
        throw new Error("Equipment item not found after update.");
      }

      return mapEquipmentItem(updated);
    },
    async removeCharacterEquipmentItem(characterId, itemId) {
      const result = await prisma.characterEquipmentItem.deleteMany({
        where: {
          holderCharacterId: characterId,
          id: itemId,
        },
      });

      if (result.count === 0) {
        throw new Error("Equipment item not found for character.");
      }
    },
    async moveCharacterEquipmentItem(characterId, itemId, storageAssignment) {
      const result = await prisma.characterEquipmentItem.updateMany({
        data: {
          carryMode: storageAssignment.carryMode,
          isEquipped: storageAssignment.carryMode === "equipped",
          locationId: storageAssignment.locationId,
          previousLocationId: null,
          previousCarryMode: null,
        },
        where: {
          holderCharacterId: characterId,
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
      const referencedItemIds = [
        loadout.wornArmorItemId,
        loadout.readyShieldItemId,
        loadout.activePrimaryWeaponItemId,
        loadout.activeSecondaryWeaponItemId,
        loadout.activeMissileWeaponItemId,
        ...loadout.activeAmmoItemIds,
        ...loadout.quickAccessItemIds,
      ].filter((id): id is string => Boolean(id));
      const uniqueReferencedItemIds = [...new Set(referencedItemIds)];

      const upserted = await prisma.$transaction(async (transaction) => {
        if (uniqueReferencedItemIds.length > 0) {
          await transaction.$queryRaw(
            Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" IN (${Prisma.join(uniqueReferencedItemIds)}) FOR UPDATE`,
          );
          const heldCount = await transaction.characterEquipmentItem.count({
            where: {
              holderCharacterId: loadout.characterId,
              id: { in: uniqueReferencedItemIds },
            },
          });
          if (heldCount !== uniqueReferencedItemIds.length) {
            throw new Error("A loadout item is no longer held by this Character.");
          }
        }

        return transaction.characterLoadout.upsert({
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
      });

      return mapLoadout(upserted);
    },
    async ensureDefaultEquipmentLocations(characterId) {
      const defaults = createDefaultEquipmentLocations(characterId);

      await prisma.$transaction(
        defaults.map((location) =>
          prisma.characterStorageLocation.upsert({
            create: {
              availabilityClass: location.availabilityClass,
              characterId: location.characterId,
              id: location.id,
              isAccessibleInEncounter: location.isAccessibleInEncounter,
              isMobile: location.isMobile,
              name: location.name,
              notes: location.notes ?? null,
              parentLocationId: location.parentLocationId ?? null,
              type: location.type,
            } as Prisma.CharacterStorageLocationUncheckedCreateInput,
            update: {
              availabilityClass: location.availabilityClass,
              isAccessibleInEncounter: location.isAccessibleInEncounter,
              isMobile: location.isMobile,
              name: location.name,
              notes: location.notes ?? null,
              parentLocationId: location.parentLocationId ?? null,
              type: location.type,
            } as Prisma.CharacterStorageLocationUncheckedUpdateInput,
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
          carryMode: { not: null },
          holderCharacterId: characterId,
          locationId: { not: null },
        },
      });

      return items.map(mapEquipmentItem);
    },
    async getCanonicalEquipmentItemById(itemId) {
      const item = await prisma.characterEquipmentItem.findUnique({
        where: { id: itemId },
      });

      return item ? mapCanonicalEquipmentItem(item) : null;
    },
    async getCampaignEquipmentItems(campaignId) {
      const items = await prisma.characterEquipmentItem.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        where: { campaignContextId: campaignId },
      });

      return items.map(mapCanonicalEquipmentItem);
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
