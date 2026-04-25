import type { AuthRole, AuthUser, CredentialLoginInput, CredentialRegisterInput } from "@glantri/auth";
import type { CanonicalContent } from "@glantri/content";
import type {
  Campaign,
  CampaignAsset,
  ReusableEntity,
  Scenario,
  ScenarioEventLog,
  ScenarioLiveState,
  ScenarioPlayerProjection,
  ScenarioParticipant,
  CharacterBuild
} from "@glantri/domain";
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
  owner?:
    | {
        displayName?: string | null;
        email: string;
        id: string;
      }
    | null;
  ownerId?: string | null;
  updatedAt: string;
}

export interface JoinableScenarioRecord {
  campaignId: string;
  campaignName: string;
  kind: Scenario["kind"];
  scenarioId: string;
  scenarioName: string;
  status: Scenario["status"];
}

export interface AccessibleCampaignRecord {
  campaign: Campaign;
  scenarios: Scenario[];
}

export interface ApiErrorPayload {
  error?: string;
  issues?: string[];
}

export interface EquipmentStateResponse {
  state: EquipmentFeatureState;
}

export interface ScenarioParticipantFromCharacterInput {
  characterId: string;
  controlledByUserId?: string | null;
  displayOrder?: number | null;
  factionId?: string | null;
  joinSource?: "gm_added" | "player_joined" | "imported_from_template";
  role?:
    | "player_character"
    | "npc"
    | "monster"
    | "animal"
    | "neutral"
    | "ally"
    | "enemy";
  roleTag?: string | null;
  tacticalGroupId?: string | null;
}

export interface ScenarioParticipantFromEntityInput {
  controlledByUserId?: string | null;
  displayOrder?: number | null;
  entityId?: string;
  entityInput?: {
    description?: string;
    kind: "npc" | "monster" | "animal";
    name: string;
    notes?: string;
    snapshot?: unknown;
  };
  factionId?: string | null;
  isTemporary?: boolean;
  joinSource?: "gm_added" | "player_joined" | "imported_from_template";
  role: "player_character" | "npc" | "monster" | "animal" | "neutral" | "ally" | "enemy";
  roleTag?: string | null;
  tacticalGroupId?: string | null;
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

export async function loadServerCharacters(): Promise<ServerCharacterRecord[]> {
  const payload = await sendJson<{ characters: ServerCharacterRecord[] }>("/characters", {
    method: "GET"
  });

  return payload.characters;
}

export async function loadMyServerCharacters(): Promise<ServerCharacterRecord[]> {
  return loadServerCharacters();
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

export async function loadCampaigns(): Promise<Campaign[]> {
  const payload = await sendJson<{ campaigns: Campaign[] }>("/campaigns", {
    method: "GET"
  });

  return payload.campaigns;
}

export async function loadAccessibleCampaigns(): Promise<AccessibleCampaignRecord[]> {
  const payload = await sendJson<{ accessibleCampaigns: AccessibleCampaignRecord[] }>(
    "/campaigns/accessible",
    {
      method: "GET",
    },
  );

  return payload.accessibleCampaigns;
}

export async function loadTemplates(): Promise<ReusableEntity[]> {
  const payload = await sendJson<{ templates: ReusableEntity[] }>("/templates", {
    method: "GET"
  });

  return payload.templates;
}

export async function loadJoinableScenarios(): Promise<JoinableScenarioRecord[]> {
  const payload = await sendJson<{ joinableScenarios: JoinableScenarioRecord[] }>(
    "/scenarios/joinable",
    {
      method: "GET"
    }
  );

  return payload.joinableScenarios;
}

export async function createCampaignOnServer(input: {
  description?: string;
  name: string;
  settings?: Campaign["settings"];
  status?: Campaign["status"];
}): Promise<Campaign> {
  const payload = await sendJson<{ campaign: Campaign }>("/campaigns", {
    body: JSON.stringify(input),
    method: "POST"
  });

  return payload.campaign;
}

export async function createTemplateOnServer(input: {
  description?: string;
  kind: ReusableEntity["kind"];
  name: string;
  notes?: string;
  snapshot?: unknown;
}): Promise<ReusableEntity> {
  const payload = await sendJson<{ template: ReusableEntity }>("/templates", {
    body: JSON.stringify({
      description: input.description,
      kind: input.kind,
      name: input.name,
      notes: input.notes,
      snapshot: input.snapshot
    }),
    method: "POST"
  });

  return payload.template;
}

export async function updateTemplateOnServer(input: {
  description?: string;
  kind: ReusableEntity["kind"];
  name: string;
  notes?: string;
  snapshot?: unknown;
  templateId: string;
}): Promise<ReusableEntity> {
  const payload = await sendJson<{ template: ReusableEntity }>(`/templates/${input.templateId}`, {
    body: JSON.stringify({
      description: input.description,
      kind: input.kind,
      name: input.name,
      notes: input.notes,
      snapshot: input.snapshot
    }),
    method: "PUT"
  });

  return payload.template;
}

export async function loadCampaignById(campaignId: string): Promise<Campaign> {
  const payload = await sendJson<{ campaign: Campaign }>(`/campaigns/${campaignId}`, {
    method: "GET"
  });

  return payload.campaign;
}

export async function loadAccessibleCampaignById(
  campaignId: string,
): Promise<AccessibleCampaignRecord> {
  const payload = await sendJson<{ accessibleCampaign: AccessibleCampaignRecord }>(
    `/campaigns/accessible/${campaignId}`,
    {
      method: "GET",
    },
  );

  return payload.accessibleCampaign;
}

export async function loadCampaignScenarios(campaignId: string): Promise<Scenario[]> {
  const payload = await sendJson<{ scenarios: Scenario[] }>(
    `/campaigns/${campaignId}/scenarios`,
    {
      method: "GET"
    }
  );

  return payload.scenarios;
}

export async function createScenarioOnServer(input: {
  campaignId: string;
  description?: string;
  kind?: Scenario["kind"];
  mapAssetId?: string | null;
  name: string;
  status?: Scenario["status"];
}): Promise<Scenario> {
  const payload = await sendJson<{ scenario: Scenario }>(
    `/campaigns/${input.campaignId}/scenarios`,
    {
      body: JSON.stringify({
        description: input.description,
        kind: input.kind,
        mapAssetId: input.mapAssetId,
        name: input.name,
        status: input.status
      }),
      method: "POST"
    }
  );

  return payload.scenario;
}

export async function loadCampaignEntities(campaignId: string): Promise<ReusableEntity[]> {
  const payload = await sendJson<{ entities: ReusableEntity[] }>(
    `/campaigns/${campaignId}/entities`,
    {
      method: "GET"
    }
  );

  return payload.entities;
}

export async function createReusableEntityOnServer(input: {
  campaignId: string;
  description?: string;
  kind: ReusableEntity["kind"];
  name: string;
  notes?: string;
  snapshot?: unknown;
}): Promise<ReusableEntity> {
  const payload = await sendJson<{ entity: ReusableEntity }>(
    `/campaigns/${input.campaignId}/entities`,
    {
      body: JSON.stringify({
        description: input.description,
        kind: input.kind,
        name: input.name,
        notes: input.notes,
        snapshot: input.snapshot
      }),
      method: "POST"
    }
  );

  return payload.entity;
}

export async function loadCampaignAssets(campaignId: string): Promise<CampaignAsset[]> {
  const payload = await sendJson<{ assets: CampaignAsset[] }>(`/campaigns/${campaignId}/assets`, {
    method: "GET"
  });

  return payload.assets;
}

export async function createCampaignAssetOnServer(input: {
  campaignId: string;
  description?: string;
  mimeType?: string;
  storageUrl: string;
  title: string;
  type: CampaignAsset["type"];
  visibility: CampaignAsset["visibility"];
}): Promise<CampaignAsset> {
  const payload = await sendJson<{ asset: CampaignAsset }>(`/campaigns/${input.campaignId}/assets`, {
    body: JSON.stringify({
      description: input.description,
      mimeType: input.mimeType,
      storageUrl: input.storageUrl,
      title: input.title,
      type: input.type,
      visibility: input.visibility
    }),
    method: "POST"
  });

  return payload.asset;
}

export async function loadScenarioById(scenarioId: string): Promise<Scenario> {
  const payload = await sendJson<{ scenario: Scenario }>(`/scenarios/${scenarioId}`, {
    method: "GET"
  });

  return payload.scenario;
}

export async function loadScenarioPlayerProjection(
  scenarioId: string
): Promise<ScenarioPlayerProjection> {
  const payload = await sendJson<{ projection: ScenarioPlayerProjection }>(
    `/scenarios/${scenarioId}/player-projection`,
    {
      method: "GET"
    }
  );

  return payload.projection;
}

export async function updateScenarioOnServer(input: {
  description?: string;
  kind?: Scenario["kind"];
  mapAssetId?: string | null;
  name?: string;
  scenarioId: string;
  status?: Scenario["status"];
}): Promise<Scenario> {
  const payload = await sendJson<{ scenario: Scenario }>(`/scenarios/${input.scenarioId}`, {
    body: JSON.stringify({
      description: input.description,
      kind: input.kind,
      mapAssetId: input.mapAssetId,
      name: input.name,
      status: input.status
    }),
    method: "PUT"
  });

  return payload.scenario;
}

export async function updateScenarioLiveStateOnServer(input: {
  liveState: ScenarioLiveState;
  scenarioId: string;
}): Promise<Scenario> {
  const payload = await sendJson<{ scenario: Scenario }>(
    `/scenarios/${input.scenarioId}/live-state`,
    {
      body: JSON.stringify({
        liveState: input.liveState
      }),
      method: "PUT"
    }
  );

  return payload.scenario;
}

export async function loadScenarioParticipants(scenarioId: string): Promise<ScenarioParticipant[]> {
  const payload = await sendJson<{ participants: ScenarioParticipant[] }>(
    `/scenarios/${scenarioId}/participants`,
    {
      method: "GET"
    }
  );

  return payload.participants;
}

export async function addScenarioParticipantFromCharacterOnServer(input: {
  scenarioId: string;
} & ScenarioParticipantFromCharacterInput): Promise<ScenarioParticipant> {
  const payload = await sendJson<{ participant: ScenarioParticipant }>(
    `/scenarios/${input.scenarioId}/participants/character`,
    {
      body: JSON.stringify({
        characterId: input.characterId,
        controlledByUserId: input.controlledByUserId,
        displayOrder: input.displayOrder,
        factionId: input.factionId,
        joinSource: input.joinSource,
        role: input.role,
        roleTag: input.roleTag,
        tacticalGroupId: input.tacticalGroupId
      }),
      method: "POST"
    }
  );

  return payload.participant;
}

export async function addScenarioParticipantFromEntityOnServer(input: {
  scenarioId: string;
} & ScenarioParticipantFromEntityInput): Promise<ScenarioParticipant> {
  const payload = await sendJson<{ participant: ScenarioParticipant }>(
    `/scenarios/${input.scenarioId}/participants/entity`,
    {
      body: JSON.stringify({
        controlledByUserId: input.controlledByUserId,
        displayOrder: input.displayOrder,
        entityId: input.entityId,
        entityInput: input.entityInput,
        factionId: input.factionId,
        isTemporary: input.isTemporary,
        joinSource: input.joinSource,
        role: input.role,
        roleTag: input.roleTag,
        tacticalGroupId: input.tacticalGroupId
      }),
      method: "POST"
    }
  );

  return payload.participant;
}

export async function updateScenarioParticipantStateOnServer(input: {
  participantId: string;
  scenarioId: string;
  state: ScenarioParticipant["state"];
}): Promise<ScenarioParticipant> {
  const payload = await sendJson<{ participant: ScenarioParticipant }>(
    `/scenarios/${input.scenarioId}/participants/${input.participantId}/state`,
    {
      body: JSON.stringify({
        state: input.state
      }),
      method: "PUT"
    }
  );

  return payload.participant;
}

export async function updateScenarioParticipantMetadataOnServer(input: {
  controlledByUserId?: string | null;
  displayOrder?: number | null;
  factionId?: string | null;
  isActive?: boolean;
  participantId: string;
  roleTag?: string | null;
  scenarioId: string;
  tacticalGroupId?: string | null;
}): Promise<ScenarioParticipant> {
  const payload = await sendJson<{ participant: ScenarioParticipant }>(
    `/scenarios/${input.scenarioId}/participants/${input.participantId}/metadata`,
    {
      body: JSON.stringify({
        controlledByUserId:
          input.controlledByUserId === undefined ? undefined : input.controlledByUserId,
        displayOrder: input.displayOrder === undefined ? undefined : input.displayOrder,
        factionId: input.factionId === undefined ? undefined : input.factionId,
        isActive: input.isActive === undefined ? undefined : input.isActive,
        roleTag: input.roleTag === undefined ? undefined : input.roleTag,
        tacticalGroupId:
          input.tacticalGroupId === undefined ? undefined : input.tacticalGroupId
      }),
      method: "PUT"
    }
  );

  return payload.participant;
}

export async function updateCampaignAssetVisibilityOnServer(input: {
  assetId: string;
  visibility: CampaignAsset["visibility"];
}): Promise<CampaignAsset> {
  const payload = await sendJson<{ asset: CampaignAsset }>(
    `/campaign-assets/${input.assetId}/visibility`,
    {
      body: JSON.stringify({
        visibility: input.visibility
      }),
      method: "PUT"
    }
  );

  return payload.asset;
}

export async function loadScenarioEventLogs(scenarioId: string): Promise<ScenarioEventLog[]> {
  const payload = await sendJson<{ eventLogs: ScenarioEventLog[] }>(
    `/scenarios/${scenarioId}/events`,
    {
      method: "GET"
    }
  );

  return payload.eventLogs;
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
