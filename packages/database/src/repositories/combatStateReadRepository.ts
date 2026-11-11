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
  COMBAT_ACTIVITY_ITEM_RESOLUTION_EVENT_KIND,
  encounterSessionSchema,
  encounterStatusSchema,
  type ActiveCombatStateView,
  type ArchivedCombatRoundsView,
  type CombatHistorySourceView,
  type EncounterAccessMetadataView,
  type EncounterMetadataView,
  type EncounterSession,
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

function isFinishedEncounterStatus(status: string): boolean {
  const parsed = encounterStatusSchema.safeParse(status);
  return parsed.success && (parsed.data === "completed" || parsed.data === "archived");
}

/**
 * The actions a stored combat-state document holds under `genericActions` whose id is one of
 * `actionIds`, in stored order. PostgreSQL does the selection, so the document never leaves it.
 */
function genericActionsNamed(column: Prisma.Sql, actionIds: readonly string[]): Prisma.Sql {
  return Prisma.sql`
    COALESCE(
      (
        SELECT jsonb_agg(action.value ORDER BY action.ordinality)
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(${column} -> 'genericActions') = 'array'
              THEN ${column} -> 'genericActions'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS action(value, ordinality)
        WHERE action.value ->> 'id' = ANY(${[...actionIds]}::text[])
      ),
      '[]'::jsonb
    )`;
}

/**
 * Forgejo #1136. Reads finished split-storage Encounters for the Scenario session projections
 * (`buildScenarioSessionView`, `resolveScenarioParticipantDisclosure`) without composing their
 * archived combat rounds. A round is 1–3 MB of JSON, and parsing every archived round of every
 * Encounter on every `/session` poll is what made that poll grow with each finished fight (#1131).
 *
 * Each entry is the stored session — title, status, kind, outcome text, roster, membership mode and
 * the GM's visibility matrix, which is everything those readers take from a finished Encounter —
 * plus, only where it is read, a **reduced** `combatRoundState`:
 *
 * - The one combat read those projections make is the past Item-outcome check
 *   (`canViewCurrentItemOutcome` in `scenarioSession.ts`). It looks up the action an
 *   `item_resolution` Activity row names, first in the active state and then in the archived
 *   rounds in ascending order, and reads only that action.
 * - So `combatRoundState` is present only for an Encounter that such a row names, and holds only
 *   the actions such rows name, from the active state and from each archived round, each in stored
 *   order, with every other field at its schema default. An action carried forward into a later
 *   round keeps every copy, so the lookup finds the same copy it finds in the full state.
 * - Every other finished Encounter has no `combatRoundState`, and its combat documents are not
 *   read at all, not even inside PostgreSQL.
 *
 * This is a projection for those readers only. A reader of combat state must not take a finished
 * Encounter from here; `getFullEncounterById` stays the reading of one Encounter.
 *
 * The full read's split-storage agreement checks still run, on counts and revisions, so
 * inconsistent stored rows still fail closed where the full read would.
 */
async function readFinishedEncounterSessionSummaries(
  snapshot: TransactionClient,
  input: { encounterIds: readonly string[]; scenarioId: string },
): Promise<Map<string, EncounterSession>> {
  const summaries = new Map<string, EncounterSession>();
  if (input.encounterIds.length === 0) return summaries;

  const records = await snapshot.encounter.findMany({
    select: {
      ...encounterSessionJsonSelect,
      _count: { select: { archivedCombatRounds: true } },
      activeCombatState: { select: { revision: true } },
      combatArchiveCount: true,
    },
    where: { id: { in: [...input.encounterIds] }, scenarioId: input.scenarioId },
  });
  // Anything else — not finished in this snapshot, or not in split storage — is left to the
  // caller's full read, which keeps its own behaviour for it.
  const finished = records.filter(
    (record) =>
      record.combatStorageMode === COMBAT_STORAGE_MODE_SPLIT_V1 &&
      isFinishedEncounterStatus(record.status),
  );
  for (const record of finished) {
    assertSplitConsistency({
      activeCombatState: record.activeCombatState,
      archivedRoundCount: record._count.archivedCombatRounds,
      checkActiveState: true,
      combatArchiveCount: record.combatArchiveCount,
      metadataRevision: record.updatedAt,
    });
  }
  if (finished.length === 0) return summaries;

  // The (Encounter, action) pairs this Scenario's `item_resolution` Activity rows name. The check
  // reads `payload.encounterId` and `payload.actionId` of such a row, so these are its inputs.
  const references = await snapshot.$queryRaw<Array<{ actionId: string; encounterId: string }>>(
    Prisma.sql`
      SELECT DISTINCT
        log."payloadJson" ->> 'encounterId' AS "encounterId",
        log."payloadJson" ->> 'actionId' AS "actionId"
      FROM "ScenarioEventLog" AS log
      WHERE log."scenarioId" = ${input.scenarioId}
        AND log."payloadJson" ->> 'eventKind' = ${COMBAT_ACTIVITY_ITEM_RESOLUTION_EVENT_KIND}
        AND log."payloadJson" ->> 'actionId' IS NOT NULL
        AND log."payloadJson" ->> 'encounterId' = ANY(${finished.map((record) => record.id)}::text[])
    `,
  );
  const referencedEncounterIds = [...new Set(references.map((row) => row.encounterId))];
  const referencedActionIds = [...new Set(references.map((row) => row.actionId))];
  const isReferenced = (encounterId: string, action: unknown) =>
    references.some(
      (row) =>
        row.encounterId === encounterId && row.actionId === (action as { id?: unknown } | null)?.id,
    );

  const activeRows =
    referencedEncounterIds.length === 0
      ? []
      : await snapshot.$queryRaw<
          Array<{ encounterId: string; genericActions: unknown[]; roundNumber: unknown }>
        >(Prisma.sql`
          SELECT
            state."encounterId" AS "encounterId",
            state."stateJson" -> 'roundNumber' AS "roundNumber",
            ${genericActionsNamed(Prisma.sql`state."stateJson"`, referencedActionIds)}
              AS "genericActions"
          FROM "EncounterActiveCombatState" AS state
          WHERE state."encounterId" = ANY(${referencedEncounterIds}::text[])
        `);
  const archivedRows =
    referencedEncounterIds.length === 0
      ? []
      : await snapshot.$queryRaw<
          Array<{ encounterId: string; genericActions: unknown[]; roundNumber: number }>
        >(Prisma.sql`
          SELECT
            round."encounterId" AS "encounterId",
            round."roundNumber" AS "roundNumber",
            ${genericActionsNamed(Prisma.sql`round."roundJson"`, referencedActionIds)}
              AS "genericActions"
          FROM "EncounterArchivedCombatRound" AS round
          WHERE round."encounterId" = ANY(${referencedEncounterIds}::text[])
          ORDER BY round."roundNumber" ASC
        `);

  const activeByEncounterId = new Map(activeRows.map((row) => [row.encounterId, row]));
  for (const record of finished) {
    const active = activeByEncounterId.get(record.id);
    const named = (actions: unknown[]) =>
      actions.filter((action) => isReferenced(record.id, action));
    summaries.set(
      record.id,
      composeEncounterSessionFromSplitCombatPersistence({
        activeCombatState: active
          ? {
              genericActions: named(active.genericActions),
              ...(active.roundNumber == null ? {} : { roundNumber: active.roundNumber }),
            }
          : undefined,
        archivedRounds: active
          ? archivedRows
              .filter((row) => row.encounterId === record.id)
              .map((row) => ({
                genericActions: named(row.genericActions),
                roundNumber: row.roundNumber,
              }))
              .filter((round) => round.genericActions.length > 0)
          : [],
        metadata: metadataInput(record),
        sessionWithoutCombatState: record.sessionJson,
      }),
    );
  }
  return summaries;
}

export interface CombatStateReadRepository {
  getActiveCombatStateById(encounterId: string): Promise<ActiveCombatStateView | null>;
  getArchivedCombatRoundsById(encounterId: string): Promise<ArchivedCombatRoundsView | null>;
  getCombatHistorySourceById(encounterId: string): Promise<CombatHistorySourceView | null>;
  getEncounterMetadataById(encounterId: string): Promise<EncounterMetadataView | null>;
  getFullEncounterById(encounterId: string): Promise<FullEncounterReadView | null>;
  /**
   * Forgejo #1136. The Scenario-session reading of **finished** Encounters, without their combat.
   *
   * See `readFinishedEncounterSessionSummaries` below for what each entry carries and what it does
   * not. Only an Encounter that is, in the read's own snapshot, finished (`completed` or
   * `archived`) and stored in split mode has an entry; every other id is left out, and the caller
   * reads it in full.
   */
  listFinishedEncounterSessionSummaries(input: {
    encounterIds: readonly string[];
    scenarioId: string;
  }): Promise<Map<string, EncounterSession>>;
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
    async listFinishedEncounterSessionSummaries(input) {
      if (input.encounterIds.length === 0) return new Map();
      return readSplitSnapshot(client, (snapshot) =>
        readFinishedEncounterSessionSummaries(snapshot, input),
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
