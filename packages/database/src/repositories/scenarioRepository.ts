import {
  campaignAssetSchema,
  campaignRosterEntrySchema,
  campaignSchema,
  reusableEntitySchema,
  scenarioEventLogSchema,
  scenarioLiveStateSchema,
  scenarioParticipantSchema,
  scenarioSchema,
  type Campaign,
  type CampaignAsset,
  type CampaignRosterEntry,
  type CampaignSettings,
  type CampaignRosterCategory,
  type CampaignRosterSourceType,
  type ReusableEntity,
  type Scenario,
  type ScenarioEventLog,
  type ScenarioLiveState,
  type ScenarioParticipant,
  type ScenarioParticipantPosition,
  type ScenarioParticipantSnapshot,
  type ScenarioParticipantState
} from "@glantri/domain";
import { Prisma } from "@prisma/client";

import { prisma } from "../client";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function mapCampaign(record: {
  createdAt: Date;
  description: string;
  gmUserId: string;
  id: string;
  name: string;
  settingsJson: Prisma.JsonValue;
  slug: string;
  status: string;
  updatedAt: Date;
}): Campaign {
  return campaignSchema.parse({
    createdAt: record.createdAt.toISOString(),
    description: record.description,
    gmUserId: record.gmUserId,
    id: record.id,
    name: record.name,
    settings: record.settingsJson,
    slug: record.slug,
    status: record.status,
    updatedAt: record.updatedAt.toISOString()
  });
}

function mapScenario(record: {
  campaignId: string;
  createdAt: Date;
  description: string;
  id: string;
  kind: string;
  liveStateJson: Prisma.JsonValue | null;
  mapAssetId: string | null;
  name: string;
  status: string;
  updatedAt: Date;
}): Scenario {
  return scenarioSchema.parse({
    campaignId: record.campaignId,
    createdAt: record.createdAt.toISOString(),
    description: record.description,
    id: record.id,
    kind: record.kind,
    liveState: record.liveStateJson == null ? undefined : scenarioLiveStateSchema.parse(record.liveStateJson),
    mapAssetId: record.mapAssetId ?? undefined,
    name: record.name,
    status: record.status,
    updatedAt: record.updatedAt.toISOString()
  });
}

function mapReusableEntity(record: {
  createdAt: Date;
  description: string | null;
  gmUserId: string;
  id: string;
  kind: string;
  name: string;
  notes: string | null;
  snapshotJson: Prisma.JsonValue | null;
  updatedAt: Date;
}): ReusableEntity {
  return reusableEntitySchema.parse({
    createdAt: record.createdAt.toISOString(),
    description: record.description ?? undefined,
    gmUserId: record.gmUserId,
    id: record.id,
    kind: record.kind,
    name: record.name,
    notes: record.notes ?? undefined,
    snapshot: record.snapshotJson ?? undefined,
    updatedAt: record.updatedAt.toISOString()
  });
}

function mapScenarioParticipant(record: {
  characterId: string | null;
  controlledByUserId: string | null;
  createdAt: Date;
  displayOrder: number | null;
  entityId: string | null;
  factionId: string | null;
  id: string;
  initiativeSlot: number | null;
  isActive: boolean;
  joinSource: string;
  positionJson: Prisma.JsonValue | null;
  role: string;
  roleTag: string | null;
  scenarioId: string;
  snapshotJson: Prisma.JsonValue;
  sourceType: string;
  stateJson: Prisma.JsonValue;
  tacticalGroupId: string | null;
  updatedAt: Date;
  visibilityOverridesJson: Prisma.JsonValue | null;
}): ScenarioParticipant {
  return scenarioParticipantSchema.parse({
    characterId: record.characterId ?? undefined,
    controlledByUserId: record.controlledByUserId ?? undefined,
    createdAt: record.createdAt.toISOString(),
    displayOrder: record.displayOrder ?? undefined,
    entityId: record.entityId ?? undefined,
    factionId: record.factionId ?? undefined,
    id: record.id,
    initiativeSlot: record.initiativeSlot ?? undefined,
    isActive: record.isActive,
    joinSource: record.joinSource,
    position:
      record.positionJson == null
        ? undefined
        : (record.positionJson as ScenarioParticipantPosition),
    role: record.role,
    roleTag: record.roleTag ?? undefined,
    scenarioId: record.scenarioId,
    snapshot: record.snapshotJson,
    sourceType: record.sourceType,
    state: record.stateJson,
    tacticalGroupId: record.tacticalGroupId ?? undefined,
    updatedAt: record.updatedAt.toISOString(),
    visibilityOverrides:
      record.visibilityOverridesJson == null
        ? undefined
        : (record.visibilityOverridesJson as ScenarioParticipant["visibilityOverrides"])
  });
}

function mapCampaignAsset(record: {
  campaignId: string;
  createdAt: Date;
  createdByUserId: string;
  description: string | null;
  id: string;
  mimeType: string | null;
  storageUrl: string;
  title: string;
  type: string;
  updatedAt: Date;
  visibility: string;
}): CampaignAsset {
  return campaignAssetSchema.parse({
    campaignId: record.campaignId,
    createdAt: record.createdAt.toISOString(),
    createdByUserId: record.createdByUserId,
    description: record.description ?? undefined,
    id: record.id,
    mimeType: record.mimeType ?? undefined,
    storageUrl: record.storageUrl,
    title: record.title,
    type: record.type,
    updatedAt: record.updatedAt.toISOString(),
    visibility: record.visibility
  });
}

function mapScenarioEventLog(record: {
  actorUserId: string | null;
  createdAt: Date;
  eventType: string;
  id: string;
  participantId: string | null;
  payloadJson: Prisma.JsonValue | null;
  phase: number | null;
  roundNumber: number | null;
  scenarioId: string;
  summary: string;
}): ScenarioEventLog {
  return scenarioEventLogSchema.parse({
    actorUserId: record.actorUserId ?? undefined,
    createdAt: record.createdAt.toISOString(),
    eventType: record.eventType,
    id: record.id,
    participantId: record.participantId ?? undefined,
    payload: record.payloadJson ?? undefined,
    phase: record.phase === 1 || record.phase === 2 ? record.phase : undefined,
    roundNumber: record.roundNumber ?? undefined,
    scenarioId: record.scenarioId,
    summary: record.summary
  });
}

function mapCampaignRosterEntry(record: {
  campaignId: string;
  category: string;
  createdAt: Date;
  createdByUserId: string | null;
  id: string;
  labelSnapshot: string | null;
  notes: string | null;
  sourceId: string;
  sourceType: string;
  updatedAt: Date;
}): CampaignRosterEntry {
  return campaignRosterEntrySchema.parse({
    campaignId: record.campaignId,
    category: record.category,
    createdAt: record.createdAt.toISOString(),
    createdByUserId: record.createdByUserId ?? undefined,
    id: record.id,
    labelSnapshot: record.labelSnapshot ?? undefined,
    notes: record.notes ?? undefined,
    sourceId: record.sourceId,
    sourceType: record.sourceType,
    updatedAt: record.updatedAt.toISOString()
  });
}

export interface ScenarioRepository {
  createCampaign(input: {
    description: string;
    gmUserId: string;
    name: string;
    settings: CampaignSettings;
    slug: string;
    status: Campaign["status"];
  }): Promise<Campaign>;
  getCampaignById(campaignId: string): Promise<Campaign | null>;
  listCampaignsByGameMaster(gmUserId: string): Promise<Campaign[]>;
  listCampaignsAllowingPlayerSelfJoin(): Promise<Campaign[]>;
  listCampaignsByPlayerAccess(userId: string): Promise<Campaign[]>;
  createScenario(input: {
    campaignId: string;
    description: string;
    kind: Scenario["kind"];
    mapAssetId?: string | null;
    name: string;
    status: Scenario["status"];
  }): Promise<Scenario>;
  getScenarioById(scenarioId: string): Promise<Scenario | null>;
  listScenariosByCampaign(campaignId: string): Promise<Scenario[]>;
  listScenariosByCampaignPlayerAccess(campaignId: string, userId: string): Promise<Scenario[]>;
  updateScenario(input: {
    description?: string;
    kind?: Scenario["kind"];
    mapAssetId?: string | null;
    name?: string;
    scenarioId: string;
    status?: Scenario["status"];
  }): Promise<Scenario>;
  createReusableEntity(input: {
    description?: string | null;
    gmUserId: string;
    kind: ReusableEntity["kind"];
    name: string;
    notes?: string | null;
    snapshot?: unknown;
  }): Promise<ReusableEntity>;
  updateReusableEntity(input: {
    description?: string | null;
    entityId: string;
    kind: ReusableEntity["kind"];
    name: string;
    notes?: string | null;
    snapshot?: unknown;
  }): Promise<ReusableEntity>;
  getReusableEntityById(entityId: string): Promise<ReusableEntity | null>;
  listReusableEntitiesByGameMaster(gmUserId: string): Promise<ReusableEntity[]>;
  createScenarioParticipant(input: {
    characterId?: string | null;
    controlledByUserId?: string | null;
    displayOrder?: number | null;
    entityId?: string | null;
    factionId?: string | null;
    initiativeSlot?: number | null;
    isActive?: boolean;
    joinSource: ScenarioParticipant["joinSource"];
    position?: ScenarioParticipantPosition;
    role: ScenarioParticipant["role"];
    roleTag?: string | null;
    scenarioId: string;
    snapshot: ScenarioParticipantSnapshot;
    sourceType: ScenarioParticipant["sourceType"];
    state: ScenarioParticipantState;
    tacticalGroupId?: string | null;
    visibilityOverrides?: ScenarioParticipant["visibilityOverrides"];
  }): Promise<ScenarioParticipant>;
  listScenarioParticipants(scenarioId: string): Promise<ScenarioParticipant[]>;
  updateScenarioLiveState(
    scenarioId: string,
    liveState: ScenarioLiveState
  ): Promise<Scenario>;
  updateScenarioParticipantState(
    participantId: string,
    state: ScenarioParticipantState
  ): Promise<ScenarioParticipant>;
  updateScenarioParticipantMetadata(input: {
    controlledByUserId?: string | null;
    displayOrder?: number | null;
    factionId?: string | null;
    isActive?: boolean;
    participantId: string;
    roleTag?: string | null;
    tacticalGroupId?: string | null;
  }): Promise<ScenarioParticipant>;
  createCampaignAsset(input: {
    campaignId: string;
    createdByUserId: string;
    description?: string | null;
    mimeType?: string | null;
    storageUrl: string;
    title: string;
    type: CampaignAsset["type"];
    visibility: CampaignAsset["visibility"];
  }): Promise<CampaignAsset>;
  listCampaignAssets(campaignId: string): Promise<CampaignAsset[]>;
  getCampaignAssetById(assetId: string): Promise<CampaignAsset | null>;
  updateCampaignAssetVisibility(
    assetId: string,
    visibility: CampaignAsset["visibility"]
  ): Promise<CampaignAsset>;
  createCampaignRosterEntry(input: {
    campaignId: string;
    category: CampaignRosterCategory;
    createdByUserId?: string | null;
    labelSnapshot?: string | null;
    notes?: string | null;
    sourceId: string;
    sourceType: CampaignRosterSourceType;
  }): Promise<CampaignRosterEntry>;
  deleteCampaignRosterEntry(entryId: string): Promise<void>;
  getCampaignRosterEntryById(entryId: string): Promise<CampaignRosterEntry | null>;
  listCampaignRosterEntries(campaignId: string): Promise<CampaignRosterEntry[]>;
  createScenarioEventLog(input: {
    actorUserId?: string | null;
    eventType: string;
    participantId?: string | null;
    payload?: unknown;
    phase?: 1 | 2;
    roundNumber?: number;
    scenarioId: string;
    summary: string;
  }): Promise<ScenarioEventLog>;
  listScenarioEventLogs(scenarioId: string): Promise<ScenarioEventLog[]>;
}

export function createPrismaScenarioRepository(): ScenarioRepository {
  return {
    async createCampaign(input) {
      const record = await prisma.campaign.create({
        data: {
          description: input.description,
          gmUserId: input.gmUserId,
          name: input.name,
          settingsJson: asJson(input.settings),
          slug: input.slug,
          status: input.status
        }
      });

      return mapCampaign(record);
    },
    async getCampaignById(campaignId) {
      const record = await prisma.campaign.findUnique({
        where: { id: campaignId }
      });

      return record ? mapCampaign(record) : null;
    },
    async listCampaignsByGameMaster(gmUserId) {
      const records = await prisma.campaign.findMany({
        orderBy: { updatedAt: "desc" },
        where: { gmUserId }
      });

      return records.map(mapCampaign);
    },
    async listCampaignsAllowingPlayerSelfJoin() {
      const records = await prisma.campaign.findMany({
        orderBy: { updatedAt: "desc" },
        where: {
          settingsJson: {
            path: ["allowPlayerSelfJoin"],
            equals: true
          }
        }
      });

      return records.map(mapCampaign);
    },
    async listCampaignsByPlayerAccess(userId) {
      const records = await prisma.campaign.findMany({
        orderBy: { updatedAt: "desc" },
        where: {
          scenarios: {
            some: {
              participants: {
                some: {
                  isActive: true,
                  role: "player_character",
                  OR: [
                    { controlledByUserId: userId },
                    {
                      character: {
                        ownerId: userId,
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      });

      return records.map(mapCampaign);
    },
    async createScenario(input) {
      const record = await prisma.scenario.create({
        data: {
          campaignId: input.campaignId,
          description: input.description,
          kind: input.kind,
          mapAssetId: input.mapAssetId ?? null,
          name: input.name,
          status: input.status
        }
      });

      return mapScenario(record);
    },
    async getScenarioById(scenarioId) {
      const record = await prisma.scenario.findUnique({
        where: { id: scenarioId }
      });

      return record ? mapScenario(record) : null;
    },
    async listScenariosByCampaign(campaignId) {
      const records = await prisma.scenario.findMany({
        orderBy: { createdAt: "desc" },
        where: { campaignId }
      });

      return records.map(mapScenario);
    },
    async listScenariosByCampaignPlayerAccess(campaignId, userId) {
      const records = await prisma.scenario.findMany({
        orderBy: { createdAt: "desc" },
        where: {
          campaignId,
          participants: {
            some: {
              isActive: true,
              role: "player_character",
              OR: [
                { controlledByUserId: userId },
                {
                  character: {
                    ownerId: userId,
                  },
                },
              ],
            },
          },
        },
      });

      return records.map(mapScenario);
    },
    async updateScenario(input) {
      const record = await prisma.scenario.update({
        data: {
          description: input.description,
          kind: input.kind,
          mapAssetId: input.mapAssetId,
          name: input.name,
          status: input.status
        },
        where: { id: input.scenarioId }
      });

      return mapScenario(record);
    },
    async createReusableEntity(input) {
      const record = await prisma.reusableEntity.create({
        data: {
          description: input.description ?? null,
          gmUserId: input.gmUserId,
          kind: input.kind,
          name: input.name,
          notes: input.notes ?? null,
          snapshotJson: input.snapshot == null ? Prisma.JsonNull : asJson(input.snapshot)
        }
      });

      return mapReusableEntity(record);
    },
    async getReusableEntityById(entityId) {
      const record = await prisma.reusableEntity.findUnique({
        where: { id: entityId }
      });

      return record ? mapReusableEntity(record) : null;
    },
    async updateReusableEntity(input) {
      const record = await prisma.reusableEntity.update({
        data: {
          description: input.description ?? null,
          kind: input.kind,
          name: input.name,
          notes: input.notes ?? null,
          snapshotJson: input.snapshot == null ? Prisma.JsonNull : asJson(input.snapshot)
        },
        where: { id: input.entityId }
      });

      return mapReusableEntity(record);
    },
    async listReusableEntitiesByGameMaster(gmUserId) {
      const records = await prisma.reusableEntity.findMany({
        orderBy: { updatedAt: "desc" },
        where: { gmUserId }
      });

      return records.map(mapReusableEntity);
    },
    async createScenarioParticipant(input) {
      const record = await prisma.scenarioParticipant.create({
        data: {
          characterId: input.characterId ?? null,
          controlledByUserId: input.controlledByUserId ?? null,
          displayOrder: input.displayOrder ?? null,
          entityId: input.entityId ?? null,
          factionId: input.factionId ?? null,
          initiativeSlot: input.initiativeSlot ?? null,
          isActive: input.isActive ?? true,
          joinSource: input.joinSource,
          positionJson: input.position == null ? Prisma.JsonNull : asJson(input.position),
          role: input.role,
          roleTag: input.roleTag ?? null,
          scenarioId: input.scenarioId,
          snapshotJson: asJson(input.snapshot),
          sourceType: input.sourceType,
          stateJson: asJson(input.state),
          tacticalGroupId: input.tacticalGroupId ?? null,
          visibilityOverridesJson:
            input.visibilityOverrides == null ? Prisma.JsonNull : asJson(input.visibilityOverrides)
        }
      });

      return mapScenarioParticipant(record);
    },
    async listScenarioParticipants(scenarioId) {
      const records = await prisma.scenarioParticipant.findMany({
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        where: { scenarioId }
      });

      return records.map(mapScenarioParticipant);
    },
    async updateScenarioLiveState(scenarioId, liveState) {
      const record = await prisma.scenario.update({
        data: {
          liveStateJson: asJson(liveState)
        },
        where: { id: scenarioId }
      });

      return mapScenario(record);
    },
    async updateScenarioParticipantState(participantId, state) {
      const record = await prisma.scenarioParticipant.update({
        data: {
          stateJson: asJson(state)
        },
        where: { id: participantId }
      });

      return mapScenarioParticipant(record);
    },
    async updateScenarioParticipantMetadata(input) {
      const record = await prisma.scenarioParticipant.update({
        data: {
          controlledByUserId:
            input.controlledByUserId === undefined ? undefined : input.controlledByUserId,
          displayOrder: input.displayOrder === undefined ? undefined : input.displayOrder,
          factionId: input.factionId === undefined ? undefined : input.factionId,
          isActive: input.isActive === undefined ? undefined : input.isActive,
          roleTag: input.roleTag === undefined ? undefined : input.roleTag,
          tacticalGroupId:
            input.tacticalGroupId === undefined ? undefined : input.tacticalGroupId
        },
        where: { id: input.participantId }
      });

      return mapScenarioParticipant(record);
    },
    async createCampaignAsset(input) {
      const record = await prisma.campaignAsset.create({
        data: {
          campaignId: input.campaignId,
          createdByUserId: input.createdByUserId,
          description: input.description ?? null,
          mimeType: input.mimeType ?? null,
          storageUrl: input.storageUrl,
          title: input.title,
          type: input.type,
          visibility: input.visibility
        }
      });

      return mapCampaignAsset(record);
    },
    async listCampaignAssets(campaignId) {
      const records = await prisma.campaignAsset.findMany({
        orderBy: { createdAt: "desc" },
        where: { campaignId }
      });

      return records.map(mapCampaignAsset);
    },
    async getCampaignAssetById(assetId) {
      const record = await prisma.campaignAsset.findUnique({
        where: { id: assetId }
      });

      return record ? mapCampaignAsset(record) : null;
    },
    async updateCampaignAssetVisibility(assetId, visibility) {
      const record = await prisma.campaignAsset.update({
        data: {
          visibility
        },
        where: { id: assetId }
      });

      return mapCampaignAsset(record);
    },
    async createCampaignRosterEntry(input) {
      const existing = await prisma.campaignRosterEntry.findUnique({
        where: {
          campaignId_sourceType_sourceId: {
            campaignId: input.campaignId,
            sourceId: input.sourceId,
            sourceType: input.sourceType
          }
        }
      });

      if (existing) {
        return mapCampaignRosterEntry(existing);
      }

      const record = await prisma.campaignRosterEntry.create({
        data: {
          campaignId: input.campaignId,
          category: input.category,
          createdByUserId: input.createdByUserId ?? null,
          labelSnapshot: input.labelSnapshot ?? null,
          notes: input.notes ?? null,
          sourceId: input.sourceId,
          sourceType: input.sourceType
        }
      });

      return mapCampaignRosterEntry(record);
    },
    async deleteCampaignRosterEntry(entryId) {
      await prisma.campaignRosterEntry.delete({
        where: { id: entryId }
      });
    },
    async getCampaignRosterEntryById(entryId) {
      const record = await prisma.campaignRosterEntry.findUnique({
        where: { id: entryId }
      });

      return record ? mapCampaignRosterEntry(record) : null;
    },
    async listCampaignRosterEntries(campaignId) {
      const records = await prisma.campaignRosterEntry.findMany({
        orderBy: { createdAt: "desc" },
        where: { campaignId }
      });

      return records.map(mapCampaignRosterEntry);
    },
    async createScenarioEventLog(input) {
      const record = await prisma.scenarioEventLog.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          eventType: input.eventType,
          participantId: input.participantId ?? null,
          payloadJson: input.payload == null ? Prisma.JsonNull : asJson(input.payload),
          phase: input.phase ?? null,
          roundNumber: input.roundNumber ?? null,
          scenarioId: input.scenarioId,
          summary: input.summary
        }
      });

      return mapScenarioEventLog(record);
    },
    async listScenarioEventLogs(scenarioId) {
      const records = await prisma.scenarioEventLog.findMany({
        orderBy: { createdAt: "desc" },
        where: { scenarioId }
      });

      return records.map(mapScenarioEventLog);
    }
  };
}
