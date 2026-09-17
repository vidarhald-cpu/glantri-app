import { Prisma, type PrismaClient } from "@prisma/client";

import type { CampaignMapCreate, CampaignMapMutation } from "@glantri/domain";

import { prisma } from "../client";

const markerSelect = {
  description: true,
  destinationMapId: true,
  entityLabelSnapshot: true,
  entityReferenceId: true,
  entityReferenceType: true,
  id: true,
  kind: true,
  label: true,
  presentation: true,
  sortOrder: true,
  visibility: true,
  x: true,
  y: true,
} satisfies Prisma.CampaignMapMarkerSelect;

const mapSelect = {
  access: true,
  backgroundArtifactId: true,
  campaignId: true,
  createdAt: true,
  description: true,
  id: true,
  layers: {
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
    select: {
      id: true,
      markers: {
        orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
        select: markerSelect,
      },
      name: true,
      sortOrder: true,
      visibility: true,
    },
  },
  name: true,
  role: true,
  updatedAt: true,
  version: true,
} satisfies Prisma.CampaignMapSelect;

const mapSummarySelect = {
  access: true,
  description: true,
  id: true,
  name: true,
  role: true,
  updatedAt: true,
} satisfies Prisma.CampaignMapSelect;

export type CampaignMapRecord = Prisma.CampaignMapGetPayload<{ select: typeof mapSelect }>;
export type CampaignMapSummaryRecord = Prisma.CampaignMapGetPayload<{
  select: typeof mapSummarySelect;
}>;

export class CampaignMapConflictError extends Error {
  constructor(readonly current: CampaignMapRecord) {
    super("This Map changed. Refresh it and review your work before saving again.");
    this.name = "CampaignMapConflictError";
  }
}

export class CampaignMapNotFoundError extends Error {
  constructor() {
    super("Map not found.");
    this.name = "CampaignMapNotFoundError";
  }
}

export class CampaignMapReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignMapReferenceError";
  }
}

type TransactionClient = Prisma.TransactionClient;

export class CampaignMapRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async getCampaignOwner(campaignId: string): Promise<string | null> {
    const campaign = await this.client.campaign.findUnique({
      select: { gmUserId: true },
      where: { id: campaignId },
    });
    return campaign?.gmUserId ?? null;
  }

  async list(campaignId: string): Promise<CampaignMapSummaryRecord[]> {
    return this.client.campaignMap.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: mapSummarySelect,
      where: { campaignId },
    });
  }

  async listShared(campaignId: string): Promise<CampaignMapSummaryRecord[]> {
    return this.client.campaignMap.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: mapSummarySelect,
      where: { access: "players", campaignId },
    });
  }

  async get(campaignId: string, mapId: string): Promise<CampaignMapRecord | null> {
    return this.client.campaignMap.findUnique({
      select: mapSelect,
      where: { campaignId_id: { campaignId, id: mapId } },
    });
  }

  async create(input: {
    actorUserId: string;
    campaignId: string;
    create: CampaignMapCreate;
  }): Promise<CampaignMapRecord> {
    return this.client.$transaction(async (tx) => {
      await this.assertOwner(tx, input.campaignId, input.actorUserId);
      await this.assertSelectableBackground(tx, {
        artifactId: input.create.backgroundArtifactId ?? null,
        campaignId: input.campaignId,
      });
      return tx.campaignMap.create({
        data: {
          access: input.create.access,
          backgroundArtifactId: input.create.backgroundArtifactId,
          campaignId: input.campaignId,
          createdByUserId: input.actorUserId,
          description: input.create.description,
          name: input.create.name,
          role: input.create.role,
          updatedByUserId: input.actorUserId,
        },
        select: mapSelect,
      });
    });
  }

  async replaceAggregate(input: {
    actorUserId: string;
    campaignId: string;
    mapId: string;
    mutation: CampaignMapMutation;
  }): Promise<CampaignMapRecord> {
    return this.client.$transaction(async (tx) => {
      await this.assertOwner(tx, input.campaignId, input.actorUserId);
      const current = await tx.campaignMap.findUnique({
        select: mapSelect,
        where: { campaignId_id: { campaignId: input.campaignId, id: input.mapId } },
      });
      if (!current) throw new CampaignMapNotFoundError();
      if (current.version !== input.mutation.expectedVersion) {
        throw new CampaignMapConflictError(current);
      }
      if (input.mutation.backgroundArtifactId !== current.backgroundArtifactId) {
        await this.assertSelectableBackground(tx, {
          artifactId: input.mutation.backgroundArtifactId,
          campaignId: input.campaignId,
        });
      }
      await this.assertMapLinks(tx, input.campaignId, input.mutation);
      await this.assertNewEntityReferences(
        tx,
        input.campaignId,
        input.actorUserId,
        current,
        input.mutation,
      );

      const reserved = await tx.campaignMap.updateMany({
        data: {
          access: input.mutation.access,
          backgroundArtifactId: input.mutation.backgroundArtifactId,
          description: input.mutation.description,
          name: input.mutation.name,
          role: input.mutation.role,
          updatedByUserId: input.actorUserId,
          version: { increment: 1 },
        },
        where: {
          campaignId: input.campaignId,
          id: input.mapId,
          version: input.mutation.expectedVersion,
        },
      });
      if (reserved.count !== 1) {
        const latest = await tx.campaignMap.findUniqueOrThrow({
          select: mapSelect,
          where: { campaignId_id: { campaignId: input.campaignId, id: input.mapId } },
        });
        throw new CampaignMapConflictError(latest);
      }

      await tx.campaignMapMarker.deleteMany({ where: { mapId: input.mapId } });
      await tx.campaignMapLayer.deleteMany({ where: { mapId: input.mapId } });
      for (const layer of input.mutation.layers) {
        await tx.campaignMapLayer.create({
          data: {
            id: layer.id,
            mapId: input.mapId,
            name: layer.name,
            sortOrder: layer.sortOrder,
            visibility: layer.visibility,
          },
        });
        if (layer.markers.length > 0) {
          await tx.campaignMapMarker.createMany({
            data: layer.markers.map((marker) => ({
              campaignId: input.campaignId,
              description: marker.description,
              destinationMapId: marker.destinationMapId,
              entityLabelSnapshot: marker.entityLabelSnapshot,
              entityReferenceId: marker.entityReferenceId,
              entityReferenceType: marker.entityReferenceType,
              id: marker.id,
              kind: marker.kind,
              label: marker.label,
              layerId: layer.id,
              mapId: input.mapId,
              presentation: marker.presentation,
              sortOrder: marker.sortOrder,
              visibility: marker.visibility,
              x: marker.x,
              y: marker.y,
            })),
          });
        }
      }
      return tx.campaignMap.findUniqueOrThrow({
        select: mapSelect,
        where: { campaignId_id: { campaignId: input.campaignId, id: input.mapId } },
      });
    });
  }

  async getBackground(campaignId: string, artifactId: string) {
    return this.client.campaignAsset.findUnique({
      select: {
        altText: true,
        artifactKind: true,
        audience: true,
        id: true,
        lifecycleState: true,
        mediaTypeDetected: true,
        storageState: true,
        title: true,
      },
      where: { campaignId_id: { id: artifactId, campaignId } },
    });
  }

  async listAuthoringArtifacts(campaignId: string) {
    return this.client.campaignAsset.findMany({
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: { altText: true, id: true, title: true },
      where: {
        artifactKind: { in: ["map", "image"] },
        campaignId,
        currentRevisionId: { not: null },
        lifecycleState: "active",
        mediaTypeDetected: { in: ["image/png", "image/jpeg", "image/webp"] },
        storageState: "ready",
      },
    });
  }

  async listAuthoringCharacters(campaignId: string) {
    return this.client.campaignRosterEntry.findMany({
      orderBy: [{ labelSnapshot: "asc" }, { id: "asc" }],
      select: { labelSnapshot: true, sourceId: true },
      where: { campaignId, sourceType: "character" },
    });
  }

  async listAuthoringEntities(campaignId: string, gmUserId: string) {
    const rows = await this.client.reusableEntity.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, snapshotJson: true },
      where: { gmUserId },
    });
    return rows.filter((row) => {
      const snapshot = row.snapshotJson;
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return true;
      const record = snapshot as Record<string, unknown>;
      return record.actorClass !== "campaign_npc" || record.campaignId === campaignId;
    });
  }

  async isReferenceAvailable(input: {
    campaignId: string;
    referenceId: string;
    referenceType: "character" | "reusable_entity";
  }): Promise<boolean> {
    if (input.referenceType === "character") {
      return (
        (await this.client.campaignRosterEntry.count({
          where: {
            campaignId: input.campaignId,
            sourceId: input.referenceId,
            sourceType: "character",
          },
        })) === 1
      );
    }
    const owner = await this.getCampaignOwner(input.campaignId);
    if (!owner) return false;
    const rows = await this.listAuthoringEntities(input.campaignId, owner);
    return rows.some((row) => row.id === input.referenceId);
  }

  private async assertOwner(tx: TransactionClient, campaignId: string, actorUserId: string) {
    const campaign = await tx.campaign.findUnique({
      select: { gmUserId: true },
      where: { id: campaignId },
    });
    if (!campaign || campaign.gmUserId !== actorUserId) throw new CampaignMapNotFoundError();
  }

  private async assertSelectableBackground(
    tx: TransactionClient,
    input: { artifactId: string | null; campaignId: string },
  ) {
    if (!input.artifactId) return;
    const artifact = await tx.campaignAsset.findUnique({
      select: { id: true },
      where: { campaignId_id: { campaignId: input.campaignId, id: input.artifactId } },
    });
    const eligible = await tx.campaignAsset.count({
      where: {
        artifactKind: { in: ["map", "image"] },
        campaignId: input.campaignId,
        currentRevisionId: { not: null },
        id: input.artifactId,
        lifecycleState: "active",
        mediaTypeDetected: { in: ["image/png", "image/jpeg", "image/webp"] },
        storageState: "ready",
      },
    });
    if (!artifact || eligible !== 1) {
      throw new CampaignMapReferenceError("Choose an active visual Artifact from this Campaign.");
    }
  }

  private async assertMapLinks(
    tx: TransactionClient,
    campaignId: string,
    mutation: CampaignMapMutation,
  ) {
    const destinationIds = [
      ...new Set(
        mutation.layers.flatMap((layer) =>
          layer.markers.flatMap((marker) =>
            marker.kind === "map_link" && marker.destinationMapId ? [marker.destinationMapId] : [],
          ),
        ),
      ),
    ];
    if (destinationIds.length === 0) return;
    const count = await tx.campaignMap.count({ where: { campaignId, id: { in: destinationIds } } });
    if (count !== destinationIds.length) {
      throw new CampaignMapReferenceError("A linked Map is no longer available.");
    }
  }

  private async assertNewEntityReferences(
    tx: TransactionClient,
    campaignId: string,
    actorUserId: string,
    current: CampaignMapRecord,
    mutation: CampaignMapMutation,
  ) {
    const existing = new Map(
      current.layers.flatMap((layer) =>
        layer.markers.map((marker) => [
          marker.id,
          `${marker.entityReferenceType ?? ""}:${marker.entityReferenceId ?? ""}`,
        ]),
      ),
    );
    for (const marker of mutation.layers.flatMap((layer) => layer.markers)) {
      if (
        marker.kind !== "entity_reference" ||
        !marker.entityReferenceId ||
        !marker.entityReferenceType
      ) {
        continue;
      }
      const referenceKey = `${marker.entityReferenceType}:${marker.entityReferenceId}`;
      if (existing.get(marker.id) === referenceKey) continue;
      if (marker.entityReferenceType === "character") {
        const count = await tx.campaignRosterEntry.count({
          where: {
            campaignId,
            sourceId: marker.entityReferenceId,
            sourceType: "character",
          },
        });
        if (count !== 1) {
          throw new CampaignMapReferenceError(
            "Choose a current or former Character in this Campaign.",
          );
        }
      } else {
        const entity = await tx.reusableEntity.findFirst({
          select: { snapshotJson: true },
          where: { gmUserId: actorUserId, id: marker.entityReferenceId },
        });
        const snapshot = entity?.snapshotJson;
        const record =
          snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
            ? (snapshot as Record<string, unknown>)
            : undefined;
        if (
          !entity ||
          (record?.actorClass === "campaign_npc" && record.campaignId !== campaignId)
        ) {
          throw new CampaignMapReferenceError("Choose an available NPC, monster or animal.");
        }
      }
    }
  }
}
