import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CharacterBuild } from "@glantri/domain";

import type { CharacterRecoveryEnvelope } from "../offline/glantriDexie";
import { localDb } from "../offline/glantriDexie";
import {
  CharacterRecoveryRepository,
  hashCharacterBuild,
} from "../offline/repositories/characterRecoveryRepository";
import {
  addCharacterEquipmentItemOnServer,
  moveCharacterEquipmentItemOnServer,
  setCharacterActivePrimaryWeaponOnServer,
  transferCampaignItemOnServer,
} from "./equipmentClient";

const canonicalBuild: CharacterBuild = {
  equipment: { items: [] },
  id: "character-1",
  inventoryNotes: "Canonical notes",
  name: "Canonical Character",
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

const recovery: CharacterRecoveryEnvelope = {
  accountEmail: "player@example.com",
  accountId: "account-1",
  baseHash: hashCharacterBuild(canonicalBuild),
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

  it("leaves Character recovery bytes and source time unchanged through canonical Equipment load, assign, move, transfer, and loadout calls", async () => {
    const before = await localDb.characterRecoveries.toArray();
    const repository = new CharacterRecoveryRepository();

    await repository.reconcile(
      recovery.accountId,
      recovery.characterId,
      canonicalBuild,
      recovery.baseRevision,
    );

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

    const after = await localDb.characterRecoveries.toArray();
    expect(after).toStrictEqual(before);
    expect(after[0]?.saveAttempt.attemptedAt).toBe(recovery.saveAttempt.attemptedAt);
    expect(after[0]?.updatedAt).toBe(recovery.updatedAt);
  });
});
