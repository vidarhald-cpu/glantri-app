import {
  encounterSessionSchema,
  encounterSessionSummarySchema,
  type EncounterSession,
  type EncounterSessionSummary,
  type ScenarioParticipantState,
} from "@glantri/domain";
import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "../client";
import { createPrismaCombatStatePersistenceRepository } from "./combatStatePersistenceRepository";
import { createPrismaCombatStateReadRepository } from "./combatStateReadRepository";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function mapEncounterRecord(record: {
  campaignId: string | null;
  createdAt: Date;
  id: string;
  name: string;
  scenarioId: string | null;
  sessionJson: Prisma.JsonValue | null;
  status: string;
  updatedAt: Date;
}): EncounterSession {
  const parsedSession =
    record.sessionJson == null ? undefined : encounterSessionSchema.safeParse(record.sessionJson);
  const parsedData = parsedSession?.success ? parsedSession.data : undefined;

  return encounterSessionSchema.parse({
    ...(parsedData ?? {}),
    campaignId: record.campaignId ?? parsedData?.campaignId,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    scenarioId: record.scenarioId ?? parsedData?.scenarioId,
    status: record.status,
    title: record.name,
    updatedAt: record.updatedAt.toISOString(),
  });
}

function mapEncounterSummary(record: {
  campaignId: string | null;
  createdAt: Date;
  id: string;
  name: string;
  scenarioId: string | null;
  status: string;
  updatedAt: Date;
}): EncounterSessionSummary {
  return encounterSessionSummarySchema.parse({
    campaignId: record.campaignId ?? undefined,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    scenarioId: record.scenarioId ?? undefined,
    status: record.status,
    title: record.name,
    updatedAt: record.updatedAt.toISOString(),
  });
}

export interface EncounterRepository {
  createEncounter(input: {
    campaignId?: string | null;
    createdByUserId?: string | null;
    scenarioId: string;
    session: EncounterSession;
  }): Promise<EncounterSession>;
  getEncounterById(encounterId: string): Promise<EncounterSession | null>;
  getEncounterSummaryById(encounterId: string): Promise<EncounterSessionSummary | null>;
  listEncountersByScenario(scenarioId: string): Promise<EncounterSession[]>;
  listEncounterSummariesByScenario(scenarioId: string): Promise<EncounterSessionSummary[]>;
  updateEncounter(input: {
    objectiveEvent?: {
      actorUserId?: string | null;
      eventType: string;
      summary: string;
    };
    campaignId?: string | null;
    encounterId: string;
    expectedRevision?: string;
    scenarioId?: string | null;
    session: EncounterSession;
  }): Promise<EncounterSession>;
  updateCombatEncounter(input: {
    campaignId?: string | null;
    encounterId: string;
    expectedRevision: string;
    scenarioId?: string | null;
    session: EncounterSession;
    participantStateUpdates?: Array<{
      expectedRevision: string;
      participantId: string;
      scenarioId: string;
      state: ScenarioParticipantState;
    }>;
  }): Promise<EncounterSession>;
}

export class EncounterPresenceError extends Error {
  constructor(
    readonly code:
      | "inactive_participant"
      | "invalid_active_membership"
      | "participant_already_active",
    message: string,
  ) {
    super(message);
    this.name = "EncounterPresenceError";
  }
}

function explicitScenarioParticipantIds(encounter: EncounterSession): string[] {
  if (encounter.participantMembershipMode !== "explicit") {
    throw new EncounterPresenceError(
      "invalid_active_membership",
      "An active Encounter must use an explicit participant list.",
    );
  }
  const participantIds = encounter.participants.map(
    (participant) => participant.scenarioParticipantId,
  );
  if (participantIds.some((participantId) => !participantId)) {
    throw new EncounterPresenceError(
      "invalid_active_membership",
      "Every active Encounter participant must belong to the Scenario.",
    );
  }
  const uniqueIds = new Set(participantIds as string[]);
  if (uniqueIds.size !== participantIds.length || uniqueIds.size === 0) {
    throw new EncounterPresenceError(
      "invalid_active_membership",
      "Choose one or more distinct Scenario participants before starting the Encounter.",
    );
  }
  return [...uniqueIds];
}

async function assertActiveEncounterPresence(input: {
  encounter: EncounterSession;
  scenarioId: string;
  transaction: Prisma.TransactionClient;
}): Promise<string[]> {
  if (input.encounter.status !== "active") return [];
  const participantIds = explicitScenarioParticipantIds(input.encounter);

  await input.transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Scenario" WHERE "id" = ${input.scenarioId} FOR UPDATE`,
  );
  const activeParticipants = await input.transaction.scenarioParticipant.findMany({
    select: { id: true },
    where: {
      id: { in: participantIds },
      isActive: true,
      scenarioId: input.scenarioId,
    },
  });
  if (activeParticipants.length !== participantIds.length) {
    throw new EncounterPresenceError(
      "inactive_participant",
      "Refresh the Scenario and choose active participants before starting the Encounter.",
    );
  }

  const otherActiveRecords = await input.transaction.encounter.findMany({
    select: { id: true, name: true, sessionJson: true, status: true },
    where: {
      id: { not: input.encounter.id },
      scenarioId: input.scenarioId,
      status: "active",
    },
  });
  for (const record of otherActiveRecords) {
    const parsed = encounterSessionSchema.parse({
      ...(record.sessionJson && typeof record.sessionJson === "object" ? record.sessionJson : {}),
      id: record.id,
      scenarioId: input.scenarioId,
      status: record.status,
      title: record.name,
    });
    if (parsed.participantMembershipMode !== "explicit") continue;
    const otherIds = new Set(
      parsed.participants.flatMap((participant) =>
        participant.scenarioParticipantId ? [participant.scenarioParticipantId] : [],
      ),
    );
    if (participantIds.some((participantId) => otherIds.has(participantId))) {
      throw new EncounterPresenceError(
        "participant_already_active",
        "A selected participant is already active in another Encounter.",
      );
    }
  }
  return participantIds;
}

export function createPrismaEncounterRepository(
  client: PrismaClient = prisma,
): EncounterRepository {
  const combatReadRepository = createPrismaCombatStateReadRepository(client);
  const combatPersistenceRepository = createPrismaCombatStatePersistenceRepository(client);

  return {
    async createEncounter(input) {
      const normalized = encounterSessionSchema.parse({
        ...input.session,
        campaignId: input.campaignId ?? input.session.campaignId,
        scenarioId: input.scenarioId,
      });
      const record = await client.encounter.create({
        data: {
          campaignId: normalized.campaignId ?? null,
          createdByUserId: input.createdByUserId ?? null,
          id: normalized.id,
          name: normalized.title,
          scenarioId: input.scenarioId,
          sessionJson: asJson(normalized),
          status: normalized.status,
        },
      });

      return mapEncounterRecord(record);
    },
    async getEncounterById(encounterId) {
      return (await combatReadRepository.getFullEncounterById(encounterId))?.encounter ?? null;
    },
    async getEncounterSummaryById(encounterId) {
      const record = await client.encounter.findUnique({
        select: {
          campaignId: true,
          createdAt: true,
          id: true,
          name: true,
          scenarioId: true,
          status: true,
          updatedAt: true,
        },
        where: { id: encounterId },
      });

      return record ? mapEncounterSummary(record) : null;
    },
    async listEncountersByScenario(scenarioId) {
      const records = await client.encounter.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true },
        where: { scenarioId },
      });

      const encounters = await Promise.all(
        records.map((record) => combatReadRepository.getFullEncounterById(record.id)),
      );
      return encounters.flatMap((view) => (view ? [view.encounter] : []));
    },
    async listEncounterSummariesByScenario(scenarioId) {
      const records = await client.encounter.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          campaignId: true,
          createdAt: true,
          id: true,
          name: true,
          scenarioId: true,
          status: true,
          updatedAt: true,
        },
        where: { scenarioId },
      });

      return records.map(mapEncounterSummary);
    },
    async updateEncounter(input) {
      let audienceParticipantIds: string[] = [];
      return combatPersistenceRepository.updateEncounterPreservingSplitCombat({
        ...input,
        afterPersist: async (transaction, encounter) => {
          if (!input.objectiveEvent || !encounter.scenarioId) return;
          await transaction.scenarioEventLog.create({
            data: {
              actorUserId: input.objectiveEvent.actorUserId ?? null,
              eventType: input.objectiveEvent.eventType,
              payloadJson: asJson({
                audienceParticipantIds,
                encounterId: encounter.id,
              }),
              scenarioId: encounter.scenarioId,
              summary: input.objectiveEvent.summary,
            },
          });
        },
        beforePersist: async (transaction, encounter) => {
          if (!encounter.scenarioId) return;
          audienceParticipantIds =
            encounter.status === "active"
              ? await assertActiveEncounterPresence({
                  encounter,
                  scenarioId: encounter.scenarioId,
                  transaction,
                })
              : encounter.participants.flatMap((participant) =>
                  participant.scenarioParticipantId ? [participant.scenarioParticipantId] : [],
                );
        },
      });
    },
    async updateCombatEncounter(input) {
      return combatPersistenceRepository.updateCombatEncounter(input);
    },
  };
}
