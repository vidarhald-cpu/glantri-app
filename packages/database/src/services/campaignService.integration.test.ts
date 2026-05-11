import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import { CampaignService } from "./campaignService";

const prisma = getTestPrismaClient();

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("CampaignService integration tests (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("CampaignService integration", () => {
    beforeEach(async () => {
      await resetTestDatabase(prisma!);
    });

    afterAll(async () => {
      await resetTestDatabase(prisma!);
    });

    it("creates a campaign and lists it by game master", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const service = new CampaignService(repo);

      const campaign = await service.createCampaign({
        gmUserId: gm.id,
        name: "The Broken Crown",
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
      const gmA = await createTestUser(prisma!, { roles: ["game_master"] });
      const gmB = await createTestUser(prisma!, { roles: ["game_master"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const service = new CampaignService(repo);

      await service.createCampaign({ gmUserId: gmA.id, name: "Campaign A" });
      await service.createCampaign({ gmUserId: gmB.id, name: "Campaign B" });

      const listA = await service.listCampaignsByGameMaster(gmA.id);
      const listB = await service.listCampaignsByGameMaster(gmB.id);

      expect(listA).toHaveLength(1);
      expect(listA[0]?.name).toBe("Campaign A");
      expect(listB).toHaveLength(1);
      expect(listB[0]?.name).toBe("Campaign B");
    });
  });
}
