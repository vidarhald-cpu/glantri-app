import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaCharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { createPrismaCharacterRepository } from "../repositories/characterRepository";
import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { createTestCharacter, createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { CampaignService } from "./campaignService";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterService } from "./characterService";
import { ScenarioService } from "./scenarioService";

const prisma = getTestPrismaClient();

function holdNextLifecycleCommit(repository: ReturnType<typeof createPrismaScenarioRepository>) {
  const transition = repository.transitionScenarioLifecycle.bind(repository);
  let releaseCommit!: () => void;
  let reportPreflightComplete!: () => void;
  const commitReleased = new Promise<void>((resolve) => {
    releaseCommit = resolve;
  });
  const preflightComplete = new Promise<void>((resolve) => {
    reportPreflightComplete = resolve;
  });

  repository.transitionScenarioLifecycle = async (input) => {
    reportPreflightComplete();
    await commitReleased;
    return transition(input);
  };

  return { preflightComplete, releaseCommit };
}

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
      });
      await service.addCharacterParticipant({
        characterId: character.id,
        controlledByUserId: delegatedController.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      await service.transitionScenarioLifecycle({
        action: "start",
        actorUserId: gm.id,
        expectedRevision: 1,
        reason: "Start delegated Scenario",
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

    it("commits only one transition for concurrent requests with the same revision", async () => {
      const gm = await createTestUser(prisma!, { roles: ["gm"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const campaignService = new CampaignService(repo);
      const service = new ScenarioService(repo);
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Concurrency Campaign",
      });
      const scenario = await service.createScenario({
        campaignId: campaign.id,
        description: "Ready for play",
        name: "Concurrent Start",
      });
      const request = () =>
        service.transitionScenarioLifecycle({
          acceptedWarningCodes: ["no_active_player_participants"],
          action: "start",
          actorUserId: gm.id,
          expectedRevision: 0,
          reason: "Start once",
          scenarioId: scenario.id,
        });

      const results = await Promise.allSettled([request(), request()]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      await expect(service.listScenarioLifecycleTransitions(scenario.id)).resolves.toHaveLength(1);
      await expect(service.getScenarioById(scenario.id)).resolves.toMatchObject({
        lifecycleCycle: 1,
        lifecycleRevision: 1,
        status: "live",
      });
    });

    it("rejects start when Scenario metadata changes after preflight", async () => {
      const gm = await createTestUser(prisma!, { roles: ["gm"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const campaignService = new CampaignService(repo);
      const service = new ScenarioService(repo);
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Metadata Race Campaign",
      });
      const scenario = await service.createScenario({
        campaignId: campaign.id,
        description: "Ready for play",
        name: "Metadata Race",
      });
      const gate = holdNextLifecycleCommit(repo);
      const start = service.transitionScenarioLifecycle({
        acceptedWarningCodes: ["no_active_player_participants"],
        action: "start",
        actorUserId: gm.id,
        expectedRevision: 0,
        reason: "Start from checked metadata",
        scenarioId: scenario.id,
      });

      await gate.preflightComplete;
      await service.updateScenario({ description: "", scenarioId: scenario.id });
      gate.releaseCommit();

      await expect(start).rejects.toMatchObject({
        code: "stale_revision",
      });
      await expect(service.listScenarioLifecycleTransitions(scenario.id)).resolves.toHaveLength(0);
      await expect(service.getScenarioById(scenario.id)).resolves.toMatchObject({
        lifecycleRevision: 1,
        status: "draft",
      });
    });

    it("rejects start when participant readiness changes after preflight", async () => {
      const gm = await createTestUser(prisma!, { roles: ["gm"] });
      const player = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, player.id, { name: "Ready Hero" });
      const repo = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const equipmentService = new CharacterEquipmentReadModelService(
        createPrismaCharacterEquipmentRepository(prisma!),
      );
      const campaignService = new CampaignService(repo, characterService);
      const service = new ScenarioService(repo, characterService, equipmentService);
      const campaign = await campaignService.createCampaign({
        gmUserId: gm.id,
        name: "Participant Race Campaign",
      });
      const scenario = await service.createScenario({
        campaignId: campaign.id,
        description: "Ready for play",
        name: "Participant Race",
      });
      const participant = await service.addCharacterParticipant({
        characterId: character.id,
        joinSource: "gm_added",
        scenarioId: scenario.id,
      });
      const gate = holdNextLifecycleCommit(repo);
      const start = service.transitionScenarioLifecycle({
        action: "start",
        actorUserId: gm.id,
        expectedRevision: 1,
        reason: "Start from checked participants",
        scenarioId: scenario.id,
      });

      await gate.preflightComplete;
      await service.updateScenarioParticipantMetadata({
        isActive: false,
        participantId: participant.id,
        scenarioId: scenario.id,
      });
      gate.releaseCommit();

      await expect(start).rejects.toMatchObject({
        code: "stale_revision",
      });
      await expect(service.listScenarioLifecycleTransitions(scenario.id)).resolves.toHaveLength(0);
      await expect(service.getScenarioById(scenario.id)).resolves.toMatchObject({
        lifecycleRevision: 2,
        status: "draft",
      });
    });
  });
}
