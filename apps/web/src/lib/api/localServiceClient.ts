import type { AuthRole, AuthUser, CredentialLoginInput, CredentialRegisterInput } from "@glantri/auth";
import type { CanonicalContent } from "@glantri/content";
import type { CharacterBuild } from "@glantri/domain";
import type {
  CarryMode,
  ItemConditionState,
  LocationAvailabilityClass,
  MaterialType,
  QualityType,
  StorageLocationType
} from "@glantri/domain/equipment";
import type {
  AdminContentConflictResponse,
  AdminContentGetResponse,
  AdminContentPutRequest,
  AdminContentPutResponse
} from "@glantri/shared";
import type { EquipmentFeatureState } from "../../features/equipment/types";

export interface ServerCharacterRecord {
  build: CharacterBuild;
  createdAt: string;
  id: string;
  level: number;
  name: string;
  ownerId?: string | null;
  updatedAt: string;
}

export interface ApiErrorPayload {
  error?: string;
  issues?: string[];
}

export interface EquipmentStateResponse {
  state: EquipmentFeatureState;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown
  ) {
    super(message);
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function parseResponse<TResponse>(response: Response): Promise<TResponse> {
  const payload = (await response.json().catch(() => null)) as
    | ApiErrorPayload
    | TResponse
    | null;

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload && payload.error
        ? payload.error
        : `Request failed with status ${response.status}.`;
    const issueSuffix =
      payload && typeof payload === "object" && "issues" in payload && Array.isArray(payload.issues)
        ? ` ${payload.issues.join(" ")}`
        : "";

    throw new ApiRequestError(`${errorMessage}${issueSuffix}`.trim(), response.status, payload);
  }

  return payload as TResponse;
}

async function sendJson<TResponse>(
  path: string,
  init?: Omit<RequestInit, "credentials">
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  return parseResponse<TResponse>(response);
}

export async function getCurrentSessionUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: "include"
  });
  const payload = await parseResponse<{ canBootstrapGameMaster?: boolean; user: AuthUser | null }>(
    response
  );
  return payload.user;
}

export async function getBootstrapGameMasterAvailability(): Promise<boolean> {
  const payload = await sendJson<{ canBootstrapGameMaster: boolean }>("/auth/bootstrap-status", {
    method: "GET"
  });

  return payload.canBootstrapGameMaster;
}

export async function bootstrapGameMasterRole(): Promise<{
  canBootstrapGameMaster: boolean;
  user: AuthUser;
}> {
  return sendJson<{ canBootstrapGameMaster: boolean; user: AuthUser }>("/auth/bootstrap-gm", {
    body: JSON.stringify({}),
    method: "POST"
  });
}

export async function registerLocalUser(input: CredentialRegisterInput): Promise<AuthUser> {
  const payload = await sendJson<{ user: AuthUser }>("/auth/register", {
    body: JSON.stringify(input),
    method: "POST"
  });

  return payload.user;
}

export async function loginLocalUser(input: CredentialLoginInput): Promise<AuthUser> {
  const payload = await sendJson<{ user: AuthUser }>("/auth/login", {
    body: JSON.stringify(input),
    method: "POST"
  });

  return payload.user;
}

export async function logoutLocalUser(): Promise<void> {
  await sendJson<{ ok: true }>("/auth/logout", {
    body: JSON.stringify({}),
    method: "POST"
  });
}

export async function loadAuthUsers(): Promise<AuthUser[]> {
  const payload = await sendJson<{ users: AuthUser[] }>("/auth/users", {
    method: "GET"
  });

  return payload.users;
}

export async function updateAuthUserRole(input: {
  role: AuthRole;
  userId: string;
}): Promise<AuthUser> {
  const payload = await sendJson<{ user: AuthUser }>(`/auth/users/${input.userId}/role`, {
    body: JSON.stringify({
      role: input.role
    }),
    method: "POST"
  });

  return payload.user;
}

export async function saveCharacterToServer(build: CharacterBuild): Promise<ServerCharacterRecord> {
  const payload = await sendJson<{ character: ServerCharacterRecord }>("/characters", {
    body: JSON.stringify({ build }),
    method: "POST"
  });

  return payload.character;
}

export async function loadMyServerCharacters(): Promise<ServerCharacterRecord[]> {
  const payload = await sendJson<{ characters: ServerCharacterRecord[] }>("/characters", {
    method: "GET"
  });

  return payload.characters;
}

export async function loadServerCharacterById(characterId: string): Promise<ServerCharacterRecord> {
  const payload = await sendJson<{ character: ServerCharacterRecord }>(`/characters/${characterId}`, {
    method: "GET"
  });

  return payload.character;
}

export async function updateServerCharacter(input: {
  build: CharacterBuild;
  characterId: string;
}): Promise<ServerCharacterRecord> {
  const payload = await sendJson<{ character: ServerCharacterRecord }>(`/characters/${input.characterId}`, {
    body: JSON.stringify({
      build: input.build
    }),
    method: "PUT"
  });

  return payload.character;
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

export async function loadAdminCanonicalContentFromServer(): Promise<
  AdminContentGetResponse<CanonicalContent>
> {
  return sendJson<AdminContentGetResponse<CanonicalContent>>("/api/admin/content", {
    method: "GET"
  });
}

export async function saveAdminCanonicalContentToServer(
  input: AdminContentPutRequest<CanonicalContent>
): Promise<AdminContentPutResponse<CanonicalContent>> {
  return sendJson<AdminContentPutResponse<CanonicalContent>>("/api/admin/content", {
    body: JSON.stringify(input),
    method: "PUT"
  });
}

export function isAdminContentConflictPayload(
  payload: unknown
): payload is AdminContentConflictResponse<CanonicalContent> {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  return "current" in payload && "error" in payload;
}
