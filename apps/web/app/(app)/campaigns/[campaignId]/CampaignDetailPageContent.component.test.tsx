import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Campaign,
  CampaignCharacterRosterCandidate,
  CampaignRosterEntry,
  Scenario,
} from "@glantri/domain";

const mocks = vi.hoisted(() => ({
  activateCampaignOnServer: vi.fn(),
  addCampaignRosterEntryOnServer: vi.fn(),
  createCampaignAssetOnServer: vi.fn(),
  createScenarioOnServer: vi.fn(),
  loadCampaignAssets: vi.fn(),
  loadCampaignById: vi.fn(),
  loadCampaignCharacterRosterCandidates: vi.fn(),
  loadCampaignEntities: vi.fn(),
  loadCampaigns: vi.fn(),
  loadCampaignRoster: vi.fn(),
  loadCampaignScenarioRelationships: vi.fn(),
  loadCampaignScenarios: vi.fn(),
  loadCampaignWorkspaceOverview: vi.fn(),
  loadTemplates: vi.fn(),
  removeCampaignRosterEntryOnServer: vi.fn(),
  updateCampaignAssetVisibilityOnServer: vi.fn(),
}));

vi.mock("@/lib/api/localServiceClient", () => ({
  activateCampaignOnServer: mocks.activateCampaignOnServer,
  addCampaignRosterEntryOnServer: mocks.addCampaignRosterEntryOnServer,
  createCampaignAssetOnServer: mocks.createCampaignAssetOnServer,
  createScenarioOnServer: mocks.createScenarioOnServer,
  loadCampaignAssets: mocks.loadCampaignAssets,
  loadCampaignById: mocks.loadCampaignById,
  loadCampaignCharacterRosterCandidates: mocks.loadCampaignCharacterRosterCandidates,
  loadCampaignEntities: mocks.loadCampaignEntities,
  loadCampaigns: mocks.loadCampaigns,
  loadCampaignRoster: mocks.loadCampaignRoster,
  loadCampaignScenarioRelationships: mocks.loadCampaignScenarioRelationships,
  loadCampaignScenarios: mocks.loadCampaignScenarios,
  loadCampaignWorkspaceOverview: mocks.loadCampaignWorkspaceOverview,
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

const character: CampaignCharacterRosterCandidate = {
  alreadyRostered: true,
  id: "character-1",
  name: "Ari",
  ownerLabel: "Player One",
};

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
    mocks.loadCampaignCharacterRosterCandidates.mockResolvedValue([character]);
    mocks.loadCampaignWorkspaceOverview.mockResolvedValue({
      campaign,
      currentContexts: [],
      notes: [],
      npcs: [],
      recentActivity: [],
      references: [{ id: campaign.id, label: campaign.name, type: "campaign" }],
      roster: [rosterEntry],
    });
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
    expect(screen.getByText("Player One")).toBeInTheDocument();

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
  }, 10_000);

  it("labels a live Scenario Active in the table row, agreeing with the lifecycle filter (#578)", async () => {
    mocks.loadCampaignRoster.mockResolvedValue([rosterEntry]);
    mocks.loadCampaignScenarios.mockResolvedValue([
      {
        campaignId: "campaign-1",
        createdAt: "2026-05-01T00:00:00.000Z",
        description: "",
        id: "scenario-live",
        name: "Western Gate",
        status: "live",
        updatedAt: "2026-05-01T00:00:00.000Z",
      },
    ] as unknown as Scenario[]);
    const CampaignDetailPageContent = await importCampaignDetailPageContent();

    render(<CampaignDetailPageContent campaignId="campaign-1" />);

    const row = (await screen.findByText("Western Gate")).closest("tr");
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent("Active");
    expect(row).not.toHaveTextContent("Live");
    const filter = screen.getByRole("combobox", { name: "Scenario lifecycle filter" });
    const activeOption = Array.from(filter.querySelectorAll("option")).find(
      (option) => option.textContent === "Active",
    );
    expect(activeOption).toHaveValue("live");
  }, 10_000);

  it("lets a draft Campaign be activated with GM ownership", async () => {
    const CampaignDetailPageContent = await importCampaignDetailPageContent();
    const user = userEvent.setup();
    mocks.loadCampaignById.mockResolvedValue({ ...campaign, status: "draft" });
    mocks.activateCampaignOnServer.mockResolvedValue({ ...campaign, status: "active" });

    render(<CampaignDetailPageContent campaignId="campaign-1" />);

    expect(await screen.findByRole("button", { name: "Activate campaign" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Activate campaign" }));

    expect(mocks.activateCampaignOnServer).toHaveBeenCalledWith({
      campaignId: "campaign-1",
    });
    await screen.findByText("Activated Border Trouble.");
  });

  it("prefers the stored roster entry source key when removing an existing membership", async () => {
    const { getRosterRemovalSource } = await import("./CampaignDetailPageContent");

    expect(
      getRosterRemovalSource({
        rosterEntry: {
          sourceId: "stored-character-id",
          sourceType: "character",
        },
        sourceId: "candidate-character-id",
        sourceType: "character",
      }),
    ).toEqual({
      sourceId: "stored-character-id",
      sourceType: "character",
    });
    expect(
      getRosterRemovalSource({
        sourceId: "candidate-character-id",
        sourceType: "character",
      }),
    ).toEqual({
      sourceId: "candidate-character-id",
      sourceType: "character",
    });
  });
});
