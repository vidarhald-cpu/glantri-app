import {
  buildActiveCombatStateViewFromPersistedSession,
  buildArchivedCombatRoundsViewFromPersistedSession,
  buildCombatHistorySourceViewFromPersistedSession,
  buildEncounterAccessMetadataViewFromPersistedSession,
  buildEncounterMetadataView,
  buildFullEncounterReadView,
  type ActiveCombatStateView,
  type ArchivedCombatRoundsView,
  type CombatHistorySourceView,
  type EncounterAccessMetadataView,
  type EncounterMetadataView,
  type FullEncounterReadView,
} from "@glantri/domain";

import { prisma } from "../client";
import { mapEncounterRecord } from "./encounterRepository";

interface EncounterMetadataRecord {
  campaignId: string | null;
  createdAt: Date;
  id: string;
  name: string;
  scenarioId: string | null;
  status: string;
  updatedAt: Date;
}

const encounterMetadataSelect = {
  campaignId: true,
  createdAt: true,
  id: true,
  name: true,
  scenarioId: true,
  status: true,
  updatedAt: true,
} as const;

const encounterSessionJsonSelect = {
  ...encounterMetadataSelect,
  sessionJson: true,
} as const;

function metadataInput(record: EncounterMetadataRecord) {
  return {
    campaignId: record.campaignId,
    createdAt: record.createdAt.toISOString(),
    encounterId: record.id,
    revision: record.updatedAt.toISOString(),
    scenarioId: record.scenarioId,
    status: record.status,
    title: record.name,
  };
}

export interface CombatStateReadRepository {
  getActiveCombatStateById(encounterId: string): Promise<ActiveCombatStateView | null>;
  getArchivedCombatRoundsById(encounterId: string): Promise<ArchivedCombatRoundsView | null>;
  getCombatHistorySourceById(encounterId: string): Promise<CombatHistorySourceView | null>;
  getEncounterMetadataById(encounterId: string): Promise<EncounterMetadataView | null>;
  getFullEncounterById(encounterId: string): Promise<FullEncounterReadView | null>;
  listEncounterAccessMetadataByScenario(scenarioId: string): Promise<EncounterAccessMetadataView[]>;
}

export function createPrismaCombatStateReadRepository(): CombatStateReadRepository {
  return {
    async getActiveCombatStateById(encounterId) {
      const record = await prisma.encounter.findUnique({
        select: encounterSessionJsonSelect,
        where: { id: encounterId },
      });

      return record
        ? buildActiveCombatStateViewFromPersistedSession({
            metadata: metadataInput(record),
            sessionJson: record.sessionJson,
          })
        : null;
    },
    async getArchivedCombatRoundsById(encounterId) {
      const record = await prisma.encounter.findUnique({
        select: encounterSessionJsonSelect,
        where: { id: encounterId },
      });

      return record
        ? buildArchivedCombatRoundsViewFromPersistedSession({
            metadata: metadataInput(record),
            sessionJson: record.sessionJson,
          })
        : null;
    },
    async getCombatHistorySourceById(encounterId) {
      const record = await prisma.encounter.findUnique({
        select: encounterSessionJsonSelect,
        where: { id: encounterId },
      });

      return record
        ? buildCombatHistorySourceViewFromPersistedSession({
            metadata: metadataInput(record),
            sessionJson: record.sessionJson,
          })
        : null;
    },
    async getEncounterMetadataById(encounterId) {
      const record = await prisma.encounter.findUnique({
        select: encounterMetadataSelect,
        where: { id: encounterId },
      });

      return record ? buildEncounterMetadataView(metadataInput(record)) : null;
    },
    async getFullEncounterById(encounterId) {
      const record = await prisma.encounter.findUnique({
        where: { id: encounterId },
      });

      return record ? buildFullEncounterReadView(mapEncounterRecord(record)) : null;
    },
    async listEncounterAccessMetadataByScenario(scenarioId) {
      const records = await prisma.encounter.findMany({
        orderBy: { updatedAt: "desc" },
        select: encounterSessionJsonSelect,
        where: { scenarioId },
      });

      return records.map((record) =>
        buildEncounterAccessMetadataViewFromPersistedSession({
          metadata: metadataInput(record),
          sessionJson: record.sessionJson,
        }),
      );
    },
  };
}
