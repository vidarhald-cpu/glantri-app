import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assign: vi.fn(),
  create: vi.fn(),
  equipment: vi.fn(),
  load: vi.fn(),
  transfer: vi.fn(),
  unassign: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/api/equipmentClient", () => ({
  assignCampaignItemOnServer: mocks.assign,
  createCampaignItemOnServer: mocks.create,
  loadCharacterEquipmentState: mocks.equipment,
  loadCampaignItems: mocks.load,
  transferCampaignItemOnServer: mocks.transfer,
  unassignCampaignItemOnServer: mocks.unassign,
  updateCampaignItemOnServer: mocks.update,
}));

import CampaignItemsWorkspace from "./CampaignItemsWorkspace";

const rapier = {
  baseEncumbrance: 1,
  category: "weapon",
  defaultMaterial: "steel",
  id: "weapon-template-rapier",
  initiative: 2,
  name: "Rapier",
  specificityTypeDefault: "specific",
  tags: [],
};

const emptyResponse = {
  characters: [{ id: "character-1", name: "Alaric" }],
  state: {
    itemsById: {},
    templatesById: { [rapier.id]: rapier },
  },
};

const assignedItem = {
  campaignContextId: "campaign-1",
  category: "weapon",
  characterId: "character-1",
  conditionState: "intact",
  displayName: "Silverston",
  holderCharacterId: "character-1",
  id: "item-silverston",
  isStackable: false,
  itemFacts: {
    activeMechanics: [],
    descriptiveTraits: [],
    templateOverrides: [],
    unsupportedCapabilities: [],
    version: 1,
  },
  material: "steel",
  quality: "standard",
  quantity: 1,
  specificityType: "specific",
  storageAssignment: { carryMode: "on_person", locationId: "character-1:loc-person" },
  templateId: rapier.id,
};

const assignedResponse = {
  characters: [
    { id: "character-1", name: "Alaric" },
    { id: "character-2", name: "Beatrice" },
  ],
  state: {
    itemsById: { [assignedItem.id]: assignedItem },
    templatesById: { [rapier.id]: rapier },
  },
};

describe("CampaignItemsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockResolvedValue(emptyResponse);
    mocks.assign.mockResolvedValue(assignedResponse);
    mocks.create.mockResolvedValue(emptyResponse);
    mocks.equipment.mockResolvedValue({ revision: 4 });
    mocks.transfer.mockResolvedValue(assignedResponse);
    mocks.unassign.mockResolvedValue(emptyResponse);
    mocks.update.mockResolvedValue(assignedResponse);
  });

  it("creates a positive whole-number ammunition quantity", async () => {
    const arrow = {
      ...rapier,
      id: "gear-template-arrows",
      category: "gear",
      name: "Arrows",
      specificityTypeDefault: "generic",
      ammunitionProfile: { family: "arrow", quantityPerShot: 1 },
    };
    mocks.load.mockResolvedValue({
      ...emptyResponse,
      state: { ...emptyResponse.state, templatesById: { [rapier.id]: rapier, [arrow.id]: arrow } },
    });
    const user = userEvent.setup();
    render(<CampaignItemsWorkspace campaignId="campaign-1" />);
    await user.click(await screen.findByRole("button", { name: "Create item" }));
    await user.selectOptions(screen.getByLabelText("Template"), arrow.id);
    await user.clear(screen.getByLabelText("Quantity"));
    await user.type(screen.getByLabelText("Quantity"), "1.5");
    await user.click(screen.getByRole("button", { name: "Create item" }));
    expect(mocks.create).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Quantity"));
    await user.type(screen.getByLabelText("Quantity"), "20");
    await user.click(screen.getByRole("button", { name: "Create item" }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: arrow.id, quantity: 20 }),
      ),
    );
  });

  it("preserves structured Disarm overrides when unrelated item details are edited", async () => {
    const user = userEvent.setup();
    const disarmOverrides = [
      {
        id: "disarm-capability",
        kind: "weapon_disarm_capability_override" as const,
        scope: "all_attack_modes" as const,
        value: "none" as const,
        visibility: "gm_only" as const,
      },
      {
        id: "disarm-control",
        kind: "weapon_disarm_control_override" as const,
        scope: "all_attack_modes" as const,
        unit: "control_rating" as const,
        value: 4,
        visibility: "revealed" as const,
      },
    ];
    mocks.load.mockResolvedValue({
      ...assignedResponse,
      state: {
        ...assignedResponse.state,
        itemsById: {
          [assignedItem.id]: {
            ...assignedItem,
            itemFacts: { ...assignedItem.itemFacts, templateOverrides: disarmOverrides },
          },
        },
      },
    });
    render(<CampaignItemsWorkspace campaignId="campaign-1" />);

    expect(await screen.findByText("Disarm capability None")).toBeVisible();
    expect(screen.getByText("Disarm control rating 4")).toBeVisible();
    expect(screen.queryByText(/Initiative undefined/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit item" }));
    await user.type(screen.getByLabelText("Description (optional)"), "A documented heirloom.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0]?.[0].facts.templateOverrides).toEqual(disarmOverrides);
  });

  it("creates ordinary and customized items through the same focused flow", async () => {
    const user = userEvent.setup();
    render(<CampaignItemsWorkspace campaignId="campaign-1" />);

    expect(await screen.findByText("No campaign items yet.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create item" }));
    expect(screen.getByRole("heading", { name: "Create item" })).toBeVisible();
    expect(screen.getByLabelText("Initial assignment")).toHaveTextContent(
      "Unassigned / in campaign",
    );
    expect(screen.getByText("Standard initiative: 2")).toBeVisible();
    expect(
      screen.getByText(
        "These are real item capabilities, but the app does not automatically calculate or track them.",
      ),
    ).toBeVisible();

    await user.type(screen.getByLabelText("Item name (optional)"), "Silverston");
    await user.selectOptions(screen.getByLabelText("Initial assignment"), "character-1");
    await user.click(screen.getByLabelText("Use a different initiative"));
    await user.clear(screen.getByLabelText("Actual initiative"));
    await user.type(screen.getByLabelText("Actual initiative"), "1");
    await user.click(screen.getByRole("button", { name: "Add descriptive trait" }));
    expect(screen.getByRole("combobox", { name: "Trait 1 category" })).toBeVisible();
    await user.type(screen.getByLabelText("Trait 1"), "House Silverston");
    await user.click(screen.getByRole("button", { name: "Create item" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "campaign-1",
        displayName: "Silverston",
        holderCharacterId: "character-1",
        templateId: rapier.id,
      }),
    );
    expect(mocks.create.mock.calls[0]?.[0].facts.descriptiveTraits[0]).toMatchObject({
      text: "House Silverston",
      visibility: "gm_only",
    });
  });

  it("confirms a transfer with Character names and reports the unequipped result", async () => {
    const user = userEvent.setup();
    mocks.load.mockResolvedValue(assignedResponse);
    mocks.transfer.mockResolvedValue({
      ...assignedResponse,
      state: {
        ...assignedResponse.state,
        itemsById: {
          [assignedItem.id]: {
            ...assignedItem,
            characterId: "character-2",
            holderCharacterId: "character-2",
            storageAssignment: {
              carryMode: "on_person",
              locationId: "character-2:loc-person",
            },
          },
        },
      },
    });
    render(<CampaignItemsWorkspace campaignId="campaign-1" />);

    const trigger = await screen.findByRole("button", { name: "Transfer item" });
    await user.click(trigger);
    expect(screen.getByRole("heading", { name: "Transfer Silverston" })).toHaveFocus();
    expect(
      screen.getByText(
        "Transfer Silverston from Alaric to Beatrice. It will be On person and will not be equipped.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("character-1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Transfer item" }));
    await waitFor(() =>
      expect(mocks.transfer).toHaveBeenCalledWith({
        campaignId: "campaign-1",
        itemId: "item-silverston",
        sourceExpectedRevision: 4,
        sourceCharacterId: "character-1",
        targetCharacterId: "character-2",
        targetExpectedRevision: 4,
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Silverston transferred from Alaric to Beatrice. It is On person and not equipped.",
    );
  });

  it("assigns an existing unheld Item and can return a held Item to the campaign", async () => {
    const user = userEvent.setup();
    const unassignedItem = {
      ...assignedItem,
      characterId: null,
      holderCharacterId: null,
      storageAssignment: null,
    };
    mocks.load.mockResolvedValue({
      ...assignedResponse,
      state: {
        ...assignedResponse.state,
        itemsById: { [unassignedItem.id]: unassignedItem },
      },
    });
    mocks.assign.mockResolvedValue(assignedResponse);
    render(<CampaignItemsWorkspace campaignId="campaign-1" />);

    await user.click(await screen.findByRole("button", { name: "Assign item" }));
    expect(screen.getByRole("heading", { name: "Assign Silverston" })).toHaveFocus();
    await user.selectOptions(screen.getByLabelText("Receiving Character"), "character-2");
    await user.click(screen.getByRole("button", { name: "Assign item" }));
    await waitFor(() =>
      expect(mocks.assign).toHaveBeenCalledWith({
        campaignId: "campaign-1",
        itemId: "item-silverston",
        targetCharacterId: "character-2",
        targetExpectedRevision: 4,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Return to campaign" }));
    expect(screen.getByRole("heading", { name: "Return Silverston to campaign" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Return to campaign" }));
    await waitFor(() =>
      expect(mocks.unassign).toHaveBeenCalledWith({
        campaignId: "campaign-1",
        itemId: "item-silverston",
        sourceCharacterId: "character-1",
        sourceExpectedRevision: 4,
      }),
    );
  });

  it("keeps transfer errors recoverable and returns focus when cancelled", async () => {
    const user = userEvent.setup();
    mocks.load.mockResolvedValue(assignedResponse);
    mocks.transfer.mockRejectedValue(
      new Error("This item has already moved. Refresh Campaign Items before trying again."),
    );
    render(<CampaignItemsWorkspace campaignId="campaign-1" />);

    const trigger = await screen.findByRole("button", { name: "Transfer item" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Transfer item" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nothing changed. This item has already moved. Refresh Campaign Items before trying again.",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Transfer item" })).toHaveFocus(),
    );
  });
});
