import { beforeEach, describe, expect, it } from "vitest";

import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { createTestUser } from "../testing/factories";
import { ScenarioService } from "./scenarioService";

const prisma = getTestPrismaClient();

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("ScenarioService integration tests (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("ScenarioService integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    it("creates a campaign and lists it by game master", async () => {
      const gm = await createTestUser(prisma!, { roles: ["gm"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const service = new ScenarioService(repo);

      const campaign = await service.createCampaign({
        gmUserId: gm.id,
        name: "The Broken Crown"
      });

      expect(campaign.id).toBeDefined();
      expect(campaign.name).toBe("The Broken Crown");
      expect(campaign.gmUserId).toBe(gm.id);
      expect(campaign.status).toBe("draft");

      const list = await service.listCampaignsByGameMaster(gm.id);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(campaign.id);
    });

    it("only returns campaigns belonging to the requesting GM", async () => {
      const gmA = await createTestUser(prisma!, { roles: ["gm"] });
      const gmB = await createTestUser(prisma!, { roles: ["gm"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const service = new ScenarioService(repo);

      await service.createCampaign({ gmUserId: gmA.id, name: "Campaign A" });
      await service.createCampaign({ gmUserId: gmB.id, name: "Campaign B" });

      const listA = await service.listCampaignsByGameMaster(gmA.id);
      const listB = await service.listCampaignsByGameMaster(gmB.id);

      expect(listA).toHaveLength(1);
      expect(listA[0]?.name).toBe("Campaign A");
      expect(listB).toHaveLength(1);
      expect(listB[0]?.name).toBe("Campaign B");
    });

    it("creates a scenario within a campaign and lists it", async () => {
      const gm = await createTestUser(prisma!, { roles: ["gm"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const service = new ScenarioService(repo);

      const campaign = await service.createCampaign({ gmUserId: gm.id, name: "Frontier War" });

      const scenario = await service.createScenario({
        campaignId: campaign.id,
        name: "First Battle"
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
      const service = new ScenarioService(repo);

      const campaign = await service.createCampaign({ gmUserId: gm.id, name: "The Long Road" });
      const first = await service.createScenario({ campaignId: campaign.id, name: "Departure" });
      const second = await service.createScenario({
        campaignId: campaign.id,
        continuesFromScenarioId: first.id,
        name: "Arrival"
      });

      const relationships = await service.listScenarioRelationshipsByCampaign(campaign.id);
      expect(relationships).toHaveLength(1);
      expect(relationships[0]?.fromScenarioId).toBe(first.id);
      expect(relationships[0]?.toScenarioId).toBe(second.id);
      expect(relationships[0]?.relationType).toBe("continues_from");
    });
  });
}
