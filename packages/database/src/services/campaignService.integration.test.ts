import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaCharacterRepository } from "../repositories/characterRepository";
import { createPrismaScenarioRepository } from "../repositories/scenarioRepository";
import { createTestCharacter, createTestUser } from "../testing/factories";
import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import {
  CampaignCharacterAlreadyRosteredError,
  CampaignCharacterRosterCandidateNotFoundError,
  CampaignService,
} from "./campaignService";
import { CharacterService } from "./characterService";

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

    it("discovers and idempotently rosters another user's finalized Character without changing ownership", async () => {
      const gm = await createTestUser(prisma!, {
        displayName: "Campaign GM",
        roles: ["game_master"],
      });
      const player = await createTestUser(prisma!, { displayName: "Player One" });
      const ownCharacter = await createTestCharacter(prisma!, gm.id, { name: "Ari" });
      const otherCharacter = await createTestCharacter(prisma!, player.id, { name: "Bryn" });
      const repo = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const service = new CampaignService(repo, characterService);
      const campaign = await service.createCampaign({
        gmUserId: gm.id,
        name: "Border Trouble",
      });

      await expect(
        service.listCampaignCharacterRosterCandidates({
          actorUserId: gm.id,
          campaignId: campaign.id,
        }),
      ).resolves.toEqual([
        {
          alreadyRostered: false,
          id: ownCharacter.id,
          name: ownCharacter.name,
          ownerLabel: "You",
        },
        {
          alreadyRostered: false,
          id: otherCharacter.id,
          name: otherCharacter.name,
          ownerLabel: "Player One",
        },
      ]);

      const first = await service.addCampaignRosterEntry({
        actorUserId: gm.id,
        campaignId: campaign.id,
        category: "pc",
        createdByUserId: gm.id,
        sourceId: otherCharacter.id,
        sourceType: "character",
      });
      const duplicate = await service.addCampaignRosterEntry({
        actorUserId: gm.id,
        campaignId: campaign.id,
        category: "pc",
        createdByUserId: gm.id,
        sourceId: otherCharacter.id,
        sourceType: "character",
      });

      expect(duplicate.id).toBe(first.id);
      await expect(
        service.listCampaignCharacterRosterCandidates({
          actorUserId: gm.id,
          campaignId: campaign.id,
        }),
      ).resolves.toContainEqual({
        alreadyRostered: true,
        id: otherCharacter.id,
        name: otherCharacter.name,
        ownerLabel: "Player One",
      });
      await expect(
        prisma!.character.findUnique({ where: { id: otherCharacter.id } }),
      ).resolves.toMatchObject({ ownerId: player.id });
      await expect(prisma!.campaignRosterEntry.count()).resolves.toBe(1);
      await expect(prisma!.scenarioParticipant.count()).resolves.toBe(0);

      await expect(
        service.addCampaignRosterEntry({
          actorUserId: gm.id,
          campaignId: campaign.id,
          category: "pc",
          createdByUserId: gm.id,
          sourceId: "local-draft-or-forged",
          sourceType: "character",
        }),
      ).rejects.toBeInstanceOf(CampaignCharacterRosterCandidateNotFoundError);
      await expect(prisma!.campaignRosterEntry.count()).resolves.toBe(1);
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

    it("returns one canonical roster entry for simultaneous equivalent Character adds", async () => {
      const gm = await createTestUser(prisma!, { roles: ["game_master"] });
      const player = await createTestUser(prisma!, { displayName: "Player One" });
      const character = await createTestCharacter(prisma!, player.id, { name: "Concurrent Hero" });
      const repository = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const service = new CampaignService(repository, characterService);
      const campaign = await service.createCampaign({
        gmUserId: gm.id,
        name: "Concurrent Roster",
      });
      const request = {
        actorUserId: gm.id,
        campaignId: campaign.id,
        category: "pc" as const,
        createdByUserId: gm.id,
        sourceId: character.id,
        sourceType: "character" as const,
      };

      const [first, second] = await Promise.all([
        service.addCampaignRosterEntry(request),
        service.addCampaignRosterEntry(request),
      ]);

      expect(second).toEqual(first);
      await expect(
        prisma!.campaignRosterEntry.findMany({
          where: {
            campaignId: campaign.id,
            sourceId: character.id,
            sourceType: "character",
          },
        }),
      ).resolves.toHaveLength(1);
    });

    it("atomically enforces one active Campaign and permits leave or GM removal before rejoining", async () => {
      const gmA = await createTestUser(prisma!, { roles: ["game_master"] });
      const gmB = await createTestUser(prisma!, { roles: ["game_master"] });
      const owner = await createTestUser(prisma!);
      const character = await createTestCharacter(prisma!, owner.id, { name: "One Campaign Hero" });
      const repository = createPrismaScenarioRepository(prisma!);
      const characterService = new CharacterService(createPrismaCharacterRepository(prisma!));
      const service = new CampaignService(repository, characterService);
      const campaignA = await service.createCampaign({ gmUserId: gmA.id, name: "Campaign A" });
      const campaignB = await service.createCampaign({ gmUserId: gmB.id, name: "Campaign B" });
      const add = (campaignId: string, gmUserId: string) =>
        service.addCampaignRosterEntry({
          actorUserId: gmUserId,
          campaignId,
          category: "pc",
          sourceId: character.id,
          sourceType: "character",
        });

      const first = await add(campaignA.id, gmA.id);
      await expect(add(campaignB.id, gmB.id)).rejects.toBeInstanceOf(
        CampaignCharacterAlreadyRosteredError,
      );
      await expect(
        prisma!.campaignRosterEntry.count({
          where: { sourceId: character.id, sourceType: "character" },
        }),
      ).resolves.toBe(1);

      await service.removeCampaignRosterEntry({
        campaignId: campaignA.id,
        rosterEntryId: first.id,
      });
      const second = await add(campaignB.id, gmB.id);
      expect(second.campaignId).toBe(campaignB.id);

      await service.leaveCampaign({
        campaignId: campaignB.id,
        characterId: character.id,
        ownerUserId: owner.id,
      });
      const raced = await Promise.allSettled([
        add(campaignA.id, gmA.id),
        add(campaignB.id, gmB.id),
      ]);
      expect(raced.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(raced.filter((result) => result.status === "rejected")).toHaveLength(1);
      await expect(
        prisma!.campaignRosterEntry.count({
          where: { sourceId: character.id, sourceType: "character" },
        }),
      ).resolves.toBe(1);
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
