import type { CanonicalContent } from "@glantri/content";

import type { LocalCharacterDraft, LocalCharacterRecord } from "../offline/glantriDexie";
import { CharacterDraftRepository } from "../offline/repositories/characterDraftRepository";
import { getServerCharacterRevision } from "../offline/repositories/localCharacterRepository";
import { loadLocalCharacterContext } from "./loadLocalCharacterContext";

const characterDraftRepository = new CharacterDraftRepository();

export interface LocalCharacterAdvancementContext {
  content: CanonicalContent;
  draft?: LocalCharacterDraft;
  hasRevisionConflict: boolean;
  record?: LocalCharacterRecord;
  recoveryDraft?: LocalCharacterDraft;
  recoveryRecord?: LocalCharacterRecord;
}

export async function loadLocalCharacterAdvancementContext(
  id: string,
): Promise<LocalCharacterAdvancementContext> {
  const [characterContext, existingDraft] = await Promise.all([
    loadLocalCharacterContext(id),
    characterDraftRepository.get(id),
  ]);
  const { content, record, recoveryRecord } = characterContext;

  if (!record) {
    return {
      content,
      hasRevisionConflict: characterContext.hasRevisionConflict,
      recoveryDraft: existingDraft,
      recoveryRecord,
    };
  }

  const serverRevision = getServerCharacterRevision(record);
  const draftServerRevision =
    existingDraft?.serverUpdatedAt ??
    (existingDraft?.syncStatus === "synced" ? existingDraft.updatedAt : undefined);
  const draftHasPendingChanges = existingDraft?.syncStatus !== "synced";
  const draftHasRevisionConflict = Boolean(
    existingDraft &&
    draftHasPendingChanges &&
    (!draftServerRevision || draftServerRevision !== serverRevision),
  );
  const hasRevisionConflict = characterContext.hasRevisionConflict || draftHasRevisionConflict;
  const canonicalDraft: LocalCharacterDraft = {
    advancementPointsSpent: 0,
    advancementPointsTotal: record.build.progressionState?.availablePoints ?? 0,
    build: structuredClone(record.build),
    characterId: record.id,
    createdAt: existingDraft?.createdAt ?? record.createdAt,
    id: record.id,
    serverUpdatedAt: serverRevision,
    syncStatus: "synced",
    updatedAt: record.updatedAt,
  };

  if (hasRevisionConflict || recoveryRecord) {
    const recoveryDraft =
      existingDraft && existingDraft.syncStatus !== "synced"
        ? existingDraft
        : recoveryRecord
          ? {
              ...canonicalDraft,
              build: structuredClone(recoveryRecord.build),
              serverUpdatedAt: getServerCharacterRevision(recoveryRecord),
              syncStatus: "local" as const,
              updatedAt: recoveryRecord.updatedAt,
            }
          : existingDraft;

    return {
      content,
      draft: canonicalDraft,
      hasRevisionConflict,
      record,
      recoveryDraft,
      recoveryRecord,
    };
  }

  const recordIsNewer =
    record &&
    (!existingDraft || Date.parse(record.updatedAt) > Date.parse(existingDraft.updatedAt));
  const draft =
    record && recordIsNewer
      ? await characterDraftRepository.save({
          advancementPointsSpent: 0,
          advancementPointsTotal: record.build.progressionState?.availablePoints ?? 0,
          build: structuredClone(record.build),
          characterId: record.id,
          id: record.id,
          serverUpdatedAt: serverRevision,
          syncStatus: record.syncStatus,
          updatedAt: record.updatedAt,
        })
      : existingDraft;

  return {
    content,
    draft,
    hasRevisionConflict: false,
    record,
    recoveryRecord,
  };
}
