import { encounterSessionSchema, type EncounterSession } from "@glantri/domain";
import { Prisma } from "@prisma/client";

import { prisma } from "../client";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function mapEncounter(record: {
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

export interface EncounterRepository {
  createEncounter(session: EncounterSession, createdByUserId?: string | null): Promise<EncounterSession>;
  getEncounterById(encounterId: string): Promise<EncounterSession | null>;
  listEncountersByScenario(scenarioId: string): Promise<EncounterSession[]>;
  updateEncounter(session: EncounterSession): Promise<EncounterSession>;
}

export function createPrismaEncounterRepository(): EncounterRepository {
  return {
    async createEncounter(session, createdByUserId) {
      const normalized = encounterSessionSchema.parse(session);
      const record = await prisma.encounter.create({
        data: {
          campaignId: normalized.campaignId ?? null,
          createdByUserId: createdByUserId ?? null,
          id: normalized.id,
          name: normalized.title,
          scenarioId: normalized.scenarioId ?? null,
          sessionJson: asJson(normalized),
          status: normalized.status,
        },
      });

      return mapEncounter(record);
    },
    async getEncounterById(encounterId) {
      const record = await prisma.encounter.findUnique({
        where: { id: encounterId },
      });

      return record ? mapEncounter(record) : null;
    },
    async listEncountersByScenario(scenarioId) {
      const records = await prisma.encounter.findMany({
        orderBy: { updatedAt: "desc" },
        where: { scenarioId },
      });

      return records.map(mapEncounter);
    },
    async updateEncounter(session) {
      const normalized = encounterSessionSchema.parse(session);
      const record = await prisma.encounter.update({
        data: {
          campaignId: normalized.campaignId ?? null,
          name: normalized.title,
          scenarioId: normalized.scenarioId ?? null,
          sessionJson: asJson(normalized),
          status: normalized.status,
        },
        where: { id: normalized.id },
      });

      return mapEncounter(record);
    },
  };
}
