import { describe, expect, it, vi } from "vitest";

import { resolveScenarioWorkspaceAccess } from "./access";

function services(
  input: { campaignUserIds?: string[]; gmUserId?: string; playerAccess?: boolean } = {},
) {
  return {
    campaignService: {
      getCampaignById: vi.fn(async () => ({
        gmUserId: input.gmUserId ?? "gm-1",
        id: "campaign-1",
      })),
      listCampaignsByUserAccess: vi.fn(async () =>
        (input.campaignUserIds ?? []).map((id) => ({ id })),
      ),
    },
    scenarioService: {
      getScenarioById: vi.fn(async () => ({
        campaignId: "campaign-1",
        id: "scenario-1",
        status: "live",
      })),
      userHasPlayerScenarioAccess: vi.fn(async () => input.playerAccess ?? false),
    },
  } as never;
}

describe("Scenario gameplay relationship authority", () => {
  it("keeps the managing Campaign GM in GM mode", async () => {
    await expect(
      resolveScenarioWorkspaceAccess(services(), {
        scenarioId: "scenario-1",
        userId: "gm-1",
        userRoles: ["game_master"],
      }),
    ).resolves.toEqual({ campaignId: "campaign-1", mode: "gm" });
  });

  it.each([
    ["unrelated Admin", "admin-1", ["admin"]],
    ["GM of another Campaign", "gm-2", ["game_master"]],
  ])(
    "denies an %s without a Scenario or Campaign relationship",
    async (_label, userId, userRoles) => {
      await expect(
        resolveScenarioWorkspaceAccess(services(), {
          scenarioId: "scenario-1",
          userId,
          userRoles,
        }),
      ).resolves.toBeNull();
    },
  );

  it("keeps an entitled Character controller in player mode", async () => {
    await expect(
      resolveScenarioWorkspaceAccess(
        services({ campaignUserIds: ["campaign-1"], playerAccess: true }),
        {
          scenarioId: "scenario-1",
          userId: "controller-1",
          userRoles: ["player"],
        },
      ),
    ).resolves.toEqual({ campaignId: "campaign-1", mode: "player" });
  });

  it("allows an Admin only through an independently established player relationship", async () => {
    await expect(
      resolveScenarioWorkspaceAccess(
        services({ campaignUserIds: ["campaign-1"], playerAccess: true }),
        {
          scenarioId: "scenario-1",
          userId: "admin-controller",
          userRoles: ["admin"],
        },
      ),
    ).resolves.toEqual({ campaignId: "campaign-1", mode: "player" });
  });
});
