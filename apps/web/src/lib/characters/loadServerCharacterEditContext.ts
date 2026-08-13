import type { CanonicalContent } from "@glantri/content";

import { loadServerCharacterById, type ServerCharacterRecord } from "../api/characterClient";
import { loadCanonicalContent } from "../content/loadCanonicalContent";
import type { LocalCharacterRecord } from "../offline/glantriDexie";
import {
  getServerCharacterRevision,
  LocalCharacterRepository,
} from "../offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();

export interface ServerCharacterEditContext {
  content: CanonicalContent;
  expectedUpdatedAt?: string;
  hasRevisionConflict: boolean;
  localRecord: LocalCharacterRecord;
  serverRecord: ServerCharacterRecord;
}

export async function loadServerCharacterEditContext(
  id: string,
): Promise<ServerCharacterEditContext> {
  const [content, serverRecord, existingLocalRecord] = await Promise.all([
    loadCanonicalContent(),
    loadServerCharacterById(id),
    localCharacterRepository.get(id),
  ]);
  const localHasPendingChanges = Boolean(
    existingLocalRecord &&
    (existingLocalRecord.syncStatus !== "synced" ||
      Date.parse(existingLocalRecord.updatedAt) > Date.parse(serverRecord.updatedAt)),
  );
  const localServerRevision = existingLocalRecord
    ? getServerCharacterRevision(existingLocalRecord)
    : undefined;
  const localRecord =
    localHasPendingChanges && existingLocalRecord
      ? existingLocalRecord
      : await localCharacterRepository.save({
          build: serverRecord.build,
          creatorDisplayName: serverRecord.owner?.displayName ?? undefined,
          creatorEmail: serverRecord.owner?.email ?? undefined,
          creatorId: serverRecord.ownerId ?? undefined,
          serverUpdatedAt: serverRecord.updatedAt,
          syncStatus: "synced",
          updatedAt: serverRecord.updatedAt,
        });
  const expectedUpdatedAt = localHasPendingChanges ? localServerRevision : serverRecord.updatedAt;

  return {
    content,
    expectedUpdatedAt,
    hasRevisionConflict:
      localHasPendingChanges &&
      (localServerRevision === undefined || localServerRevision !== serverRecord.updatedAt),
    localRecord,
    serverRecord,
  };
}
