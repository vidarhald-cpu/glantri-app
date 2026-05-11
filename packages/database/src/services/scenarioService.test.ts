import { describe, expect, it } from "vitest";

import type { ReusableEntity } from "@glantri/domain";

import { ScenarioService } from "./scenarioService";
import {
  createCharacterRecord,
  createScenarioRepositoryStub,
} from "./scenarioService.testHelpers";

describe("ScenarioService controller assignment", () => {
  it("prevents one player from being assigned to two active player characters in the same scenario", async () => {
    const { repository } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
      ["character-2", createCharacterRecord({ id: "character-2", name: "Bryn", ownerId: "user-2" })],
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
    await expect(service.listScenarioRelationshipsByCampaign("campaign-1")).resolves.toHaveLength(1);
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
