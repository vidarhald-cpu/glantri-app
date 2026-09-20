import {
  campaignNoteSchema,
  type AccessibleCampaignRecord,
  type Campaign,
  type CampaignAsset,
  type CampaignCharacterRosterCandidate,
  type CampaignNote,
  type CampaignNoteReference,
  type CampaignNoteStatus,
  type CampaignRosterCategory,
  type CampaignRosterEntry,
  type CampaignRosterSourceType,
  type CampaignWorkspaceOverview,
  type ReusableEntity,
  type Scenario,
  type ScenarioRelationship,
  type PlayerCampaignHomeRecord,
} from "@glantri/domain";

import { ApiRequestError, sendJson } from "./apiClient";

export type { AccessibleCampaignRecord };

export async function loadCampaigns(): Promise<Campaign[]> {
  const payload = await sendJson<{ campaigns: Campaign[] }>("/campaigns", {
    method: "GET",
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

export async function loadPlayerCampaignHome(): Promise<PlayerCampaignHomeRecord[]> {
  const payload = await sendJson<{ campaigns: PlayerCampaignHomeRecord[] }>(
    "/campaigns/player-home",
    {
      method: "GET",
    },
  );

  return payload.campaigns;
}

export async function loadTemplates(): Promise<ReusableEntity[]> {
  const payload = await sendJson<{ templates: ReusableEntity[] }>("/templates", {
    method: "GET",
  });

  return payload.templates;
}

export async function createCampaignOnServer(input: {
  description?: string;
  name: string;
  settings?: Campaign["settings"];
  status?: Campaign["status"];
}): Promise<Campaign> {
  const payload = await sendJson<{ campaign: Campaign }>("/campaigns", {
    body: JSON.stringify(input),
    method: "POST",
  });

  return payload.campaign;
}

export async function activateCampaignOnServer(input: { campaignId: string }): Promise<Campaign> {
  const payload = await sendJson<{ campaign: Campaign }>(
    `/campaigns/${input.campaignId}/activate`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

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
      snapshot: input.snapshot,
    }),
    method: "POST",
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
      snapshot: input.snapshot,
    }),
    method: "PUT",
  });

  return payload.template;
}

export async function loadCampaignById(campaignId: string): Promise<Campaign> {
  const payload = await sendJson<{ campaign: Campaign }>(`/campaigns/${campaignId}`, {
    method: "GET",
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
  const payload = await sendJson<{ scenarios: Scenario[] }>(`/campaigns/${campaignId}/scenarios`, {
    method: "GET",
  });

  return payload.scenarios;
}

export async function createScenarioOnServer(input: {
  campaignId: string;
  continuesFromScenarioId?: string;
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
        continuesFromScenarioId: input.continuesFromScenarioId,
        description: input.description,
        kind: input.kind,
        mapAssetId: input.mapAssetId,
        name: input.name,
        status: input.status,
      }),
      method: "POST",
    },
  );

  return payload.scenario;
}

export async function loadCampaignScenarioRelationships(
  campaignId: string,
): Promise<ScenarioRelationship[]> {
  const payload = await sendJson<{ relationships: ScenarioRelationship[] }>(
    `/campaigns/${campaignId}/scenario-relationships`,
    {
      method: "GET",
    },
  );

  return payload.relationships;
}

export async function loadCampaignRoster(campaignId: string): Promise<CampaignRosterEntry[]> {
  const payload = await sendJson<{ roster: CampaignRosterEntry[] }>(
    `/campaigns/${campaignId}/roster`,
    {
      method: "GET",
    },
  );

  return payload.roster;
}

export async function loadCampaignWorkspaceOverview(
  campaignId: string,
): Promise<CampaignWorkspaceOverview> {
  const payload = await sendJson<{ overview: CampaignWorkspaceOverview }>(
    `/campaigns/${campaignId}/workspace-overview`,
    { method: "GET" },
  );
  return payload.overview;
}

export async function createCampaignNoteOnServer(input: {
  associations?: CampaignNoteReference[];
  campaignId: string;
  content: string;
}): Promise<CampaignNote> {
  const payload = await sendJson<{ note: CampaignNote }>(`/campaigns/${input.campaignId}/notes`, {
    body: JSON.stringify({ associations: input.associations ?? [], content: input.content }),
    method: "POST",
  });
  return payload.note;
}

export async function updateCampaignNoteOnServer(input: {
  associations?: CampaignNoteReference[];
  campaignId: string;
  content: string;
  expectedRevision: string;
  noteId: string;
}): Promise<CampaignNote> {
  const payload = await sendJson<{ note: CampaignNote }>(
    `/campaigns/${input.campaignId}/notes/${input.noteId}`,
    {
      body: JSON.stringify({
        associations: input.associations ?? [],
        content: input.content,
        expectedRevision: input.expectedRevision,
      }),
      method: "PUT",
    },
  );
  return payload.note;
}

export async function setCampaignNoteStatusOnServer(input: {
  campaignId: string;
  expectedRevision: string;
  noteId: string;
  status: CampaignNoteStatus;
}): Promise<CampaignNote> {
  const payload = await sendJson<{ note: CampaignNote }>(
    `/campaigns/${input.campaignId}/notes/${input.noteId}/status`,
    {
      body: JSON.stringify({ expectedRevision: input.expectedRevision, status: input.status }),
      method: "POST",
    },
  );
  return payload.note;
}

export function getCurrentCampaignNoteFromMutationConflict(
  error: unknown,
): CampaignNote | undefined {
  if (!(error instanceof ApiRequestError) || error.status !== 409) return undefined;
  const currentNote = (error.payload as { currentNote?: unknown } | undefined)?.currentNote;
  const parsed = campaignNoteSchema.safeParse(currentNote);
  return parsed.success ? parsed.data : undefined;
}

export async function loadCampaignCharacterRosterCandidates(
  campaignId: string,
): Promise<CampaignCharacterRosterCandidate[]> {
  const payload = await sendJson<{ characters: CampaignCharacterRosterCandidate[] }>(
    `/campaigns/${campaignId}/roster-candidates/characters`,
    {
      method: "GET",
    },
  );

  return payload.characters;
}

export async function addCampaignRosterEntryOnServer(input: {
  campaignId: string;
  category: CampaignRosterCategory;
  notes?: string;
  sourceId: string;
  sourceType: CampaignRosterSourceType;
}): Promise<CampaignRosterEntry> {
  const payload = await sendJson<{ rosterEntry: CampaignRosterEntry }>(
    `/campaigns/${input.campaignId}/roster`,
    {
      body: JSON.stringify({
        category: input.category,
        notes: input.notes,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
      }),
      method: "POST",
    },
  );

  return payload.rosterEntry;
}

export async function removeCampaignRosterEntryOnServer(input: {
  campaignId: string;
  sourceId: string;
  sourceType: CampaignRosterSourceType;
}): Promise<void> {
  await sendJson<{ ok: true; removed?: boolean }>(
    `/campaigns/${input.campaignId}/roster-membership/${encodeURIComponent(input.sourceType)}/${encodeURIComponent(input.sourceId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function loadCampaignEntities(campaignId: string): Promise<ReusableEntity[]> {
  const payload = await sendJson<{ entities: ReusableEntity[] }>(
    `/campaigns/${campaignId}/entities`,
    {
      method: "GET",
    },
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
        snapshot: input.snapshot,
      }),
      method: "POST",
    },
  );

  return payload.entity;
}

export async function createCampaignNpcOnServer(input: {
  campaignId: string;
  description?: string;
  kind: "npc";
  name: string;
  notes?: string;
  snapshot: unknown;
}): Promise<{ entity: ReusableEntity; rosterEntry: CampaignRosterEntry }> {
  return sendJson<{ entity: ReusableEntity; rosterEntry: CampaignRosterEntry }>(
    `/campaigns/${input.campaignId}/npcs`,
    {
      body: JSON.stringify({
        description: input.description,
        kind: input.kind,
        name: input.name,
        notes: input.notes,
        snapshot: input.snapshot,
      }),
      method: "POST",
    },
  );
}

export async function loadCampaignAssets(campaignId: string): Promise<CampaignAsset[]> {
  const payload = await sendJson<{ assets: CampaignAsset[] }>(`/campaigns/${campaignId}/assets`, {
    method: "GET",
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
  const payload = await sendJson<{ asset: CampaignAsset }>(
    `/campaigns/${input.campaignId}/assets`,
    {
      body: JSON.stringify({
        description: input.description,
        mimeType: input.mimeType,
        storageUrl: input.storageUrl,
        title: input.title,
        type: input.type,
        visibility: input.visibility,
      }),
      method: "POST",
    },
  );

  return payload.asset;
}
