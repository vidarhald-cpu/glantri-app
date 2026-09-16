import type {
  ArtifactCommonDto,
  ArtifactGmDto,
  ArtifactUploadMetadata,
  ScenarioArtifactReferenceDto,
} from "@glantri/domain";

import { API_BASE_URL } from "./apiConfig";
import { ApiRequestError, parseResponse, sendJson } from "./apiClient";

const mutationHeaders = { "x-glantri-artifact-mutation": "1" };

export type ArtifactListResult =
  | {
      artifacts: ArtifactGmDto[];
      mode: "gm";
      references: ScenarioArtifactReferenceDto[];
    }
  | { artifacts: ArtifactCommonDto[]; mode: "viewer" };

export function isManagedArtifact(
  artifact: ArtifactCommonDto | ArtifactGmDto,
): artifact is ArtifactGmDto {
  return "metadataVersion" in artifact;
}

export async function loadArtifacts(campaignId: string): Promise<ArtifactListResult> {
  return sendJson<ArtifactListResult>(`/campaigns/${campaignId}/artifacts`, { method: "GET" });
}

export function artifactContentUrl(campaignId: string, artifactId: string): string {
  return `${API_BASE_URL}/campaigns/${campaignId}/artifacts/${artifactId}/content`;
}

export function uploadArtifact(input: {
  campaignId: string;
  file: File;
  metadata: ArtifactUploadMetadata;
  onProgress?: (percent: number) => void;
}): Promise<ArtifactGmDto> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_BASE_URL}/campaigns/${input.campaignId}/artifacts`);
    request.withCredentials = true;
    request.setRequestHeader("x-glantri-artifact-mutation", "1");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable)
        input.onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      const payload = JSON.parse(request.responseText || "null") as
        | { artifact: ArtifactGmDto }
        | { error?: string }
        | null;
      if (request.status >= 200 && request.status < 300 && payload && "artifact" in payload) {
        resolve(payload.artifact);
      } else {
        const message =
          payload && "error" in payload && payload.error ? payload.error : "Upload failed.";
        reject(new ApiRequestError(message, request.status, payload));
      }
    });
    request.addEventListener("error", () => reject(new Error("Upload connection failed.")));
    request.addEventListener("abort", () => reject(new Error("Upload cancelled.")));
    const form = new FormData();
    form.append("metadata", JSON.stringify(input.metadata));
    form.append("file", input.file, input.file.name);
    request.send(form);
  });
}

export async function updateArtifactMetadata(input: {
  altText?: string | null;
  artifactId: string;
  campaignId: string;
  description?: string | null;
  expectedMetadataVersion: number;
  title?: string;
}): Promise<ArtifactGmDto> {
  const payload = await sendJson<{ artifact: ArtifactGmDto }>(
    `/campaigns/${input.campaignId}/artifacts/${input.artifactId}`,
    {
      body: JSON.stringify({
        altText: input.altText,
        description: input.description,
        expectedMetadataVersion: input.expectedMetadataVersion,
        title: input.title,
      }),
      headers: mutationHeaders,
      method: "PATCH",
    },
  );
  return payload.artifact;
}

export async function setArtifactAudience(input: {
  artifactId: string;
  audience: "gm_private" | "campaign";
  campaignId: string;
  expectedMetadataVersion: number;
}): Promise<ArtifactGmDto> {
  const payload = await sendJson<{ artifact: ArtifactGmDto }>(
    `/campaigns/${input.campaignId}/artifacts/${input.artifactId}/audience`,
    {
      body: JSON.stringify({
        audience: input.audience,
        expectedMetadataVersion: input.expectedMetadataVersion,
      }),
      headers: mutationHeaders,
      method: "PUT",
    },
  );
  return payload.artifact;
}

export async function setArtifactLifecycle(input: {
  artifactId: string;
  campaignId: string;
  expectedMetadataVersion: number;
  lifecycle: "active" | "archived";
}): Promise<ArtifactGmDto> {
  const payload = await sendJson<{ artifact: ArtifactGmDto }>(
    `/campaigns/${input.campaignId}/artifacts/${input.artifactId}/lifecycle`,
    {
      body: JSON.stringify({
        expectedMetadataVersion: input.expectedMetadataVersion,
        lifecycle: input.lifecycle,
      }),
      headers: mutationHeaders,
      method: "PUT",
    },
  );
  return payload.artifact;
}

export async function deleteArtifact(input: {
  artifactId: string;
  campaignId: string;
  expectedMetadataVersion: number;
}): Promise<ArtifactGmDto> {
  const payload = await sendJson<{ artifact: ArtifactGmDto }>(
    `/campaigns/${input.campaignId}/artifacts/${input.artifactId}`,
    {
      body: JSON.stringify({ expectedMetadataVersion: input.expectedMetadataVersion }),
      headers: mutationHeaders,
      method: "DELETE",
    },
  );
  return payload.artifact;
}

export async function retryArtifactCleanup(input: {
  artifactId: string;
  campaignId: string;
}): Promise<ArtifactGmDto> {
  const payload = await sendJson<{ artifact: ArtifactGmDto }>(
    `/campaigns/${input.campaignId}/artifacts/${input.artifactId}/cleanup-retry`,
    { body: "{}", headers: mutationHeaders, method: "POST" },
  );
  return payload.artifact;
}

export async function mutateScenarioArtifact(input: {
  action: "attach" | "publish" | "withdraw";
  altText?: string | null;
  artifactId: string;
  campaignId: string;
  caption?: string | null;
  expectedArtifactVersion: number;
  expectedReferenceVersion?: number;
  scenarioId: string;
  title?: string;
}): Promise<{ artifact: ArtifactGmDto; reference: ScenarioArtifactReferenceDto }> {
  return sendJson(
    `/campaigns/${input.campaignId}/scenarios/${input.scenarioId}/artifacts/${input.artifactId}/${input.action}`,
    {
      body: JSON.stringify({
        altText: input.altText,
        caption: input.caption,
        expectedArtifactVersion: input.expectedArtifactVersion,
        expectedReferenceVersion: input.expectedReferenceVersion,
        title: input.title,
      }),
      headers: mutationHeaders,
      method: "POST",
    },
  );
}

export async function fetchArtifactBlob(campaignId: string, artifactId: string): Promise<Blob> {
  const response = await fetch(artifactContentUrl(campaignId, artifactId), {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) await parseResponse(response);
  return response.blob();
}

export interface ArtifactHistory {
  revisions: Array<{
    id: string;
    number: number;
    mediaType: string;
    byteSize: number;
    note: string | null;
    createdAt: string;
    originalFilename: string | null;
  }>;
  usages: {
    references: Array<{ state: string; scenario: { id: string; name: string } }>;
    maps: Array<{ id: string; name: string }>;
    links: Array<{ entryId: string; revisionNumber: number; title: string; current: boolean }>;
  };
}
export function loadArtifactHistory(campaignId: string, artifactId: string) {
  return sendJson<ArtifactHistory>(`/campaigns/${campaignId}/artifacts/${artifactId}/history`, {
    method: "GET",
  });
}
export function artifactRevisionUrl(campaignId: string, artifactId: string, revisionId: string) {
  return `${API_BASE_URL}/campaigns/${campaignId}/artifacts/${artifactId}/revisions/${encodeURIComponent(revisionId)}/content`;
}
export function artifactImportResourceUrl(campaignId: string, id: string, resourceId: string) {
  return `${API_BASE_URL}/campaigns/${campaignId}/artifact-imports/${id}/resources/${encodeURIComponent(resourceId)}`;
}
export async function stageArtifactPackage(
  campaignId: string,
  manifest: import("@glantri/domain").ArtifactPackage,
  files: Record<string, File>,
) {
  const form = new FormData();
  form.append("manifest", JSON.stringify(manifest));
  for (const resource of manifest.resources) {
    const file = files[resource.id];
    if (!file) throw new Error("Choose every declared resource before uploading.");
    form.append(resource.id, file, file.name);
  }
  const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/artifact-imports`, {
    method: "POST",
    credentials: "include",
    headers: mutationHeaders,
    body: form,
  });
  return (
    await parseResponse<{ preview: import("@glantri/domain").ArtifactImportPreview }>(response)
  ).preview;
}
export async function reviewArtifactImport(campaignId: string, id: string, selected: string[]) {
  return (
    await sendJson<{ preview: import("@glantri/domain").ArtifactImportPreview }>(
      `/campaigns/${campaignId}/artifact-imports/${id}/preview`,
      { method: "POST", headers: mutationHeaders, body: JSON.stringify({ selected }) },
    )
  ).preview;
}
export async function acceptArtifactImport(
  campaignId: string,
  preview: import("@glantri/domain").ArtifactImportPreview,
  approvedUpdates: string[],
) {
  return (
    await sendJson<{ preview: import("@glantri/domain").ArtifactImportPreview }>(
      `/campaigns/${campaignId}/artifact-imports/${preview.id}/accept`,
      {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ previewToken: preview.previewToken, approvedUpdates }),
      },
    )
  ).preview;
}
export async function loadArtifactImport(campaignId: string, id: string) {
  return (
    await sendJson<{ preview: import("@glantri/domain").ArtifactImportPreview }>(
      `/campaigns/${campaignId}/artifact-imports/${id}`,
      { method: "GET" },
    )
  ).preview;
}
export async function listArtifactImports(campaignId: string) {
  return (
    await sendJson<{
      imports: Array<{
        id: string;
        title: string;
        state: string;
        createdAt: string;
        error?: string;
        cleanupPending: boolean;
      }>;
    }>(`/campaigns/${campaignId}/artifact-imports`, { method: "GET" })
  ).imports;
}
export async function cleanupArtifactImport(campaignId: string, id: string) {
  return sendJson<{ cleanupPending: boolean }>(
    `/campaigns/${campaignId}/artifact-imports/${id}/cleanup`,
    { method: "POST", headers: mutationHeaders, body: "{}" },
  );
}
