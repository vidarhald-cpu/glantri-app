import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    campaign: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    scenario: {
      findMany: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it("excludes delegated owners from current-control Scenario access", async () => {
    mocks.prisma.scenario.findMany.mockResolvedValue([]);
    const repository = createPrismaScenarioRepository();

    await repository.listScenariosByCampaignPlayerControl("campaign-1", "player-1");

    expect(mocks.prisma.scenario.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      where: {
        campaignId: "campaign-1",
        participants: {
          some: {
            OR: [
              { controlledByUserId: "player-1" },
              {
                character: { ownerId: "player-1" },
                controlledByUserId: null,
              },
            ],
            isActive: true,
            role: "player_character",
          },
        },
        status: "live",
      },
    });
  });
});

describe("scenarioRepository campaign activation transitions", () => {
  it("activates a draft Campaign and returns the next Campaign state", async () => {
    const activeCampaign = {
      createdAt: new Date("2026-05-08T12:00:00.000Z"),
      description: "The campaign",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Draft Campaign",
      settingsJson: {},
      slug: "draft-campaign",
      status: "active",
      updatedAt: new Date("2026-05-08T12:00:00.000Z"),
    };
    mocks.prisma.campaign.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.campaign.findUnique.mockResolvedValue(activeCampaign);

    const repository = createPrismaScenarioRepository();

    await expect(
      repository.activateCampaignFromDraft({ campaignId: "campaign-1" }),
    ).resolves.toEqual({
      createdAt: "2026-05-08T12:00:00.000Z",
      description: "The campaign",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Draft Campaign",
      settings: {
        allowPlayerSelfJoin: false,
        defaultVisibility: "hidden",
      },
      slug: "draft-campaign",
      status: "active",
      updatedAt: "2026-05-08T12:00:00.000Z",
    });
    expect(mocks.prisma.campaign.updateMany).toHaveBeenCalledWith({
      data: { status: "active" },
      where: {
        id: "campaign-1",
        status: "draft",
      },
    });
  });

  it.each([
    {
      from: "draft",
      to: "archived",
    },
    {
      from: "active",
      to: "archived",
    },
    {
      from: "archived",
      to: "draft",
    },
    {
      from: "active",
      to: "draft",
    },
    {
      from: "archived",
      to: "active",
    },
    {
      from: "active",
      to: "active",
    },
  ])("does not mutate Campaign for blocked transition $from->$to", async (fixture) => {
    mocks.prisma.campaign.updateMany.mockResolvedValue({ count: 0 });

    const repository = createPrismaScenarioRepository();

    await expect(repository.activateCampaignFromDraft({ campaignId: "campaign-1" })).resolves.toBe(
      null,
    );
    expect(mocks.prisma.campaign.updateMany).toHaveBeenCalledWith({
      data: { status: "active" },
      where: {
        id: "campaign-1",
        status: "draft",
      },
    });
    expect(mocks.prisma.campaign.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for stale interleaving where the campaign left draft before activation", async () => {
    mocks.prisma.campaign.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.campaign.findUnique.mockResolvedValue(null);

    const repository = createPrismaScenarioRepository();

    await expect(repository.activateCampaignFromDraft({ campaignId: "campaign-1" })).resolves.toBe(
      null,
    );
    expect(mocks.prisma.campaign.findUnique).not.toHaveBeenCalled();
  });
});
