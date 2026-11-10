import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  combatRoundStateSchema,
  encounterSessionSchema,
  type EncounterSession,
} from "@glantri/domain";
import { Prisma } from "@prisma/client";

import {
  COMBAT_STORAGE_MODE_LEGACY,
  COMBAT_STORAGE_MODE_SPLIT_V1,
  createPrismaCombatStatePersistenceRepository,
} from "./combatStatePersistenceRepository";

const revision1 = "2026-07-26T10:00:00.000Z";
const revision2 = new Date("2026-07-26T10:00:01.000Z");

function buildSession(archiveCount: number): EncounterSession {
  return encounterSessionSchema.parse({
    actionLog: [],
    combatRoundState: combatRoundStateSchema.parse({
      commands: [],
      encounterId: "encounter-1",
      participants: [{ label: "Aria", participantId: "aria" }],
      roundNumber: archiveCount + 1,
      rounds: Array.from({ length: archiveCount }, (_, index) => ({
        encounterId: "encounter-1",
        roundNumber: index + 1,
      })),
    }),
    createdAt: "2026-07-26T09:00:00.000Z",
    currentRound: archiveCount + 1,
    id: "encounter-1",
    kind: "combat",
    participants: [
      {
        id: "aria",
        label: "Aria",
        participantType: "scenario",
        scenarioParticipantId: "scenario-aria",
      },
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "Courtyard",
    updatedAt: revision1,
  });
}

function createClientFixture(input?: {
  archiveCount?: number;
  participantUpdateCount?: number;
  storageMode?: string;
  updateCount?: number;
}) {
  const currentRecord = {
    combatArchiveCount: input?.archiveCount ?? 0,
    combatStorageMode: input?.storageMode ?? COMBAT_STORAGE_MODE_LEGACY,
    updatedAt: new Date(revision1),
  };
  const encounter = {
    findUniqueOrThrow: vi
      .fn()
      .mockImplementation(async (query: { select?: { combatStorageMode?: boolean } }) =>
        query.select?.combatStorageMode ? currentRecord : { updatedAt: revision2 },
      ),
    updateMany: vi.fn().mockResolvedValue({ count: input?.updateCount ?? 1 }),
    update: vi.fn().mockResolvedValue({ updatedAt: revision2 }),
  };
  const client = {
    $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(client)),
    encounter,
    encounterActiveCombatState: {
      update: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
    },
    encounterArchivedCombatRound: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    scenarioParticipant: {
      updateMany: vi.fn().mockResolvedValue({ count: input?.participantUpdateCount ?? 1 }),
    },
  };
  return client;
}

function retryableTransactionConflict() {
  return new Prisma.PrismaClientKnownRequestError(
    "Transaction failed due to a write conflict or a deadlock.",
    {
      clientVersion: "6.19.2",
      code: "P2034",
    },
  );
}

function createAtomicStateClient(input?: { failCommit?: boolean; staleParticipantId?: string }) {
  type StoredParticipant = { revision: Date; stateJson: unknown };
  type StoredState = {
    activeState: unknown;
    encounterRevision: Date;
    participants: Map<string, StoredParticipant>;
  };
  let committed: StoredState = {
    activeState: combatRoundStateSchema.parse({
      commands: [],
      encounterId: "encounter-1",
      participants: [{ label: "Aria", participantId: "aria" }],
      roundNumber: 1,
    }),
    encounterRevision: new Date(revision1),
    participants: new Map(
      ["scenario-aria", "scenario-borin"].map((id) => [
        id,
        {
          revision: new Date(revision1),
          stateJson: { combat: {}, equipment: {}, health: {}, resources: {} },
        },
      ]),
    ),
  };
  const client = {
    $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => {
      const staged: StoredState = {
        activeState: structuredClone(committed.activeState),
        encounterRevision: new Date(committed.encounterRevision),
        participants: new Map(
          Array.from(committed.participants, ([id, participant]) => [
            id,
            {
              revision: new Date(participant.revision),
              stateJson: structuredClone(participant.stateJson),
            },
          ]),
        ),
      };
      const transaction = {
        encounter: {
          findUniqueOrThrow: vi.fn(async (query: { select?: { combatStorageMode?: boolean } }) =>
            query.select?.combatStorageMode
              ? {
                  combatArchiveCount: 0,
                  combatStorageMode: COMBAT_STORAGE_MODE_SPLIT_V1,
                  updatedAt: staged.encounterRevision,
                }
              : { updatedAt: staged.encounterRevision },
          ),
          updateMany: vi.fn(async (query: { where: { updatedAt: Date } }) => {
            if (query.where.updatedAt.getTime() !== staged.encounterRevision.getTime()) {
              return { count: 0 };
            }
            staged.encounterRevision = new Date(revision2);
            return { count: 1 };
          }),
        },
        encounterActiveCombatState: {
          upsert: vi.fn(
            async (query: { create: { stateJson: unknown }; update: { stateJson: unknown } }) => {
              staged.activeState = structuredClone(
                query.update.stateJson ?? query.create.stateJson,
              );
              return {};
            },
          ),
        },
        encounterArchivedCombatRound: {
          create: vi.fn(),
          deleteMany: vi.fn(),
        },
        scenarioParticipant: {
          updateMany: vi.fn(
            async (query: {
              data: { stateJson: unknown };
              where: { id: string; updatedAt: Date };
            }) => {
              const participant = staged.participants.get(query.where.id);
              if (
                !participant ||
                input?.staleParticipantId === query.where.id ||
                participant.revision.getTime() !== query.where.updatedAt.getTime()
              ) {
                return { count: 0 };
              }
              participant.stateJson = structuredClone(query.data.stateJson);
              participant.revision = new Date(revision2);
              return { count: 1 };
            },
          ),
        },
      };
      const result = await callback(transaction);
      if (input?.failCommit) {
        throw new Error("Injected transaction commit failure");
      }
      committed = staged;
      return result;
    }),
    snapshot: () =>
      structuredClone({
        activeState: committed.activeState,
        encounterRevision: committed.encounterRevision.toISOString(),
        participants: Object.fromEntries(
          Array.from(committed.participants, ([id, participant]) => [
            id,
            {
              revision: participant.revision.toISOString(),
              stateJson: participant.stateJson,
            },
          ]),
        ),
      }),
  };
  return client;
}

describe("combatStatePersistenceRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("materializes legacy active state and each existing archive transactionally", async () => {
    const client = createClientFixture();
    const repository = createPrismaCombatStatePersistenceRepository(client as never);

    const saved = await repository.updateCombatEncounter({
      encounterId: "encounter-1",
      expectedRevision: revision1,
      scenarioId: "scenario-1",
      session: buildSession(2),
    });

    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(client.encounter.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          combatArchiveCount: 2,
          combatStorageMode: COMBAT_STORAGE_MODE_SPLIT_V1,
          sessionJson: expect.not.objectContaining({ combatRoundState: expect.anything() }),
        }),
        where: { id: "encounter-1", updatedAt: new Date(revision1) },
      }),
    );
    expect(client.encounterActiveCombatState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          encounterId: "encounter-1",
          stateJson: expect.not.objectContaining({ rounds: expect.anything() }),
        }),
      }),
    );
    expect(client.encounterArchivedCombatRound.create).toHaveBeenCalledTimes(2);
    expect(saved.combatRoundState?.rounds).toHaveLength(2);
    expect(saved.updatedAt).toBe(revision2.toISOString());
  });

  it("commits participant modifier state in the same serializable combat transaction", async () => {
    const client = createClientFixture();
    const repository = createPrismaCombatStatePersistenceRepository(client as never);
    const participantState = {
      combat: {},
      equipment: {},
      health: {},
      resources: {},
    };

    await repository.updateCombatEncounter({
      encounterId: "encounter-1",
      expectedRevision: revision1,
      participantStateUpdates: [
        {
          expectedRevision: revision1,
          participantId: "scenario-aria",
          scenarioId: "scenario-1",
          state: participantState as never,
        },
        {
          expectedRevision: revision1,
          participantId: "scenario-borin",
          scenarioId: "scenario-1",
          state: participantState as never,
        },
      ],
      scenarioId: "scenario-1",
      session: buildSession(0),
    });

    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(client.scenarioParticipant.updateMany).toHaveBeenNthCalledWith(1, {
      data: { stateJson: expect.objectContaining({ combat: expect.any(Object) }) },
      where: {
        id: "scenario-aria",
        scenarioId: "scenario-1",
        updatedAt: new Date(revision1),
      },
    });
    expect(client.scenarioParticipant.updateMany).toHaveBeenNthCalledWith(2, {
      data: { stateJson: expect.objectContaining({ combat: expect.any(Object) }) },
      where: {
        id: "scenario-borin",
        scenarioId: "scenario-1",
        updatedAt: new Date(revision1),
      },
    });
  });

  it("aborts the whole review transaction when participant state is stale", async () => {
    const client = createClientFixture({ participantUpdateCount: 0 });
    const repository = createPrismaCombatStatePersistenceRepository(client as never);

    await expect(
      repository.updateCombatEncounter({
        encounterId: "encounter-1",
        expectedRevision: revision1,
        participantStateUpdates: [
          {
            expectedRevision: revision1,
            participantId: "scenario-aria",
            scenarioId: "scenario-1",
            state: {
              combat: {},
              equipment: {},
              health: {},
              resources: {},
            } as never,
          },
        ],
        scenarioId: "scenario-1",
        session: buildSession(0),
      }),
    ).rejects.toMatchObject({ code: "stale_revision" });
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rolls back the encounter and every participant when participant N is stale", async () => {
    const client = createAtomicStateClient({ staleParticipantId: "scenario-borin" });
    const repository = createPrismaCombatStatePersistenceRepository(client as never);
    const before = client.snapshot();

    await expect(
      repository.updateCombatEncounter({
        encounterId: "encounter-1",
        expectedRevision: revision1,
        participantStateUpdates: ["scenario-aria", "scenario-borin"].map((participantId) => ({
          expectedRevision: revision1,
          participantId,
          scenarioId: "scenario-1",
          state: {
            combat: { declarationSubmittedAt: "2026-07-26T10:00:02.000Z" },
            equipment: {},
            health: {},
            resources: {},
          } as never,
        })),
        scenarioId: "scenario-1",
        session: buildSession(0),
      }),
    ).rejects.toMatchObject({ code: "stale_revision" });

    expect(client.snapshot()).toEqual(before);
  });

  it("rolls back participant and encounter writes when the serializable commit fails", async () => {
    const client = createAtomicStateClient({ failCommit: true });
    const repository = createPrismaCombatStatePersistenceRepository(client as never);
    const before = client.snapshot();

    await expect(
      repository.updateCombatEncounter({
        encounterId: "encounter-1",
        expectedRevision: revision1,
        participantStateUpdates: [
          {
            expectedRevision: revision1,
            participantId: "scenario-aria",
            scenarioId: "scenario-1",
            state: {
              combat: { declarationSubmittedAt: "2026-07-26T10:00:02.000Z" },
              equipment: {},
              health: {},
              resources: {},
            } as never,
          },
        ],
        scenarioId: "scenario-1",
        session: buildSession(0),
      }),
    ).rejects.toThrow("Injected transaction commit failure");

    expect(client.snapshot()).toEqual(before);
  });

  it("ordinary split combat writes touch metadata and active state but not archives", async () => {
    const client = createClientFixture({
      archiveCount: 30,
      storageMode: COMBAT_STORAGE_MODE_SPLIT_V1,
    });
    const repository = createPrismaCombatStatePersistenceRepository(client as never);

    await repository.updateCombatEncounter({
      encounterId: "encounter-1",
      expectedRevision: revision1,
      session: buildSession(30),
    });

    expect(client.encounterActiveCombatState.upsert).toHaveBeenCalledTimes(1);
    expect(client.encounterArchivedCombatRound.create).not.toHaveBeenCalled();
    expect(client.encounterArchivedCombatRound.deleteMany).not.toHaveBeenCalled();
  });

  it("round transition appends exactly one bounded archive row", async () => {
    const client = createClientFixture({
      archiveCount: 1,
      storageMode: COMBAT_STORAGE_MODE_SPLIT_V1,
    });
    const repository = createPrismaCombatStatePersistenceRepository(client as never);

    await repository.updateCombatEncounter({
      encounterId: "encounter-1",
      expectedRevision: revision1,
      session: buildSession(2),
    });

    expect(client.encounterArchivedCombatRound.create).toHaveBeenCalledTimes(1);
    expect(client.encounterArchivedCombatRound.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ encounterId: "encounter-1", roundNumber: 2 }),
    });
  });

  it("never removes an archived round: a write with one archive fewer is refused (#1135)", async () => {
    const client = createClientFixture({
      archiveCount: 2,
      storageMode: COMBAT_STORAGE_MODE_SPLIT_V1,
    });
    const repository = createPrismaCombatStatePersistenceRepository(client as never);

    await expect(
      repository.updateCombatEncounter({
        encounterId: "encounter-1",
        expectedRevision: revision1,
        session: buildSession(1),
      }),
    ).rejects.toMatchObject({ code: "archive_delta_invalid" });

    expect(client.encounter.updateMany).not.toHaveBeenCalled();
    expect(client.encounterActiveCombatState.upsert).not.toHaveBeenCalled();
    expect(client.encounterArchivedCombatRound.deleteMany).not.toHaveBeenCalled();
    expect(client.encounterArchivedCombatRound.create).not.toHaveBeenCalled();
  });

  it("rejects non-boundary archive rewrites and stale metadata revisions", async () => {
    const invalidClient = createClientFixture({
      archiveCount: 1,
      storageMode: COMBAT_STORAGE_MODE_SPLIT_V1,
    });
    const invalidRepository = createPrismaCombatStatePersistenceRepository(invalidClient as never);
    await expect(
      invalidRepository.updateCombatEncounter({
        encounterId: "encounter-1",
        expectedRevision: revision1,
        session: buildSession(3),
      }),
    ).rejects.toMatchObject({
      code: "archive_delta_invalid",
    });

    const staleClient = createClientFixture({
      archiveCount: 1,
      storageMode: COMBAT_STORAGE_MODE_SPLIT_V1,
      updateCount: 0,
    });
    const staleRepository = createPrismaCombatStatePersistenceRepository(staleClient as never);
    await expect(
      staleRepository.updateCombatEncounter({
        encounterId: "encounter-1",
        expectedRevision: revision1,
        session: buildSession(1),
      }),
    ).rejects.toMatchObject({ code: "stale_revision" });
    expect(staleClient.encounterActiveCombatState.upsert).not.toHaveBeenCalled();
  });

  it("retries the complete serializable transaction only for Prisma P2034", async () => {
    const client = createClientFixture();
    client.encounter.updateMany
      .mockRejectedValueOnce(retryableTransactionConflict())
      .mockResolvedValueOnce({ count: 1 });
    const retryDelay = vi.fn().mockResolvedValue(undefined);
    const repository = createPrismaCombatStatePersistenceRepository(client as never, {
      retryDelay,
    });

    const saved = await repository.updateCombatEncounter({
      encounterId: "encounter-1",
      expectedRevision: revision1,
      session: buildSession(0),
    });

    expect(saved.updatedAt).toBe(revision2.toISOString());
    expect(client.$transaction).toHaveBeenCalledTimes(2);
    expect(retryDelay).toHaveBeenCalledTimes(1);
    expect(client.encounter.findUniqueOrThrow).toHaveBeenCalledTimes(3);
    expect(client.encounterActiveCombatState.upsert).toHaveBeenCalledTimes(1);
  });

  it("re-reads storage mode and preserves stale revision after a retryable conflict", async () => {
    const client = createClientFixture();
    client.encounter.findUniqueOrThrow
      .mockResolvedValueOnce({
        combatArchiveCount: 0,
        combatStorageMode: COMBAT_STORAGE_MODE_LEGACY,
        updatedAt: new Date(revision1),
      })
      .mockResolvedValueOnce({
        combatArchiveCount: 0,
        combatStorageMode: COMBAT_STORAGE_MODE_SPLIT_V1,
        updatedAt: revision2,
      });
    client.encounter.updateMany.mockRejectedValueOnce(retryableTransactionConflict());
    const repository = createPrismaCombatStatePersistenceRepository(client as never, {
      retryDelay: async () => undefined,
    });

    await expect(
      repository.updateCombatEncounter({
        encounterId: "encounter-1",
        expectedRevision: revision1,
        session: buildSession(0),
      }),
    ).rejects.toMatchObject({ code: "stale_revision" });

    expect(client.$transaction).toHaveBeenCalledTimes(2);
    expect(client.encounter.updateMany).toHaveBeenCalledTimes(1);
    expect(client.encounterActiveCombatState.upsert).not.toHaveBeenCalled();
  });

  it("returns a typed conflict after bounded P2034 exhaustion", async () => {
    const client = createClientFixture();
    client.encounter.updateMany.mockRejectedValue(retryableTransactionConflict());
    const retryDelay = vi.fn().mockResolvedValue(undefined);
    const repository = createPrismaCombatStatePersistenceRepository(client as never, {
      maxTransactionAttempts: 3,
      retryDelay,
    });

    await expect(
      repository.updateCombatEncounter({
        encounterId: "encounter-1",
        expectedRevision: revision1,
        session: buildSession(0),
      }),
    ).rejects.toMatchObject({
      code: "transaction_conflict",
      message: "Combat state changed while saving. Refresh and try again.",
    });

    expect(client.$transaction).toHaveBeenCalledTimes(3);
    expect(retryDelay).toHaveBeenCalledTimes(2);
    expect(client.encounterActiveCombatState.upsert).not.toHaveBeenCalled();
  });

  it("does not retry validation or non-P2034 persistence errors", async () => {
    const client = createClientFixture();
    client.encounter.updateMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed.", {
        clientVersion: "6.19.2",
        code: "P2002",
      }),
    );
    const retryDelay = vi.fn().mockResolvedValue(undefined);
    const repository = createPrismaCombatStatePersistenceRepository(client as never, {
      retryDelay,
    });

    await expect(
      repository.updateCombatEncounter({
        encounterId: "encounter-1",
        expectedRevision: revision1,
        session: buildSession(0),
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(retryDelay).not.toHaveBeenCalled();
  });

  it("active payload size is independent of archived round count", async () => {
    const sizes: number[] = [];
    for (const count of [0, 10, 30, 50]) {
      const client = createClientFixture({
        archiveCount: count,
        storageMode: count === 0 ? COMBAT_STORAGE_MODE_LEGACY : COMBAT_STORAGE_MODE_SPLIT_V1,
      });
      const repository = createPrismaCombatStatePersistenceRepository(client as never);
      await repository.updateCombatEncounter({
        encounterId: "encounter-1",
        expectedRevision: revision1,
        session: buildSession(count),
      });
      const call = client.encounterActiveCombatState.upsert.mock.calls[0]?.[0];
      sizes.push(JSON.stringify(call.create.stateJson).length);
    }

    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(2);
  });

  it("non-combat edits preserve authoritative split combat instead of caller combat", async () => {
    const client = createClientFixture({
      archiveCount: 1,
      storageMode: COMBAT_STORAGE_MODE_SPLIT_V1,
    });
    const canonical = buildSession(1);
    const { rounds, ...activeCombatState } = canonical.combatRoundState!;
    client.encounter.findUniqueOrThrow.mockReset();
    client.encounter.findUniqueOrThrow.mockResolvedValue({
      activeCombatState: {
        revision: new Date(revision1),
        stateJson: activeCombatState,
      },
      archivedCombatRounds: rounds.map((round) => ({
        roundJson: round,
        roundNumber: round.roundNumber,
      })),
      campaignId: null,
      combatArchiveCount: 1,
      combatStorageMode: COMBAT_STORAGE_MODE_SPLIT_V1,
      createdAt: new Date(canonical.createdAt),
      id: canonical.id,
      name: canonical.title,
      scenarioId: canonical.scenarioId ?? null,
      sessionJson: {
        ...canonical,
        combatRoundState: undefined,
      },
      status: canonical.status,
      updatedAt: new Date(revision1),
    });
    const repository = createPrismaCombatStatePersistenceRepository(client as never);
    const staleEditorState = buildSession(0).combatRoundState;

    const saved = await repository.updateEncounterPreservingSplitCombat({
      encounterId: canonical.id,
      session: {
        ...canonical,
        combatRoundState: staleEditorState,
        title: "Renamed",
      },
    });

    expect(saved.title).toBe("Renamed");
    expect(saved.combatRoundState).toEqual(canonical.combatRoundState);
    expect(client.encounterActiveCombatState.update).toHaveBeenCalledWith({
      data: { revision: revision2 },
      where: { encounterId: canonical.id },
    });
    expect(client.encounterArchivedCombatRound.create).not.toHaveBeenCalled();
    expect(client.encounterArchivedCombatRound.deleteMany).not.toHaveBeenCalled();
  });

  it("exposes no ordinary archive update or removal path", () => {
    const source = readFileSync(
      new URL("./combatStatePersistenceRepository.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("encounterArchivedCombatRound.update");
    expect(source).not.toContain("encounterArchivedCombatRound.updateMany");
    expect(source).toContain("encounterArchivedCombatRound.create");
    // #1135: undo never goes back to a previous round, so no combat write removes an archive.
    expect(source).not.toContain("encounterArchivedCombatRound.delete");
    expect(source).toContain('error.code === "P2034"');
    expect(source).not.toContain("catch (error) {\n          if (error instanceof Error)");
  });
});
