import type { CanonicalContent } from "@glantri/content";

import type {
  CharacterRecoveryEnvelope,
  LocalCharacterDraft,
  LocalCharacterRecord,
} from "../offline/glantriDexie";
import { CharacterDraftRepository } from "../offline/repositories/characterDraftRepository";
import { applyCharacterRecoveryPatch } from "../offline/repositories/characterRecoveryRepository";
import { getServerCharacterRevision } from "../offline/repositories/localCharacterRepository";
import { loadLocalCharacterContext } from "./loadLocalCharacterContext";

const characterDraftRepository = new CharacterDraftRepository();

export interface LocalCharacterAdvancementContext {
  content: CanonicalContent;
  draft?: LocalCharacterDraft;
  hasRevisionConflict: boolean;
  record?: LocalCharacterRecord;
  recoveryDraft?: LocalCharacterDraft;
  recoveryRecord?: CharacterRecoveryEnvelope;
}

export async function loadLocalCharacterAdvancementContext(
  id: string,
  accountId: string,
): Promise<LocalCharacterAdvancementContext> {
  const characterContext = await loadLocalCharacterContext(id, accountId);
  const { content, record, recoveryRecord } = characterContext;

  if (!record) {
    return {
      content,
      hasRevisionConflict: characterContext.hasRevisionConflict,
      recoveryRecord,
    };
  }

  const existingDraft = await characterDraftRepository.get(id);
  const serverRevision = getServerCharacterRevision(record);
  const canonicalDraft = await characterDraftRepository.save({
    advancementPointsSpent: 0,
    advancementPointsTotal: record.build.progressionState?.availablePoints ?? 0,
    build: structuredClone(record.build),
    characterId: record.id,
    id: record.id,
    serverUpdatedAt: serverRevision,
    syncStatus: "synced",
    updatedAt: record.updatedAt,
  });
  const recoveredBuild =
    characterContext.recoveredBuild ??
    (recoveryRecord ? applyCharacterRecoveryPatch(record.build, recoveryRecord.patch) : undefined);
  const recoveryDraft = recoveredBuild
    ? {
        ...canonicalDraft,
        advancementPointsTotal: recoveredBuild.progressionState?.availablePoints ?? 0,
        build: recoveredBuild,
        createdAt: existingDraft?.createdAt ?? recoveryRecord?.createdAt ?? record.createdAt,
        syncStatus: "local" as const,
        updatedAt: recoveryRecord?.updatedAt ?? record.updatedAt,
      }
    : undefined;

  return {
    content,
    draft: canonicalDraft,
    hasRevisionConflict: characterContext.hasRevisionConflict,
    record,
    recoveryDraft,
    recoveryRecord,
  };
}
