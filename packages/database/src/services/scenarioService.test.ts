import { describe, expect, it } from "vitest";

import type { ReusableEntity } from "@glantri/domain";

import { ScenarioService } from "./scenarioService";
import { createCharacterRecord, createScenarioRepositoryStub } from "./scenarioService.testHelpers";

describe("ScenarioService controller assignment", () => {
  it("explicitly refreshes committed equipment while preserving live participant state", async () => {
    const { repository } = createScenarioRepositoryStub();
    const character = createCharacterRecord({ id: "character-1", name: "Scyrian" });
    let equipmentState: Record<string, unknown> = {
      activeLoadoutByCharacterId: { "character-1": { activeAmmoItemIds: [] } },
      itemsById: {},
      locationsById: {},
      templatesById: {},
    };
    const service = new ScenarioService(
      repository,
      { getCharacterById: async () => character } as never,
      { getCharacterEquipmentState: async () => equipmentState } as never,
    );
    const original = await service.addCharacterParticipant({
      characterId: character.id,
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });
    await repository.updateScenarioParticipantState(original.id, {
      ...original.state,
      health: { ...original.state.health, currentHp: 4 },
    });
    equipmentState = {
      activeLoadoutByCharacterId: {
        "character-1": {
          activeAmmoItemIds: [],
          activeMissileWeaponItemId: "scenario-bow-1",
          activePrimaryWeaponItemId: "scenario-sword-1",
          activeSecondaryWeaponItemId: "scenario-dagger-1",
          characterId: "character-1",
          id: "loadout-1",
          isActive: true,
          name: "Combat",
          quickAccessItemIds: [],
          readyShieldItemId: "scenario-shield-1",
          wornArmorItemId: "scenario-armor-1",
        },
      },
      itemsById: {
        "scenario-sword-1": {
          characterId: "character-1",
          id: "scenario-sword-1",
          isEquipped: true,
          templateId: "sword-template",
        },
        "scenario-dagger-1": {
          characterId: "character-1",
          id: "scenario-dagger-1",
          isEquipped: true,
          templateId: "dagger-template",
        },
        "scenario-bow-1": {
          characterId: "character-1",
          id: "scenario-bow-1",
          isEquipped: true,
          templateId: "bow-template",
        },
        "scenario-shield-1": {
          characterId: "character-1",
          id: "scenario-shield-1",
          isEquipped: true,
          templateId: "shield-template",
        },
        "scenario-armor-1": {
          characterId: "character-1",
          id: "scenario-armor-1",
          isEquipped: true,
          templateId: "armor-template",
        },
      },
      locationsById: {},
      templatesById: {
        "armor-template": { category: "armor", id: "armor-template" },
        "bow-template": { category: "weapon", id: "bow-template" },
        "dagger-template": { category: "weapon", id: "dagger-template" },
        "shield-template": { category: "shield", id: "shield-template" },
        "sword-template": { category: "weapon", id: "sword-template" },
      },
    };

    const refreshed = await service.refreshCharacterParticipantEquipmentSnapshot({
      participantId: original.id,
      scenarioId: "scenario-1",
    });

    expect(refreshed.snapshot.equipmentState).toEqual(equipmentState);
    expect(refreshed.state.equipment.readyItemIds).toEqual([
      "scenario-armor-1",
      "scenario-shield-1",
      "scenario-sword-1",
      "scenario-dagger-1",
      "scenario-bow-1",
    ]);
    expect(refreshed.state.health.currentHp).toBe(4);
  });

  it("prevents one player from being assigned to two active player characters in the same scenario", async () => {
    const { repository } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
      [
        "character-2",
        createCharacterRecord({ id: "character-2", name: "Bryn", ownerId: "user-2" }),
      ],
    ]);
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
      } as never,
      {
        getCharacterEquipmentState: async () => ({
          activeLoadoutByCharacterId: {},
          itemsById: {},
          locationsById: {},
          templatesById: {},
        }),
      } as never,
    );

    await service.addCharacterParticipant({
      characterId: "character-1",
      controlledByUserId: "user-1",
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });

    await expect(
      service.addCharacterParticipant({
        characterId: "character-2",
        controlledByUserId: "user-1",
        joinSource: "gm_added",
        scenarioId: "scenario-1",
      }),
    ).rejects.toThrow("already the active controlled character");
  });

  it("uses Character ownership only while Scenario control is unassigned", async () => {
    const { repository } = createScenarioRepositoryStub();
    const character = createCharacterRecord({
      id: "character-1",
      name: "Ari",
      ownerId: "owner-1",
    });
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async () => character,
      } as never,
      {
        getCharacterEquipmentState: async () => ({
          activeLoadoutByCharacterId: {},
          itemsById: {},
          locationsById: {},
          templatesById: {},
        }),
      } as never,
    );

    const participant = await service.addCharacterParticipant({
      characterId: character.id,
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });

    await expect(
      service.userHasPlayerScenarioAccess({ scenarioId: "scenario-1", userId: "owner-1" }),
    ).resolves.toBe(true);

    await repository.updateScenarioParticipantMetadata({
      controlledByUserId: "controller-1",
      participantId: participant.id,
    });

    await expect(
      service.userHasPlayerScenarioAccess({ scenarioId: "scenario-1", userId: "owner-1" }),
    ).resolves.toBe(false);
    await expect(
      service.userHasPlayerScenarioAccess({ scenarioId: "scenario-1", userId: "controller-1" }),
    ).resolves.toBe(true);
  });

  it("allows the same controller to manage multiple non-player participants", async () => {
    const { participants, repository } = createScenarioRepositoryStub();
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async () => null,
      } as never,
      {
        getCharacterEquipmentState: async () => ({
          activeLoadoutByCharacterId: {},
          itemsById: {},
          locationsById: {},
          templatesById: {},
        }),
      } as never,
    );

    const baseEntity: ReusableEntity = {
      createdAt: "2026-04-21T00:00:00.000Z",
      gmUserId: "gm-1",
      id: "entity-1",
      kind: "npc",
      name: "Guard",
      updatedAt: "2026-04-21T00:00:00.000Z",
    };
    let entityCounter = 0;
    repository.getReusableEntityById = async () => ({
      ...baseEntity,
      id: `entity-${++entityCounter}`,
    });

    await service.addEntityParticipant({
      controlledByUserId: "gm-1",
      entityId: "entity-1",
      role: "npc",
      scenarioId: "scenario-1",
    });

    await expect(
      service.addEntityParticipant({
        controlledByUserId: "gm-1",
        entityId: "entity-2",
        role: "npc",
        scenarioId: "scenario-1",
      }),
    ).resolves.toMatchObject({
      controlledByUserId: "gm-1",
      role: "npc",
    });

    expect(participants).toHaveLength(2);
  });

  it("preserves temporary actor build, sheet, and equipment snapshots from entity input", async () => {
    const { repository } = createScenarioRepositoryStub();
    const sourceBuild = createCharacterRecord({
      id: "template-build-1",
      name: "City Guard",
    }).build;
    const sheetSummary = {
      draftView: {
        skills: [{ skillId: "perception", totalSkill: 18 }],
      },
    };
    const equipmentState = {
      activeLoadoutByCharacterId: {
        "template-build-1": {
          activePrimaryWeaponItemId: "spear-1",
          readyShieldItemId: "shield-1",
        },
      },
      itemsById: {
        "rope-1": { characterId: "template-build-1" },
        "shield-1": { characterId: "template-build-1" },
        "spear-1": { characterId: "template-build-1", isEquipped: true },
      },
    };
    const service = new ScenarioService(repository);

    const participant = await service.addEntityParticipant({
      entityInput: {
        gmUserId: "gm-1",
        kind: "npc",
        name: "City Guard",
        snapshot: {
          actorClass: "template",
          build: sourceBuild,
          equipmentState,
          sheetSummary,
        },
      },
      isTemporary: true,
      role: "npc",
      scenarioId: "scenario-1",
    });

    expect(participant.snapshot).toMatchObject({
      build: sourceBuild,
      displayName: "City Guard",
      equipmentState,
      sheetSummary,
    });
    expect(participant.state.equipment).toMatchObject({
      carriedItemIds: ["rope-1", "shield-1", "spear-1"],
      equippedItemIds: ["spear-1"],
      readyItemIds: ["shield-1", "spear-1"],
    });
  });

  it("reuses one concrete entity identity while creating versioned snapshots in later scenarios", async () => {
    const { participants, repository } = createScenarioRepositoryStub();
    const entity = {
      createdAt: "2026-08-13T08:00:00.000Z",
      gmUserId: "gm-1",
      id: "entity-generated-npc-1",
      kind: "npc" as const,
      name: "Captain Harl",
      snapshot: {
        actorClass: "campaign_npc",
        campaignId: "campaign-1",
        equipmentState: {
          activeLoadoutByCharacterId: {},
          itemsById: {},
          locationsById: {},
          templatesById: {},
        },
        sheetSummary: { draftView: { skills: [] } },
      },
      updatedAt: "2026-08-13T08:05:00.000Z",
    };
    repository.getReusableEntityById = async (entityId) => (entityId === entity.id ? entity : null);
    const service = new ScenarioService(repository);

    const first = await service.addEntityParticipant({
      controlledByUserId: "gm-1",
      entityId: entity.id,
      expectedGmUserId: "gm-1",
      role: "npc",
      scenarioId: "scenario-1",
    });
    const second = await service.addEntityParticipant({
      controlledByUserId: "gm-1",
      entityId: entity.id,
      expectedGmUserId: "gm-1",
      role: "npc",
      scenarioId: "scenario-2",
    });

    expect(first.id).not.toBe(second.id);
    expect(first.entityId).toBe(entity.id);
    expect(second.entityId).toBe(entity.id);
    expect(first.snapshot).not.toBe(second.snapshot);
    expect(first.snapshot.sourceUpdatedAt).toBe(entity.updatedAt);
    expect(second.snapshot.sourceUpdatedAt).toBe(entity.updatedAt);
    expect(first.state.snapshotVersion).toBe(1);
    expect(second.state.snapshotVersion).toBe(1);
    expect(participants).toHaveLength(2);

    await expect(
      service.addEntityParticipant({
        entityId: entity.id,
        expectedGmUserId: "other-gm",
        role: "npc",
        scenarioId: "scenario-3",
      }),
    ).rejects.toThrow("Reusable entity not found.");
  });

  it("enforces the active-control rule when participant metadata is reassigned", async () => {
    const { repository } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
      ["character-2", createCharacterRecord({ id: "character-2", name: "Bryn", ownerId: null })],
    ]);
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
      } as never,
      {
        getCharacterEquipmentState: async () => ({
          activeLoadoutByCharacterId: {},
          itemsById: {},
          locationsById: {},
          templatesById: {},
        }),
      } as never,
    );

    const first = await service.addCharacterParticipant({
      characterId: "character-1",
      controlledByUserId: "user-1",
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });
    const second = await service.addCharacterParticipant({
      characterId: "character-2",
      controlledByUserId: null,
      joinSource: "gm_added",
      scenarioId: "scenario-1",
    });

    await expect(
      service.updateScenarioParticipantMetadata({
        controlledByUserId: "user-1",
        participantId: second.id,
        scenarioId: "scenario-1",
      }),
    ).rejects.toThrow("already the active controlled character");

    await expect(
      service.updateScenarioParticipantMetadata({
        controlledByUserId: "user-1",
        displayOrder: 10,
        factionId: "red",
        isActive: false,
        participantId: second.id,
        roleTag: "archer",
        scenarioId: "scenario-1",
        tacticalGroupId: "squad-a",
      }),
    ).resolves.toMatchObject({
      controlledByUserId: "user-1",
      displayOrder: 10,
      factionId: "red",
      id: second.id,
      isActive: false,
      roleTag: "archer",
      tacticalGroupId: "squad-a",
    });

    expect(first.controlledByUserId).toBe("user-1");
  });
});

describe("ScenarioService scenario relationships", () => {
  it("lists player-accessible scenarios by campaign from the repository", async () => {
    const { repository } = createScenarioRepositoryStub();
    repository.listScenariosByCampaignPlayerAccess = async (campaignId, userId) =>
      campaignId === "campaign-1" && userId === "player-1"
        ? [
            {
              campaignId: "campaign-1",
              createdAt: "2026-04-21T00:00:00.000Z",
              description: "Accessible scenario",
              id: "scenario-1",
              kind: "combat",
              name: "Arena Bout",
              status: "live",
              updatedAt: "2026-04-21T00:00:00.000Z",
            },
          ]
        : [];
    const service = new ScenarioService(repository);

    await expect(
      service.listScenariosByCampaignPlayerAccess("campaign-1", "player-1"),
    ).resolves.toEqual([
      expect.objectContaining({
        campaignId: "campaign-1",
        id: "scenario-1",
        name: "Arena Bout",
      }),
    ]);
  });

  it("lists only Scenarios under the player's current control", async () => {
    const { repository } = createScenarioRepositoryStub();
    repository.listScenariosByCampaignPlayerControl = async (campaignId, userId) =>
      campaignId === "campaign-1" && userId === "player-1"
        ? [
            {
              campaignId: "campaign-1",
              createdAt: "2026-04-21T00:00:00.000Z",
              description: "Controlled scenario",
              id: "scenario-controlled",
              kind: "mixed",
              name: "Current Chapter",
              status: "live",
              updatedAt: "2026-04-21T00:00:00.000Z",
            },
          ]
        : [];
    const service = new ScenarioService(repository);

    await expect(
      service.listScenariosByCampaignPlayerControl("campaign-1", "player-1"),
    ).resolves.toEqual([expect.objectContaining({ id: "scenario-controlled" })]);
  });

  it("creates scenarios without continuation links by default", async () => {
    const { repository, scenarioRelationships } = createScenarioRepositoryStub();
    const service = new ScenarioService(repository);

    await expect(
      service.createScenario({
        campaignId: "campaign-1",
        kind: "mixed",
        name: "Standalone Scene",
        status: "draft",
      }),
    ).resolves.toMatchObject({
      campaignId: "campaign-1",
      name: "Standalone Scene",
    });
    expect(scenarioRelationships).toHaveLength(0);
  });

  it("creates a continuation relationship to an earlier campaign scenario", async () => {
    const { repository, scenarioRelationships } = createScenarioRepositoryStub();
    const service = new ScenarioService(repository);

    const scenario = await service.createScenario({
      campaignId: "campaign-1",
      continuesFromScenarioId: "scenario-1",
      kind: "mixed",
      name: "Follow-up Scene",
      status: "draft",
    });

    expect(scenarioRelationships).toEqual([
      expect.objectContaining({
        campaignId: "campaign-1",
        fromScenarioId: "scenario-1",
        relationType: "continues_from",
        toScenarioId: scenario.id,
      }),
    ]);
    await expect(service.listScenarioRelationshipsByCampaign("campaign-1")).resolves.toHaveLength(
      1,
    );
  });

  it("rejects continuation links to scenarios outside the campaign", async () => {
    const { repository, scenarioRelationships } = createScenarioRepositoryStub();
    repository.getScenarioById = async () => ({
      campaignId: "other-campaign",
      createdAt: "2026-04-21T00:00:00.000Z",
      description: "",
      id: "scenario-other",
      kind: "mixed",
      name: "Other Campaign Scene",
      status: "draft",
      updatedAt: "2026-04-21T00:00:00.000Z",
    });
    const service = new ScenarioService(repository);

    await expect(
      service.createScenario({
        campaignId: "campaign-1",
        continuesFromScenarioId: "scenario-other",
        name: "Invalid Follow-up",
      }),
    ).rejects.toThrow("Continuation scenario not found in this campaign.");
    expect(scenarioRelationships).toHaveLength(0);
  });
});
