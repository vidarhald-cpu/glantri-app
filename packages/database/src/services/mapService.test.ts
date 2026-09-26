import { describe, expect, it, vi } from "vitest";

import { CampaignMapNotFoundError } from "../repositories/mapRepository";
import { CampaignMapService } from "./mapService";

const now = new Date("2026-09-17T10:00:00.000Z");

function record() {
  return {
    access: "players" as const,
    backgroundArtifactId: "artifact-private",
    campaignId: "campaign-1",
    createdAt: now,
    description: "The old roads",
    id: "map-1",
    layers: [
      {
        id: "public-layer",
        markers: [
          {
            description: "Shared face, private source",
            destinationMapId: null,
            entityLabelSnapshot: "Secret source label",
            entityReferenceId: "entity-private",
            entityReferenceType: "reusable_entity" as const,
            id: "public-entity",
            kind: "entity_reference" as const,
            label: "The Watcher",
            presentation: "W",
            sortOrder: 0,
            visibility: "inherit" as const,
            x: 0.2,
            y: 0.3,
          },
          {
            description: "",
            destinationMapId: null,
            entityLabelSnapshot: null,
            entityReferenceId: null,
            entityReferenceType: null,
            id: "hidden-on-public",
            kind: "annotation" as const,
            label: "Hidden patrol",
            presentation: "pin",
            sortOrder: 1,
            visibility: "gm_only" as const,
            x: 0.4,
            y: 0.5,
          },
        ],
        name: "Known places",
        sortOrder: 0,
        visibility: "player_visible" as const,
      },
      {
        id: "secret-layer",
        markers: [
          {
            description: "Discovered independently",
            destinationMapId: null,
            entityLabelSnapshot: null,
            entityReferenceId: null,
            entityReferenceType: null,
            id: "revealed-secret",
            kind: "annotation" as const,
            label: "The ruin",
            presentation: "R",
            sortOrder: 0,
            visibility: "player_visible" as const,
            x: 0.7,
            y: 0.8,
          },
        ],
        name: "GM Secrets",
        sortOrder: 1,
        visibility: "gm_only" as const,
      },
    ],
    name: "Borderlands",
    role: "world_region" as const,
    updatedAt: now,
    version: 4,
  };
}

describe("CampaignMapService projections", () => {
  it("projects the visibility hierarchy without external ids or hidden Layer facts", async () => {
    const repository = {
      get: vi.fn().mockResolvedValue(record()),
      getBackground: vi.fn().mockResolvedValue({
        altText: "Private map image",
        artifactKind: "map",
        audience: "gm_private",
        id: "artifact-private",
        lifecycleState: "active",
        storageState: "ready",
        title: "GM map",
      }),
      getCampaignOwner: vi.fn().mockResolvedValue("gm-1"),
      listShared: vi.fn().mockResolvedValue([{ id: "map-1" }]),
    };
    const campaigns = {
      listCampaignsByUserAccess: vi
        .fn()
        .mockResolvedValue([{ id: "campaign-1", status: "active" }]),
    };
    const service = new CampaignMapService(repository as never, campaigns as never);

    const result = await service.getForUser("campaign-1", "map-1", "player-1");

    expect(result.mode).toBe("player");
    expect(result.map).not.toHaveProperty("background");
    expect(JSON.stringify(result.map)).not.toContain("artifact-private");
    expect(JSON.stringify(result.map)).not.toContain("entity-private");
    expect(JSON.stringify(result.map)).not.toContain("Secret source label");
    expect(JSON.stringify(result.map)).not.toContain("GM Secrets");
    expect(JSON.stringify(result.map)).not.toContain("Hidden patrol");
    expect(result.map).toMatchObject({
      layers: [{ markers: [{ id: "public-entity", label: "The Watcher" }], name: "Known places" }],
      revealedMarkers: [{ id: "revealed-secret", label: "The ruin" }],
    });
  });

  it("fails a GM-only Map closed for an entitled player", async () => {
    const repository = {
      get: vi.fn().mockResolvedValue({ ...record(), access: "gm_only" }),
      getCampaignOwner: vi.fn().mockResolvedValue("gm-1"),
    };
    const campaigns = {
      listCampaignsByUserAccess: vi
        .fn()
        .mockResolvedValue([{ id: "campaign-1", status: "active" }]),
    };
    const service = new CampaignMapService(repository as never, campaigns as never);
    await expect(service.getForUser("campaign-1", "map-1", "player-1")).rejects.toBeInstanceOf(
      CampaignMapNotFoundError,
    );
  });

  it("does not let the Map background proxy bypass Artifact player visibility", async () => {
    const repository = {
      get: vi.fn().mockResolvedValue(record()),
      getBackground: vi.fn().mockResolvedValue({
        altText: "Private map image",
        artifactKind: "map",
        audience: "gm_private",
        id: "artifact-private",
        lifecycleState: "active",
        storageState: "ready",
      }),
      getCampaignOwner: vi.fn().mockResolvedValue("gm-1"),
    };
    const campaigns = {
      listCampaignsByUserAccess: vi
        .fn()
        .mockResolvedValue([{ id: "campaign-1", status: "active" }]),
    };
    const service = new CampaignMapService(repository as never, campaigns as never);

    await expect(
      service.getBackgroundArtifactIdForUser({
        campaignId: "campaign-1",
        mapId: "map-1",
        userId: "player-1",
      }),
    ).rejects.toBeInstanceOf(CampaignMapNotFoundError);

    repository.getBackground.mockResolvedValue({
      altText: "Shared map image",
      artifactKind: "map",
      audience: "campaign",
      id: "artifact-private",
      lifecycleState: "active",
      storageState: "ready",
    });
    await expect(
      service.getBackgroundArtifactIdForUser({
        campaignId: "campaign-1",
        mapId: "map-1",
        userId: "player-1",
      }),
    ).resolves.toBe("artifact-private");
  });

  it("SYNTHETIC (fixture-shaped): refuses a residual or unrecognised Artifact audience for a player", async () => {
    // Acceptance criteria 7 and 8 for the Map-background read path
    // (mapService.getBackgroundArtifactIdForUser). Both audience values are
    // **synthetic by construction**: no writable V1 path can produce either
    // once the third state is retired, so they are supplied directly.
    const repository = {
      get: vi.fn().mockResolvedValue(record()),
      getBackground: vi.fn(),
      getCampaignOwner: vi.fn().mockResolvedValue("gm-1"),
    };
    const campaigns = {
      listCampaignsByUserAccess: vi
        .fn()
        .mockResolvedValue([{ id: "campaign-1", status: "active" }]),
    };
    const service = new CampaignMapService(repository as never, campaigns as never);

    for (const audience of ["scenario", "player", "PUBLIC", "", "campaign_players"]) {
      repository.getBackground.mockResolvedValue({
        altText: "Residual map image",
        artifactKind: "map",
        audience,
        id: "artifact-residual",
        lifecycleState: "active",
        storageState: "ready",
      });
      await expect(
        service.getBackgroundArtifactIdForUser({
          campaignId: "campaign-1",
          mapId: "map-1",
          userId: "player-1",
        }),
      ).rejects.toBeInstanceOf(CampaignMapNotFoundError);
    }
  });
});
