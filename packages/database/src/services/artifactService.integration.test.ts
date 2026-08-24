import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { ArtifactBinaryStore } from "../artifacts/artifactBinaryStore";
import { ArtifactRepository } from "../repositories/artifactRepository";
import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { createTestCampaign, createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { ArtifactLifecycleError, ArtifactService } from "./artifactService";
import { CampaignService } from "./campaignService";
import { ScenarioService } from "./scenarioService";

const prisma = getTestPrismaClient();

async function* stream(chunks: Uint8Array[]) {
  yield* chunks;
}

class MemoryStore implements ArtifactBinaryStore {
  readonly provider = "local" as const;
  readonly objects = new Map<string, Buffer>();
  failDelete = false;
  failPutAfterPersist = false;

  async put(input: { content: AsyncIterable<Uint8Array>; key: string }) {
    const chunks: Buffer[] = [];
    for await (const chunk of input.content) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    this.objects.set(input.key, bytes);
    if (this.failPutAfterPersist) throw new Error("injected ambiguous put failure");
    const { createHash } = await import("node:crypto");
    return {
      byteSize: bytes.length,
      sha256Digest: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  async read(input: { key: string }) {
    const bytes = this.objects.get(input.key);
    if (!bytes) throw new Error("missing");
    return { byteSize: bytes.length, content: stream([bytes]) };
  }
  async stat(key: string) {
    const bytes = this.objects.get(key);
    if (!bytes) return null;
    const { createHash } = await import("node:crypto");
    return {
      byteSize: bytes.length,
      sha256Digest: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  async delete(key: string) {
    if (this.failDelete) throw new Error("injected delete failure");
    this.objects.delete(key);
  }
}

if (!prisma) {
  describe.skip("ArtifactService integration tests (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("ArtifactService integration", () => {
    beforeEach(async () => resetTestDatabase(prisma));
    afterAll(async () => resetTestDatabase(prisma));

    it("uploads privately with immutable integrity/provenance and owning-GM preview", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const store = new MemoryStore();
      const scenarioRepository = createPrismaScenarioRepository(prisma);
      const service = new ArtifactService(
        store,
        new ArtifactRepository(prisma),
        new CampaignService(scenarioRepository),
        new ScenarioService(scenarioRepository),
      );
      const png = Buffer.from("89504e470d0a1a0a00000000", "hex");

      const artifact = await service.upload({
        campaignId: campaign.id,
        content: stream([png]),
        declaredMediaType: "image/png",
        metadata: {
          altText: "A private mountain map",
          artifactKind: "map",
          provenanceKind: "generated",
          title: "Mountain pass",
        },
        originalFilename: "../../private\r\nmap.png",
        userId: gm.id,
      });

      expect(artifact).toMatchObject({
        audience: "gm_private",
        byteSize: png.length,
        lifecycle: "active",
        mediaType: "image/png",
        provenanceKind: "generated",
        storageState: "ready",
      });
      expect(artifact).not.toHaveProperty("storageKey");
      expect(artifact).not.toHaveProperty("storageUrl");
      const content = await service.readContent({
        artifactId: artifact.id,
        campaignId: campaign.id,
        userId: gm.id,
      });
      const chunks: Uint8Array[] = [];
      for await (const chunk of content.body.content) chunks.push(chunk);
      expect(Buffer.concat(chunks)).toEqual(png);
      expect(store.objects.size).toBe(1);
      expect(await service.listAudit(campaign.id, artifact.id, gm.id)).toHaveLength(1);
    });

    it("cleans an ambiguous put failure by known key and retains retry-safe cleanup state", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const store = new MemoryStore();
      const service = new ArtifactService(store, new ArtifactRepository(prisma));
      store.failPutAfterPersist = true;

      await expect(
        service.upload({
          campaignId: campaign.id,
          content: stream([Buffer.from("89504e470d0a1a0a00000000", "hex")]),
          declaredMediaType: "image/png",
          metadata: {
            altText: "A pass",
            artifactKind: "map",
            provenanceKind: "user_upload",
            title: "Ambiguous",
          },
          userId: gm.id,
        }),
      ).rejects.toThrow("ambiguous put failure");
      expect(store.objects.size).toBe(0);

      store.failDelete = true;
      await expect(
        service.upload({
          campaignId: campaign.id,
          content: stream([Buffer.from("89504e470d0a1a0a00000000", "hex")]),
          declaredMediaType: "image/png",
          metadata: {
            altText: "A pass",
            artifactKind: "map",
            provenanceKind: "user_upload",
            title: "Retry cleanup",
          },
          userId: gm.id,
        }),
      ).rejects.toThrow("ambiguous put failure");
      const failed = (await service.listForGm(campaign.id, gm.id)).find(
        (candidate) => candidate.title === "Retry cleanup",
      );
      expect(failed).toMatchObject({ cleanupRequired: true, storageState: "failed" });
      expect(store.objects.size).toBe(1);

      store.failDelete = false;
      store.failPutAfterPersist = false;
      await expect(
        service.retryCleanup({ artifactId: failed!.id, campaignId: campaign.id, userId: gm.id }),
      ).resolves.toMatchObject({ cleanupRequired: false });
      expect(store.objects.size).toBe(0);
    });

    it("rejects same-length content corruption using the immutable digest", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const store = new MemoryStore();
      const service = new ArtifactService(store, new ArtifactRepository(prisma));
      const bytes = Buffer.from("89504e470d0a1a0a00000000", "hex");
      const uploaded = await service.upload({
        campaignId: campaign.id,
        content: stream([bytes]),
        declaredMediaType: "image/png",
        metadata: {
          altText: "A pass",
          artifactKind: "map",
          provenanceKind: "user_upload",
          title: "Integrity",
        },
        userId: gm.id,
      });
      const [key] = store.objects.keys();
      store.objects.set(key!, Buffer.alloc(bytes.length, 7));

      await expect(
        service.readContent({
          artifactId: uploaded.id,
          campaignId: campaign.id,
          userId: gm.id,
        }),
      ).rejects.toThrow("temporarily unavailable");
    });

    it("keeps Campaign and Scenario publication independent and preserves visual alt text", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const scenario = await prisma.scenario.create({
        data: {
          campaignId: campaign.id,
          description: "",
          kind: "mixed",
          name: "The pass",
          status: "live",
        },
      });
      const store = new MemoryStore();
      const scenarioRepository = createPrismaScenarioRepository(prisma);
      const service = new ArtifactService(
        store,
        new ArtifactRepository(prisma),
        new CampaignService(scenarioRepository),
        new ScenarioService(scenarioRepository),
      );
      const uploaded = await service.upload({
        campaignId: campaign.id,
        content: stream([Buffer.from("89504e470d0a1a0a00000000", "hex")]),
        declaredMediaType: "image/png",
        metadata: {
          altText: "A pass",
          artifactKind: "map",
          provenanceKind: "user_upload",
          title: "Two channels",
        },
        userId: gm.id,
      });
      const attached = await service.mutateScenarioReference({
        action: "attach",
        artifactId: uploaded.id,
        campaignId: campaign.id,
        expectedArtifactVersion: uploaded.metadataVersion,
        scenarioId: scenario.id,
        userId: gm.id,
      });
      const scenarioPublished = await service.mutateScenarioReference({
        action: "publish",
        artifactId: uploaded.id,
        campaignId: campaign.id,
        expectedArtifactVersion: attached.artifact.metadataVersion,
        expectedReferenceVersion: attached.reference.version,
        scenarioId: scenario.id,
        userId: gm.id,
      });
      const campaignPublished = await service.setAudience({
        artifactId: uploaded.id,
        audience: "campaign",
        campaignId: campaign.id,
        expectedVersion: scenarioPublished.artifact.metadataVersion,
        userId: gm.id,
      });
      const scenarioWithdrawn = await service.mutateScenarioReference({
        action: "withdraw",
        artifactId: uploaded.id,
        campaignId: campaign.id,
        expectedArtifactVersion: campaignPublished.metadataVersion,
        expectedReferenceVersion: scenarioPublished.reference.version,
        scenarioId: scenario.id,
        userId: gm.id,
      });
      expect(scenarioWithdrawn.artifact.audience).toBe("campaign");

      const scenarioRepublished = await service.mutateScenarioReference({
        action: "publish",
        artifactId: uploaded.id,
        campaignId: campaign.id,
        expectedArtifactVersion: scenarioWithdrawn.artifact.metadataVersion,
        expectedReferenceVersion: scenarioWithdrawn.reference.version,
        scenarioId: scenario.id,
        userId: gm.id,
      });
      expect(scenarioRepublished.artifact.audience).toBe("campaign");
      const campaignWithdrawn = await service.setAudience({
        artifactId: uploaded.id,
        audience: "gm_private",
        campaignId: campaign.id,
        expectedVersion: scenarioRepublished.artifact.metadataVersion,
        userId: gm.id,
      });
      expect(campaignWithdrawn.audience).toBe("scenario");
      await expect(
        service.updateMetadata({
          artifactId: uploaded.id,
          campaignId: campaign.id,
          update: { altText: null, expectedMetadataVersion: campaignWithdrawn.metadataVersion },
          userId: gm.id,
        }),
      ).rejects.toBeInstanceOf(ArtifactLifecycleError);
      expect((await service.getForGm(campaign.id, uploaded.id, gm.id)).altText).toBe("A pass");
    });

    it("preserves legacy rows as GM-only re-upload-required metadata without a readable locator", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      await prisma.$executeRaw`
        INSERT INTO "CampaignAsset" (
          "id", "campaignId", "type", "title", "storageUrl", "visibility",
          "createdByUserId", "createdAt", "updatedAt"
        ) VALUES (
          'legacy-artifact', ${campaign.id}, 'map'::"CampaignAssetType", 'Old map',
          'https://untrusted.example/private-map.png', 'visible_to_all'::"ScenarioVisibility",
          ${gm.id}, NOW(), NOW()
        )
      `;
      const service = new ArtifactService(new MemoryStore(), new ArtifactRepository(prisma));
      const [legacy] = await service.listForGm(campaign.id, gm.id);
      expect(legacy).toMatchObject({
        id: "legacy-artifact",
        legacyNeedsUpload: true,
        storageState: "legacy_reference",
      });
      expect(legacy).not.toHaveProperty("storageUrl");
      await expect(
        service.readContent({ artifactId: legacy!.id, campaignId: campaign.id, userId: gm.id }),
      ).rejects.toThrow("not found");
    });

    it("enforces same-Campaign Scenario references, optimistic versions, snapshots, and delete-after-withdraw", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const otherCampaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const scenario = await prisma.scenario.create({
        data: {
          campaignId: campaign.id,
          description: "",
          kind: "mixed",
          name: "The pass",
          status: "live",
        },
      });
      const foreignScenario = await prisma.scenario.create({
        data: {
          campaignId: otherCampaign.id,
          description: "",
          kind: "mixed",
          name: "Foreign",
          status: "live",
        },
      });
      const store = new MemoryStore();
      const scenarioRepository = createPrismaScenarioRepository(prisma);
      const service = new ArtifactService(
        store,
        new ArtifactRepository(prisma),
        new CampaignService(scenarioRepository),
        new ScenarioService(scenarioRepository),
      );
      const artifact = await service.upload({
        campaignId: campaign.id,
        content: stream([Buffer.from("89504e470d0a1a0a00000000", "hex")]),
        declaredMediaType: "image/png",
        metadata: {
          altText: "Pass map",
          artifactKind: "map",
          provenanceKind: "user_upload",
          title: "Map v1",
        },
        userId: gm.id,
      });
      const edited = await service.updateMetadata({
        artifactId: artifact.id,
        campaignId: campaign.id,
        update: { expectedMetadataVersion: artifact.metadataVersion, title: "Map v2" },
        userId: gm.id,
      });
      expect(edited).toMatchObject({
        digest: artifact.digest,
        id: artifact.id,
        provenanceKind: artifact.provenanceKind,
        title: "Map v2",
      });
      await expect(
        service.updateMetadata({
          artifactId: artifact.id,
          campaignId: campaign.id,
          update: { expectedMetadataVersion: artifact.metadataVersion, title: "Stale edit" },
          userId: gm.id,
        }),
      ).rejects.toThrow("changed");

      await expect(
        service.mutateScenarioReference({
          action: "attach",
          artifactId: artifact.id,
          campaignId: campaign.id,
          expectedArtifactVersion: edited.metadataVersion,
          scenarioId: foreignScenario.id,
          userId: gm.id,
        }),
      ).rejects.toThrow("not found");
      expect(await prisma.scenarioArtifactReference.count()).toBe(0);

      const attached = await service.mutateScenarioReference({
        action: "attach",
        artifactId: artifact.id,
        campaignId: campaign.id,
        caption: "The northern approach",
        expectedArtifactVersion: edited.metadataVersion,
        scenarioId: scenario.id,
        userId: gm.id,
      });
      const published = await service.mutateScenarioReference({
        action: "publish",
        artifactId: artifact.id,
        campaignId: campaign.id,
        expectedArtifactVersion: attached.artifact.metadataVersion,
        expectedReferenceVersion: attached.reference.version,
        scenarioId: scenario.id,
        userId: gm.id,
      });
      expect(published.reference).toMatchObject({
        caption: "The northern approach",
        state: "published",
        title: "Map v2",
      });
      await expect(
        service.delete({
          artifactId: artifact.id,
          campaignId: campaign.id,
          expectedVersion: published.artifact.metadataVersion,
          userId: gm.id,
        }),
      ).rejects.toBeInstanceOf(ArtifactLifecycleError);

      const archived = await service.setLifecycle({
        artifactId: artifact.id,
        campaignId: campaign.id,
        expectedVersion: published.artifact.metadataVersion,
        lifecycle: "archived",
        userId: gm.id,
      });
      expect(await prisma.scenarioArtifactReference.count({ where: { state: "published" } })).toBe(
        1,
      );
      await expect(
        service.mutateScenarioReference({
          action: "attach",
          artifactId: artifact.id,
          campaignId: campaign.id,
          expectedArtifactVersion: archived.metadataVersion,
          expectedReferenceVersion: published.reference.version,
          scenarioId: scenario.id,
          userId: gm.id,
        }),
      ).rejects.toThrow("changed");

      const withdrawn = await service.mutateScenarioReference({
        action: "withdraw",
        artifactId: artifact.id,
        campaignId: campaign.id,
        expectedArtifactVersion: archived.metadataVersion,
        expectedReferenceVersion: published.reference.version,
        scenarioId: scenario.id,
        userId: gm.id,
      });
      const deleted = await service.delete({
        artifactId: artifact.id,
        campaignId: campaign.id,
        expectedVersion: withdrawn.artifact.metadataVersion,
        userId: gm.id,
      });
      expect(deleted).toMatchObject({ lifecycle: "deleted", storageState: "deleted" });
      expect(store.objects.size).toBe(0);
    });

    it("tombstones access before a failed delete and retries cleanup idempotently", async () => {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id, { status: "active" });
      const store = new MemoryStore();
      const service = new ArtifactService(store, new ArtifactRepository(prisma));
      const artifact = await service.upload({
        campaignId: campaign.id,
        content: stream([Buffer.from("%PDF-1.7\n%%EOF\n")]),
        declaredMediaType: "application/pdf",
        metadata: { artifactKind: "document", provenanceKind: "user_upload", title: "Private" },
        userId: gm.id,
      });

      store.failDelete = true;
      const deleted = await service.delete({
        artifactId: artifact.id,
        campaignId: campaign.id,
        expectedVersion: artifact.metadataVersion,
        userId: gm.id,
      });
      expect(deleted).toMatchObject({ cleanupRequired: true, lifecycle: "deleted" });
      await expect(
        service.readContent({ artifactId: artifact.id, campaignId: campaign.id, userId: gm.id }),
      ).rejects.toThrow("not found");

      store.failDelete = false;
      const cleaned = await service.retryCleanup({
        artifactId: artifact.id,
        campaignId: campaign.id,
        userId: gm.id,
      });
      expect(cleaned.cleanupRequired).toBe(false);
      expect(store.objects.size).toBe(0);
      await expect(
        service.retryCleanup({ artifactId: artifact.id, campaignId: campaign.id, userId: gm.id }),
      ).rejects.toThrow("not found");
    });
  });
}
