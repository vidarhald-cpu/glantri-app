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
    user: {
      findUnique: vi.fn(),
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
  it("treats non-draft controlled Scenario history as player-accessible", async () => {
    mocks.prisma.campaign.findMany.mockResolvedValue([]);
    const repository = createPrismaScenarioRepository();

    await repository.listCampaignsByPlayerAccess("player-1");

    expect(mocks.prisma.campaign.findMany).toHaveBeenCalledWith({
      orderBy: { updatedAt: "desc" },
      where: {
        scenarios: {
          some: expect.objectContaining({
            status: { in: ["live", "paused", "completed", "archived"] },
          }),
        },
      },
    });
  });

  it("lists non-draft scenarios for player Campaign workspace access", async () => {
    mocks.prisma.scenario.findMany.mockResolvedValue([]);
    const repository = createPrismaScenarioRepository();

    await repository.listScenariosByCampaignPlayerAccess("campaign-1", "player-1");

    expect(mocks.prisma.scenario.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      where: expect.objectContaining({
        campaignId: "campaign-1",
        status: { in: ["live", "paused", "completed", "archived"] },
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
        status: { in: ["live", "paused", "completed", "archived"] },
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
  ])("does not mutate Campaign for blocked transition from $from to $to", async ({ from, to }) => {
    const isAllowed = from === "draft" && to === "active";
    mocks.prisma.campaign.updateMany.mockResolvedValue({ count: 0 });

    expect(isAllowed).toBe(false);
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

/**
 * Forgejo issue #977. The GM predicate in `scenarioParticipantSupport.ts` reads the role of an
 * arbitrary candidate user through this method, so it must report the same normalized names the
 * session path reports — otherwise a legacy stored `gm` row would silently strip a real GM of
 * the exemption the ruling preserved for them.
 */
describe("scenarioRepository listUserAuthRoles (#977)", () => {
  it("normalizes the legacy stored gm role name to game_master", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      roles: [{ role: { name: "gm" } }, { role: { name: "player" } }],
    });
    const repository = createPrismaScenarioRepository();

    await expect(repository.listUserAuthRoles("user-1")).resolves.toEqual([
      "game_master",
      "player",
    ]);
  });

  it("drops a stored role name that is not an application role", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      roles: [{ role: { name: "game_master" } }, { role: { name: "observer" } }],
    });
    const repository = createPrismaScenarioRepository();

    await expect(repository.listUserAuthRoles("user-1")).resolves.toEqual(["game_master"]);
  });

  it("reports no roles for a user that cannot be read, so predicates over it fail closed", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    const repository = createPrismaScenarioRepository();

    await expect(repository.listUserAuthRoles("missing-user")).resolves.toEqual([]);
  });
});
