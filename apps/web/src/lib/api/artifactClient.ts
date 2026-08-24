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
