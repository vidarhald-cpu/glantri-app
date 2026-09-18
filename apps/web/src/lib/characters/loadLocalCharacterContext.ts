import type { CanonicalContent } from "@glantri/content";
import type { CharacterRecord } from "@glantri/domain";

import { loadServerCharacterById } from "../api/characterClient";
import { loadCanonicalContent } from "../content/loadCanonicalContent";
import type { CharacterRecoveryEnvelope, LocalCharacterRecord } from "../offline/glantriDexie";
import { CharacterRecoveryRepository } from "../offline/repositories/characterRecoveryRepository";
import {
  buildServerBackedLocalCharacterRecord,
  LocalCharacterRepository,
} from "../offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();
const characterRecoveryRepository = new CharacterRecoveryRepository();

export interface LocalCharacterContext {
  canonicalMissing: boolean;
  content: CanonicalContent;
  conflictPaths: string[];
  hasRevisionConflict: boolean;
  record?: LocalCharacterRecord;
  recoveredBuild?: LocalCharacterRecord["build"];
  recoveryRecord?: CharacterRecoveryEnvelope;
}

export interface CurrentCharacterContext {
  content: CanonicalContent;
  record?: CharacterRecord;
}

export async function loadLocalCharacterContext(
  id: string,
  accountId: string,
): Promise<LocalCharacterContext> {
  const [content, localRecord] = await Promise.all([
    loadCanonicalContent(),
    localCharacterRepository.get(id),
  ]);

  const serverRecord: CharacterRecord = await loadServerCharacterById(id);

  const canonicalRecord = buildServerBackedLocalCharacterRecord(serverRecord, localRecord);
  const record = await localCharacterRepository.save(canonicalRecord);
  const recoveryState = await characterRecoveryRepository.reconcile(
    accountId,
    id,
    serverRecord.build,
    serverRecord.updatedAt,
  );

  return {
    canonicalMissing: false,
    conflictPaths: recoveryState?.conflictPaths ?? [],
    content,
    hasRevisionConflict: Boolean(recoveryState && recoveryState.conflictPaths.length > 0),
    record,
    recoveredBuild: recoveryState?.recoveredBuild,
    recoveryRecord: recoveryState?.envelope,
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
