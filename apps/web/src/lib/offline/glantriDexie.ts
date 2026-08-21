import Dexie, { type Table } from "dexie";

import type { CanonicalContent } from "@glantri/content";
import type {
  CharacterBuild,
  CharacterProgression,
  EncounterSession,
  RolledCharacterProfile,
} from "@glantri/domain";
import type { SyncQueueItem } from "@glantri/shared";

export interface ChargenSessionDraft {
  id: string;
  createdAt: string;
  progression: CharacterProgression;
  selectedProfessionId?: string;
  selectedProfile?: RolledCharacterProfile;
  selectedSocialClass?: string;
  selectedSocietyId?: string;
  selectedSocietyLevel?: number;
  updatedAt: string;
}

export interface LocalCharacterDraft {
  advancementPointsSpent: number;
  advancementPointsTotal: number;
  build: CharacterBuild;
  characterId: string;
  id: string;
  /** Opaque revision of the server Character on which this draft was based. */
  serverUpdatedAt?: string;
  createdAt: string;
  syncStatus: "local" | "queued" | "synced";
  updatedAt: string;
}

export interface CachedContentRecord {
  key: string;
  updatedAt: string;
  version: string;
  value: CanonicalContent;
}

export interface LocalCharacterRecord {
  build: CharacterBuild;
  creatorDisplayName?: string;
  creatorEmail?: string;
  creatorId?: string;
  createdAt: string;
  finalizedAt: string;
  id: string;
  /** Opaque revision of the server record this cache/draft was based on. */
  serverUpdatedAt?: string;
  syncStatus: "local" | "queued" | "synced";
  updatedAt: string;
}

export type CharacterRecoveryPatchOperation = "remove" | "set";

export interface CharacterRecoveryPatchEntry {
  attemptedValue?: unknown;
  baseValue?: unknown;
  operation: CharacterRecoveryPatchOperation;
  path: string;
}

export interface CharacterRecoverySaveAttempt {
  attemptedAt: string;
  completedAt?: string;
  errorCode?: string;
  id: string;
  outcome: "conflict" | "failed" | "pending" | "unknown";
}

export interface CharacterRecoveryEnvelope {
  accountDisplayName?: string;
  accountEmail: string;
  accountId: string;
  baseHash: string;
  baseRevision: string;
  characterId: string;
  createdAt: string;
  id: string;
  patch: CharacterRecoveryPatchEntry[];
  reconciliation: "conflict" | "ready";
  saveAttempt: CharacterRecoverySaveAttempt;
  sourceAction: string;
  sourceSurface: string;
  updatedAt: string;
}

export interface LegacyCharacterRecoveryRecord {
  /** Present only when old data included a trustworthy account identity. */
  accountId?: string;
  characterId: string;
  id: string;
  quarantinedAt: string;
  record: LocalCharacterDraft | LocalCharacterRecord;
  sourceStore: "characterDrafts" | "localCharacters";
  updatedAt: string;
}

export class GlantriDexie extends Dexie {
  cachedContent!: Table<CachedContentRecord, string>;
  characterDrafts!: Table<LocalCharacterDraft, string>;
  characterRecoveries!: Table<CharacterRecoveryEnvelope, string>;
  chargenSessions!: Table<ChargenSessionDraft, string>;
  encounters!: Table<EncounterSession, string>;
  localCharacters!: Table<LocalCharacterRecord, string>;
  legacyCharacterRecoveries!: Table<LegacyCharacterRecoveryRecord, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor(databaseName = "glantri-app") {
    super(databaseName);

    this.version(1).stores({
      cachedContent: "key, updatedAt",
      characterDrafts: "id, syncStatus, updatedAt",
      chargenSessions: "id, updatedAt",
      syncQueue: "id, status, updatedAt, entityId",
    });

    this.version(2).stores({
      cachedContent: "key, updatedAt",
      characterDrafts: "id, syncStatus, updatedAt",
      chargenSessions: "id, updatedAt",
      localCharacters: "id, syncStatus, finalizedAt, updatedAt",
      syncQueue: "id, status, updatedAt, entityId",
    });

    this.version(3).stores({
      cachedContent: "key, updatedAt",
      characterDrafts: "id, characterId, syncStatus, updatedAt",
      chargenSessions: "id, updatedAt",
      localCharacters: "id, syncStatus, finalizedAt, updatedAt",
      syncQueue: "id, status, updatedAt, entityId",
    });

    this.version(4).stores({
      cachedContent: "key, updatedAt",
      characterDrafts: "id, characterId, syncStatus, updatedAt",
      chargenSessions: "id, updatedAt",
      encounters: "id, status, updatedAt, title",
      localCharacters: "id, syncStatus, finalizedAt, updatedAt",
      syncQueue: "id, status, updatedAt, entityId",
    });

    this.version(5).stores({
      cachedContent: "key, updatedAt",
      characterDrafts: "id, characterId, syncStatus, updatedAt",
      chargenSessions: "id, updatedAt",
      encounters: "id, status, updatedAt, title",
      localCharacters: "id, syncStatus, finalizedAt, updatedAt",
      syncQueue: "id, status, updatedAt, entityId",
    });

    this.version(6)
      .stores({
        cachedContent: "key, updatedAt",
        characterDrafts: "id, characterId, syncStatus, updatedAt",
        characterRecoveries: "id, [accountId+characterId], accountId, characterId, updatedAt",
        chargenSessions: "id, updatedAt",
        encounters: "id, status, updatedAt, title",
        legacyCharacterRecoveries:
          "id, [accountId+characterId], accountId, characterId, sourceStore, updatedAt",
        localCharacters: "id, syncStatus, finalizedAt, updatedAt",
        syncQueue: "id, status, updatedAt, entityId",
      })
      .upgrade(async (transaction) => {
        const quarantinedAt = new Date().toISOString();
        const localCharacters = (await transaction
          .table("localCharacters")
          .toArray()) as LocalCharacterRecord[];
        const characterDrafts = (await transaction
          .table("characterDrafts")
          .toArray()) as LocalCharacterDraft[];
        const legacyRows: LegacyCharacterRecoveryRecord[] = [];

        for (const record of localCharacters) {
          if (record.syncStatus === "synced") {
            continue;
          }

          legacyRows.push({
            characterId: record.id,
            id: `localCharacters:${record.id}:${record.updatedAt}`,
            quarantinedAt,
            record,
            sourceStore: "localCharacters",
            updatedAt: record.updatedAt,
          });
        }

        for (const record of characterDrafts) {
          if (record.syncStatus === "synced") {
            continue;
          }

          legacyRows.push({
            characterId: record.characterId,
            id: `characterDrafts:${record.id}:${record.updatedAt}`,
            quarantinedAt,
            record,
            sourceStore: "characterDrafts",
            updatedAt: record.updatedAt,
          });
        }

        if (legacyRows.length > 0) {
          await transaction.table("legacyCharacterRecoveries").bulkPut(legacyRows);
        }
      });
  }
}

export const localDb = new GlantriDexie();
