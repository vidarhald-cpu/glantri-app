import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
const saveMock = vi.fn();
const loadCanonicalContentMock = vi.fn();
const loadServerCharacterByIdMock = vi.fn();
const reconcileRecoveryMock = vi.fn();
const listLegacyQuarantineMock = vi.fn();

vi.mock("../content/loadCanonicalContent", () => ({
  loadCanonicalContent: loadCanonicalContentMock,
}));

vi.mock("../api/characterClient", () => ({
  loadServerCharacterById: loadServerCharacterByIdMock,
}));

vi.mock("../offline/repositories/characterRecoveryRepository", () => ({
  CharacterRecoveryRepository: class CharacterRecoveryRepository {
    listLegacyQuarantine = listLegacyQuarantineMock;
    reconcile = reconcileRecoveryMock;
  },
}));

vi.mock("../offline/repositories/localCharacterRepository", () => ({
  buildServerBackedLocalCharacterRecord: (
    serverRecord: {
      build: unknown;
      createdAt?: string;
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

describe("loadServerCharacterEditContext", () => {
  beforeEach(() => {
    getMock.mockReset();
    saveMock.mockReset();
    loadCanonicalContentMock.mockReset();
    loadServerCharacterByIdMock.mockReset();
    reconcileRecoveryMock.mockReset().mockResolvedValue(undefined);
    listLegacyQuarantineMock.mockReset().mockResolvedValue([]);
  });

  it("caches the canonical record when no retained local record exists", async () => {
    const content = { skills: [] };
    const serverRecord = {
      build: baseBuild,
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "character-1",
      level: 1,
      name: "Progressor",
      ownerId: "owner-1",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const canonicalRecord = {
      build: serverRecord.build,
      createdAt: serverRecord.createdAt,
      creatorId: serverRecord.ownerId,
      finalizedAt: serverRecord.createdAt,
      id: serverRecord.id,
      serverUpdatedAt: serverRecord.updatedAt,
      syncStatus: "synced",
      updatedAt: serverRecord.updatedAt,
    };

    loadCanonicalContentMock.mockResolvedValue(content);
    loadServerCharacterByIdMock.mockResolvedValue(serverRecord);
    getMock.mockResolvedValue(undefined);
    saveMock.mockResolvedValue(canonicalRecord);

    const { loadServerCharacterEditContext } = await import("./loadServerCharacterEditContext");
    const result = await loadServerCharacterEditContext("character-1", "account-1");

    expect(saveMock).toHaveBeenCalledWith(canonicalRecord);
    expect(result).toEqual({
      canonicalRecord,
      conflictPaths: [],
      content,
      expectedUpdatedAt: serverRecord.updatedAt,
      hasRevisionConflict: false,
      legacyRecoveryCount: 0,
      recoveredBuild: undefined,
      recoveryRecord: undefined,
      serverRecord,
    });
  });

  it("does not promote an unsynced whole-Character cache row into recovery", async () => {
    const content = { skills: [] };
    const serverRecord = {
      build: baseBuild,
      id: "character-1",
      level: 1,
      name: "Progressor",
      ownerId: "owner-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
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
              targetType: "skill",
            },
          ],
          history: [],
          pendingAttempts: [],
        },
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      finalizedAt: "2026-01-01T00:00:00.000Z",
      id: "character-1",
      serverUpdatedAt: "2026-01-01T00:00:00.000Z",
      syncStatus: "local",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    loadCanonicalContentMock.mockResolvedValue(content);
    loadServerCharacterByIdMock.mockResolvedValue(serverRecord);
    getMock.mockResolvedValue(localRecord);
    const savedCanonical = {
      ...localRecord,
      build: serverRecord.build,
      serverUpdatedAt: serverRecord.updatedAt,
      syncStatus: "synced",
      updatedAt: serverRecord.updatedAt,
    };
    saveMock.mockResolvedValue(savedCanonical);
    listLegacyQuarantineMock.mockResolvedValue([{ id: "legacy-row" }]);

    const { loadServerCharacterEditContext } = await import("./loadServerCharacterEditContext");
    const result = await loadServerCharacterEditContext("character-1", "account-1");

    expect(saveMock).toHaveBeenCalled();
    expect(result.recoveryRecord).toBeUndefined();
    expect(result.legacyRecoveryCount).toBe(1);
    expect(result.canonicalRecord).toBe(savedCanonical);
    expect(result.serverRecord).toBe(serverRecord);
    expect(result.expectedUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.hasRevisionConflict).toBe(false);
  });

  it("returns an explicit same-field recovery conflict from the account-scoped store", async () => {
    const content = { skills: [] };
    const serverRecord = {
      build: { ...baseBuild, name: "Server edit" },
      id: "character-1",
      level: 1,
      name: "Server edit",
      ownerId: "owner-1",
      updatedAt: "2026-01-03T00:00:00.000Z",
    };
    const localRecord = {
      build: { ...baseBuild, name: "Offline edit" },
      createdAt: "2026-01-01T00:00:00.000Z",
      finalizedAt: "2026-01-01T00:00:00.000Z",
      id: "character-1",
      serverUpdatedAt: "2026-01-01T00:00:00.000Z",
      syncStatus: "local",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    loadCanonicalContentMock.mockResolvedValue(content);
    loadServerCharacterByIdMock.mockResolvedValue(serverRecord);
    getMock.mockResolvedValue(localRecord);
    saveMock.mockResolvedValue({
      ...localRecord,
      build: serverRecord.build,
      serverUpdatedAt: serverRecord.updatedAt,
      syncStatus: "synced",
      updatedAt: serverRecord.updatedAt,
    });
    const recoveryEnvelope = {
      accountId: "account-1",
      characterId: "character-1",
      patch: [{ path: "/name" }],
      reconciliation: "conflict",
    };
    reconcileRecoveryMock.mockResolvedValue({
      conflictPaths: ["/name"],
      envelope: recoveryEnvelope,
      recoveredBuild: undefined,
    });

    const { loadServerCharacterEditContext } = await import("./loadServerCharacterEditContext");
    const result = await loadServerCharacterEditContext("character-1", "account-1");

    expect(result.recoveryRecord).toBe(recoveryEnvelope);
    expect(result.conflictPaths).toEqual(["/name"]);
    expect(result.canonicalRecord.build).toBe(serverRecord.build);
    expect(result.serverRecord).toBe(serverRecord);
    expect(result.expectedUpdatedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(result.hasRevisionConflict).toBe(true);
    expect(saveMock).toHaveBeenCalled();
  });
});
