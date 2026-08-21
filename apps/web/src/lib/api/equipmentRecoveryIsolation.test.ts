import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CharacterRecoveryEnvelope } from "../offline/glantriDexie";
import { localDb } from "../offline/glantriDexie";
import {
  addCharacterEquipmentItemOnServer,
  moveCharacterEquipmentItemOnServer,
  setCharacterActivePrimaryWeaponOnServer,
  transferCampaignItemOnServer,
} from "./equipmentClient";

const recovery: CharacterRecoveryEnvelope = {
  accountEmail: "player@example.com",
  accountId: "account-1",
  baseHash: "hash-1",
  baseRevision: "revision-1",
  characterId: "character-1",
  createdAt: "2026-08-21T10:00:00.000Z",
  id: "account-1:character-1",
  patch: [
    {
      attemptedValue: "Unsaved notes",
      baseValue: "Canonical notes",
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
  sourceAction: "Save inventory notes",
  sourceSurface: "Character Inventory",
  updatedAt: "2026-08-21T10:00:00.000Z",
};

describe("canonical Equipment recovery isolation", () => {
  beforeEach(async () => {
    await localDb.characterRecoveries.clear();
    await localDb.characterRecoveries.put(recovery);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              characters: [],
              state: { itemsById: {}, locationsById: {}, loadoutsByCharacterId: {} },
            }),
            { headers: { "content-type": "application/json" }, status: 200 },
          ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leaves Character recovery byte-for-byte unchanged through assign, move, transfer, and loadout calls", async () => {
    const before = await localDb.characterRecoveries.toArray();

    await addCharacterEquipmentItemOnServer({
      characterId: "character-1",
      initialCarryMode: "on_person",
      initialLocationId: "location-1",
      quantity: 1,
      templateId: "template-1",
    });
    await moveCharacterEquipmentItemOnServer({
      carryMode: "stored",
      characterId: "character-1",
      itemId: "item-1",
      locationId: "location-2",
    });
    await transferCampaignItemOnServer({
      campaignId: "campaign-1",
      itemId: "item-1",
      sourceCharacterId: "character-1",
      targetCharacterId: "character-2",
    });
    await setCharacterActivePrimaryWeaponOnServer({
      characterId: "character-1",
      itemId: "item-1",
    });

    expect(await localDb.characterRecoveries.toArray()).toStrictEqual(before);
  });
});
