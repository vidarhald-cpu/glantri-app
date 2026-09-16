// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactImportPreview } from "@glantri/domain";
import { ArtifactImportPanel, ArtifactImportReview } from "./ArtifactImportPanel";
const mocks = vi.hoisted(() => ({
  accept: vi.fn(),
  review: vi.fn(),
  stage: vi.fn(),
  history: vi.fn(),
}));
vi.mock("@/lib/api/artifactClient", () => ({
  acceptArtifactImport: mocks.accept,
  stageArtifactPackage: mocks.stage,
  listArtifactImports: mocks.history,
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
beforeEach(() => {
  vi.clearAllMocks();
  mocks.history.mockResolvedValue([]);
  mocks.stage.mockResolvedValue(preview);
});
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

const manifest = {
  schemaVersion: 1,
  producer: "test",
  packageId: "portraits",
  version: "1",
  title: "Portraits",
  resources: [{ id: "image", mediaType: "image/jpeg", sha256: "a".repeat(64) }],
  objects: [
    {
      id: "a",
      type: "Artifact",
      sourceId: "captain",
      resourceId: "image",
      metadata: { title: "Captain", artifactKind: "image", altText: "Captain" },
    },
  ],
};
function chooseManifest(text: string | Promise<string>) {
  const file = new File(["manifest"], "package.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
  fireEvent.change(screen.getByLabelText("Package manifest"), { target: { files: [file] } });
}
async function approvedPanel() {
  render(<ArtifactImportPanel campaignId="campaign" onAccepted={vi.fn()} />);
  chooseManifest(JSON.stringify(manifest));
  const resource = await screen.findByLabelText("Resource: image");
  fireEvent.change(resource, { target: { files: [new File(["one"], "one.jpg")] } });
  fireEvent.click(screen.getByRole("button", { name: "Validate and preview package" }));
  fireEvent.click(await screen.findByLabelText(/Approve updating Captain/));
  expect(screen.getByRole("button", { name: "Accept selected Artifacts" })).toBeEnabled();
  return resource;
}
describe("Package input review binding", () => {
  it("invalidates approvals on replacement and clearing, and requires a fresh preview", async () => {
    const resource = await approvedPanel();
    const replacement = new File(["two"], "two.jpg");
    fireEvent.change(resource, { target: { files: [replacement] } });
    expect(screen.queryByRole("button", { name: "Accept selected Artifacts" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Validate and preview package" }));
    expect(await screen.findByLabelText(/Approve updating Captain/)).not.toBeChecked();
    expect(mocks.stage).toHaveBeenLastCalledWith("campaign", expect.anything(), {
      image: replacement,
    });
    expect(screen.getByRole("button", { name: "Accept selected Artifacts" })).toBeDisabled();
    fireEvent.change(resource, { target: { files: [] } });
    expect(screen.queryByRole("button", { name: "Accept selected Artifacts" })).toBeNull();
    expect(screen.getByRole("button", { name: "Validate and preview package" })).toBeDisabled();
    expect(mocks.accept).not.toHaveBeenCalled();
  });
  it("clears the old review immediately while parsing and after invalid or cleared manifests", async () => {
    await approvedPanel();
    let resolve!: (text: string) => void;
    chooseManifest(
      new Promise<string>((done) => {
        resolve = done;
      }),
    );
    expect(screen.queryByRole("button", { name: "Accept selected Artifacts" })).toBeNull();
    expect(screen.getByRole("button", { name: "Validate and preview package" })).toBeDisabled();
    resolve("invalid json");
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a valid Artifact package");
    expect(screen.queryByLabelText("Resource: image")).toBeNull();
    chooseManifest(JSON.stringify(manifest));
    await screen.findByLabelText("Resource: image");
    fireEvent.change(screen.getByLabelText("Package manifest"), { target: { files: [] } });
    expect(screen.queryByLabelText("Resource: image")).toBeNull();
    expect(mocks.accept).not.toHaveBeenCalled();
  });
  it("does not resurrect a previous manifest when asynchronous reads finish out of order", async () => {
    render(<ArtifactImportPanel campaignId="campaign" onAccepted={vi.fn()} />);
    let resolve!: (text: string) => void;
    chooseManifest(
      new Promise<string>((done) => {
        resolve = done;
      }),
    );
    chooseManifest("invalid json");
    await screen.findByRole("alert");
    resolve(JSON.stringify(manifest));
    await waitFor(() => expect(screen.queryByLabelText("Resource: image")).toBeNull());
    expect(screen.getByRole("button", { name: "Validate and preview package" })).toBeDisabled();
  });
  it("removes the previous approved review before a replacement validation fails", async () => {
    await approvedPanel();
    mocks.stage.mockRejectedValueOnce(new Error("Digest mismatch"));
    fireEvent.click(screen.getByRole("button", { name: "Validate and preview package" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Digest mismatch");
    expect(screen.queryByRole("button", { name: "Accept selected Artifacts" })).toBeNull();
    expect(mocks.accept).not.toHaveBeenCalled();
  });
});
