import { Prisma, type PrismaClient } from "@prisma/client";

import type { ArtifactBlackboardCandidate } from "@glantri/domain";

import { prisma } from "../client";

const artifactSelect = {
  altText: true,
  artifactKind: true,
  audience: true,
  byteSize: true,
  campaignId: true,
  currentRevisionId: true,
  createdAt: true,
  description: true,
  id: true,
  lifecycleState: true,
  mediaTypeDetected: true,
  metadataVersion: true,
  originalFilename: true,
  provenanceKind: true,
  sha256Digest: true,
  sourceLabel: true,
  sourceUri: true,
  storageDeletePending: true,
  storageKey: true,
  storageProvider: true,
  storageState: true,
  title: true,
  updatedAt: true,
} satisfies Prisma.CampaignAssetSelect;

export type ArtifactRecord = Prisma.CampaignAssetGetPayload<{ select: typeof artifactSelect }>;
type TransactionClient = Prisma.TransactionClient;

export class ArtifactRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async getCampaignOwner(campaignId: string): Promise<string | null> {
    const campaign = await this.client.campaign.findUnique({
      select: { gmUserId: true },
      where: { id: campaignId },
    });
    return campaign?.gmUserId ?? null;
  }

  async createPending(input: {
    altText?: string;
    artifactKind: string;
    campaignId: string;
    createdByUserId: string;
    description?: string;
    id: string;
    originalFilename?: string;
    provenanceKind: string;
    sourceLabel?: string;
    sourceUri?: string;
    storageKey: string;
    storageProvider: string;
    title: string;
  }): Promise<ArtifactRecord> {
    return this.client.campaignAsset.create({
      data: {
        altText: input.altText,
        artifactKind: input.artifactKind,
        audience: "gm_private",
        campaignId: input.campaignId,
        createdByUserId: input.createdByUserId,
        description: input.description,
        id: input.id,
        lifecycleState: "active",
        originalFilename: input.originalFilename,
        provenanceKind: input.provenanceKind,
        sourceLabel: input.sourceLabel,
        sourceUri: input.sourceUri,
        storageKey: input.storageKey,
        storageProvider: input.storageProvider,
        storageState: "pending",
        storageUrl: `artifact-internal:${input.id}`,
        title: input.title,
        type:
          input.artifactKind === "portrait"
            ? "image"
            : input.artifactKind === "map"
              ? "map"
              : input.artifactKind === "handout"
                ? "handout"
                : input.artifactKind === "document"
                  ? "document"
                  : "image",
        visibility: "gm_only",
      },
      select: artifactSelect,
    });
  }

  async markReady(input: {
    actorUserId: string;
    artifactId: string;
    byteSize: number;
    mediaType: string;
    sha256Digest: string;
  }): Promise<ArtifactRecord> {
    return this.client.$transaction(async (tx) => {
      const current = await tx.campaignAsset.findUniqueOrThrow({
        select: { campaignId: true, storageState: true },
        where: { id: input.artifactId },
      });
      if (current.storageState !== "pending") throw new Error("Artifact upload state changed.");

      const artifact = await tx.campaignAsset.update({
        data: {
          byteSize: BigInt(input.byteSize),
          mediaTypeDetected: input.mediaType,
          mimeType: input.mediaType,
          sha256Digest: input.sha256Digest,
          storageState: "ready",
        },
        select: artifactSelect,
        where: { id: input.artifactId },
      });
      if (!artifact.storageKey) throw new Error("Missing stored representation.");
      const revision = await tx.artifactRevision.create({
        data: {
          artifactId: artifact.id,
          number: 1,
          storageProvider: artifact.storageProvider,
          storageKey: artifact.storageKey,
          mediaType: input.mediaType,
          byteSize: BigInt(input.byteSize),
          sha256Digest: input.sha256Digest,
          originalFilename: artifact.originalFilename,
          actorUserId: input.actorUserId,
        },
      });
      await tx.campaignAsset.update({
        where: { id: artifact.id },
        data: { currentRevisionId: revision.id },
      });
      artifact.currentRevisionId = revision.id;
      await this.appendAudit(tx, {
        action: "upload",
        actorUserId: input.actorUserId,
        artifactId: artifact.id,
        campaignId: artifact.campaignId,
        metadata: { byteSize: input.byteSize, mediaType: input.mediaType },
      });
      return artifact;
    });
  }

  async markFailed(input: { artifactId: string; cleanupPending: boolean }): Promise<void> {
    await this.client.campaignAsset.updateMany({
      data: {
        storageDeletePending: input.cleanupPending,
        ...(!input.cleanupPending ? { storageKey: null } : {}),
        storageState: "failed",
      },
      where: { id: input.artifactId, storageState: "pending" },
    });
  }

  async get(campaignId: string, artifactId: string): Promise<ArtifactRecord | null> {
    return this.client.campaignAsset.findUnique({
      select: artifactSelect,
      where: { campaignId_id: { campaignId, id: artifactId } },
    });
  }

  async listForCampaign(campaignId: string): Promise<ArtifactRecord[]> {
    return this.client.campaignAsset.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: artifactSelect,
      where: { campaignId },
    });
  }

  async listCampaignPublished(campaignId: string): Promise<ArtifactRecord[]> {
    return this.client.campaignAsset.findMany({
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: artifactSelect,
      where: {
        audience: "campaign",
        campaignId,
        lifecycleState: { in: ["active", "archived"] },
        storageState: "ready",
      },
    });
  }

  async listScenarioPublished(campaignId: string): Promise<
    Array<{
      artifact: ArtifactRecord;
      scenarioId: string;
      referenceId: string;
      title: string;
      caption?: string;
      altText?: string;
    }>
  > {
    const rows = await this.client.scenarioArtifactReference.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        altTextSnapshot: true,
        artifact: { select: artifactSelect },
        captionSnapshot: true,
        id: true,
        scenarioId: true,
        titleSnapshot: true,
      },
      where: {
        artifact: {
          lifecycleState: { in: ["active", "archived"] },
          storageState: "ready",
        },
        campaignId,
        state: "published",
      },
    });
    return rows.map((row) => ({
      altText: row.altTextSnapshot ?? undefined,
      artifact: row.artifact,
      caption: row.captionSnapshot ?? undefined,
      referenceId: row.id,
      scenarioId: row.scenarioId,
      title: row.titleSnapshot,
    }));
  }

  async updateMetadata(input: {
    actorUserId: string;
    altText?: string | null;
    artifactId: string;
    campaignId: string;
    description?: string | null;
    expectedVersion: number;
    protectPlayerVisualAlt?: boolean;
    title?: string;
  }): Promise<ArtifactRecord | null> {
    return this.client.$transaction(async (tx) => {
      const result = await tx.campaignAsset.updateMany({
        data: {
          ...(input.altText !== undefined ? { altText: input.altText } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          metadataVersion: { increment: 1 },
          ...(input.title !== undefined ? { title: input.title } : {}),
        },
        where: {
          campaignId: input.campaignId,
          id: input.artifactId,
          lifecycleState: { not: "deleted" },
          metadataVersion: input.expectedVersion,
          ...(input.protectPlayerVisualAlt
            ? {
                artifactReferences: { none: { state: "published" } },
                audience: { not: "campaign" },
              }
            : {}),
        },
      });
      if (result.count !== 1) return null;
      const artifact = await tx.campaignAsset.findUniqueOrThrow({
        select: artifactSelect,
        where: { id: input.artifactId },
      });
      await this.appendAudit(tx, {
        action: "metadata_edit",
        actorUserId: input.actorUserId,
        artifactId: artifact.id,
        campaignId: artifact.campaignId,
        metadata: { metadataVersion: artifact.metadataVersion },
      });
      return artifact;
    });
  }

  async setAudience(input: {
    actorUserId: string;
    artifactId: string;
    audience: "gm_private" | "campaign";
    campaignId: string;
    expectedVersion: number;
  }): Promise<ArtifactRecord | null> {
    return this.client.$transaction(async (tx) => {
      const remainingPublished =
        input.audience === "gm_private"
          ? await tx.scenarioArtifactReference.count({
              where: { artifactId: input.artifactId, state: "published" },
            })
          : 0;
      const persistedAudience =
        input.audience === "campaign"
          ? "campaign"
          : remainingPublished > 0
            ? "scenario"
            : "gm_private";
      const result = await tx.campaignAsset.updateMany({
        data: {
          audience: persistedAudience,
          metadataVersion: { increment: 1 },
          visibility: persistedAudience === "campaign" ? "visible_to_all" : "gm_only",
        },
        where: {
          campaignId: input.campaignId,
          id: input.artifactId,
          lifecycleState: input.audience === "campaign" ? "active" : { in: ["active", "archived"] },
          metadataVersion: input.expectedVersion,
          storageState: "ready",
        },
      });
      if (result.count !== 1) return null;
      const artifact = await tx.campaignAsset.findUniqueOrThrow({
        select: artifactSelect,
        where: { id: input.artifactId },
      });
      await this.appendAudit(tx, {
        action: "audience_change",
        actorUserId: input.actorUserId,
        artifactId: artifact.id,
        campaignId: artifact.campaignId,
        metadata: { audience: persistedAudience, campaignPublished: input.audience === "campaign" },
      });
      return artifact;
    });
  }

  async mutateReference(input: {
    action: "attach" | "publish" | "withdraw";
    actorUserId: string;
    altText?: string | null;
    artifactId: string;
    campaignId: string;
    caption?: string | null;
    expectedArtifactVersion: number;
    expectedReferenceVersion?: number;
    scenarioId: string;
    sortOrder?: number | null;
    title?: string;
  }): Promise<{
    artifact: ArtifactRecord;
    reference: Prisma.ScenarioArtifactReferenceGetPayload<Record<string, never>>;
  } | null> {
    return this.client.$transaction(async (tx) => {
      const artifact = await tx.campaignAsset.findUnique({
        select: artifactSelect,
        where: { campaignId_id: { campaignId: input.campaignId, id: input.artifactId } },
      });
      const scenario = await tx.scenario.findUnique({
        select: { id: true },
        where: { campaignId_id: { campaignId: input.campaignId, id: input.scenarioId } },
      });
      if (!artifact || !scenario || artifact.metadataVersion !== input.expectedArtifactVersion) {
        return null;
      }
      if (
        artifact.storageState !== "ready" ||
        (input.action !== "withdraw" && artifact.lifecycleState !== "active") ||
        artifact.lifecycleState === "deleted"
      ) {
        return null;
      }

      const existing = await tx.scenarioArtifactReference.findUnique({
        where: {
          scenarioId_artifactId: { artifactId: input.artifactId, scenarioId: input.scenarioId },
        },
      });
      const expectedReferenceVersion = input.expectedReferenceVersion ?? 0;
      if ((existing?.version ?? 0) !== expectedReferenceVersion) return null;
      if (input.action !== "attach" && !existing) return null;

      const reserved = await tx.campaignAsset.updateMany({
        data: { metadataVersion: { increment: 1 } },
        where: {
          campaignId: input.campaignId,
          id: input.artifactId,
          metadataVersion: input.expectedArtifactVersion,
        },
      });
      if (reserved.count !== 1) return null;

      let reference;
      if (input.action === "attach") {
        reference = existing
          ? await tx.scenarioArtifactReference.update({
              data: {
                altTextSnapshot: input.altText ?? artifact.altText,
                captionSnapshot: input.caption,
                sortOrder: input.sortOrder,
                state: "attached",
                titleSnapshot: input.title ?? artifact.title,
                version: { increment: 1 },
                withdrawnAt: null,
              },
              where: { id: existing.id },
            })
          : await tx.scenarioArtifactReference.create({
              data: {
                altTextSnapshot: input.altText ?? artifact.altText,
                artifactId: artifact.id,
                attachedByUserId: input.actorUserId,
                campaignId: input.campaignId,
                captionSnapshot: input.caption,
                scenarioId: input.scenarioId,
                sortOrder: input.sortOrder,
                state: "attached",
                titleSnapshot: input.title ?? artifact.title,
              },
            });
      } else {
        if (!existing) throw new Error("Scenario Artifact reference disappeared.");
        reference =
          input.action === "publish"
            ? await tx.scenarioArtifactReference.update({
                data: {
                  altTextSnapshot: input.altText ?? existing.altTextSnapshot ?? artifact.altText,
                  captionSnapshot: input.caption ?? existing.captionSnapshot,
                  publishedAt: new Date(),
                  publishedByUserId: input.actorUserId,
                  sortOrder: input.sortOrder ?? existing.sortOrder,
                  state: "published",
                  titleSnapshot: input.title ?? existing.titleSnapshot,
                  version: { increment: 1 },
                  withdrawnAt: null,
                },
                where: { id: existing.id },
              })
            : await tx.scenarioArtifactReference.update({
                data: { state: "withdrawn", version: { increment: 1 }, withdrawnAt: new Date() },
                where: { id: existing.id },
              });
      }

      const remainingPublished = await tx.scenarioArtifactReference.count({
        where: { artifactId: artifact.id, state: "published" },
      });
      const persistedAudience =
        artifact.audience === "campaign"
          ? "campaign"
          : remainingPublished > 0
            ? "scenario"
            : "gm_private";
      const updatedArtifact = await tx.campaignAsset.update({
        data: {
          audience: persistedAudience,
          visibility: persistedAudience === "campaign" ? "visible_to_all" : "gm_only",
        },
        select: artifactSelect,
        where: { id: artifact.id },
      });
      await this.appendAudit(tx, {
        action: `scenario_${input.action}`,
        actorUserId: input.actorUserId,
        artifactId: artifact.id,
        campaignId: artifact.campaignId,
        metadata: { referenceId: reference.id, scenarioId: input.scenarioId },
      });
      return { artifact: updatedArtifact, reference };
    });
  }

  async setLifecycle(input: {
    actorUserId: string;
    artifactId: string;
    campaignId: string;
    expectedVersion: number;
    lifecycle: "active" | "archived";
  }): Promise<ArtifactRecord | null> {
    return this.client.$transaction(async (tx) => {
      const result = await tx.campaignAsset.updateMany({
        data: { lifecycleState: input.lifecycle, metadataVersion: { increment: 1 } },
        where: {
          campaignId: input.campaignId,
          id: input.artifactId,
          lifecycleState: input.lifecycle === "archived" ? "active" : "archived",
          metadataVersion: input.expectedVersion,
          storageState: "ready",
        },
      });
      if (result.count !== 1) return null;
      const artifact = await tx.campaignAsset.findUniqueOrThrow({
        select: artifactSelect,
        where: { id: input.artifactId },
      });
      await this.appendAudit(tx, {
        action: input.lifecycle === "archived" ? "archive" : "restore",
        actorUserId: input.actorUserId,
        artifactId: artifact.id,
        campaignId: artifact.campaignId,
      });
      return artifact;
    });
  }

  async tombstone(input: {
    actorUserId: string;
    artifactId: string;
    campaignId: string;
    expectedVersion: number;
  }): Promise<ArtifactRecord | null> {
    return this.client.$transaction(async (tx) => {
      const artifact = await tx.campaignAsset.findUnique({
        select: artifactSelect,
        where: { campaignId_id: { campaignId: input.campaignId, id: input.artifactId } },
      });
      if (!artifact || artifact.metadataVersion !== input.expectedVersion) return null;
      const publishedReferences = await tx.scenarioArtifactReference.count({
        where: { artifactId: artifact.id, state: "published" },
      });
      if (artifact.audience === "campaign" || publishedReferences > 0) {
        throw new Error("Artifact must be withdrawn before deletion.");
      }
      const updated = await tx.campaignAsset.update({
        data: {
          audience: "gm_private",
          deletedAt: new Date(),
          lifecycleState: "deleted",
          metadataVersion: { increment: 1 },
          storageState: "deleted",
          visibility: "gm_only",
        },
        select: artifactSelect,
        where: { id: artifact.id },
      });
      await this.appendAudit(tx, {
        action: "delete",
        actorUserId: input.actorUserId,
        artifactId: artifact.id,
        campaignId: artifact.campaignId,
      });
      return updated;
    });
  }

  async recordCleanup(input: {
    actorUserId: string;
    artifactId: string;
    campaignId: string;
    pending: boolean;
  }): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.campaignAsset.update({
        data: {
          storageDeletePending: input.pending,
          ...(input.pending ? {} : { storageKey: null }),
        },
        where: { id: input.artifactId },
      });
      await this.appendAudit(tx, {
        action: input.pending ? "cleanup_failed" : "cleanup_completed",
        actorUserId: input.actorUserId,
        artifactId: input.artifactId,
        campaignId: input.campaignId,
      });
    });
  }

  async listAudit(campaignId: string, artifactId: string) {
    return this.client.artifactAuditEvent.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { action: true, actorUserId: true, createdAt: true, id: true, metadataJson: true },
      where: { artifactId, campaignId },
    });
  }

  async listReferences(campaignId: string) {
    return this.client.scenarioArtifactReference.findMany({
      orderBy: [{ scenarioId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      where: { campaignId },
    });
  }

  async hasPublishedReferences(artifactId: string): Promise<boolean> {
    return (
      (await this.client.scenarioArtifactReference.count({
        where: { artifactId, state: "published" },
      })) > 0
    );
  }

  async listBlackboardCandidates(campaignId: string): Promise<ArtifactRecord[]> {
    return this.client.campaignAsset.findMany({
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: artifactSelect,
      where: {
        artifactKind: { in: ["map", "image"] },
        altText: { not: null },
        audience: "campaign",
        campaignId,
        lifecycleState: "active",
        mediaTypeDetected: { in: ["image/png", "image/jpeg", "image/webp"] },
        storageState: "ready",
      },
    });
  }

  async resolveBlackboardCandidate(
    tx: TransactionClient,
    campaignId: string,
    artifactId: string,
  ): Promise<ArtifactBlackboardCandidate | null> {
    const rows = await tx.$queryRaw<
      Array<{
        altText: string;
        artifactKind: "map" | "image";
        id: string;
        mediaType: "image/png" | "image/jpeg" | "image/webp";
        title: string;
      }>
    >(Prisma.sql`
      SELECT
        "id",
        "artifactKind",
        "title",
        "altText",
        "mediaTypeDetected" AS "mediaType"
      FROM "CampaignAsset"
      WHERE "campaignId" = ${campaignId}
        AND "id" = ${artifactId}
        AND "artifactKind" IN ('map', 'image')
        AND "audience" = 'campaign'
        AND "lifecycleState" = 'active'
        AND "storageState" = 'ready'
        AND "mediaTypeDetected" IN ('image/png', 'image/jpeg', 'image/webp')
        AND "altText" IS NOT NULL
        AND char_length(btrim("altText")) BETWEEN 1 AND 1000
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  async getBlackboardCandidate(
    campaignId: string,
    artifactId: string,
  ): Promise<(ArtifactBlackboardCandidate & { revisionCreatedAt?: Date }) | null> {
    const rows = await this.client.$queryRaw<
      Array<{
        revisionCreatedAt?: Date;
        altText: string;
        artifactKind: "map" | "image";
        id: string;
        mediaType: "image/png" | "image/jpeg" | "image/webp";
        title: string;
      }>
    >(Prisma.sql`
      SELECT
        (SELECT r."createdAt" FROM "ArtifactRevision" r WHERE r."id" = "CampaignAsset"."currentRevisionId") AS "revisionCreatedAt",
        "id",
        "artifactKind",
        "title",
        "altText",
        "mediaTypeDetected" AS "mediaType"
      FROM "CampaignAsset"
      WHERE "campaignId" = ${campaignId}
        AND "id" = ${artifactId}
        AND "artifactKind" IN ('map', 'image')
        AND "audience" = 'campaign'
        AND "lifecycleState" IN ('active', 'archived')
        AND "storageState" = 'ready'
        AND "mediaTypeDetected" IN ('image/png', 'image/jpeg', 'image/webp')
        AND "altText" IS NOT NULL
        AND char_length(btrim("altText")) BETWEEN 1 AND 1000
    `);
    return rows[0] ?? null;
  }

  async history(campaignId: string, artifactId: string) {
    return this.client.artifactRevision.findMany({
      where: { artifactId, artifact: { campaignId } },
      orderBy: { number: "desc" },
    });
  }

  async usages(campaignId: string, artifactId: string) {
    const [references, maps, workspaceMaps, links] = await Promise.all([
      this.client.scenarioArtifactReference.findMany({
        where: { campaignId, artifactId },
        select: { state: true, scenario: { select: { id: true, name: true } } },
      }),
      this.client.scenario.findMany({
        where: { campaignId, mapAssetId: artifactId },
        select: { id: true, name: true },
      }),
      this.client.campaignMap.findMany({
        where: { backgroundArtifactId: artifactId, campaignId },
        select: { id: true, name: true },
      }),
      this.client.campaignBlackboardArtifactSourceLink.findMany({
        where: { campaignId, artifactId },
      }),
    ]);
    const entries = await this.client.campaignBlackboardEntry.findMany({
      where: { campaignId, id: { in: links.map((link) => link.entryId) } },
      select: { id: true, currentRevisionNumber: true, state: true },
    });
    const revisions = await this.client.campaignBlackboardEntryRevision.findMany({
      where: { campaignId, entryId: { in: links.map((link) => link.entryId) } },
      select: { entryId: true, revisionNumber: true, title: true },
    });
    return {
      references,
      maps,
      workspaceMaps,
      links: links.map((link) => ({
        ...link,
        title:
          revisions.find(
            (r) => r.entryId === link.entryId && r.revisionNumber === link.revisionNumber,
          )?.title ?? "Blackboard entry",
        current: entries.some(
          (entry) =>
            entry.id === link.entryId &&
            entry.currentRevisionNumber === link.revisionNumber &&
            entry.state !== "withdrawn",
        ),
      })),
    };
  }

  private async appendAudit(
    tx: TransactionClient,
    input: {
      action: string;
      actorUserId: string;
      artifactId: string;
      campaignId: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await tx.artifactAuditEvent.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId,
        artifactId: input.artifactId,
        campaignId: input.campaignId,
        metadataJson: input.metadata,
      },
    });
  }
}
