import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaCharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { createPrismaCharacterRepository } from "../repositories/characterRepository";
import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { createTestCharacter, createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { CampaignService } from "./campaignService";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterEquipmentWriteService } from "./characterEquipmentWriteService";
import { CharacterService } from "./characterService";
import { ScenarioService } from "./scenarioService";

const prisma = getTestPrismaClient();

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("ScenarioService integration tests (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("ScenarioService integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    afterAll(async () => {
      await resetTestDatabase(prisma!);
    });

    it("creates a scenario within a campaign and lists it", async () => {
      const gm = await createTestUser(prisma!, { roles: ["gm"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const campaignService = new CampaignService(repo);
      const service = new ScenarioService(repo);

      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Frontier War",
      });

      const scenario = await service.createScenario({
        campaignId: campaign.id,
        name: "First Battle",
      });

      expect(scenario.id).toBeDefined();
      expect(scenario.campaignId).toBe(campaign.id);
      expect(scenario.name).toBe("First Battle");
      expect(scenario.status).toBe("draft");

      const list = await service.listScenariosByCampaign(campaign.id);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(scenario.id);
    });

    it("creates a continuation scenario and records the relationship", async () => {
      const gm = await createTestUser(prisma!, { roles: ["gm"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const campaignService = new CampaignService(repo);
      const service = new ScenarioService(repo);

      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "The Long Road",
      });
      const first = await service.createScenario({ campaignId: campaign.id, name: "Departure" });
      const second = await service.createScenario({
        campaignId: campaign.id,
        continuesFromScenarioId: first.id,
        name: "Arrival",
      });

      const relationships = await service.listScenarioRelationshipsByCampaign(campaign.id);
      expect(relationships).toHaveLength(1);
      expect(relationships[0]?.fromScenarioId).toBe(first.id);
      expect(relationships[0]?.toScenarioId).toBe(second.id);
      expect(relationships[0]?.relationType).toBe("continues_from");
    });

    it("requires Campaign roster membership before any Character can enter a Scenario", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const owner = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, owner.id, { name: "Ari" });
      const repo = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const equipmentService = new CharacterEquipmentReadModelService(
        createPrismaCharacterEquipmentRepository(prisma!),
      );
      const campaignService = new CampaignService(repo, characterService);
      const service = new ScenarioService(repo, characterService, equipmentService);
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Roster Gate",
      });
      const scenario = await service.createScenario({
        campaignId: campaign.id,
        name: "Closed Scene",
      });

      await expect(
        service.addCharacterParticipant({
          characterId: character.id,
          controlledByUserId: gm.id,
          joinSource: "gm_added",
          scenarioId: scenario.id,
        }),
      ).rejects.toThrow("Character is not in the campaign roster.");
      await expect(prisma!.scenarioParticipant.count()).resolves.toBe(0);
      await expect(
        prisma!.character.findUnique({ where: { id: character.id } }),
      ).resolves.toMatchObject({ ownerId: owner.id });
    });

    it("accepts exactly one terminal mutation when prepared scenarios concurrently transition", async () => {
      const gm = await createTestUser(prisma!, { roles: ["gm"] });
      const repository = createPrismaScenarioRepository(prisma!);
      const campaignService = new CampaignService(repository);
      const service = new ScenarioService(repository);

      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Prepared Race",
      });

      for (let race = 0; race < 5; race += 1) {
        const scenario = await service.createScenario({
          campaignId: campaign.id,
          name: `Prepared Race ${race}`,
          status: "prepared",
        });

        const [liveResult, archivedResult] = await Promise.allSettled([
          service.updateScenario({
            expectedRevision: scenario.updatedAt,
            scenarioId: scenario.id,
            status: "live",
          }),
          service.updateScenario({
            expectedRevision: scenario.updatedAt,
            scenarioId: scenario.id,
            status: "archived",
          }),
        ]);

        const fulfilled =
          liveResult.status === "fulfilled" || archivedResult.status === "fulfilled";
        const failed = liveResult.status === "rejected" || archivedResult.status === "rejected";
        expect(fulfilled).toBe(true);
        expect(failed).toBe(true);

        const winner =
          liveResult.status === "fulfilled"
            ? liveResult.value
            : archivedResult.status === "fulfilled"
              ? archivedResult.value
              : null;
        expect(winner).not.toBeNull();

        const finalScenario = await service.getScenarioById(scenario.id);
        expect(finalScenario?.status).toBe(winner!.status);

        let loser: PromiseRejectedResult | null = null;
        if (liveResult.status === "rejected") {
          loser = liveResult;
        } else if (archivedResult.status === "rejected") {
          loser = archivedResult;
        }
        expect(loser).not.toBeNull();
        expect(loser!.reason).toMatchObject({
          code: expect.stringMatching(/^(stale_revision|transaction_conflict)$/),
        });
      }
    });

    it("withholds a delegated live Scenario from its Character owner", async () => {
      const gm = await createTestUser(prisma!, { roles: ["gm"] });
      const owner = await createTestUser(prisma!);
      const delegatedController = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, owner.id, { name: "Ari" });
      const repo = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const equipmentService = new CharacterEquipmentReadModelService(
        createPrismaCharacterEquipmentRepository(prisma!),
      );
      const campaignService = new CampaignService(repo, characterService);
      const service = new ScenarioService(repo, characterService, equipmentService);
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Delegated Campaign",
        status: "active",
      });
      const scenario = await service.createScenario({
        campaignId: campaign.id,
        description: "Private to delegated controller",
        name: "Delegated Private Scenario",
        status: "live",
      });
      await campaignService.addCampaignRosterEntry({
        campaignId: campaign.id,
        category: "pc",
        sourceId: character.id,
        sourceType: "character",
      });
      await service.addCharacterParticipant({
        characterId: character.id,
        controlledByUserId: delegatedController.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });

      await expect(
        service.listScenariosByCampaignPlayerAccess(campaign.id, owner.id),
      ).resolves.toEqual([expect.objectContaining({ id: scenario.id })]);
      await expect(
        service.listScenariosByCampaignPlayerControl(campaign.id, owner.id),
      ).resolves.toEqual([]);
      await expect(
        service.listScenariosByCampaignPlayerControl(campaign.id, delegatedController.id),
      ).resolves.toEqual([expect.objectContaining({ id: scenario.id })]);
      await expect(
        service.userHasPlayerScenarioAccess({ scenarioId: scenario.id, userId: owner.id }),
      ).resolves.toBe(false);
      await expect(
        service.userHasPlayerScenarioAccess({
          scenarioId: scenario.id,
          userId: delegatedController.id,
        }),
      ).resolves.toBe(true);
    });

    it("atomically picks up a canonical Item once and preserves availability on stale failure", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const sourceOwner = await createTestUser(prisma!);
      const targetOwner = await createTestUser(prisma!);
      const source = await createTestCharacter(prisma!, sourceOwner.id, { name: "Steward" });
      const target = await createTestCharacter(prisma!, targetOwner.id, { name: "Player A" });
      const repository = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const equipmentRepository = createPrismaCharacterEquipmentRepository(prisma!);
      const equipmentReadService = new CharacterEquipmentReadModelService(equipmentRepository);
      const equipmentWriteService = new CharacterEquipmentWriteService(equipmentRepository);
      const campaignService = new CampaignService(repository, characterService);
      const service = new ScenarioService(repository, characterService, equipmentReadService);
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Lost Seal",
        status: "active",
      });
      for (const character of [source, target]) {
        await campaignService.addCampaignRosterEntry({
          campaignId: campaign.id,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        });
        await equipmentWriteService.ensureCharacterEquipmentInitialized(character.id);
      }
      const scenario = await service.createScenario({
        campaignId: campaign.id,
        name: "Lost Seal",
        status: "live",
      });
      const targetParticipant = await service.addCharacterParticipant({
        characterId: target.id,
        controlledByUserId: targetOwner.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const createSeal = (name: string) =>
        equipmentWriteService.createCampaignEquipmentItem({
          campaignId: campaign.id,
          displayName: name,
          holderCharacterId: source.id,
          itemFacts: {
            activeMechanics: [],
            descriptiveTraits: [],
            templateOverrides: [],
            unsupportedCapabilities: [],
            version: 1,
          },
          templateId: "weapon-template-dagger",
        });
      const seal = await createSeal("Lost Seal");
      const prepared = await service.updateScenarioSessionState({
        availableObjects: [
          {
            addedAt: "2026-08-22T10:00:00.000Z",
            id: "available-seal",
            sourceId: seal.id,
            sourceKind: "campaign_item",
            visibility: "players",
          },
        ],
        expectedRevision: scenario.updatedAt,
        gmPrivateNotes: "The steward is nervous.",
        scenarioId: scenario.id,
      });
      const pickedUp = await service.pickUpScenarioAvailableItem({
        actorUserId: targetOwner.id,
        availabilityId: "available-seal",
        expectedRevision: prepared.updatedAt,
        requestId: "pickup-request-1",
        scenarioId: scenario.id,
        targetParticipantId: targetParticipant.id,
        viewerMode: "player",
      });
      expect(pickedUp.idempotent).toBe(false);
      expect(pickedUp.scenario.liveState?.session.availableObjects).toEqual([]);
      expect(await equipmentRepository.getCanonicalEquipmentItemById(seal.id)).toMatchObject({
        holderCharacterId: target.id,
      });
      const retried = await service.pickUpScenarioAvailableItem({
        actorUserId: targetOwner.id,
        availabilityId: "available-seal",
        expectedRevision: prepared.updatedAt,
        requestId: "pickup-request-1",
        scenarioId: scenario.id,
        targetParticipantId: targetParticipant.id,
        viewerMode: "player",
      });
      expect(retried.idempotent).toBe(true);
      await expect(
        service.pickUpScenarioAvailableItem({
          actorUserId: gm.id,
          availabilityId: "available-seal",
          expectedRevision: prepared.updatedAt,
          requestId: "pickup-request-1",
          scenarioId: scenario.id,
          targetParticipantId: targetParticipant.id,
          viewerMode: "gm",
        }),
      ).rejects.toThrow("completed pickup could not be reloaded");
      expect(
        (await service.listScenarioEventLogs(scenario.id)).filter(
          (event) => event.eventType === "item_transferred",
        ),
      ).toHaveLength(1);

      const staleSeal = await createSeal("Stale Seal");
      const latestScenario = await service.getScenarioById(scenario.id);
      const stalePrepared = await service.updateScenarioSessionState({
        availableObjects: [
          {
            addedAt: "2026-08-22T10:10:00.000Z",
            id: "available-stale-seal",
            sourceId: staleSeal.id,
            sourceKind: "campaign_item",
            visibility: "players",
          },
        ],
        expectedRevision: latestScenario!.updatedAt,
        gmPrivateNotes: "",
        scenarioId: scenario.id,
      });
      await equipmentWriteService.transferCampaignEquipmentItem({
        campaignId: campaign.id,
        itemId: staleSeal.id,
        sourceCharacterId: source.id,
        targetCharacterId: target.id,
      });
      await expect(
        service.pickUpScenarioAvailableItem({
          actorUserId: targetOwner.id,
          availabilityId: "available-stale-seal",
          expectedRevision: stalePrepared.updatedAt,
          requestId: "pickup-request-stale",
          scenarioId: scenario.id,
          targetParticipantId: targetParticipant.id,
          viewerMode: "player",
        }),
      ).rejects.toThrow("no longer held");
      const afterFailure = await service.getScenarioById(scenario.id);
      expect(afterFailure?.liveState?.session.availableObjects).toEqual([
        expect.objectContaining({ id: "available-stale-seal" }),
      ]);
      expect(
        (await service.listScenarioEventLogs(scenario.id)).filter(
          (event) => event.eventType === "item_transferred",
        ),
      ).toHaveLength(1);
    });
  });
}
