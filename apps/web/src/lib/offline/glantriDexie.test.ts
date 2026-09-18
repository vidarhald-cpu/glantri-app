import "fake-indexeddb/auto";

import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import type { CharacterBuild } from "@glantri/domain";

import { GlantriDexie, type LocalCharacterDraft, type LocalCharacterRecord } from "./glantriDexie";

const databaseNames: string[] = [];

function legacyBuild(): CharacterBuild {
  return {
    equipment: { items: [] },
    id: "legacy-character",
    name: "Unknown legacy changes",
    profile: {
      distractionLevel: 3,
      id: "profile-1",
      label: "Profile",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        health: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10,
      },
      societyLevel: 0,
    },
    progression: {
      chargenMode: "standard",
      educationPoints: 0,
      flexiblePointFactor: 1,
      level: 1,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: 0,
      secondaryPoolTotal: 0,
      skillGroups: [],
      skills: [],
      specializations: [],
    },
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: [],
    },
  };
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

describe("GlantriDexie recovery migration", () => {
  it("quarantines unknown unsynced whole builds without promoting or deleting them", async () => {
    const databaseName = `glantri-recovery-migration-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);
    const oldDatabase = new Dexie(databaseName);
    oldDatabase.version(5).stores({
      characterDrafts: "id, characterId, syncStatus, updatedAt",
      localCharacters: "id, syncStatus, finalizedAt, updatedAt",
    });
    const legacyRecord: LocalCharacterRecord = {
      build: legacyBuild(),
      createdAt: "2026-08-20T10:00:00.000Z",
      finalizedAt: "2026-08-20T10:00:00.000Z",
      id: "legacy-character",
      serverUpdatedAt: "revision-1",
      syncStatus: "local",
      updatedAt: "2026-08-20T11:00:00.000Z",
    };
    const legacyDraft: LocalCharacterDraft = {
      advancementPointsSpent: 1,
      advancementPointsTotal: 2,
      build: legacyBuild(),
      characterId: legacyRecord.id,
      createdAt: legacyRecord.createdAt,
      id: legacyRecord.id,
      serverUpdatedAt: legacyRecord.serverUpdatedAt,
      syncStatus: "local",
      updatedAt: "2026-08-20T11:30:00.000Z",
    };
    await oldDatabase.table("localCharacters").put(legacyRecord);
    await oldDatabase.table("characterDrafts").put(legacyDraft);
    oldDatabase.close();

    const upgraded = new GlantriDexie(databaseName);
    await upgraded.open();

    await expect(upgraded.localCharacters.get(legacyRecord.id)).resolves.toStrictEqual(
      legacyRecord,
    );
    const quarantined = await upgraded.legacyCharacterRecoveries.toArray();
    expect(quarantined).toHaveLength(2);
    expect(quarantined).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          characterId: legacyRecord.id,
          record: legacyRecord,
          sourceStore: "localCharacters",
        }),
        expect.objectContaining({
          characterId: legacyDraft.characterId,
          record: legacyDraft,
          sourceStore: "characterDrafts",
        }),
      ]),
    );
    expect(quarantined.every((row) => !("accountId" in row))).toBe(true);
    expect(await upgraded.characterRecoveries.count()).toBe(0);
    upgraded.close();
  });
});
