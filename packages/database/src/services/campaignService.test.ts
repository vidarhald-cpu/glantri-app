import { describe, expect, it } from "vitest";

import type { Campaign, ReusableEntity } from "@glantri/domain";

import { CampaignService } from "./campaignService";
import {
  createCharacterRecord,
  createScenarioRepositoryStub,
} from "./scenarioService.testHelpers";

describe("CampaignService access listing", () => {
  it("returns player-accessible campaigns from the repository", async () => {
    const { repository } = createScenarioRepositoryStub();
    const expectedCampaigns: Campaign[] = [
      {
        createdAt: "2026-04-21T00:00:00.000Z",
        description: "Accessible",
        gmUserId: "gm-1",
        id: "campaign-1",
        name: "Campaign One",
        settings: {
          allowPlayerSelfJoin: false,
          defaultVisibility: "hidden",
        },
        slug: "campaign-one",
        status: "active",
        updatedAt: "2026-04-21T00:00:00.000Z",
      },
    ];
    repository.listCampaignsByPlayerAccess = async (userId) =>
      userId === "player-1" ? expectedCampaigns : [];

    const service = new CampaignService(repository);

    await expect(service.listCampaignsByPlayerAccess("player-1")).resolves.toEqual(expectedCampaigns);
  });

  it("returns campaigns where a character is in the roster", async () => {
    const { repository } = createScenarioRepositoryStub();
    const expectedCampaigns: Campaign[] = [
      {
        createdAt: "2026-04-21T00:00:00.000Z",
        description: "Roster campaign",
        gmUserId: "gm-1",
        id: "campaign-1",
        name: "Campaign One",
        settings: {
          allowPlayerSelfJoin: false,
          defaultVisibility: "hidden",
        },
        slug: "campaign-one",
        status: "active",
        updatedAt: "2026-04-21T00:00:00.000Z",
      },
    ];
    repository.listCampaignsByCharacterRosterAccess = async (characterId) =>
      characterId === "character-1" ? expectedCampaigns : [];

    const service = new CampaignService(repository);

    await expect(service.listCampaignsByCharacterRosterAccess("character-1")).resolves.toEqual(
      expectedCampaigns,
    );
  });
});

describe("CampaignService campaign roster", () => {
  it("links characters, reusable entities, and templates without creating scenario participants", async () => {
    const { participants, repository, rosterEntries } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
    ]);
    const reusableEntities = new Map<string, ReusableEntity>([
      [
        "entity-1",
        {
          createdAt: "2026-04-21T00:00:00.000Z",
          gmUserId: "gm-1",
          id: "entity-1",
          kind: "npc",
          name: "Guard Captain",
          snapshot: {
            actorClass: "campaign_npc",
            campaignId: "campaign-1",
          },
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
      ],
      [
        "template-1",
        {
          createdAt: "2026-04-21T00:00:00.000Z",
          gmUserId: "gm-1",
          id: "template-1",
          kind: "npc",
          name: "Bandit Template",
          snapshot: {
            actorClass: "template",
          },
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
      ],
    ]);
    repository.getReusableEntityById = async (entityId) => reusableEntities.get(entityId) ?? null;
    const service = new CampaignService(
      repository,
      {
        getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
      } as never,
    );

    await expect(
      service.addCampaignRosterEntry({
        campaignId: "campaign-1",
        category: "pc",
        sourceId: "character-1",
        sourceType: "character",
      }),
    ).resolves.toMatchObject({
      category: "pc",
      labelSnapshot: "Ari",
      sourceType: "character",
    });
    await expect(
      service.addCampaignRosterEntry({
        campaignId: "campaign-1",
        category: "npc",
        sourceId: "entity-1",
        sourceType: "reusableEntity",
      }),
    ).resolves.toMatchObject({
      category: "npc",
      labelSnapshot: "Guard Captain",
      sourceType: "reusableEntity",
    });
    await expect(
      service.addCampaignRosterEntry({
        campaignId: "campaign-1",
        category: "template",
        sourceId: "template-1",
        sourceType: "template",
      }),
    ).resolves.toMatchObject({
      category: "template",
      labelSnapshot: "Bandit Template",
      sourceType: "template",
    });

    expect(rosterEntries).toHaveLength(3);
    expect(participants).toHaveLength(0);
  });

  it("dedupes duplicate roster links and can remove a roster entry", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
    ]);
    const service = new CampaignService(
      repository,
      {
        getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
      } as never,
    );

    const first = await service.addCampaignRosterEntry({
      campaignId: "campaign-1",
      category: "pc",
      sourceId: "character-1",
      sourceType: "character",
    });
    const duplicate = await service.addCampaignRosterEntry({
      campaignId: "campaign-1",
      category: "pc",
      sourceId: "character-1",
      sourceType: "character",
    });

    expect(duplicate.id).toBe(first.id);
    expect(rosterEntries).toHaveLength(1);

    await service.removeCampaignRosterEntry({
      campaignId: "campaign-1",
      rosterEntryId: first.id,
    });

    await expect(service.listCampaignRosterEntries("campaign-1")).resolves.toEqual([]);
  });

  it("keeps roster membership scoped to each campaign/source pair", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
    ]);
    const service = new CampaignService(
      repository,
      {
        getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
      } as never,
    );

    const campaignOneEntry = await service.addCampaignRosterEntry({
      campaignId: "campaign-1",
      category: "pc",
      sourceId: "character-1",
      sourceType: "character",
    });
    const campaignOneDuplicate = await service.addCampaignRosterEntry({
      campaignId: "campaign-1",
      category: "pc",
      sourceId: "character-1",
      sourceType: "character",
    });
    const campaignTwoEntry = await service.addCampaignRosterEntry({
      campaignId: "campaign-2",
      category: "pc",
      sourceId: "character-1",
      sourceType: "character",
    });

    expect(campaignOneDuplicate.id).toBe(campaignOneEntry.id);
    expect(campaignTwoEntry.id).not.toBe(campaignOneEntry.id);
    expect(rosterEntries).toHaveLength(2);
    await expect(service.listCampaignRosterEntries("campaign-1")).resolves.toEqual([campaignOneEntry]);
    await expect(service.listCampaignRosterEntries("campaign-2")).resolves.toEqual([campaignTwoEntry]);
  });

  it("removes only roster links and leaves source characters and templates available", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
    ]);
    const reusableEntities = new Map<string, ReusableEntity>([
      [
        "template-1",
        {
          createdAt: "2026-04-21T00:00:00.000Z",
          gmUserId: "gm-1",
          id: "template-1",
          kind: "npc",
          name: "Bandit Template",
          snapshot: {
            actorClass: "template",
          },
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
      ],
    ]);
    repository.getReusableEntityById = async (entityId) => reusableEntities.get(entityId) ?? null;
    const service = new CampaignService(
      repository,
      {
        getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
      } as never,
    );

    const characterEntry = await service.addCampaignRosterEntry({
      campaignId: "campaign-1",
      category: "pc",
      sourceId: "character-1",
      sourceType: "character",
    });
    const templateEntry = await service.addCampaignRosterEntry({
      campaignId: "campaign-1",
      category: "template",
      sourceId: "template-1",
      sourceType: "template",
    });

    await service.removeCampaignRosterEntry({
      campaignId: "campaign-1",
      rosterEntryId: characterEntry.id,
    });
    await service.removeCampaignRosterEntry({
      campaignId: "campaign-1",
      rosterEntryId: templateEntry.id,
    });

    expect(rosterEntries).toHaveLength(0);
    expect(characters.get("character-1")?.name).toBe("Ari");
    expect(reusableEntities.get("template-1")?.name).toBe("Bandit Template");

    await expect(
      service.addCampaignRosterEntry({
        campaignId: "campaign-1",
        category: "pc",
        sourceId: "character-1",
        sourceType: "character",
      }),
    ).resolves.toMatchObject({
      labelSnapshot: "Ari",
      sourceId: "character-1",
    });
    await expect(
      service.addCampaignRosterEntry({
        campaignId: "campaign-1",
        category: "template",
        sourceId: "template-1",
        sourceType: "template",
      }),
    ).resolves.toMatchObject({
      labelSnapshot: "Bandit Template",
      sourceId: "template-1",
    });
  });
});
