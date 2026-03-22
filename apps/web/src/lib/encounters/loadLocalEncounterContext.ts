import type { CanonicalContent } from "@glantri/content";
import type { EncounterSession } from "@glantri/domain";

import { loadCanonicalContent } from "../content/loadCanonicalContent";
import type { LocalCharacterRecord } from "../offline/glantriDexie";
import { LocalEncounterRepository } from "../offline/repositories/localEncounterRepository";
import { LocalCharacterRepository } from "../offline/repositories/localCharacterRepository";

const localEncounterRepository = new LocalEncounterRepository();
const localCharacterRepository = new LocalCharacterRepository();

export interface LocalEncounterContext {
  characters: LocalCharacterRecord[];
  content: CanonicalContent;
  encounter?: EncounterSession;
}

export async function loadLocalEncounterContext(id: string): Promise<LocalEncounterContext> {
  const [characters, content, encounter] = await Promise.all([
    localCharacterRepository.list(),
    loadCanonicalContent(),
    localEncounterRepository.get(id)
  ]);

  return {
    characters,
    content,
    encounter
  };
}
