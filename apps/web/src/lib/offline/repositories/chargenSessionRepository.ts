import type { CharacterProgression, RolledCharacterProfile } from "@glantri/domain";

import { localDb, type ChargenSessionDraft } from "../glantriDexie";

export interface SaveChargenSessionInput {
  id: string;
  progression: CharacterProgression;
  selectedProfessionId?: string;
  selectedProfile?: RolledCharacterProfile;
  selectedSocialClass?: string;
  selectedSocietyId?: string;
  selectedSocietyLevel?: number;
}

export class ChargenSessionRepository {
  async get(id: string): Promise<ChargenSessionDraft | undefined> {
    return localDb.chargenSessions.get(id);
  }

  async save(input: SaveChargenSessionInput): Promise<void> {
    const now = new Date().toISOString();
    const existing = await localDb.chargenSessions.get(input.id);

    const record: ChargenSessionDraft = {
      createdAt: existing?.createdAt ?? now,
      id: input.id,
      progression: input.progression,
      selectedProfessionId: input.selectedProfessionId,
      selectedProfile: input.selectedProfile,
      selectedSocialClass: input.selectedSocialClass,
      selectedSocietyId: input.selectedSocietyId,
      selectedSocietyLevel: input.selectedSocietyLevel,
      updatedAt: now
    };

    await localDb.chargenSessions.put(record);
  }

  async list(): Promise<ChargenSessionDraft[]> {
    return localDb.chargenSessions.orderBy("updatedAt").reverse().toArray();
  }

  async delete(id: string): Promise<void> {
    await localDb.chargenSessions.delete(id);
  }
}
