import { beforeEach, describe, expect, it } from "vitest";

import {
  combatRoundStateSchema,
  encounterSessionSchema,
  setCombatRoundCombatExperienceDifficulty,
} from "@glantri/domain";

import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import {
  CombatPersistenceError,
  COMBAT_STORAGE_MODE_SPLIT_V1,
  createPrismaCombatStatePersistenceRepository,
} from "./combatStatePersistenceRepository";
import { createPrismaCombatStateReadRepository } from "./combatStateReadRepository";

const prisma = getTestPrismaClient();

function buildLegacySession(updatedAt: string) {
  return encounterSessionSchema.parse({
    actionLog: [],
    combatRoundState: combatRoundStateSchema.parse({
      commands: [],
      encounterId: "split-integration",
      participants: [{ label: "Aria", participantId: "aria" }],
      roundNumber: 2,
      rounds: [{ encounterId: "split-integration", roundNumber: 1 }],
    }),
    createdAt: "2026-07-26T09:00:00.000Z",
    currentRound: 2,
    id: "split-integration",
    kind: "combat",
    participants: [
      {
        id: "aria",
        label: "Aria",
        participantType: "scenario",
        scenarioParticipantId: "scenario-aria",
      },
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "Split integration",
    updatedAt,
  });
}

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("Combat split persistence integration (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("Combat split persistence integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    it("materializes legacy storage, preserves archives across active writes, and cascades deletion", async () => {
      const initial = buildLegacySession("2026-07-26T10:00:00.000Z");
      const created = await prisma!.encounter.create({
        data: {
          id: initial.id,
          name: initial.title,
          scenarioId: initial.scenarioId,
          sessionJson: initial as never,
          status: initial.status,
        },
      });
      const persistence = createPrismaCombatStatePersistenceRepository(prisma!);
      const reads = createPrismaCombatStateReadRepository(prisma!);

      const materialized = await persistence.updateCombatEncounter({
        encounterId: initial.id,
        expectedRevision: created.updatedAt.toISOString(),
        scenarioId: initial.scenarioId,
        session: initial,
      });
      const splitRecord = await prisma!.encounter.findUniqueOrThrow({
        include: {
          activeCombatState: true,
          archivedCombatRounds: true,
        },
        where: { id: initial.id },
      });

      expect(splitRecord.combatStorageMode).toBe(COMBAT_STORAGE_MODE_SPLIT_V1);
      expect(splitRecord.combatArchiveCount).toBe(1);
      expect(splitRecord.activeCombatState).not.toBeNull();
      expect(splitRecord.archivedCombatRounds).toHaveLength(1);
      expect(splitRecord.sessionJson).not.toHaveProperty("combatRoundState");
      await expect(reads.getFullEncounterById(initial.id)).resolves.toMatchObject({
        encounter: expect.objectContaining({
          combatRoundState: materialized.combatRoundState,
          id: initial.id,
        }),
      });

      const archiveCreatedAt = splitRecord.archivedCombatRounds[0]!.createdAt;
      const activeMutation = await persistence.updateCombatEncounter({
        encounterId: initial.id,
        expectedRevision: materialized.updatedAt,
        scenarioId: initial.scenarioId,
        session: {
          ...materialized,
          description: "Active-only mutation",
          combatRoundState: {
            ...materialized.combatRoundState!,
            selectedParticipantId: "aria",
          },
        },
      });
      const afterMutation = await prisma!.encounter.findUniqueOrThrow({
        include: { archivedCombatRounds: true },
        where: { id: initial.id },
      });

      expect(afterMutation.archivedCombatRounds).toHaveLength(1);
      expect(afterMutation.archivedCombatRounds[0]!.createdAt).toEqual(archiveCreatedAt);
      expect(activeMutation.combatRoundState?.selectedParticipantId).toBe("aria");

      await prisma!.encounter.delete({ where: { id: initial.id } });
      await expect(
        prisma!.encounterActiveCombatState.count({ where: { encounterId: initial.id } }),
      ).resolves.toBe(0);
      await expect(
        prisma!.encounterArchivedCombatRound.count({ where: { encounterId: initial.id } }),
      ).resolves.toBe(0);
    });

    it("keeps concurrent first legacy writes atomic and accepts only one revision", async () => {
      const initial = buildLegacySession("2026-07-26T10:00:00.000Z");
      const created = await prisma!.encounter.create({
        data: {
          id: initial.id,
          name: initial.title,
          scenarioId: initial.scenarioId,
          sessionJson: initial as never,
          status: initial.status,
        },
      });
      const persistence = createPrismaCombatStatePersistenceRepository(prisma!, {
        retryDelay: async () => undefined,
      });
      const expectedRevision = created.updatedAt.toISOString();

      const results = await Promise.allSettled(
        [26, 36].map((difficulty) =>
          persistence.updateCombatEncounter({
            encounterId: initial.id,
            expectedRevision,
            scenarioId: initial.scenarioId,
            session: {
              ...initial,
              combatRoundState: setCombatRoundCombatExperienceDifficulty({
                difficulty,
                state: initial.combatRoundState!,
              }),
            },
          }),
        ),
      );

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(rejected?.reason).toBeInstanceOf(CombatPersistenceError);
      expect(rejected?.reason).toMatchObject({ code: "stale_revision" });

      const splitRecord = await prisma!.encounter.findUniqueOrThrow({
        include: {
          activeCombatState: true,
          archivedCombatRounds: true,
        },
        where: { id: initial.id },
      });
      expect(splitRecord.combatStorageMode).toBe(COMBAT_STORAGE_MODE_SPLIT_V1);
      expect(splitRecord.activeCombatState).not.toBeNull();
      expect(splitRecord.archivedCombatRounds).toHaveLength(1);
      expect(
        [26, 36].includes(
          (
            splitRecord.activeCombatState?.stateJson as {
              combatExperienceDifficulty?: number;
            }
          ).combatExperienceDifficulty ?? 0,
        ),
      ).toBe(true);
      expect(
        await prisma!.encounterActiveCombatState.count({
          where: { encounterId: initial.id },
        }),
      ).toBe(1);
    });
  });
}
