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
  getServerCharacterRevision: (record: { serverUpdatedAt?: string }) => record.serverUpdatedAt,
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

const record = {
  build: baseBuild,
  createdAt: "2026-01-01T00:00:00.000Z",
  finalizedAt: "2026-01-01T00:00:00.000Z",
  id: "character-1",
  serverUpdatedAt: "2026-01-02T00:00:00.000Z",
  syncStatus: "synced",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("loadLocalCharacterAdvancementContext", () => {
  beforeEach(() => {
    draftGetMock.mockReset().mockResolvedValue(undefined);
    draftSaveMock.mockReset();
    loadLocalCharacterContextMock.mockReset();
  });

  it("always refreshes the non-authoritative advancement cache from canonical Character state", async () => {
    const canonicalDraft = {
      advancementPointsSpent: 0,
      advancementPointsTotal: 0,
      build: baseBuild,
      characterId: record.id,
      createdAt: record.createdAt,
      id: record.id,
      serverUpdatedAt: record.serverUpdatedAt,
      syncStatus: "synced",
      updatedAt: record.updatedAt,
    };
    loadLocalCharacterContextMock.mockResolvedValue({
      canonicalMissing: false,
      conflictPaths: [],
      content: { skills: [] },
      hasRevisionConflict: false,
      record,
    });
    draftSaveMock.mockResolvedValue(canonicalDraft);

    const { loadLocalCharacterAdvancementContext } =
      await import("./loadLocalCharacterAdvancementContext");
    const result = await loadLocalCharacterAdvancementContext(record.id, "account-1");

    expect(loadLocalCharacterContextMock).toHaveBeenCalledWith(record.id, "account-1");
    expect(draftSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        build: baseBuild,
        serverUpdatedAt: record.serverUpdatedAt,
        syncStatus: "synced",
      }),
    );
    expect(result).toMatchObject({
      draft: canonicalDraft,
      hasRevisionConflict: false,
      record,
    });
  });

  it("keeps an account-scoped recovered progression build separate from canonical state", async () => {
    const recoveredBuild = { ...baseBuild, name: "Unsaved progression" };
    const recoveryRecord = {
      accountId: "account-1",
      characterId: record.id,
      createdAt: "2026-01-02T01:00:00.000Z",
      patch: [{ attemptedValue: "Unsaved progression", operation: "set", path: "/name" }],
      updatedAt: "2026-01-02T02:00:00.000Z",
    };
    const canonicalDraft = {
      advancementPointsSpent: 0,
      advancementPointsTotal: 0,
      build: baseBuild,
      characterId: record.id,
      createdAt: record.createdAt,
      id: record.id,
      serverUpdatedAt: record.serverUpdatedAt,
      syncStatus: "synced",
      updatedAt: record.updatedAt,
    };
    loadLocalCharacterContextMock.mockResolvedValue({
      canonicalMissing: false,
      conflictPaths: [],
      content: { skills: [] },
      hasRevisionConflict: false,
      record,
      recoveredBuild,
      recoveryRecord,
    });
    draftSaveMock.mockResolvedValue(canonicalDraft);

    const { loadLocalCharacterAdvancementContext } =
      await import("./loadLocalCharacterAdvancementContext");
    const result = await loadLocalCharacterAdvancementContext(record.id, "account-1");

    expect(result.draft?.build).toBe(baseBuild);
    expect(result.recoveryDraft).toMatchObject({
      build: recoveredBuild,
      syncStatus: "local",
    });
    expect(result.recoveryRecord).toBe(recoveryRecord);
  });

  it("does not expose unattributed quarantine existence through advancement context", async () => {
    loadLocalCharacterContextMock.mockResolvedValue({
      canonicalMissing: false,
      conflictPaths: [],
      content: { skills: [] },
      hasRevisionConflict: false,
      record,
    });
    draftSaveMock.mockImplementation(async (input) => ({
      ...input,
      createdAt: record.createdAt,
    }));

    const { loadLocalCharacterAdvancementContext } =
      await import("./loadLocalCharacterAdvancementContext");
    const result = await loadLocalCharacterAdvancementContext(record.id, "account-1");

    expect(result).not.toHaveProperty("legacyRecoveryCount");
    expect(result.recoveryDraft).toBeUndefined();
    expect(result.recoveryRecord).toBeUndefined();
  });
});
