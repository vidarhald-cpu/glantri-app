import {
  type CarryMode,
  type CharacterLoadout,
  type EquipmentItem,
  type EquipmentItemInput,
  type StorageLocation,
  type StorageLocationType,
  CharacterLoadoutSchema,
  EquipmentItemSchema,
  StorageLocationSchema,
  validateEquipmentItem,
  validateLoadout,
} from "@glantri/domain";

import {
  createPrismaCharacterEquipmentRepository,
  type CharacterEquipmentRepository,
} from "../repositories/characterEquipmentRepository";

export type ActiveWeaponSlot = "primary" | "secondary" | "missile";

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function buildCustomLocationId(characterId: string, name: string): string {
  return `${characterId}:loc-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function buildDefaultLoadout(characterId: string): CharacterLoadout {
  return CharacterLoadoutSchema.parse({
    activeAmmoItemIds: [],
    activeMissileWeaponItemId: null,
    activePrimaryWeaponItemId: null,
    activeSecondaryWeaponItemId: null,
    characterId,
    id: `${characterId}:loadout-current`,
    isActive: true,
    name: "Current",
    notes: null,
    quickAccessItemIds: [],
    readyShieldItemId: null,
    wornArmorItemId: null,
  });
}

function buildBootstrapItemId(characterId: string, itemId: string): string {
  return `${characterId}:${itemId}`;
}

function assertItemBelongsToCharacter(item: EquipmentItem | undefined, characterId: string): EquipmentItem {
  if (!item || item.characterId !== characterId) {
    throw new Error("Equipment item not found for character.");
  }

  return item;
}

function assertLocationBelongsToCharacter(
  location: StorageLocation | undefined,
  characterId: string,
): StorageLocation {
  if (!location || location.characterId !== characterId) {
    throw new Error("Storage location not found for character.");
  }

  return location;
}

export class CharacterEquipmentWriteService {
  constructor(
    private readonly repository: CharacterEquipmentRepository = createPrismaCharacterEquipmentRepository(),
  ) {}

  async ensureCharacterEquipmentInitialized(characterId: string): Promise<{
    items: EquipmentItem[];
    loadouts: CharacterLoadout[];
    locations: StorageLocation[];
  }> {
    await this.repository.ensureDefaultEquipmentLocations(characterId);

    const snapshot = await this.repository.getCharacterEquipmentState(characterId);

    if (snapshot.loadouts.length === 0) {
      const loadout = await this.repository.upsertCharacterLoadout(
        buildDefaultLoadout(characterId),
      );

      return {
        items: snapshot.items,
        loadouts: [loadout],
        locations: snapshot.locations,
      };
    }

    if (!snapshot.loadouts.some((loadout) => loadout.isActive)) {
      const first = snapshot.loadouts[0];
      const activeLoadout = await this.repository.upsertCharacterLoadout({
        ...first,
        isActive: true,
      });

      return {
        items: snapshot.items,
        loadouts: [
          activeLoadout,
          ...snapshot.loadouts.slice(1),
        ],
        locations: snapshot.locations,
      };
    }

    return snapshot;
  }

  async createCharacterStorageLocation(
    characterId: string,
    name: string,
    type: StorageLocationType,
  ): Promise<StorageLocation> {
    await this.ensureCharacterEquipmentInitialized(characterId);

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Location name is required.");
    }

    const existingLocations = await this.repository.getCharacterStorageLocations(characterId);
    if (
      existingLocations.some(
        (location) => location.name.toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      throw new Error("A location with that name already exists.");
    }

    return this.repository.createCharacterStorageLocation(
      StorageLocationSchema.parse({
        characterId,
        id: buildCustomLocationId(characterId, trimmedName),
        isAccessibleInEncounter: false,
        isMobile: false,
        name: trimmedName,
        notes: null,
        parentLocationId: null,
        type,
      }),
    );
  }

  async createCharacterEquipmentItem(input: EquipmentItemInput): Promise<EquipmentItem> {
    const item = EquipmentItemSchema.parse(input);
    await this.ensureCharacterEquipmentInitialized(item.characterId);

    const locations = await this.repository.getCharacterStorageLocations(item.characterId);
    assertLocationBelongsToCharacter(
      locations.find((location) => location.id === item.storageAssignment.locationId),
      item.characterId,
    );

    const errors = validateEquipmentItem(item);
    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }

    return this.repository.createCharacterEquipmentItem(item);
  }

  async updateCharacterEquipmentItem(input: EquipmentItemInput): Promise<EquipmentItem> {
    const item = EquipmentItemSchema.parse(input);
    const snapshot = await this.ensureCharacterEquipmentInitialized(item.characterId);

    assertItemBelongsToCharacter(
      snapshot.items.find((entry) => entry.id === item.id),
      item.characterId,
    );
    assertLocationBelongsToCharacter(
      snapshot.locations.find((location) => location.id === item.storageAssignment.locationId),
      item.characterId,
    );

    const itemErrors = validateEquipmentItem(item);
    if (itemErrors.length > 0) {
      throw new Error(itemErrors.join("; "));
    }

    const nextItemsById = {
      ...indexById(snapshot.items),
      [item.id]: item,
    };

    for (const loadout of snapshot.loadouts) {
      const loadoutErrors = validateLoadout(loadout, {
        itemsById: nextItemsById,
      });

      if (loadoutErrors.length > 0) {
        throw new Error(loadoutErrors.join("; "));
      }
    }

    return this.repository.updateCharacterEquipmentItem(item);
  }

  async moveCharacterEquipmentItem(
    characterId: string,
    itemId: string,
    locationId: string,
    carryMode: CarryMode,
  ): Promise<EquipmentItem> {
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const item = assertItemBelongsToCharacter(
      snapshot.items.find((entry) => entry.id === itemId),
      characterId,
    );
    assertLocationBelongsToCharacter(
      snapshot.locations.find((location) => location.id === locationId),
      characterId,
    );

    const updatedItem = EquipmentItemSchema.parse({
      ...item,
      isEquipped: carryMode === "equipped",
      storageAssignment: {
        carryMode,
        locationId,
      },
    });

    const itemErrors = validateEquipmentItem(updatedItem);
    if (itemErrors.length > 0) {
      throw new Error(itemErrors.join("; "));
    }

    const nextItemsById = {
      ...indexById(snapshot.items),
      [updatedItem.id]: updatedItem,
    };

    for (const loadout of snapshot.loadouts) {
      const loadoutErrors = validateLoadout(loadout, {
        itemsById: nextItemsById,
      });

      if (loadoutErrors.length > 0) {
        throw new Error(loadoutErrors.join("; "));
      }
    }

    return this.repository.moveCharacterEquipmentItem(characterId, itemId, {
      carryMode,
      locationId,
    });
  }

  async setCharacterWornArmor(
    characterId: string,
    itemId: string | null,
  ): Promise<CharacterLoadout> {
    return this.updateLoadout(characterId, (loadout) => ({
      ...loadout,
      wornArmorItemId: itemId,
    }));
  }

  async setCharacterReadyShield(
    characterId: string,
    itemId: string | null,
  ): Promise<CharacterLoadout> {
    return this.updateLoadout(characterId, (loadout) => ({
      ...loadout,
      readyShieldItemId: itemId,
    }));
  }

  async setCharacterActiveWeapon(
    characterId: string,
    slot: ActiveWeaponSlot,
    itemId: string | null,
  ): Promise<CharacterLoadout> {
    return this.updateLoadout(characterId, (loadout) => {
      switch (slot) {
        case "primary":
          return {
            ...loadout,
            activePrimaryWeaponItemId: itemId,
          };
        case "secondary":
          return {
            ...loadout,
            activeSecondaryWeaponItemId: itemId,
          };
        case "missile":
        default:
          return {
            ...loadout,
            activeMissileWeaponItemId: itemId,
          };
      }
    });
  }

  async bootstrapSampleCharacterEquipment(
    characterId: string,
    options?: {
      overwrite?: boolean;
    },
  ): Promise<void> {
    const sampleModule = await import(
      "@glantri/test-scenarios/equipment/sampleCharacterEquipment"
    );

    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const hasCustomLocations = snapshot.locations.some(
      (location) => !location.type.endsWith("_system"),
    );

    if ((snapshot.items.length > 0 || hasCustomLocations) && !options?.overwrite) {
      throw new Error(
        "Sample equipment bootstrap is only available for an empty equipment state.",
      );
    }

    if (options?.overwrite) {
      throw new Error("Sample equipment overwrite is not supported yet.");
    }

    for (const location of sampleModule.sampleLocations.filter(
      (entry) => !entry.type.endsWith("_system"),
    )) {
      await this.repository.createCharacterStorageLocation(
        StorageLocationSchema.parse({
          ...location,
          characterId,
          id: location.id.replace(sampleModule.sampleCharacterId, characterId),
        }),
      );
    }

    for (const item of sampleModule.sampleEquipmentItems) {
      await this.repository.createCharacterEquipmentItem(
        EquipmentItemSchema.parse({
          ...item,
          characterId,
          id: buildBootstrapItemId(characterId, item.id),
          storageAssignment: {
            ...item.storageAssignment,
            locationId: item.storageAssignment.locationId.replace(
              sampleModule.sampleCharacterId,
              characterId,
            ),
          },
        }),
      );
    }

    await this.repository.upsertCharacterLoadout(
      CharacterLoadoutSchema.parse({
        ...sampleModule.sampleActiveLoadout,
        activeMissileWeaponItemId: sampleModule.sampleActiveLoadout.activeMissileWeaponItemId
          ? buildBootstrapItemId(
              characterId,
              sampleModule.sampleActiveLoadout.activeMissileWeaponItemId,
            )
          : null,
        activePrimaryWeaponItemId: sampleModule.sampleActiveLoadout.activePrimaryWeaponItemId
          ? buildBootstrapItemId(
              characterId,
              sampleModule.sampleActiveLoadout.activePrimaryWeaponItemId,
            )
          : null,
        activeSecondaryWeaponItemId: sampleModule.sampleActiveLoadout.activeSecondaryWeaponItemId
          ? buildBootstrapItemId(
              characterId,
              sampleModule.sampleActiveLoadout.activeSecondaryWeaponItemId,
            )
          : null,
        characterId,
        id: `${characterId}:loadout-current`,
        readyShieldItemId: sampleModule.sampleActiveLoadout.readyShieldItemId
          ? buildBootstrapItemId(
              characterId,
              sampleModule.sampleActiveLoadout.readyShieldItemId,
            )
          : null,
        wornArmorItemId: sampleModule.sampleActiveLoadout.wornArmorItemId
          ? buildBootstrapItemId(
              characterId,
              sampleModule.sampleActiveLoadout.wornArmorItemId,
            )
          : null,
      }),
    );
  }

  private async updateLoadout(
    characterId: string,
    updater: (loadout: CharacterLoadout) => CharacterLoadout,
  ): Promise<CharacterLoadout> {
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const currentLoadout =
      snapshot.loadouts.find((loadout) => loadout.isActive) ??
      snapshot.loadouts[0] ??
      buildDefaultLoadout(characterId);

    const updatedLoadout = updater(currentLoadout);
    const loadoutErrors = validateLoadout(updatedLoadout, {
      itemsById: indexById(snapshot.items),
    });

    if (loadoutErrors.length > 0) {
      throw new Error(loadoutErrors.join("; "));
    }

    return this.repository.upsertCharacterLoadout(updatedLoadout);
  }
}
