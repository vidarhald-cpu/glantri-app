import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import type { AuthUser } from "@glantri/auth";
import type { CharacterBuild } from "@glantri/domain";

import { localDb } from "../glantriDexie";
import {
  CharacterRecoveryRepository,
  formatCharacterRecoveryField,
} from "./characterRecoveryRepository";

const accountA: AuthUser = {
  email: "player-a@example.com",
  id: "account-a",
  roles: ["player"],
};
const accountB: AuthUser = {
  email: "player-b@example.com",
  id: "account-b",
  roles: ["player"],
};

function createBuild(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    equipment: { items: [] },
    id: "character-a",
    inventoryNotes: "Canonical notes",
    name: "Canonical name",
    profile: {
      distractionLevel: 3,
      id: "profile-a",
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
    ...overrides,
  };
}

describe("CharacterRecoveryRepository", () => {
  beforeEach(async () => {
    await Promise.all([
      localDb.characterRecoveries.clear(),
      localDb.legacyCharacterRecoveries.clear(),
    ]);
  });

  it("stores only explicit changed Character fields with account and save-attempt metadata", async () => {
    const repository = new CharacterRecoveryRepository();
    const canonical = createBuild();
    const envelope = await repository.createAttempt({
      account: accountA,
      attemptedBuild: { ...canonical, inventoryNotes: "Unsaved notes" },
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Save inventory notes",
      sourceSurface: "Character Inventory",
    });

    expect(envelope).toMatchObject({
      accountEmail: accountA.email,
      accountId: accountA.id,
      baseRevision: "revision-1",
      characterId: canonical.id,
      reconciliation: "ready",
      saveAttempt: { outcome: "pending" },
      sourceAction: "Save inventory notes",
      sourceSurface: "Character Inventory",
    });
    expect(envelope?.patch).toEqual([
      {
        attemptedValue: "Unsaved notes",
        baseValue: "Canonical notes",
        operation: "set",
        path: "/inventoryNotes",
      },
    ]);
    expect(formatCharacterRecoveryField("/inventoryNotes")).toBe("Inventory notes");
  });

  it("retains exactly the unsaved patch after a failed save and across repository reloads", async () => {
    const repository = new CharacterRecoveryRepository();
    const canonical = createBuild();
    const attempt = await repository.createAttempt({
      account: accountA,
      attemptedBuild: { ...canonical, inventoryNotes: "Unsaved notes" },
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Save notes",
      sourceSurface: "Character Sheet",
    });

    await repository.markAttemptOutcome(
      accountA.id,
      canonical.id,
      attempt!.saveAttempt.id,
      "failed",
      "TypeError",
    );

    await expect(
      new CharacterRecoveryRepository().get(accountA.id, canonical.id),
    ).resolves.toMatchObject({
      patch: [{ attemptedValue: "Unsaved notes", path: "/inventoryNotes" }],
      saveAttempt: { errorCode: "TypeError", outcome: "failed" },
    });
  });

  it("clears lost-success-response residue when canonical state already has the attempted value", async () => {
    const repository = new CharacterRecoveryRepository();
    const canonical = createBuild();
    const attempted = { ...canonical, inventoryNotes: "Saved despite lost response" };
    const attempt = await repository.createAttempt({
      account: accountA,
      attemptedBuild: attempted,
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Save notes",
      sourceSurface: "Character Sheet",
    });
    await repository.markAttemptOutcome(
      accountA.id,
      canonical.id,
      attempt!.saveAttempt.id,
      "failed",
      "NetworkError",
    );

    await expect(
      repository.reconcile(accountA.id, canonical.id, attempted, "revision-2"),
    ).resolves.toBeUndefined();
    await expect(repository.get(accountA.id, canonical.id)).resolves.toBeUndefined();
  });

  it("clears only the matching successful save attempt", async () => {
    const repository = new CharacterRecoveryRepository();
    const canonical = createBuild();
    const first = await repository.createAttempt({
      account: accountA,
      attemptedBuild: { ...canonical, inventoryNotes: "First attempt" },
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Save notes",
      sourceSurface: "Character Sheet",
    });
    const second = await repository.createAttempt({
      account: accountA,
      attemptedBuild: { ...canonical, inventoryNotes: "Newer attempt" },
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Save notes",
      sourceSurface: "Character Sheet",
    });

    await expect(
      repository.deleteAttempt(accountA.id, canonical.id, first!.saveAttempt.id),
    ).resolves.toBe(false);
    await expect(repository.get(accountA.id, canonical.id)).resolves.toMatchObject({
      patch: [{ attemptedValue: "Newer attempt" }],
      saveAttempt: { id: second!.saveAttempt.id },
    });
    await expect(
      repository.deleteAttempt(accountA.id, canonical.id, second!.saveAttempt.id),
    ).resolves.toBe(true);
    await expect(repository.get(accountA.id, canonical.id)).resolves.toBeUndefined();
  });

  it("does not delete a newer tab's retained recovery when a stale tab saves no changes", async () => {
    const repository = new CharacterRecoveryRepository();
    const canonical = createBuild();
    const retained = await repository.createAttempt({
      account: accountA,
      attemptedBuild: { ...canonical, inventoryNotes: "Newer tab unsaved notes" },
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Save notes in tab A",
      sourceSurface: "Character Sheet",
    });

    await expect(
      repository.createAttempt({
        account: accountA,
        attemptedBuild: canonical,
        baseBuild: canonical,
        baseRevision: "revision-1",
        characterId: canonical.id,
        sourceAction: "No-op save in stale tab B",
        sourceSurface: "Character Sheet",
      }),
    ).resolves.toBeUndefined();

    await expect(repository.get(accountA.id, canonical.id)).resolves.toStrictEqual(retained);
  });

  it("ignores a late outcome from an older save attempt when a newer attempt is current", async () => {
    const repository = new CharacterRecoveryRepository();
    const canonical = createBuild();
    const older = await repository.createAttempt({
      account: accountA,
      attemptedBuild: { ...canonical, inventoryNotes: "Older attempt" },
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Older save",
      sourceSurface: "Character Sheet",
    });
    const newer = await repository.createAttempt({
      account: accountA,
      attemptedBuild: { ...canonical, inventoryNotes: "Newer attempt" },
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Newer save",
      sourceSurface: "Character Sheet",
    });

    await expect(
      repository.markAttemptOutcome(
        accountA.id,
        canonical.id,
        older!.saveAttempt.id,
        "failed",
        "LateNetworkError",
      ),
    ).resolves.toBeUndefined();
    await expect(repository.get(accountA.id, canonical.id)).resolves.toStrictEqual(newer);
  });

  it("leaves recovery bytes and user-authored time unchanged on a no-op canonical reconcile", async () => {
    const repository = new CharacterRecoveryRepository();
    const canonical = createBuild();
    const attempt = await repository.createAttempt({
      account: accountA,
      attemptedBuild: { ...canonical, inventoryNotes: "Unsaved notes" },
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Save notes",
      sourceSurface: "Character Sheet",
    });
    await repository.markAttemptOutcome(
      accountA.id,
      canonical.id,
      attempt!.saveAttempt.id,
      "failed",
      "NetworkError",
    );
    const before = await repository.get(accountA.id, canonical.id);

    const state = await repository.reconcile(accountA.id, canonical.id, canonical, "revision-1");

    expect(state?.envelope).toStrictEqual(before);
    await expect(repository.get(accountA.id, canonical.id)).resolves.toStrictEqual(before);
    expect(state?.envelope.saveAttempt.attemptedAt).toBe(before?.saveAttempt.attemptedAt);
    expect(state?.envelope.updatedAt).toBe(before?.updatedAt);
  });

  it("safely rebases a notes patch over a demonstrably disjoint canonical name change", async () => {
    const repository = new CharacterRecoveryRepository();
    const canonical = createBuild();
    await repository.createAttempt({
      account: accountA,
      attemptedBuild: { ...canonical, inventoryNotes: "Unsaved notes" },
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Save notes",
      sourceSurface: "Character Sheet",
    });

    const state = await repository.reconcile(
      accountA.id,
      canonical.id,
      { ...canonical, name: "Canonical name changed elsewhere" },
      "revision-2",
    );

    expect(state?.conflictPaths).toEqual([]);
    expect(state?.envelope.baseRevision).toBe("revision-2");
    expect(state?.recoveredBuild).toMatchObject({
      inventoryNotes: "Unsaved notes",
      name: "Canonical name changed elsewhere",
    });
  });

  it("requires review when canonical state and recovery changed the same field", async () => {
    const repository = new CharacterRecoveryRepository();
    const canonical = createBuild();
    await repository.createAttempt({
      account: accountA,
      attemptedBuild: { ...canonical, inventoryNotes: "Unsaved notes" },
      baseBuild: canonical,
      baseRevision: "revision-1",
      characterId: canonical.id,
      sourceAction: "Save notes",
      sourceSurface: "Character Sheet",
    });

    const state = await repository.reconcile(
      accountA.id,
      canonical.id,
      { ...canonical, inventoryNotes: "Notes changed elsewhere" },
      "revision-2",
    );

    expect(state).toMatchObject({
      conflictPaths: ["/inventoryNotes"],
      envelope: { reconciliation: "conflict" },
      recoveredBuild: undefined,
    });
  });

  it("isolates recovery by both account and Character and purges only the signing-out account", async () => {
    const repository = new CharacterRecoveryRepository();
    const characterA = createBuild();
    const characterB = createBuild({ id: "character-b" });

    for (const [account, build] of [
      [accountA, characterA],
      [accountA, characterB],
      [accountB, characterA],
    ] as const) {
      await repository.createAttempt({
        account,
        attemptedBuild: { ...build, inventoryNotes: `${account.id}:${build.id}` },
        baseBuild: build,
        baseRevision: "revision-1",
        characterId: build.id,
        sourceAction: "Save notes",
        sourceSurface: "Character Sheet",
      });
    }

    expect(await repository.get(accountB.id, characterA.id)).toMatchObject({
      accountId: accountB.id,
      patch: [{ attemptedValue: `${accountB.id}:${characterA.id}` }],
    });
    expect(await repository.get(accountB.id, characterB.id)).toBeUndefined();

    await repository.purgeForAccount(accountA.id);

    expect(await repository.get(accountA.id, characterA.id)).toBeUndefined();
    expect(await repository.get(accountA.id, characterB.id)).toBeUndefined();
    expect(await repository.get(accountB.id, characterA.id)).toBeDefined();
  });

  it("does not disclose unattributed legacy quarantine existence through account-scoped lookup", async () => {
    const repository = new CharacterRecoveryRepository();
    const canonical = createBuild();
    const legacyRecord = {
      build: canonical,
      createdAt: "2026-08-20T00:00:00.000Z",
      finalizedAt: "2026-08-20T00:00:00.000Z",
      id: canonical.id,
      syncStatus: "local" as const,
      updatedAt: "2026-08-20T01:00:00.000Z",
    };
    await localDb.legacyCharacterRecoveries.bulkPut([
      {
        characterId: canonical.id,
        id: "legacy-unattributed",
        quarantinedAt: "2026-08-21T00:00:00.000Z",
        record: legacyRecord,
        sourceStore: "localCharacters",
        updatedAt: legacyRecord.updatedAt,
      },
      {
        accountId: accountA.id,
        characterId: canonical.id,
        id: "legacy-account-a",
        quarantinedAt: "2026-08-21T00:00:00.000Z",
        record: legacyRecord,
        sourceStore: "localCharacters",
        updatedAt: legacyRecord.updatedAt,
      },
    ]);

    await expect(
      repository.listLegacyQuarantineForAccount(accountB.id, canonical.id),
    ).resolves.toEqual([]);
    await expect(
      repository.listLegacyQuarantineForAccount(accountA.id, canonical.id),
    ).resolves.toEqual([expect.objectContaining({ id: "legacy-account-a" })]);
    await expect(localDb.legacyCharacterRecoveries.count()).resolves.toBe(2);
  });
});
