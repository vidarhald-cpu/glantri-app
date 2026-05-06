import { describe, expect, it } from "vitest";

import type {
  Campaign,
  CampaignRosterEntry,
  CharacterBuild,
  ReusableEntity,
  Scenario,
  ScenarioEventLog,
  ScenarioParticipant,
  ScenarioRelationship
} from "@glantri/domain";

import type { ScenarioRepository } from "../repositories/scenarioRepository";
import { ScenarioService } from "./scenarioService";

const baseBuild: CharacterBuild = {
  equipment: { items: [] },
  id: "character-1",
  name: "Player Character",
  profile: {
    description: "Test",
    distractionLevel: 3,
    id: "profile-1",
    label: "Profile",
    rolledStats: {
      cha: 10,
      com: 10,
      con: 10,
      dex: 10,
      health: 10,
      int: 12,
      lck: 9,
      pow: 15,
      siz: 10,
      str: 11,
      will: 10
    },
    societyLevel: 0
  },
  progression: {
    chargenMode: "standard",
    educationPoints: 0,
    flexiblePointFactor: 1,
    level: 1,
    primaryPoolSpent: 0,
    primaryPoolTotal: 60,
    secondaryPoolSpent: 0,
    secondaryPoolTotal: 0,
    skillGroups: [],
    skills: [],
    specializations: []
  },
  progressionState: {
    availablePoints: 0,
    checks: [],
    history: [],
    pendingAttempts: []
  }
};

function createCharacterRecord(input: {
  id: string;
  name: string;
  ownerId?: string | null;
}) {
  return {
    build: {
      ...baseBuild,
      id: input.id,
      name: input.name
    },
    createdAt: "2026-04-21T00:00:00.000Z",
    id: input.id,
    level: 1,
    name: input.name,
    ownerId: input.ownerId ?? null,
    updatedAt: "2026-04-21T00:00:00.000Z"
  };
}

function createScenarioRepositoryStub() {
  const campaigns: Campaign[] = [];
  const scenario: Scenario = {
    campaignId: "campaign-1",
    createdAt: "2026-04-21T00:00:00.000Z",
    description: "",
    id: "scenario-1",
    kind: "mixed",
    name: "Scenario One",
    status: "draft",
    updatedAt: "2026-04-21T00:00:00.000Z"
  };
  const participants: ScenarioParticipant[] = [];
  const eventLogs: ScenarioEventLog[] = [];
  const rosterEntries: CampaignRosterEntry[] = [];
  const scenarioRelationships: ScenarioRelationship[] = [];

  const repository: ScenarioRepository = {
    createCampaign: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getCampaignById: async () => null,
    listCampaignsByGameMaster: async () => [],
    listCampaignsAllowingPlayerSelfJoin: async () => [],
    listCampaignsByPlayerAccess: async () => campaigns,
    createScenario: async (input) => {
      const now = "2026-04-21T00:00:00.000Z";

      return {
        campaignId: input.campaignId,
        createdAt: now,
        description: input.description,
        id: `scenario-created-${scenarioRelationships.length + 1}`,
        kind: input.kind,
        name: input.name,
        status: input.status,
        updatedAt: now
      };
    },
    getScenarioById: async (scenarioId) => (scenarioId === scenario.id ? scenario : null),
    listScenariosByCampaign: async () => [],
    listScenariosByCampaignPlayerAccess: async () => [],
    updateScenario: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createReusableEntity: async () => {
      throw new Error("Not implemented in test stub.");
    },
    updateReusableEntity: async () => {
      throw new Error("Not implemented in test stub.");
    },
    getReusableEntityById: async () => null,
    listReusableEntitiesByGameMaster: async () => [],
    createScenarioParticipant: async (input) => {
      const now = "2026-04-21T00:00:00.000Z";
      const participant: ScenarioParticipant = {
        characterId: input.characterId ?? undefined,
        controlledByUserId: input.controlledByUserId ?? undefined,
        createdAt: now,
        displayOrder: input.displayOrder ?? undefined,
        entityId: input.entityId ?? undefined,
        factionId: input.factionId ?? undefined,
        id: `participant-${participants.length + 1}`,
        initiativeSlot: input.initiativeSlot ?? undefined,
        isActive: input.isActive ?? true,
        joinSource: input.joinSource,
        position: input.position,
        role: input.role,
        roleTag: input.roleTag ?? undefined,
        scenarioId: input.scenarioId,
        snapshot: input.snapshot,
        sourceType: input.sourceType,
        state: input.state,
        tacticalGroupId: input.tacticalGroupId ?? undefined,
        updatedAt: now,
        visibilityOverrides: input.visibilityOverrides
      };
      participants.push(participant);
      return participant;
    },
    listScenarioParticipants: async (scenarioId) =>
      participants.filter((participant) => participant.scenarioId === scenarioId),
    updateScenarioLiveState: async () => scenario,
    updateScenarioParticipantState: async (participantId, state) => {
      const participant = participants.find((entry) => entry.id === participantId);
      if (!participant) {
        throw new Error("Scenario participant not found.");
      }
      participant.state = state;
      participant.updatedAt = "2026-04-21T00:00:00.000Z";
      return participant;
    },
    updateScenarioParticipantMetadata: async (input) => {
      const participant = participants.find((entry) => entry.id === input.participantId);
      if (!participant) {
        throw new Error("Scenario participant not found.");
      }
      if (input.controlledByUserId !== undefined) {
        participant.controlledByUserId = input.controlledByUserId ?? undefined;
      }
      if (input.displayOrder !== undefined) {
        participant.displayOrder = input.displayOrder ?? undefined;
      }
      if (input.factionId !== undefined) {
        participant.factionId = input.factionId ?? undefined;
      }
      if (input.isActive !== undefined) {
        participant.isActive = input.isActive;
      }
      if (input.roleTag !== undefined) {
        participant.roleTag = input.roleTag ?? undefined;
      }
      if (input.tacticalGroupId !== undefined) {
        participant.tacticalGroupId = input.tacticalGroupId ?? undefined;
      }
      participant.updatedAt = "2026-04-21T00:00:00.000Z";
      return participant;
    },
    createCampaignAsset: async () => {
      throw new Error("Not implemented in test stub.");
    },
    listCampaignAssets: async () => [],
    getCampaignAssetById: async () => null,
    updateCampaignAssetVisibility: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createCampaignRosterEntry: async (input) => {
      const existing = rosterEntries.find(
        (entry) =>
          entry.campaignId === input.campaignId &&
          entry.sourceType === input.sourceType &&
          entry.sourceId === input.sourceId
      );

      if (existing) {
        return existing;
      }

      const now = "2026-04-21T00:00:00.000Z";
      const rosterEntry: CampaignRosterEntry = {
        campaignId: input.campaignId,
        category: input.category,
        createdAt: now,
        createdByUserId: input.createdByUserId ?? undefined,
        id: `roster-${rosterEntries.length + 1}`,
        labelSnapshot: input.labelSnapshot ?? undefined,
        notes: input.notes ?? undefined,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        updatedAt: now
      };
      rosterEntries.push(rosterEntry);
      return rosterEntry;
    },
    deleteCampaignRosterEntry: async (entryId) => {
      const index = rosterEntries.findIndex((entry) => entry.id === entryId);

      if (index >= 0) {
        rosterEntries.splice(index, 1);
      }
    },
    getCampaignRosterEntryById: async (entryId) =>
      rosterEntries.find((entry) => entry.id === entryId) ?? null,
    listCampaignRosterEntries: async (campaignId) =>
      rosterEntries.filter((entry) => entry.campaignId === campaignId),
    createScenarioRelationship: async (input) => {
      const now = "2026-04-21T00:00:00.000Z";
      const relationship: ScenarioRelationship = {
        campaignId: input.campaignId,
        createdAt: now,
        fromScenarioId: input.fromScenarioId,
        id: `relationship-${scenarioRelationships.length + 1}`,
        relationType: input.relationType,
        sortOrder: input.sortOrder ?? undefined,
        toScenarioId: input.toScenarioId,
        updatedAt: now
      };
      scenarioRelationships.push(relationship);
      return relationship;
    },
    listScenarioRelationshipsByCampaign: async (campaignId) =>
      scenarioRelationships.filter((entry) => entry.campaignId === campaignId),
    createScenarioEventLog: async (input) => {
      const eventLog: ScenarioEventLog = {
        actorUserId: input.actorUserId ?? undefined,
        createdAt: "2026-04-21T00:00:00.000Z",
        eventType: input.eventType,
        id: `event-${eventLogs.length + 1}`,
        participantId: input.participantId ?? undefined,
        payload: input.payload,
        phase: input.phase,
        roundNumber: input.roundNumber,
        scenarioId: input.scenarioId,
        summary: input.summary
      };
      eventLogs.push(eventLog);
      return eventLog;
    },
    listScenarioEventLogs: async () => eventLogs
  };

  return { campaigns, eventLogs, participants, repository, rosterEntries, scenario, scenarioRelationships };
}

describe("ScenarioService controller assignment", () => {
  it("prevents one player from being assigned to two active player characters in the same scenario", async () => {
    const { repository } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
      ["character-2", createCharacterRecord({ id: "character-2", name: "Bryn", ownerId: "user-2" })]
    ]);
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async (characterId: string) => characters.get(characterId) ?? null
      } as never,
      {
        getCharacterEquipmentState: async () => ({
          activeLoadoutByCharacterId: {},
          itemsById: {},
          locationsById: {},
          templatesById: {}
        })
      } as never
    );

    await service.addCharacterParticipant({
      characterId: "character-1",
      controlledByUserId: "user-1",
      joinSource: "gm_added",
      scenarioId: "scenario-1"
    });

    await expect(
      service.addCharacterParticipant({
        characterId: "character-2",
        controlledByUserId: "user-1",
        joinSource: "gm_added",
        scenarioId: "scenario-1"
      })
    ).rejects.toThrow("already the active controlled character");
  });

  it("allows the same controller to manage multiple non-player participants", async () => {
    const { participants, repository } = createScenarioRepositoryStub();
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async () => null
      } as never,
      {
        getCharacterEquipmentState: async () => ({
          activeLoadoutByCharacterId: {},
          itemsById: {},
          locationsById: {},
          templatesById: {}
        })
      } as never
    );

    const baseEntity: ReusableEntity = {
      createdAt: "2026-04-21T00:00:00.000Z",
      gmUserId: "gm-1",
      id: "entity-1",
      kind: "npc",
      name: "Guard",
      updatedAt: "2026-04-21T00:00:00.000Z"
    };
    let entityCounter = 0;
    repository.getReusableEntityById = async () => ({
      ...baseEntity,
      id: `entity-${++entityCounter}`
    });

    await service.addEntityParticipant({
      controlledByUserId: "gm-1",
      entityId: "entity-1",
      role: "npc",
      scenarioId: "scenario-1"
    });

    await expect(
      service.addEntityParticipant({
        controlledByUserId: "gm-1",
        entityId: "entity-2",
        role: "npc",
        scenarioId: "scenario-1"
      })
    ).resolves.toMatchObject({
      controlledByUserId: "gm-1",
      role: "npc"
    });

    expect(participants).toHaveLength(2);
  });

  it("enforces the active-control rule when participant metadata is reassigned", async () => {
    const { repository } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })],
      ["character-2", createCharacterRecord({ id: "character-2", name: "Bryn", ownerId: null })]
    ]);
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async (characterId: string) => characters.get(characterId) ?? null
      } as never,
      {
        getCharacterEquipmentState: async () => ({
          activeLoadoutByCharacterId: {},
          itemsById: {},
          locationsById: {},
          templatesById: {}
        })
      } as never
    );

    const first = await service.addCharacterParticipant({
      characterId: "character-1",
      controlledByUserId: "user-1",
      joinSource: "gm_added",
      scenarioId: "scenario-1"
    });
    const second = await service.addCharacterParticipant({
      characterId: "character-2",
      controlledByUserId: null,
      joinSource: "gm_added",
      scenarioId: "scenario-1"
    });

    await expect(
      service.updateScenarioParticipantMetadata({
        controlledByUserId: "user-1",
        participantId: second.id,
        scenarioId: "scenario-1"
      })
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
        tacticalGroupId: "squad-a"
      })
    ).resolves.toMatchObject({
      controlledByUserId: "user-1",
      displayOrder: 10,
      factionId: "red",
      id: second.id,
      isActive: false,
      roleTag: "archer",
      tacticalGroupId: "squad-a"
    });

    expect(first.controlledByUserId).toBe("user-1");
  });
});

describe("ScenarioService access listing", () => {
  it("returns player-accessible campaigns from controlled or owned active player-character participants", async () => {
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

    await expect(service.listCampaignsByPlayerAccess("player-1")).resolves.toEqual(expectedCampaigns);
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
});

describe("ScenarioService scenario relationships", () => {
  it("creates scenarios without continuation links by default", async () => {
    const { repository, scenarioRelationships } = createScenarioRepositoryStub();
    const service = new ScenarioService(repository);

    await expect(
      service.createScenario({
        campaignId: "campaign-1",
        kind: "mixed",
        name: "Standalone Scene",
        status: "draft"
      })
    ).resolves.toMatchObject({
      campaignId: "campaign-1",
      name: "Standalone Scene"
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
      status: "draft"
    });

    expect(scenarioRelationships).toEqual([
      expect.objectContaining({
        campaignId: "campaign-1",
        fromScenarioId: "scenario-1",
        relationType: "continues_from",
        toScenarioId: scenario.id
      })
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
      updatedAt: "2026-04-21T00:00:00.000Z"
    });
    const service = new ScenarioService(repository);

    await expect(
      service.createScenario({
        campaignId: "campaign-1",
        continuesFromScenarioId: "scenario-other",
        name: "Invalid Follow-up"
      })
    ).rejects.toThrow("Continuation scenario not found in this campaign.");
    expect(scenarioRelationships).toHaveLength(0);
  });
});

describe("ScenarioService campaign roster", () => {
  it("links characters, reusable entities, and templates without creating scenario participants", async () => {
    const { participants, repository, rosterEntries } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })]
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
            campaignId: "campaign-1"
          },
          updatedAt: "2026-04-21T00:00:00.000Z"
        }
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
            actorClass: "template"
          },
          updatedAt: "2026-04-21T00:00:00.000Z"
        }
      ]
    ]);
    repository.getReusableEntityById = async (entityId) => reusableEntities.get(entityId) ?? null;
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async (characterId: string) => characters.get(characterId) ?? null
      } as never
    );

    await expect(
      service.addCampaignRosterEntry({
        campaignId: "campaign-1",
        category: "pc",
        sourceId: "character-1",
        sourceType: "character"
      })
    ).resolves.toMatchObject({
      category: "pc",
      labelSnapshot: "Ari",
      sourceType: "character"
    });
    await expect(
      service.addCampaignRosterEntry({
        campaignId: "campaign-1",
        category: "npc",
        sourceId: "entity-1",
        sourceType: "reusableEntity"
      })
    ).resolves.toMatchObject({
      category: "npc",
      labelSnapshot: "Guard Captain",
      sourceType: "reusableEntity"
    });
    await expect(
      service.addCampaignRosterEntry({
        campaignId: "campaign-1",
        category: "template",
        sourceId: "template-1",
        sourceType: "template"
      })
    ).resolves.toMatchObject({
      category: "template",
      labelSnapshot: "Bandit Template",
      sourceType: "template"
    });

    expect(rosterEntries).toHaveLength(3);
    expect(participants).toHaveLength(0);
  });

  it("dedupes duplicate roster links and can remove a roster entry", async () => {
    const { repository, rosterEntries } = createScenarioRepositoryStub();
    const characters = new Map([
      ["character-1", createCharacterRecord({ id: "character-1", name: "Ari", ownerId: "user-1" })]
    ]);
    const service = new ScenarioService(
      repository,
      {
        getCharacterById: async (characterId: string) => characters.get(characterId) ?? null
      } as never
    );

    const first = await service.addCampaignRosterEntry({
      campaignId: "campaign-1",
      category: "pc",
      sourceId: "character-1",
      sourceType: "character"
    });
    const duplicate = await service.addCampaignRosterEntry({
      campaignId: "campaign-1",
      category: "pc",
      sourceId: "character-1",
      sourceType: "character"
    });

    expect(duplicate.id).toBe(first.id);
    expect(rosterEntries).toHaveLength(1);

    await service.removeCampaignRosterEntry({
      campaignId: "campaign-1",
      rosterEntryId: first.id
    });

    await expect(service.listCampaignRosterEntries("campaign-1")).resolves.toEqual([]);
  });
});
