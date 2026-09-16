import { assertApprovedTargetProgression } from "@glantri/content";
import { characterBuildSchema, type CharacterBuild, type CharacterRecord } from "@glantri/domain";

import { localDb, type LocalCharacterRecord } from "../glantriDexie";

function parseApprovedBuild(input: unknown): CharacterBuild {
  const build = characterBuildSchema.parse(input);
  assertApprovedTargetProgression(build.progression);
  return build;
}

export interface SaveLocalCharacterInput {
  build: CharacterBuild;
  creatorDisplayName?: string;
  creatorEmail?: string;
  creatorId?: string;
  createdAt?: string;
  finalizedAt?: string;
  serverUpdatedAt?: string;
  syncStatus?: LocalCharacterRecord["syncStatus"];
  updatedAt?: string;
}

export const UNNAMED_CHARACTER_PLACEHOLDER = "Unnamed Character";

function normalizeCharacterName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : UNNAMED_CHARACTER_PLACEHOLDER;
}

export function getServerCharacterRevision(record: LocalCharacterRecord): string | undefined {
  return record.serverUpdatedAt ?? (record.syncStatus === "synced" ? record.updatedAt : undefined);
}

export function requireServerCharacterRevision(record: LocalCharacterRecord): string {
  const revision = getServerCharacterRevision(record);

  if (!revision) {
    throw new Error(
      "This local character has no server revision. Reload the server character before saving.",
    );
  }

  return revision;
}

export function buildServerBackedLocalCharacterRecord(
  serverRecord: CharacterRecord,
  existing?: LocalCharacterRecord,
): LocalCharacterRecord {
  return {
    build: serverRecord.build,
    createdAt: existing?.createdAt ?? serverRecord.createdAt,
    creatorDisplayName: serverRecord.owner?.displayName ?? existing?.creatorDisplayName,
    creatorEmail: serverRecord.owner?.email ?? existing?.creatorEmail,
    creatorId: serverRecord.ownerId ?? serverRecord.owner?.id ?? existing?.creatorId,
    finalizedAt: existing?.finalizedAt ?? serverRecord.createdAt,
    id: serverRecord.id,
    serverUpdatedAt: serverRecord.updatedAt,
    syncStatus: "synced",
    updatedAt: serverRecord.updatedAt,
  };
}

export class LocalCharacterRepository {
  async get(id: string): Promise<LocalCharacterRecord | undefined> {
    const record = await localDb.localCharacters.get(id);

    if (!record) {
      return undefined;
    }

    return {
      ...record,
      build: parseApprovedBuild(record.build),
    };
  }

  async listFinalized(): Promise<LocalCharacterRecord[]> {
    const records = await localDb.localCharacters.orderBy("finalizedAt").reverse().toArray();

    return records.map((record) => ({
      ...record,
      build: parseApprovedBuild(record.build),
    }));
  }

  async list(): Promise<LocalCharacterRecord[]> {
    return this.listFinalized();
  }

  async reconcileSyncedRecords(serverCharacterIds: string[]): Promise<void> {
    const serverCharacterIdSet = new Set(serverCharacterIds);
    const syncedRecords = await localDb.localCharacters
      .where("syncStatus")
      .equals("synced")
      .toArray();

    const staleRecordIds = syncedRecords
      .filter((record) => !serverCharacterIdSet.has(record.id))
      .map((record) => record.id);

    if (staleRecordIds.length === 0) {
      return;
    }

    await localDb.localCharacters.bulkDelete(staleRecordIds);
  }

  async save(input: SaveLocalCharacterInput): Promise<LocalCharacterRecord> {
    const now = input.updatedAt ?? new Date().toISOString();
    const existing = await localDb.localCharacters.get(input.build.id);
    const build = parseApprovedBuild(input.build);
    const syncStatus = input.syncStatus ?? existing?.syncStatus ?? "local";
    const inheritedServerRevision = existing ? getServerCharacterRevision(existing) : undefined;
    const serverUpdatedAt =
      input.serverUpdatedAt ??
      (input.syncStatus === "synced" && input.updatedAt ? input.updatedAt : undefined) ??
      inheritedServerRevision ??
      (syncStatus === "synced" ? (input.updatedAt ?? now) : undefined);

    const record: LocalCharacterRecord = {
      build: {
        ...build,
        name: normalizeCharacterName(build.name),
      },
      creatorDisplayName: input.creatorDisplayName ?? existing?.creatorDisplayName,
      creatorEmail: input.creatorEmail ?? existing?.creatorEmail,
      creatorId: input.creatorId ?? existing?.creatorId,
      createdAt: input.createdAt ?? existing?.createdAt ?? now,
      finalizedAt: input.finalizedAt ?? existing?.finalizedAt ?? now,
      id: input.build.id,
      serverUpdatedAt,
      syncStatus,
      updatedAt: now,
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
        ...parseApprovedBuild(existing.build),
        name: normalizeCharacterName(name),
      },
      serverUpdatedAt: getServerCharacterRevision(existing),
      syncStatus: "local",
      updatedAt: new Date().toISOString(),
    };

    await localDb.localCharacters.put(updated);
    return updated;
  }
}
