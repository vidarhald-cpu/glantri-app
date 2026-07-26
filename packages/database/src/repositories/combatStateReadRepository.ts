import {
  buildActiveCombatStateViewFromSplitStorage,
  buildActiveCombatStateViewFromPersistedSession,
  buildArchivedCombatRoundsViewFromSplitStorage,
  buildArchivedCombatRoundsViewFromPersistedSession,
  buildCombatHistorySourceViewFromSplitStorage,
  buildCombatHistorySourceViewFromPersistedSession,
  composeEncounterSessionFromSplitCombatPersistence,
  buildEncounterAccessMetadataViewFromPersistedSession,
  buildEncounterMetadataView,
  buildFullEncounterReadView,
  encounterSessionSchema,
  type ActiveCombatStateView,
  type ArchivedCombatRoundsView,
  type CombatHistorySourceView,
  type EncounterAccessMetadataView,
  type EncounterMetadataView,
  type FullEncounterReadView,
} from "@glantri/domain";

import type { PrismaClient } from "@prisma/client";

import { prisma } from "../client";
import {
  COMBAT_STORAGE_MODE_LEGACY,
  COMBAT_STORAGE_MODE_SPLIT_V1,
  CombatPersistenceError,
} from "./combatStatePersistenceRepository";

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
  combatStorageMode: true,
  sessionJson: true,
} as const;

function assertSplitRevision(input: {
  activeRevision?: Date;
  archiveCount?: number;
  expectedArchiveCount: number;
  metadataRevision: Date;
}): void {
  if (
    !input.activeRevision ||
    input.activeRevision.getTime() !== input.metadataRevision.getTime() ||
    input.archiveCount !== input.expectedArchiveCount
  ) {
    throw new CombatPersistenceError(
      "malformed_split_storage",
      "Split combat storage revision or archive count is inconsistent.",
    );
  }
}

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

function mapLegacyEncounterRecord(record: {
  campaignId: string | null;
  createdAt: Date;
  id: string;
  name: string;
  scenarioId: string | null;
  sessionJson: unknown;
  status: string;
  updatedAt: Date;
}) {
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

export interface CombatStateReadRepository {
  getActiveCombatStateById(encounterId: string): Promise<ActiveCombatStateView | null>;
  getArchivedCombatRoundsById(encounterId: string): Promise<ArchivedCombatRoundsView | null>;
  getCombatHistorySourceById(encounterId: string): Promise<CombatHistorySourceView | null>;
  getEncounterMetadataById(encounterId: string): Promise<EncounterMetadataView | null>;
  getFullEncounterById(encounterId: string): Promise<FullEncounterReadView | null>;
  listEncounterAccessMetadataByScenario(scenarioId: string): Promise<EncounterAccessMetadataView[]>;
}

export function createPrismaCombatStateReadRepository(
  client: PrismaClient = prisma,
): CombatStateReadRepository {
  return {
    async getActiveCombatStateById(encounterId) {
      const record = await client.encounter.findUnique({
        select: {
          ...encounterSessionJsonSelect,
          activeCombatState: {
            select: { revision: true, stateJson: true },
          },
          combatArchiveCount: true,
        },
        where: { id: encounterId },
      });

      if (!record) {
        return null;
      }
      if (record.combatStorageMode === COMBAT_STORAGE_MODE_LEGACY) {
        return buildActiveCombatStateViewFromPersistedSession({
          metadata: metadataInput(record),
          sessionJson: record.sessionJson,
        });
      }
      if (record.combatStorageMode !== COMBAT_STORAGE_MODE_SPLIT_V1) {
        throw new CombatPersistenceError(
          "unsupported_storage_mode",
          `Unsupported combat storage mode: ${record.combatStorageMode}.`,
        );
      }
      assertSplitRevision({
        activeRevision: record.activeCombatState?.revision,
        archiveCount: record.combatArchiveCount,
        expectedArchiveCount: record.combatArchiveCount,
        metadataRevision: record.updatedAt,
      });
      return buildActiveCombatStateViewFromSplitStorage({
        activeCombatState: record.activeCombatState?.stateJson,
        metadata: metadataInput(record),
        sessionWithoutCombatState: record.sessionJson,
      });
    },
    async getArchivedCombatRoundsById(encounterId) {
      const record = await client.encounter.findUnique({
        select: {
          ...encounterSessionJsonSelect,
          archivedCombatRounds: {
            orderBy: { roundNumber: "asc" },
            select: { roundJson: true },
          },
          combatArchiveCount: true,
        },
        where: { id: encounterId },
      });

      if (!record) {
        return null;
      }
      if (record.combatStorageMode === COMBAT_STORAGE_MODE_LEGACY) {
        return buildArchivedCombatRoundsViewFromPersistedSession({
          metadata: metadataInput(record),
          sessionJson: record.sessionJson,
        });
      }
      if (record.combatStorageMode !== COMBAT_STORAGE_MODE_SPLIT_V1) {
        throw new CombatPersistenceError(
          "unsupported_storage_mode",
          `Unsupported combat storage mode: ${record.combatStorageMode}.`,
        );
      }
      if (record.archivedCombatRounds.length !== record.combatArchiveCount) {
        throw new CombatPersistenceError(
          "malformed_split_storage",
          "Split combat archive count is inconsistent.",
        );
      }
      return buildArchivedCombatRoundsViewFromSplitStorage({
        archivedRounds: record.archivedCombatRounds.map((round) => round.roundJson),
        metadata: metadataInput(record),
      });
    },
    async getCombatHistorySourceById(encounterId) {
      const record = await client.encounter.findUnique({
        select: {
          ...encounterSessionJsonSelect,
          activeCombatState: {
            select: { revision: true, stateJson: true },
          },
          archivedCombatRounds: {
            orderBy: { roundNumber: "asc" },
            select: { roundJson: true },
          },
          combatArchiveCount: true,
        },
        where: { id: encounterId },
      });

      if (!record) {
        return null;
      }
      if (record.combatStorageMode === COMBAT_STORAGE_MODE_LEGACY) {
        return buildCombatHistorySourceViewFromPersistedSession({
          metadata: metadataInput(record),
          sessionJson: record.sessionJson,
        });
      }
      if (record.combatStorageMode !== COMBAT_STORAGE_MODE_SPLIT_V1) {
        throw new CombatPersistenceError(
          "unsupported_storage_mode",
          `Unsupported combat storage mode: ${record.combatStorageMode}.`,
        );
      }
      assertSplitRevision({
        activeRevision: record.activeCombatState?.revision,
        archiveCount: record.archivedCombatRounds.length,
        expectedArchiveCount: record.combatArchiveCount,
        metadataRevision: record.updatedAt,
      });
      return buildCombatHistorySourceViewFromSplitStorage({
        activeCombatState: record.activeCombatState?.stateJson,
        archivedRounds: record.archivedCombatRounds.map((round) => round.roundJson),
        metadata: metadataInput(record),
        sessionWithoutCombatState: record.sessionJson,
      });
    },
    async getEncounterMetadataById(encounterId) {
      const record = await client.encounter.findUnique({
        select: encounterMetadataSelect,
        where: { id: encounterId },
      });

      return record ? buildEncounterMetadataView(metadataInput(record)) : null;
    },
    async getFullEncounterById(encounterId) {
      const record = await client.encounter.findUnique({
        include: {
          activeCombatState: true,
          archivedCombatRounds: { orderBy: { roundNumber: "asc" } },
        },
        where: { id: encounterId },
      });

      if (!record) {
        return null;
      }
      if (record.combatStorageMode === COMBAT_STORAGE_MODE_LEGACY) {
        return buildFullEncounterReadView(mapLegacyEncounterRecord(record));
      }
      if (record.combatStorageMode !== COMBAT_STORAGE_MODE_SPLIT_V1) {
        throw new CombatPersistenceError(
          "unsupported_storage_mode",
          `Unsupported combat storage mode: ${record.combatStorageMode}.`,
        );
      }
      assertSplitRevision({
        activeRevision: record.activeCombatState?.revision,
        archiveCount: record.archivedCombatRounds.length,
        expectedArchiveCount: record.combatArchiveCount,
        metadataRevision: record.updatedAt,
      });
      return buildFullEncounterReadView(
        composeEncounterSessionFromSplitCombatPersistence({
          activeCombatState: record.activeCombatState?.stateJson,
          archivedRounds: record.archivedCombatRounds.map((round) => round.roundJson),
          metadata: metadataInput(record),
          sessionWithoutCombatState: record.sessionJson,
        }),
      );
    },
    async listEncounterAccessMetadataByScenario(scenarioId) {
      const records = await client.encounter.findMany({
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
