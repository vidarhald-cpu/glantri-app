import { performance } from "node:perf_hooks";

import { PrismaClient } from "@prisma/client";
import {
  completedCombatRoundSchema,
  encounterSessionSchema,
  type EncounterSession,
} from "@glantri/domain";

import { createPrismaCombatStatePersistenceRepository } from "../src/repositories/combatStatePersistenceRepository";
import { createPrismaCombatStateReadRepository } from "../src/repositories/combatStateReadRepository";
import { assertWorktreeDatabaseRuntimeSafety } from "../src/worktreeDatabaseRuntimeSafety";

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function measure(run: () => Promise<unknown>, count = 5): Promise<number> {
  const samples: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const startedAt = performance.now();
    await run();
    samples.push(performance.now() - startedAt);
  }
  return median(samples);
}

function requireUrl(name: "DATABASE_URL" | "DATABASE_URL_TEST"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function resolveArchiveCounts(): number[] {
  const configured = process.env.COMBAT_PROFILE_ARCHIVE_COUNTS;
  if (!configured) {
    return [0, 10, 30, 50];
  }
  const counts = configured
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 0);
  if (counts.length === 0) {
    throw new Error("COMBAT_PROFILE_ARCHIVE_COUNTS must contain non-negative integers.");
  }
  return counts;
}

async function loadRepresentativeLegacyEncounter(client: PrismaClient): Promise<EncounterSession> {
  const rows = await client.$queryRaw<
    Array<{
      campaignId: string | null;
      createdAt: Date;
      id: string;
      name: string;
      scenarioId: string | null;
      sessionJson: unknown;
      status: string;
      updatedAt: Date;
    }>
  >`
    SELECT "campaignId", "createdAt", "id", "name", "scenarioId",
           "sessionJson", "status", "updatedAt"
    FROM "Encounter"
    WHERE "sessionJson" IS NOT NULL
    ORDER BY pg_column_size("sessionJson") DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("No persisted encounter is available for profiling.");
  }
  const persisted = encounterSessionSchema.parse(row.sessionJson);
  return encounterSessionSchema.parse({
    ...persisted,
    campaignId: row.campaignId ?? persisted.campaignId,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    scenarioId: row.scenarioId ?? persisted.scenarioId,
    status: row.status,
    title: row.name,
    updatedAt: row.updatedAt.toISOString(),
  });
}

function buildFixture(source: EncounterSession, archiveCount: number): EncounterSession {
  const sourceState = source.combatRoundState;
  if (!sourceState) {
    throw new Error("The representative encounter has no combat round state.");
  }
  const sourceArchive = sourceState.rounds[0] ?? {
    encounterId: source.id,
    roundNumber: 1,
  };
  const boundedArchive = completedCombatRoundSchema.parse({
    ...sourceArchive,
    commands: sourceArchive.commands.filter((command) => JSON.stringify(command).length < 50_000),
    events: sourceArchive.events.slice(-20),
    stepSnapshots: sourceArchive.stepSnapshots.slice(-10),
  });
  const id = `combat-split-profile-${archiveCount}`;
  const rounds = Array.from({ length: archiveCount }, (_, index) =>
    completedCombatRoundSchema.parse({
      ...boundedArchive,
      encounterId: id,
      roundNumber: index + 1,
    }),
  );

  return encounterSessionSchema.parse({
    ...source,
    campaignId: undefined,
    combatRoundState: {
      ...sourceState,
      encounterId: id,
      roundNumber: archiveCount + 1,
      rounds,
    },
    createdAt: new Date().toISOString(),
    currentRound: archiveCount + 1,
    id,
    scenarioId: undefined,
    title: `Combat split profile ${archiveCount}`,
    updatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  assertWorktreeDatabaseRuntimeSafety();
  const sourceClient = new PrismaClient({
    datasources: { db: { url: requireUrl("DATABASE_URL") } },
  });
  const targetClient = new PrismaClient({
    datasources: { db: { url: requireUrl("DATABASE_URL_TEST") } },
  });

  try {
    const representative = await loadRepresentativeLegacyEncounter(sourceClient);
    const readRepository = createPrismaCombatStateReadRepository(targetClient);
    const persistenceRepository = createPrismaCombatStatePersistenceRepository(targetClient);
    const measurements: unknown[] = [];

    for (const archiveCount of resolveArchiveCounts()) {
      const fixture = buildFixture(representative, archiveCount);
      await targetClient.encounter.deleteMany({ where: { id: fixture.id } });
      let created = await targetClient.encounter.create({
        data: {
          id: fixture.id,
          name: fixture.title,
          sessionJson: fixture as never,
          status: fixture.status,
        },
      });
      const legacyActiveReadMs = await measure(
        () => readRepository.getActiveCombatStateById(fixture.id),
        3,
      );
      const legacySizeRows = await targetClient.$queryRaw<Array<{ bytes: number }>>`
        SELECT pg_column_size("sessionJson")::int AS bytes
        FROM "Encounter"
        WHERE id = ${fixture.id}
      `;
      const legacyRewriteStartedAt = performance.now();
      created = await targetClient.encounter.update({
        data: { sessionJson: fixture as never },
        where: { id: fixture.id },
      });
      const legacyRewriteMs = performance.now() - legacyRewriteStartedAt;
      const materializationStartedAt = performance.now();
      let current = await persistenceRepository.updateCombatEncounter({
        encounterId: fixture.id,
        expectedRevision: created.updatedAt.toISOString(),
        session: fixture,
      });
      const materializationMs = performance.now() - materializationStartedAt;
      const activeReadMs = await measure(() => readRepository.getActiveCombatStateById(fixture.id));
      const ordinaryMutationSamples: number[] = [];
      for (let index = 0; index < 3; index += 1) {
        const startedAt = performance.now();
        current = await persistenceRepository.updateCombatEncounter({
          encounterId: fixture.id,
          expectedRevision: current.updatedAt,
          session: {
            ...current,
            combatRoundState: {
              ...current.combatRoundState!,
              selectedParticipantId:
                current.combatRoundState!.participants[index % 2]?.participantId,
            },
          },
        });
        ordinaryMutationSamples.push(performance.now() - startedAt);
      }
      const historyReadMs = await measure(
        () => readRepository.getCombatHistorySourceById(fixture.id),
        3,
      );
      const fullReadMs = await measure(() => readRepository.getFullEncounterById(fixture.id), 3);
      const [activeView, historySource, fullEncounter] = await Promise.all([
        readRepository.getActiveCombatStateById(fixture.id),
        readRepository.getCombatHistorySourceById(fixture.id),
        readRepository.getFullEncounterById(fixture.id),
      ]);
      const serializationStartedAt = performance.now();
      const fullEncounterBytes = JSON.stringify(fullEncounter).length;
      const fullSerializationMs = performance.now() - serializationStartedAt;
      const rowSizes = await targetClient.$queryRaw<
        Array<{
          activeBytes: number;
          archiveBytes: bigint;
          archiveRows: bigint;
          sessionBytes: number;
        }>
      >`
        SELECT
          pg_column_size(e."sessionJson")::int AS "sessionBytes",
          pg_column_size(a."stateJson")::int AS "activeBytes",
          COUNT(r.id)::bigint AS "archiveRows",
          COALESCE(SUM(pg_column_size(r."roundJson")), 0)::bigint AS "archiveBytes"
        FROM "Encounter" e
        JOIN "EncounterActiveCombatState" a ON a."encounterId" = e.id
        LEFT JOIN "EncounterArchivedCombatRound" r ON r."encounterId" = e.id
        WHERE e.id = ${fixture.id}
        GROUP BY e.id, a."stateJson"
      `;
      const sizes = rowSizes[0]!;
      const transitionRound = completedCombatRoundSchema.parse({
        ...(current.combatRoundState!.rounds.at(-1) ?? {
          encounterId: fixture.id,
        }),
        encounterId: fixture.id,
        roundNumber: archiveCount + 1,
      });
      const transitionStartedAt = performance.now();
      current = await persistenceRepository.updateCombatEncounter({
        encounterId: fixture.id,
        expectedRevision: current.updatedAt,
        session: {
          ...current,
          combatRoundState: {
            ...current.combatRoundState!,
            roundNumber: archiveCount + 2,
            rounds: [...current.combatRoundState!.rounds, transitionRound],
          },
          currentRound: archiveCount + 2,
        },
      });
      const roundTransitionMs = performance.now() - transitionStartedAt;

      measurements.push({
        activeBytes: sizes.activeBytes,
        activeReadMs: Number(activeReadMs.toFixed(2)),
        activeViewBytes: JSON.stringify(activeView).length,
        archiveBytes: Number(sizes.archiveBytes),
        archiveCount,
        archiveRows: Number(sizes.archiveRows),
        fullReadMs: Number(fullReadMs.toFixed(2)),
        fullEncounterBytes,
        fullSerializationMs: Number(fullSerializationMs.toFixed(2)),
        historyReadMs: Number(historyReadMs.toFixed(2)),
        historySourceBytes: JSON.stringify(historySource).length,
        legacyActiveReadMs: Number(legacyActiveReadMs.toFixed(2)),
        legacyRewriteMs: Number(legacyRewriteMs.toFixed(2)),
        legacySessionBytes: legacySizeRows[0]?.bytes ?? 0,
        materializationMs: Number(materializationMs.toFixed(2)),
        ordinaryMutationMs: Number(median(ordinaryMutationSamples).toFixed(2)),
        roundTransitionMs: Number(roundTransitionMs.toFixed(2)),
        sessionBytes: sizes.sessionBytes,
      });
    }

    await targetClient.encounter.deleteMany({ where: { id: representative.id } });
    let representativeRow = await targetClient.encounter.create({
      data: {
        campaignId: representative.campaignId,
        id: representative.id,
        name: representative.title,
        scenarioId: representative.scenarioId,
        sessionJson: representative as never,
        status: representative.status,
      },
    });
    const representativeLegacyReadMs = await measure(
      () => readRepository.getActiveCombatStateById(representative.id),
      3,
    );
    const representativeLegacyRewriteStartedAt = performance.now();
    representativeRow = await targetClient.encounter.update({
      data: { sessionJson: representative as never },
      where: { id: representative.id },
    });
    const representativeLegacyRewriteMs = performance.now() - representativeLegacyRewriteStartedAt;
    const representativeMaterializationStartedAt = performance.now();
    await persistenceRepository.updateCombatEncounter({
      encounterId: representative.id,
      expectedRevision: representativeRow.updatedAt.toISOString(),
      session: representative,
    });
    const representativeMaterializationMs =
      performance.now() - representativeMaterializationStartedAt;
    const representativeSplitReadMs = await measure(
      () => readRepository.getActiveCombatStateById(representative.id),
      5,
    );
    const representativeHistoryReadMs = await measure(
      () => readRepository.getCombatHistorySourceById(representative.id),
      3,
    );
    const representativeFullReadMs = await measure(
      () => readRepository.getFullEncounterById(representative.id),
      3,
    );

    process.stdout.write(
      `${JSON.stringify(
        {
          representative: {
            fullReadMs: Number(representativeFullReadMs.toFixed(2)),
            historyReadMs: Number(representativeHistoryReadMs.toFixed(2)),
            legacyActiveReadMs: Number(representativeLegacyReadMs.toFixed(2)),
            legacyRewriteMs: Number(representativeLegacyRewriteMs.toFixed(2)),
            materializationMs: Number(representativeMaterializationMs.toFixed(2)),
            serializedBytes: JSON.stringify(representative).length,
            splitActiveReadMs: Number(representativeSplitReadMs.toFixed(2)),
          },
          scaling: measurements,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await sourceClient.$disconnect();
    await targetClient.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
