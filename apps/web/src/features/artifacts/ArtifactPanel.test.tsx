// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api/apiClient";

import { ArtifactPanel } from "./ArtifactPanel";

const mocks = vi.hoisted(() => ({
  deleteArtifact: vi.fn(),
  loadArtifacts: vi.fn(),
  mutateScenarioArtifact: vi.fn(),
  retryArtifactCleanup: vi.fn(),
  setArtifactAudience: vi.fn(),
  setArtifactLifecycle: vi.fn(),
  updateArtifactMetadata: vi.fn(),
  uploadArtifact: vi.fn(),
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
  uploadArtifact: mocks.uploadArtifact,
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
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument();
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

  it("validates uploads client-side and reports streaming progress", async () => {
    const user = userEvent.setup();
    mocks.uploadArtifact.mockImplementation(async (input) => {
      input.onProgress?.(65);
      return managedArtifact;
    });
    render(<ArtifactPanel campaignId="campaign-1" scenarios={[]} />);
    await screen.findByText("Northern pass");
    await user.type(screen.getByLabelText("Title"), "New map");
    const file = new File([Buffer.from("89504e470d0a1a0a", "hex")], "map.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("File"), { target: { files: [file] } });
    await user.click(screen.getByRole("button", { name: "Upload privately" }));
    await waitFor(() => expect(mocks.uploadArtifact).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/uploaded privately/i)).toBeInTheDocument();
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
