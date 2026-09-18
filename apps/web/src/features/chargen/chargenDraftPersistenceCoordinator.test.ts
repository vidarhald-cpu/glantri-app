import { createChargenProgression } from "@glantri/rules-engine";
import { afterEach, describe, expect, it, vi } from "vitest";

import { localDb } from "@/lib/offline/glantriDexie";
import {
  ChargenSessionRepository,
  getChargenSessionIdForOwner,
} from "@/lib/offline/repositories/chargenSessionRepository";

import { ChargenDraftPersistenceCoordinator } from "./chargenDraftPersistenceCoordinator";

describe("ChargenDraftPersistenceCoordinator", () => {
  const repository = new ChargenSessionRepository();
  const ownerA = "issue230-finalized-owner";
  const ownerB = "issue230-other-owner";

  afterEach(async () => {
    await localDb.chargenSessions.bulkDelete([
      getChargenSessionIdForOwner(ownerA),
      getChargenSessionIdForOwner(ownerB),
    ]);
  });

  it("drains an in-flight write and suppresses a queued autosave before finalization deletion", async () => {
    await repository.save({
      characterName: "Finalizing Alyssa",
      ownerId: ownerA,
      progression: createChargenProgression(),
    });
    await repository.save({
      characterName: "Borin's isolated draft",
      ownerId: ownerB,
      progression: createChargenProgression(),
    });

    let releaseInFlightWrite: (() => void) | undefined;
    const inFlightWriteBlocked = new Promise<void>((resolve) => {
      releaseInFlightWrite = resolve;
    });
    let confirmInFlightWriteStarted: (() => void) | undefined;
    const inFlightWriteStarted = new Promise<void>((resolve) => {
      confirmInFlightWriteStarted = resolve;
    });
    const queuedAutosave = vi.fn(async () => {
      await repository.save({
        characterName: "Recreated after finalization",
        ownerId: ownerA,
        progression: createChargenProgression(),
      });
    });
    const coordinator = new ChargenDraftPersistenceCoordinator(vi.fn());

    coordinator.enqueue(async () => {
      confirmInFlightWriteStarted?.();
      await inFlightWriteBlocked;
      await repository.save({
        characterName: "Last in-flight draft state",
        ownerId: ownerA,
        progression: createChargenProgression(),
      });
    });
    coordinator.enqueue(queuedAutosave);

    await inFlightWriteStarted;
    const drain = coordinator.suspendAndDrain();
    releaseInFlightWrite?.();
    await drain;
    await repository.deleteForOwner(ownerA);

    expect(queuedAutosave).not.toHaveBeenCalled();
    await expect(repository.getForOwner(ownerA)).resolves.toBeUndefined();
    await expect(repository.getForOwner(ownerB)).resolves.toMatchObject({
      characterName: "Borin's isolated draft",
      ownerId: ownerB,
    });
  });
});
