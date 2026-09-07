import { beforeEach, describe, expect, it, vi } from "vitest";

import { encounterSessionSchema, type EncounterSession } from "@glantri/domain";

const mocks = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    encounter: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    scenarioEventLog: { create: vi.fn() },
    scenario: { findUnique: vi.fn() },
    scenarioParticipant: { findMany: vi.fn() },
  },
}));

vi.mock("../client", () => ({
  prisma: mocks.prisma,
}));

import { createPrismaEncounterRepository, EncounterPresenceError } from "./encounterRepository";

const baseSession: EncounterSession = {
  actionLog: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  currentRound: 1,
  currentTurnIndex: 0,
  declarationsLocked: false,
  id: "encounter-1",
  kind: "roleplay",
  participants: [],
  status: "draft",
  title: "Courtyard",
  turnOrderMode: "manual",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("encounterRepository trusted identifiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
    mocks.prisma.scenario.findUnique.mockResolvedValue({ status: "live" });
  });
  it("uses trusted scenario and campaign ids when creating an encounter", async () => {
    const repository = createPrismaEncounterRepository();
    mocks.prisma.encounter.create.mockImplementation(async ({ data }) => ({
      campaignId: data.campaignId,
      createdAt: new Date(baseSession.createdAt),
      id: data.id,
      name: data.name,
      scenarioId: data.scenarioId,
      sessionJson: data.sessionJson,
      status: data.status,
      updatedAt: new Date(baseSession.updatedAt),
    }));

    const encounter = await repository.createEncounter({
      campaignId: "campaign-1",
      createdByUserId: "gm-1",
      scenarioId: "scenario-1",
      session: {
        ...baseSession,
        campaignId: "campaign-evil",
        scenarioId: "scenario-evil",
      },
    });

    expect(mocks.prisma.encounter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "campaign-1",
        createdByUserId: "gm-1",
        scenarioId: "scenario-1",
      }),
    });
    expect(mocks.prisma.encounter.create.mock.calls[0]?.[0].data.sessionJson).toMatchObject({
      campaignId: "campaign-1",
      scenarioId: "scenario-1",
    });
    expect(encounter).toMatchObject({
      campaignId: "campaign-1",
      scenarioId: "scenario-1",
    });
  });

  it("updates the trusted encounter id instead of the body id", async () => {
    const repository = createPrismaEncounterRepository();
    const persistedUpdatedAt = "2026-01-01T00:00:01.000Z";
    mocks.prisma.encounter.findUniqueOrThrow.mockResolvedValue({
      activeCombatState: null,
      archivedCombatRounds: [],
      campaignId: "campaign-1",
      combatArchiveCount: 0,
      combatStorageMode: "legacy",
      createdAt: new Date(baseSession.createdAt),
      id: baseSession.id,
      name: baseSession.title,
      scenarioId: "scenario-1",
      sessionJson: baseSession,
      status: baseSession.status,
      updatedAt: new Date(baseSession.updatedAt),
    });
    mocks.prisma.encounter.update.mockImplementation(async ({ data, where }) => ({
      campaignId: data.campaignId,
      createdAt: new Date(baseSession.createdAt),
      id: where.id,
      name: data.name,
      scenarioId: data.scenarioId,
      sessionJson: data.sessionJson,
      status: data.status,
      updatedAt: new Date(persistedUpdatedAt),
    }));

    const encounter = await repository.updateEncounter({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      session: {
        ...baseSession,
        campaignId: "campaign-evil",
        id: "encounter-evil",
        scenarioId: "scenario-evil",
      },
    });

    expect(mocks.prisma.encounter.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "campaign-1",
        scenarioId: "scenario-1",
      }),
      where: { id: "encounter-1" },
    });
    expect(mocks.prisma.encounter.update.mock.calls[0]?.[0].data.sessionJson).toMatchObject({
      campaignId: "campaign-1",
      id: "encounter-1",
      scenarioId: "scenario-1",
    });
    expect(encounter).toMatchObject({
      campaignId: "campaign-1",
      id: "encounter-1",
      scenarioId: "scenario-1",
      updatedAt: persistedUpdatedAt,
    });
    expect(mocks.prisma.encounter.update.mock.calls[0]?.[0].data.sessionJson).toMatchObject({
      updatedAt: baseSession.updatedAt,
    });
  });

  it("loads scenario summaries without selecting the full session JSON", async () => {
    const repository = createPrismaEncounterRepository();
    mocks.prisma.encounter.findMany.mockResolvedValue([
      {
        campaignId: "campaign-1",
        createdAt: new Date(baseSession.createdAt),
        id: baseSession.id,
        name: baseSession.title,
        scenarioId: "scenario-1",
        status: baseSession.status,
        updatedAt: new Date(baseSession.updatedAt),
      },
    ]);

    await expect(repository.listEncounterSummariesByScenario("scenario-1")).resolves.toEqual([
      {
        campaignId: "campaign-1",
        createdAt: baseSession.createdAt,
        id: baseSession.id,
        scenarioId: "scenario-1",
        status: baseSession.status,
        title: baseSession.title,
        updatedAt: baseSession.updatedAt,
      },
    ]);
    expect(mocks.prisma.encounter.findMany).toHaveBeenCalledWith({
      orderBy: { updatedAt: "desc" },
      select: {
        campaignId: true,
        createdAt: true,
        id: true,
        name: true,
        scenarioId: true,
        status: true,
        updatedAt: true,
      },
      where: { scenarioId: "scenario-1" },
    });
  });

  it("rejects an overlapping active participant before writing the Encounter", async () => {
    const repository = createPrismaEncounterRepository();
    const active = encounterSessionSchema.parse({
      ...baseSession,
      participantMembershipMode: "explicit",
      participants: [
        {
          id: "encounter-participant-a",
          label: "Player A",
          participantType: "scenario",
          scenarioParticipantId: "participant-a",
        },
      ],
      scenarioId: "scenario-1",
      status: "active",
    });
    mocks.prisma.encounter.findUniqueOrThrow.mockResolvedValue({
      activeCombatState: null,
      archivedCombatRounds: [],
      campaignId: "campaign-1",
      combatArchiveCount: 0,
      combatStorageMode: "legacy",
      createdAt: new Date(baseSession.createdAt),
      id: active.id,
      name: active.title,
      scenarioId: "scenario-1",
      sessionJson: baseSession,
      status: "draft",
      updatedAt: new Date(baseSession.updatedAt),
    });
    mocks.prisma.scenarioParticipant.findMany.mockResolvedValue([{ id: "participant-a" }]);
    mocks.prisma.encounter.findMany.mockResolvedValue([
      {
        id: "encounter-2",
        name: "Courtyard",
        sessionJson: { ...active, id: "encounter-2", title: "Courtyard" },
        status: "active",
      },
    ]);

    await expect(
      repository.updateEncounter({
        encounterId: active.id,
        expectedRevision: active.updatedAt,
        scenarioId: "scenario-1",
        session: active,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<EncounterPresenceError>>({
        code: "participant_already_active",
      }),
    );
    expect(mocks.prisma.encounter.update).not.toHaveBeenCalled();
    expect(mocks.prisma.scenarioEventLog.create).not.toHaveBeenCalled();
  });
});
