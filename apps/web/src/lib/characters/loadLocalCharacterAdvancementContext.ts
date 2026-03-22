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
  const [content, draft, record] = await Promise.all([
    loadCanonicalContent(),
    characterDraftRepository.get(id),
    localCharacterRepository.get(id)
  ]);

  return {
    content,
    draft,
    record
  };
}
