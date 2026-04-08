import { equipmentTemplatesById } from "@glantri/content";
import {
  type CarryMode,
  type CharacterLoadout,
  type EquipmentItem,
  type EquipmentItemInput,
  type ItemConditionState,
  type LocationAvailabilityClass,
  type MaterialType,
  type QualityType,
  type StorageLocation,
  type StorageLocationType,
  CharacterLoadoutSchema,
  EquipmentItemSchema,
  StorageLocationSchema,
  getStorageAssignmentForLocation,
  isSystemLocation,
  isWithYouLocation,
  validateEquipmentItem,
  validateLoadout,
} from "@glantri/domain";
import { randomUUID } from "node:crypto";

import {
  createPrismaCharacterEquipmentRepository,
  type CharacterEquipmentRepository,
} from "../repositories/characterEquipmentRepository";

export type ActiveWeaponSlot = "primary" | "secondary" | "missile";

interface AddCharacterEquipmentItemInput {
  templateId: string;
  quantity: number;
  material?: MaterialType;
  quality?: QualityType;
  initialLocationId: string;
  initialCarryMode: CarryMode;
  displayName?: string | null;
  notes?: string | null;
}

interface UpdateCharacterEquipmentMetadataInput {
  conditionState: ItemConditionState;
  displayName?: string | null;
  isFavorite?: boolean | null;
  notes?: string | null;
}

type LoadoutSelectionKind =
  | "armor"
  | "shield"
  | "primary"
  | "secondary"
  | "missile";

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

function getActiveLoadoutForSnapshot(
  characterId: string,
  loadouts: CharacterLoadout[],
): CharacterLoadout {
  return (
    loadouts.find((loadout) => loadout.isActive) ??
    loadouts[0] ??
    buildDefaultLoadout(characterId)
  );
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

function buildCharacterEquipmentItemId(characterId: string): string {
  return `${characterId}:item-${randomUUID()}`;
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

function getReferencedLoadoutLabel(loadout: CharacterLoadout, itemId: string): string | null {
  if (loadout.wornArmorItemId === itemId) {
    return `loadout "${loadout.name}" worn armor`;
  }

  if (loadout.readyShieldItemId === itemId) {
    return `loadout "${loadout.name}" ready shield`;
  }

  if (loadout.activePrimaryWeaponItemId === itemId) {
    return `loadout "${loadout.name}" active primary weapon`;
  }

  if (loadout.activeSecondaryWeaponItemId === itemId) {
    return `loadout "${loadout.name}" active secondary weapon`;
  }

  if (loadout.activeMissileWeaponItemId === itemId) {
    return `loadout "${loadout.name}" active missile weapon`;
  }

  if (loadout.activeAmmoItemIds.includes(itemId)) {
    return `loadout "${loadout.name}" active ammo`;
  }

  if (loadout.quickAccessItemIds.includes(itemId)) {
    return `loadout "${loadout.name}" quick access items`;
  }

  return null;
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
    availabilityClass: LocationAvailabilityClass,
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
        availabilityClass,
        characterId,
        id: buildCustomLocationId(characterId, trimmedName),
        isAccessibleInEncounter: availabilityClass === "with_you",
        isMobile: availabilityClass === "with_you",
        name: trimmedName,
        notes: null,
        parentLocationId: null,
        type,
      }),
    );
  }

  async removeCharacterStorageLocation(
    characterId: string,
    locationId: string,
  ): Promise<void> {
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const location = assertLocationBelongsToCharacter(
      snapshot.locations.find((entry) => entry.id === locationId),
      characterId,
    );

    if (isSystemLocation(location)) {
      throw new Error("System locations cannot be deleted.");
    }

    if (
      snapshot.items.some((item) => item.storageAssignment.locationId === locationId)
    ) {
      throw new Error("Only empty custom locations can be deleted.");
    }

    await this.repository.removeCharacterStorageLocation(characterId, locationId);
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

  async addCharacterEquipmentItem(
    characterId: string,
    input: AddCharacterEquipmentItemInput,
  ): Promise<EquipmentItem> {
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const template = equipmentTemplatesById[input.templateId];

    if (!template) {
      throw new Error("Equipment template not found.");
    }

    assertLocationBelongsToCharacter(
      snapshot.locations.find((location) => location.id === input.initialLocationId),
      characterId,
    );

    const isStackable = template.category === "valuables";
    const quantity = Math.floor(input.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("quantity must be greater than zero");
    }

    if (!isStackable && quantity !== 1) {
      throw new Error("Only stackable items can have quantity greater than one.");
    }

    const durabilityMax =
      template.category === "weapon" ? (template.durabilityProfile?.maxDurabilityDefault ?? null) : null;

    const item = EquipmentItemSchema.parse({
      acquiredFrom: null,
      category: template.category,
      characterId,
      conditionState: "intact",
      displayName: input.displayName?.trim() ? input.displayName.trim() : null,
      durabilityCurrent: durabilityMax,
      durabilityMax,
      encumbranceOverride: null,
      id: buildCharacterEquipmentItemId(characterId),
      isEquipped: input.initialCarryMode === "equipped",
      isFavorite: null,
      isStackable,
      material: input.material ?? template.defaultMaterial,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      quality: input.quality ?? "standard",
      quantity,
      specialProperties: null,
      specificityType: template.specificityTypeDefault,
      statusTags: null,
      storageAssignment: {
        carryMode: input.initialCarryMode,
        locationId: input.initialLocationId,
      },
      templateId: template.id,
      valueOverride: null,
    });

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

  async removeCharacterEquipmentItem(
    characterId: string,
    itemId: string,
  ): Promise<void> {
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    assertItemBelongsToCharacter(
      snapshot.items.find((entry) => entry.id === itemId),
      characterId,
    );

    for (const loadout of snapshot.loadouts) {
      const referencedBy = getReferencedLoadoutLabel(loadout, itemId);

      if (referencedBy) {
        throw new Error(`Cannot remove item because it is referenced by ${referencedBy}.`);
      }
    }

    await this.repository.removeCharacterEquipmentItem(characterId, itemId);
  }

  async updateCharacterEquipmentQuantity(
    characterId: string,
    itemId: string,
    quantity: number,
  ): Promise<EquipmentItem> {
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const item = assertItemBelongsToCharacter(
      snapshot.items.find((entry) => entry.id === itemId),
      characterId,
    );

    if (!item.isStackable) {
      throw new Error("Only stackable items can have quantity updated.");
    }

    const normalizedQuantity = Math.floor(quantity);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      throw new Error("quantity must be greater than zero");
    }

    const updatedItem = EquipmentItemSchema.parse({
      ...item,
      quantity: normalizedQuantity,
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

    return this.repository.updateCharacterEquipmentItem(updatedItem);
  }

  async updateCharacterEquipmentMetadata(
    characterId: string,
    itemId: string,
    input: UpdateCharacterEquipmentMetadataInput,
  ): Promise<EquipmentItem> {
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const item = assertItemBelongsToCharacter(
      snapshot.items.find((entry) => entry.id === itemId),
      characterId,
    );

    const updatedItem = EquipmentItemSchema.parse({
      ...item,
      conditionState: input.conditionState,
      displayName: input.displayName?.trim() ? input.displayName.trim() : null,
      isFavorite: input.isFavorite ?? null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
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

    return this.repository.updateCharacterEquipmentItem(updatedItem);
  }

  async setCharacterWornArmor(
    characterId: string,
    itemId: string | null,
  ): Promise<CharacterLoadout> {
    return this.updateLoadoutSelection(characterId, "armor", itemId);
  }

  async setCharacterReadyShield(
    characterId: string,
    itemId: string | null,
  ): Promise<CharacterLoadout> {
    return this.updateLoadoutSelection(characterId, "shield", itemId);
  }

  async setCharacterActiveWeapon(
    characterId: string,
    slot: ActiveWeaponSlot,
    itemId: string | null,
  ): Promise<CharacterLoadout> {
    return this.updateLoadoutSelection(characterId, slot, itemId);
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

  private getSlotItemId(
    loadout: CharacterLoadout,
    kind: LoadoutSelectionKind,
  ): string | null | undefined {
    switch (kind) {
      case "armor":
        return loadout.wornArmorItemId;
      case "shield":
        return loadout.readyShieldItemId;
      case "primary":
        return loadout.activePrimaryWeaponItemId;
      case "secondary":
        return loadout.activeSecondaryWeaponItemId;
      case "missile":
        return loadout.activeMissileWeaponItemId;
    }
  }

  private setSlotItemId(
    loadout: CharacterLoadout,
    kind: LoadoutSelectionKind,
    itemId: string | null,
  ): CharacterLoadout {
    switch (kind) {
      case "armor":
        return { ...loadout, wornArmorItemId: itemId };
      case "shield":
        return { ...loadout, readyShieldItemId: itemId };
      case "primary":
        return { ...loadout, activePrimaryWeaponItemId: itemId };
      case "secondary":
        return { ...loadout, activeSecondaryWeaponItemId: itemId };
      case "missile":
        return { ...loadout, activeMissileWeaponItemId: itemId };
    }
  }

  private getTargetLocationForLoadoutSelection(
    kind: LoadoutSelectionKind,
    locations: StorageLocation[],
  ): StorageLocation {
    const expectedType =
      kind === "secondary" || kind === "missile" ? "person_system" : "equipped_system";
    const location = locations.find((entry) => entry.type === expectedType);

    if (!location) {
      throw new Error("Required system location not found.");
    }

    return location;
  }

  private getBackpackLocation(locations: StorageLocation[]): StorageLocation {
    const location = locations.find((entry) => entry.type === "backpack_system");

    if (!location) {
      throw new Error("Backpack system location not found.");
    }

    return location;
  }

  private async updateLoadoutSelection(
    characterId: string,
    kind: LoadoutSelectionKind,
    itemId: string | null,
  ): Promise<CharacterLoadout> {
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const currentLoadout = getActiveLoadoutForSnapshot(characterId, snapshot.loadouts);
    const previousItemId = this.getSlotItemId(currentLoadout, kind) ?? null;

    if (previousItemId === itemId) {
      return this.repository.upsertCharacterLoadout(
        this.setSlotItemId(currentLoadout, kind, itemId),
      );
    }

    const nextItemsById = indexById(snapshot.items);
    const targetLocation = this.getTargetLocationForLoadoutSelection(kind, snapshot.locations);
    const targetAssignment = getStorageAssignmentForLocation(targetLocation);
    const backpackLocation = this.getBackpackLocation(snapshot.locations);
    const fallbackAssignment = getStorageAssignmentForLocation(backpackLocation);

    const nextLoadout = this.setSlotItemId(currentLoadout, kind, itemId);
    const selectedItem = itemId
      ? assertItemBelongsToCharacter(nextItemsById[itemId], characterId)
      : undefined;
    const previousItem = previousItemId
      ? assertItemBelongsToCharacter(nextItemsById[previousItemId], characterId)
      : undefined;

    if (selectedItem) {
      const selectedLocation = assertLocationBelongsToCharacter(
        snapshot.locations.find(
          (location) => location.id === selectedItem.storageAssignment.locationId,
        ),
        characterId,
      );

      if (!isWithYouLocation(selectedLocation)) {
        throw new Error("Only items in with-you locations can be selected for loadout.");
      }

      const updatedSelectedItem = EquipmentItemSchema.parse({
        ...selectedItem,
        isEquipped: targetAssignment.carryMode === "equipped",
        storageAssignment: targetAssignment,
      });

      const selectedErrors = validateEquipmentItem(updatedSelectedItem);
      if (selectedErrors.length > 0) {
        throw new Error(selectedErrors.join("; "));
      }

      nextItemsById[selectedItem.id] = updatedSelectedItem;

      if (previousItem && previousItem.id !== selectedItem.id) {
        const selectedSourceAssignment = selectedItem.storageAssignment;
        const previousDestination =
          selectedSourceAssignment.locationId === targetAssignment.locationId &&
          selectedSourceAssignment.carryMode === targetAssignment.carryMode
            ? fallbackAssignment
            : selectedSourceAssignment;

        const updatedPreviousItem = EquipmentItemSchema.parse({
          ...previousItem,
          isEquipped: previousDestination.carryMode === "equipped",
          storageAssignment: previousDestination,
        });

        const previousErrors = validateEquipmentItem(updatedPreviousItem);
        if (previousErrors.length > 0) {
          throw new Error(previousErrors.join("; "));
        }

        nextItemsById[previousItem.id] = updatedPreviousItem;
      }
    } else if (previousItem) {
      const updatedPreviousItem = EquipmentItemSchema.parse({
        ...previousItem,
        isEquipped: false,
        storageAssignment: fallbackAssignment,
      });

      const previousErrors = validateEquipmentItem(updatedPreviousItem);
      if (previousErrors.length > 0) {
        throw new Error(previousErrors.join("; "));
      }

      nextItemsById[previousItem.id] = updatedPreviousItem;
    }

    const loadoutErrors = validateLoadout(nextLoadout, {
      itemsById: nextItemsById,
    });

    if (loadoutErrors.length > 0) {
      throw new Error(loadoutErrors.join("; "));
    }

    if (selectedItem && nextItemsById[selectedItem.id] !== selectedItem) {
      await this.repository.updateCharacterEquipmentItem(nextItemsById[selectedItem.id]);
    }

    if (
      previousItem &&
      nextItemsById[previousItem.id] !== previousItem &&
      previousItem.id !== selectedItem?.id
    ) {
      await this.repository.updateCharacterEquipmentItem(nextItemsById[previousItem.id]);
    }

    return this.repository.upsertCharacterLoadout(nextLoadout);
  }
}
