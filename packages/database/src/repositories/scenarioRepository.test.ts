import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    campaign: {
      findMany: vi.fn(),
    },
    scenario: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../client", () => ({
  prisma: mocks.prisma,
}));

import { createPrismaScenarioRepository } from "./scenarioRepository";

describe("scenarioRepository player scenario access queries", () => {
  it("only treats campaigns with live controlled scenarios as player-accessible", async () => {
    mocks.prisma.campaign.findMany.mockResolvedValue([]);
    const repository = createPrismaScenarioRepository();

    await repository.listCampaignsByPlayerAccess("player-1");

    expect(mocks.prisma.campaign.findMany).toHaveBeenCalledWith({
      orderBy: { updatedAt: "desc" },
      where: {
        scenarios: {
          some: expect.objectContaining({
            status: "live",
          }),
        },
      },
    });
  });

  it("only lists live scenarios for player campaign workspace access", async () => {
    mocks.prisma.scenario.findMany.mockResolvedValue([]);
    const repository = createPrismaScenarioRepository();

    await repository.listScenariosByCampaignPlayerAccess("campaign-1", "player-1");

    expect(mocks.prisma.scenario.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      where: expect.objectContaining({
        campaignId: "campaign-1",
        status: "live",
      }),
    });
  });
});
