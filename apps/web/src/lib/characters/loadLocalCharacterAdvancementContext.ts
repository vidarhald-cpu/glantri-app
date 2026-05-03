import type { CanonicalContent } from "@glantri/content";

import { loadCanonicalContent } from "../content/loadCanonicalContent";
import type { LocalCharacterDraft, LocalCharacterRecord } from "../offline/glantriDexie";
import { CharacterDraftRepository } from "../offline/repositories/characterDraftRepository";
import { LocalCharacterRepository } from "../offline/repositories/localCharacterRepository";

const characterDraftRepository = new CharacterDraftRepository();
const localCharacterRepository = new LocalCharacterRepository();

export interface LocalCharacterAdvancementContext {
  content: CanonicalContent;
  draft?: LocalCharacterDraft;
  record?: LocalCharacterRecord;
}

export async function loadLocalCharacterAdvancementContext(
  id: string
): Promise<LocalCharacterAdvancementContext> {
  const [content, existingDraft, record] = await Promise.all([
    loadCanonicalContent(),
    characterDraftRepository.get(id),
    localCharacterRepository.get(id)
  ]);
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
          syncStatus: record.syncStatus,
          updatedAt: record.updatedAt
        })
      : existingDraft;

  return {
    content,
    draft,
    record
  };
}
