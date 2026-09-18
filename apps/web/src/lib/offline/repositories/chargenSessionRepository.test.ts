import { createChargenProgression } from "@glantri/rules-engine";
import { afterEach, describe, expect, it } from "vitest";

import { localDb } from "../glantriDexie";
import { ChargenSessionRepository, getChargenSessionIdForOwner } from "./chargenSessionRepository";

describe("ChargenSessionRepository account ownership", () => {
  const repository = new ChargenSessionRepository();
  const ownerA = "issue230-owner-a";
  const ownerB = "issue230-owner-b";

  afterEach(async () => {
    await localDb.chargenSessions.bulkDelete([
      getChargenSessionIdForOwner(ownerA),
      getChargenSessionIdForOwner(ownerB),
    ]);
  });

  it("keeps drafts isolated when two accounts use the same browser database", async () => {
    await repository.save({
      characterName: "Alyssa",
      ownerId: ownerA,
      progression: createChargenProgression(),
    });
    await repository.save({
      characterName: "Borin",
      ownerId: ownerB,
      progression: createChargenProgression(),
    });

    await expect(repository.getForOwner(ownerA)).resolves.toMatchObject({
      characterName: "Alyssa",
      id: getChargenSessionIdForOwner(ownerA),
      ownerId: ownerA,
    });
    await expect(repository.getForOwner(ownerB)).resolves.toMatchObject({
      characterName: "Borin",
      id: getChargenSessionIdForOwner(ownerB),
      ownerId: ownerB,
    });
  });

  it("deletes only the authenticated account draft", async () => {
    await repository.save({
      characterName: "Alyssa",
      ownerId: ownerA,
      progression: createChargenProgression(),
    });
    await repository.save({
      characterName: "Borin",
      ownerId: ownerB,
      progression: createChargenProgression(),
    });

    await repository.deleteForOwner(ownerA);

    await expect(repository.getForOwner(ownerA)).resolves.toBeUndefined();
    await expect(repository.getForOwner(ownerB)).resolves.toMatchObject({
      characterName: "Borin",
      ownerId: ownerB,
    });
  });

  it("orders an already-started save before finalization deletion", async () => {
    const pendingSave = repository.save({
      characterName: "Finalizing Alyssa",
      ownerId: ownerA,
      progression: createChargenProgression(),
    });
    const finalizationDelete = repository.deleteForOwner(ownerA);

    await Promise.all([pendingSave, finalizationDelete]);

    await expect(repository.getForOwner(ownerA)).resolves.toBeUndefined();
  });

  it("does not expose an unowned legacy global draft to an authenticated account", async () => {
    await localDb.chargenSessions.put({
      characterName: "Unassigned browser draft",
      createdAt: "2026-09-18T08:00:00.000Z",
      id: "chargen-vertical-slice",
      ownerId: "",
      progression: createChargenProgression(),
      updatedAt: "2026-09-18T08:00:00.000Z",
    });

    await expect(repository.getForOwner(ownerA)).resolves.toBeUndefined();

    await localDb.chargenSessions.delete("chargen-vertical-slice");
  });
});
