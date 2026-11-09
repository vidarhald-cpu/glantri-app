import type { CanonicalContent } from "@glantri/content";
import { resolveRetainedTargetCharacterContent } from "@glantri/rules-engine";

import { loadServerCharacterById, type ServerCharacterRecord } from "../api/characterClient";
import { loadCanonicalContent } from "../content/loadCanonicalContent";
import type { LocalCharacterRecord } from "../offline/glantriDexie";
import {
  buildServerBackedLocalCharacterRecord,
  getServerCharacterRevision,
  LocalCharacterRepository,
} from "../offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();

export interface ServerCharacterEditContext {
  canonicalRecord: LocalCharacterRecord;
  content: CanonicalContent;
  expectedUpdatedAt: string;
  hasRevisionConflict: boolean;
  recoveryRecord?: LocalCharacterRecord;
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
  const canonicalRecord = buildServerBackedLocalCharacterRecord(serverRecord, existingLocalRecord);

  if (!localHasPendingChanges) {
    await localCharacterRepository.save(canonicalRecord);
  }

  return {
    canonicalRecord,
    // Forgejo #1068: Edit Character uses the catalogue the Character was built from — the same
    // approved target content Chargen, the server, the Sheet and combat use.
    content: resolveRetainedTargetCharacterContent(serverRecord.build, content),
    expectedUpdatedAt: serverRecord.updatedAt,
    hasRevisionConflict:
      localHasPendingChanges &&
      (localServerRevision === undefined || localServerRevision !== serverRecord.updatedAt),
    recoveryRecord: localHasPendingChanges ? existingLocalRecord : undefined,
    serverRecord,
  };
}
