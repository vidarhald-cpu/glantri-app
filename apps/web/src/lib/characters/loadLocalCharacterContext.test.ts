import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
const saveMock = vi.fn();
const loadCanonicalContentMock = vi.fn();
const loadServerCharacterByIdMock = vi.fn();

vi.mock("../content/loadCanonicalContent", () => ({
  loadCanonicalContent: loadCanonicalContentMock,
}));

vi.mock("../api/characterClient", () => ({
  loadServerCharacterById: loadServerCharacterByIdMock,
}));

vi.mock("../offline/repositories/localCharacterRepository", () => ({
  buildServerBackedLocalCharacterRecord: (
    serverRecord: {
      build: unknown;
      createdAt: string;
      id: string;
      ownerId?: string;
      updatedAt: string;
    },
    existing?: { createdAt: string; finalizedAt: string },
  ) => ({
    build: serverRecord.build,
    createdAt: existing?.createdAt ?? serverRecord.createdAt,
    creatorId: serverRecord.ownerId,
    finalizedAt: existing?.finalizedAt ?? serverRecord.createdAt,
    id: serverRecord.id,
    serverUpdatedAt: serverRecord.updatedAt,
    syncStatus: "synced",
    updatedAt: serverRecord.updatedAt,
  }),
  getServerCharacterRevision: (record: {
    serverUpdatedAt?: string;
    syncStatus: string;
    updatedAt: string;
  }) => record.serverUpdatedAt ?? (record.syncStatus === "synced" ? record.updatedAt : undefined),
  LocalCharacterRepository: class LocalCharacterRepository {
    get = getMock;
    save = saveMock;
  },
}));

describe("loadLocalCharacterContext", () => {
  beforeEach(() => {
    getMock.mockReset();
    saveMock.mockReset();
    loadCanonicalContentMock.mockReset();
    loadServerCharacterByIdMock.mockReset();
  });

  it("refreshes an existing synced cache from the canonical server Character", async () => {
    const content = { skills: [] };
    const localRecord = {
      build: {
        equipment: { items: [] },
        id: "character-1",
        name: "Local Character",
        profile: {
          description: "Test",
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
          level: 1,
          primaryPoolSpent: 0,
          primaryPoolTotal: 60,
          secondaryPoolSpent: 0,
          secondaryPoolTotal: 0,
          skillGroups: [],
          skills: [],
          specializations: [],
        },
      },
      createdAt: "2026-04-21T00:00:00.000Z",
      finalizedAt: "2026-04-21T00:00:00.000Z",
      id: "character-1",
      syncStatus: "synced",
      updatedAt: "2026-04-21T00:00:00.000Z",
    };

    loadCanonicalContentMock.mockResolvedValue(content);
    getMock.mockResolvedValue(localRecord);
    const serverRecord = {
      build: { ...localRecord.build, name: "Canonical Character" },
      createdAt: localRecord.createdAt,
      id: localRecord.id,
      level: 1,
      name: "Canonical Character",
      ownerId: "owner-1",
      updatedAt: "2026-04-21T01:00:00.000Z",
    };
    const savedRecord = {
      ...localRecord,
      build: serverRecord.build,
      creatorId: "owner-1",
      serverUpdatedAt: serverRecord.updatedAt,
      updatedAt: serverRecord.updatedAt,
    };
    loadServerCharacterByIdMock.mockResolvedValue(serverRecord);
    saveMock.mockResolvedValue(savedRecord);

    const { loadLocalCharacterContext } = await import("./loadLocalCharacterContext");
    const result = await loadLocalCharacterContext("character-1");

    expect(result).toEqual({
      canonicalMissing: false,
      content,
      hasRevisionConflict: false,
      record: savedRecord,
    });
    expect(loadServerCharacterByIdMock).toHaveBeenCalledWith("character-1");
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ build: serverRecord.build }));
  });

  it("falls back to the server record and saves it locally when no local cache exists", async () => {
    const content = { skills: [] };
    const serverRecord = {
      build: {
        equipment: { items: [] },
        id: "character-2",
        name: "Remote Character",
        profile: {
          description: "Test",
          distractionLevel: 4,
          id: "profile-2",
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
          level: 1,
          primaryPoolSpent: 0,
          primaryPoolTotal: 60,
          secondaryPoolSpent: 0,
          secondaryPoolTotal: 0,
          skillGroups: [],
          skills: [],
          specializations: [],
        },
      },
      createdAt: "2026-04-21T00:00:00.000Z",
      id: "character-2",
      level: 1,
      name: "Remote Character",
      owner: {
        displayName: "Player One",
        email: "player@example.com",
        id: "owner-1",
      },
      ownerId: "owner-1",
      updatedAt: "2026-04-21T01:00:00.000Z",
    };
    const savedRecord = {
      build: serverRecord.build,
      createdAt: "2026-04-21T01:00:00.000Z",
      creatorDisplayName: "Player One",
      creatorEmail: "player@example.com",
      creatorId: "owner-1",
      finalizedAt: "2026-04-21T01:00:00.000Z",
      id: "character-2",
      syncStatus: "synced",
      updatedAt: "2026-04-21T01:00:00.000Z",
    };

    loadCanonicalContentMock.mockResolvedValue(content);
    getMock.mockResolvedValue(undefined);
    loadServerCharacterByIdMock.mockResolvedValue(serverRecord);
    saveMock.mockResolvedValue(savedRecord);

    const { loadLocalCharacterContext } = await import("./loadLocalCharacterContext");
    const result = await loadLocalCharacterContext("character-2");

    expect(loadServerCharacterByIdMock).toHaveBeenCalledWith("character-2");
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        build: serverRecord.build,
        creatorId: "owner-1",
        serverUpdatedAt: "2026-04-21T01:00:00.000Z",
        syncStatus: "synced",
        updatedAt: "2026-04-21T01:00:00.000Z",
      }),
    );
    expect(result).toEqual({
      canonicalMissing: false,
      content,
      hasRevisionConflict: false,
      record: savedRecord,
    });
  });

  it("shows the canonical Character while retaining a stale local draft across reloads", async () => {
    const content = { skills: [] };
    const localRecord = {
      build: { id: "character-4", name: "Offline draft" },
      createdAt: "2026-04-21T00:00:00.000Z",
      finalizedAt: "2026-04-21T00:00:00.000Z",
      id: "character-4",
      serverUpdatedAt: "2026-04-21T00:00:00.000Z",
      syncStatus: "local",
      updatedAt: "2026-04-21T01:00:00.000Z",
    };
    const serverRecord = {
      build: { id: "character-4", name: "Canonical current" },
      createdAt: "2026-04-21T00:00:00.000Z",
      id: "character-4",
      level: 1,
      name: "Canonical current",
      ownerId: "owner-1",
      updatedAt: "2026-04-21T02:00:00.000Z",
    };

    loadCanonicalContentMock.mockResolvedValue(content);
    getMock.mockResolvedValue(localRecord);
    loadServerCharacterByIdMock.mockResolvedValue(serverRecord);

    const { loadLocalCharacterContext } = await import("./loadLocalCharacterContext");
    const first = await loadLocalCharacterContext("character-4");
    const repeated = await loadLocalCharacterContext("character-4");

    expect(first.record?.build).toBe(serverRecord.build);
    expect(first.recoveryRecord).toBe(localRecord);
    expect(first.hasRevisionConflict).toBe(true);
    expect(repeated.record?.build).toBe(serverRecord.build);
    expect(repeated.recoveryRecord).toBe(localRecord);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("can load the current server record even when a stale local cache exists", async () => {
    const content = { skills: [] };
    const staleLocalRecord = {
      build: {
        equipment: { items: [] },
        id: "character-3",
        name: "Stale Local Character",
        profile: {
          description: "Test",
          distractionLevel: 3,
          id: "profile-3",
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
          level: 1,
          primaryPoolSpent: 0,
          primaryPoolTotal: 60,
          secondaryPoolSpent: 0,
          secondaryPoolTotal: 0,
          skillGroups: [],
          skills: [{ skillId: "1-h edged", xp: 6 }],
          specializations: [],
        },
      },
      createdAt: "2026-04-21T00:00:00.000Z",
      finalizedAt: "2026-04-21T00:00:00.000Z",
      id: "character-3",
      syncStatus: "synced",
      updatedAt: "2026-04-21T00:00:00.000Z",
    };
    const currentServerRecord = {
      build: {
        ...staleLocalRecord.build,
        name: "Current Server Character",
        progression: {
          ...staleLocalRecord.build.progression,
          skills: [{ skillId: "1-h edged", xp: 8 }],
        },
      },
      createdAt: "2026-04-21T00:00:00.000Z",
      id: "character-3",
      level: 1,
      name: "Current Server Character",
      ownerId: "owner-1",
      updatedAt: "2026-04-21T02:00:00.000Z",
    };

    loadCanonicalContentMock.mockResolvedValue(content);
    getMock.mockResolvedValue(staleLocalRecord);
    loadServerCharacterByIdMock.mockResolvedValue(currentServerRecord);

    const { loadCurrentCharacterContext } = await import("./loadLocalCharacterContext");
    const result = await loadCurrentCharacterContext("character-3");

    expect(getMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
    expect(loadServerCharacterByIdMock).toHaveBeenCalledWith("character-3");
    expect(result).toEqual({
      content,
      record: currentServerRecord,
    });
  });
});
