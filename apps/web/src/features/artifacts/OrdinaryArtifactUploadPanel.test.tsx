// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactImportPreview } from "@glantri/domain";
import { OrdinaryArtifactUploadPanel } from "./OrdinaryArtifactUploadPanel";

const mocks = vi.hoisted(() => ({
  accept: vi.fn(),
  cleanup: vi.fn(),
  review: vi.fn(),
  stage: vi.fn(),
}));

vi.mock("@/lib/api/artifactClient", () => ({
  acceptArtifactImport: mocks.accept,
  artifactImportResourceUrl: () => "/private-preview",
  cleanupArtifactImport: mocks.cleanup,
  reviewArtifactImport: mocks.review,
  stageArtifactPackage: mocks.stage,
}));

const preview = (count: number): ArtifactImportPreview => ({
  id: "ordinary-import",
  title: count === 1 ? "Artifact upload" : `${count} Artifact uploads`,
  state: "review",
  previewToken: "review-token",
  valid: true,
  items: Array.from({ length: count }, (_, index) => ({
    id: `artifact-${index + 1}`,
    title: index === 0 ? "Old gatehouse" : "Session notes",
    selected: true,
    optional: false,
    status: "create" as const,
    reasons: [],
    warnings:
      index === 0
        ? [
            "The file matches an existing Artifact. Accepting will still create a separate Artifact.",
          ]
        : [],
    resourceId: `resource-${index + 1}`,
  })),
});

function selectedFile(bytes: Uint8Array, name: string, type: string) {
  const arrayBuffer = bytes.slice().buffer as ArrayBuffer;
  const file = new File([arrayBuffer], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => arrayBuffer,
  });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  let uuid = 0;
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => `11111111-1111-4111-8111-${String(++uuid).padStart(12, "0")}`),
    subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(0xab).buffer) },
  });
  mocks.cleanup.mockResolvedValue({ cleanupPending: false });
  mocks.stage.mockImplementation(async (_campaign, manifest) => preview(manifest.objects.length));
});

describe("ordinary Artifact upload", () => {
  it("keeps one file simple while deriving technical package data and leaving semantics editable", async () => {
    const file = selectedFile(new Uint8Array([1, 2, 3]), "old_gatehouse.png", "image/png");
    render(<OrdinaryArtifactUploadPanel campaignId="campaign" onAccepted={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Files"), { target: { files: [file] } });

    expect(await screen.findByLabelText("Title for old_gatehouse.png")).toHaveValue(
      "old gatehouse",
    );
    expect(screen.getByLabelText("Kind for old_gatehouse.png")).toHaveValue("image");
    expect(screen.getByLabelText(/Alt text for old_gatehouse.png/)).toHaveValue("");
    await userEvent.selectOptions(screen.getByLabelText("Kind for old_gatehouse.png"), "portrait");
    await userEvent.clear(screen.getByLabelText("Title for old_gatehouse.png"));
    await userEvent.type(screen.getByLabelText("Title for old_gatehouse.png"), "Old gatehouse");
    await userEvent.click(screen.getByRole("button", { name: "Validate and preview" }));

    await waitFor(() => expect(mocks.stage).toHaveBeenCalledTimes(1));
    const [, manifest, files] = mocks.stage.mock.calls[0]!;
    expect(manifest).toMatchObject({
      producer: "glantri-app/ordinary-upload",
      resources: [{ id: "resource-1", mediaType: "image/png", sha256: "ab".repeat(32) }],
      objects: [
        {
          id: "artifact-1",
          resourceId: "resource-1",
          metadata: {
            artifactKind: "portrait",
            provenanceKind: "user_upload",
            title: "Old gatehouse",
          },
        },
      ],
    });
    expect(manifest.objects[0]).not.toHaveProperty("sourceId");
    expect(manifest.objects[0]).not.toHaveProperty("targetArtifactId");
    expect(files["resource-1"]).toBe(file);
    expect(screen.getByText(/matches an existing Artifact/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Accept selected Artifacts" })).toBeEnabled();
  });

  it("stages multiple loose files independently and accepts them together with optional alt text", async () => {
    const accepted = vi.fn().mockResolvedValue(undefined);
    const files = [
      selectedFile(new Uint8Array([1]), "old-gatehouse.webp", "image/webp"),
      selectedFile(new Uint8Array([2]), "session-notes.pdf", "application/pdf"),
    ];
    mocks.accept.mockResolvedValue({
      ...preview(2),
      state: "accepted",
      result: { "artifact-1": "created-1", "artifact-2": "created-2" },
    });
    render(<OrdinaryArtifactUploadPanel campaignId="campaign" onAccepted={accepted} />);
    fireEvent.change(screen.getByLabelText("Files"), { target: { files } });

    expect(await screen.findByLabelText("Kind for old-gatehouse.webp")).toHaveValue("image");
    expect(screen.getByLabelText("Kind for session-notes.pdf")).toHaveValue("document");
    await userEvent.click(screen.getByRole("button", { name: "Validate and preview" }));
    expect(await screen.findByText("2 Artifact uploads")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Accept selected Artifacts" }));

    await waitFor(() => expect(accepted).toHaveBeenCalledTimes(1));
    expect(mocks.accept).toHaveBeenCalledWith("campaign", expect.anything(), []);
    expect(await screen.findByText(/Accepted: 2 Artifacts/)).toBeVisible();
    const manifest = mocks.stage.mock.calls[0]![1];
    expect(manifest.objects).toHaveLength(2);
    expect(manifest.objects.every((item: object) => !("sourceId" in item))).toBe(true);
    expect(manifest.objects[1].metadata.altText).toBeUndefined();
  });

  it("invalidates and cleans staged bytes when semantic metadata changes after review", async () => {
    const file = selectedFile(new Uint8Array([1]), "portrait.jpg", "image/jpeg");
    render(<OrdinaryArtifactUploadPanel campaignId="campaign" onAccepted={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Files"), { target: { files: [file] } });
    await screen.findByLabelText("Title for portrait.jpg");
    await userEvent.click(screen.getByRole("button", { name: "Validate and preview" }));
    expect(await screen.findByRole("button", { name: "Accept selected Artifacts" })).toBeVisible();

    await userEvent.type(
      screen.getByLabelText("Description for portrait.jpg (optional)"),
      "Captain",
    );
    await waitFor(() => expect(mocks.cleanup).toHaveBeenCalledWith("campaign", "ordinary-import"));
    expect(screen.queryByRole("button", { name: "Accept selected Artifacts" })).toBeNull();
    expect(screen.getByRole("button", { name: "Validate and preview" })).toBeEnabled();
  });
});
