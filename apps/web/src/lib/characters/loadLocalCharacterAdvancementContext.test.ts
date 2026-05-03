import { beforeEach, describe, expect, it, vi } from "vitest";

const draftGetMock = vi.fn();
const draftSaveMock = vi.fn();
const loadCanonicalContentMock = vi.fn();
const characterGetMock = vi.fn();

vi.mock("../content/loadCanonicalContent", () => ({
  loadCanonicalContent: loadCanonicalContentMock
}));

vi.mock("../offline/repositories/characterDraftRepository", () => ({
  CharacterDraftRepository: class CharacterDraftRepository {
    get = draftGetMock;
    save = draftSaveMock;
  }
}));

vi.mock("../offline/repositories/localCharacterRepository", () => ({
  LocalCharacterRepository: class LocalCharacterRepository {
    get = characterGetMock;
  }
}));

const baseBuild = {
  equipment: { items: [] },
  id: "character-1",
  name: "Progressor",
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
  },
  progressionState: {
    availablePoints: 0,
    checks: [],
    history: [],
    pendingAttempts: []
  }
};

describe("loadLocalCharacterAdvancementContext", () => {
  beforeEach(() => {
    draftGetMock.mockReset();
    draftSaveMock.mockReset();
    loadCanonicalContentMock.mockReset();
    characterGetMock.mockReset();
  });

  it("refreshes a stale advancement draft from the newer character record", async () => {
    const content = { skills: [] };
    const draft = {
      advancementPointsSpent: 0,
      advancementPointsTotal: 0,
      build: baseBuild,
      characterId: "character-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "character-1",
      syncStatus: "local",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const record = {
      build: {
        ...baseBuild,
        progressionState: {
          availablePoints: 4,
          checks: [],
          history: [],
          pendingAttempts: []
        }
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      finalizedAt: "2026-01-01T00:00:00.000Z",
      id: "character-1",
      syncStatus: "synced",
      updatedAt: "2026-01-02T00:00:00.000Z"
    };
    const refreshedDraft = {
      ...draft,
      advancementPointsTotal: 4,
      build: record.build,
      syncStatus: "synced",
      updatedAt: record.updatedAt
    };

    loadCanonicalContentMock.mockResolvedValue(content);
    draftGetMock.mockResolvedValue(draft);
    characterGetMock.mockResolvedValue(record);
    draftSaveMock.mockResolvedValue(refreshedDraft);

    const { loadLocalCharacterAdvancementContext } = await import("./loadLocalCharacterAdvancementContext");
    const result = await loadLocalCharacterAdvancementContext("character-1");

    expect(draftSaveMock).toHaveBeenCalledWith({
      advancementPointsSpent: 0,
      advancementPointsTotal: 4,
      build: record.build,
      characterId: "character-1",
      id: "character-1",
      syncStatus: "synced",
      updatedAt: "2026-01-02T00:00:00.000Z"
    });
    expect(result).toEqual({
      content,
      draft: refreshedDraft,
      record
    });
  });
});
