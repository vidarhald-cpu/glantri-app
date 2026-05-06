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

describe("loadServerCharacterEditContext", () => {
  beforeEach(() => {
    getMock.mockReset();
    saveMock.mockReset();
    loadCanonicalContentMock.mockReset();
    loadServerCharacterByIdMock.mockReset();
  });

  it("uses the newer local character build so player-requested checks reach GM Edit", async () => {
    const content = { skills: [] };
    const serverRecord = {
      build: baseBuild,
      id: "character-1",
      level: 1,
      name: "Progressor",
      ownerId: "owner-1",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const localRecord = {
      build: {
        ...baseBuild,
        progressionState: {
          availablePoints: 0,
          checks: [
            {
              checkedAt: "2026-01-02T00:00:00.000Z",
              id: "check-requested",
              status: "requested",
              targetId: "lore",
              targetLabel: "Lore",
              targetType: "skill"
            }
          ],
          history: [],
          pendingAttempts: []
        }
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      finalizedAt: "2026-01-01T00:00:00.000Z",
      id: "character-1",
      syncStatus: "local",
      updatedAt: "2026-01-02T00:00:00.000Z"
    };

    loadCanonicalContentMock.mockResolvedValue(content);
    loadServerCharacterByIdMock.mockResolvedValue(serverRecord);
    getMock.mockResolvedValue(localRecord);

    const { loadServerCharacterEditContext } = await import("./loadServerCharacterEditContext");
    const result = await loadServerCharacterEditContext("character-1");

    expect(saveMock).not.toHaveBeenCalled();
    expect(result.localRecord).toBe(localRecord);
    expect(result.serverRecord.build.progressionState.checks[0]).toMatchObject({
      status: "requested",
      targetId: "lore"
    });
  });
});
