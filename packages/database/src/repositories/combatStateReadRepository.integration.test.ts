import { beforeEach, describe, expect, it } from "vitest";

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  combatRoundStateSchema,
  encounterSessionSchema,
  type EncounterSession,
} from "@glantri/domain";

import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import {
  CombatPersistenceError,
  createPrismaCombatStatePersistenceRepository,
} from "./combatStatePersistenceRepository";
import {
  createPrismaCombatStateReadRepository,
  type CombatStateReadRepository,
} from "./combatStateReadRepository";

// Forgejo #1021. A split Encounter is stored across three tables: Encounter (updatedAt,
// combatArchiveCount), EncounterActiveCombatState (revision) and EncounterArchivedCombatRound.
// Prisma reads a relation include as one SELECT per table. Unless those SELECTs share one
// snapshot, a combat write that commits between them pairs an old Encounter row with a new
// active-state row or archive, and the read refuses consistent stored state as malformed.
//
// A sequential test cannot show this defect, so the first test races real reads against a real
// combat writer. Duration and the read floor are configurable for the acceptance-scale run:
//   SPLIT_READ_PROBE_MS         duration of the race (default 3000)
//   SPLIT_READ_PROBE_MIN_READS  full-encounter reads that must complete (default 300)
// The latency measurement is opt-in (SPLIT_READ_LATENCY=1), because it is a report, not a gate.

const prisma = getTestPrismaClient();

const PROBE_MS = Number(process.env.SPLIT_READ_PROBE_MS ?? 3000);
const PROBE_MIN_READS = Number(process.env.SPLIT_READ_PROBE_MIN_READS ?? 300);

const REVISION_DISAGREEMENT = "active-state revision does not match the Encounter revision";
const ARCHIVE_COUNT_DISAGREEMENT = "archived round count does not match the stored archive count";

function participants(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `participant-${index}`,
    label: `Participant ${index}`,
    participantType: "scenario" as const,
    scenarioParticipantId: `scenario-participant-${index}`,
  }));
}

async function createSplitEncounter(
  client: PrismaClient,
  input: { archivedRounds?: number; encounterId: string; participantCount?: number },
): Promise<{ encounter: EncounterSession; scenarioId: string }> {
  const user = await client.user.upsert({
    create: { email: "split-read@example.test", id: "split-read-user", passwordHash: "x" },
    update: {},
    where: { id: "split-read-user" },
  });
  const campaign = await client.campaign.upsert({
    create: {
      description: "",
      gmUserId: user.id,
      id: "split-read-campaign",
      name: "Split read",
      settingsJson: {},
      slug: "split-read-campaign",
      status: "active",
    },
    update: {},
    where: { id: "split-read-campaign" },
  });
  const scenario = await client.scenario.create({
    data: {
      campaignId: campaign.id,
      description: "",
      id: `scenario-${input.encounterId}`,
      kind: "combat",
      name: "Split read scenario",
      status: "live",
    },
  });
  const sessionParticipants = participants(input.participantCount ?? 1);
  const archivedRounds = input.archivedRounds ?? 1;
  const legacy = encounterSessionSchema.parse({
    actionLog: [],
    combatRoundState: combatRoundStateSchema.parse({
      commands: [],
      encounterId: input.encounterId,
      participants: sessionParticipants.map((participant) => ({
        label: participant.label,
        participantId: participant.id,
      })),
      roundNumber: archivedRounds + 1,
      rounds: Array.from({ length: archivedRounds }, (_, index) => ({
        encounterId: input.encounterId,
        roundNumber: index + 1,
      })),
    }),
    createdAt: "2026-07-26T09:00:00.000Z",
    currentRound: archivedRounds + 1,
    id: input.encounterId,
    kind: "combat",
    participants: sessionParticipants,
    scenarioId: scenario.id,
    status: "active",
    title: "Split read encounter",
    updatedAt: "2026-07-26T10:00:00.000Z",
  });
  const created = await client.encounter.create({
    data: {
      id: input.encounterId,
      name: legacy.title,
      scenarioId: scenario.id,
      sessionJson: legacy as never,
      status: "active",
    },
  });
  const encounter = await createPrismaCombatStatePersistenceRepository(
    client,
  ).updateCombatEncounter({
    encounterId: input.encounterId,
    expectedRevision: created.updatedAt.toISOString(),
    scenarioId: scenario.id,
    session: legacy,
  });
  return { encounter, scenarioId: scenario.id };
}

// One SQL statement is one snapshot even at READ COMMITTED: this is the stored truth.
async function storedAgreement(client: PrismaClient, encounterId: string) {
  const [row] = await client.$queryRaw<
    Array<{ archived: bigint; count: number; revision: Date | null; updatedAt: Date }>
  >(Prisma.sql`
    SELECT e."updatedAt" AS "updatedAt", a.revision AS revision, e."combatArchiveCount" AS count,
      (SELECT count(*) FROM "EncounterArchivedCombatRound" r WHERE r."encounterId" = e.id) AS archived
    FROM "Encounter" e LEFT JOIN "EncounterActiveCombatState" a ON a."encounterId" = e.id
    WHERE e.id = ${encounterId}`);
  return (
    row !== undefined &&
    row.revision !== null &&
    row.revision.getTime() === row.updatedAt.getTime() &&
    Number(row.archived) === row.count
  );
}

function nextSession(current: EncounterSession, encounterId: string): EncounterSession {
  const combatRoundState = current.combatRoundState!;
  const rounds = [...combatRoundState.rounds];
  const roll = Math.random();
  if (rounds.length < 10 && roll < 0.4) {
    rounds.push({ encounterId, roundNumber: rounds.length + 1 } as (typeof rounds)[number]);
  } else if (rounds.length > 1 && roll < 0.6) {
    rounds.pop();
  }
  return {
    ...current,
    combatRoundState: { ...combatRoundState, roundNumber: rounds.length + 1, rounds },
    currentRound: rounds.length + 1,
    description: `write-${Math.random()}`,
    status: "active",
  } as EncounterSession;
}

type Counter = Record<string, number>;
const bump = (counter: Counter, key: string) => {
  counter[key] = (counter[key] ?? 0) + 1;
};

function errorKey(error: unknown): string {
  if (error instanceof CombatPersistenceError) {
    return `${error.code}`;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `prisma_${error.code}`;
  }
  return `other: ${(error as Error)?.message?.slice(0, 120)}`;
}

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("Split combat read snapshot integration (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("Split combat read snapshot integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    it(
      "reads split state as one snapshot while combat writes commit concurrently",
      { timeout: PROBE_MS + 60_000 },
      async () => {
        const encounterId = "split-read-race";
        const { encounter, scenarioId } = await createSplitEncounter(prisma!, { encounterId });
        const reads = createPrismaCombatStateReadRepository(prisma!);
        const writes = createPrismaCombatStatePersistenceRepository(prisma!);
        const counter: Counter = {};
        const stopAt = Date.now() + PROBE_MS;

        const writer = async () => {
          let current = encounter;
          while (Date.now() < stopAt) {
            try {
              current = await writes.updateCombatEncounter({
                encounterId,
                expectedRevision: current.updatedAt!,
                scenarioId,
                session: nextSession(current, encounterId),
              });
              bump(counter, "write.ok");
            } catch (error) {
              bump(counter, `write.${errorKey(error)}`);
              current = (await reads.getFullEncounterById(encounterId))!.encounter;
            }
          }
        };
        const reader = async (
          name: string,
          read: (repository: CombatStateReadRepository) => Promise<unknown>,
        ) => {
          while (Date.now() < stopAt) {
            try {
              await read(reads);
              bump(counter, `${name}.ok`);
            } catch (error) {
              const key = errorKey(error);
              bump(counter, `${name}.${key}`);
              if (key === "malformed_split_storage") {
                bump(
                  counter,
                  `${name}.refusal.stored.${(await storedAgreement(prisma!, encounterId)) ? "consistent" : "BROKEN"}`,
                );
              }
            }
          }
        };
        // Positive control: the pre-#1021 read shape (one include, root client, no transaction).
        // It proves the race was live during this run, so 0 refusals above it is not vacuous.
        const untransactedControl = async () => {
          while (Date.now() < stopAt) {
            const record = await prisma!.encounter.findUnique({
              include: {
                activeCombatState: true,
                archivedCombatRounds: { orderBy: { roundNumber: "asc" } },
              },
              where: { id: encounterId },
            });
            const torn =
              !record?.activeCombatState ||
              record.activeCombatState.revision.getTime() !== record.updatedAt.getTime() ||
              record.archivedCombatRounds.length !== record.combatArchiveCount;
            bump(counter, torn ? "control.torn" : "control.ok");
          }
        };
        const monitor = async () => {
          while (Date.now() < stopAt) {
            bump(
              counter,
              (await storedAgreement(prisma!, encounterId)) ? "stored.consistent" : "stored.BROKEN",
            );
          }
        };

        await Promise.all([
          writer(),
          reader("full", (repository) => repository.getFullEncounterById(encounterId)),
          reader("history", (repository) => repository.getCombatHistorySourceById(encounterId)),
          reader("active", (repository) => repository.getActiveCombatStateById(encounterId)),
          reader("archived", (repository) => repository.getArchivedCombatRoundsById(encounterId)),
          untransactedControl(),
          monitor(),
        ]);

        const refusals = Object.entries(counter)
          .filter(
            ([key]) =>
              /^(full|history|active|archived)\./.test(key) &&
              !key.endsWith(".ok") &&
              !key.includes(".refusal."),
          )
          .reduce((total, [, value]) => total + value, 0);
        const readTotal = Object.entries(counter)
          .filter(
            ([key]) => /^(full|history|active|archived)\./.test(key) && !key.includes(".refusal."),
          )
          .reduce((total, [, value]) => total + value, 0);
        console.log(
          `[#1021 split read race] ${PROBE_MS}ms full-encounter reads N of M refused: ` +
            `${counter["full.malformed_split_storage"] ?? 0} of ${(counter["full.ok"] ?? 0) + (counter["full.malformed_split_storage"] ?? 0)}; ` +
            `all split reads refused: ${refusals} of ${readTotal}; counters ${JSON.stringify(counter)}`,
        );

        expect(counter["write.ok"] ?? 0).toBeGreaterThan(0);
        expect(counter["control.torn"] ?? 0).toBeGreaterThan(0);
        expect(counter["stored.BROKEN"] ?? 0).toBe(0);
        expect(counter["full.ok"] ?? 0).toBeGreaterThanOrEqual(PROBE_MIN_READS);
        expect(refusals).toBe(0);
      },
    );

    it("still refuses genuinely inconsistent stored rows and names the agreement that failed", async () => {
      const reads = createPrismaCombatStateReadRepository(prisma!);
      // Thunks, so each read starts only when it is awaited and no rejection is left unhandled.
      const allReads = (encounterId: string) => ({
        active: () => reads.getActiveCombatStateById(encounterId),
        archived: () => reads.getArchivedCombatRoundsById(encounterId),
        full: () => reads.getFullEncounterById(encounterId),
        history: () => reads.getCombatHistorySourceById(encounterId),
      });
      const expectRefusal = async (
        promise: Promise<unknown>,
        names: string[],
        absent: string[],
      ) => {
        const error = await promise.then(
          () => undefined,
          (caught: unknown) => caught,
        );
        expect(error).toBeInstanceOf(CombatPersistenceError);
        expect((error as CombatPersistenceError).code).toBe("malformed_split_storage");
        for (const name of names) {
          expect((error as Error).message).toContain(name);
        }
        for (const name of absent) {
          expect((error as Error).message).not.toContain(name);
        }
        return (error as Error).message;
      };

      await createSplitEncounter(prisma!, { archivedRounds: 3, encounterId: "skew-revision" });
      await createSplitEncounter(prisma!, { archivedRounds: 3, encounterId: "skew-count" });
      await createSplitEncounter(prisma!, { archivedRounds: 3, encounterId: "skew-both" });
      await createSplitEncounter(prisma!, { archivedRounds: 3, encounterId: "skew-row-missing" });
      await createSplitEncounter(prisma!, { archivedRounds: 3, encounterId: "missing-active" });

      for (const encounterId of ["skew-revision", "skew-both"]) {
        await prisma!.$executeRaw(Prisma.sql`
          UPDATE "EncounterActiveCombatState" SET revision = revision + interval '1 millisecond'
          WHERE "encounterId" = ${encounterId}`);
      }
      for (const encounterId of ["skew-count", "skew-both"]) {
        await prisma!.$executeRaw(Prisma.sql`
          UPDATE "Encounter" SET "combatArchiveCount" = "combatArchiveCount" + 1
          WHERE id = ${encounterId}`);
      }
      await prisma!.$executeRaw(Prisma.sql`
        DELETE FROM "EncounterArchivedCombatRound"
        WHERE "encounterId" = 'skew-row-missing' AND "roundNumber" = 3`);
      await prisma!.$executeRaw(Prisma.sql`
        DELETE FROM "EncounterActiveCombatState" WHERE "encounterId" = 'missing-active'`);

      for (const encounterId of ["skew-revision", "skew-count", "skew-both", "skew-row-missing"]) {
        expect(await storedAgreement(prisma!, encounterId)).toBe(false);
      }

      const revision = allReads("skew-revision");
      const messages: Record<string, string> = {};
      messages.revision = await expectRefusal(
        revision.full(),
        [REVISION_DISAGREEMENT],
        [ARCHIVE_COUNT_DISAGREEMENT],
      );
      await expectRefusal(
        revision.history(),
        [REVISION_DISAGREEMENT],
        [ARCHIVE_COUNT_DISAGREEMENT],
      );
      await expectRefusal(revision.active(), [REVISION_DISAGREEMENT], [ARCHIVE_COUNT_DISAGREEMENT]);
      // The archived-rounds view reads no active state, so a revision skew is not its concern.
      await expect(revision.archived()).resolves.toMatchObject({ encounterId: "skew-revision" });

      for (const encounterId of ["skew-count", "skew-row-missing"]) {
        const count = allReads(encounterId);
        messages[encounterId] = await expectRefusal(
          count.full(),
          [ARCHIVE_COUNT_DISAGREEMENT],
          [REVISION_DISAGREEMENT],
        );
        await expectRefusal(count.history(), [ARCHIVE_COUNT_DISAGREEMENT], [REVISION_DISAGREEMENT]);
        await expectRefusal(
          count.archived(),
          [ARCHIVE_COUNT_DISAGREEMENT],
          [REVISION_DISAGREEMENT],
        );
        // The active-state view reads no archive rows, so an archive skew is not its concern.
        await expect(count.active()).resolves.toMatchObject({ encounterId });
      }

      const both = allReads("skew-both");
      messages.both = await expectRefusal(
        both.full(),
        [REVISION_DISAGREEMENT, ARCHIVE_COUNT_DISAGREEMENT],
        [],
      );
      await expectRefusal(both.history(), [REVISION_DISAGREEMENT, ARCHIVE_COUNT_DISAGREEMENT], []);
      await expectRefusal(both.active(), [REVISION_DISAGREEMENT], [ARCHIVE_COUNT_DISAGREEMENT]);
      await expectRefusal(both.archived(), [ARCHIVE_COUNT_DISAGREEMENT], [REVISION_DISAGREEMENT]);

      const missing = allReads("missing-active");
      messages.missingActive = await expectRefusal(
        missing.full(),
        ["active-state row is missing"],
        [REVISION_DISAGREEMENT, ARCHIVE_COUNT_DISAGREEMENT],
      );
      await expectRefusal(missing.history(), ["active-state row is missing"], []);
      await expectRefusal(missing.active(), ["active-state row is missing"], []);
      await expect(missing.archived()).resolves.toMatchObject({ encounterId: "missing-active" });

      // The message names agreements only; it carries no stored values.
      for (const message of Object.values(messages)) {
        expect(message).not.toMatch(/\d{4}-\d{2}-\d{2}|\d+ (?:!==|vs)/);
      }
      console.log(`[#1021 raw-SQL refusals] ${JSON.stringify(messages)}`);
    });

    it.runIf(process.env.SPLIT_READ_LATENCY === "1")(
      "reports full-encounter read latency at about 200 participants",
      { timeout: 300_000 },
      async () => {
        const encounterId = "split-read-latency";
        await createSplitEncounter(prisma!, {
          archivedRounds: 10,
          encounterId,
          participantCount: 200,
        });
        const reads = createPrismaCombatStateReadRepository(prisma!);
        const iterations = Number(process.env.SPLIT_READ_LATENCY_ITERATIONS ?? 500);
        for (let index = 0; index < 50; index += 1) {
          await reads.getFullEncounterById(encounterId);
        }
        const samples: number[] = [];
        for (let index = 0; index < iterations; index += 1) {
          const started = process.hrtime.bigint();
          const view = await reads.getFullEncounterById(encounterId);
          samples.push(Number(process.hrtime.bigint() - started) / 1e6);
          expect(view?.encounter.participants).toHaveLength(200);
        }
        samples.sort((left, right) => left - right);
        const at = (quantile: number) =>
          samples[Math.min(samples.length - 1, Math.floor(quantile * samples.length))]!.toFixed(3);
        const mean = (samples.reduce((total, value) => total + value, 0) / samples.length).toFixed(
          3,
        );
        console.log(
          `[#1021 latency] getFullEncounterById, 200 participants, 10 archived rounds, ` +
            `${iterations} sequential reads: mean ${mean} ms, p50 ${at(0.5)} ms, p95 ${at(0.95)} ms, p99 ${at(0.99)} ms`,
        );
      },
    );
  });
}
