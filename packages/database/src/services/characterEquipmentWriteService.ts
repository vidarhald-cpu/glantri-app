import { createDefaultEquipmentLocations, equipmentTemplatesById } from "@glantri/content";
import {
  type AssignedEquipmentItem,
  type CanonicalEquipmentItem,
  type CarryMode,
  type CharacterLoadout,
  type EquipmentItem,
  type EquipmentItemInput,
  type EquipmentItemFactsV1,
  type ItemConditionState,
  type ItemStorageAssignment,
  type LocationAvailabilityClass,
  type MaterialType,
  type QualityType,
  type StorageLocation,
  type StorageLocationType,
  CharacterLoadoutSchema,
  CanonicalEquipmentItemSchema,
  EquipmentItemSchema,
  StorageLocationSchema,
  getStorageAssignmentForLocation,
  isSystemLocation,
  isWithYouLocation,
  validateEquipmentItem,
  validateLoadout,
} from "@glantri/domain";
import { projectEquipmentItem } from "@glantri/rules-engine";
import { randomUUID } from "node:crypto";

import {
  createPrismaCharacterEquipmentRepository,
  StaleEquipmentTransferError,
  type CharacterEquipmentRepository,
} from "../repositories/characterEquipmentRepository";

export { StaleEquipmentTransferError } from "../repositories/characterEquipmentRepository";
export { StaleCharacterEquipmentAggregateError } from "../repositories/characterEquipmentRepository";

export type ActiveWeaponSlot = "primary" | "secondary" | "missile";

export interface SampleCharacterEquipment {
  sampleCharacterId: string;
  sampleLocations: StorageLocation[];
  sampleEquipmentItems: EquipmentItem[];
  sampleActiveLoadout: CharacterLoadout;
}

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

type LoadoutSelectionKind = "armor" | "shield" | "primary" | "secondary" | "missile";

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
    loadouts.find((loadout) => loadout.isActive) ?? loadouts[0] ?? buildDefaultLoadout(characterId)
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

function buildCampaignEquipmentItemId(campaignId: string): string {
  return `${campaignId}:item-${randomUUID()}`;
}

export interface CreateCampaignEquipmentItemInput {
  campaignId: string;
  displayName?: string | null;
  holderCharacterId?: string | null;
  itemFacts: EquipmentItemFactsV1;
  notes?: string | null;
  templateId: string;
}

export interface UpdateCampaignEquipmentItemAuthoringInput {
  campaignId: string;
  displayName?: string | null;
  itemFacts: EquipmentItemFactsV1;
  itemId: string;
  notes?: string | null;
}

export interface TransferCampaignEquipmentItemInput {
  campaignId: string;
  itemId: string;
  sourceCharacterId: string;
  sourceExpectedRevision?: number;
  targetCharacterId: string;
  targetExpectedRevision?: number;
  targetStorageLocationId?: string;
}

function assertItemBelongsToCharacter(
  item: AssignedEquipmentItem | undefined,
  characterId: string,
): AssignedEquipmentItem {
  if (!item || item.characterId !== characterId) {
    throw new Error("Equipment item not found for character.");
  }

  return item;
}

function assertCharacterEquipmentAuthoringAllowed(item: AssignedEquipmentItem): void {
  if (item.campaignContextId) {
    throw new Error("Campaign item details can only be changed from Campaign Items.");
  }
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

function assignmentsMatch(
  left: ItemStorageAssignment | null | undefined,
  right: ItemStorageAssignment | null | undefined,
): boolean {
  return left?.locationId === right?.locationId && left?.carryMode === right?.carryMode;
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
    private readonly isWithinAggregate = false,
  ) {}

  private async mutateAggregate<T>(
    characterId: string,
    expectedRevision: number,
    mutation: (service: CharacterEquipmentWriteService) => Promise<T>,
  ): Promise<T> {
    const committed = await this.repository.mutateCharacterEquipmentAggregate({
      characterId,
      expectedRevision,
      mutation: (repository) => mutation(new CharacterEquipmentWriteService(repository, true)),
    });
    return committed.result;
  }

  async createCampaignEquipmentItem(
    input: CreateCampaignEquipmentItemInput,
  ): Promise<CanonicalEquipmentItem> {
    const template = equipmentTemplatesById[input.templateId];
    if (!template) {
      throw new Error("Equipment template not found.");
    }

    let storageAssignment: ItemStorageAssignment | null = null;
    if (input.holderCharacterId) {
      const snapshot = await this.ensureCharacterEquipmentInitialized(input.holderCharacterId);
      const onPersonLocation = snapshot.locations.find(
        (location) => location.type === "person_system",
      );
      if (!onPersonLocation) {
        throw new Error("The selected Character has no valid equipment location.");
      }
      storageAssignment = getStorageAssignmentForLocation(onPersonLocation);
    }

    const durabilityMax =
      template.category === "weapon"
        ? (template.durabilityProfile?.maxDurabilityDefault ?? null)
        : null;
    const item = CanonicalEquipmentItemSchema.parse({
      acquiredFrom: null,
      campaignContextId: input.campaignId,
      category: template.category,
      characterId: input.holderCharacterId ?? null,
      conditionState: "intact",
      displayName: input.displayName?.trim() || null,
      durabilityCurrent: durabilityMax,
      durabilityMax,
      encumbranceOverride: null,
      holderCharacterId: input.holderCharacterId ?? null,
      id: buildCampaignEquipmentItemId(input.campaignId),
      isEquipped: false,
      isFavorite: null,
      isStackable: template.category === "valuables",
      itemFacts: input.itemFacts,
      material: template.defaultMaterial,
      notes: input.notes?.trim() || null,
      previousStorageAssignment: null,
      quality: "standard",
      quantity: 1,
      specificityType: template.specificityTypeDefault,
      statusTags: null,
      storageAssignment,
      templateId: template.id,
      valueOverride: null,
    });

    projectEquipmentItem(item, template);
    if (item.holderCharacterId) {
      const aggregate = await this.repository.getCharacterEquipmentAggregateState(
        item.holderCharacterId,
      );
      return this.mutateAggregate(item.holderCharacterId, aggregate.revision, (service) =>
        service.repository.createCampaignEquipmentItem(item),
      );
    }
    return this.repository.createCampaignEquipmentItem(item);
  }

  async updateCampaignEquipmentItemAuthoring(
    input: UpdateCampaignEquipmentItemAuthoringInput,
  ): Promise<CanonicalEquipmentItem> {
    const existing = await this.repository.getCanonicalEquipmentItemById(input.itemId);
    if (!existing || existing.campaignContextId !== input.campaignId) {
      throw new Error("Campaign item not found.");
    }

    const template = equipmentTemplatesById[existing.templateId];
    if (!template) {
      throw new Error("Equipment template not found.");
    }

    const updated = CanonicalEquipmentItemSchema.parse({
      ...existing,
      displayName: input.displayName?.trim() || null,
      itemFacts: input.itemFacts,
      notes: input.notes?.trim() || null,
    });
    projectEquipmentItem(updated, template);

    return this.repository.updateCampaignEquipmentItemAuthoring(updated);
  }

  async transferCampaignEquipmentItem(
    input: TransferCampaignEquipmentItemInput,
  ): Promise<CanonicalEquipmentItem> {
    if (input.sourceCharacterId === input.targetCharacterId) {
      throw new Error("Choose a different Character to receive this item.");
    }

    const existing = await this.repository.getCanonicalEquipmentItemById(input.itemId);
    if (!existing || existing.campaignContextId !== input.campaignId) {
      throw new Error("Campaign item not found.");
    }
    if (!existing.holderCharacterId) {
      throw new Error("Only an item held by a Character can be transferred.");
    }
    if (existing.holderCharacterId !== input.sourceCharacterId) {
      throw new StaleEquipmentTransferError();
    }

    const targetLocations = input.targetStorageLocationId
      ? await this.repository.getCharacterStorageLocations(input.targetCharacterId)
      : createDefaultEquipmentLocations(input.targetCharacterId);
    const targetLocation = input.targetStorageLocationId
      ? targetLocations.find((location) => location.id === input.targetStorageLocationId)
      : targetLocations.find((location) => location.type === "person_system");
    if (!targetLocation || targetLocation.characterId !== input.targetCharacterId) {
      throw new Error("The receiving Character has no valid storage for this transfer.");
    }

    const targetStorageAssignment = getStorageAssignmentForLocation(targetLocation);
    if (targetStorageAssignment.carryMode === "equipped") {
      throw new Error("Choose storage where the item will not be equipped.");
    }

    return this.repository.transferCampaignEquipmentItem({
      campaignId: input.campaignId,
      itemId: input.itemId,
      sourceCharacterId: input.sourceCharacterId,
      sourceExpectedRevision: input.sourceExpectedRevision,
      targetCharacterId: input.targetCharacterId,
      targetExpectedRevision: input.targetExpectedRevision,
      targetStorageAssignment,
    });
  }

  async ensureCharacterEquipmentInitialized(
    characterId: string,
    withinAggregate = false,
  ): Promise<{
    items: AssignedEquipmentItem[];
    loadouts: CharacterLoadout[];
    locations: StorageLocation[];
  }> {
    const snapshot = await this.repository.getCharacterEquipmentState(characterId);

    const needsInitialization =
      snapshot.locations.length === 0 ||
      snapshot.loadouts.length === 0 ||
      !snapshot.loadouts.some((loadout) => loadout.isActive);
    if (needsInitialization && !withinAggregate && !this.isWithinAggregate) {
      return this.mutateAggregate(characterId, snapshot.revision, (service) =>
        service.ensureCharacterEquipmentInitialized(characterId, true),
      );
    }

    await this.repository.ensureDefaultEquipmentLocations(characterId);

    const initialized = await this.repository.getCharacterEquipmentState(characterId);

    if (initialized.loadouts.length === 0) {
      const loadout = await this.repository.upsertCharacterLoadout(
        buildDefaultLoadout(characterId),
      );

      return {
        items: initialized.items,
        loadouts: [loadout],
        locations: initialized.locations,
      };
    }

    if (!initialized.loadouts.some((loadout) => loadout.isActive)) {
      const first = initialized.loadouts[0];
      const activeLoadout = await this.repository.upsertCharacterLoadout({
        ...first,
        isActive: true,
      });

      return {
        items: initialized.items,
        loadouts: [activeLoadout, ...initialized.loadouts.slice(1)],
        locations: initialized.locations,
      };
    }

    return initialized;
  }

  async createCharacterStorageLocation(
    characterId: string,
    name: string,
    type: StorageLocationType,
    availabilityClass: LocationAvailabilityClass,
    expectedRevision?: number,
  ): Promise<StorageLocation> {
    if (expectedRevision !== undefined) {
      return this.mutateAggregate(characterId, expectedRevision, (service) =>
        service.createCharacterStorageLocation(characterId, name, type, availabilityClass),
      );
    }
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
    expectedRevision?: number,
  ): Promise<void> {
    if (expectedRevision !== undefined) {
      return this.mutateAggregate(characterId, expectedRevision, (service) =>
        service.removeCharacterStorageLocation(characterId, locationId),
      );
    }
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const location = assertLocationBelongsToCharacter(
      snapshot.locations.find((entry) => entry.id === locationId),
      characterId,
    );

    if (isSystemLocation(location)) {
      throw new Error("System locations cannot be deleted.");
    }

    if (snapshot.items.some((item) => item.storageAssignment.locationId === locationId)) {
      throw new Error("Only empty custom locations can be deleted.");
    }

    await this.repository.removeCharacterStorageLocation(characterId, locationId);
  }

  async createCharacterEquipmentItem(
    input: EquipmentItemInput,
    expectedRevision?: number,
  ): Promise<AssignedEquipmentItem> {
    const canonicalItem = CanonicalEquipmentItemSchema.parse(input);
    if (!canonicalItem.holderCharacterId || !canonicalItem.storageAssignment) {
      throw new Error("This pilot workflow requires a Character holder and valid holder location.");
    }

    const item = EquipmentItemSchema.parse(canonicalItem);
    if (expectedRevision !== undefined) {
      return this.mutateAggregate(item.characterId, expectedRevision, (service) =>
        service.createCharacterEquipmentItem(item),
      );
    }
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
    expectedRevision?: number,
  ): Promise<AssignedEquipmentItem> {
    if (expectedRevision !== undefined) {
      return this.mutateAggregate(characterId, expectedRevision, (service) =>
        service.addCharacterEquipmentItem(characterId, input),
      );
    }
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
      template.category === "weapon"
        ? (template.durabilityProfile?.maxDurabilityDefault ?? null)
        : null;

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

  async updateCharacterEquipmentItem(
    input: EquipmentItemInput,
    expectedRevision?: number,
  ): Promise<AssignedEquipmentItem> {
    const item = EquipmentItemSchema.parse(input);
    if (expectedRevision !== undefined) {
      return this.mutateAggregate(item.characterId, expectedRevision, (service) =>
        service.updateCharacterEquipmentItem(item),
      );
    }
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
    expectedRevision?: number,
  ): Promise<AssignedEquipmentItem> {
    if (expectedRevision !== undefined) {
      return this.mutateAggregate(characterId, expectedRevision, (service) =>
        service.moveCharacterEquipmentItem(characterId, itemId, locationId, carryMode),
      );
    }
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
      previousStorageAssignment:
        carryMode === "equipped"
          ? item.isEquipped
            ? (item.previousStorageAssignment ?? null)
            : item.storageAssignment
          : null,
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

    return this.repository.updateCharacterEquipmentItem(updatedItem);
  }

  async removeCharacterEquipmentItem(
    characterId: string,
    itemId: string,
    expectedRevision?: number,
  ): Promise<void> {
    if (expectedRevision !== undefined) {
      return this.mutateAggregate(characterId, expectedRevision, (service) =>
        service.removeCharacterEquipmentItem(characterId, itemId),
      );
    }
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const item = assertItemBelongsToCharacter(
      snapshot.items.find((entry) => entry.id === itemId),
      characterId,
    );
    assertCharacterEquipmentAuthoringAllowed(item);

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
    expectedRevision?: number,
  ): Promise<AssignedEquipmentItem> {
    if (expectedRevision !== undefined) {
      return this.mutateAggregate(characterId, expectedRevision, (service) =>
        service.updateCharacterEquipmentQuantity(characterId, itemId, quantity),
      );
    }
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const item = assertItemBelongsToCharacter(
      snapshot.items.find((entry) => entry.id === itemId),
      characterId,
    );
    assertCharacterEquipmentAuthoringAllowed(item);

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
    expectedRevision?: number,
  ): Promise<AssignedEquipmentItem> {
    if (expectedRevision !== undefined) {
      return this.mutateAggregate(characterId, expectedRevision, (service) =>
        service.updateCharacterEquipmentMetadata(characterId, itemId, input),
      );
    }
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const item = assertItemBelongsToCharacter(
      snapshot.items.find((entry) => entry.id === itemId),
      characterId,
    );
    assertCharacterEquipmentAuthoringAllowed(item);

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
    expectedRevision?: number,
  ): Promise<CharacterLoadout> {
    return this.updateLoadoutSelection(characterId, "armor", itemId, expectedRevision);
  }

  async setCharacterReadyShield(
    characterId: string,
    itemId: string | null,
    expectedRevision?: number,
  ): Promise<CharacterLoadout> {
    return this.updateLoadoutSelection(characterId, "shield", itemId, expectedRevision);
  }

  async setCharacterActiveWeapon(
    characterId: string,
    slot: ActiveWeaponSlot,
    itemId: string | null,
    expectedRevision?: number,
  ): Promise<CharacterLoadout> {
    return this.updateLoadoutSelection(characterId, slot, itemId, expectedRevision);
  }

  async setCharacterActiveAmmunition(
    characterId: string,
    itemIds: string[],
    expectedRevision?: number,
  ): Promise<CharacterLoadout> {
    if (expectedRevision !== undefined) {
      return this.mutateAggregate(characterId, expectedRevision, (service) =>
        service.setCharacterActiveAmmunition(characterId, itemIds),
      );
    }
    if (new Set(itemIds).size !== itemIds.length) {
      throw new Error("Active ammunition cannot contain the same Item twice.");
    }
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const loadout = getActiveLoadoutForSnapshot(characterId, snapshot.loadouts);
    if (itemIds.length > 0 && !loadout.activeMissileWeaponItemId) {
      throw new Error("Choose an active missile weapon before selecting ammunition.");
    }
    const missileWeapon = loadout.activeMissileWeaponItemId
      ? assertItemBelongsToCharacter(
          snapshot.items.find((item) => item.id === loadout.activeMissileWeaponItemId),
          characterId,
        )
      : undefined;
    const missileTemplate = missileWeapon
      ? equipmentTemplatesById[missileWeapon.templateId]
      : undefined;
    const missileProfile =
      missileTemplate?.category === "weapon" ? missileTemplate.missileProfile : undefined;
    if (itemIds.length > 0 && !missileProfile) {
      throw new Error("The active missile weapon does not support ammunition selection.");
    }
    for (const itemId of itemIds) {
      const item = assertItemBelongsToCharacter(
        snapshot.items.find((candidate) => candidate.id === itemId),
        characterId,
      );
      const ammoTemplate = equipmentTemplatesById[item.templateId];
      const ammoProfile =
        ammoTemplate?.category === "gear" ? ammoTemplate.ammunitionProfile : undefined;
      if (!ammoProfile || ammoProfile.family !== missileProfile?.ammoFamily) {
        throw new Error("Selected ammunition is not compatible with the active missile weapon.");
      }
    }
    const nextLoadout = CharacterLoadoutSchema.parse({ ...loadout, activeAmmoItemIds: itemIds });
    const errors = validateLoadout(nextLoadout, { itemsById: indexById(snapshot.items) });
    if (errors.length > 0) throw new Error(errors.join("; "));
    return this.repository.upsertCharacterLoadout(nextLoadout);
  }

  async bootstrapSampleCharacterEquipment(
    characterId: string,
    sampleEquipment: SampleCharacterEquipment,
    options?: {
      overwrite?: boolean;
    },
  ): Promise<void> {
    const snapshot = await this.ensureCharacterEquipmentInitialized(characterId);
    const hasCustomLocations = snapshot.locations.some(
      (location) => !location.type.endsWith("_system"),
    );

    if ((snapshot.items.length > 0 || hasCustomLocations) && !options?.overwrite) {
      throw new Error("Sample equipment bootstrap is only available for an empty equipment state.");
    }

    if (options?.overwrite) {
      throw new Error("Sample equipment overwrite is not supported yet.");
    }

    for (const location of sampleEquipment.sampleLocations.filter(
      (entry) => !entry.type.endsWith("_system"),
    )) {
      await this.repository.createCharacterStorageLocation(
        StorageLocationSchema.parse({
          ...location,
          characterId,
          id: location.id.replace(sampleEquipment.sampleCharacterId, characterId),
        }),
      );
    }

    for (const item of sampleEquipment.sampleEquipmentItems) {
      await this.repository.createCharacterEquipmentItem(
        EquipmentItemSchema.parse({
          ...item,
          characterId,
          id: buildBootstrapItemId(characterId, item.id),
          storageAssignment: {
            ...item.storageAssignment,
            locationId: item.storageAssignment.locationId.replace(
              sampleEquipment.sampleCharacterId,
              characterId,
            ),
          },
        }),
      );
    }

    await this.repository.upsertCharacterLoadout(
      CharacterLoadoutSchema.parse({
        ...sampleEquipment.sampleActiveLoadout,
        activeMissileWeaponItemId: sampleEquipment.sampleActiveLoadout.activeMissileWeaponItemId
          ? buildBootstrapItemId(
              characterId,
              sampleEquipment.sampleActiveLoadout.activeMissileWeaponItemId,
            )
          : null,
        activePrimaryWeaponItemId: sampleEquipment.sampleActiveLoadout.activePrimaryWeaponItemId
          ? buildBootstrapItemId(
              characterId,
              sampleEquipment.sampleActiveLoadout.activePrimaryWeaponItemId,
            )
          : null,
        activeSecondaryWeaponItemId: sampleEquipment.sampleActiveLoadout.activeSecondaryWeaponItemId
          ? buildBootstrapItemId(
              characterId,
              sampleEquipment.sampleActiveLoadout.activeSecondaryWeaponItemId,
            )
          : null,
        characterId,
        id: `${characterId}:loadout-current`,
        readyShieldItemId: sampleEquipment.sampleActiveLoadout.readyShieldItemId
          ? buildBootstrapItemId(characterId, sampleEquipment.sampleActiveLoadout.readyShieldItemId)
          : null,
        wornArmorItemId: sampleEquipment.sampleActiveLoadout.wornArmorItemId
          ? buildBootstrapItemId(characterId, sampleEquipment.sampleActiveLoadout.wornArmorItemId)
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

  private getRestoredStorageAssignment(
    item: AssignedEquipmentItem,
    locations: StorageLocation[],
    fallbackAssignment: ItemStorageAssignment,
  ): ItemStorageAssignment {
    const previousAssignment = item.previousStorageAssignment;
    if (!previousAssignment || previousAssignment.carryMode === "equipped") {
      return fallbackAssignment;
    }

    const previousLocation = locations.find(
      (location) => location.id === previousAssignment.locationId,
    );

    if (!previousLocation || previousLocation.characterId !== item.characterId) {
      return fallbackAssignment;
    }

    return previousAssignment;
  }

  private buildEquippedLoadoutItem(
    item: AssignedEquipmentItem,
    targetAssignment: ItemStorageAssignment,
  ): AssignedEquipmentItem {
    const nextPreviousStorageAssignment =
      item.storageAssignment.carryMode === "equipped"
        ? (item.previousStorageAssignment ?? null)
        : item.storageAssignment;

    return EquipmentItemSchema.parse({
      ...item,
      isEquipped: targetAssignment.carryMode === "equipped",
      previousStorageAssignment: nextPreviousStorageAssignment,
      storageAssignment: targetAssignment,
    });
  }

  private buildStoredLoadoutItem(
    item: AssignedEquipmentItem,
    destinationAssignment: ItemStorageAssignment,
  ): AssignedEquipmentItem {
    return EquipmentItemSchema.parse({
      ...item,
      isEquipped: destinationAssignment.carryMode === "equipped",
      previousStorageAssignment: null,
      storageAssignment: destinationAssignment,
    });
  }

  private async updateLoadoutSelection(
    characterId: string,
    kind: LoadoutSelectionKind,
    itemId: string | null,
    expectedRevision?: number,
  ): Promise<CharacterLoadout> {
    if (expectedRevision !== undefined) {
      return this.mutateAggregate(characterId, expectedRevision, (service) =>
        service.updateLoadoutSelection(characterId, kind, itemId),
      );
    }
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

      const updatedSelectedItem = this.buildEquippedLoadoutItem(selectedItem, targetAssignment);

      const selectedErrors = validateEquipmentItem(updatedSelectedItem);
      if (selectedErrors.length > 0) {
        throw new Error(selectedErrors.join("; "));
      }

      nextItemsById[selectedItem.id] = updatedSelectedItem;

      if (previousItem && previousItem.id !== selectedItem.id) {
        const selectedSourceAssignment = selectedItem.storageAssignment;
        const restoredPreviousAssignment = this.getRestoredStorageAssignment(
          previousItem,
          snapshot.locations,
          fallbackAssignment,
        );
        const previousDestination = assignmentsMatch(selectedSourceAssignment, targetAssignment)
          ? restoredPreviousAssignment
          : selectedSourceAssignment;

        const updatedPreviousItem = this.buildStoredLoadoutItem(previousItem, previousDestination);

        const previousErrors = validateEquipmentItem(updatedPreviousItem);
        if (previousErrors.length > 0) {
          throw new Error(previousErrors.join("; "));
        }

        nextItemsById[previousItem.id] = updatedPreviousItem;
      }
    } else if (previousItem) {
      const updatedPreviousItem = this.buildStoredLoadoutItem(
        previousItem,
        this.getRestoredStorageAssignment(previousItem, snapshot.locations, fallbackAssignment),
      );

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
