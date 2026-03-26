import { characterBuildSchema, type CharacterBuild } from "@glantri/domain";

import { localDb, type LocalCharacterRecord } from "../glantriDexie";

export interface SaveLocalCharacterInput {
  build: CharacterBuild;
  creatorDisplayName?: string;
  creatorEmail?: string;
  creatorId?: string;
  createdAt?: string;
  finalizedAt?: string;
  syncStatus?: LocalCharacterRecord["syncStatus"];
  updatedAt?: string;
}

export const UNNAMED_CHARACTER_PLACEHOLDER = "Unnamed Character";

function normalizeCharacterName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : UNNAMED_CHARACTER_PLACEHOLDER;
}

export class LocalCharacterRepository {
  async get(id: string): Promise<LocalCharacterRecord | undefined> {
    const record = await localDb.localCharacters.get(id);

    if (!record) {
      return undefined;
    }

    return {
      ...record,
      build: characterBuildSchema.parse(record.build)
    };
  }

  async list(): Promise<LocalCharacterRecord[]> {
    const records = await localDb.localCharacters.orderBy("finalizedAt").reverse().toArray();

    return records.map((record) => ({
      ...record,
      build: characterBuildSchema.parse(record.build)
    }));
  }

  async save(input: SaveLocalCharacterInput): Promise<LocalCharacterRecord> {
    const now = input.updatedAt ?? new Date().toISOString();
    const existing = await localDb.localCharacters.get(input.build.id);
    const build = characterBuildSchema.parse(input.build);

    const record: LocalCharacterRecord = {
      build: {
        ...build,
        name: normalizeCharacterName(build.name)
      },
      creatorDisplayName: input.creatorDisplayName ?? existing?.creatorDisplayName,
      creatorEmail: input.creatorEmail ?? existing?.creatorEmail,
      creatorId: input.creatorId ?? existing?.creatorId,
      createdAt: input.createdAt ?? existing?.createdAt ?? now,
      finalizedAt: input.finalizedAt ?? existing?.finalizedAt ?? now,
      id: input.build.id,
      syncStatus: input.syncStatus ?? existing?.syncStatus ?? "local",
      updatedAt: now
    };

    await localDb.localCharacters.put(record);
    return record;
  }

  async updateName(id: string, name: string): Promise<LocalCharacterRecord | undefined> {
    const existing = await localDb.localCharacters.get(id);

    if (!existing) {
      return undefined;
    }

    const updated: LocalCharacterRecord = {
      ...existing,
      build: {
        ...characterBuildSchema.parse(existing.build),
        name: normalizeCharacterName(name)
      },
      updatedAt: new Date().toISOString()
    };

    await localDb.localCharacters.put(updated);
    return updated;
  }
}
