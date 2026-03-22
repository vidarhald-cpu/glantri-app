import { characterBuildSchema, type CharacterBuild } from "@glantri/domain";

import {
  localDb,
  type LocalCharacterDraft,
  type LocalCharacterRecord
} from "../glantriDexie";

export interface SaveCharacterDraftInput {
  advancementPointsSpent: number;
  advancementPointsTotal: number;
  build: CharacterBuild;
  characterId: string;
  id: string;
  syncStatus?: LocalCharacterDraft["syncStatus"];
  updatedAt?: string;
}

export class CharacterDraftRepository {
  async get(id: string): Promise<LocalCharacterDraft | undefined> {
    const record = await localDb.characterDrafts.get(id);

    if (!record) {
      return undefined;
    }

    return {
      ...record,
      build: characterBuildSchema.parse(record.build)
    };
  }

  async save(input: SaveCharacterDraftInput): Promise<LocalCharacterDraft> {
    const now = input.updatedAt ?? new Date().toISOString();
    const existing = await localDb.characterDrafts.get(input.id);
    const build = characterBuildSchema.parse(input.build);

    const record: LocalCharacterDraft = {
      advancementPointsSpent: input.advancementPointsSpent,
      advancementPointsTotal: input.advancementPointsTotal,
      build,
      characterId: input.characterId,
      createdAt: existing?.createdAt ?? now,
      id: input.id,
      syncStatus: input.syncStatus ?? existing?.syncStatus ?? "local",
      updatedAt: now
    };

    await localDb.characterDrafts.put(record);
    return record;
  }

  async createFromCharacter(
    record: LocalCharacterRecord,
    advancementPointsTotal = 0
  ): Promise<LocalCharacterDraft> {
    const existing = await this.get(record.id);

    if (existing) {
      return existing;
    }

    return this.save({
      advancementPointsSpent: 0,
      advancementPointsTotal,
      build: structuredClone(record.build),
      characterId: record.id,
      id: record.id,
      syncStatus: record.syncStatus
    });
  }

  async list(): Promise<LocalCharacterDraft[]> {
    const records = await localDb.characterDrafts.orderBy("updatedAt").reverse().toArray();

    return records.map((record) => ({
      ...record,
      build: characterBuildSchema.parse(record.build)
    }));
  }

  async delete(id: string): Promise<void> {
    await localDb.characterDrafts.delete(id);
  }
}
