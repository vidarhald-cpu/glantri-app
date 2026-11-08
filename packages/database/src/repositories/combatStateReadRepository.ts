import {
  buildActiveCombatStateViewFromSplitStorage,
  buildActiveCombatStateViewFromPersistedSession,
  buildArchivedCombatRoundsViewFromSplitStorage,
  buildArchivedCombatRoundsViewFromPersistedSession,
  buildCombatHistorySourceViewFromSplitStorage,
  buildCombatHistorySourceViewFromPersistedSession,
  composeEncounterSessionFromSplitCombatPersistence,
  buildEncounterAccessMetadataViewFromPersistedSession,
  buildScenarioEncounterManagementProjectionFromPersistedSession,
  buildEncounterMetadataView,
  buildFullEncounterReadView,
  encounterSessionSchema,
  type ActiveCombatStateView,
  type ArchivedCombatRoundsView,
  type CombatHistorySourceView,
  type EncounterAccessMetadataView,
  type EncounterMetadataView,
  type FullEncounterReadView,
  type ScenarioEncounterManagementProjection,
} from "@glantri/domain";

import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "../client";
import {
  COMBAT_STORAGE_MODE_LEGACY,
  COMBAT_STORAGE_MODE_SPLIT_V1,
  CombatPersistenceError,
  type TransactionClient,
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

const SPLIT_ACTIVE_STATE_MISSING = "the active-state row is missing";
const SPLIT_REVISION_DISAGREEMENT =
  "the active-state revision does not match the Encounter revision";
const SPLIT_ARCHIVE_COUNT_DISAGREEMENT =
  "the archived round count does not match the stored archive count";

// Fails closed on split storage whose rows disagree. Each check runs only for the rows the read
// actually selected. The message names every agreement that failed, so a stored inconsistency is
// distinguishable from another one, and carries no stored values.
function assertSplitConsistency(input: {
  activeCombatState?: { revision: Date } | null;
  archivedRoundCount?: number;
  checkActiveState: boolean;
  combatArchiveCount: number;
  metadataRevision: Date;
}): void {
  const failures: string[] = [];
  if (input.checkActiveState) {
    if (!input.activeCombatState) {
      failures.push(SPLIT_ACTIVE_STATE_MISSING);
    } else if (input.activeCombatState.revision.getTime() !== input.metadataRevision.getTime()) {
      failures.push(SPLIT_REVISION_DISAGREEMENT);
    }
  }
  if (
    input.archivedRoundCount !== undefined &&
    input.archivedRoundCount !== input.combatArchiveCount
  ) {
    failures.push(SPLIT_ARCHIVE_COUNT_DISAGREEMENT);
  }
  if (failures.length > 0) {
    throw new CombatPersistenceError(
      "malformed_split_storage",
      `Split combat storage is inconsistent: ${failures.join("; ")}.`,
    );
  }
}

// Prisma reads every relation include as its own SELECT. At READ COMMITTED each SELECT takes its
// own snapshot, so a combat write committing between them pairs an old Encounter row with a new
// active-state row or archive, and the consistency check above refuses stored rows that are in
// fact consistent (#1021). A read that spans the Encounter and its split rows therefore runs in
// one REPEATABLE READ transaction: one snapshot for every statement. A read-only REPEATABLE READ
// transaction in PostgreSQL never raises a serialization failure. When the repository is handed a
// transaction client, the caller's transaction already provides the snapshot.
function readSplitSnapshot<T>(
  client: PrismaClient | TransactionClient,
  read: (database: TransactionClient) => Promise<T>,
): Promise<T> {
  if ("$transaction" in client) {
    return client.$transaction(read, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }
  return read(client);
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
  listScenarioEncounterManagementProjections(
    scenarioId: string,
  ): Promise<ScenarioEncounterManagementProjection[]>;
}

export function createPrismaCombatStateReadRepository(
  client: PrismaClient | TransactionClient = prisma,
): CombatStateReadRepository {
  const database = client as PrismaClient;
  return {
    async getActiveCombatStateById(encounterId) {
      const record = await readSplitSnapshot(client, (snapshot) =>
        snapshot.encounter.findUnique({
          select: {
            ...encounterSessionJsonSelect,
            activeCombatState: {
              select: { revision: true, stateJson: true },
            },
            combatArchiveCount: true,
          },
          where: { id: encounterId },
        }),
      );

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
      assertSplitConsistency({
        activeCombatState: record.activeCombatState,
        checkActiveState: true,
        combatArchiveCount: record.combatArchiveCount,
        metadataRevision: record.updatedAt,
      });
      return buildActiveCombatStateViewFromSplitStorage({
        activeCombatState: record.activeCombatState?.stateJson,
        metadata: metadataInput(record),
        sessionWithoutCombatState: record.sessionJson,
      });
    },
    async getArchivedCombatRoundsById(encounterId) {
      const record = await readSplitSnapshot(client, (snapshot) =>
        snapshot.encounter.findUnique({
          select: {
            ...encounterSessionJsonSelect,
            archivedCombatRounds: {
              orderBy: { roundNumber: "asc" },
              select: { roundJson: true },
            },
            combatArchiveCount: true,
          },
          where: { id: encounterId },
        }),
      );

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
      assertSplitConsistency({
        archivedRoundCount: record.archivedCombatRounds.length,
        checkActiveState: false,
        combatArchiveCount: record.combatArchiveCount,
        metadataRevision: record.updatedAt,
      });
      return buildArchivedCombatRoundsViewFromSplitStorage({
        archivedRounds: record.archivedCombatRounds.map((round) => round.roundJson),
        metadata: metadataInput(record),
      });
    },
    async getCombatHistorySourceById(encounterId) {
      const record = await readSplitSnapshot(client, (snapshot) =>
        snapshot.encounter.findUnique({
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
        }),
      );

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
      assertSplitConsistency({
        activeCombatState: record.activeCombatState,
        archivedRoundCount: record.archivedCombatRounds.length,
        checkActiveState: true,
        combatArchiveCount: record.combatArchiveCount,
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
      const record = await database.encounter.findUnique({
        select: encounterMetadataSelect,
        where: { id: encounterId },
      });

      return record ? buildEncounterMetadataView(metadataInput(record)) : null;
    },
    async getFullEncounterById(encounterId) {
      const record = await readSplitSnapshot(client, (snapshot) =>
        snapshot.encounter.findUnique({
          include: {
            activeCombatState: true,
            archivedCombatRounds: { orderBy: { roundNumber: "asc" } },
          },
          where: { id: encounterId },
        }),
      );

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
      assertSplitConsistency({
        activeCombatState: record.activeCombatState,
        archivedRoundCount: record.archivedCombatRounds.length,
        checkActiveState: true,
        combatArchiveCount: record.combatArchiveCount,
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
      const records = await database.encounter.findMany({
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
    async listScenarioEncounterManagementProjections(scenarioId) {
      const records = await database.$queryRaw<
        Array<EncounterMetadataRecord & { sessionJson: Prisma.JsonValue }>
      >(Prisma.sql`
        SELECT
          e."campaignId",
          e."createdAt",
          e.id,
          e.name,
          e."scenarioId",
          e.status,
          e."updatedAt",
          jsonb_strip_nulls(jsonb_build_object(
            'description', e."sessionJson" -> 'description',
            'kind', COALESCE(e."sessionJson" -> 'kind', '"combat"'::jsonb),
            'participantMembershipMode', e."sessionJson" -> 'participantMembershipMode',
            'participants', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_strip_nulls(
                    jsonb_build_object(
                      'id', participant.value -> 'id',
                      'scenarioParticipantId', participant.value -> 'scenarioParticipantId'
                    )
                  )
                )
                FROM jsonb_array_elements(
                  COALESCE(e."sessionJson" -> 'participants', '[]'::jsonb)
                ) AS participant(value)
              ),
              '[]'::jsonb
            ),
            'timelineLabel', e."sessionJson" -> 'timelineLabel'
          )) AS "sessionJson"
        FROM "Encounter" AS e
        WHERE e."scenarioId" = ${scenarioId}
        ORDER BY e."updatedAt" DESC
      `);

      return records.map((record) =>
        buildScenarioEncounterManagementProjectionFromPersistedSession({
          metadata: metadataInput(record),
          sessionJson: record.sessionJson,
        }),
      );
    },
  };
}
