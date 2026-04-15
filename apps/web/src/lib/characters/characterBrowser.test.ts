import { describe, expect, it } from "vitest";

import type { AuthUser } from "@glantri/auth";
import type { LocalCharacterRecord } from "../offline/glantriDexie";
import {
  buildCharacterBrowserEntries,
  filterCharacterBrowserEntries
} from "./characterBrowser";

function createRecord(input: Partial<LocalCharacterRecord> & Pick<LocalCharacterRecord, "id">): LocalCharacterRecord {
  return {
    build: {
      equipment: {
        items: []
      },
      id: input.id,
      name: input.build?.name ?? "Character",
      profile: input.build?.profile ?? {
        description: "Profile",
        distractionLevel: 2,
        id: `${input.id}:profile`,
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
          will: 10
        },
        socialClassResult: "Common",
        socialClassRoll: 10,
        societyLevel: 0
      },
      professionId: input.build?.professionId,
      progression: input.build?.progression ?? {
        chargenMode: "standard",
        educationPoints: 0,
        level: 1,
        primaryPoolSpent: 0,
        primaryPoolTotal: 60,
        secondaryPoolSpent: 0,
        secondaryPoolTotal: 0,
        skillGroups: [],
        skills: [],
        specializations: []
      },
      socialClass: input.build?.socialClass
    },
    createdAt: input.createdAt ?? "2026-04-10T10:00:00.000Z",
    creatorDisplayName: input.creatorDisplayName,
    creatorEmail: input.creatorEmail,
    creatorId: input.creatorId,
    finalizedAt: input.finalizedAt ?? "2026-04-10T10:00:00.000Z",
    id: input.id,
    syncStatus: input.syncStatus ?? "local",
    updatedAt: input.updatedAt ?? "2026-04-10T10:00:00.000Z"
  };
}

describe("characterBrowser", () => {
  const currentUser: AuthUser = {
    email: "gm@example.com",
    id: "gm-1",
    roles: ["game_master"]
  };

  it("sorts browser entries by most recently updated first", () => {
    const entries = buildCharacterBrowserEntries(
      [
        createRecord({
          id: "older",
          updatedAt: "2026-04-10T10:00:00.000Z"
        }),
        createRecord({
          id: "newer",
          updatedAt: "2026-04-12T10:00:00.000Z"
        })
      ],
      currentUser
    );

    expect(entries.map((entry) => entry.id)).toEqual(["newer", "older"]);
  });

  it("only treats recorded ownership buckets as filterable", () => {
    const entries = buildCharacterBrowserEntries(
      [
        createRecord({
          creatorDisplayName: "Player One",
          creatorEmail: "player@example.com",
          creatorId: "player-1",
          id: "player-character",
          syncStatus: "synced"
        }),
        createRecord({
          id: "gm-character"
        })
      ],
      currentUser
    );

    expect(
      filterCharacterBrowserEntries(entries, {
        currentUser,
        ownerFilter: "recorded_owner",
        typeFilter: "all"
      }).map((entry) => entry.id)
    ).toEqual(["player-character"]);

    expect(
      filterCharacterBrowserEntries(entries, {
        currentUser,
        ownerFilter: "no_recorded_owner",
        typeFilter: "all"
      }).map((entry) => entry.id)
    ).toEqual(["gm-character"]);
  });

  it("marks non-owned player-visible records as restricted for non-gm users", () => {
    const playerUser: AuthUser = {
      email: "player@example.com",
      id: "player-1",
      roles: ["player"]
    };

    const entries = buildCharacterBrowserEntries(
      [
        createRecord({
          creatorDisplayName: "Someone Else",
          creatorEmail: "other@example.com",
          creatorId: "player-2",
          id: "other-player-character",
          syncStatus: "synced"
        }),
        createRecord({
          creatorDisplayName: "Player One",
          creatorEmail: "player@example.com",
          creatorId: "player-1",
          id: "own-character",
          syncStatus: "synced"
        })
      ],
      playerUser
    );

    const restrictedEntry = entries.find((entry) => entry.id === "other-player-character");
    const ownEntry = entries.find((entry) => entry.id === "own-character");

    expect(restrictedEntry).toBeDefined();
    expect(ownEntry).toBeDefined();
    expect(restrictedEntry!.canOpenSheet).toBe(false);
    expect(restrictedEntry!.accessLabel).toBe("Server-backed, not openable here");
    expect(ownEntry!.canOpenSheet).toBe(true);
    expect(ownEntry!.canJoinScenario).toBe(true);
  });
});
