import {
  encounterSessionSchema,
  encounterSessionSummarySchema,
  type EncounterSession,
  type EncounterSessionSummary,
  type ScenarioParticipantState,
} from "@glantri/domain";
import { Prisma } from "@prisma/client";

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
    campaignId?: string | null;
    encounterId: string;
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

export function createPrismaEncounterRepository(): EncounterRepository {
  const combatReadRepository = createPrismaCombatStateReadRepository();
  const combatPersistenceRepository = createPrismaCombatStatePersistenceRepository();

  return {
    async createEncounter(input) {
      const normalized = encounterSessionSchema.parse({
        ...input.session,
        campaignId: input.campaignId ?? input.session.campaignId,
        scenarioId: input.scenarioId,
      });
      const record = await prisma.encounter.create({
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
      const record = await prisma.encounter.findUnique({
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
      const records = await prisma.encounter.findMany({
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
      const records = await prisma.encounter.findMany({
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
      return combatPersistenceRepository.updateEncounterPreservingSplitCombat(input);
    },
    async updateCombatEncounter(input) {
      return combatPersistenceRepository.updateCombatEncounter(input);
    },
  };
}
