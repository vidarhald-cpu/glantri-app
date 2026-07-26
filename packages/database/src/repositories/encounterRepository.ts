import {
  encounterSessionSchema,
  encounterSessionSummarySchema,
  type EncounterSession,
  type EncounterSessionSummary,
} from "@glantri/domain";
import { Prisma } from "@prisma/client";

import { prisma } from "../client";

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
}

export function createPrismaEncounterRepository(): EncounterRepository {
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
      const record = await prisma.encounter.findUnique({
        where: { id: encounterId },
      });

      return record ? mapEncounterRecord(record) : null;
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
        where: { scenarioId },
      });

      return records.map(mapEncounterRecord);
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
      const normalized = encounterSessionSchema.parse({
        ...input.session,
        campaignId: input.campaignId ?? input.session.campaignId,
        id: input.encounterId,
        scenarioId: input.scenarioId ?? input.session.scenarioId,
      });
      const record = await prisma.encounter.update({
        data: {
          campaignId: normalized.campaignId ?? null,
          name: normalized.title,
          scenarioId: normalized.scenarioId ?? null,
          sessionJson: asJson(normalized),
          status: normalized.status,
        },
        where: { id: input.encounterId },
      });

      return mapEncounterRecord(record);
    },
  };
}
