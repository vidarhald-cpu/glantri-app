import { describe, expect, it } from "vitest";

import type { AuthUser } from "@glantri/auth";
import type { ServerCharacterRecord } from "../api/localServiceClient";
import type { LocalCharacterRecord } from "../offline/glantriDexie";
import {
  canBrowseAllCharacterOwners,
  buildCharacterBrowserEntries,
  buildCharacterBrowserOwnerOptions,
  filterCharacterBrowserEntries
} from "./characterBrowser";

function createLocalRecord(input: Partial<LocalCharacterRecord> & Pick<LocalCharacterRecord, "id">): LocalCharacterRecord {
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
      socialClass: input.build?.socialClass,
      societyId: input.build?.societyId
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

function createServerRecord(
  input: Partial<ServerCharacterRecord> & Pick<ServerCharacterRecord, "id">
): ServerCharacterRecord {
  return {
    build: input.build ?? createLocalRecord({ id: input.id }).build,
    createdAt: input.createdAt ?? "2026-04-12T10:00:00.000Z",
    id: input.id,
    level: input.level ?? 1,
    name: input.name ?? input.build?.name ?? "Character",
    owner: input.owner,
    ownerId: input.ownerId,
    updatedAt: input.updatedAt ?? "2026-04-12T10:00:00.000Z"
  };
}

describe("characterBrowser", () => {
  const currentUser: AuthUser = {
    email: "gm@example.com",
    id: "gm-1",
    roles: ["game_master"]
  };

  it("merges local and server-backed characters and sorts by most recent save", () => {
    const entries = buildCharacterBrowserEntries({
      currentUser,
      localRecords: [
        createLocalRecord({
          id: "local-only",
          updatedAt: "2026-04-10T10:00:00.000Z"
        }),
        createLocalRecord({
          creatorId: "player-1",
          id: "server-copy",
          syncStatus: "synced",
          updatedAt: "2026-04-09T10:00:00.000Z"
        })
      ],
      serverRecords: [
        createServerRecord({
          id: "server-copy",
          owner: {
            displayName: "Player One",
            email: "player@example.com",
            id: "player-1"
          },
          ownerId: "player-1",
          updatedAt: "2026-04-12T10:00:00.000Z"
        }),
        createServerRecord({
          id: "the-gladiator",
          name: "The Gladiator",
          owner: {
            displayName: "Arena GM",
            email: "arena@example.com",
            id: "gm-2"
          },
          ownerId: "gm-2",
          updatedAt: "2026-04-11T10:00:00.000Z"
        })
      ]
    });

    expect(entries.map((entry) => entry.id)).toEqual([
      "server-copy",
      "the-gladiator",
      "local-only"
    ]);
    expect(entries.find((entry) => entry.id === "server-copy")?.sourceLabel).toBe("Server-backed");
    expect(entries.find((entry) => entry.id === "local-only")?.sourceLabel).toBe("Local-only");
  });

  it("drops stale synced local records that no longer exist on the server", () => {
    const entries = buildCharacterBrowserEntries({
      currentUser,
      localRecords: [
        createLocalRecord({
          creatorId: "player-1",
          id: "stale-server-copy",
          syncStatus: "synced",
          updatedAt: "2026-04-09T10:00:00.000Z"
        }),
        createLocalRecord({
          id: "local-only",
          syncStatus: "local",
          updatedAt: "2026-04-10T10:00:00.000Z"
        })
      ],
      serverRecords: []
    });

    expect(entries.map((entry) => entry.id)).toEqual(["local-only"]);
    expect(entries[0]?.sourceLabel).toBe("Local-only");
  });

  it("builds owner options from distinct owners and filters by specific owner", () => {
    const entries = buildCharacterBrowserEntries({
      currentUser,
      localRecords: [createLocalRecord({ id: "local-only" })],
      serverRecords: [
        createServerRecord({
          id: "the-gladiator",
          name: "The Gladiator",
          owner: {
            displayName: "Arena GM",
            email: "arena@example.com",
            id: "gm-2"
          },
          ownerId: "gm-2"
        }),
        createServerRecord({
          id: "scribe",
          owner: {
            displayName: "Player One",
            email: "player@example.com",
            id: "player-1"
          },
          ownerId: "player-1"
        })
      ]
    });

    expect(buildCharacterBrowserOwnerOptions(entries)).toEqual([
      { label: "All owners", value: "all" },
      { label: "Arena GM (arena@example.com)", value: "owner:gm-2" },
      { label: "No recorded owner", value: "owner:none" },
      { label: "Player One (player@example.com)", value: "owner:player-1" }
    ]);

    expect(
      filterCharacterBrowserEntries(entries, {
        ownerFilter: "owner:gm-2",
        sourceFilter: "all",
        typeFilter: "all"
      }).map((entry) => entry.id)
    ).toEqual(["the-gladiator"]);
  });

  it("only enables cross-owner browsing for GM and admin roles", () => {
    expect(
      canBrowseAllCharacterOwners({
        email: "gm@example.com",
        id: "gm-1",
        roles: ["game_master"]
      })
    ).toBe(true);
    expect(
      canBrowseAllCharacterOwners({
        email: "admin@example.com",
        id: "admin-1",
        roles: ["admin"]
      })
    ).toBe(true);
    expect(
      canBrowseAllCharacterOwners({
        email: "player@example.com",
        id: "player-1",
        roles: ["player"]
      })
    ).toBe(false);
  });

  it("supports source and NPC filtering independently", () => {
    const entries = buildCharacterBrowserEntries({
      currentUser: {
        email: "player@example.com",
        id: "player-1",
        roles: ["player"]
      },
      localRecords: [
        createLocalRecord({
          build: {
            ...createLocalRecord({ id: "local-npc-base" }).build,
            name: "Street Tough"
          },
          id: "local-npc",
          syncStatus: "local"
        })
      ],
      serverRecords: [
        createServerRecord({
          build: {
            ...createLocalRecord({ id: "pc-base" }).build,
            name: "The Gladiator",
            professionId: "gladiator",
            socialClass: "Common",
            societyId: "glantri"
          },
          id: "the-gladiator",
          owner: {
            displayName: "Arena GM",
            email: "arena@example.com",
            id: "gm-2"
          },
          ownerId: "gm-2"
        })
      ]
    });

    expect(entries.find((entry) => entry.id === "local-npc")?.type).toBe("npc");
    expect(entries.find((entry) => entry.id === "the-gladiator")?.type).toBe("pc");

    expect(
      filterCharacterBrowserEntries(entries, {
        ownerFilter: "all",
        sourceFilter: "local",
        typeFilter: "all"
      }).map((entry) => entry.id)
    ).toEqual(["local-npc"]);

    expect(
      filterCharacterBrowserEntries(entries, {
        ownerFilter: "all",
        sourceFilter: "all",
        typeFilter: "npc"
      }).map((entry) => entry.id)
    ).toEqual(["local-npc"]);
  });

  it("marks non-owned server-backed records as restricted for non-gm users", () => {
    const playerUser: AuthUser = {
      email: "player@example.com",
      id: "player-1",
      roles: ["player"]
    };

    const entries = buildCharacterBrowserEntries({
      currentUser: playerUser,
      localRecords: [],
      serverRecords: [
        createServerRecord({
          id: "other-player-character",
          owner: {
            displayName: "Someone Else",
            email: "other@example.com",
            id: "player-2"
          },
          ownerId: "player-2"
        }),
        createServerRecord({
          id: "own-character",
          owner: {
            displayName: "Player One",
            email: "player@example.com",
            id: "player-1"
          },
          ownerId: "player-1"
        })
      ]
    });

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
