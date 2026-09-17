import {
  campaignMapCreateSchema,
  campaignMapMutationSchema,
  type CampaignMapAuthoringOptions,
  type CampaignMapGmDto,
  type CampaignMapGmMarker,
  type CampaignMapPlayerDto,
  type CampaignMapPlayerMarker,
  type CampaignMapSummary,
} from "@glantri/domain";

import {
  CampaignMapNotFoundError,
  CampaignMapRepository,
  type CampaignMapRecord,
} from "../repositories/mapRepository";
import { CampaignService } from "./campaignService";

export {
  CampaignMapConflictError,
  CampaignMapNotFoundError,
  CampaignMapReferenceError,
} from "../repositories/mapRepository";

function toSummary(record: {
  access: "gm_only" | "players";
  description: string;
  id: string;
  name: string;
  role: "world_region" | "area" | "tactical";
  updatedAt: Date;
}): CampaignMapSummary {
  return { ...record, updatedAt: record.updatedAt.toISOString() };
}

function toPlayerMarker(
  marker: CampaignMapRecord["layers"][number]["markers"][number],
): CampaignMapPlayerMarker {
  return {
    description: marker.description,
    ...(marker.kind === "map_link" && marker.destinationMapId
      ? { destinationMapId: marker.destinationMapId }
      : {}),
    id: marker.id,
    kind: marker.kind,
    label: marker.label,
    presentation: marker.presentation,
    sortOrder: marker.sortOrder,
    x: marker.x,
    y: marker.y,
  };
}

export class CampaignMapService {
  constructor(
    private readonly repository = new CampaignMapRepository(),
    private readonly campaigns = new CampaignService(),
  ) {}

  async listForUser(
    campaignId: string,
    userId: string,
  ): Promise<
    { maps: CampaignMapSummary[]; mode: "gm" } | { maps: CampaignMapSummary[]; mode: "player" }
  > {
    if ((await this.repository.getCampaignOwner(campaignId)) === userId) {
      return { maps: (await this.repository.list(campaignId)).map(toSummary), mode: "gm" };
    }
    await this.assertPlayerCampaignAccess(campaignId, userId);
    return { maps: (await this.repository.listShared(campaignId)).map(toSummary), mode: "player" };
  }

  async getForUser(
    campaignId: string,
    mapId: string,
    userId: string,
  ): Promise<
    { map: CampaignMapGmDto; mode: "gm" } | { map: CampaignMapPlayerDto; mode: "player" }
  > {
    const record = await this.repository.get(campaignId, mapId);
    if (!record) throw new CampaignMapNotFoundError();
    if ((await this.repository.getCampaignOwner(campaignId)) === userId) {
      return { map: await this.toGmDto(record), mode: "gm" };
    }
    await this.assertPlayerCampaignAccess(campaignId, userId);
    if (record.access !== "players") throw new CampaignMapNotFoundError();
    return { map: await this.toPlayerDto(record), mode: "player" };
  }

  async create(input: {
    actorUserId: string;
    campaignId: string;
    payload: unknown;
  }): Promise<CampaignMapGmDto> {
    const record = await this.repository.create({
      actorUserId: input.actorUserId,
      campaignId: input.campaignId,
      create: campaignMapCreateSchema.parse(input.payload),
    });
    return this.toGmDto(record);
  }

  async replaceAggregate(input: {
    actorUserId: string;
    campaignId: string;
    mapId: string;
    payload: unknown;
  }): Promise<CampaignMapGmDto> {
    const record = await this.repository.replaceAggregate({
      actorUserId: input.actorUserId,
      campaignId: input.campaignId,
      mapId: input.mapId,
      mutation: campaignMapMutationSchema.parse(input.payload),
    });
    return this.toGmDto(record);
  }

  async authoringOptions(
    campaignId: string,
    actorUserId: string,
  ): Promise<CampaignMapAuthoringOptions> {
    if ((await this.repository.getCampaignOwner(campaignId)) !== actorUserId) {
      throw new CampaignMapNotFoundError();
    }
    const [artifacts, characters, entities, maps] = await Promise.all([
      this.repository.listAuthoringArtifacts(campaignId),
      this.repository.listAuthoringCharacters(campaignId),
      this.repository.listAuthoringEntities(campaignId, actorUserId),
      this.repository.list(campaignId),
    ]);
    return {
      artifacts: artifacts.map((artifact) => ({
        ...(artifact.altText ? { altText: artifact.altText } : {}),
        id: artifact.id,
        title: artifact.title,
      })),
      entities: [
        ...characters.map((character) => ({
          id: character.sourceId,
          label: character.labelSnapshot ?? "Campaign Character",
          type: "character" as const,
        })),
        ...entities.map((entity) => ({
          id: entity.id,
          label: entity.name,
          type: "reusable_entity" as const,
        })),
      ],
      maps: maps.map((map) => ({ id: map.id, name: map.name })),
    };
  }

  async getBackgroundArtifactIdForUser(input: {
    campaignId: string;
    mapId: string;
    userId: string;
  }): Promise<string> {
    const record = await this.repository.get(input.campaignId, input.mapId);
    if (!record?.backgroundArtifactId) throw new CampaignMapNotFoundError();
    const owner = await this.repository.getCampaignOwner(input.campaignId);
    if (owner !== input.userId) {
      await this.assertPlayerCampaignAccess(input.campaignId, input.userId);
      if (record.access !== "players") throw new CampaignMapNotFoundError();
      const background = await this.repository.getBackground(
        input.campaignId,
        record.backgroundArtifactId,
      );
      if (
        !background ||
        background.audience !== "campaign" ||
        background.storageState !== "ready" ||
        background.lifecycleState === "deleted" ||
        !["map", "image"].includes(background.artifactKind ?? "") ||
        !background.altText?.trim()
      ) {
        throw new CampaignMapNotFoundError();
      }
    }
    return record.backgroundArtifactId;
  }

  private async assertPlayerCampaignAccess(campaignId: string, userId: string) {
    const campaigns = await this.campaigns.listCampaignsByUserAccess(userId);
    if (!campaigns.some((campaign) => campaign.id === campaignId && campaign.status === "active")) {
      throw new CampaignMapNotFoundError();
    }
  }

  private async toGmDto(record: CampaignMapRecord): Promise<CampaignMapGmDto> {
    const background = record.backgroundArtifactId
      ? await this.repository.getBackground(record.campaignId, record.backgroundArtifactId)
      : null;
    const layers = await Promise.all(
      record.layers.map(async (layer) => ({
        id: layer.id,
        markers: await Promise.all(
          layer.markers.map(
            async (marker): Promise<CampaignMapGmMarker> => ({
              description: marker.description,
              destinationMapId: marker.destinationMapId,
              entityLabelSnapshot: marker.entityLabelSnapshot,
              entityReferenceId: marker.entityReferenceId,
              entityReferenceType: marker.entityReferenceType,
              id: marker.id,
              kind: marker.kind,
              label: marker.label,
              presentation: marker.presentation,
              ...(marker.kind === "entity_reference" &&
              marker.entityReferenceId &&
              marker.entityReferenceType
                ? {
                    referenceStatus: (await this.repository.isReferenceAvailable({
                      campaignId: record.campaignId,
                      referenceId: marker.entityReferenceId,
                      referenceType: marker.entityReferenceType,
                    }))
                      ? "available"
                      : "unavailable",
                  }
                : {}),
              sortOrder: marker.sortOrder,
              visibility: marker.visibility,
              x: marker.x,
              y: marker.y,
            }),
          ),
        ),
        name: layer.name,
        sortOrder: layer.sortOrder,
        visibility: layer.visibility,
      })),
    );
    const backgroundReady = Boolean(
      background &&
      background.storageState === "ready" &&
      background.lifecycleState !== "deleted" &&
      ["map", "image"].includes(background.artifactKind ?? ""),
    );
    return {
      access: record.access,
      ...(background
        ? {
            background: {
              ...(background.altText ? { altText: background.altText } : {}),
              artifactId: background.id,
              available: backgroundReady,
              playerCanView:
                backgroundReady &&
                background.audience === "campaign" &&
                Boolean(background.altText?.trim()),
              title: background.title,
            },
          }
        : {}),
      backgroundArtifactId: record.backgroundArtifactId,
      campaignId: record.campaignId,
      createdAt: record.createdAt.toISOString(),
      description: record.description,
      id: record.id,
      layers,
      name: record.name,
      role: record.role,
      updatedAt: record.updatedAt.toISOString(),
      version: record.version,
    };
  }

  private async toPlayerDto(record: CampaignMapRecord): Promise<CampaignMapPlayerDto> {
    const background = record.backgroundArtifactId
      ? await this.repository.getBackground(record.campaignId, record.backgroundArtifactId)
      : null;
    const sharedDestinationIds = new Set(
      (await this.repository.listShared(record.campaignId)).map((map) => map.id),
    );
    const mayProjectMarker = (marker: CampaignMapRecord["layers"][number]["markers"][number]) =>
      marker.kind !== "map_link" ||
      !marker.destinationMapId ||
      sharedDestinationIds.has(marker.destinationMapId);
    const visibleLayers = record.layers
      .filter((layer) => layer.visibility === "player_visible")
      .map((layer) => ({
        id: layer.id,
        markers: layer.markers
          .filter((marker) => marker.visibility !== "gm_only" && mayProjectMarker(marker))
          .map(toPlayerMarker),
        name: layer.name,
        sortOrder: layer.sortOrder,
      }));
    const revealedMarkers = record.layers
      .filter((layer) => layer.visibility === "gm_only")
      .flatMap((layer) =>
        layer.markers
          .filter((marker) => marker.visibility === "player_visible" && mayProjectMarker(marker))
          .map(toPlayerMarker),
      );
    const backgroundVisible = Boolean(
      background &&
      background.audience === "campaign" &&
      background.storageState === "ready" &&
      background.lifecycleState !== "deleted" &&
      ["map", "image"].includes(background.artifactKind ?? "") &&
      background.altText?.trim(),
    );
    return {
      ...(backgroundVisible && background?.altText
        ? { background: { altText: background.altText, available: true } as const }
        : {}),
      description: record.description,
      id: record.id,
      layers: visibleLayers,
      name: record.name,
      revealedMarkers,
      role: record.role,
    };
  }
}
