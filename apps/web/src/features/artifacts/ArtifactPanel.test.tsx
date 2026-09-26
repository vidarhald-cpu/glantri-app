// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api/apiClient";

import { ArtifactPanel } from "./ArtifactPanel";

vi.mock("@/lib/api/artifactClient", async (loadOriginal) => ({
  ...(await loadOriginal()),
  listArtifactImports: vi.fn().mockResolvedValue([]),
}));

const mocks = vi.hoisted(() => ({
  deleteArtifact: vi.fn(),
  loadArtifacts: vi.fn(),
  mutateScenarioArtifact: vi.fn(),
  retryArtifactCleanup: vi.fn(),
  setArtifactAudience: vi.fn(),
  setArtifactLifecycle: vi.fn(),
  updateArtifactMetadata: vi.fn(),
}));

vi.mock("@/lib/api/localServiceClient", async (loadOriginal) => ({
  ...(await loadOriginal()),
  artifactContentUrl: (_campaignId: string, artifactId: string) => `/content/${artifactId}`,
  deleteArtifact: mocks.deleteArtifact,
  loadArtifacts: mocks.loadArtifacts,
  mutateScenarioArtifact: mocks.mutateScenarioArtifact,
  retryArtifactCleanup: mocks.retryArtifactCleanup,
  setArtifactAudience: mocks.setArtifactAudience,
  setArtifactLifecycle: mocks.setArtifactLifecycle,
  updateArtifactMetadata: mocks.updateArtifactMetadata,
}));

const managedArtifact = {
  altText: "A mountain pass map",
  artifactKind: "map" as const,
  audience: "gm_private" as const,
  byteSize: 12,
  campaignId: "campaign-1",
  cleanupRequired: false,
  createdAt: "2026-08-24T00:00:00.000Z",
  digest: "a".repeat(64),
  id: "artifact-1",
  legacyNeedsUpload: false,
  lifecycle: "active" as const,
  mediaType: "image/png" as const,
  metadataVersion: 1,
  provenanceKind: "user_upload" as const,
  storageState: "ready" as const,
  title: "Northern pass",
  updatedAt: "2026-08-24T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadArtifacts.mockResolvedValue({
    artifacts: [managedArtifact],
    mode: "gm",
    references: [],
  });
});

describe("ArtifactPanel", () => {
  it("renders only player-safe shared presentation for a viewer", async () => {
    mocks.loadArtifacts.mockResolvedValue({
      artifacts: [
        {
          altText: "The pass",
          artifactKind: "map",
          campaignId: "campaign-1",
          id: "artifact-1",
          mediaType: "image/png",
          title: "Shared pass map",
        },
      ],
      mode: "viewer",
    });
    render(<ArtifactPanel campaignId="campaign-1" scenarios={[]} />);
    expect(await screen.findByText("Shared pass map")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "The pass" })).toHaveAttribute(
      "src",
      "/content/artifact-1",
    );
    expect(screen.queryByText(/Private to GM/)).not.toBeInTheDocument();
    expect(screen.queryByText(/digest|storage|filename/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /share with|withdraw|attach privately|retire|restore|edit details/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("offers exactly two access filter values and a removable active-filter chip", async () => {
    // The canonical two-state Artifact filters remain available in standalone mode.
    mocks.loadArtifacts.mockResolvedValue({
      artifacts: [
        managedArtifact,
        { ...managedArtifact, audience: "campaign", id: "artifact-2", title: "Shared plaza" },
      ],
      mode: "gm",
      references: [],
    });
    render(<ArtifactPanel campaignId="campaign-1" scenarios={[]} />);
    const access = await screen.findByLabelText(/^Access/);
    expect([...(access as HTMLSelectElement).options].map((option) => option.value)).toEqual([
      "",
      "gm_private",
      "campaign",
    ]);

    await userEvent.selectOptions(access, "campaign");
    expect(screen.getByText("Shared plaza")).toBeInTheDocument();
    expect(screen.queryByText("Northern pass")).not.toBeInTheDocument();

    const chip = screen.getByRole("button", {
      name: /Access: Shared with Campaign players — remove filter/,
    });
    await userEvent.click(chip);
    expect(screen.getByText("Northern pass")).toBeInTheDocument();
    expect(screen.getByText("Shared plaza")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove filter/ })).not.toBeInTheDocument();

    await userEvent.selectOptions(access, "gm_private");
    expect(screen.getByText("Northern pass")).toBeInTheDocument();
    expect(screen.queryByText("Shared plaza")).not.toBeInTheDocument();
  });

  it("never renders a third access state for any Artifact", async () => {
    // Acceptance criterion 6. The DTO is already resolved fail-closed at the
    // persistence boundary, so the surface has exactly two labels.
    mocks.loadArtifacts.mockResolvedValue({
      artifacts: [
        managedArtifact,
        { ...managedArtifact, audience: "campaign", id: "artifact-2", title: "Shared plaza" },
      ],
      mode: "gm",
      references: [],
    });
    const { container } = render(<ArtifactPanel campaignId="campaign-1" scenarios={[]} />);
    expect(await screen.findByText("Northern pass")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Scenario sharing/);
    expect(container.textContent).toMatch(/Private to GM/);
    expect(container.textContent).toMatch(/Shared with Campaign/);
  });

  it("shows legacy recovery without fetching or rendering the old URL", async () => {
    mocks.loadArtifacts.mockResolvedValue({
      artifacts: [
        {
          ...managedArtifact,
          id: "legacy",
          legacyNeedsUpload: true,
          mediaType: undefined,
          storageState: "legacy_reference",
          title: "Old map",
        },
      ],
      mode: "gm",
      references: [],
    });
    render(<ArtifactPanel campaignId="campaign-1" scenarios={[]} />);
    expect(await screen.findByText(/re-upload required/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /pdf/i })).not.toBeInTheDocument();
  });

  it("offers the shared staged flow for one or many files and preserves Advanced package import", async () => {
    render(<ArtifactPanel campaignId="campaign-1" scenarios={[]} />);
    await screen.findByText("Northern pass");
    expect(screen.getByRole("region", { name: "Upload Artifacts" })).toBeVisible();
    expect(screen.getByLabelText("Files")).toHaveAttribute("multiple");
    expect(screen.getByText("Import Artifact package")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Upload privately" })).toBeNull();
  });

  it("inspects a shared image on the whole viewport and returns focus on exit", async () => {
    const user = userEvent.setup();
    render(<ArtifactPanel campaignId="campaign-1" scenarios={[]} />);

    const trigger = await screen.findByRole("button", { name: "Inspect Northern pass" });
    await user.click(trigger);

    const inspection = screen.getByRole("dialog", { name: "Northern pass" });
    expect(inspection).toHaveAttribute("aria-modal", "true");
    expect(inspection).toHaveTextContent("map · Private to GM");
    expect(screen.getByRole("group", { name: "Pan and zoom Artifact" })).toBeVisible();
    expect(screen.getAllByRole("img", { name: "A mountain pass map" })[1]).toHaveAttribute(
      "src",
      "/content/artifact-1?version=1",
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("offers only the safe download for a PDF, with no misleading full-screen inspection", async () => {
    mocks.loadArtifacts.mockResolvedValue({
      artifacts: [
        {
          ...managedArtifact,
          id: "handout-1",
          mediaType: "application/pdf",
          title: "Session notes",
        },
      ],
      mode: "gm",
      references: [],
    });
    render(<ArtifactPanel campaignId="campaign-1" scenarios={[]} />);
    await screen.findByText("Session notes");

    // The API deliberately refuses inline rendering of PDF Artifact content
    // (attachment disposition plus a `sandbox; default-src 'none'` CSP), so a
    // full-screen "Inspect" action for a PDF would only render a blank stage
    // and silently trigger a download. Only the plain download link remains.
    expect(screen.queryByRole("button", { name: /inspect/i })).not.toBeInTheDocument();
    const download = screen.getByRole("link", { name: "Download PDF safely" });
    expect(download).toHaveAttribute("href", "/content/handout-1");
    expect(download).toHaveAttribute("target", "_blank");
  });

  it("refreshes instead of restoring stale publication state", async () => {
    const user = userEvent.setup();
    mocks.setArtifactAudience.mockRejectedValue(
      new ApiRequestError("Artifact changed. Refresh and review.", 409),
    );
    render(<ArtifactPanel campaignId="campaign-1" scenarios={[]} />);
    await user.click(await screen.findByRole("button", { name: "Share with Campaign" }));
    expect(await screen.findByText(/current state has been refreshed/i)).toBeInTheDocument();
    expect(mocks.loadArtifacts).toHaveBeenCalledTimes(2);
  });

  it("reuses one Artifact card in the Inspector with Scenario associations read-only", async () => {
    mocks.loadArtifacts.mockResolvedValue({
      artifacts: [managedArtifact, { ...managedArtifact, id: "other", title: "Other Artifact" }],
      mode: "gm",
      references: [
        {
          id: "ref-1",
          artifactId: managedArtifact.id,
          scenarioId: "scenario-1",
          state: "attached",
          version: 1,
          title: managedArtifact.title,
        },
      ],
    });
    render(
      <ArtifactPanel
        campaignId="campaign-1"
        focusedArtifactId="artifact-1"
        readOnlyAssociations
        scenarios={[{ id: "scenario-1", name: "Northern route", status: "draft" } as never]}
      />,
    );
    expect(await screen.findByText("Northern pass")).toBeInTheDocument();
    expect(screen.queryByText("Other Artifact")).not.toBeInTheDocument();
    expect(screen.getByText(/Northern route · attached/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Attach privately" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Find Artifacts")).not.toBeInTheDocument();
  });
});
