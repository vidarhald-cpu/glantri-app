import {
  campaignAssetSchema,
  campaignRosterEntrySchema,
  campaignSchema,
  reusableEntitySchema,
  scenarioEventLogSchema,
  scenarioLiveStateSchema,
  scenarioParticipantSchema,
  scenarioRelationshipSchema,
  scenarioSchema,
  scenarioSessionStateSchema,
  createScenarioLiveState,
  getStorageAssignmentForLocation,
  type CanonicalEquipmentItem,
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
  type ScenarioParticipantState,
  type ScenarioRelationship,
  type ScenarioRelationshipType,
  type ScenarioSessionState,
} from "@glantri/domain";
import { createDefaultEquipmentLocations } from "@glantri/content";
import { Prisma, PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../client";
import { createPrismaCharacterEquipmentRepository } from "./characterEquipmentRepository";
import { reconcileScenarioEquipmentForCharacters } from "../services/scenarioEquipmentReconciliation";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class ScenarioPersistenceError extends Error {
  constructor(
    readonly code: "stale_revision" | "transaction_conflict",
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ScenarioPersistenceError";
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", { enumerable: false, value: cause });
    }
  }
}

export class CampaignRosterPersistenceConflictError extends Error {
  constructor(readonly activeCampaignId: string) {
    super("Character already belongs to another active Campaign.");
    this.name = "CampaignRosterPersistenceConflictError";
  }
}

function isCampaignRosterIdentityConflict(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;

  return (
    Array.isArray(target) &&
    target.length === 3 &&
    ["campaignId", "sourceType", "sourceId"].every((field) => target.includes(field))
  );
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
    updatedAt: record.updatedAt.toISOString(),
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
    liveState:
      record.liveStateJson == null
        ? undefined
        : scenarioLiveStateSchema.parse(record.liveStateJson),
    mapAssetId: record.mapAssetId ?? undefined,
    name: record.name,
    status: record.status,
    updatedAt: record.updatedAt.toISOString(),
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
    updatedAt: record.updatedAt.toISOString(),
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
        : (record.visibilityOverridesJson as ScenarioParticipant["visibilityOverrides"]),
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
    visibility: record.visibility,
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
  sequence: number;
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
    sequence: record.sequence,
    summary: record.summary,
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
    updatedAt: record.updatedAt.toISOString(),
  });
}

function mapScenarioRelationship(record: {
  campaignId: string;
  createdAt: Date;
  fromScenarioId: string;
  id: string;
  relationType: string;
  sortOrder: number | null;
  toScenarioId: string;
  updatedAt: Date;
}): ScenarioRelationship {
  return scenarioRelationshipSchema.parse({
    campaignId: record.campaignId,
    createdAt: record.createdAt.toISOString(),
    fromScenarioId: record.fromScenarioId,
    id: record.id,
    relationType: record.relationType,
    sortOrder: record.sortOrder ?? undefined,
    toScenarioId: record.toScenarioId,
    updatedAt: record.updatedAt.toISOString(),
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
  activateCampaignFromDraft(input: { campaignId: string }): Promise<Campaign | null>;
  getCampaignById(campaignId: string): Promise<Campaign | null>;
  listCampaignsByGameMaster(gmUserId: string): Promise<Campaign[]>;
  listCampaignsAllowingPlayerSelfJoin(): Promise<Campaign[]>;
  listCampaignsByCharacterRosterAccess(characterId: string): Promise<Campaign[]>;
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
  listScenariosByCampaignPlayerControl(campaignId: string, userId: string): Promise<Scenario[]>;
  updateScenario(input: {
    description?: string;
    kind?: Scenario["kind"];
    mapAssetId?: string | null;
    name?: string;
    expectedRevision?: string;
    expectedStatus?: Scenario["status"];
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
  createCampaignNpcWithRosterEntry(input: {
    campaignId: string;
    createdByUserId: string;
    description?: string | null;
    gmUserId: string;
    kind: ReusableEntity["kind"];
    name: string;
    notes?: string | null;
    snapshot?: unknown;
  }): Promise<{ entity: ReusableEntity; rosterEntry: CampaignRosterEntry }>;
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
  getScenarioParticipantById(
    participantId: string,
    scenarioId: string,
  ): Promise<ScenarioParticipant | null>;
  listScenarioParticipants(scenarioId: string): Promise<ScenarioParticipant[]>;
  updateScenarioLiveState(scenarioId: string, liveState: ScenarioLiveState): Promise<Scenario>;
  updateScenarioSessionState(input: {
    expectedRevision: string;
    scenarioId: string;
    session: ScenarioSessionState;
  }): Promise<Scenario>;
  pickUpScenarioAvailableItem(input: {
    actorUserId: string;
    audienceParticipantIds: string[];
    availabilityId: string;
    expectedRevision: string;
    requestId: string;
    scenarioId: string;
    summary: string;
    targetCharacterId: string;
  }): Promise<{ idempotent: boolean; item: CanonicalEquipmentItem; scenario: Scenario }>;
  updateScenarioParticipantState(
    participantId: string,
    state: ScenarioParticipantState,
  ): Promise<ScenarioParticipant>;
  updateScenarioParticipantSnapshotAndState(
    participantId: string,
    snapshot: ScenarioParticipantSnapshot,
    state: ScenarioParticipantState,
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
    visibility: CampaignAsset["visibility"],
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
  deleteCampaignRosterEntryBySource(input: {
    campaignId: string;
    sourceId: string;
    sourceType: CampaignRosterSourceType;
  }): Promise<number>;
  getCampaignRosterEntryById(entryId: string): Promise<CampaignRosterEntry | null>;
  listCampaignRosterEntries(campaignId: string): Promise<CampaignRosterEntry[]>;
  createScenarioRelationship(input: {
    campaignId: string;
    fromScenarioId: string;
    relationType: ScenarioRelationshipType;
    sortOrder?: number | null;
    toScenarioId: string;
  }): Promise<ScenarioRelationship>;
  listScenarioRelationshipsByCampaign(campaignId: string): Promise<ScenarioRelationship[]>;
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

export function createPrismaScenarioRepository(client?: PrismaClient): ScenarioRepository {
  const prisma = client ?? defaultPrisma;
  return {
    async createCampaign(input) {
      const record = await prisma.campaign.create({
        data: {
          description: input.description,
          gmUserId: input.gmUserId,
          name: input.name,
          settingsJson: asJson(input.settings),
          slug: input.slug,
          status: input.status,
        },
      });

      return mapCampaign(record);
    },
    async activateCampaignFromDraft(input) {
      const result = await prisma.campaign.updateMany({
        data: {
          status: "active",
        },
        where: {
          id: input.campaignId,
          status: "draft",
        },
      });

      if (result.count === 0) {
        return null;
      }

      const record = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
      });

      return record ? mapCampaign(record) : null;
    },
    async getCampaignById(campaignId) {
      const record = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      return record ? mapCampaign(record) : null;
    },
    async listCampaignsByGameMaster(gmUserId) {
      const records = await prisma.campaign.findMany({
        orderBy: { updatedAt: "desc" },
        where: { gmUserId },
      });

      return records.map(mapCampaign);
    },
    async listCampaignsAllowingPlayerSelfJoin() {
      const records = await prisma.campaign.findMany({
        orderBy: { updatedAt: "desc" },
        where: {
          settingsJson: {
            path: ["allowPlayerSelfJoin"],
            equals: true,
          },
        },
      });

      return records.map(mapCampaign);
    },
    async listCampaignsByCharacterRosterAccess(characterId) {
      const records = await prisma.campaign.findMany({
        orderBy: { updatedAt: "desc" },
        where: {
          rosterEntries: {
            some: {
              sourceId: characterId,
              sourceType: "character",
            },
          },
        },
      });

      return records.map(mapCampaign);
    },
    async listCampaignsByPlayerAccess(userId) {
      const records = await prisma.campaign.findMany({
        orderBy: { updatedAt: "desc" },
        where: {
          scenarios: {
            some: {
              status: "live",
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
          status: input.status,
        },
      });

      return mapScenario(record);
    },
    async getScenarioById(scenarioId) {
      const record = await prisma.scenario.findUnique({
        where: { id: scenarioId },
      });

      return record ? mapScenario(record) : null;
    },
    async listScenariosByCampaign(campaignId) {
      const records = await prisma.scenario.findMany({
        orderBy: { createdAt: "desc" },
        where: { campaignId },
      });

      return records.map(mapScenario);
    },
    async listScenariosByCampaignPlayerAccess(campaignId, userId) {
      const records = await prisma.scenario.findMany({
        orderBy: { createdAt: "desc" },
        where: {
          campaignId,
          status: "live",
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
    async listScenariosByCampaignPlayerControl(campaignId, userId) {
      const records = await prisma.scenario.findMany({
        orderBy: { createdAt: "desc" },
        where: {
          campaignId,
          status: "live",
          participants: {
            some: {
              isActive: true,
              role: "player_character",
              OR: [
                { controlledByUserId: userId },
                {
                  controlledByUserId: null,
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
      if (
        input.expectedRevision === undefined &&
        input.expectedStatus === undefined &&
        input.status === undefined
      ) {
        const record = await prisma.scenario.update({
          data: {
            description: input.description,
            kind: input.kind,
            mapAssetId: input.mapAssetId,
            name: input.name,
            status: input.status,
          },
          where: { id: input.scenarioId },
        });

        return mapScenario(record);
      }

      try {
        return await prisma.$transaction(
          async (transaction) => {
            await transaction.$queryRaw(
              Prisma.sql`SELECT "id" FROM "Scenario" WHERE "id" = ${input.scenarioId} FOR UPDATE`,
            );
            const existing = await transaction.scenario.findUnique({
              where: { id: input.scenarioId },
            });

            if (!existing) {
              throw new Error("Scenario not found.");
            }

            if (
              input.expectedRevision &&
              existing.updatedAt.toISOString() !== input.expectedRevision
            ) {
              throw new ScenarioPersistenceError(
                "stale_revision",
                "The Scenario changed before this update could be saved.",
              );
            }

            if (input.expectedStatus != null && existing.status !== input.expectedStatus) {
              throw new ScenarioPersistenceError(
                "stale_revision",
                "The Scenario changed before this update could be saved.",
              );
            }

            if (
              input.status === "paused" ||
              input.status === "completed" ||
              input.status === "archived"
            ) {
              await transaction.$queryRaw(
                Prisma.sql`SELECT "id" FROM "Encounter" WHERE "scenarioId" = ${input.scenarioId} ORDER BY "id" FOR UPDATE`,
              );
            }

            if (input.status === "completed") {
              const openEncounterCount = await transaction.encounter.count({
                where: {
                  scenarioId: input.scenarioId,
                  status: { in: ["active", "paused"] },
                },
              });
              if (openEncounterCount > 0) {
                throw new Error(
                  "Close every active or paused Encounter before closing the Scenario.",
                );
              }
            }

            if (input.status === "paused") {
              const activeEncounters = await transaction.encounter.findMany({
                select: {
                  combatStorageMode: true,
                  id: true,
                  name: true,
                  sessionJson: true,
                },
                where: { scenarioId: input.scenarioId, status: "active" },
              });
              for (const encounter of activeEncounters) {
                const rawSession =
                  encounter.sessionJson && typeof encounter.sessionJson === "object"
                    ? (encounter.sessionJson as Record<string, unknown>)
                    : {};
                const participants = Array.isArray(rawSession.participants)
                  ? rawSession.participants
                  : [];
                const audienceParticipantIds = participants.flatMap((participant) => {
                  if (!participant || typeof participant !== "object") return [];
                  const id = (participant as Record<string, unknown>).scenarioParticipantId;
                  return typeof id === "string" ? [id] : [];
                });
                const updatedEncounter = await transaction.encounter.update({
                  data: {
                    sessionJson: asJson({ ...rawSession, status: "paused" }),
                    status: "paused",
                  },
                  select: { updatedAt: true },
                  where: { id: encounter.id },
                });
                if (encounter.combatStorageMode === "split_v1") {
                  await transaction.encounterActiveCombatState.update({
                    data: { revision: updatedEncounter.updatedAt },
                    where: { encounterId: encounter.id },
                  });
                }
                await transaction.scenarioEventLog.create({
                  data: {
                    eventType: "encounter_paused",
                    payloadJson: asJson({ audienceParticipantIds, encounterId: encounter.id }),
                    scenarioId: input.scenarioId,
                    summary: `Paused encounter ${encounter.name} because the Scenario paused.`,
                  },
                });
              }
            }

            if (input.status === "archived") {
              const archivableEncounters = await transaction.encounter.findMany({
                select: {
                  combatStorageMode: true,
                  id: true,
                  name: true,
                  sessionJson: true,
                },
                where: {
                  scenarioId: input.scenarioId,
                  status: { in: ["draft", "completed"] },
                },
              });
              for (const encounter of archivableEncounters) {
                const rawSession =
                  encounter.sessionJson && typeof encounter.sessionJson === "object"
                    ? (encounter.sessionJson as Record<string, unknown>)
                    : {};
                const participants = Array.isArray(rawSession.participants)
                  ? rawSession.participants
                  : [];
                const audienceParticipantIds = participants.flatMap((participant) => {
                  if (!participant || typeof participant !== "object") return [];
                  const id = (participant as Record<string, unknown>).scenarioParticipantId;
                  return typeof id === "string" ? [id] : [];
                });
                const updatedEncounter = await transaction.encounter.update({
                  data: {
                    sessionJson: asJson({ ...rawSession, status: "archived" }),
                    status: "archived",
                  },
                  select: { updatedAt: true },
                  where: { id: encounter.id },
                });
                if (encounter.combatStorageMode === "split_v1") {
                  await transaction.encounterActiveCombatState.update({
                    data: { revision: updatedEncounter.updatedAt },
                    where: { encounterId: encounter.id },
                  });
                }
                await transaction.scenarioEventLog.create({
                  data: {
                    eventType: "encounter_archived",
                    payloadJson: asJson({ audienceParticipantIds, encounterId: encounter.id }),
                    scenarioId: input.scenarioId,
                    summary: `Archived encounter ${encounter.name} with the Scenario.`,
                  },
                });
              }
            }

            const record = await transaction.scenario.update({
              data: {
                description: input.description,
                kind: input.kind,
                mapAssetId: input.mapAssetId,
                name: input.name,
                status: input.status,
              },
              where: { id: input.scenarioId },
            });

            return mapScenario(record);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof ScenarioPersistenceError) throw error;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2034" ||
            (error.code === "P2010" &&
              error.message
                .toLowerCase()
                .includes("could not serialize access due to concurrent update")))
        ) {
          throw new ScenarioPersistenceError(
            "transaction_conflict",
            "The Scenario changed while saving. Refresh and try again.",
            error,
          );
        }
        throw error;
      }
    },
    async createReusableEntity(input) {
      const record = await prisma.reusableEntity.create({
        data: {
          description: input.description ?? null,
          gmUserId: input.gmUserId,
          kind: input.kind,
          name: input.name,
          notes: input.notes ?? null,
          snapshotJson: input.snapshot == null ? Prisma.JsonNull : asJson(input.snapshot),
        },
      });

      return mapReusableEntity(record);
    },
    async createCampaignNpcWithRosterEntry(input) {
      const result = await prisma.$transaction(async (transaction) => {
        const entity = await transaction.reusableEntity.create({
          data: {
            description: input.description ?? null,
            gmUserId: input.gmUserId,
            kind: input.kind,
            name: input.name,
            notes: input.notes ?? null,
            snapshotJson: input.snapshot == null ? Prisma.JsonNull : asJson(input.snapshot),
          },
        });
        const rosterEntry = await transaction.campaignRosterEntry.create({
          data: {
            campaignId: input.campaignId,
            category: "npc",
            createdByUserId: input.createdByUserId,
            labelSnapshot: entity.name,
            sourceId: entity.id,
            sourceType: "reusableEntity",
          },
        });

        return { entity, rosterEntry };
      });

      return {
        entity: mapReusableEntity(result.entity),
        rosterEntry: mapCampaignRosterEntry(result.rosterEntry),
      };
    },
    async getReusableEntityById(entityId) {
      const record = await prisma.reusableEntity.findUnique({
        where: { id: entityId },
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
          snapshotJson: input.snapshot == null ? Prisma.JsonNull : asJson(input.snapshot),
        },
        where: { id: input.entityId },
      });

      return mapReusableEntity(record);
    },
    async listReusableEntitiesByGameMaster(gmUserId) {
      const records = await prisma.reusableEntity.findMany({
        orderBy: { updatedAt: "desc" },
        where: { gmUserId },
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
            input.visibilityOverrides == null ? Prisma.JsonNull : asJson(input.visibilityOverrides),
        },
      });

      return mapScenarioParticipant(record);
    },
    async getScenarioParticipantById(participantId, scenarioId) {
      const record = await prisma.scenarioParticipant.findFirst({
        where: { id: participantId, scenarioId },
      });

      return record ? mapScenarioParticipant(record) : null;
    },
    async listScenarioParticipants(scenarioId) {
      const records = await prisma.scenarioParticipant.findMany({
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        where: { scenarioId },
      });

      return records.map(mapScenarioParticipant);
    },
    async updateScenarioLiveState(scenarioId, liveState) {
      const record = await prisma.scenario.update({
        data: {
          liveStateJson: asJson(liveState),
        },
        where: { id: scenarioId },
      });

      return mapScenario(record);
    },
    async updateScenarioSessionState(input) {
      try {
        return await prisma.$transaction(
          async (transaction) => {
            await transaction.$queryRaw(
              Prisma.sql`SELECT "id" FROM "Scenario" WHERE "id" = ${input.scenarioId} FOR UPDATE`,
            );
            const existing = await transaction.scenario.findUnique({
              where: { id: input.scenarioId },
            });
            if (!existing) {
              throw new Error("Scenario not found.");
            }
            if (existing.updatedAt.toISOString() !== input.expectedRevision) {
              throw new ScenarioPersistenceError(
                "stale_revision",
                "The Scenario changed. Refresh and review the latest session state.",
              );
            }
            const liveState = scenarioLiveStateSchema.parse(
              existing.liveStateJson ?? createScenarioLiveState(),
            );
            const record = await transaction.scenario.update({
              data: {
                liveStateJson: asJson({
                  ...liveState,
                  session: scenarioSessionStateSchema.parse(input.session),
                }),
              },
              where: { id: input.scenarioId },
            });
            return mapScenario(record);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof ScenarioPersistenceError) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          throw new ScenarioPersistenceError(
            "transaction_conflict",
            "The Scenario changed while saving. Refresh and try again.",
            error,
          );
        }
        throw error;
      }
    },
    async pickUpScenarioAvailableItem(input) {
      try {
        return await prisma.$transaction(
          async (transaction) => {
            await transaction.$queryRaw(
              Prisma.sql`SELECT "id" FROM "Scenario" WHERE "id" = ${input.scenarioId} FOR UPDATE`,
            );
            const existing = await transaction.scenario.findUnique({
              where: { id: input.scenarioId },
            });
            if (!existing) throw new Error("Scenario not found.");
            const liveState = scenarioLiveStateSchema.parse(
              existing.liveStateJson ?? createScenarioLiveState(),
            );
            const reference = liveState.session.availableObjects.find(
              (candidate) => candidate.id === input.availabilityId,
            );
            const equipmentRepository = createPrismaCharacterEquipmentRepository(transaction);

            if (liveState.session.appliedRequestIds.includes(input.requestId)) {
              const transferEvents = await transaction.scenarioEventLog.findMany({
                orderBy: { createdAt: "desc" },
                select: { actorUserId: true, participantId: true, payloadJson: true },
                where: {
                  eventType: "item_transferred",
                  scenarioId: input.scenarioId,
                },
              });
              const transferredItem = transferEvents.find((event) => {
                const payload = event.payloadJson;
                return (
                  event.actorUserId === input.actorUserId &&
                  event.participantId === input.audienceParticipantIds[0] &&
                  payload !== null &&
                  typeof payload === "object" &&
                  !Array.isArray(payload) &&
                  "requestId" in payload &&
                  payload.requestId === input.requestId &&
                  "availabilityId" in payload &&
                  payload.availabilityId === input.availabilityId
                );
              });
              const payload =
                transferredItem?.payloadJson &&
                typeof transferredItem.payloadJson === "object" &&
                !Array.isArray(transferredItem.payloadJson)
                  ? transferredItem.payloadJson
                  : {};
              const itemId =
                "itemId" in payload && typeof payload.itemId === "string"
                  ? payload.itemId
                  : undefined;
              const item = itemId
                ? await equipmentRepository.getCanonicalEquipmentItemById(itemId)
                : null;
              if (!item) throw new Error("The completed pickup could not be reloaded.");
              return { idempotent: true, item, scenario: mapScenario(existing) };
            }

            if (existing.updatedAt.toISOString() !== input.expectedRevision) {
              throw new ScenarioPersistenceError(
                "stale_revision",
                "The Scenario changed. Refresh before picking up the Item.",
              );
            }
            if (
              !reference ||
              reference.sourceKind !== "campaign_item" ||
              reference.visibility !== "players"
            ) {
              throw new Error("Available Item not found.");
            }
            const targetParticipant = await transaction.scenarioParticipant.findFirst({
              where: {
                characterId: input.targetCharacterId,
                id: { in: input.audienceParticipantIds },
                isActive: true,
                scenarioId: input.scenarioId,
              },
            });
            if (!targetParticipant) throw new Error("Choose an active Character participant.");

            const targetLocation = createDefaultEquipmentLocations(input.targetCharacterId).find(
              (location) => location.type === "person_system",
            );
            if (!targetLocation) throw new Error("The receiving Character has no valid storage.");
            if (!equipmentRepository.acquireUnheldCampaignEquipmentItem) {
              throw new Error("Campaign Item pickup is not available.");
            }
            const item = await equipmentRepository.acquireUnheldCampaignEquipmentItem({
              campaignId: existing.campaignId,
              itemId: reference.sourceId,
              targetCharacterId: input.targetCharacterId,
              targetStorageAssignment: getStorageAssignmentForLocation(targetLocation),
            });
            await reconcileScenarioEquipmentForCharacters({
              characterIds: [input.targetCharacterId],
              client: transaction,
              scenarioId: input.scenarioId,
            });
            const session = scenarioSessionStateSchema.parse({
              ...liveState.session,
              appliedRequestIds: [
                ...liveState.session.appliedRequestIds.filter((id) => id !== input.requestId),
                input.requestId,
              ].slice(-100),
              availableObjects: liveState.session.availableObjects.filter(
                (candidate) => candidate.id !== input.availabilityId,
              ),
            });
            const updated = await transaction.scenario.update({
              data: { liveStateJson: asJson({ ...liveState, session }) },
              where: { id: input.scenarioId },
            });
            await transaction.scenarioEventLog.create({
              data: {
                actorUserId: input.actorUserId,
                eventType: "item_transferred",
                participantId: targetParticipant.id,
                payloadJson: asJson({
                  audienceParticipantIds: input.audienceParticipantIds,
                  availabilityId: input.availabilityId,
                  itemId: item.id,
                  requestId: input.requestId,
                }),
                scenarioId: input.scenarioId,
                summary: input.summary,
              },
            });
            return { idempotent: false, item, scenario: mapScenario(updated) };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof ScenarioPersistenceError) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          throw new ScenarioPersistenceError(
            "transaction_conflict",
            "The Item changed while it was being picked up. Refresh and try again.",
            error,
          );
        }
        throw error;
      }
    },
    async updateScenarioParticipantState(participantId, state) {
      const record = await prisma.scenarioParticipant.update({
        data: {
          stateJson: asJson(state),
        },
        where: { id: participantId },
      });

      return mapScenarioParticipant(record);
    },
    async updateScenarioParticipantSnapshotAndState(participantId, snapshot, state) {
      const record = await prisma.scenarioParticipant.update({
        data: {
          snapshotJson: asJson(snapshot),
          stateJson: asJson(state),
        },
        where: { id: participantId },
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
          tacticalGroupId: input.tacticalGroupId === undefined ? undefined : input.tacticalGroupId,
        },
        where: { id: input.participantId },
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
          visibility: input.visibility,
        },
      });

      return mapCampaignAsset(record);
    },
    async listCampaignAssets(campaignId) {
      const records = await prisma.campaignAsset.findMany({
        orderBy: { createdAt: "desc" },
        where: { campaignId },
      });

      return records.map(mapCampaignAsset);
    },
    async getCampaignAssetById(assetId) {
      const record = await prisma.campaignAsset.findUnique({
        where: { id: assetId },
      });

      return record ? mapCampaignAsset(record) : null;
    },
    async updateCampaignAssetVisibility(assetId, visibility) {
      const record = await prisma.campaignAsset.update({
        data: {
          visibility,
        },
        where: { id: assetId },
      });

      return mapCampaignAsset(record);
    },
    async createCampaignRosterEntry(input) {
      const identity = {
        campaignId: input.campaignId,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
      };
      const existing = await prisma.campaignRosterEntry.findUnique({
        where: {
          campaignId_sourceType_sourceId: identity,
        },
      });

      if (existing) {
        return mapCampaignRosterEntry(existing);
      }

      try {
        const record = await prisma.campaignRosterEntry.create({
          data: {
            campaignId: input.campaignId,
            category: input.category,
            createdByUserId: input.createdByUserId ?? null,
            labelSnapshot: input.labelSnapshot ?? null,
            notes: input.notes ?? null,
            sourceId: input.sourceId,
            sourceType: input.sourceType,
          },
        });

        return mapCampaignRosterEntry(record);
      } catch (error) {
        if (
          input.sourceType === "character" &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const activeMembership = await prisma.campaignRosterEntry.findFirst({
            where: { sourceId: input.sourceId, sourceType: "character" },
          });
          if (activeMembership && activeMembership.campaignId !== input.campaignId) {
            throw new CampaignRosterPersistenceConflictError(activeMembership.campaignId);
          }
        }
        if (!isCampaignRosterIdentityConflict(error)) {
          throw error;
        }

        const canonical = await prisma.campaignRosterEntry.findUnique({
          where: {
            campaignId_sourceType_sourceId: identity,
          },
        });

        if (!canonical) {
          throw error;
        }

        return mapCampaignRosterEntry(canonical);
      }
    },
    async deleteCampaignRosterEntry(entryId) {
      await prisma.campaignRosterEntry.delete({
        where: { id: entryId },
      });
    },
    async deleteCampaignRosterEntryBySource(input) {
      const result = await prisma.campaignRosterEntry.deleteMany({
        where: {
          campaignId: input.campaignId,
          sourceId: input.sourceId,
          sourceType: input.sourceType,
        },
      });

      return result.count;
    },
    async getCampaignRosterEntryById(entryId) {
      const record = await prisma.campaignRosterEntry.findUnique({
        where: { id: entryId },
      });

      return record ? mapCampaignRosterEntry(record) : null;
    },
    async listCampaignRosterEntries(campaignId) {
      const records = await prisma.campaignRosterEntry.findMany({
        orderBy: { createdAt: "desc" },
        where: { campaignId },
      });

      return records.map(mapCampaignRosterEntry);
    },
    async createScenarioRelationship(input) {
      const record = await prisma.scenarioRelationship.create({
        data: {
          campaignId: input.campaignId,
          fromScenarioId: input.fromScenarioId,
          relationType: input.relationType,
          sortOrder: input.sortOrder ?? null,
          toScenarioId: input.toScenarioId,
        },
      });

      return mapScenarioRelationship(record);
    },
    async listScenarioRelationshipsByCampaign(campaignId) {
      const records = await prisma.scenarioRelationship.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        where: { campaignId },
      });

      return records.map(mapScenarioRelationship);
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
          summary: input.summary,
        },
      });

      return mapScenarioEventLog(record);
    },
    async listScenarioEventLogs(scenarioId) {
      const records = await prisma.scenarioEventLog.findMany({
        orderBy: { sequence: "asc" },
        where: { scenarioId },
      });

      return records.map(mapScenarioEventLog);
    },
  };
}
