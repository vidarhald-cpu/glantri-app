import { describe, expect, it, vi, beforeEach } from "vitest";

import type { AuthUser } from "@glantri/auth";
import type { Campaign, Scenario } from "@glantri/domain";

import * as api from "../api/localServiceClient";
import { ApiRequestError } from "../api/localServiceClient";
import {
  loadCampaignBrowserRecordsForUser,
  loadCampaignWorkspaceAccessForUser,
  resolveCampaignResumeDestination,
} from "./access";

vi.mock("../api/localServiceClient", async () => {
  const actual = await vi.importActual<typeof import("../api/localServiceClient")>(
    "../api/localServiceClient",
  );

  return {
    ...actual,
    loadAccessibleCampaignById: vi.fn(),
    loadAccessibleCampaigns: vi.fn(),
    loadCampaignScenarios: vi.fn(),
    loadCampaigns: vi.fn(),
  };
});

function createUser(input: { id: string; roles: AuthUser["roles"] }): AuthUser {
  return {
    displayName: "User",
    email: `${input.id}@example.com`,
    id: input.id,
    roles: input.roles,
  };
}

function createCampaign(id: string, name: string): Campaign {
  return {
    createdAt: "2026-04-25T00:00:00.000Z",
    description: "",
    gmUserId: "gm-1",
    id,
    name,
    settings: {
      allowPlayerSelfJoin: false,
      defaultVisibility: "hidden",
    },
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    status: "active",
    updatedAt: "2026-04-25T00:00:00.000Z",
  };
}

function createScenario(id: string, campaignId: string, name: string): Scenario {
  return {
    campaignId,
    createdAt: "2026-04-25T00:00:00.000Z",
    description: "",
    id,
    kind: "combat",
    name,
    status: "live",
    updatedAt: "2026-04-25T00:00:00.000Z",
  };
}

describe("campaign access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps GM/admin campaign loading on the GM-only endpoint", async () => {
    vi.mocked(api.loadCampaigns).mockResolvedValue([createCampaign("campaign-1", "GM Campaign")]);

    const result = await loadCampaignBrowserRecordsForUser(
      createUser({ id: "gm-1", roles: ["game_master"] }),
    );

    expect(api.loadCampaigns).toHaveBeenCalledTimes(1);
    expect(api.loadAccessibleCampaigns).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        campaign: expect.objectContaining({ id: "campaign-1" }),
        scenarios: [],
      },
    ]);
  });

  it("loads player-visible campaigns without calling the GM-only campaign endpoint", async () => {
    vi.mocked(api.loadAccessibleCampaigns).mockResolvedValue([
      {
        campaign: createCampaign("campaign-1", "Arena"),
        scenarios: [createScenario("scenario-1", "campaign-1", "Gladiator Pit")],
      },
    ]);

    const result = await loadCampaignBrowserRecordsForUser(
      createUser({ id: "player-1", roles: ["player"] }),
    );

    expect(api.loadCampaigns).not.toHaveBeenCalled();
    expect(api.loadAccessibleCampaigns).toHaveBeenCalledTimes(1);
    expect(result[0].scenarios.map((scenario) => scenario.id)).toEqual(["scenario-1"]);
  });

  it("returns a clean empty state for a player permission mismatch instead of throwing", async () => {
    vi.mocked(api.loadAccessibleCampaigns).mockRejectedValue(
      new ApiRequestError("Admin or GM role required.", 403),
    );

    await expect(
      loadCampaignBrowserRecordsForUser(createUser({ id: "player-1", roles: ["player"] })),
    ).resolves.toEqual([]);
  });

  it("returns a clean empty campaign list when a player has no accessible campaigns", async () => {
    vi.mocked(api.loadAccessibleCampaigns).mockResolvedValue([]);

    await expect(
      loadCampaignBrowserRecordsForUser(createUser({ id: "player-2", roles: ["player"] })),
    ).resolves.toEqual([]);
  });

  it("returns player workspace access from the player-safe endpoint", async () => {
    vi.mocked(api.loadAccessibleCampaignById).mockResolvedValue({
      campaign: createCampaign("campaign-1", "Arena"),
      scenarios: [createScenario("scenario-1", "campaign-1", "Gladiator Pit")],
    });

    await expect(
      loadCampaignWorkspaceAccessForUser({
        campaignId: "campaign-1",
        user: createUser({ id: "player-1", roles: ["player"] }),
      }),
    ).resolves.toEqual({
      accessMode: "player",
      campaign: expect.objectContaining({ id: "campaign-1" }),
      scenarios: [expect.objectContaining({ id: "scenario-1" })],
    });
  });

  it("falls back cleanly when the remembered campaign is no longer accessible", () => {
    expect(
      resolveCampaignResumeDestination({
        accessibleCampaigns: [],
        rememberedCampaignId: "campaign-1",
      }),
    ).toEqual({
      clearRememberedCampaign: true,
      href: "/campaigns",
    });
  });

  it("reopens a remembered accessible campaign workspace with full query state", () => {
    const destination = resolveCampaignResumeDestination({
      accessibleCampaigns: [
        {
          campaign: createCampaign("campaign-1", "Arena"),
          scenarios: [createScenario("scenario-1", "campaign-1", "Gladiator Pit")],
        },
      ],
      rememberedCampaignId: "campaign-1",
      rememberedEncounterId: "encounter-1",
      rememberedParticipantId: "participant-1",
      rememberedScenarioId: "scenario-1",
      rememberedTab: "player-encounter",
    });

    expect(destination).toEqual({
      clearRememberedCampaign: false,
      href:
        "/campaigns/campaign-1?tab=player-encounter&scenarioId=scenario-1&encounterId=encounter-1&participantId=participant-1",
    });
  });
});
