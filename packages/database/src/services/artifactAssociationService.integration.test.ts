import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { ArtifactBinaryStore } from "../artifacts/artifactBinaryStore";
import {
  buildDescriptiveCampaignEquipmentItem,
  campaignEquipmentItemCreateData,
} from "../repositories/characterEquipmentRepository";
import { ArtifactRepository } from "../repositories/artifactRepository";
import { createTestCampaign, createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { ArtifactAssociationService } from "./artifactAssociationService";
import { ArtifactService } from "./artifactService";

const prisma = getTestPrismaClient();
const png = Buffer.from("89504e470d0a1a0a00000000", "hex");
async function* stream(bytes: Uint8Array) {
  yield bytes;
}

class MemoryStore implements ArtifactBinaryStore {
  readonly provider = "local" as const;
  private readonly objects = new Map<string, Buffer>();
  async put(input: { content: AsyncIterable<Uint8Array>; key: string }) {
    const chunks: Buffer[] = [];
    for await (const chunk of input.content) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    this.objects.set(input.key, bytes);
    return {
      byteSize: bytes.length,
      sha256Digest: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  async read(input: { key: string }) {
    const bytes = this.objects.get(input.key)!;
    return { byteSize: bytes.length, content: stream(bytes) };
  }
  async stat(key: string) {
    const bytes = this.objects.get(key);
    return bytes
      ? { byteSize: bytes.length, sha256Digest: createHash("sha256").update(bytes).digest("hex") }
      : null;
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
}

if (!prisma) {
  describe.skip("Artifact Association integration (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("Artifact Association integration", () => {
    beforeEach(async () => resetTestDatabase(prisma));
    afterAll(async () => resetTestDatabase(prisma));

    async function setup() {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma!, gm.id);
      const itemId = `${campaign.id}:association-item`;
      await prisma!.characterEquipmentItem.create({
        data: campaignEquipmentItemCreateData(
          buildDescriptiveCampaignEquipmentItem({
            campaignId: campaign.id,
            id: itemId,
            title: "Old map",
            description: null,
          }),
        ),
      });
      const store = new MemoryStore();
      const artifacts = new ArtifactService(store, new ArtifactRepository(prisma!));
      const associations = new ArtifactAssociationService(prisma!);
      async function upload(title: string) {
        return artifacts.upload({
          campaignId: campaign.id,
          content: stream(png),
          declaredMediaType: "image/png",
          metadata: { artifactKind: "image", title, provenanceKind: "user_upload" },
          userId: gm.id,
        });
      }
      return { gm, campaign, itemId, store, artifacts, associations, upload };
    }

    it("keeps typed, role-bearing, Campaign-scoped associations with provenance, identity, history, pins and two-way lookup", async () => {
      const { gm, campaign, itemId, artifacts, associations, upload } = await setup();
      const first = await upload("First representation");
      const second = await upload("Second representation");
      expect(first.id).not.toBe(second.id);
      expect(first.digest).toBe(second.digest); // INV-ART-02: same bytes, distinct logical Artifacts.
      const revision = await prisma!.artifactRevision.findFirstOrThrow({
        where: { artifactId: first.id },
      });
      const target = { kind: "item" as const, id: itemId };
      const base = { campaignId: campaign.id, target, userId: gm.id };
      const primary = await associations.attachExisting({
        ...base,
        artifactId: first.id,
        role: "primary",
        provenance: { kind: "manual", ref: "gm selection" },
        revisionId: revision.id,
      });
      const fallback = await associations.attachExisting({
        ...base,
        artifactId: first.id,
        role: "fallback",
        provenance: { kind: "manual" },
      });
      const sameBytes = await associations.attachExisting({
        ...base,
        artifactId: second.id,
        role: "representation",
        provenance: { kind: "manual" },
      });
      expect(new Set([primary.id, fallback.id, sameBytes.id]).size).toBe(3);
      expect(primary).toMatchObject({
        campaignId: campaign.id,
        target,
        artifactId: first.id,
        role: "primary",
        revisionId: revision.id,
        provenance: { kind: "manual", ref: "gm selection" },
        attachedByUserId: gm.id,
        disassociatedAt: null,
      });
      expect(primary.createdAt).toBeTruthy();
      expect((await associations.listByTarget(base)).map((row) => row.id)).toEqual([
        primary.id,
        fallback.id,
        sameBytes.id,
      ]);
      expect(
        (
          await associations.listByArtifact({
            campaignId: campaign.id,
            artifactId: first.id,
            userId: gm.id,
          })
        ).map((row) => row.id),
      ).toEqual([primary.id, fallback.id]);
      expect(
        (
          await associations.attachExisting({
            ...base,
            artifactId: first.id,
            role: "primary",
            provenance: { kind: "manual" },
            revisionId: revision.id,
          })
        ).id,
      ).toBe(primary.id);
      const ended = await associations.disassociate({
        associationId: primary.id,
        campaignId: campaign.id,
        userId: gm.id,
      });
      expect(ended.disassociatedAt).toBeTruthy();
      expect(ended.disassociatedByUserId).toBe(gm.id);
      expect((await associations.listByTarget(base)).map((row) => row.id)).toEqual([
        fallback.id,
        sameBytes.id,
      ]);
      expect(
        (await associations.listByTarget({ ...base, includeHistory: true })).map((row) => row.id),
      ).toContain(primary.id);
      const renewed = await associations.attachExisting({
        ...base,
        artifactId: first.id,
        role: "primary",
        provenance: { kind: "manual" },
        revisionId: revision.id,
      });
      expect(renewed.id).not.toBe(primary.id);
      expect(await prisma!.campaignAsset.count({ where: { id: first.id } })).toBe(1);
      expect((await artifacts.listForGm(campaign.id, gm.id)).map((row) => row.id)).toContain(
        first.id,
      );
      expect(
        await prisma!.artifactAuditEvent.count({
          where: { artifactId: first.id, action: "item_representation_disassociate" },
        }),
      ).toBe(1);
    });

    it("uploads a new Artifact and attaches it in one service act with its immutable revision pin", async () => {
      const { gm, campaign, itemId, artifacts, associations } = await setup();
      const result = await associations.uploadNewAndAttach(
        {
          campaignId: campaign.id,
          target: { kind: "item", id: itemId },
          userId: gm.id,
          role: "representation",
          content: stream(png),
          declaredMediaType: "image/png",
          metadata: { artifactKind: "image", title: "Fresh image", provenanceKind: "user_upload" },
          pinUploadedRevision: true,
        },
        artifacts,
      );
      const revision = await prisma!.artifactRevision.findFirstOrThrow({
        where: { artifactId: result.artifactId },
      });
      expect(result.association).toMatchObject({
        artifactId: result.artifactId,
        revisionId: revision.id,
        provenance: { kind: "upload" },
      });
      expect((await artifacts.listForGm(campaign.id, gm.id)).map((row) => row.id)).toContain(
        result.artifactId,
      );
    });

    it("lets PostgreSQL reject a forged cross-Campaign Item target and a foreign revision", async () => {
      const { gm, campaign, itemId, upload, associations } = await setup();
      const other = await createTestCampaign(prisma!, gm.id);
      const otherArtifact = await prisma!.campaignAsset.create({
        data: {
          campaignId: other.id,
          createdByUserId: gm.id,
          type: "image",
          title: "Other",
          storageUrl: "legacy:other",
          visibility: "gm_only",
        },
      });
      await expect(prisma!.$executeRaw`INSERT INTO "CampaignItemArtifactAttachment"
        ("id", "campaignId", "itemId", "artifactId", "attachedByUserId")
        VALUES ('forged-cross-campaign', ${other.id}, ${itemId}, ${otherArtifact.id}, ${gm.id})`).rejects.toThrow(
        /23503|foreign key/i,
      );
      expect(await prisma!.campaignItemArtifactAttachment.count()).toBe(0);
      const first = await upload("Scoped");
      const second = await upload("Other revision");
      const wrongRevision = await prisma!.artifactRevision.findFirstOrThrow({
        where: { artifactId: second.id },
      });
      await expect(prisma!.$executeRaw`INSERT INTO "CampaignItemArtifactAttachment"
        ("id", "campaignId", "itemId", "artifactId", "revisionId", "attachedByUserId")
        VALUES ('forged-revision', ${campaign.id}, ${itemId}, ${first.id}, ${wrongRevision.id}, ${gm.id})`).rejects.toThrow(
        /23503|foreign key/i,
      );
      await expect(
        associations.attachExisting({
          campaignId: other.id,
          target: { kind: "item", id: itemId },
          artifactId: first.id,
          role: "representation",
          provenance: { kind: "manual" },
          userId: gm.id,
        }),
      ).rejects.toThrow();
      const outsider = await createTestUser(prisma!, { roles: ["game_master"] });
      await expect(
        prisma!.$transaction((tx) =>
          associations.attachInTransaction(tx, {
            campaignId: campaign.id,
            target: { kind: "item", id: itemId },
            artifactId: first.id,
            role: "representation",
            provenance: { kind: "manual" },
            userId: outsider.id,
          }),
        ),
      ).rejects.toThrow();
    });
  });
}
