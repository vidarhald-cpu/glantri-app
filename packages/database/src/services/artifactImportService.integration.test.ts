import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  artifactPackageSchema,
  ORDINARY_ARTIFACT_UPLOAD_PRODUCER,
  type ArtifactPackage,
} from "@glantri/domain";
import type { ArtifactBinaryStore } from "../artifacts/artifactBinaryStore";
import { ArtifactImportRepository } from "../repositories/artifactImportRepository";
import { ArtifactRepository } from "../repositories/artifactRepository";
import { createTestCampaign, createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { ArtifactImportService } from "./artifactImportService";
import { ArtifactConflictError, ArtifactService } from "./artifactService";
const prisma = getTestPrismaClient();
const png = Buffer.from("89504e470d0a1a0a00000000", "hex");
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function* stream(bytes: Buffer) {
  yield bytes;
}
class Store implements ArtifactBinaryStore {
  readonly provider = "local" as const;
  objects = new Map<string, Buffer>();
  failDelete = false;
  failPut = false;
  async put(input: { key: string; content: AsyncIterable<Uint8Array> }) {
    const chunks = [];
    for await (const chunk of input.content) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    this.objects.set(input.key, bytes);
    if (this.failPut) throw new Error("injected storage failure");
    return { byteSize: bytes.length, sha256Digest: digest(bytes) };
  }
  async stat(key: string) {
    const bytes = this.objects.get(key);
    return bytes ? { byteSize: bytes.length, sha256Digest: digest(bytes) } : null;
  }
  async read({ key }: { key: string }) {
    const bytes = this.objects.get(key)!;
    return { byteSize: bytes.length, content: stream(bytes) };
  }
  async delete(key: string) {
    if (this.failDelete) throw new Error("cleanup failed");
    this.objects.delete(key);
  }
}
function manifest(count = 4, bytes = png): ArtifactPackage {
  return artifactPackageSchema.parse({
    schemaVersion: 1,
    producer: "author",
    packageId: "portraits",
    version: "1",
    title: "Portraits",
    resources: [{ id: "picture", mediaType: "image/png", sha256: digest(bytes) }],
    objects: Array.from({ length: count }, (_, i) => ({
      id: `a${i}`,
      sourceId: `source${i}`,
      type: "Artifact",
      optional: i > 0,
      resourceId: "picture",
      metadata: { title: "Same title", artifactKind: "portrait", altText: "A portrait" },
    })),
  });
}
function ordinaryManifest(count = 1): ArtifactPackage {
  return artifactPackageSchema.parse({
    schemaVersion: 1,
    producer: ORDINARY_ARTIFACT_UPLOAD_PRODUCER,
    packageId: "ordinary-once",
    version: "1",
    title: "Artifact upload",
    resources: Array.from({ length: count }, (_, index) => ({
      id: `picture${index}`,
      mediaType: "image/png",
      sha256: digest(png),
    })),
    objects: Array.from({ length: count }, (_, index) => ({
      id: `a${index}`,
      type: "Artifact",
      resourceId: `picture${index}`,
      metadata: {
        title: `Same bytes ${index + 1}`,
        artifactKind: "image",
        provenanceKind: "user_upload",
      },
    })),
  });
}
if (!prisma) describe.skip("AM1 import integration (owned DB required)", () => {});
else
  describe("AM1 transactional Artifact imports", () => {
    beforeEach(async () => resetTestDatabase(prisma));
    afterAll(async () => resetTestDatabase(prisma));
    async function setup() {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma!, gm.id, { status: "active" });
      const store = new Store();
      const service = new ArtifactImportService(store, new ArtifactImportRepository(prisma!));
      const artifacts = new ArtifactService(store, new ArtifactRepository(prisma!));
      async function stage(data = manifest(), bytes = png) {
        const session = await service.begin(campaign.id, gm.id, data);
        for (const resource of data.resources)
          await service.uploadResource({
            campaignId: campaign.id,
            userId: gm.id,
            id: session.id,
            resourceId: resource.id,
            content: stream(bytes),
            mediaType: resource.mediaType,
          });
        return service.finish(campaign.id, gm.id, session.id);
      }
      return { gm, campaign, store, service, artifacts, stage };
    }
    it("stages zero authoritative rows, accepts four distinct IDs once, survives cleanup and recognizes exact re-import", async () => {
      const { gm, campaign, store, service, stage, artifacts } = await setup();
      const preview = await stage();
      expect(await prisma!.campaignAsset.count()).toBe(0);
      expect(preview.valid).toBe(true);
      const accepted = await service.accept(
        campaign.id,
        gm.id,
        preview.id,
        preview.previewToken,
        [],
      );
      expect(new Set(Object.values(accepted.result!)).size).toBe(4);
      expect(await prisma!.artifactRevision.count()).toBe(4);
      expect(
        (await prisma!.campaignAsset.findMany()).every(
          (artifact) => artifact.provenanceKind === "imported",
        ),
      ).toBe(true);
      expect(
        (await service.accept(campaign.id, gm.id, preview.id, preview.previewToken, [])).result,
      ).toEqual(accepted.result);
      await service.cleanup(campaign.id, gm.id, preview.id);
      expect(store.objects.size).toBe(1);
      expect(
        (
          await artifacts.readContent({
            campaignId: campaign.id,
            userId: gm.id,
            artifactId: accepted.result!.a0!,
          })
        ).body.byteSize,
      ).toBe(png.length);
      const repeated = await stage();
      expect(repeated.items.every((x) => x.status === "present")).toBe(true);
      await service.accept(campaign.id, gm.id, repeated.id, repeated.previewToken, []);
      expect(await prisma!.campaignAsset.count()).toBe(4);
    });
    it("treats ordinary loose files as creation-only and warns without collapsing matching bytes", async () => {
      const { gm, campaign, service, stage } = await setup();
      const first = await stage(ordinaryManifest(2));
      const firstAccepted = await service.accept(
        campaign.id,
        gm.id,
        first.id,
        first.previewToken,
        [],
      );
      const second = await stage(ordinaryManifest());
      expect(second.items[0]!.status).toBe("create");
      expect(second.items[0]!.targetArtifactId).toBeUndefined();
      expect(second.items[0]!.warnings).toContain(
        "The file matches 2 existing Artifacts. Accepting will still create a separate Artifact.",
      );
      const secondAccepted = await service.accept(
        campaign.id,
        gm.id,
        second.id,
        second.previewToken,
        [],
      );
      expect(new Set(Object.values(firstAccepted.result!)).size).toBe(2);
      expect(Object.values(firstAccepted.result!)).not.toContain(secondAccepted.result!.a0);
      expect(await prisma!.artifactSourceMapping.count()).toBe(0);
      const created = await prisma!.campaignAsset.findMany({ orderBy: { createdAt: "asc" } });
      expect(created).toHaveLength(3);
      expect(created.every((artifact) => artifact.audience === "gm_private")).toBe(true);
      expect(created.every((artifact) => artifact.provenanceKind === "user_upload")).toBe(true);
      expect(created.every((artifact) => artifact.sourceLabel === null)).toBe(true);
    });
    it("requires specific fresh update approval, preserves history and rejects changed/revoked authority", async () => {
      const { gm, campaign, service, stage, artifacts, store } = await setup();
      const initial = await stage(manifest(1));
      const accepted = await service.accept(
        campaign.id,
        gm.id,
        initial.id,
        initial.previewToken,
        [],
      );
      const id = accepted.result!.a0!;
      const changed = Buffer.concat([png, Buffer.from("correction")]);
      const update = await stage(manifest(1, changed), changed);
      expect(update.items[0]!.status).toBe("update");
      await expect(
        service.accept(campaign.id, gm.id, update.id, update.previewToken, []),
      ).rejects.toThrow("approval");
      const refreshed = await service.preview(campaign.id, gm.id, update.id, ["a0"]);
      await expect(
        service.accept(campaign.id, gm.id, update.id, update.previewToken, ["a0"]),
      ).rejects.toThrow();
      await service.accept(campaign.id, gm.id, update.id, refreshed.previewToken, ["a0"]);
      expect(await artifacts.history(campaign.id, id, gm.id)).toHaveLength(2);
      expect([...store.objects.values()]).toContainEqual(png);
      expect((await prisma!.campaignAsset.findUniqueOrThrow({ where: { id } })).sha256Digest).toBe(
        digest(changed),
      );
      const stale = await stage(manifest(1));
      await artifacts.updateMetadata({
        campaignId: campaign.id,
        artifactId: id,
        userId: gm.id,
        update: { expectedMetadataVersion: 2, title: "Locally corrected" },
      });
      await expect(
        service.accept(campaign.id, gm.id, stale.id, stale.previewToken, ["a0"]),
      ).rejects.toThrow("changed");
      const other = await createTestUser(prisma!, { roles: ["admin"] });
      await expect(service.get(campaign.id, other.id, stale.id)).rejects.toThrow("not found");
      await prisma!.campaign.update({ where: { id: campaign.id }, data: { gmUserId: other.id } });
      await expect(
        service.accept(campaign.id, gm.id, stale.id, stale.previewToken, ["a0"]),
      ).rejects.toThrow("not found");
    });
    it("recomputes dependency closure and accepts only a valid optional Artifact subset", async () => {
      const { gm, campaign, service, stage } = await setup();
      const data = manifest(3);
      data.objects[0]!.dependencies = [{ kind: "local", id: "a1" }];
      data.objects[2]!.type = "Map";
      const initial = await stage(data);
      expect(initial.valid).toBe(false);
      expect((await service.preview(campaign.id, gm.id, initial.id, ["a0"])).valid).toBe(false);
      const valid = await service.preview(campaign.id, gm.id, initial.id, ["a1", "a0"]);
      expect(valid.valid).toBe(true);
      await service.accept(campaign.id, gm.id, initial.id, valid.previewToken, []);
      expect(await prisma!.campaignAsset.count()).toBe(2);
    });
    it("rolls back the entire graph on a mid-transaction failure and retains a durable recoverable report", async () => {
      const { gm, campaign, service, stage } = await setup();
      const preview = await stage();
      await prisma!.$executeRawUnsafe(
        `CREATE FUNCTION am1_fail_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT COUNT(*) FROM "ArtifactRevision") >= 1 THEN RAISE EXCEPTION 'injected mid-acceptance'; END IF; RETURN NEW; END $$`,
      );
      await prisma!.$executeRawUnsafe(
        `CREATE TRIGGER am1_fail BEFORE INSERT ON "ArtifactRevision" FOR EACH ROW EXECUTE FUNCTION am1_fail_revision()`,
      );
      try {
        await expect(
          service.accept(campaign.id, gm.id, preview.id, preview.previewToken, []),
        ).rejects.toThrow();
        expect(await prisma!.campaignAsset.count()).toBe(0);
        expect(await prisma!.artifactRevision.count()).toBe(0);
        expect(await prisma!.artifactSourceMapping.count()).toBe(0);
        expect((await service.get(campaign.id, gm.id, preview.id)).error).toContain("No partial");
      } finally {
        await prisma!.$executeRawUnsafe('DROP TRIGGER am1_fail ON "ArtifactRevision"');
        await prisma!.$executeRawUnsafe("DROP FUNCTION am1_fail_revision()");
      }
      await service.accept(campaign.id, gm.id, preview.id, preview.previewToken, []);
      expect(await prisma!.campaignAsset.count()).toBe(4);
    });
    it("keeps failed storage private and cleanup retryable, never deleting accepted revisions", async () => {
      const { gm, campaign, service, store } = await setup();
      const session = await service.begin(campaign.id, gm.id, manifest(1));
      store.failPut = true;
      store.failDelete = true;
      await expect(
        service.uploadResource({
          campaignId: campaign.id,
          userId: gm.id,
          id: session.id,
          resourceId: "picture",
          content: stream(png),
          mediaType: "image/png",
        }),
      ).rejects.toThrow();
      await service.abort(campaign.id, gm.id, session.id);
      expect(await prisma!.campaignAsset.count()).toBe(0);
      expect((await service.list(campaign.id, gm.id))[0]!.cleanupPending).toBe(true);
      store.failDelete = false;
      await service.cleanup(campaign.id, gm.id, session.id);
      expect(store.objects.size).toBe(0);
    });
    it("rejects oversized resources, duplicate resource submissions and cross-Campaign update targets", async () => {
      const { gm, campaign, service, stage } = await setup();
      const session = await service.begin(campaign.id, gm.id, manifest(1));
      async function* oversized() {
        yield png;
        for (let i = 0; i < 26; i++) yield Buffer.alloc(1024 * 1024);
      }
      await expect(
        service.uploadResource({
          campaignId: campaign.id,
          userId: gm.id,
          id: session.id,
          resourceId: "picture",
          content: oversized(),
          mediaType: "image/png",
        }),
      ).rejects.toThrow(/25 MiB/);
      await service.abort(campaign.id, gm.id, session.id);
      const duplicate = await service.begin(campaign.id, gm.id, manifest(1));
      await service.uploadResource({
        campaignId: campaign.id,
        userId: gm.id,
        id: duplicate.id,
        resourceId: "picture",
        content: stream(png),
        mediaType: "image/png",
      });
      await expect(
        service.uploadResource({
          campaignId: campaign.id,
          userId: gm.id,
          id: duplicate.id,
          resourceId: "picture",
          content: stream(png),
          mediaType: "image/png",
        }),
      ).rejects.toThrow(/duplicate/);
      const data = manifest(1);
      data.objects[0]!.targetArtifactId = "foreign-or-missing";
      const preview = await stage(data);
      expect(preview.valid).toBe(false);
      expect(preview.items[0]!.targetArtifactId).toBeUndefined();
      await expect(
        service.accept(campaign.id, gm.id, preview.id, preview.previewToken, ["a0"]),
      ).rejects.toThrow();
      expect(await prisma!.campaignAsset.count()).toBe(0);
    });

    it("compensates its own unaccepted upload even if GM authority is revoked during upload", async () => {
      const { gm, campaign, service, store } = await setup();
      const session = await service.begin(campaign.id, gm.id, manifest(1));
      await service.uploadResource({
        campaignId: campaign.id,
        userId: gm.id,
        id: session.id,
        resourceId: "picture",
        content: stream(png),
        mediaType: "image/png",
      });
      const newGm = await createTestUser(prisma!, { roles: ["game_master"] });
      await prisma!.campaign.update({ where: { id: campaign.id }, data: { gmUserId: newGm.id } });
      await expect(service.finish(campaign.id, gm.id, session.id)).rejects.toThrow("not found");
      await service.abort(campaign.id, gm.id, session.id);
      expect(store.objects.size).toBe(0);
      expect(await prisma!.campaignAsset.count()).toBe(0);
    });
    it("turns competing same-source acceptances into a refreshable conflict", async () => {
      const { gm, campaign, service, stage } = await setup();
      const first = await stage(manifest(1));
      const second = await stage(manifest(1));
      const attempts = await Promise.allSettled([
        service.accept(campaign.id, gm.id, first.id, first.previewToken, []),
        service.accept(campaign.id, gm.id, second.id, second.previewToken, []),
      ]);
      expect(attempts.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      const rejected = attempts.find((x) => x.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(ArtifactConflictError);
      expect(await prisma!.campaignAsset.count()).toBe(1);
      expect(await prisma!.artifactRevision.count()).toBe(1);
    });
    it("serializes double acceptance without duplicated Artifacts or revisions", async () => {
      const { gm, campaign, service, stage } = await setup();
      const preview = await stage();
      const attempts = await Promise.allSettled([
        service.accept(campaign.id, gm.id, preview.id, preview.previewToken, []),
        service.accept(campaign.id, gm.id, preview.id, preview.previewToken, []),
      ]);
      expect(attempts.some((x) => x.status === "fulfilled")).toBe(true);
      expect(await prisma!.campaignAsset.count()).toBe(4);
      expect(await prisma!.artifactRevision.count()).toBe(4);
    });
  });
