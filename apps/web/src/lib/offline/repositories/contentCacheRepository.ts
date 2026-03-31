import type { CanonicalContent } from "@glantri/content";
import type { CachedContentRecord } from "../glantriDexie";

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

  async get(key: string): Promise<CachedContentRecord | undefined> {
    return localDb.cachedContent.get(key);
  }

  async delete(key: string): Promise<void> {
    await localDb.cachedContent.delete(key);
  }
}
