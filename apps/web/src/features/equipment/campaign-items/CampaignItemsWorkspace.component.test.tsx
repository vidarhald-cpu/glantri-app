import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  load: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/api/equipmentClient", () => ({
  createCampaignItemOnServer: mocks.create,
  loadCampaignItems: mocks.load,
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

describe("CampaignItemsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockResolvedValue(emptyResponse);
    mocks.create.mockResolvedValue(emptyResponse);
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
});
