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
});
