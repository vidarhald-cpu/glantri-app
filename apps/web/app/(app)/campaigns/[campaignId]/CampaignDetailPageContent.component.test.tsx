import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Campaign, CampaignRosterEntry, Scenario } from "@glantri/domain";
import type { ServerCharacterRecord } from "@/lib/api/localServiceClient";

const mocks = vi.hoisted(() => ({
  addCampaignRosterEntryOnServer: vi.fn(),
  createCampaignAssetOnServer: vi.fn(),
  createScenarioOnServer: vi.fn(),
  loadCampaignAssets: vi.fn(),
  loadCampaignById: vi.fn(),
  loadCampaignEntities: vi.fn(),
  loadCampaigns: vi.fn(),
  loadCampaignRoster: vi.fn(),
  loadCampaignScenarioRelationships: vi.fn(),
  loadCampaignScenarios: vi.fn(),
  loadServerCharacters: vi.fn(),
  loadTemplates: vi.fn(),
  removeCampaignRosterEntryOnServer: vi.fn(),
  updateCampaignAssetVisibilityOnServer: vi.fn(),
}));

vi.mock("@/lib/api/localServiceClient", () => ({
  addCampaignRosterEntryOnServer: mocks.addCampaignRosterEntryOnServer,
  createCampaignAssetOnServer: mocks.createCampaignAssetOnServer,
  createScenarioOnServer: mocks.createScenarioOnServer,
  loadCampaignAssets: mocks.loadCampaignAssets,
  loadCampaignById: mocks.loadCampaignById,
  loadCampaignEntities: mocks.loadCampaignEntities,
  loadCampaigns: mocks.loadCampaigns,
  loadCampaignRoster: mocks.loadCampaignRoster,
  loadCampaignScenarioRelationships: mocks.loadCampaignScenarioRelationships,
  loadCampaignScenarios: mocks.loadCampaignScenarios,
  loadServerCharacters: mocks.loadServerCharacters,
  loadTemplates: mocks.loadTemplates,
  removeCampaignRosterEntryOnServer: mocks.removeCampaignRosterEntryOnServer,
  updateCampaignAssetVisibilityOnServer: mocks.updateCampaignAssetVisibilityOnServer,
}));

async function importCampaignDetailPageContent() {
  const mod = await import("./CampaignDetailPageContent");
  return mod.default;
}

const campaign: Campaign = {
  createdAt: "2026-05-01T00:00:00.000Z",
  description: "Campaign description",
  gmUserId: "gm-1",
  id: "campaign-1",
  name: "Border Trouble",
  settings: {
    allowPlayerSelfJoin: false,
    defaultVisibility: "hidden",
  },
  slug: "border-trouble",
  status: "active",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const rosterEntry: CampaignRosterEntry = {
  campaignId: "campaign-1",
  category: "pc",
  createdAt: "2026-05-01T00:00:00.000Z",
  id: "roster-1",
  labelSnapshot: "Ari",
  sourceId: "character-1",
  sourceType: "character",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const character = {
  build: {
    name: "Ari",
    professionId: "fighter",
    progression: {
      skillGroups: [],
    },
    societyId: "thyatis",
  },
  createdAt: "2026-05-01T00:00:00.000Z",
  id: "character-1",
  level: 1,
  name: "Ari",
  owner: {
    displayName: "Player One",
    email: "player@example.test",
    id: "player-1",
  },
  updatedAt: "2026-05-01T00:00:00.000Z",
} as unknown as ServerCharacterRecord;

describe("CampaignDetailPageContent roster membership interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadCampaignById.mockResolvedValue(campaign);
    mocks.loadCampaignScenarios.mockResolvedValue([] satisfies Scenario[]);
    mocks.loadCampaignEntities.mockResolvedValue([]);
    mocks.loadCampaignAssets.mockResolvedValue([]);
    mocks.loadTemplates.mockResolvedValue([]);
    mocks.loadCampaignScenarioRelationships.mockResolvedValue([]);
    mocks.loadCampaigns.mockResolvedValue([campaign]);
    mocks.loadServerCharacters.mockResolvedValue([character]);
    mocks.removeCampaignRosterEntryOnServer.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("unchecking a member calls roster removal with source identity, not roster entry id", async () => {
    let roster = [rosterEntry];
    mocks.loadCampaignRoster.mockImplementation(async () => roster);
    mocks.removeCampaignRosterEntryOnServer.mockImplementation(async () => {
      roster = [];
    });
    const CampaignDetailPageContent = await importCampaignDetailPageContent();
    const user = userEvent.setup();

    render(<CampaignDetailPageContent campaignId="campaign-1" />);

    const memberCheckbox = await screen.findByRole("checkbox", {
      name: "Toggle Ari campaign roster membership",
    });
    expect(memberCheckbox).toBeChecked();

    await user.click(memberCheckbox);

    await waitFor(() => {
      expect(mocks.removeCampaignRosterEntryOnServer).toHaveBeenCalledWith({
        campaignId: "campaign-1",
        sourceId: "character-1",
        sourceType: "character",
      });
    });
    expect(mocks.removeCampaignRosterEntryOnServer).not.toHaveBeenCalledWith(
      expect.objectContaining({
        rosterEntryId: "roster-1",
      }),
    );
  });
});
