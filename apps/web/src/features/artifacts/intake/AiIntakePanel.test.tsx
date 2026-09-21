// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactImportPreview } from "@glantri/domain";

import { AiIntakePanel } from "./AiIntakePanel";

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

const staged: ArtifactImportPreview = {
  id: "intake-1",
  title: "AI intake: Iron Key",
  state: "review",
  previewToken: "token",
  valid: true,
  items: [
    {
      id: "item-1",
      title: "Iron Key",
      selected: true,
      optional: true,
      status: "create",
      reasons: [],
      objectType: "Item",
      gmNotes: "Kept on a thong around the gaoler's neck.",
    },
  ],
};

const context = JSON.stringify({
  format: "glantri-intake",
  version: 1,
  entries: [
    { represents: "item", title: "Iron Key", gmNotes: "Kept on a thong around the gaoler's neck." },
  ],
});

describe("AiIntakePanel", () => {
  beforeEach(() => {
    mocks.accept.mockReset();
    mocks.cleanup.mockReset().mockResolvedValue({ cleanupPending: false });
    mocks.review.mockReset();
    mocks.stage.mockReset().mockResolvedValue(staged);
  });

  it("refuses a malformed paste visibly and stages nothing", async () => {
    render(<AiIntakePanel campaignId="campaign-1" onAccepted={async () => {}} />);
    await userEvent.type(screen.getByLabelText("Pasted context"), '{{"format": "glantri-int');
    await userEvent.click(screen.getByRole("button", { name: /Validate and stage/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not valid JSON");
    expect(mocks.stage).not.toHaveBeenCalled();
  });

  it("stages a proposal and shows what would be created, having created nothing", async () => {
    render(<AiIntakePanel campaignId="campaign-1" onAccepted={async () => {}} />);
    const textarea = screen.getByLabelText("Pasted context");
    await userEvent.click(textarea);
    await userEvent.paste(context);
    await userEvent.click(screen.getByRole("button", { name: /Validate and stage/ }));

    await waitFor(() => expect(mocks.stage).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/nothing exists in the Campaign yet/)).toBeInTheDocument();
    expect(screen.getByText(/Canonical Item/)).toBeInTheDocument();
    expect(screen.getByText(/never player-facing/)).toBeInTheDocument();

    const manifest = mocks.stage.mock.calls[0]![1] as { objects: Array<{ type: string }> };
    expect(manifest.objects.map((object) => object.type)).toEqual(["Item"]);
  });

  it("abandons a staged proposal through the private cleanup path", async () => {
    render(<AiIntakePanel campaignId="campaign-1" onAccepted={async () => {}} />);
    const textarea = screen.getByLabelText("Pasted context");
    await userEvent.click(textarea);
    await userEvent.paste(context);
    await userEvent.click(screen.getByRole("button", { name: /Validate and stage/ }));
    await waitFor(() => expect(mocks.stage).toHaveBeenCalledTimes(1));

    expect(
      screen.getByRole("button", { name: "Confirm and create selected content" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Abandon this proposal" }));
    await waitFor(() => expect(mocks.cleanup).toHaveBeenCalledWith("campaign-1", "intake-1"));
    expect(await screen.findByRole("status")).toHaveTextContent("Nothing was created");
  });
});
