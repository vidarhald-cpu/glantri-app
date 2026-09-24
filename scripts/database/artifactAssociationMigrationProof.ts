/** Reproducible #307 seeded migration proof on a worktree-owned disposable DB.
 * Run seed after baseline migrations and verify after the #307 migration.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { prisma } from "../../packages/database/src/client";
import {
  buildDescriptiveCampaignEquipmentItem,
  campaignEquipmentItemCreateData,
} from "../../packages/database/src/repositories/characterEquipmentRepository";
import { ArtifactRepository } from "../../packages/database/src/repositories/artifactRepository";
import { createTestCampaign, createTestUser } from "../../packages/database/src/testing/factories";

const [mode, snapshotPath] = process.argv.slice(2);
if ((mode !== "seed" && mode !== "verify") || !snapshotPath) {
  throw new Error("Usage: artifactAssociationMigrationProof.ts seed|verify <snapshot-path>");
}

type Identity = {
  campaignId: string;
  deletingCampaignId: string;
  itemId: string;
  deletingItemId: string;
  artifactId: string;
  deletingArtifactId: string;
  revisionId: string;
  associationId: string;
  deletingAssociationId: string;
};
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function preservedRows(ids: Identity) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT a."id", a."campaignId", a."itemId", a."artifactId", a."attachedByUserId", a."createdAt"
    FROM "CampaignItemArtifactAttachment" a
    WHERE a."id" IN (${ids.associationId}, ${ids.deletingAssociationId}) ORDER BY a."id"`;
  const items = await prisma.characterEquipmentItem.findMany({
    where: { id: { in: [ids.itemId, ids.deletingItemId] } },
    select: { id: true, campaignContextId: true, displayName: true, createdAt: true },
    orderBy: { id: "asc" },
  });
  const assets = await prisma.campaignAsset.findMany({
    where: { id: { in: [ids.artifactId, ids.deletingArtifactId] } },
    select: {
      id: true,
      campaignId: true,
      title: true,
      sha256Digest: true,
      currentRevisionId: true,
    },
    orderBy: { id: "asc" },
  });
  const revisions = await prisma.artifactRevision.findMany({
    where: { id: ids.revisionId },
    select: { id: true, artifactId: true, number: true, sha256Digest: true },
  });
  return {
    associations: { count: rows.length, sha256: digest(rows) },
    items: { count: items.length, sha256: digest(items) },
    assets: { count: assets.length, sha256: digest(assets) },
    revisions: { count: revisions.length, sha256: digest(revisions) },
  };
}

async function main() {
  try {
    if (mode === "seed") {
      const gm = await createTestUser(prisma, { roles: ["game_master"] });
      const campaign = await createTestCampaign(prisma, gm.id);
      const deleting = await createTestCampaign(prisma, gm.id);
      const itemId = `${campaign.id}:migration-item`;
      const deletingItemId = `${deleting.id}:migration-item`;
      for (const [campaignId, id] of [
        [campaign.id, itemId],
        [deleting.id, deletingItemId],
      ]) {
        const item = buildDescriptiveCampaignEquipmentItem({
          campaignId,
          id,
          title: "Migration item",
          description: null,
        });
        await prisma.characterEquipmentItem.create({ data: campaignEquipmentItemCreateData(item) });
      }
      const repository = new ArtifactRepository(prisma);
      const artifactId = `${campaign.id}:migration-artifact`;
      await repository.createPending({
        id: artifactId,
        campaignId: campaign.id,
        createdByUserId: gm.id,
        artifactKind: "image",
        provenanceKind: "user_upload",
        storageProvider: "local",
        storageKey: "migration-proof",
        title: "Migration image",
      });
      const asset = await repository.markReady({
        artifactId,
        actorUserId: gm.id,
        byteSize: 12,
        mediaType: "image/png",
        sha256Digest: "a".repeat(64),
      });
      const deletingArtifactId = `${deleting.id}:migration-artifact`;
      await prisma.campaignAsset.create({
        data: {
          id: deletingArtifactId,
          campaignId: deleting.id,
          createdByUserId: gm.id,
          type: "image",
          title: "Legacy migration image",
          storageUrl: "legacy:proof",
          visibility: "gm_only",
        },
      });
      const ids: Identity = {
        campaignId: campaign.id,
        deletingCampaignId: deleting.id,
        itemId,
        deletingItemId,
        artifactId,
        deletingArtifactId,
        revisionId: asset.currentRevisionId!,
        associationId: "migration-association-retained",
        deletingAssociationId: "migration-association-deleted",
      };
      await prisma.$executeRaw`INSERT INTO "CampaignItemArtifactAttachment" ("id", "campaignId", "itemId", "artifactId", "attachedByUserId") VALUES (${ids.associationId}, ${ids.campaignId}, ${ids.itemId}, ${ids.artifactId}, ${gm.id}), (${ids.deletingAssociationId}, ${ids.deletingCampaignId}, ${ids.deletingItemId}, ${ids.deletingArtifactId}, ${gm.id})`;
      const before = await preservedRows(ids);
      writeFileSync(snapshotPath, JSON.stringify({ ids, before }, null, 2));
      console.log(JSON.stringify({ phase: "before", ...before }));
    } else {
      const { ids, before } = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
        ids: Identity;
        before: Awaited<ReturnType<typeof preservedRows>>;
      };
      const after = await preservedRows(ids);
      if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("Seeded row-preservation checksum mismatch");
      console.log(JSON.stringify({ phase: "after", ...after, preserved: true }));
      const row = await prisma.campaignItemArtifactAttachment.findUniqueOrThrow({
        where: { id: ids.associationId },
      });
      if (row.role !== "representation" || row.provenanceKind !== "legacy")
        throw new Error("Legacy association backfill mismatch");
      await prisma.campaign.delete({ where: { id: ids.deletingCampaignId } });
      const [detachedItem, remainingLinks] = await Promise.all([
        prisma.characterEquipmentItem.findUniqueOrThrow({
          where: { id: ids.deletingItemId },
          select: { campaignContextId: true },
        }),
        prisma.campaignItemArtifactAttachment.count({ where: { id: ids.deletingAssociationId } }),
      ]);
      if (detachedItem.campaignContextId !== null || remainingLinks !== 0)
        throw new Error("Mixed SetNull/Cascade deletion mismatch");
      console.log(
        JSON.stringify({
          phase: "campaign-delete",
          itemCampaignContextId: detachedItem.campaignContextId,
          associations: remainingLinks,
        }),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
