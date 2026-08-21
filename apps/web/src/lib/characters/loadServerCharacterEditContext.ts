import type { CanonicalContent } from "@glantri/content";

import { loadServerCharacterById, type ServerCharacterRecord } from "../api/characterClient";
import { loadCanonicalContent } from "../content/loadCanonicalContent";
import type { CharacterRecoveryEnvelope, LocalCharacterRecord } from "../offline/glantriDexie";
import { CharacterRecoveryRepository } from "../offline/repositories/characterRecoveryRepository";
import {
  buildServerBackedLocalCharacterRecord,
  LocalCharacterRepository,
} from "../offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();
const characterRecoveryRepository = new CharacterRecoveryRepository();

export interface ServerCharacterEditContext {
  canonicalRecord: LocalCharacterRecord;
  conflictPaths: string[];
  content: CanonicalContent;
  expectedUpdatedAt: string;
  hasRevisionConflict: boolean;
  legacyRecoveryCount: number;
  recoveredBuild?: LocalCharacterRecord["build"];
  recoveryRecord?: CharacterRecoveryEnvelope;
  serverRecord: ServerCharacterRecord;
}

export async function loadServerCharacterEditContext(
  id: string,
  accountId: string,
): Promise<ServerCharacterEditContext> {
  const [content, serverRecord, existingLocalRecord] = await Promise.all([
    loadCanonicalContent(),
    loadServerCharacterById(id),
    localCharacterRepository.get(id),
  ]);
  const canonicalRecord = buildServerBackedLocalCharacterRecord(serverRecord, existingLocalRecord);
  const savedCanonicalRecord = await localCharacterRepository.save(canonicalRecord);
  const [recoveryState, legacyRecovery] = await Promise.all([
    characterRecoveryRepository.reconcile(
      accountId,
      id,
      serverRecord.build,
      serverRecord.updatedAt,
    ),
    characterRecoveryRepository.listLegacyQuarantine(id),
  ]);

  return {
    canonicalRecord: savedCanonicalRecord,
    conflictPaths: recoveryState?.conflictPaths ?? [],
    content,
    expectedUpdatedAt: serverRecord.updatedAt,
    hasRevisionConflict: Boolean(recoveryState && recoveryState.conflictPaths.length > 0),
    legacyRecoveryCount: legacyRecovery.length,
    recoveredBuild: recoveryState?.recoveredBuild,
    recoveryRecord: recoveryState?.envelope,
    serverRecord,
  };
}
