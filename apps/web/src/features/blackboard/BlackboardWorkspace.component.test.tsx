import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BlackboardCommonDto } from "@glantri/domain";

import { ApiRequestError } from "@/lib/api/apiClient";

import { BlackboardWorkspace } from "./BlackboardWorkspace";

const mocks = vi.hoisted(() => ({
  createBlackboardEntry: vi.fn(),
  loadBlackboard: vi.fn(),
  loadBlackboardCapabilities: vi.fn(),
  loadBlackboardArtifactCandidates: vi.fn(),
  loadBlackboardHistory: vi.fn(),
  moveBlackboardEntry: vi.fn(),
  pinBlackboardEntry: vi.fn(),
  retractBlackboardEntry: vi.fn(),
  reviseBlackboardEntry: vi.fn(),
  unpinBlackboardEntry: vi.fn(),
}));

const artifactMocks = vi.hoisted(() => ({
  fetchArtifactBlob: vi.fn(),
}));

vi.mock("@/lib/api/blackboardClient", () => mocks);
vi.mock("@/lib/api/artifactClient", () => artifactMocks);

const board: BlackboardCommonDto = {
  catalogue: [
    {
      category: "clue_fact",
      context: "The old gatehouse",
      entryVersion: 1,
      fact: "The bronze bell rings twice before the passage opens.",
      id: "entry-clue",
      state: "Current",
      title: "Bell signal",
      updatedAt: "2026-08-28T08:00:00.000Z",
      updatedByLabel: "Ari",
    },
    {
      category: "document_text",
      documentText: "Meet beneath the western arch after dusk.",
      entryVersion: 2,
      id: "entry-document",
      state: "Corrected",
      title: "Intercepted letter",
      updatedAt: "2026-08-28T08:10:00.000Z",
      updatedByLabel: "Mira",
    },
    {
      artifact: {
        altText: "A hand-drawn route from the mill to the hill caves",
        artifactKind: "map",
        id: "artifact-map",
        mediaType: "image/png",
        title: "Hill route",
      },
      caption: "The safe route avoids the watchtower.",
      category: "image_map",
      content: { artifactId: "artifact-map" },
      entryVersion: 1,
      id: "entry-map",
      sourceStatus: "unchanged",
      state: "Current",
      title: "Route to the caves",
      updatedAt: "2026-08-28T08:20:00.000Z",
      updatedByLabel: "Ari",
    },
    {
      approvedAt: "2026-08-28T08:30:00.000Z",
      approvedByLabel: "Game Master",
      category: "recap",
      entryVersion: 1,
      id: "entry-recap",
      recapText: "The group recovered the seal and returned safely.",
      state: "Current",
      title: "Last session",
      updatedAt: "2026-08-28T08:30:00.000Z",
      updatedByLabel: "Game Master",
    },
  ],
  layout: {
    placements: [
      {
        entryId: "entry-clue",
        height: 180,
        layer: 1,
        rowVersion: 1,
        updatedAt: "2026-08-28T08:31:00.000Z",
        updatedByLabel: "Ari",
        width: 260,
        x: 0,
        y: 0,
      },
    ],
    version: 1,
  },
  tombstones: [],
};

describe("BlackboardWorkspace", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    for (const mock of Object.values(artifactMocks)) mock.mockReset();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:blackboard-visual"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    mocks.loadBlackboard.mockResolvedValue(structuredClone(board));
    mocks.loadBlackboardCapabilities.mockResolvedValue({
      entries: [
        { canCorrect: true, canRemove: true, entryId: "entry-clue" },
        { canCorrect: false, canRemove: false, entryId: "entry-document" },
        { canCorrect: false, canRemove: false, entryId: "entry-map" },
        { canCorrect: false, canRemove: false, entryId: "entry-recap" },
      ],
    });
    mocks.loadBlackboardArtifactCandidates.mockResolvedValue([
      {
        altText: "A hand-drawn route from the mill to the hill caves",
        artifactKind: "map",
        id: "artifact-map",
        mediaType: "image/png",
        title: "Hill route",
      },
    ]);
    artifactMocks.fetchArtifactBlob.mockResolvedValue(new Blob(["image"], { type: "image/png" }));
  });

  it("renders all four safe categories, readable detail, and no protected projection terms", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BlackboardWorkspace campaignId="campaign-1" isGameMaster={false} />,
    );

    await screen.findByRole("heading", { name: "Blackboard" });
    for (const label of ["Clue", "Document", "Map or image", "Recap"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    await user.click(screen.getByRole("button", { name: /Route to the caves/ }));
    expect(
      screen.getByRole("img", { name: "A hand-drawn route from the mill to the hill caves" }),
    ).toBeVisible();
    expect(container.textContent).not.toMatch(
      /unitKey|grant stream|projection|storage key|digest/i,
    );
  });

  it("lets a player share the approved contribution subset but never offers recap creation", async () => {
    const user = userEvent.setup();
    mocks.createBlackboardEntry.mockResolvedValue(board.catalogue[0]);

    render(<BlackboardWorkspace campaignId="campaign-1" isGameMaster={false} />);
    await screen.findByRole("heading", { name: "Blackboard" });
    await user.click(screen.getByRole("button", { name: "Share a reference" }));
    expect(screen.getByRole("heading", { name: "Share a reference" })).toHaveFocus();

    const kind = screen.getByLabelText("Kind");
    expect(within(kind).queryByRole("option", { name: "Approved recap" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Title"), "Signal at the gate");
    await user.type(screen.getByLabelText("Clue or fact"), "Three knocks mean danger.");
    await user.click(screen.getByRole("button", { name: "Share reference" }));

    await waitFor(() =>
      expect(mocks.createBlackboardEntry).toHaveBeenCalledWith({
        campaignId: "campaign-1",
        content: {
          category: "clue_fact",
          fact: "Three knocks mean danger.",
          title: "Signal at the gate",
        },
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Reference shared");
    expect(screen.getByRole("heading", { name: "Bell signal" })).toHaveFocus();
  });

  it("moves focus into the composer, restores its trigger on cancel, and focuses validation", async () => {
    const user = userEvent.setup();

    render(<BlackboardWorkspace campaignId="campaign-1" isGameMaster={false} />);
    await screen.findByRole("heading", { name: "Blackboard" });
    const trigger = screen.getByRole("button", { name: "Share a reference" });
    await user.click(trigger);
    expect(screen.getByRole("heading", { name: "Share a reference" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Share reference" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Give this reference a title");
    expect(screen.getByLabelText("Title")).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Share a reference" })).toBeVisible();
  });

  it("renders management controls only for the server-projected player and GM perspectives", async () => {
    const user = userEvent.setup();
    const playerView = render(<BlackboardWorkspace campaignId="campaign-1" isGameMaster={false} />);
    await screen.findByRole("heading", { name: "Blackboard" });

    await user.click(screen.getByRole("button", { name: "Open Bell signal" }));
    const correctTrigger = screen.getByRole("button", { name: "Correct this entry" });
    expect(correctTrigger).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove this entry" })).toBeVisible();
    await user.click(correctTrigger);
    expect(screen.getByRole("heading", { name: "Correct this reference" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(correctTrigger).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /Intercepted letter/ }));
    expect(screen.queryByRole("button", { name: "Correct this entry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove this entry" })).not.toBeInTheDocument();
    playerView.unmount();

    mocks.loadBlackboardCapabilities.mockResolvedValue({
      entries: board.catalogue.map((entry) => ({
        canCorrect: true,
        canRemove: true,
        entryId: entry.id,
      })),
    });
    render(<BlackboardWorkspace campaignId="campaign-1" isGameMaster />);
    await screen.findByRole("heading", { name: "Blackboard" });
    await user.click(screen.getByRole("button", { name: /Last session/ }));
    expect(screen.getByRole("button", { name: "Correct this entry" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove this entry" })).toBeVisible();
  });

  it("keeps GM-approved recap controls hidden from players", async () => {
    const user = userEvent.setup();

    render(<BlackboardWorkspace campaignId="campaign-1" isGameMaster={false} />);
    await screen.findByRole("heading", { name: "Blackboard" });
    await user.click(screen.getByRole("button", { name: /Last session/ }));

    expect(screen.queryByRole("button", { name: "Correct this entry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove this entry" })).not.toBeInTheDocument();
    expect(screen.getByText(/Approved by Game Master/)).toBeVisible();
  });

  it("shows only the safe shared snapshot when an image source is unavailable", async () => {
    const unavailableBoard = structuredClone(board);
    const image = unavailableBoard.catalogue.find((entry) => entry.category === "image_map");
    if (!image || image.category !== "image_map") throw new Error("Expected image fixture");
    image.sourceStatus = "source_unavailable";
    image.content = undefined;
    mocks.loadBlackboard.mockResolvedValue(unavailableBoard);
    const user = userEvent.setup();

    render(<BlackboardWorkspace campaignId="campaign-1" isGameMaster />);
    await screen.findByRole("heading", { name: "Blackboard" });
    await user.click(screen.getByRole("button", { name: /Route to the caves/ }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("no longer available");
    expect(screen.getAllByText("The safe route avoids the watchtower.")).toHaveLength(2);
    expect(artifactMocks.fetchArtifactBlob).not.toHaveBeenCalled();
  });

  it("shows a recoverable sanitized state when Artifact bytes fail and renders recovery", async () => {
    artifactMocks.fetchArtifactBlob
      .mockRejectedValueOnce(
        new ApiRequestError("Artifact content temporarily unavailable.", 503, {
          error: "Artifact content temporarily unavailable.",
        }),
      )
      .mockResolvedValueOnce(new Blob(["image"], { type: "image/png" }));
    const user = userEvent.setup();
    const { container } = render(<BlackboardWorkspace campaignId="campaign-1" isGameMaster />);
    await screen.findByRole("heading", { name: "Blackboard" });
    await user.click(screen.getByRole("button", { name: /Route to the caves/ }));

    expect(
      await screen.findByText("The shared visual could not be loaded right now."),
    ).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/503|storage|provider|path|diagnostic/i);
    await user.click(screen.getByRole("button", { name: "Retry shared visual" }));

    expect(
      await screen.findByRole("img", {
        name: "A hand-drawn route from the mill to the hill caves",
      }),
    ).toBeVisible();
    expect(artifactMocks.fetchArtifactBlob).toHaveBeenCalledTimes(2);
  });

  it("keeps a correction draft and refreshes current truth after a stale write", async () => {
    const user = userEvent.setup();
    mocks.reviseBlackboardEntry.mockRejectedValue(
      new ApiRequestError("Blackboard changed. Refresh and review.", 409),
    );

    render(<BlackboardWorkspace campaignId="campaign-1" isGameMaster />);
    await screen.findByRole("heading", { name: "Blackboard" });
    await user.click(screen.getByRole("button", { name: "Open Bell signal" }));
    await user.click(screen.getByRole("button", { name: "Correct this entry" }));
    expect(screen.getByRole("heading", { name: "Correct this reference" })).toHaveFocus();
    const fact = screen.getByLabelText("Clue or fact");
    await user.clear(fact);
    await user.type(fact, "The bell now rings three times.");
    await user.click(screen.getByRole("button", { name: "Share correction" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("changed elsewhere");
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByDisplayValue("The bell now rings three times.")).toBeVisible();
    expect(mocks.loadBlackboard).toHaveBeenCalledTimes(2);
  });

  it("replaces removed content with a safe tombstone and does not render prior facts", async () => {
    const user = userEvent.setup();
    const removedBoard: BlackboardCommonDto = {
      catalogue: board.catalogue.filter((entry) => entry.id !== "entry-clue"),
      layout: board.layout,
      tombstones: [
        {
          id: "entry-clue",
          removedAt: "2026-08-28T09:00:00.000Z",
          removedByLabel: "Ari",
          state: "Removed",
        },
      ],
    };
    mocks.retractBlackboardEntry.mockResolvedValue(removedBoard.tombstones[0]);
    mocks.loadBlackboard
      .mockResolvedValueOnce(structuredClone(board))
      .mockResolvedValueOnce(removedBoard);

    const { container } = render(
      <BlackboardWorkspace campaignId="campaign-1" isGameMaster={false} />,
    );
    await screen.findByRole("heading", { name: "Blackboard" });
    await user.click(screen.getByRole("button", { name: "Open Bell signal" }));
    await user.click(screen.getByRole("button", { name: "Remove this entry" }));
    const dialog = screen.getByRole("alertdialog", { name: "Remove reference" });
    await user.click(within(dialog).getByRole("button", { name: "Remove reference" }));

    expect(await screen.findByRole("heading", { name: "Removed reference" })).toBeVisible();
    expect(container).not.toHaveTextContent("The bronze bell rings twice");
    expect(container).toHaveTextContent("former content and history are no longer shared");
  });
});
