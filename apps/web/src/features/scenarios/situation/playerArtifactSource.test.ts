import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadArtifacts: vi.fn() }));

vi.mock("@/lib/api/localServiceClient", async (loadOriginal) => ({
  ...(await loadOriginal()),
  artifactContentUrl: (_campaignId: string, artifactId: string) => `/content/${artifactId}`,
  loadArtifacts: mocks.loadArtifacts,
}));

import { loadSituationArtifacts } from "./playerArtifactSource";

beforeEach(() => vi.clearAllMocks());

describe("Situation Artifacts rail data source", () => {
  it("reads the existing projection unchanged and adds no filter of its own", async () => {
    mocks.loadArtifacts.mockResolvedValue({
      artifacts: [
        {
          artifactKind: "map",
          campaignId: "campaign-1",
          id: "artifact-1",
          mediaType: "image/png",
          title: "Northern pass",
        },
        {
          artifactKind: "handout",
          campaignId: "campaign-1",
          id: "artifact-2",
          mediaType: "application/pdf",
          title: "Ledger page",
        },
      ],
      mode: "viewer",
    });

    const artifacts = await loadSituationArtifacts("campaign-1");

    expect(mocks.loadArtifacts).toHaveBeenCalledWith("campaign-1");
    expect(artifacts.map((artifact) => artifact.id)).toEqual(["artifact-1", "artifact-2"]);
    expect(artifacts[0]).toMatchObject({ isImage: true });
    expect(artifacts[1]).toMatchObject({ isImage: false });
  });

  it("narrows to the fields the rail renders and carries no management metadata", async () => {
    mocks.loadArtifacts.mockResolvedValue({
      artifacts: [
        {
          artifactKind: "map",
          audience: "gm_private",
          campaignId: "campaign-1",
          digest: "a".repeat(64),
          id: "artifact-1",
          lifecycle: "active",
          mediaType: "image/png",
          metadataVersion: 3,
          storageState: "ready",
          title: "Northern pass",
        },
      ],
      mode: "gm",
      references: [],
    });

    const [artifact] = await loadSituationArtifacts("campaign-1");

    expect(artifact).not.toHaveProperty("audience");
    expect(artifact).not.toHaveProperty("digest");
    expect(artifact).not.toHaveProperty("lifecycle");
    expect(artifact).not.toHaveProperty("metadataVersion");
    expect(artifact).not.toHaveProperty("storageState");
    expect(JSON.stringify(artifact)).not.toContain("gm_private");
  });
});
