import { beforeEach, describe, expect, it } from "vitest";

import {
  buildRoleplayCalculationPreview,
  encounterSessionSchema,
  normalizeRoleplayState,
} from "@glantri/domain";
import { assignRoleplayStatCheck, recordRoleplayStatCheckResult } from "@glantri/rules-engine";

import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createPrismaCharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { createPrismaCharacterRepository } from "../repositories/characterRepository";
import { createPrismaEncounterRepository } from "../repositories/encounterRepository";
import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { createTestCharacter, createTestUser } from "../testing/factories";
import { CampaignService } from "./campaignService";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterService } from "./characterService";
import { EncounterWriteError, EncounterService } from "./encounterService";
import { ScenarioService } from "./scenarioService";

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
    status: "planned",
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

    it("allows disjoint active Encounters and atomically accepts only one overlapping start", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const ownerA = await createTestUser(prisma!);
      const ownerB = await createTestUser(prisma!);
      const characterA = await createTestCharacter(prisma!, ownerA.id, { name: "Player A" });
      const characterB = await createTestCharacter(prisma!, ownerB.id, { name: "Player B" });
      const scenarioRepository = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const equipmentService = new CharacterEquipmentReadModelService(
        createPrismaCharacterEquipmentRepository(prisma!),
      );
      const campaignService = new CampaignService(scenarioRepository, characterService);
      const scenarioService = new ScenarioService(
        scenarioRepository,
        characterService,
        equipmentService,
      );
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Lost Seal",
        status: "active",
      });
      for (const character of [characterA, characterB]) {
        await campaignService.addCampaignRosterEntry({
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        });
      }
      const scenario = await scenarioService.createScenario({
        campaignId: campaign.id,
        name: "Lost Seal",
        status: "live",
      });
      const participantA = await scenarioService.addCharacterParticipant({
        characterId: characterA.id,
        controlledByUserId: ownerA.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const participantB = await scenarioService.addCharacterParticipant({
        characterId: characterB.id,
        controlledByUserId: ownerB.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const service = new EncounterService(
        createPrismaEncounterRepository(prisma!),
        scenarioRepository,
      );
      const makeEncounter = async (id: string, participantId: string) =>
        service.createEncounter({
          campaignId: campaign.id,
          scenarioId: scenario.id,
          session: encounterSessionSchema.parse({
            createdAt: "2026-08-22T10:00:00.000Z",
            id,
            participantMembershipMode: "explicit",
            participants: [
              {
                id: `${id}-participant`,
                label: id,
                participantType: "scenario",
                scenarioParticipantId: participantId,
              },
            ],
            scenarioId: scenario.id,
            status: "planned",
            title: id,
            updatedAt: "2026-08-22T10:00:00.000Z",
          }),
        });
      const [library, courtyard] = await Promise.all([
        makeEncounter("library", participantA.id),
        makeEncounter("courtyard", participantB.id),
      ]);
      const disjointStarts = await Promise.all([
        service.updateEncounter({
          encounterId: library.id,
          expectedRevision: library.updatedAt,
          scenarioId: scenario.id,
          session: { ...library, status: "active" },
        }),
        service.updateEncounter({
          encounterId: courtyard.id,
          expectedRevision: courtyard.updatedAt,
          scenarioId: scenario.id,
          session: { ...courtyard, status: "active" },
        }),
      ]);
      expect(disjointStarts.map((encounter) => encounter.status)).toEqual(["active", "active"]);

      const pausedLibrary = await service.updateEncounter({
        encounterId: library.id,
        expectedRevision: disjointStarts[0].updatedAt,
        scenarioId: scenario.id,
        session: { ...disjointStarts[0], status: "paused" },
      });
      const [vault, chapel] = await Promise.all([
        makeEncounter("vault", participantA.id),
        makeEncounter("chapel", participantA.id),
      ]);
      const overlappingStarts = await Promise.allSettled(
        [vault, chapel].map((encounter) =>
          service.updateEncounter({
            encounterId: encounter.id,
            expectedRevision: encounter.updatedAt,
            scenarioId: scenario.id,
            session: { ...encounter, status: "active" },
          }),
        ),
      );
      expect(pausedLibrary.status).toBe("paused");
      expect(overlappingStarts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = overlappingStarts.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(rejected?.reason).toBeInstanceOf(EncounterWriteError);
      expect(rejected?.reason).toMatchObject({
        code: expect.stringMatching(/^(participant_already_active|transaction_conflict)$/),
      });
    });
  });
}
