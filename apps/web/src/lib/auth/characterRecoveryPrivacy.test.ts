import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import type { CharacterRecoveryEnvelope } from "../offline/glantriDexie";
import { localDb } from "../offline/glantriDexie";
import { purgeCharacterRecoveryOnLogout } from "./characterRecoveryPrivacy";

function envelope(accountId: string): CharacterRecoveryEnvelope {
  return {
    accountEmail: `${accountId}@example.com`,
    accountId,
    baseHash: "hash",
    baseRevision: "revision-1",
    characterId: "character-1",
    competingCandidates: [
      {
        baseHash: "hash",
        baseRevision: "revision-1",
        createdAt: "2026-08-21T10:01:00.000Z",
        patch: [
          {
            attemptedValue: "Rejected",
            baseValue: "Canonical",
            operation: "set",
            path: "/name",
          },
        ],
        reconciliation: "ready",
        relationshipToPrimary: "disjoint",
        saveAttempt: {
          attemptedAt: "2026-08-21T10:01:00.000Z",
          id: `${accountId}-candidate`,
          outcome: "conflict",
        },
        sourceAction: "Save identity",
        sourceSurface: "Character Sheet",
        updatedAt: "2026-08-21T10:01:00.000Z",
      },
    ],
    createdAt: "2026-08-21T10:00:00.000Z",
    id: `${accountId}:character-1`,
    patch: [
      {
        attemptedValue: "Unsaved",
        baseValue: "Canonical",
        operation: "set",
        path: "/inventoryNotes",
      },
    ],
    reconciliation: "ready",
    saveAttempt: {
      attemptedAt: "2026-08-21T10:00:00.000Z",
      id: "attempt-1",
      outcome: "failed",
    },
    sourceAction: "Save notes",
    sourceSurface: "Character Sheet",
    updatedAt: "2026-08-21T10:00:00.000Z",
  };
}

describe("purgeCharacterRecoveryOnLogout", () => {
  beforeEach(async () => {
    await localDb.characterRecoveries.clear();
  });

  it("purges the signing-out account without touching another account", async () => {
    await localDb.characterRecoveries.bulkPut([envelope("account-a"), envelope("account-b")]);

    await purgeCharacterRecoveryOnLogout("account-a");

    await expect(localDb.characterRecoveries.get("account-a:character-1")).resolves.toBeUndefined();
    await expect(localDb.characterRecoveries.get("account-b:character-1")).resolves.toBeDefined();
  });
});
