import type {
  Campaign,
  CampaignAsset,
  CampaignRosterCategory,
  CampaignRosterEntry,
  CampaignRosterSourceType,
  ReusableEntity,
  Scenario,
  ScenarioRelationship
} from "@glantri/domain";

import { sendJson } from "./apiClient";

export interface AccessibleCampaignRecord {
  campaign: Campaign;
  scenarios: Scenario[];
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
        status: input.status
      }),
      method: "POST"
    }
  );

  return payload.scenario;
}

export async function loadCampaignScenarioRelationships(
  campaignId: string
): Promise<ScenarioRelationship[]> {
  const payload = await sendJson<{ relationships: ScenarioRelationship[] }>(
    `/campaigns/${campaignId}/scenario-relationships`,
    {
      method: "GET"
    }
  );

  return payload.relationships;
}

export async function loadCampaignRoster(campaignId: string): Promise<CampaignRosterEntry[]> {
  const payload = await sendJson<{ roster: CampaignRosterEntry[] }>(
    `/campaigns/${campaignId}/roster`,
    {
      method: "GET"
    }
  );

  return payload.roster;
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
        sourceType: input.sourceType
      }),
      method: "POST"
    }
  );

  return payload.rosterEntry;
}

export async function removeCampaignRosterEntryOnServer(input: {
  campaignId: string;
  sourceId: string;
  sourceType: CampaignRosterSourceType;
}): Promise<void> {
  await sendJson<{ ok: true }>(
    `/campaigns/${input.campaignId}/roster-membership/${encodeURIComponent(input.sourceType)}/${encodeURIComponent(input.sourceId)}`,
    {
      method: "DELETE"
    }
  );
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
