import type {
  CampaignAsset,
  Scenario,
  ScenarioEventLog,
  ScenarioLiveState,
  ScenarioParticipant,
  ScenarioPlayerProjection,
  ScenarioPlayerVisibleParticipant
} from "@glantri/domain";
import type { JoinableScenarioRecord } from "@glantri/shared";

import { sendJson } from "./apiClient";

export type { JoinableScenarioRecord };

type ScenarioParticipantRole =
  | "player_character"
  | "npc"
  | "monster"
  | "animal"
  | "neutral"
  | "ally"
  | "enemy";

export interface ScenarioParticipantFromCharacterInput {
  characterId: string;
  controlledByUserId?: string | null;
  displayOrder?: number | null;
  factionId?: string | null;
  joinSource?: "gm_added" | "player_joined" | "imported_from_template";
  role?: ScenarioParticipantRole;
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
  role: ScenarioParticipantRole;
  roleTag?: string | null;
  tacticalGroupId?: string | null;
}

export async function loadJoinableScenarios(characterId?: string): Promise<JoinableScenarioRecord[]> {
  const query = characterId ? `?characterId=${encodeURIComponent(characterId)}` : "";
  const payload = await sendJson<{ joinableScenarios: JoinableScenarioRecord[] }>(
    `/scenarios/joinable${query}`,
    {
      method: "GET"
    }
  );

  return payload.joinableScenarios;
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

export async function loadScenarioMyParticipant(
  scenarioId: string
): Promise<ScenarioParticipant | null> {
  const payload = await sendJson<{ participant: ScenarioParticipant | null }>(
    `/scenarios/${scenarioId}/my-participant`,
    {
      method: "GET"
    }
  );

  return payload.participant;
}

export async function loadScenarioVisibleParticipants(
  scenarioId: string
): Promise<ScenarioPlayerVisibleParticipant[]> {
  const payload = await sendJson<{ participants: ScenarioPlayerVisibleParticipant[] }>(
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
