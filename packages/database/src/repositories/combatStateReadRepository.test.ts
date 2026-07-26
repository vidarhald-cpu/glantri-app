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
  campaignId: encounter.campaignId ?? null,
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
});
