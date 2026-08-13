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

    it("atomically creates one generated campaign NPC and its roster membership", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const service = new CampaignService(repo);
      const campaign = await service.createCampaign({
        gmUserId: gm.id,
        name: "Border Trouble",
      });

      const result = await service.createCampaignNpc({
        campaignId: campaign.id,
        gmUserId: gm.id,
        kind: "npc",
        name: "Captain Harl",
        snapshot: {
          actorClass: "generated_npc",
          generatedHumanoidNpc: { sourceTemplateId: "template-guard" },
        },
      });

      await expect(service.listReusableEntitiesByGameMaster(gm.id)).resolves.toEqual([
        result.entity,
      ]);
      await expect(service.listCampaignRosterEntries(campaign.id)).resolves.toEqual([
        result.rosterEntry,
      ]);
      expect(result.entity.snapshot).toMatchObject({
        actorClass: "campaign_npc",
        campaignId: campaign.id,
      });
      expect(result.rosterEntry.sourceId).toBe(result.entity.id);
    });

    it("enforces concrete NPC roster ownership and campaign binding before writing or labeling", async () => {
      const owner = await createTestUser(prisma!, { roles: ["game_master"] });
      const foreignGm = await createTestUser(prisma!, { roles: ["game_master"] });
      const admin = await createTestUser(prisma!, { roles: ["admin"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const service = new CampaignService(repo);
      const ownerCampaign = await service.createCampaign({
        gmUserId: owner.id,
        name: "Owner Campaign",
      });
      const ownerOtherCampaign = await service.createCampaign({
        gmUserId: owner.id,
        name: "Owner Other Campaign",
      });
      const foreignCampaign = await service.createCampaign({
        gmUserId: foreignGm.id,
        name: "Foreign Campaign",
      });
      const created = await service.createCampaignNpc({
        campaignId: ownerCampaign.id,
        gmUserId: owner.id,
        kind: "npc",
        name: "Private NPC",
        snapshot: { generatedHumanoidNpc: { sourceTemplateId: "template-guard" } },
      });

      await service.removeCampaignRosterEntryBySource({
        campaignId: ownerCampaign.id,
        sourceId: created.entity.id,
        sourceType: "reusableEntity",
      });

      const foreignFailure = await service
        .addCampaignRosterEntry({
          actorIsAdmin: false,
          actorUserId: foreignGm.id,
          campaignId: foreignCampaign.id,
          category: "npc",
          sourceId: created.entity.id,
          sourceType: "reusableEntity",
        })
        .catch((error: unknown) => error);

      expect(foreignFailure).toEqual(new Error("Reusable entity not found."));
      expect(String(foreignFailure)).not.toContain(created.entity.name);
      await expect(service.listCampaignRosterEntries(foreignCampaign.id)).resolves.toEqual([]);

      await expect(
        service.addCampaignRosterEntry({
          actorIsAdmin: false,
          actorUserId: owner.id,
          campaignId: ownerOtherCampaign.id,
          category: "npc",
          sourceId: created.entity.id,
          sourceType: "reusableEntity",
        }),
      ).rejects.toThrow("Reusable entity not found.");
      await expect(service.listCampaignRosterEntries(ownerOtherCampaign.id)).resolves.toEqual([]);

      await expect(
        service.addCampaignRosterEntry({
          actorIsAdmin: true,
          actorUserId: admin.id,
          campaignId: foreignCampaign.id,
          category: "npc",
          sourceId: created.entity.id,
          sourceType: "reusableEntity",
        }),
      ).rejects.toThrow("Reusable entity not found.");
      await expect(service.listCampaignRosterEntries(foreignCampaign.id)).resolves.toEqual([]);

      const adminEntry = await service.addCampaignRosterEntry({
        actorIsAdmin: true,
        actorUserId: admin.id,
        campaignId: ownerCampaign.id,
        category: "npc",
        createdByUserId: admin.id,
        sourceId: created.entity.id,
        sourceType: "reusableEntity",
      });
      expect(adminEntry).toMatchObject({
        campaignId: ownerCampaign.id,
        labelSnapshot: created.entity.name,
        sourceId: created.entity.id,
      });

      await service.removeCampaignRosterEntryBySource({
        campaignId: ownerCampaign.id,
        sourceId: created.entity.id,
        sourceType: "reusableEntity",
      });
      const ownerEntry = await service.addCampaignRosterEntry({
        actorIsAdmin: false,
        actorUserId: owner.id,
        campaignId: ownerCampaign.id,
        category: "npc",
        createdByUserId: owner.id,
        sourceId: created.entity.id,
        sourceType: "reusableEntity",
      });
      expect(ownerEntry.labelSnapshot).toBe(created.entity.name);
      await expect(service.listCampaignRosterEntries(ownerCampaign.id)).resolves.toEqual([
        ownerEntry,
      ]);
    });

    it("rolls back the concrete NPC when its campaign roster link cannot be created", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const repo = createPrismaScenarioRepository(prisma!);
      const service = new CampaignService(repo);

      await expect(
        service.createCampaignNpc({
          campaignId: "missing-campaign",
          gmUserId: gm.id,
          kind: "npc",
          name: "Unlinked NPC",
          snapshot: { generatedHumanoidNpc: { sourceTemplateId: "template-guard" } },
        }),
      ).rejects.toThrow();

      await expect(service.listReusableEntitiesByGameMaster(gm.id)).resolves.toEqual([]);
    });
  });
}
