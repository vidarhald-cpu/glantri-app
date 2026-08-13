import { beforeEach, describe, expect, it } from "vitest";

import {
  buildRoleplayCalculationPreview,
  encounterSessionSchema,
  normalizeRoleplayState,
} from "@glantri/domain";
import { assignRoleplayStatCheck, recordRoleplayStatCheckResult } from "@glantri/rules-engine";

import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createPrismaEncounterRepository } from "../repositories/encounterRepository";
import { EncounterWriteError, EncounterService } from "./encounterService";

const prisma = getTestPrismaClient();

function buildPendingStatCheck() {
  const session = encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-08-13T10:00:00.000Z",
    currentRound: 1,
    id: "roleplay-concurrency",
    kind: "roleplay",
    participants: [
      {
        id: "ari",
        label: "Ari",
        participantType: "scenario",
        scenarioParticipantId: "scenario-ari",
      },
    ],
    scenarioId: "scenario-roleplay-concurrency",
    status: "active",
    title: "Council chamber",
    updatedAt: "2026-08-13T10:00:00.000Z",
  });

  return assignRoleplayStatCheck({
    difficulty: "medium",
    participantId: "ari",
    participantName: "Ari",
    session,
    statId: "dex",
    statLabel: "Dex",
    statValue: 14,
  });
}

function resolvePendingStatCheck(
  session: ReturnType<typeof buildPendingStatCheck>,
  rollD20: 4 | 19,
) {
  const pending = normalizeRoleplayState(session).pendingStatChecks[0]!;
  const roll = { dieResult: rollD20, openEndedD10s: [], rollD20 };
  const preview = buildRoleplayCalculationPreview({
    difficulty: pending.difficulty,
    kind: "stat",
    roll,
    skillLabel: pending.statLabel,
    skillValue: pending.statValue,
  });

  return recordRoleplayStatCheckResult({
    achievedSuccessLevel: preview.achievedSuccessLevel,
    autoSuccess: preview.autoSuccess,
    calculationText: preview.calculationText,
    difficulty: pending.difficulty,
    finalTotal: preview.finalTotal,
    fumble: preview.fumble,
    numericSubtotal: preview.numericSubtotal,
    participantId: pending.participantId,
    participantName: "Ari",
    pendingRollId: pending.id,
    roll,
    session,
    statId: pending.statId,
    statLabel: pending.statLabel,
    statValue: pending.statValue,
    success: preview.success,
  });
}

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("Encounter roleplay persistence integration (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("Encounter roleplay persistence integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    it("accepts exactly one concurrent Stat result and returns the durable winner", async () => {
      const service = new EncounterService(createPrismaEncounterRepository(prisma!));
      const created = await service.createEncounter({
        scenarioId: "scenario-roleplay-concurrency",
        session: buildPendingStatCheck(),
      });
      const candidates = [4, 19] as const;

      const results = await Promise.allSettled(
        candidates.map((rollD20) =>
          service.updateEncounter({
            encounterId: created.id,
            expectedRevision: created.updatedAt,
            scenarioId: created.scenarioId,
            session: resolvePendingStatCheck(created, rollD20),
          }),
        ),
      );

      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<typeof created> => result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.reason).toBeInstanceOf(EncounterWriteError);
      expect(rejected[0]!.reason).toMatchObject({
        code: expect.stringMatching(/^(stale_revision|transaction_conflict)$/),
      });

      const durable = await service.getEncounterById(created.id);
      const acceptedResult = normalizeRoleplayState(fulfilled[0]!.value).actionLog.find(
        (entry) => entry.type === "stat_check_result",
      );
      const durableResult = normalizeRoleplayState(durable!).actionLog.find(
        (entry) => entry.type === "stat_check_result",
      );
      expect(candidates).toContain(acceptedResult?.rollD20);
      expect(durableResult?.rollD20).toBe(acceptedResult?.rollD20);
      expect(durableResult?.pendingRollId).toBe(acceptedResult?.pendingRollId);
    });
  });
}
