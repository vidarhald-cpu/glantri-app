import {
  artifactAssociationDtoSchema,
  artifactAssociationProvenanceSchema,
  artifactAssociationRoleSchema,
  artifactAssociationTargetSchema,
  type ArtifactAssociationDto,
  type ArtifactAssociationProvenance,
  type ArtifactAssociationTarget,
  type ArtifactUploadMetadata,
} from "@glantri/domain";
import type { CampaignItemArtifactAttachment, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../client";
import { ArtifactConflictError, ArtifactNotFoundError, ArtifactService } from "./artifactService";

type AttachInput = {
  artifactId: string;
  campaignId: string;
  provenance: ArtifactAssociationProvenance;
  revisionId?: string;
  role: string;
  target: ArtifactAssociationTarget;
  userId: string;
};

function dto(row: CampaignItemArtifactAttachment): ArtifactAssociationDto {
  return artifactAssociationDtoSchema.parse({
    id: row.id,
    campaignId: row.campaignId,
    target: { kind: "item", id: row.itemId },
    artifactId: row.artifactId,
    role: row.role,
    revisionId: row.revisionId,
    provenance: { kind: row.provenanceKind, ref: row.provenanceRef ?? undefined },
    attachedByUserId: row.attachedByUserId,
    createdAt: row.createdAt.toISOString(),
    disassociatedAt: row.disassociatedAt?.toISOString() ?? null,
    disassociatedByUserId: row.disassociatedByUserId,
  });
}

/** Canonical typed association boundary. Physical storage is target-specific. */
export class ArtifactAssociationService {
  constructor(private readonly client: PrismaClient = prisma) {}

  private async requireOwningGm(campaignId: string, userId: string): Promise<void> {
    const owner = await this.client.campaign.findFirst({
      where: { id: campaignId, gmUserId: userId },
      select: { id: true },
    });
    if (!owner) throw new ArtifactNotFoundError();
  }

  async attachExisting(input: AttachInput): Promise<ArtifactAssociationDto> {
    await this.requireOwningGm(input.campaignId, input.userId);
    return dto(await this.client.$transaction((tx) => this.attachInTransaction(tx, input)));
  }

  /** Import and direct attachment share this owner-checked transaction path. */
  async attachInTransaction(
    tx: Prisma.TransactionClient,
    input: AttachInput,
  ): Promise<CampaignItemArtifactAttachment> {
    const target = artifactAssociationTargetSchema.parse(input.target);
    const role = artifactAssociationRoleSchema.parse(input.role);
    const provenance = artifactAssociationProvenanceSchema.parse(input.provenance);
    if (
      !(await tx.campaign.findFirst({
        where: { id: input.campaignId, gmUserId: input.userId },
        select: { id: true },
      }))
    )
      throw new ArtifactNotFoundError();
    const [item, artifact] = await Promise.all([
      tx.characterEquipmentItem.findFirst({
        where: { id: target.id, campaignContextId: input.campaignId },
        select: { id: true },
      }),
      tx.campaignAsset.findFirst({
        where: {
          id: input.artifactId,
          campaignId: input.campaignId,
          lifecycleState: "active",
          storageState: "ready",
        },
        select: { id: true },
      }),
    ]);
    if (!item || !artifact) throw new ArtifactNotFoundError();
    if (input.revisionId) {
      const revision = await tx.artifactRevision.findFirst({
        where: { id: input.revisionId, artifactId: input.artifactId },
        select: { id: true },
      });
      if (!revision) throw new ArtifactNotFoundError();
    }
    const existing = await tx.campaignItemArtifactAttachment.findFirst({
      where: {
        campaignId: input.campaignId,
        itemId: target.id,
        artifactId: input.artifactId,
        role,
        revisionId: input.revisionId ?? null,
        disassociatedAt: null,
      },
    });
    if (existing) return existing;
    const row = await tx.campaignItemArtifactAttachment.create({
      data: {
        campaignId: input.campaignId,
        itemId: target.id,
        artifactId: input.artifactId,
        role,
        revisionId: input.revisionId,
        provenanceKind: provenance.kind,
        provenanceRef: provenance.ref,
        attachedByUserId: input.userId,
      },
    });
    await tx.artifactAuditEvent.create({
      data: {
        campaignId: input.campaignId,
        artifactId: input.artifactId,
        actorUserId: input.userId,
        action: "item_representation_attach",
        metadataJson: {
          associationId: row.id,
          itemId: target.id,
          role,
          revisionId: input.revisionId ?? null,
          provenanceKind: provenance.kind,
          provenanceRef: provenance.ref ?? null,
        },
      },
    });
    return row;
  }

  async uploadNewAndAttach(
    input: Omit<AttachInput, "artifactId" | "provenance" | "revisionId"> & {
      content: AsyncIterable<Uint8Array>;
      declaredMediaType: string;
      metadata: ArtifactUploadMetadata;
      originalFilename?: string;
      pinUploadedRevision?: boolean;
    },
    artifactService: ArtifactService,
  ): Promise<{ artifactId: string; association: ArtifactAssociationDto }> {
    await this.requireOwningGm(input.campaignId, input.userId);
    const target = artifactAssociationTargetSchema.parse(input.target);
    artifactAssociationRoleSchema.parse(input.role);
    if (
      !(await this.client.characterEquipmentItem.findFirst({
        where: { id: target.id, campaignContextId: input.campaignId },
        select: { id: true },
      }))
    )
      throw new ArtifactNotFoundError();
    const artifact = await artifactService.upload({
      campaignId: input.campaignId,
      content: input.content,
      declaredMediaType: input.declaredMediaType,
      metadata: input.metadata,
      originalFilename: input.originalFilename,
      userId: input.userId,
    });
    const revisionId = input.pinUploadedRevision
      ? ((
          await this.client.campaignAsset.findUniqueOrThrow({
            where: { id: artifact.id },
            select: { currentRevisionId: true },
          })
        ).currentRevisionId ?? undefined)
      : undefined;
    if (input.pinUploadedRevision && !revisionId)
      throw new ArtifactConflictError("Uploaded Artifact has no revision.");
    const association = await this.attachExisting({
      artifactId: artifact.id,
      campaignId: input.campaignId,
      provenance: { kind: "upload" },
      revisionId,
      role: input.role,
      target: input.target,
      userId: input.userId,
    });
    return { artifactId: artifact.id, association };
  }

  async listByTarget(input: {
    campaignId: string;
    target: ArtifactAssociationTarget;
    userId: string;
    includeHistory?: boolean;
  }): Promise<ArtifactAssociationDto[]> {
    await this.requireOwningGm(input.campaignId, input.userId);
    const target = artifactAssociationTargetSchema.parse(input.target);
    return (
      await this.client.campaignItemArtifactAttachment.findMany({
        where: {
          campaignId: input.campaignId,
          itemId: target.id,
          ...(input.includeHistory ? {} : { disassociatedAt: null }),
        },
        orderBy: { createdAt: "asc" },
      })
    ).map(dto);
  }

  async listByArtifact(input: {
    campaignId: string;
    artifactId: string;
    userId: string;
    includeHistory?: boolean;
  }): Promise<ArtifactAssociationDto[]> {
    await this.requireOwningGm(input.campaignId, input.userId);
    return (
      await this.client.campaignItemArtifactAttachment.findMany({
        where: {
          campaignId: input.campaignId,
          artifactId: input.artifactId,
          ...(input.includeHistory ? {} : { disassociatedAt: null }),
        },
        orderBy: { createdAt: "asc" },
      })
    ).map(dto);
  }

  async disassociate(input: {
    associationId: string;
    campaignId: string;
    userId: string;
  }): Promise<ArtifactAssociationDto> {
    await this.requireOwningGm(input.campaignId, input.userId);
    return this.client.$transaction(async (tx) => {
      const row = await tx.campaignItemArtifactAttachment.findFirst({
        where: { id: input.associationId, campaignId: input.campaignId, disassociatedAt: null },
      });
      if (!row) throw new ArtifactConflictError("Association is no longer active.");
      const result = await tx.campaignItemArtifactAttachment.updateMany({
        where: { id: row.id, disassociatedAt: null },
        data: { disassociatedAt: new Date(), disassociatedByUserId: input.userId },
      });
      if (result.count !== 1) throw new ArtifactConflictError("Association is no longer active.");
      const updated = await tx.campaignItemArtifactAttachment.findUniqueOrThrow({
        where: { id: row.id },
      });
      await tx.artifactAuditEvent.create({
        data: {
          campaignId: input.campaignId,
          artifactId: row.artifactId,
          actorUserId: input.userId,
          action: "item_representation_disassociate",
          metadataJson: { associationId: row.id, itemId: row.itemId, role: row.role },
        },
      });
      return dto(updated);
    });
  }
}
