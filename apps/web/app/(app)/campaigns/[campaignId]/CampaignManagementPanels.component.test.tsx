import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
};

function NotesHarness({ initialNotes = [] }: { initialNotes?: CampaignNote[] }) {
  const [notes, setNotes] = useState<CampaignNote[]>(initialNotes);
  return (
    <CampaignNotesPanel
      campaignId="campaign-1"
      notes={notes}
      onAuthorizationLoss={vi.fn()}
      onNotesChanged={setNotes}
      references={[{ id: "scenario-live", label: "Western Gate", type: "scenario" }]}
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
    expect(screen.getByRole("region", { name: "Campaign home" })).toHaveStyle({
      display: "grid",
    });
  });

  it("creates, edits, resolves, and reopens a typed private note", async () => {
    const user = userEvent.setup();
    const editedAt = "2026-09-17T08:01:00.000Z";
    const resolvedAt = "2026-09-17T08:02:00.000Z";
    mocks.createCampaignNoteOnServer.mockResolvedValue(
      note({ reference: { id: "scenario-live", label: "Western Gate", type: "scenario" } }),
    );
    mocks.updateCampaignNoteOnServer.mockResolvedValue(
      note({
        content: "Question the sentry before dawn.",
        reference: { id: "scenario-live", label: "Western Gate", type: "scenario" },
        updatedAt: editedAt,
      }),
    );
    mocks.setCampaignNoteStatusOnServer
      .mockResolvedValueOnce(note({ status: "resolved", updatedAt: resolvedAt }))
      .mockResolvedValueOnce(note({ status: "open", updatedAt: "2026-09-17T08:03:00.000Z" }));
    render(<NotesHarness />);

    await user.type(
      screen.getByRole("textbox", { name: "New Campaign Note" }),
      "Question the sentry.",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "New Note reference" }),
      "scenario:scenario-live",
    );
    await user.click(screen.getByRole("button", { name: "Add Note" }));
    await screen.findByText("Question the sentry.");
    expect(mocks.createCampaignNoteOnServer).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      content: "Question the sentry.",
      reference: { id: "scenario-live", label: "Western Gate", type: "scenario" },
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const edit = screen.getByRole("textbox", { name: "Edit Note Question the sentry." });
    await user.clear(edit);
    await user.type(edit, "Question the sentry before dawn.");
    await user.click(screen.getByRole("button", { name: "Save Note" }));
    await screen.findByText("Question the sentry before dawn.");

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
      campaignId: "campaign-1",
      content: "Reviewed edit from B",
      expectedRevision: now,
      noteId: "note-1",
      reference: undefined,
    });

    await user.click(screen.getByRole("button", { name: "Save Note" }));
    await screen.findByText("Reviewed edit from B");
    expect(mocks.updateCampaignNoteOnServer).toHaveBeenNthCalledWith(2, {
      campaignId: "campaign-1",
      content: "Reviewed edit from B",
      expectedRevision: currentServerNote.updatedAt,
      noteId: "note-1",
      reference: undefined,
    });
  });
});
