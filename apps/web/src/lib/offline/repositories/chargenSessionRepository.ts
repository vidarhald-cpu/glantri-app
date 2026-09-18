import type { ChargenStatAdjustmentState } from "@glantri/rules-engine";
import type { CharacterProgression, RolledCharacterProfile } from "@glantri/domain";

import { localDb, type ChargenSessionDraft } from "../glantriDexie";

export interface SaveChargenSessionInput {
  ownerId: string;
  progression: CharacterProgression;
  rolledProfiles?: RolledCharacterProfile[];
  profileAdjustments?: Record<string, ChargenStatAdjustmentState>;
  characterName?: string;
  selectedCivilizationId?: string;
  selectedProfessionId?: string;
  selectedProfile?: RolledCharacterProfile;
  selectedSocialClass?: string;
  selectedSocietyId?: string;
  selectedSocietyLevel?: number;
}

const CHARGEN_SESSION_ID_PREFIX = "chargen-account";

export function getChargenSessionIdForOwner(ownerId: string): string {
  const normalizedOwnerId = ownerId.trim();

  if (!normalizedOwnerId) {
    throw new Error("Chargen draft ownership requires an authenticated account.");
  }

  return `${CHARGEN_SESSION_ID_PREFIX}:${encodeURIComponent(normalizedOwnerId)}`;
}

export class ChargenSessionRepository {
  async getForOwner(ownerId: string): Promise<ChargenSessionDraft | undefined> {
    const draft = await localDb.chargenSessions.get(getChargenSessionIdForOwner(ownerId));

    return draft?.ownerId === ownerId ? draft : undefined;
  }

  async save(input: SaveChargenSessionInput): Promise<void> {
    const now = new Date().toISOString();
    const id = getChargenSessionIdForOwner(input.ownerId);

    await localDb.transaction("rw", localDb.chargenSessions, async () => {
      const existing = await localDb.chargenSessions.get(id);

      const record: ChargenSessionDraft = {
        createdAt: existing?.createdAt ?? now,
        id,
        ownerId: input.ownerId,
        rolledProfiles: input.rolledProfiles,
        profileAdjustments: input.profileAdjustments,
        characterName: input.characterName,
        selectedCivilizationId: input.selectedCivilizationId,
        progression: input.progression,
        selectedProfessionId: input.selectedProfessionId,
        selectedProfile: input.selectedProfile,
        selectedSocialClass: input.selectedSocialClass,
        selectedSocietyId: input.selectedSocietyId,
        selectedSocietyLevel: input.selectedSocietyLevel,
        updatedAt: now,
      };

      await localDb.chargenSessions.put(record);
    });
  }

  async deleteForOwner(ownerId: string): Promise<void> {
    const id = getChargenSessionIdForOwner(ownerId);

    await localDb.transaction("rw", localDb.chargenSessions, async () => {
      const draft = await localDb.chargenSessions.get(id);

      if (draft?.ownerId === ownerId) {
        await localDb.chargenSessions.delete(id);
      }
    });
  }
}
