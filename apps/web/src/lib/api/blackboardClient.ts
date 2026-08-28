import type {
  ArtifactBlackboardCandidate,
  BlackboardCommonDto,
  BlackboardCommonEntry,
  BlackboardCreate,
  BlackboardGmCreate,
  BlackboardGmRevision,
  BlackboardPlacementDto,
  BlackboardRevision,
  BlackboardTombstone,
  BlackboardViewerCapabilities,
} from "@glantri/domain";

import { sendJson } from "./apiClient";

const mutationHeaders = { "x-glantri-blackboard-mutation": "1" };

export interface BlackboardSafeHistory {
  currentEntryVersion: number;
  entryId: string;
  revisions: Array<{
    changeKind: "initial" | "correction" | "replacement" | "refresh";
    changedAt: string;
    changedByLabel: string;
    content:
      | {
          category: "clue_fact";
          context?: string;
          fact: string;
          title: string;
        }
      | {
          category: "document_text";
          context?: string;
          documentText: string;
          title: string;
        }
      | {
          artifact: ArtifactBlackboardCandidate;
          caption?: string;
          category: "image_map";
          title: string;
        }
      | {
          approvedAt: string;
          approvedByLabel: string;
          category: "recap";
          recapText: string;
          title: string;
        };
    revisionNumber: number;
  }>;
}

export type BlackboardHistoryResult = BlackboardSafeHistory | { entry: BlackboardTombstone };

export async function loadBlackboard(campaignId: string): Promise<BlackboardCommonDto> {
  return sendJson<BlackboardCommonDto>(`/campaigns/${campaignId}/blackboard`, {
    method: "GET",
  });
}

export async function loadBlackboardCapabilities(
  campaignId: string,
): Promise<BlackboardViewerCapabilities> {
  return sendJson<BlackboardViewerCapabilities>(
    `/campaigns/${campaignId}/blackboard/capabilities`,
    { method: "GET" },
  );
}

export async function loadBlackboardHistory(input: {
  campaignId: string;
  entryId: string;
}): Promise<BlackboardHistoryResult> {
  return sendJson<BlackboardHistoryResult>(
    `/campaigns/${input.campaignId}/blackboard/entries/${input.entryId}/history`,
    { method: "GET" },
  );
}

export async function loadBlackboardArtifactCandidates(
  campaignId: string,
): Promise<ArtifactBlackboardCandidate[]> {
  const result = await sendJson<{ artifacts: ArtifactBlackboardCandidate[] }>(
    `/campaigns/${campaignId}/artifacts/blackboard-candidates`,
    { method: "GET" },
  );
  return result.artifacts;
}

export async function createBlackboardEntry(input: {
  campaignId: string;
  content: BlackboardCreate | BlackboardGmCreate;
}): Promise<BlackboardCommonEntry> {
  const result = await sendJson<{ entry: BlackboardCommonEntry }>(
    `/campaigns/${input.campaignId}/blackboard/entries`,
    {
      body: JSON.stringify(input.content),
      headers: mutationHeaders,
      method: "POST",
    },
  );
  return result.entry;
}

export async function reviseBlackboardEntry(input: {
  campaignId: string;
  content: BlackboardRevision | BlackboardGmRevision;
  entryId: string;
}): Promise<BlackboardCommonEntry> {
  const result = await sendJson<{ entry: BlackboardCommonEntry }>(
    `/campaigns/${input.campaignId}/blackboard/entries/${input.entryId}/revisions`,
    {
      body: JSON.stringify(input.content),
      headers: mutationHeaders,
      method: "POST",
    },
  );
  return result.entry;
}

export async function retractBlackboardEntry(input: {
  campaignId: string;
  entryId: string;
  expectedEntryVersion: number;
}): Promise<BlackboardTombstone> {
  const result = await sendJson<{ entry: BlackboardTombstone }>(
    `/campaigns/${input.campaignId}/blackboard/entries/${input.entryId}/retract`,
    {
      body: JSON.stringify({ expectedEntryVersion: input.expectedEntryVersion }),
      headers: mutationHeaders,
      method: "POST",
    },
  );
  return result.entry;
}

export async function pinBlackboardEntry(input: {
  campaignId: string;
  entryId: string;
  expectedLayoutVersion: number;
  height: number;
  layer: number;
  width: number;
  x: number;
  y: number;
}): Promise<BlackboardCommonDto> {
  return sendJson<BlackboardCommonDto>(`/campaigns/${input.campaignId}/blackboard/placements`, {
    body: JSON.stringify({
      entryId: input.entryId,
      expectedLayoutVersion: input.expectedLayoutVersion,
      height: input.height,
      layer: input.layer,
      width: input.width,
      x: input.x,
      y: input.y,
    }),
    headers: mutationHeaders,
    method: "POST",
  });
}

export async function moveBlackboardEntry(input: {
  campaignId: string;
  expectedLayoutVersion: number;
  placement: BlackboardPlacementDto;
  x: number;
  y: number;
}): Promise<BlackboardCommonDto> {
  return sendJson<BlackboardCommonDto>(
    `/campaigns/${input.campaignId}/blackboard/placements/${input.placement.entryId}`,
    {
      body: JSON.stringify({
        expectedLayoutVersion: input.expectedLayoutVersion,
        expectedRowVersion: input.placement.rowVersion,
        groupId: input.placement.groupId ?? null,
        height: input.placement.height,
        layer: input.placement.layer,
        width: input.placement.width,
        x: input.x,
        y: input.y,
      }),
      headers: mutationHeaders,
      method: "PATCH",
    },
  );
}

export async function unpinBlackboardEntry(input: {
  campaignId: string;
  expectedLayoutVersion: number;
  placement: BlackboardPlacementDto;
}): Promise<BlackboardCommonDto> {
  return sendJson<BlackboardCommonDto>(
    `/campaigns/${input.campaignId}/blackboard/placements/${input.placement.entryId}`,
    {
      body: JSON.stringify({
        expectedLayoutVersion: input.expectedLayoutVersion,
        expectedRowVersion: input.placement.rowVersion,
      }),
      headers: mutationHeaders,
      method: "DELETE",
    },
  );
}
