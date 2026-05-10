import type { CanonicalContent } from "@glantri/content";
import type {
  AdminContentConflictResponse,
  AdminContentGetResponse,
  AdminContentPutRequest,
  AdminContentPutResponse
} from "@glantri/shared";

import { sendJson } from "./apiClient";

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
