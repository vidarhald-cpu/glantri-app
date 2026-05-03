import type { CanonicalContent } from "@glantri/content";

import { loadServerCharacterById, type ServerCharacterRecord } from "../api/localServiceClient";
import { loadCanonicalContent } from "../content/loadCanonicalContent";
import type { LocalCharacterRecord } from "../offline/glantriDexie";
import { LocalCharacterRepository } from "../offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();

export interface ServerCharacterEditContext {
  content: CanonicalContent;
  localRecord: LocalCharacterRecord;
  serverRecord: ServerCharacterRecord;
}

export async function loadServerCharacterEditContext(
  id: string
): Promise<ServerCharacterEditContext> {
  const [content, serverRecord, existingLocalRecord] = await Promise.all([
    loadCanonicalContent(),
    loadServerCharacterById(id),
    localCharacterRepository.get(id)
  ]);
  const localIsNewer =
    existingLocalRecord &&
    Date.parse(existingLocalRecord.updatedAt) > Date.parse(serverRecord.updatedAt);
  const localRecord = localIsNewer
    ? existingLocalRecord
    : await localCharacterRepository.save({
        build: serverRecord.build,
        creatorDisplayName: serverRecord.owner?.displayName ?? undefined,
        creatorEmail: serverRecord.owner?.email ?? undefined,
        creatorId: serverRecord.ownerId ?? undefined,
        syncStatus: "synced",
        updatedAt: serverRecord.updatedAt
      });

  return {
    content,
    localRecord,
    serverRecord: localIsNewer
      ? {
          ...serverRecord,
          build: localRecord.build,
          updatedAt: localRecord.updatedAt
        }
      : serverRecord
  };
}
