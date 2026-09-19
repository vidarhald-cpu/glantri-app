import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CampaignNote, CampaignWorkspaceOverview } from "@glantri/domain";

const mocks = vi.hoisted(() => ({
  createCampaignNoteOnServer: vi.fn(),
  getCurrentCampaignNoteFromMutationConflict: vi.fn(
    (error: unknown) => (error as { currentNote?: CampaignNote } | undefined)?.currentNote,
  ),
  setCampaignNoteStatusOnServer: vi.fn(),
  updateCampaignNoteOnServer: vi.fn(),
}));

vi.mock("@/lib/api/campaignClient", () => ({
  createCampaignNoteOnServer: mocks.createCampaignNoteOnServer,
  getCurrentCampaignNoteFromMutationConflict: mocks.getCurrentCampaignNoteFromMutationConflict,
  setCampaignNoteStatusOnServer: mocks.setCampaignNoteStatusOnServer,
  updateCampaignNoteOnServer: mocks.updateCampaignNoteOnServer,
}));

import { CampaignHomeOverview } from "./CampaignHomeOverview";
import { CampaignNotesPanel } from "./CampaignNotesPanel";

const now = "2026-09-17T08:00:00.000Z";

function note(overrides: Partial<CampaignNote> = {}): CampaignNote {
  return {
    associations: [],
    campaignId: "campaign-1",
    content: "Question the sentry.",
    createdAt: now,
    createdByUserId: "gm-1",
    id: "note-1",
    status: "open",
    updatedAt: now,
    updatedByUserId: "gm-1",
    ...overrides,
  };
}

const overview: CampaignWorkspaceOverview = {
  campaign: {
    createdAt: now,
    description: "",
    gmUserId: "gm-1",
    id: "campaign-1",
    name: "Border Trouble",
    settings: { allowPlayerSelfJoin: false, defaultVisibility: "hidden" },
    slug: "border-trouble",
    status: "active",
    updatedAt: now,
  },
  currentContexts: [
    {
      encounters: [
        {
          activeCombat: true,
          id: "encounter-1",
          status: "active",
          title: "Gate Skirmish",
          updatedAt: now,
        },
      ],
      scenario: {
        id: "scenario-live",
        name: "Western Gate",
        status: "live",
        updatedAt: now,
      },
    },
    {
      encounters: [],
      scenario: {
        id: "scenario-paused",
        name: "Council Chamber",
        status: "paused",
        updatedAt: now,
      },
    },
  ],
  notes: [],
  npcs: [
    {
      historical: true,
      id: "npc-prominent",
      label: "Captain Harl",
      prominent: true,
      scenarioIds: ["scenario-live"],
    },
    {
      historical: true,
      id: "npc-history",
      label: "Masked Courier",
      prominent: false,
      scenarioIds: ["scenario-past"],
    },
  ],
  recentActivity: [
    {
      createdAt: now,
      encounterId: "encounter-1",
      encounterTitle: "Gate Skirmish",
      eventType: "encounter_started",
      id: "event-1",
      scenarioId: "scenario-live",
      scenarioName: "Western Gate",
      summary: "The gate confrontation began.",
    },
  ],
  references: [],
  roster: [
    {
      campaignId: "campaign-1",
      category: "pc",
      createdAt: now,
      id: "roster-current",
      labelSnapshot: "Ari",
      membershipState: "current",
      sourceId: "character-1",
      sourceType: "character",
      updatedAt: now,
    },
    {
      campaignId: "campaign-1",
      category: "pc",
      createdAt: now,
      id: "roster-former",
      labelSnapshot: "Bryn",
      membershipState: "former",
      sourceId: "character-2",
      sourceType: "character",
      updatedAt: now,
    },
  ],
  tags: [],
};

function NotesHarness({ initialNotes = [] }: { initialNotes?: CampaignNote[] }) {
  const [notes, setNotes] = useState<CampaignNote[]>(initialNotes);
  return (
    <CampaignNotesPanel
      campaignId="campaign-1"
      notes={notes}
      onAuthorizationLoss={vi.fn()}
      onNotesChanged={setNotes}
      references={[
        { id: "scenario-live", label: "Western Gate", type: "scenario" },
        {
          id: "encounter-1",
          label: "Gate Skirmish",
          scenarioId: "scenario-live",
          type: "encounter",
        },
        { id: "character-1", label: "Ari", type: "character" },
        { id: "npc-1", label: "Captain Harl", type: "npc" },
      ]}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Campaign management panels", () => {
  it("shows every live or paused context without inventing a single current pointer", () => {
    render(<CampaignHomeOverview overview={overview} />);

    const currentContext = screen.getByRole("region", {
      name: "Current Scenario and Encounter",
    });
    expect(screen.getByText("Western Gate")).toBeInTheDocument();
    expect(screen.getByText("Council Chamber")).toBeInTheDocument();
    expect(screen.getByText(/Gate Skirmish.*Combat active/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Combat" })).toHaveAttribute(
      "href",
      expect.stringContaining("tab=combat"),
    );
    expect(screen.getByText("Ari")).toBeInTheDocument();
    expect(screen.getByText("1 former PC relationship(s).")).toBeInTheDocument();
    expect(screen.getByText("Captain Harl")).toBeInTheDocument();
    expect(screen.getByText("NPCs from Campaign history (1)")).toBeInTheDocument();
    expect(screen.getByText("The gate confrontation began.")).toBeInTheDocument();
    expect(
      within(currentContext)
        .getAllByRole("link", { name: "Open Scenario" })
        .find(
          (link) => link.getAttribute("href") === "/campaigns/campaign-1/scenarios/scenario-live",
        ),
    ).toBeDefined();
    expect(within(currentContext).getByRole("link", { name: "Open Encounter" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1/scenarios/scenario-live/encounters/encounter-1",
    );
    expect(screen.getByText("Campaign history").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("region", { name: "Campaign home" })).toHaveStyle({
      display: "grid",
    });
  });

  it("creates a note through a proper editor with several associations and links each to its canonical home", async () => {
    const user = userEvent.setup();
    const created = note({
      associations: [
        { id: "scenario-live", label: "Western Gate", type: "scenario" },
        {
          id: "encounter-1",
          label: "Gate Skirmish",
          scenarioId: "scenario-live",
          type: "encounter",
        },
        { id: "character-1", label: "Ari", type: "character" },
        { id: "npc-1", label: "Captain Harl", type: "npc" },
        { id: "loose end", label: "Loose End", type: "tag" },
      ],
    });
    mocks.createCampaignNoteOnServer.mockResolvedValue(created);
    render(<NotesHarness />);

    // Meaningful writing does not happen in a tiny always-on inline control.
    expect(screen.queryByRole("textbox", { name: "New Campaign Note" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New note" }));

    const editor = screen.getByRole("textbox", { name: "New Campaign Note" });
    expect(editor).toHaveAttribute("rows", "10");
    await user.type(editor, "Question the sentry.");

    await user.click(screen.getByRole("checkbox", { name: "Scenario: Western Gate" }));
    await user.click(screen.getByRole("checkbox", { name: "Encounter: Gate Skirmish" }));
    await user.click(screen.getByRole("checkbox", { name: "PC: Ari" }));
    await user.click(screen.getByRole("checkbox", { name: "NPC: Captain Harl" }));
    await user.type(screen.getByRole("textbox", { name: "Custom tag" }), "Loose End");
    await user.click(screen.getByRole("button", { name: "Add tag" }));

    await user.click(screen.getByRole("button", { name: "Save Note" }));
    await screen.findByText("Question the sentry.");

    expect(mocks.createCampaignNoteOnServer).toHaveBeenCalledWith({
      associations: [
        { id: "scenario-live", label: "Western Gate", type: "scenario" },
        {
          id: "encounter-1",
          label: "Gate Skirmish",
          scenarioId: "scenario-live",
          type: "encounter",
        },
        { id: "character-1", label: "Ari", type: "character" },
        { id: "npc-1", label: "Captain Harl", type: "npc" },
        { id: "loose end", label: "Loose End", type: "tag" },
      ],
      campaignId: "campaign-1",
      content: "Question the sentry.",
    });

    // The editor closes, and each association click-through reaches a canonical home.
    expect(screen.queryByRole("textbox", { name: "New Campaign Note" })).not.toBeInTheDocument();
    expect(screen.getByTitle("Open Scenario: Western Gate")).toHaveAttribute(
      "href",
      "/campaigns/campaign-1/scenarios/scenario-live",
    );
    expect(screen.getByTitle("Open Encounter: Gate Skirmish")).toHaveAttribute(
      "href",
      "/campaigns/campaign-1/scenarios/scenario-live/encounters/encounter-1",
    );
    expect(screen.getByTitle("Open PC: Ari")).toHaveAttribute("href", "/characters/character-1");
    expect(screen.getByTitle("Open NPC: Captain Harl")).toHaveAttribute(
      "href",
      expect.stringContaining("#campaign-membership"),
    );
    // A custom tag has no separate home, so it filters instead of navigating.
    expect(screen.getByRole("button", { name: "#Loose End" })).toBeInTheDocument();
  });

  it("keeps the list compact until the reader deliberately expands a note", async () => {
    const user = userEvent.setup();
    const long = note({
      content: "First line of the plan.\nSecond line the list must not show up front.",
    });
    render(<NotesHarness initialNotes={[long]} />);

    expect(screen.getByText("First line of the plan.")).toBeInTheDocument();
    expect(
      screen.queryByText(/Second line the list must not show up front/),
    ).not.toBeInTheDocument();

    const expandButton = screen.getByRole("button", { name: "Expand Note" });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    await user.click(expandButton);

    expect(
      screen.getByText(/Second line the list must not show up front/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse Note" }));
    expect(
      screen.queryByText(/Second line the list must not show up front/),
    ).not.toBeInTheDocument();
  });

  it("edits associations, resolves, and reopens a private note", async () => {
    const user = userEvent.setup();
    const editedAt = "2026-09-17T08:01:00.000Z";
    const resolvedAt = "2026-09-17T08:02:00.000Z";
    const existing = note({
      associations: [{ id: "scenario-live", label: "Western Gate", type: "scenario" }],
    });
    mocks.updateCampaignNoteOnServer.mockResolvedValue(
      note({
        associations: [{ id: "character-1", label: "Ari", type: "character" }],
        content: "Question the sentry before dawn.",
        updatedAt: editedAt,
      }),
    );
    mocks.setCampaignNoteStatusOnServer
      .mockResolvedValueOnce(note({ status: "resolved", updatedAt: resolvedAt }))
      .mockResolvedValueOnce(note({ status: "open", updatedAt: "2026-09-17T08:03:00.000Z" }));
    render(<NotesHarness initialNotes={[existing]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const edit = screen.getByRole("textbox", { name: "Edit Note Question the sentry." });
    await user.clear(edit);
    await user.type(edit, "Question the sentry before dawn.");

    // The existing association is pre-selected; swap it for a different one.
    expect(screen.getByRole("checkbox", { name: "Scenario: Western Gate" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Scenario: Western Gate" }));
    await user.click(screen.getByRole("checkbox", { name: "PC: Ari" }));
    await user.click(screen.getByRole("button", { name: "Save Note" }));
    await screen.findByText("Question the sentry before dawn.");

    expect(mocks.updateCampaignNoteOnServer).toHaveBeenCalledWith({
      associations: [{ id: "character-1", label: "Ari", type: "character" }],
      campaignId: "campaign-1",
      content: "Question the sentry before dawn.",
      expectedRevision: now,
      noteId: "note-1",
    });

    await user.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(screen.getByText("Resolved")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(screen.getByText("Open")).toBeInTheDocument());
    expect(mocks.setCampaignNoteStatusOnServer).toHaveBeenNthCalledWith(2, {
      campaignId: "campaign-1",
      expectedRevision: resolvedAt,
      noteId: "note-1",
      status: "open",
    });
  });

  it("shows the current server Note after a conflict while preserving the attempted edit", async () => {
    const user = userEvent.setup();
    const currentServerNote = note({
      content: "Accepted edit from A",
      updatedAt: "2026-09-17T08:01:00.000Z",
    });
    mocks.updateCampaignNoteOnServer
      .mockRejectedValueOnce({ currentNote: currentServerNote })
      .mockResolvedValueOnce(
        note({ content: "Reviewed edit from B", updatedAt: "2026-09-17T08:02:00.000Z" }),
      );
    render(<NotesHarness initialNotes={[note()]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const editor = screen.getByRole("textbox", { name: "Edit Note Question the sentry." });
    await user.clear(editor);
    await user.type(editor, "Reviewed edit from B");
    await user.click(screen.getByRole("button", { name: "Save Note" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("changed elsewhere");
    expect(screen.getByRole("textbox", { name: "Edit Note Accepted edit from A" })).toHaveValue(
      "Reviewed edit from B",
    );
    expect(screen.getByRole("status", { name: "Current saved Note" })).toHaveTextContent(
      "Accepted edit from A",
    );
    expect(mocks.updateCampaignNoteOnServer).toHaveBeenNthCalledWith(1, {
      associations: [],
      campaignId: "campaign-1",
      content: "Reviewed edit from B",
      expectedRevision: now,
      noteId: "note-1",
    });

    await user.click(screen.getByRole("button", { name: "Save Note" }));
    await screen.findByText("Reviewed edit from B");
    expect(mocks.updateCampaignNoteOnServer).toHaveBeenNthCalledWith(2, {
      associations: [],
      campaignId: "campaign-1",
      content: "Reviewed edit from B",
      expectedRevision: currentServerNote.updatedAt,
      noteId: "note-1",
    });
  });
});
