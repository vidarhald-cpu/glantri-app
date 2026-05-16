import type { CanonicalContent } from "@glantri/content";

import { sendJson } from "./apiClient";

export async function loadCanonicalContentFromServer(): Promise<CanonicalContent> {
  const payload = await sendJson<{ content: CanonicalContent }>("/content", { method: "GET" });
  return payload.content;
}
