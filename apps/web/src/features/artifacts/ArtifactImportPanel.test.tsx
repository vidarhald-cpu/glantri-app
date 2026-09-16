// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactImportPreview } from "@glantri/domain";
import { ArtifactImportReview } from "./ArtifactImportPanel";
const mocks = vi.hoisted(() => ({ accept: vi.fn(), review: vi.fn() }));
vi.mock("@/lib/api/artifactClient", () => ({
  acceptArtifactImport: mocks.accept,
  reviewArtifactImport: mocks.review,
  artifactImportResourceUrl: () => "/private-preview",
}));
const preview: ArtifactImportPreview = {
  id: "import",
  title: "Portraits",
  state: "review",
  previewToken: "old",
  valid: true,
  items: [
    { id: "a", title: "Captain", selected: true, optional: false, status: "update", reasons: [] },
    {
      id: "b",
      title: "Optional seal",
      selected: true,
      optional: true,
      status: "create",
      reasons: [],
    },
  ],
};
beforeEach(() => vi.clearAllMocks());
describe("Artifact review decisions", () => {
  it("requires per-update approval and clears it after changed subset validation", async () => {
    mocks.review.mockResolvedValue({
      ...preview,
      previewToken: "new",
      items: [preview.items[0], { ...preview.items[1], selected: false }],
    });
    render(<ArtifactImportReview campaignId="campaign" initial={preview} onAccepted={vi.fn()} />);
    const accept = screen.getByRole("button", { name: "Accept selected Artifacts" });
    expect(accept).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Approve updating Captain/));
    expect(accept).toBeEnabled();
    fireEvent.click(screen.getByLabelText("Optional seal"));
    await waitFor(() => expect(mocks.review).toHaveBeenCalledWith("campaign", "import", ["a"]));
    expect(screen.getByLabelText(/Approve updating Captain/)).not.toBeChecked();
    expect(accept).toBeDisabled();
  });
  it("preserves review after recoverable failure and shows durable acceptance result", async () => {
    const accepted = vi.fn().mockResolvedValue(undefined);
    mocks.accept
      .mockRejectedValueOnce(new Error("Storage is temporarily unavailable"))
      .mockResolvedValue({ ...preview, state: "accepted", result: { a: "artifact" } });
    render(<ArtifactImportReview campaignId="campaign" initial={preview} onAccepted={accepted} />);
    fireEvent.click(screen.getByLabelText(/Approve updating Captain/));
    fireEvent.click(screen.getByRole("button", { name: "Accept selected Artifacts" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Storage is temporarily unavailable",
    );
    expect(screen.getByLabelText(/Approve updating Captain/)).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Accept selected Artifacts" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Accepted: 1 Artifacts");
    expect(accepted).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Updated/)).toBeVisible();
    expect(screen.queryByText(/Update candidate/)).not.toBeInTheDocument();
  });
});
