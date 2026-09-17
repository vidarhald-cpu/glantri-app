import type {
  CampaignMapAuthoringOptions,
  CampaignMapCreate,
  CampaignMapGmDto,
  CampaignMapMutation,
  CampaignMapPlayerDto,
  CampaignMapSummary,
} from "@glantri/domain";

import { API_BASE_URL } from "./apiConfig";
import { sendJson } from "./apiClient";

const mutationHeaders = { "x-glantri-map-mutation": "1" };

export type CampaignMapListResult =
  | { maps: CampaignMapSummary[]; mode: "gm" }
  | { maps: CampaignMapSummary[]; mode: "player" };

export type CampaignMapResult =
  | { map: CampaignMapGmDto; mode: "gm" }
  | { map: CampaignMapPlayerDto; mode: "player" };

export function campaignMapBackgroundUrl(campaignId: string, mapId: string): string {
  return `${API_BASE_URL}/campaigns/${campaignId}/maps/${mapId}/background`;
}

export function loadCampaignMaps(campaignId: string): Promise<CampaignMapListResult> {
  return sendJson(`/campaigns/${campaignId}/maps`, { method: "GET" });
}

export function loadCampaignMap(campaignId: string, mapId: string): Promise<CampaignMapResult> {
  return sendJson(`/campaigns/${campaignId}/maps/${mapId}`, { method: "GET" });
}

export async function createCampaignMap(input: {
  campaignId: string;
  create: CampaignMapCreate;
}): Promise<CampaignMapGmDto> {
  const result = await sendJson<{ map: CampaignMapGmDto; mode: "gm" }>(
    `/campaigns/${input.campaignId}/maps`,
    {
      body: JSON.stringify(input.create),
      headers: mutationHeaders,
      method: "POST",
    },
  );
  return result.map;
}

export async function saveCampaignMap(input: {
  campaignId: string;
  mapId: string;
  mutation: CampaignMapMutation;
}): Promise<CampaignMapGmDto> {
  const result = await sendJson<{ map: CampaignMapGmDto; mode: "gm" }>(
    `/campaigns/${input.campaignId}/maps/${input.mapId}`,
    {
      body: JSON.stringify(input.mutation),
      headers: mutationHeaders,
      method: "PUT",
    },
  );
  return result.map;
}

export async function loadCampaignMapAuthoringOptions(
  campaignId: string,
): Promise<CampaignMapAuthoringOptions> {
  const result = await sendJson<{ options: CampaignMapAuthoringOptions }>(
    `/campaigns/${campaignId}/maps/authoring-options`,
    { method: "GET" },
  );
  return result.options;
}
