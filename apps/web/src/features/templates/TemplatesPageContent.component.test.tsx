import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultCanonicalContent, equipmentTemplates } from "@glantri/content";

const mocks = vi.hoisted(() => ({
  createCampaignNpc: vi.fn(),
  createTemplate: vi.fn(),
  loadCampaigns: vi.fn(),
  loadContent: vi.fn(),
  loadTemplates: vi.fn(),
  updateTemplate: vi.fn(),
}));

vi.mock("@/lib/api/localServiceClient", () => ({
  createCampaignNpcOnServer: mocks.createCampaignNpc,
  createTemplateOnServer: mocks.createTemplate,
  loadCampaigns: mocks.loadCampaigns,
  loadTemplates: mocks.loadTemplates,
  updateTemplateOnServer: mocks.updateTemplate,
}));

vi.mock("@/lib/content/loadCanonicalContent", () => ({
  loadCanonicalContent: mocks.loadContent,
}));

import {
  buildHumanoidNpcArchetypeSnapshot,
  createEmptyHumanoidNpcArchetypeDraft,
  listProfessionsForSociety,
  listSocietyOptions,
} from "@/lib/templates/npcArchetypeTemplates";
import TemplatesPageContent from "./TemplatesPageContent";

function createArchetypeTemplate() {
  const society = listSocietyOptions(defaultCanonicalContent)[0];
  if (!society) throw new Error("Missing society fixture.");
  const profession = listProfessionsForSociety({
    content: defaultCanonicalContent,
    societyId: society.societyId,
  })[0];
  if (!profession) throw new Error("Missing profession fixture.");
  const draft = {
    ...createEmptyHumanoidNpcArchetypeDraft(),
    name: "City Guard",
    professionId: profession.id,
    roleLabel: "Town watch",
    societyId: society.societyId,
    variability: {
      gearSubstitutionNotes: "",
      notes: "",
      skillVariance: 0,
      statVariance: 0,
    },
  };

  return {
    createdAt: "2026-08-13T08:00:00.000Z",
    gmUserId: "gm-1",
    id: "template-guard",
    kind: "npc" as const,
    name: draft.name,
    snapshot: buildHumanoidNpcArchetypeSnapshot({
      content: defaultCanonicalContent,
      draft,
      equipmentTemplates,
    }),
    updatedAt: "2026-08-13T08:00:00.000Z",
  };
}

describe("TemplatesPageContent generated NPC persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadContent.mockResolvedValue(defaultCanonicalContent);
    mocks.loadTemplates.mockResolvedValue([createArchetypeTemplate()]);
    mocks.loadCampaigns.mockResolvedValue([
      {
        createdAt: "2026-08-13T08:00:00.000Z",
        description: "",
        gmUserId: "gm-1",
        id: "campaign-1",
        name: "Border Trouble",
        settings: { allowPlayerSelfJoin: false, defaultVisibility: "hidden" },
        slug: "border-trouble",
        status: "active",
        updatedAt: "2026-08-13T08:00:00.000Z",
      },
    ]);
    mocks.createCampaignNpc.mockResolvedValue({
      entity: { id: "entity-1", name: "Town watch 101" },
      rosterEntry: { id: "roster-1", sourceId: "entity-1" },
    });
  });

  it("requires a campaign choice and saves one concrete NPC to that roster", async () => {
    const user = userEvent.setup();
    render(<TemplatesPageContent />);

    await screen.findByRole("heading", { name: "Create humanoid NPC archetype" });
    await user.click(screen.getByRole("button", { name: "Generate NPC" }));
    await user.selectOptions(screen.getByLabelText("Template"), "template-guard");
    await user.click(screen.getByRole("button", { name: /^Generate$/ }));

    const saveButton = screen.getByRole("button", { name: "Save NPC to roster" });
    expect(saveButton).toBeDisabled();
    expect(
      screen.getByText(
        /Saving creates one GM-owned person you can reuse in scenarios and encounters/,
      ),
    ).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Campaign roster"), "campaign-1");
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    await waitFor(() => expect(mocks.createCampaignNpc).toHaveBeenCalledTimes(1));
    const request = mocks.createCampaignNpc.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      campaignId: "campaign-1",
      kind: "npc",
      snapshot: {
        actorClass: "campaign_npc",
        campaignId: "campaign-1",
        generationProvenance: {
          sourceTemplateId: "template-guard",
        },
      },
    });
    expect(request.snapshot).toHaveProperty("build");
    expect(request.snapshot).toHaveProperty("sheetSummary");
    expect(request.snapshot).toHaveProperty("equipmentState");
    expect(mocks.createTemplate).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        /Saved Town watch 101 as one reusable NPC on the Border Trouble roster/,
      ),
    ).toBeVisible();
  });
});
