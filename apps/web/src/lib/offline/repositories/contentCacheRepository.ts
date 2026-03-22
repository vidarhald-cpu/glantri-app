import type { CanonicalContent } from "@glantri/content";

import { localDb } from "../glantriDexie";

export class ContentCacheRepository {
  async save(key: string, value: CanonicalContent, version = "seed"): Promise<void> {
    await localDb.cachedContent.put({
      key,
      updatedAt: new Date().toISOString(),
      value,
      version
    });
  }

  async get(key: string) {
    return localDb.cachedContent.get(key);
  }
}
