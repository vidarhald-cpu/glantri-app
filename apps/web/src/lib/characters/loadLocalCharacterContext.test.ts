import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
const saveMock = vi.fn();
const loadCanonicalContentMock = vi.fn();
const loadServerCharacterByIdMock = vi.fn();

vi.mock("../content/loadCanonicalContent", () => ({
  loadCanonicalContent: loadCanonicalContentMock
}));

vi.mock("../api/localServiceClient", () => ({
  loadServerCharacterById: loadServerCharacterByIdMock
}));

vi.mock("../offline/repositories/localCharacterRepository", () => ({
  LocalCharacterRepository: class LocalCharacterRepository {
    get = getMock;
    save = saveMock;
  }
}));

describe("loadLocalCharacterContext", () => {
  beforeEach(() => {
    getMock.mockReset();
    saveMock.mockReset();
    loadCanonicalContentMock.mockReset();
    loadServerCharacterByIdMock.mockReset();
  });

  it("returns the existing local record without fetching the server copy", async () => {
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
            will: 10
          },
          societyLevel: 0
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
          specializations: []
        }
      },
      createdAt: "2026-04-21T00:00:00.000Z",
      finalizedAt: "2026-04-21T00:00:00.000Z",
      id: "character-1",
      syncStatus: "synced",
      updatedAt: "2026-04-21T00:00:00.000Z"
    };

    loadCanonicalContentMock.mockResolvedValue(content);
    getMock.mockResolvedValue(localRecord);

    const { loadLocalCharacterContext } = await import("./loadLocalCharacterContext");
    const result = await loadLocalCharacterContext("character-1");

    expect(result).toEqual({
      content,
      record: localRecord
    });
    expect(loadServerCharacterByIdMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
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
            will: 10
          },
          societyLevel: 0
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
          specializations: []
        }
      },
      createdAt: "2026-04-21T00:00:00.000Z",
      id: "character-2",
      level: 1,
      name: "Remote Character",
      owner: {
        displayName: "Player One",
        email: "player@example.com",
        id: "owner-1"
      },
      ownerId: "owner-1",
      updatedAt: "2026-04-21T01:00:00.000Z"
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
      updatedAt: "2026-04-21T01:00:00.000Z"
    };

    loadCanonicalContentMock.mockResolvedValue(content);
    getMock.mockResolvedValue(undefined);
    loadServerCharacterByIdMock.mockResolvedValue(serverRecord);
    saveMock.mockResolvedValue(savedRecord);

    const { loadLocalCharacterContext } = await import("./loadLocalCharacterContext");
    const result = await loadLocalCharacterContext("character-2");

    expect(loadServerCharacterByIdMock).toHaveBeenCalledWith("character-2");
    expect(saveMock).toHaveBeenCalledWith({
      build: serverRecord.build,
      creatorDisplayName: "Player One",
      creatorEmail: "player@example.com",
      creatorId: "owner-1",
      syncStatus: "synced",
      updatedAt: "2026-04-21T01:00:00.000Z"
    });
    expect(result).toEqual({
      content,
      record: savedRecord
    });
  });
});
