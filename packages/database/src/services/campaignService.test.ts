import { describe, expect, it } from "vitest";

import type { Campaign, ReusableEntity } from "@glantri/domain";

import { CampaignCharacterRosterCandidateNotFoundError, CampaignService } from "./campaignService";
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

describe("CampaignService activation", () => {
  it("lets a managing GM activate a draft Campaign", async () => {
    const { campaigns, repository } = createScenarioRepositoryStub();
    const draftCampaign = {
      ...makeCampaign({
        gmUserId: "gm-1",
        id: "campaign-draft",
        name: "Draft Campaign",
      }),
      status: "draft" as const,
    };
    campaigns.push(draftCampaign);
    repository.getCampaignById = async (campaignId) =>
      campaignId === draftCampaign.id ? draftCampaign : null;
    const service = new CampaignService(repository);

    const next = await service.activateCampaign({
      actorUserId: "gm-1",
      campaignId: draftCampaign.id,
    });

    expect(next.status).toBe("active");
  });

  it("does not let an unrelated admin activate another GM's draft Campaign", async () => {
    const { campaigns, repository } = createScenarioRepositoryStub();
    const draftCampaign = {
      ...makeCampaign({
        gmUserId: "gm-1",
        id: "campaign-draft",
        name: "Draft Campaign",
      }),
      status: "draft" as const,
    };
    campaigns.push(draftCampaign);
    repository.getCampaignById = async (campaignId) =>
      campaignId === draftCampaign.id ? draftCampaign : null;
    const service = new CampaignService(repository);

    await expect(
      service.activateCampaign({
        actorIsAdmin: true,
        actorUserId: "admin-1",
        campaignId: draftCampaign.id,
      }),
    ).rejects.toThrow("Campaign not found.");
    expect(draftCampaign.status).toBe("draft");
  });

  it("prevents non-managing users from changing campaign status", async () => {
    const { campaigns, repository } = createScenarioRepositoryStub();
    const draftCampaign = {
      ...makeCampaign({
        gmUserId: "gm-1",
        id: "campaign-draft",
      }),
      status: "draft" as const,
    };
    campaigns.push(draftCampaign);
    repository.getCampaignById = async (campaignId) =>
      campaignId === draftCampaign.id ? draftCampaign : null;
    const service = new CampaignService(repository);

    await expect(
      service.activateCampaign({
        actorIsAdmin: false,
        actorUserId: "not-gm",
        campaignId: draftCampaign.id,
      }),
    ).rejects.toThrow("Campaign not found.");
  });

  it.each(["active", "archived"] as const)(
    "blocks activation when campaign is %s",
    async (status) => {
      const { campaigns, repository } = createScenarioRepositoryStub();
      const restrictedCampaign = {
        ...makeCampaign({
          gmUserId: "gm-1",
          id: `campaign-${status}`,
        }),
        status,
      };
      campaigns.push(restrictedCampaign);
      repository.getCampaignById = async (campaignId) =>
        campaignId === restrictedCampaign.id ? restrictedCampaign : null;
      const service = new CampaignService(repository);

      await expect(
        service.activateCampaign({
          actorIsAdmin: false,
          actorUserId: "gm-1",
          campaignId: restrictedCampaign.id,
        }),
      ).rejects.toThrow("Campaign can only be activated from draft status.");
    },
  );

  it("blocks repeated activation after campaign becomes active", async () => {
    const { campaigns, repository } = createScenarioRepositoryStub();
    const draftCampaign = {
      ...makeCampaign({
        gmUserId: "gm-1",
        id: "campaign-draft",
      }),
      status: "draft" as const,
    };
    campaigns.push(draftCampaign);
    let seen = 0;
    repository.getCampaignById = async (campaignId) => {
      if (campaignId !== draftCampaign.id) {
        return null;
      }
      seen += 1;
      return seen === 1
        ? draftCampaign
        : {
            ...draftCampaign,
            status: "active" as const,
          };
    };
    const service = new CampaignService(repository);

    await service.activateCampaign({
      actorUserId: "gm-1",
      campaignId: draftCampaign.id,
    });

    await expect(
      service.activateCampaign({
        actorIsAdmin: false,
        actorUserId: "gm-1",
        campaignId: draftCampaign.id,
      }),
    ).rejects.toThrow("Campaign can only be activated from draft status.");
  });

  it("rejects stale interleaving when a draft Campaign is already activated elsewhere", async () => {
    const { campaigns, repository } = createScenarioRepositoryStub();
    const draftCampaign = {
      ...makeCampaign({
        gmUserId: "gm-1",
        id: "campaign-draft",
      }),
      status: "draft" as const,
    };
    const staleRepository = {
      ...repository,
      getCampaignById: async () => draftCampaign,
      activateCampaignFromDraft: async () => null,
    };
    campaigns.push(draftCampaign);
    const service = new CampaignService(staleRepository);

    await expect(
      service.activateCampaign({
        actorIsAdmin: false,
        actorUserId: "gm-1",
        campaignId: "campaign-draft",
      }),
    ).rejects.toThrow("Campaign activation is stale and must be retried.");
  });
});

describe("CampaignService campaign roster", () => {
  it("projects all finalized server Characters with only safe Campaign candidate fields", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const ownCharacter = {
      ...createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "gm-1" }),
      owner: {
        displayName: "Campaign GM",
        email: "gm-private@example.test",
        id: "gm-1",
      },
    };
    const otherCharacter = {
      ...createCharacterRecord({ id: "character-2", name: "Bryn", ownerId: "player-2" }),
      owner: {
        displayName: "Player Two",
        email: "player-private@example.test",
        id: "player-2",
      },
    };
    rosterEntries.push({
      campaignId: "campaign-1",
      category: "pc",
      createdAt: "2026-04-21T00:00:00.000Z",
      id: "roster-1",
      sourceId: otherCharacter.id,
      sourceType: "character",
      updatedAt: "2026-04-21T00:00:00.000Z",
    });
    const service = new CampaignService(repository, {
      listCharacters: async () => [ownCharacter, otherCharacter],
    } as never);

    const candidates = await service.listCampaignCharacterRosterCandidates({
      actorUserId: "gm-1",
      campaignId: "campaign-1",
    });

    expect(candidates).toEqual([
      {
        alreadyRostered: false,
        currentElsewhere: false,
        id: "character-1",
        membershipState: "none",
        name: "Ari",
        ownerLabel: "You",
      },
      {
        alreadyRostered: true,
        currentElsewhere: false,
        id: "character-2",
        membershipState: "current",
        name: "Bryn",
        ownerLabel: "Player Two",
      },
    ]);
    expect(Object.keys(candidates[0] ?? {}).sort()).toEqual([
      "alreadyRostered",
      "currentElsewhere",
      "id",
      "membershipState",
      "name",
      "ownerLabel",
    ]);
    expect(JSON.stringify(candidates)).not.toContain("example.test");
    expect(JSON.stringify(candidates)).not.toContain("build");
    expect(JSON.stringify(candidates)).not.toContain("ownerId");
  });

  it("rejects nonfinalized, forged, or mistyped Character roster candidates before writing", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const finalized = createCharacterRecord({
      id: "character-finalized",
      name: "Ari",
      ownerId: "player-1",
    });
    const service = new CampaignService(repository, {
      getCharacterById: async (characterId: string) =>
        characterId === finalized.id ? finalized : null,
    } as never);

    for (const input of [
      { category: "pc" as const, sourceId: "local-draft-or-forged" },
      { category: "npc" as const, sourceId: finalized.id },
    ]) {
      await expect(
        service.addCampaignRosterEntry({
          campaignId: "campaign-1",
          category: input.category,
          sourceId: input.sourceId,
          sourceType: "character",
        }),
      ).rejects.toBeInstanceOf(CampaignCharacterRosterCandidateNotFoundError);
    }

    expect(rosterEntries).toEqual([]);
  });

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

  it("allows the owning GM but not an unrelated admin to link a campaign-bound reusable NPC", async () => {
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
    await expect(
      service.addCampaignRosterEntry({
        actorIsAdmin: true,
        actorUserId: "admin-1",
        campaignId: campaign.id,
        category: "npc",
        sourceId: privateNpc.id,
        sourceType: "reusableEntity",
      }),
    ).rejects.toThrow("Reusable entity not found.");

    expect(ownerEntry.labelSnapshot).toBe(privateNpc.name);
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

  it("keeps one current membership while preserving a former Campaign relationship", async () => {
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
    await service.removeCampaignRosterEntry({
      campaignId: "campaign-1",
      rosterEntryId: campaignOneEntry.id,
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
    expect(rosterEntries[0]?.membershipState).toBe("former");
    await expect(service.listCampaignRosterEntries("campaign-1")).resolves.toEqual([]);
    await expect(service.listCampaignRosterHistoryEntries("campaign-1")).resolves.toEqual([
      expect.objectContaining({ id: campaignOneEntry.id, membershipState: "former" }),
    ]);
    await expect(service.listCampaignRosterEntries("campaign-2")).resolves.toEqual([
      campaignTwoEntry,
    ]);
    await expect(
      service.addCampaignRosterEntry({
        campaignId: "campaign-1",
        category: "pc",
        sourceId: "character-1",
        sourceType: "character",
      }),
    ).rejects.toMatchObject({ activeCampaignId: "campaign-2" });
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

    expect(rosterEntries).toHaveLength(2);
    expect(rosterEntries.find((entry) => entry.sourceType === "character")?.membershipState).toBe(
      "former",
    );
    await expect(service.listCampaignRosterEntries("campaign-1")).resolves.toEqual([
      expect.objectContaining({ sourceType: "template" }),
    ]);

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

    expect(rosterEntries).toHaveLength(1);
    expect(rosterEntries[0]).toMatchObject({
      membershipState: "former",
      sourceId: "character-1",
      sourceType: "character",
    });
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

  it("preserves former PC history while removing NPC/template prominence links", async () => {
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

    expect(rosterEntries).toHaveLength(1);
    expect(rosterEntries[0]).toMatchObject({
      membershipState: "former",
      sourceId: "character-1",
      sourceType: "character",
    });
    await expect(service.listCampaignRosterEntries("campaign-1")).resolves.toEqual([]);
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
