import { beforeEach, describe, expect, it } from "vitest";

import type { CharacterBuild } from "@glantri/domain";

import { localDb } from "../glantriDexie";
import { getServerCharacterRevision, LocalCharacterRepository } from "./localCharacterRepository";

const build: CharacterBuild = {
  equipment: { items: [] },
  id: "character-1",
  name: "Revision Keeper",
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

describe("LocalCharacterRepository server revision tracking", () => {
  beforeEach(async () => {
    await localDb.localCharacters.clear();
  });

  it("retains the canonical base revision when a synced cache becomes a local draft", async () => {
    const repository = new LocalCharacterRepository();
    const serverRevision = "2026-08-13T08:00:00.000Z";
    const synced = await repository.save({
      build,
      serverUpdatedAt: serverRevision,
      syncStatus: "synced",
      updatedAt: serverRevision,
    });

    const localDraft = await repository.save({
      build: { ...build, name: "Offline revision" },
      syncStatus: "local",
      updatedAt: "2026-08-13T09:00:00.000Z",
    });

    expect(getServerCharacterRevision(synced)).toBe(serverRevision);
    expect(localDraft.serverUpdatedAt).toBe(serverRevision);
    expect(getServerCharacterRevision(localDraft)).toBe(serverRevision);
    expect(localDraft.updatedAt).toBe("2026-08-13T09:00:00.000Z");
  });

  it("marks a local name edit unsynced without changing its server base revision", async () => {
    const repository = new LocalCharacterRepository();
    const serverRevision = "2026-08-13T08:00:00.000Z";
    await repository.save({
      build,
      syncStatus: "synced",
      updatedAt: serverRevision,
    });

    const updated = await repository.updateName(build.id, "Locally renamed");

    expect(updated).toMatchObject({
      serverUpdatedAt: serverRevision,
      syncStatus: "local",
    });
    expect(updated?.build.name).toBe("Locally renamed");
  });

  it("removes a missing synced cache but retains an unsynced local draft for recovery", async () => {
    const repository = new LocalCharacterRepository();
    await repository.save({
      build,
      syncStatus: "synced",
      updatedAt: "2026-08-13T08:00:00.000Z",
    });
    await repository.save({
      build: { ...build, id: "character-local", name: "Local recovery" },
      syncStatus: "local",
      updatedAt: "2026-08-13T09:00:00.000Z",
    });

    await repository.reconcileSyncedRecords([]);

    await expect(repository.get(build.id)).resolves.toBeUndefined();
    await expect(repository.get("character-local")).resolves.toMatchObject({
      syncStatus: "local",
    });
  });
});
