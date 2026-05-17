import { describe, expect, it, vi } from "vitest";

import type { EncounterSession } from "@glantri/domain";

const mocks = vi.hoisted(() => ({
  prisma: {
    encounter: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../client", () => ({
  prisma: mocks.prisma,
}));

import { createPrismaEncounterRepository } from "./encounterRepository";

const baseSession: EncounterSession = {
  actionLog: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  currentRound: 1,
  currentTurnIndex: 0,
  declarationsLocked: false,
  id: "encounter-1",
  kind: "roleplay",
  participants: [],
  status: "active",
  title: "Courtyard",
  turnOrderMode: "manual",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("encounterRepository trusted identifiers", () => {
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
    mocks.prisma.encounter.update.mockImplementation(async ({ data, where }) => ({
      campaignId: data.campaignId,
      createdAt: new Date(baseSession.createdAt),
      id: where.id,
      name: data.name,
      scenarioId: data.scenarioId,
      sessionJson: data.sessionJson,
      status: data.status,
      updatedAt: new Date(baseSession.updatedAt),
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
    });
  });
});
