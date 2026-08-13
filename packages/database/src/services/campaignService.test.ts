import { describe, expect, it } from "vitest";

import type { Campaign, ReusableEntity } from "@glantri/domain";

import { CampaignService } from "./campaignService";
import { createCharacterRecord, createScenarioRepositoryStub } from "./scenarioService.testHelpers";

function makeCampaign(input: { gmUserId: string; id: string; name?: string }): Campaign {
  return {
    createdAt: "2026-04-21T00:00:00.000Z",
    description: "",
    gmUserId: input.gmUserId,
    id: input.id,
    name: input.name ?? input.id,
    settings: {
      allowPlayerSelfJoin: false,
      defaultVisibility: "hidden",
    },
    slug: input.id,
    status: "active",
    updatedAt: "2026-04-21T00:00:00.000Z",
  };
}

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

    await expect(service.listCampaignsByPlayerAccess("player-1")).resolves.toEqual(
      expectedCampaigns,
    );
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

  it("combines live Scenario authority with owned roster access and excludes inactive Campaigns", async () => {
    const { campaigns, repository, rosterEntries } = createScenarioRepositoryStub();
    const activeRosterCampaign = makeCampaign({
      gmUserId: "gm-1",
      id: "campaign-roster",
      name: "Roster Campaign",
    });
    const liveCampaign = makeCampaign({
      gmUserId: "gm-1",
      id: "campaign-live",
      name: "Live Campaign",
    });
    const draftCampaign = {
      ...makeCampaign({ gmUserId: "gm-1", id: "campaign-draft" }),
      status: "draft" as const,
    };
    campaigns.push(activeRosterCampaign, draftCampaign);
    rosterEntries.push({
      campaignId: activeRosterCampaign.id,
      category: "pc",
      createdAt: "2026-04-21T00:00:00.000Z",
      id: "roster-1",
      sourceId: "character-1",
      sourceType: "character",
      updatedAt: "2026-04-21T00:00:00.000Z",
    });
    repository.listCampaignsByPlayerAccess = async () => [liveCampaign, draftCampaign];
    const characterService = {
      listCharacters: async () => [
        createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "player-1" }),
      ],
    } as never;
    const service = new CampaignService(repository, characterService);

    await expect(service.listCampaignsByUserAccess("player-1")).resolves.toEqual([
      liveCampaign,
      activeRosterCampaign,
    ]);
  });

  it("returns only the player's Characters that are on the selected Campaign roster", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    rosterEntries.push({
      campaignId: "campaign-1",
      category: "pc",
      createdAt: "2026-04-21T00:00:00.000Z",
      id: "roster-1",
      sourceId: "character-1",
      sourceType: "character",
      updatedAt: "2026-04-21T00:00:00.000Z",
    });
    const characterService = {
      listCharacters: async () => [
        createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "player-1" }),
        createCharacterRecord({ id: "character-2", name: "Bela", ownerId: "player-1" }),
      ],
    } as never;
    const service = new CampaignService(repository, characterService);

    await expect(
      service.listPlayerCampaignCharacters({ campaignId: "campaign-1", userId: "player-1" }),
    ).resolves.toEqual([{ id: "character-1", name: "Ari" }]);
  });
});

describe("CampaignService campaign roster", () => {
  it("persists one concrete campaign NPC and its roster link as the same identity", async () => {
    const { participants, repository, reusableEntities, rosterEntries } =
      createScenarioRepositoryStub();
    const service = new CampaignService(repository);

    const result = await service.createCampaignNpc({
      campaignId: "campaign-1",
      description: "A reusable watch officer.",
      gmUserId: "gm-1",
      kind: "npc",
      name: "  Captain Harl  ",
      snapshot: {
        actorClass: "generated_npc",
        campaignId: "wrong-campaign",
        generatedHumanoidNpc: { sourceTemplateId: "template-guard" },
      },
    });

    expect(result.entity).toMatchObject({
      gmUserId: "gm-1",
      kind: "npc",
      name: "Captain Harl",
      snapshot: {
        actorClass: "campaign_npc",
        campaignId: "campaign-1",
        generatedHumanoidNpc: { sourceTemplateId: "template-guard" },
      },
    });
    expect(result.rosterEntry).toMatchObject({
      campaignId: "campaign-1",
      category: "npc",
      labelSnapshot: "Captain Harl",
      sourceId: result.entity.id,
      sourceType: "reusableEntity",
    });
    expect(reusableEntities).toEqual([result.entity]);
    expect(rosterEntries).toEqual([result.rosterEntry]);
    expect(participants).toHaveLength(0);
  });

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
    repository.getCampaignById = async (campaignId) =>
      campaignId === "campaign-1" ? makeCampaign({ gmUserId: "gm-1", id: "campaign-1" }) : null;
    const service = new CampaignService(repository, {
      getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
    } as never);

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
        actorIsAdmin: false,
        actorUserId: "gm-1",
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

  it("denies a foreign GM without disclosing or persisting a reusable NPC", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const campaigns = new Map([
      ["campaign-a", makeCampaign({ gmUserId: "gm-owner", id: "campaign-a" })],
      ["campaign-b", makeCampaign({ gmUserId: "gm-foreign", id: "campaign-b" })],
    ]);
    const privateNpc: ReusableEntity = {
      createdAt: "2026-04-21T00:00:00.000Z",
      gmUserId: "gm-owner",
      id: "private-npc",
      kind: "npc",
      name: "Private NPC",
      snapshot: { actorClass: "campaign_npc", campaignId: "campaign-a" },
      updatedAt: "2026-04-21T00:00:00.000Z",
    };
    repository.getCampaignById = async (campaignId) => campaigns.get(campaignId) ?? null;
    repository.getReusableEntityById = async (entityId) =>
      entityId === privateNpc.id ? privateNpc : null;
    const service = new CampaignService(repository);

    const failure = await service
      .addCampaignRosterEntry({
        actorIsAdmin: false,
        actorUserId: "gm-foreign",
        campaignId: "campaign-b",
        category: "npc",
        sourceId: privateNpc.id,
        sourceType: "reusableEntity",
      })
      .catch((error: unknown) => error);

    expect(failure).toEqual(new Error("Reusable entity not found."));
    expect(String(failure)).not.toContain(privateNpc.name);
    expect(rosterEntries).toEqual([]);
  });

  it("allows the owning GM and an admin to link a campaign-bound reusable NPC", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const campaign = makeCampaign({ gmUserId: "gm-owner", id: "campaign-a" });
    const privateNpc: ReusableEntity = {
      createdAt: "2026-04-21T00:00:00.000Z",
      gmUserId: "gm-owner",
      id: "private-npc",
      kind: "npc",
      name: "Private NPC",
      snapshot: { actorClass: "campaign_npc", campaignId: campaign.id },
      updatedAt: "2026-04-21T00:00:00.000Z",
    };
    repository.getCampaignById = async (campaignId) =>
      campaignId === campaign.id ? campaign : null;
    repository.getReusableEntityById = async (entityId) =>
      entityId === privateNpc.id ? privateNpc : null;
    const service = new CampaignService(repository);

    const ownerEntry = await service.addCampaignRosterEntry({
      actorIsAdmin: false,
      actorUserId: "gm-owner",
      campaignId: campaign.id,
      category: "npc",
      sourceId: privateNpc.id,
      sourceType: "reusableEntity",
    });
    const adminEntry = await service.addCampaignRosterEntry({
      actorIsAdmin: true,
      actorUserId: "admin-1",
      campaignId: campaign.id,
      category: "npc",
      sourceId: privateNpc.id,
      sourceType: "reusableEntity",
    });

    expect(ownerEntry.labelSnapshot).toBe(privateNpc.name);
    expect(adminEntry.id).toBe(ownerEntry.id);
    expect(rosterEntries).toEqual([ownerEntry]);
  });

  it("denies a campaign NPC in another campaign even when the same GM owns both", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const campaigns = new Map([
      ["campaign-a", makeCampaign({ gmUserId: "gm-owner", id: "campaign-a" })],
      ["campaign-b", makeCampaign({ gmUserId: "gm-owner", id: "campaign-b" })],
    ]);
    const privateNpc: ReusableEntity = {
      createdAt: "2026-04-21T00:00:00.000Z",
      gmUserId: "gm-owner",
      id: "private-npc",
      kind: "npc",
      name: "Private NPC",
      snapshot: { actorClass: "campaign_npc", campaignId: "campaign-a" },
      updatedAt: "2026-04-21T00:00:00.000Z",
    };
    repository.getCampaignById = async (campaignId) => campaigns.get(campaignId) ?? null;
    repository.getReusableEntityById = async (entityId) =>
      entityId === privateNpc.id ? privateNpc : null;
    const service = new CampaignService(repository);

    await expect(
      service.addCampaignRosterEntry({
        actorIsAdmin: false,
        actorUserId: "gm-owner",
        campaignId: "campaign-b",
        category: "npc",
        sourceId: privateNpc.id,
        sourceType: "reusableEntity",
      }),
    ).rejects.toThrow("Reusable entity not found.");
    expect(rosterEntries).toEqual([]);
  });

  it("dedupes duplicate roster links and can remove a roster entry", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
    ]);
    const service = new CampaignService(repository, {
      getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
    } as never);

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

  it("treats already-removed roster entry ids as an idempotent no-op", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const service = new CampaignService(repository);

    await service.removeCampaignRosterEntry({
      campaignId: "campaign-1",
      rosterEntryId: "missing-roster-entry",
    });

    expect(rosterEntries).toHaveLength(0);
  });

  it("keeps roster membership scoped to each campaign/source pair", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
    ]);
    const service = new CampaignService(repository, {
      getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
    } as never);

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
    await expect(service.listCampaignRosterEntries("campaign-1")).resolves.toEqual([
      campaignOneEntry,
    ]);
    await expect(service.listCampaignRosterEntries("campaign-2")).resolves.toEqual([
      campaignTwoEntry,
    ]);
  });

  it("removes roster membership by campaign source identity", async () => {
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
    const service = new CampaignService(repository, {
      getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
    } as never);

    await service.addCampaignRosterEntry({
      campaignId: "campaign-1",
      category: "pc",
      sourceId: "character-1",
      sourceType: "character",
    });
    await service.addCampaignRosterEntry({
      campaignId: "campaign-1",
      category: "template",
      sourceId: "template-1",
      sourceType: "template",
    });

    await expect(
      service.removeCampaignRosterEntryBySource({
        campaignId: "campaign-1",
        sourceId: "character-1",
        sourceType: "character",
      }),
    ).resolves.toEqual({ removed: true });

    expect(rosterEntries).toHaveLength(1);
    expect(rosterEntries[0]?.sourceType).toBe("template");

    await expect(
      service.removeCampaignRosterEntryBySource({
        campaignId: "campaign-1",
        sourceId: "template-1",
        sourceType: "template",
      }),
    ).resolves.toEqual({ removed: true });
    await expect(
      service.removeCampaignRosterEntryBySource({
        campaignId: "campaign-1",
        sourceId: "template-1",
        sourceType: "template",
      }),
    ).resolves.toEqual({ removed: false });

    expect(rosterEntries).toHaveLength(0);
    expect(characters.get("character-1")?.name).toBe("Ari");
    expect(reusableEntities.get("template-1")?.name).toBe("Bandit Template");
  });

  it("returns an idempotent no-op when removing a missing roster source", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const service = new CampaignService(repository);

    await expect(
      service.removeCampaignRosterEntryBySource({
        campaignId: "campaign-1",
        sourceId: "missing-character",
        sourceType: "character",
      }),
    ).resolves.toEqual({ removed: false });

    expect(rosterEntries).toHaveLength(0);
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
    const service = new CampaignService(repository, {
      getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
    } as never);

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
