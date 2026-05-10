import type {
  CarryMode,
  ItemConditionState,
  LocationAvailabilityClass,
  MaterialType,
  QualityType,
  StorageLocationType
} from "@glantri/domain/equipment";

import type { EquipmentFeatureState } from "../../features/equipment/types";
import { sendJson } from "./apiClient";

export interface EquipmentStateResponse {
  state: EquipmentFeatureState;
}

export async function loadCharacterEquipmentState(
  characterId: string
): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(`/characters/${characterId}/equipment`, {
    method: "GET"
  });

  return payload.state;
}

export async function moveCharacterEquipmentItemOnServer(input: {
  carryMode: CarryMode;
  characterId: string;
  itemId: string;
  locationId: string;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/move`,
    {
      body: JSON.stringify({
        carryMode: input.carryMode,
        itemId: input.itemId,
        locationId: input.locationId
      }),
      method: "POST"
    }
  );

  return payload.state;
}

export async function createCharacterStorageLocationOnServer(input: {
  availabilityClass: LocationAvailabilityClass;
  characterId: string;
  name: string;
  type: StorageLocationType;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/locations`,
    {
      body: JSON.stringify({
        availabilityClass: input.availabilityClass,
        name: input.name,
        type: input.type
      }),
      method: "POST"
    }
  );

  return payload.state;
}

export async function removeCharacterStorageLocationOnServer(input: {
  characterId: string;
  locationId: string;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/locations/remove`,
    {
      body: JSON.stringify({
        locationId: input.locationId
      }),
      method: "POST"
    }
  );

  return payload.state;
}

export async function bootstrapSampleCharacterEquipmentOnServer(input: {
  characterId: string;
  overwrite?: boolean;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/bootstrap-sample`,
    {
      body: JSON.stringify({
        overwrite: input.overwrite ?? false
      }),
      method: "POST"
    }
  );

  return payload.state;
}

export async function addCharacterEquipmentItemOnServer(input: {
  characterId: string;
  templateId: string;
  quantity: number;
  initialLocationId: string;
  initialCarryMode: CarryMode;
  material?: MaterialType;
  quality?: QualityType;
  displayName?: string | null;
  notes?: string | null;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/items`,
    {
      body: JSON.stringify({
        displayName: input.displayName ?? null,
        initialCarryMode: input.initialCarryMode,
        initialLocationId: input.initialLocationId,
        material: input.material,
        notes: input.notes ?? null,
        quality: input.quality,
        quantity: input.quantity,
        templateId: input.templateId
      }),
      method: "POST"
    }
  );

  return payload.state;
}

export async function removeCharacterEquipmentItemOnServer(input: {
  characterId: string;
  itemId: string;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/items/remove`,
    {
      body: JSON.stringify({
        itemId: input.itemId
      }),
      method: "POST"
    }
  );

  return payload.state;
}

export async function updateCharacterEquipmentQuantityOnServer(input: {
  characterId: string;
  itemId: string;
  quantity: number;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/items/quantity`,
    {
      body: JSON.stringify({
        itemId: input.itemId,
        quantity: input.quantity
      }),
      method: "POST"
    }
  );

  return payload.state;
}

export async function updateCharacterEquipmentMetadataOnServer(input: {
  characterId: string;
  itemId: string;
  displayName?: string | null;
  conditionState: ItemConditionState;
  notes?: string | null;
  isFavorite?: boolean | null;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/items/metadata`,
    {
      body: JSON.stringify({
        conditionState: input.conditionState,
        displayName: input.displayName ?? null,
        isFavorite: input.isFavorite ?? null,
        itemId: input.itemId,
        notes: input.notes ?? null
      }),
      method: "POST"
    }
  );

  return payload.state;
}

async function updateCharacterLoadoutOnServer(input: {
  characterId: string;
  itemId: string | null;
  path:
    | "worn-armor"
    | "ready-shield"
    | "active-primary-weapon"
    | "active-secondary-weapon"
    | "active-missile-weapon";
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/loadout/${input.path}`,
    {
      body: JSON.stringify({
        itemId: input.itemId
      }),
      method: "POST"
    }
  );

  return payload.state;
}

export async function setCharacterWornArmorOnServer(input: {
  characterId: string;
  itemId: string | null;
}): Promise<EquipmentFeatureState> {
  return updateCharacterLoadoutOnServer({
    characterId: input.characterId,
    itemId: input.itemId,
    path: "worn-armor"
  });
}

export async function setCharacterReadyShieldOnServer(input: {
  characterId: string;
  itemId: string | null;
}): Promise<EquipmentFeatureState> {
  return updateCharacterLoadoutOnServer({
    characterId: input.characterId,
    itemId: input.itemId,
    path: "ready-shield"
  });
}

export async function setCharacterActivePrimaryWeaponOnServer(input: {
  characterId: string;
  itemId: string | null;
}): Promise<EquipmentFeatureState> {
  return updateCharacterLoadoutOnServer({
    characterId: input.characterId,
    itemId: input.itemId,
    path: "active-primary-weapon"
  });
}

export async function setCharacterActiveSecondaryWeaponOnServer(input: {
  characterId: string;
  itemId: string | null;
}): Promise<EquipmentFeatureState> {
  return updateCharacterLoadoutOnServer({
    characterId: input.characterId,
    itemId: input.itemId,
    path: "active-secondary-weapon"
  });
}

export async function setCharacterActiveMissileWeaponOnServer(input: {
  characterId: string;
  itemId: string | null;
}): Promise<EquipmentFeatureState> {
  return updateCharacterLoadoutOnServer({
    characterId: input.characterId,
    itemId: input.itemId,
    path: "active-missile-weapon"
  });
}
