import type {
  CanonicalEquipmentItem,
  CarryMode,
  DescriptiveItemTraitCategory,
  EquipmentTemplate,
  EquipmentTemplateOverrideFact,
  ItemFactVisibility,
  ItemConditionState,
  LocationAvailabilityClass,
  MaterialType,
  QualityType,
  StorageLocationType,
} from "@glantri/domain/equipment";

import type { EquipmentFeatureState } from "../../features/equipment/types";
import { sendJson } from "./apiClient";

export interface CampaignItemCharacterOption {
  id: string;
  name: string;
}

export interface CampaignEquipmentState {
  itemsById: Record<string, CanonicalEquipmentItem>;
  templatesById: Record<string, EquipmentTemplate>;
}

export interface CampaignItemFactDraft {
  initiativeOverride?: {
    id?: string;
    value: number;
    visibility: ItemFactVisibility;
  } | null;
  finalAttackObDelta?: {
    id?: string;
    value: number;
    visibility: ItemFactVisibility;
  } | null;
  templateOverrides: Array<
    Exclude<EquipmentTemplateOverrideFact, { kind: "weapon_initiative_override" }>
  >;
  descriptiveTraits: Array<{
    category: DescriptiveItemTraitCategory;
    id?: string;
    text: string;
    visibility: ItemFactVisibility;
  }>;
  unsupportedCapabilities: Array<{
    id?: string;
    name: string;
    rulesText: string;
    usageText?: string | null;
    visibility: ItemFactVisibility;
  }>;
}

export interface CampaignItemsResponse {
  characters: CampaignItemCharacterOption[];
  state: CampaignEquipmentState;
}

export interface EquipmentStateResponse {
  state: EquipmentFeatureState;
}

export async function loadCharacterEquipmentState(
  characterId: string,
): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(`/characters/${characterId}/equipment`, {
    method: "GET",
  });

  return payload.state;
}

export async function loadCampaignItems(campaignId: string): Promise<CampaignItemsResponse> {
  return sendJson<CampaignItemsResponse>(`/campaigns/${campaignId}/items`, { method: "GET" });
}

export async function createCampaignItemOnServer(input: {
  campaignId: string;
  description?: string | null;
  displayName?: string | null;
  facts: CampaignItemFactDraft;
  holderCharacterId?: string | null;
  templateId: string;
}): Promise<CampaignItemsResponse> {
  return sendJson<CampaignItemsResponse>(`/campaigns/${input.campaignId}/items`, {
    body: JSON.stringify({
      description: input.description ?? null,
      displayName: input.displayName ?? null,
      facts: input.facts,
      holderCharacterId: input.holderCharacterId ?? null,
      templateId: input.templateId,
    }),
    method: "POST",
  });
}

export async function updateCampaignItemOnServer(input: {
  campaignId: string;
  description?: string | null;
  displayName?: string | null;
  facts: CampaignItemFactDraft;
  itemId: string;
}): Promise<CampaignItemsResponse> {
  return sendJson<CampaignItemsResponse>(`/campaigns/${input.campaignId}/items/${input.itemId}`, {
    body: JSON.stringify({
      description: input.description ?? null,
      displayName: input.displayName ?? null,
      facts: input.facts,
    }),
    method: "PATCH",
  });
}

export async function transferCampaignItemOnServer(input: {
  campaignId: string;
  itemId: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  sourceExpectedRevision: number;
  targetExpectedRevision: number;
}): Promise<CampaignItemsResponse> {
  return sendJson<CampaignItemsResponse>(
    `/characters/${input.sourceCharacterId}/equipment/items/${input.itemId}/transfer`,
    {
      body: JSON.stringify({
        campaignId: input.campaignId,
        expectedRevision: input.sourceExpectedRevision,
        targetCharacterId: input.targetCharacterId,
        targetExpectedRevision: input.targetExpectedRevision,
      }),
      method: "POST",
    },
  );
}

export async function moveCharacterEquipmentItemOnServer(input: {
  carryMode: CarryMode;
  characterId: string;
  itemId: string;
  locationId: string;
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/move`,
    {
      body: JSON.stringify({
        carryMode: input.carryMode,
        expectedRevision: input.expectedRevision,
        itemId: input.itemId,
        locationId: input.locationId,
      }),
      method: "POST",
    },
  );

  return payload.state;
}

export async function createCharacterStorageLocationOnServer(input: {
  availabilityClass: LocationAvailabilityClass;
  characterId: string;
  name: string;
  type: StorageLocationType;
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/locations`,
    {
      body: JSON.stringify({
        availabilityClass: input.availabilityClass,
        expectedRevision: input.expectedRevision,
        name: input.name,
        type: input.type,
      }),
      method: "POST",
    },
  );

  return payload.state;
}

export async function removeCharacterStorageLocationOnServer(input: {
  characterId: string;
  locationId: string;
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/locations/remove`,
    {
      body: JSON.stringify({
        locationId: input.locationId,
        expectedRevision: input.expectedRevision,
      }),
      method: "POST",
    },
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
        overwrite: input.overwrite ?? false,
      }),
      method: "POST",
    },
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
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/items`,
    {
      body: JSON.stringify({
        displayName: input.displayName ?? null,
        expectedRevision: input.expectedRevision,
        initialCarryMode: input.initialCarryMode,
        initialLocationId: input.initialLocationId,
        material: input.material,
        notes: input.notes ?? null,
        quality: input.quality,
        quantity: input.quantity,
        templateId: input.templateId,
      }),
      method: "POST",
    },
  );

  return payload.state;
}

export async function removeCharacterEquipmentItemOnServer(input: {
  characterId: string;
  itemId: string;
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/items/remove`,
    {
      body: JSON.stringify({
        itemId: input.itemId,
        expectedRevision: input.expectedRevision,
      }),
      method: "POST",
    },
  );

  return payload.state;
}

export async function updateCharacterEquipmentQuantityOnServer(input: {
  characterId: string;
  itemId: string;
  quantity: number;
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/items/quantity`,
    {
      body: JSON.stringify({
        itemId: input.itemId,
        expectedRevision: input.expectedRevision,
        quantity: input.quantity,
      }),
      method: "POST",
    },
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
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/items/metadata`,
    {
      body: JSON.stringify({
        conditionState: input.conditionState,
        expectedRevision: input.expectedRevision,
        displayName: input.displayName ?? null,
        isFavorite: input.isFavorite ?? null,
        itemId: input.itemId,
        notes: input.notes ?? null,
      }),
      method: "POST",
    },
  );

  return payload.state;
}

async function updateCharacterLoadoutOnServer(input: {
  characterId: string;
  itemId: string | null;
  expectedRevision: number;
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
        itemId: input.itemId,
        expectedRevision: input.expectedRevision,
      }),
      method: "POST",
    },
  );

  return payload.state;
}

export async function setCharacterWornArmorOnServer(input: {
  characterId: string;
  itemId: string | null;
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  return updateCharacterLoadoutOnServer({
    characterId: input.characterId,
    itemId: input.itemId,
    expectedRevision: input.expectedRevision,
    path: "worn-armor",
  });
}

export async function setCharacterReadyShieldOnServer(input: {
  characterId: string;
  itemId: string | null;
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  return updateCharacterLoadoutOnServer({
    characterId: input.characterId,
    itemId: input.itemId,
    expectedRevision: input.expectedRevision,
    path: "ready-shield",
  });
}

export async function setCharacterActivePrimaryWeaponOnServer(input: {
  characterId: string;
  itemId: string | null;
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  return updateCharacterLoadoutOnServer({
    characterId: input.characterId,
    itemId: input.itemId,
    expectedRevision: input.expectedRevision,
    path: "active-primary-weapon",
  });
}

export async function setCharacterActiveSecondaryWeaponOnServer(input: {
  characterId: string;
  itemId: string | null;
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  return updateCharacterLoadoutOnServer({
    characterId: input.characterId,
    itemId: input.itemId,
    expectedRevision: input.expectedRevision,
    path: "active-secondary-weapon",
  });
}

export async function setCharacterActiveMissileWeaponOnServer(input: {
  characterId: string;
  itemId: string | null;
  expectedRevision: number;
}): Promise<EquipmentFeatureState> {
  return updateCharacterLoadoutOnServer({
    characterId: input.characterId,
    itemId: input.itemId,
    expectedRevision: input.expectedRevision,
    path: "active-missile-weapon",
  });
}

export async function setCharacterActiveAmmunitionOnServer(input: {
  characterId: string;
  expectedRevision: number;
  itemIds: string[];
}): Promise<EquipmentFeatureState> {
  const payload = await sendJson<EquipmentStateResponse>(
    `/characters/${input.characterId}/equipment/loadout/active-ammunition`,
    {
      body: JSON.stringify({ expectedRevision: input.expectedRevision, itemIds: input.itemIds }),
      method: "POST",
    },
  );
  return payload.state;
}
