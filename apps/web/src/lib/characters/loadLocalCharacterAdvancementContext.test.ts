import { beforeEach, describe, expect, it, vi } from "vitest";

const draftGetMock = vi.fn();
const draftSaveMock = vi.fn();
const loadLocalCharacterContextMock = vi.fn();

vi.mock("./loadLocalCharacterContext", () => ({
  loadLocalCharacterContext: loadLocalCharacterContextMock,
}));

vi.mock("../offline/repositories/characterDraftRepository", () => ({
  CharacterDraftRepository: class CharacterDraftRepository {
    get = draftGetMock;
    save = draftSaveMock;
  },
}));

vi.mock("../offline/repositories/localCharacterRepository", () => ({
  getServerCharacterRevision: (record: {
    serverUpdatedAt?: string;
    syncStatus: string;
    updatedAt: string;
  }) => record.serverUpdatedAt ?? (record.syncStatus === "synced" ? record.updatedAt : undefined),
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
  progressionState: {
    availablePoints: 0,
    checks: [],
    history: [],
    pendingAttempts: [],
  },
};

describe("loadLocalCharacterAdvancementContext", () => {
  beforeEach(() => {
    draftGetMock.mockReset();
    draftSaveMock.mockReset();
    loadLocalCharacterContextMock.mockReset();
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
      serverUpdatedAt: "2026-01-01T00:00:00.000Z",
      syncStatus: "synced",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const record = {
      build: {
        ...baseBuild,
        progressionState: {
          availablePoints: 4,
          checks: [],
          history: [],
          pendingAttempts: [],
        },
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      finalizedAt: "2026-01-01T00:00:00.000Z",
      id: "character-1",
      serverUpdatedAt: "2026-01-02T00:00:00.000Z",
      syncStatus: "synced",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const refreshedDraft = {
      ...draft,
      advancementPointsTotal: 4,
      build: record.build,
      serverUpdatedAt: record.serverUpdatedAt,
      syncStatus: "synced",
      updatedAt: record.updatedAt,
    };

    loadLocalCharacterContextMock.mockResolvedValue({
      canonicalMissing: false,
      content,
      hasRevisionConflict: false,
      record,
    });
    draftGetMock.mockResolvedValue(draft);
    draftSaveMock.mockResolvedValue(refreshedDraft);

    const { loadLocalCharacterAdvancementContext } =
      await import("./loadLocalCharacterAdvancementContext");
    const result = await loadLocalCharacterAdvancementContext("character-1");

    expect(draftSaveMock).toHaveBeenCalledWith({
      advancementPointsSpent: 0,
      advancementPointsTotal: 4,
      build: record.build,
      characterId: "character-1",
      id: "character-1",
      serverUpdatedAt: "2026-01-02T00:00:00.000Z",
      syncStatus: "synced",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(result).toEqual({
      content,
      draft: refreshedDraft,
      hasRevisionConflict: false,
      record,
      recoveryRecord: undefined,
    });
  });

  it("presents canonical progression while retaining a stale draft for recovery", async () => {
    const content = { skills: [] };
    const recoveryDraft = {
      advancementPointsSpent: 0,
      advancementPointsTotal: 0,
      build: { ...baseBuild, name: "Offline progression" },
      characterId: "character-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "character-1",
      serverUpdatedAt: "2026-01-01T00:00:00.000Z",
      syncStatus: "local",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const record = {
      build: { ...baseBuild, name: "Server progression" },
      createdAt: "2026-01-01T00:00:00.000Z",
      finalizedAt: "2026-01-01T00:00:00.000Z",
      id: "character-1",
      serverUpdatedAt: "2026-01-03T00:00:00.000Z",
      syncStatus: "synced",
      updatedAt: "2026-01-03T00:00:00.000Z",
    };

    loadLocalCharacterContextMock.mockResolvedValue({
      canonicalMissing: false,
      content,
      hasRevisionConflict: true,
      record,
      recoveryRecord: { build: recoveryDraft.build },
    });
    draftGetMock.mockResolvedValue(recoveryDraft);

    const { loadLocalCharacterAdvancementContext } =
      await import("./loadLocalCharacterAdvancementContext");
    const result = await loadLocalCharacterAdvancementContext("character-1");

    expect(result.draft?.build).toStrictEqual(record.build);
    expect(result.recoveryDraft).toBe(recoveryDraft);
    expect(result.hasRevisionConflict).toBe(true);
    expect(draftSaveMock).not.toHaveBeenCalled();
  });

  it("keeps an unsaved Character build separate from current server progression", async () => {
    const content = { skills: [] };
    const recoveryRecord = {
      build: { ...baseBuild, name: "Unsaved Character edit" },
      createdAt: "2026-01-01T00:00:00.000Z",
      finalizedAt: "2026-01-01T00:00:00.000Z",
      id: "character-1",
      serverUpdatedAt: "2026-01-03T00:00:00.000Z",
      syncStatus: "local",
      updatedAt: "2026-01-04T00:00:00.000Z",
    };
    const record = {
      build: { ...baseBuild, name: "Current server build" },
      createdAt: "2026-01-01T00:00:00.000Z",
      finalizedAt: "2026-01-01T00:00:00.000Z",
      id: "character-1",
      serverUpdatedAt: "2026-01-03T00:00:00.000Z",
      syncStatus: "synced",
      updatedAt: "2026-01-03T00:00:00.000Z",
    };

    loadLocalCharacterContextMock.mockResolvedValue({
      canonicalMissing: false,
      content,
      hasRevisionConflict: false,
      record,
      recoveryRecord,
    });
    draftGetMock.mockResolvedValue(undefined);

    const { loadLocalCharacterAdvancementContext } =
      await import("./loadLocalCharacterAdvancementContext");
    const result = await loadLocalCharacterAdvancementContext("character-1");

    expect(result.draft?.build).toStrictEqual(record.build);
    expect(result.recoveryDraft?.build).toStrictEqual(recoveryRecord.build);
    expect(result.recoveryDraft).toMatchObject({
      serverUpdatedAt: recoveryRecord.serverUpdatedAt,
      syncStatus: "local",
    });
    expect(result.hasRevisionConflict).toBe(false);
    expect(draftSaveMock).not.toHaveBeenCalled();
  });
});
