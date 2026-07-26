import { beforeEach, describe, expect, it, vi } from "vitest";

import { combatRoundStateSchema, encounterSessionSchema } from "@glantri/domain";

const mocks = vi.hoisted(() => ({
  prisma: {
    encounter: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../client", () => ({
  prisma: mocks.prisma,
}));

import { createPrismaCombatStateReadRepository } from "./combatStateReadRepository";

const encounter = encounterSessionSchema.parse({
  actionLog: [],
  campaignId: "campaign-1",
  combatRoundState: combatRoundStateSchema.parse({
    encounterId: "encounter-1",
    participants: [{ label: "Aria", participantId: "aria" }],
    roundNumber: 2,
    rounds: [{ encounterId: "encounter-1", roundNumber: 1 }],
  }),
  createdAt: "2026-07-26T09:00:00.000Z",
  currentRound: 2,
  currentTurnIndex: 0,
  declarationsLocked: false,
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
  turnOrderMode: "manual",
  updatedAt: "2026-07-26T10:00:00.000Z",
});

const record = {
  activeCombatState: null,
  archivedCombatRounds: [],
  campaignId: encounter.campaignId ?? null,
  combatArchiveCount: 0,
  combatStorageMode: "legacy",
  createdAt: new Date(encounter.createdAt),
  id: encounter.id,
  name: encounter.title,
  scenarioId: encounter.scenarioId ?? null,
  sessionJson: encounter,
  status: encounter.status,
  updatedAt: new Date(encounter.updatedAt),
};

describe("combatStateReadRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.encounter.findUnique.mockResolvedValue(record);
    mocks.prisma.encounter.findMany.mockResolvedValue([record]);
  });

  it("reads metadata without selecting sessionJson", async () => {
    const repository = createPrismaCombatStateReadRepository();

    await expect(repository.getEncounterMetadataById(encounter.id)).resolves.toMatchObject({
      encounterId: encounter.id,
      revision: encounter.updatedAt,
      viewVersion: 1,
    });
    expect(mocks.prisma.encounter.findUnique).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.encounter.findUnique).toHaveBeenCalledWith({
      select: {
        campaignId: true,
        createdAt: true,
        id: true,
        name: true,
        scenarioId: true,
        status: true,
        updatedAt: true,
      },
      where: { id: encounter.id },
    });
  });

  it("extracts active state without archived rounds in one row read", async () => {
    const repository = createPrismaCombatStateReadRepository();
    const view = await repository.getActiveCombatStateById(encounter.id);

    expect(view?.activeCombatState).toMatchObject({ roundNumber: 2 });
    expect(view?.activeCombatState).not.toHaveProperty("rounds");
    expect(mocks.prisma.encounter.findUnique).toHaveBeenCalledTimes(1);
  });

  it("extracts exact archived rounds in one row read", async () => {
    const repository = createPrismaCombatStateReadRepository();

    await expect(repository.getArchivedCombatRoundsById(encounter.id)).resolves.toMatchObject({
      archivedRounds: [expect.objectContaining({ roundNumber: 1 })],
      encounterId: encounter.id,
      revision: encounter.updatedAt,
    });
    expect(mocks.prisma.encounter.findUnique).toHaveBeenCalledTimes(1);
  });

  it("extracts history source without validating unrelated session fields", async () => {
    mocks.prisma.encounter.findUnique.mockResolvedValue({
      ...record,
      sessionJson: {
        ...encounter,
        actionLog: "malformed but outside the history view",
      },
    });
    const repository = createPrismaCombatStateReadRepository();

    await expect(repository.getCombatHistorySourceById(encounter.id)).resolves.toMatchObject({
      archivedRounds: [expect.objectContaining({ roundNumber: 1 })],
      encounterId: encounter.id,
      revision: encounter.updatedAt,
    });
    expect(mocks.prisma.encounter.findUnique).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed required history fields", async () => {
    mocks.prisma.encounter.findUnique.mockResolvedValue({
      ...record,
      sessionJson: {
        ...encounter,
        combatRoundState: {
          ...encounter.combatRoundState,
          events: "not-an-event-array",
        },
      },
    });
    const repository = createPrismaCombatStateReadRepository();

    await expect(repository.getCombatHistorySourceById(encounter.id)).rejects.toThrow();
  });

  it("retains an explicit full encounter read for authoritative callers", async () => {
    const repository = createPrismaCombatStateReadRepository();

    await expect(repository.getFullEncounterById(encounter.id)).resolves.toMatchObject({
      encounter,
      encounterId: encounter.id,
      revision: encounter.updatedAt,
      viewVersion: 1,
    });
    expect(mocks.prisma.encounter.findUnique).toHaveBeenCalledTimes(1);
  });

  it("lists assignment metadata without full EncounterSession validation", async () => {
    mocks.prisma.encounter.findMany.mockResolvedValue([
      {
        ...record,
        sessionJson: {
          ...encounter,
          actionLog: "malformed but unrelated to assignment metadata",
        },
      },
    ]);
    const repository = createPrismaCombatStateReadRepository();

    await expect(repository.listEncounterAccessMetadataByScenario("scenario-1")).resolves.toEqual([
      expect.objectContaining({
        metadata: expect.objectContaining({ encounterId: encounter.id }),
        participants: [expect.objectContaining({ id: "aria" })],
      }),
    ]);
    expect(mocks.prisma.encounter.findMany).toHaveBeenCalledTimes(1);
  });

  it("reads split active state without selecting archived round payloads", async () => {
    const { rounds: _rounds, ...activeCombatState } = encounter.combatRoundState!;
    mocks.prisma.encounter.findUnique.mockResolvedValue({
      ...record,
      activeCombatState: {
        revision: new Date(encounter.updatedAt),
        stateJson: activeCombatState,
      },
      combatArchiveCount: 1,
      combatStorageMode: "split_v1",
      sessionJson: {
        ...encounter,
        combatRoundState: undefined,
      },
    });
    const repository = createPrismaCombatStateReadRepository();

    await expect(repository.getActiveCombatStateById(encounter.id)).resolves.toMatchObject({
      activeCombatState: expect.objectContaining({ roundNumber: 2 }),
      encounterId: encounter.id,
      revision: encounter.updatedAt,
    });
    const select = mocks.prisma.encounter.findUnique.mock.calls[0]?.[0]?.select;
    expect(select).toHaveProperty("activeCombatState");
    expect(select).not.toHaveProperty("archivedCombatRounds");
  });

  it("composes split full encounters and fails closed on partial split storage", async () => {
    const { rounds, ...activeCombatState } = encounter.combatRoundState!;
    mocks.prisma.encounter.findUnique.mockResolvedValue({
      ...record,
      activeCombatState: {
        revision: new Date(encounter.updatedAt),
        stateJson: activeCombatState,
      },
      archivedCombatRounds: rounds.map((round) => ({
        roundJson: round,
        roundNumber: round.roundNumber,
      })),
      combatArchiveCount: rounds.length,
      combatStorageMode: "split_v1",
      sessionJson: {
        ...encounter,
        combatRoundState: undefined,
      },
    });
    const repository = createPrismaCombatStateReadRepository();

    await expect(repository.getFullEncounterById(encounter.id)).resolves.toMatchObject({
      encounter,
      encounterId: encounter.id,
    });

    mocks.prisma.encounter.findUnique.mockResolvedValue({
      ...record,
      activeCombatState: null,
      archivedCombatRounds: [],
      combatArchiveCount: 0,
      combatStorageMode: "split_v1",
      sessionJson: { ...encounter, combatRoundState: undefined },
    });
    await expect(repository.getFullEncounterById(encounter.id)).rejects.toMatchObject({
      code: "malformed_split_storage",
    });
  });
});
