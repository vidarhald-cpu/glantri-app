import type { ChargenStatAdjustmentState } from "@glantri/rules-engine";
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
  ownerId: string;
  createdAt: string;
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

export class GlantriDexie extends Dexie {
  cachedContent!: Table<CachedContentRecord, string>;
  characterDrafts!: Table<LocalCharacterDraft, string>;
  chargenSessions!: Table<ChargenSessionDraft, string>;
  encounters!: Table<EncounterSession, string>;
  localCharacters!: Table<LocalCharacterRecord, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super("glantri-app");

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

    this.version(6).stores({
      cachedContent: "key, updatedAt",
      characterDrafts: "id, characterId, syncStatus, updatedAt",
      chargenSessions: "id, ownerId, updatedAt",
      encounters: "id, status, updatedAt, title",
      localCharacters: "id, syncStatus, finalizedAt, updatedAt",
      syncQueue: "id, status, updatedAt, entityId",
    });
  }
}

export const localDb = new GlantriDexie();
