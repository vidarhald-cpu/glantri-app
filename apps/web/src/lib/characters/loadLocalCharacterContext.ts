import type { CanonicalContent } from "@glantri/content";

import { loadCanonicalContent } from "../content/loadCanonicalContent";
import type { LocalCharacterRecord } from "../offline/glantriDexie";
import { LocalCharacterRepository } from "../offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();

export interface LocalCharacterContext {
  content: CanonicalContent;
  record?: LocalCharacterRecord;
}

export async function loadLocalCharacterContext(id: string): Promise<LocalCharacterContext> {
  const [content, record] = await Promise.all([
    loadCanonicalContent(),
    localCharacterRepository.get(id)
  ]);

  return {
    content,
    record
  };
}
