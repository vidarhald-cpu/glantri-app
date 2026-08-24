import { describe, expect, it, vi } from "vitest";

import type { ArtifactBinaryStore } from "../artifacts/artifactBinaryStore";
import type { ArtifactRecord, ArtifactRepository } from "../repositories/artifactRepository";
import { ArtifactNotFoundError, ArtifactService } from "./artifactService";

const now = new Date("2026-08-24T08:00:00.000Z");

function artifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    altText: "A mountain pass",
    artifactKind: "map",
    audience: "gm_private",
    byteSize: 12n,
    campaignId: "campaign-1",
    createdAt: now,
    description: "Private map",
    id: "artifact-1",
    lifecycleState: "active",
    mediaTypeDetected: "image/png",
    metadataVersion: 1,
    originalFilename: "pass.png",
    provenanceKind: "user_upload",
    sha256Digest: "a".repeat(64),
    sourceLabel: null,
    sourceUri: null,
    storageDeletePending: false,
    storageKey: "b".repeat(32),
    storageProvider: "local",
    storageState: "ready",
    title: "Northern pass",
    updatedAt: now,
    ...overrides,
  };
}

function serviceWith(input: {
  owner?: string | null;
  records?: ArtifactRecord[];
}): ArtifactService {
  const repository = {
    getCampaignOwner: vi.fn().mockResolvedValue(input.owner ?? null),
    listBlackboardCandidates: vi.fn().mockResolvedValue(input.records ?? []),
    listForCampaign: vi.fn().mockResolvedValue(input.records ?? []),
  } as unknown as ArtifactRepository;
  const store = { provider: "local" } as ArtifactBinaryStore;
  return new ArtifactService(store, repository);
}

describe("ArtifactService projections", () => {
  it("maps owning-GM metadata without any binary locator", async () => {
    const service = serviceWith({ owner: "gm-1", records: [artifact()] });
    const [dto] = await service.listForGm("campaign-1", "gm-1");
    expect(dto).toMatchObject({
      cleanupRequired: false,
      digest: "a".repeat(64),
      legacyNeedsUpload: false,
      title: "Northern pass",
    });
    expect(dto).not.toHaveProperty("storageKey");
    expect(dto).not.toHaveProperty("storageProvider");
  });

  it("returns only ready nondeleted common metadata in an owning-GM preview", async () => {
    const service = serviceWith({
      owner: "gm-1",
      records: [artifact(), artifact({ id: "failed", storageState: "failed" })],
    });
    const visible = await service.listVisible("campaign-1", "gm-1");
    expect(visible).toEqual([
      expect.objectContaining({ id: "artifact-1", mediaType: "image/png" }),
    ]);
    expect(visible[0]).not.toHaveProperty("digest");
    expect(visible[0]).not.toHaveProperty("originalFilename");
  });

  it("uses privacy-equivalent absence for a non-owner GM projection", async () => {
    const service = serviceWith({ owner: "gm-1", records: [artifact()] });
    await expect(service.listForGm("campaign-1", "foreign-gm")).rejects.toBeInstanceOf(
      ArtifactNotFoundError,
    );
  });

  it("exposes only active Campaign-visible map/image identity at the Blackboard boundary", async () => {
    const service = serviceWith({
      owner: "gm-1",
      records: [artifact({ audience: "campaign" })],
    });
    const candidates = await service.listBlackboardCandidates("campaign-1", "gm-1");
    expect(candidates).toEqual([
      {
        altText: "A mountain pass",
        artifactKind: "map",
        id: "artifact-1",
        mediaType: "image/png",
        title: "Northern pass",
      },
    ]);
  });
});
