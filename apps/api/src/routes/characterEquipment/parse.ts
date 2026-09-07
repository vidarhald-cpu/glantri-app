import {
  CarryModeSchema,
  ItemConditionStateSchema,
  LocationAvailabilityClassSchema,
  MaterialTypeSchema,
  QualityTypeSchema,
  StorageLocationTypeSchema,
} from "@glantri/domain/equipment";

export function parseCharacterId(params: unknown): string {
  const id = params && typeof params === "object" && "id" in params ? params.id : undefined;

  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Character id is required.");
  }

  return id;
}

function parseExpectedEquipmentRevision(body: object): number {
  const revision =
    "expectedRevision" in body ? (body as Record<string, unknown>).expectedRevision : undefined;
  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) {
    throw new Error("A valid expected equipment revision is required. Reload before trying again.");
  }
  return revision;
}

export function parseMoveItemBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Move payload is required.");
  }

  const itemId = "itemId" in body ? body.itemId : undefined;
  const locationId = "locationId" in body ? body.locationId : undefined;
  const carryMode = "carryMode" in body ? body.carryMode : undefined;

  if (typeof itemId !== "string" || itemId.length === 0) {
    throw new Error("itemId is required.");
  }

  if (typeof locationId !== "string" || locationId.length === 0) {
    throw new Error("locationId is required.");
  }

  return {
    carryMode: CarryModeSchema.parse(carryMode),
    expectedRevision: parseExpectedEquipmentRevision(body),
    itemId,
    locationId,
  };
}

export function parseTransferItemBody(body: unknown): {
  campaignId: string;
  sourceExpectedRevision: number;
  targetCharacterId: string;
  targetExpectedRevision: number;
  targetStorageLocationId?: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Transfer details are required.");
  }

  const campaignId = "campaignId" in body ? body.campaignId : undefined;
  const targetCharacterId = "targetCharacterId" in body ? body.targetCharacterId : undefined;
  const targetStorageLocationId =
    "targetStorageLocationId" in body ? body.targetStorageLocationId : undefined;

  if (typeof campaignId !== "string" || campaignId.length === 0) {
    throw new Error("Choose the campaign containing this item.");
  }
  if (typeof targetCharacterId !== "string" || targetCharacterId.length === 0) {
    throw new Error("Choose the Character receiving the item.");
  }
  if (
    targetStorageLocationId !== undefined &&
    (typeof targetStorageLocationId !== "string" || targetStorageLocationId.length === 0)
  ) {
    throw new Error("Choose valid storage for the receiving Character.");
  }

  return {
    campaignId,
    sourceExpectedRevision: parseExpectedEquipmentRevision(body),
    targetExpectedRevision: (() => {
      const targetRevision =
        "targetExpectedRevision" in body ? body.targetExpectedRevision : undefined;
      if (
        typeof targetRevision !== "number" ||
        !Number.isInteger(targetRevision) ||
        targetRevision < 0
      ) {
        throw new Error(
          "A valid target equipment revision is required. Reload before trying again.",
        );
      }
      return targetRevision;
    })(),
    targetCharacterId,
    ...(targetStorageLocationId ? { targetStorageLocationId } : {}),
  };
}

export function parseCreateLocationBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Location payload is required.");
  }

  const name = "name" in body ? body.name : undefined;
  const type = "type" in body ? body.type : undefined;
  const availabilityClass = "availabilityClass" in body ? body.availabilityClass : undefined;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Location name is required.");
  }

  return {
    availabilityClass: LocationAvailabilityClassSchema.parse(availabilityClass),
    expectedRevision: parseExpectedEquipmentRevision(body),
    name,
    type: StorageLocationTypeSchema.parse(type),
  };
}

export function parseDeleteLocationBody(body: unknown): {
  expectedRevision: number;
  locationId: string;
} {
  if (!body || typeof body !== "object") {
    throw new Error("Delete location payload is required.");
  }

  const locationId = "locationId" in body ? body.locationId : undefined;

  if (typeof locationId !== "string" || locationId.length === 0) {
    throw new Error("locationId is required.");
  }

  return { expectedRevision: parseExpectedEquipmentRevision(body), locationId };
}

export function parseNullableItemIdBody(body: unknown): {
  expectedRevision: number;
  itemId: string | null;
} {
  if (!body || typeof body !== "object") {
    throw new Error("Loadout payload is required.");
  }

  const itemId = "itemId" in body ? body.itemId : undefined;

  if (itemId !== null && itemId !== undefined && typeof itemId !== "string") {
    throw new Error("itemId must be a string or null.");
  }

  return {
    expectedRevision: parseExpectedEquipmentRevision(body),
    itemId: typeof itemId === "string" && itemId.length === 0 ? null : (itemId ?? null),
  };
}

export function parseActiveAmmoBody(body: unknown): {
  expectedRevision: number;
  itemIds: string[];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Active ammunition payload is required.");
  }
  const itemIds = "itemIds" in body ? body.itemIds : undefined;
  if (
    !Array.isArray(itemIds) ||
    itemIds.some((itemId) => typeof itemId !== "string" || itemId.length === 0)
  ) {
    throw new Error("itemIds must be a list of Item ids.");
  }
  return { expectedRevision: parseExpectedEquipmentRevision(body), itemIds };
}

export function parseBootstrapSampleBody(body: unknown): { overwrite: boolean } {
  if (body == null) {
    return { overwrite: false };
  }

  if (typeof body !== "object") {
    throw new Error("Bootstrap payload must be an object.");
  }

  const overwrite = "overwrite" in body ? body.overwrite : undefined;

  if (overwrite !== undefined && typeof overwrite !== "boolean") {
    throw new Error("overwrite must be a boolean when provided.");
  }

  return { overwrite: overwrite ?? false };
}

export function parseAddItemBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Add item payload is required.");
  }

  const templateId = "templateId" in body ? body.templateId : undefined;
  const quantity = "quantity" in body ? body.quantity : undefined;
  const initialLocationId = "initialLocationId" in body ? body.initialLocationId : undefined;
  const initialCarryMode = "initialCarryMode" in body ? body.initialCarryMode : undefined;
  const material = "material" in body ? body.material : undefined;
  const quality = "quality" in body ? body.quality : undefined;
  const displayName = "displayName" in body ? body.displayName : undefined;
  const notes = "notes" in body ? body.notes : undefined;

  if (typeof templateId !== "string" || templateId.length === 0) {
    throw new Error("templateId is required.");
  }

  if (typeof initialLocationId !== "string" || initialLocationId.length === 0) {
    throw new Error("initialLocationId is required.");
  }

  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    throw new Error("quantity must be a number.");
  }

  if (displayName !== undefined && displayName !== null && typeof displayName !== "string") {
    throw new Error("displayName must be a string when provided.");
  }

  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    throw new Error("notes must be a string when provided.");
  }

  return {
    displayName: displayName ?? null,
    expectedRevision: parseExpectedEquipmentRevision(body),
    initialCarryMode: CarryModeSchema.parse(initialCarryMode),
    initialLocationId,
    material: material == null ? undefined : MaterialTypeSchema.parse(material),
    notes: notes ?? null,
    quality: quality == null ? undefined : QualityTypeSchema.parse(quality),
    quantity,
    templateId,
  };
}

export function parseRemoveItemBody(body: unknown): { expectedRevision: number; itemId: string } {
  if (!body || typeof body !== "object") {
    throw new Error("Remove item payload is required.");
  }

  const itemId = "itemId" in body ? body.itemId : undefined;

  if (typeof itemId !== "string" || itemId.length === 0) {
    throw new Error("itemId is required.");
  }

  return { expectedRevision: parseExpectedEquipmentRevision(body), itemId };
}

export function parseUpdateQuantityBody(body: unknown): {
  expectedRevision: number;
  itemId: string;
  quantity: number;
} {
  if (!body || typeof body !== "object") {
    throw new Error("Quantity payload is required.");
  }

  const itemId = "itemId" in body ? body.itemId : undefined;
  const quantity = "quantity" in body ? body.quantity : undefined;

  if (typeof itemId !== "string" || itemId.length === 0) {
    throw new Error("itemId is required.");
  }

  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    throw new Error("quantity must be a number.");
  }

  return { expectedRevision: parseExpectedEquipmentRevision(body), itemId, quantity };
}

export function parseUpdateMetadataBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Metadata payload is required.");
  }

  const itemId = "itemId" in body ? body.itemId : undefined;
  const displayName = "displayName" in body ? body.displayName : undefined;
  const conditionState = "conditionState" in body ? body.conditionState : undefined;
  const notes = "notes" in body ? body.notes : undefined;
  const isFavorite = "isFavorite" in body ? body.isFavorite : undefined;

  if (typeof itemId !== "string" || itemId.length === 0) {
    throw new Error("itemId is required.");
  }

  if (displayName !== undefined && displayName !== null && typeof displayName !== "string") {
    throw new Error("displayName must be a string when provided.");
  }

  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    throw new Error("notes must be a string when provided.");
  }

  if (isFavorite !== undefined && isFavorite !== null && typeof isFavorite !== "boolean") {
    throw new Error("isFavorite must be a boolean when provided.");
  }

  return {
    conditionState: ItemConditionStateSchema.parse(conditionState),
    displayName: displayName ?? null,
    expectedRevision: parseExpectedEquipmentRevision(body),
    isFavorite: isFavorite ?? null,
    itemId,
    notes: notes ?? null,
  };
}
