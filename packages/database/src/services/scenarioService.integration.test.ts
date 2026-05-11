import { beforeEach, describe, expect, it } from "vitest";

import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { CampaignService } from "./campaignService";
import { ScenarioService } from "./scenarioService";

const prisma = getTestPrismaClient();

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("ScenarioService integration tests (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("ScenarioService integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    it("creates a scenario within a campaign and lists it", async () => {
      const gm = await createTestUser(prisma!, { roles: ["gm"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const campaignService = new CampaignService(repo);
      const service = new ScenarioService(repo);

      const campaign = await campaignService.createCampaign({ gmUserId: gm.id, name: "Frontier War" });

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
      const campaignService = new CampaignService(repo);
      const service = new ScenarioService(repo);

      const campaign = await campaignService.createCampaign({ gmUserId: gm.id, name: "The Long Road" });
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
