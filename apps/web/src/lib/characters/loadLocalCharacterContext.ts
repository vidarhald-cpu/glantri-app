import type { CanonicalContent } from "@glantri/content";

import { loadServerCharacterById } from "../api/localServiceClient";
import { loadCanonicalContent } from "../content/loadCanonicalContent";
import type { LocalCharacterRecord } from "../offline/glantriDexie";
import { LocalCharacterRepository } from "../offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();

export interface LocalCharacterContext {
  content: CanonicalContent;
  record?: LocalCharacterRecord;
}

export async function loadLocalCharacterContext(id: string): Promise<LocalCharacterContext> {
  const [content, localRecord] = await Promise.all([
    loadCanonicalContent(),
    localCharacterRepository.get(id)
  ]);

  if (localRecord) {
    return {
      content,
      record: localRecord
    };
  }

  const serverRecord = await loadServerCharacterById(id);
  const record = await localCharacterRepository.save({
    build: serverRecord.build,
    creatorDisplayName: serverRecord.owner?.displayName ?? undefined,
    creatorEmail: serverRecord.owner?.email ?? undefined,
    creatorId: serverRecord.ownerId ?? undefined,
    syncStatus: "synced",
    updatedAt: serverRecord.updatedAt
  });

  return {
    content,
    record
  };
}
