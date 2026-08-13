import type { CanonicalContent } from "@glantri/content";
import type { CharacterRecord } from "@glantri/domain";

import { ApiRequestError } from "../api/apiClient";
import { loadServerCharacterById } from "../api/characterClient";
import { loadCanonicalContent } from "../content/loadCanonicalContent";
import type { LocalCharacterRecord } from "../offline/glantriDexie";
import {
  buildServerBackedLocalCharacterRecord,
  getServerCharacterRevision,
  LocalCharacterRepository,
} from "../offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();

export interface LocalCharacterContext {
  canonicalMissing: boolean;
  content: CanonicalContent;
  hasRevisionConflict: boolean;
  record?: LocalCharacterRecord;
  recoveryRecord?: LocalCharacterRecord;
}

export interface CurrentCharacterContext {
  content: CanonicalContent;
  record?: CharacterRecord;
}

export async function loadLocalCharacterContext(id: string): Promise<LocalCharacterContext> {
  const [content, localRecord] = await Promise.all([
    loadCanonicalContent(),
    localCharacterRepository.get(id),
  ]);

  let serverRecord: CharacterRecord;

  try {
    serverRecord = await loadServerCharacterById(id);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 404 || !localRecord) {
      throw error;
    }

    if (getServerCharacterRevision(localRecord)) {
      return {
        canonicalMissing: true,
        content,
        hasRevisionConflict: true,
        recoveryRecord: localRecord,
      };
    }

    return {
      canonicalMissing: false,
      content,
      hasRevisionConflict: false,
      record: localRecord,
    };
  }

  const canonicalRecord = buildServerBackedLocalCharacterRecord(serverRecord, localRecord);
  const localHasPendingChanges = localRecord?.syncStatus !== "synced";

  if (localRecord && localHasPendingChanges) {
    return {
      canonicalMissing: false,
      content,
      hasRevisionConflict: getServerCharacterRevision(localRecord) !== serverRecord.updatedAt,
      record: canonicalRecord,
      recoveryRecord: localRecord,
    };
  }

  const record = await localCharacterRepository.save(canonicalRecord);

  return {
    canonicalMissing: false,
    content,
    hasRevisionConflict: false,
    record,
  };
}

export async function loadCurrentCharacterContext(id: string): Promise<CurrentCharacterContext> {
  const [content, serverRecord] = await Promise.all([
    loadCanonicalContent(),
    loadServerCharacterById(id),
  ]);

  return {
    content,
    record: serverRecord,
  };
}
