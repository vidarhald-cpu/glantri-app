import type {
  Campaign,
  CampaignRosterEntry,
  CharacterBuild,
  ReusableEntity,
  Scenario,
  ScenarioEventLog,
  ScenarioParticipant,
  ScenarioRelationship,
} from "@glantri/domain";

import {
  CampaignRosterPersistenceConflictError,
  type ScenarioRepository,
} from "../repositories/scenarioRepository";

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
      will: 10,
    },
    societyLevel: 0,
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
    specializations: [],
  },
  progressionState: {
    availablePoints: 0,
    checks: [],
    history: [],
    pendingAttempts: [],
  },
};

export function createCharacterRecord(input: {
  id: string;
  name: string;
  ownerId?: string | null;
}) {
  return {
    build: {
      ...baseBuild,
      id: input.id,
      name: input.name,
    },
    createdAt: "2026-04-21T00:00:00.000Z",
    id: input.id,
    level: 1,
    name: input.name,
    ownerId: input.ownerId ?? null,
    updatedAt: "2026-04-21T00:00:00.000Z",
  };
}

export function createScenarioRepositoryStub() {
  const campaigns: Campaign[] = [];
  const scenario: Scenario = {
    campaignId: "campaign-1",
    createdAt: "2026-04-21T00:00:00.000Z",
    description: "",
    id: "scenario-1",
    kind: "mixed",
    name: "Scenario One",
    status: "draft",
    updatedAt: "2026-04-21T00:00:00.000Z",
  };
  const participants: ScenarioParticipant[] = [];
  const eventLogs: ScenarioEventLog[] = [];
  const rosterEntries: CampaignRosterEntry[] = [];
  const reusableEntities: ReusableEntity[] = [];
  const scenarioRelationships: ScenarioRelationship[] = [];

  const repository: ScenarioRepository = {
    createCampaign: async () => {
      throw new Error("Not implemented in test stub.");
    },
    activateCampaignFromDraft: async (input) => {
      const campaign = campaigns.find((entry) => entry.id === input.campaignId);

      if (!campaign || campaign.status !== "draft") {
        return null;
      }

      const index = campaigns.indexOf(campaign);
      const updatedCampaign = {
        ...campaign,
        status: "active" as const,
        updatedAt: "2026-04-22T00:00:00.000Z",
      };

      campaigns[index] = updatedCampaign;
      return updatedCampaign;
    },
    getCampaignById: async (campaignId) =>
      campaigns.find((campaign) => campaign.id === campaignId) ?? null,
    listCampaignsByGameMaster: async () => [],
    listCampaignsAllowingPlayerSelfJoin: async () => [],
    listCampaignsByCharacterRosterAccess: async (characterId) => {
      const campaignIds = new Set(
        rosterEntries
          .filter((entry) => entry.sourceType === "character" && entry.sourceId === characterId)
          .map((entry) => entry.campaignId),
      );

      return campaigns.filter((campaign) => campaignIds.has(campaign.id));
    },
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
        updatedAt: now,
      };
    },
    getScenarioById: async (scenarioId) => (scenarioId === scenario.id ? scenario : null),
    listScenariosByCampaign: async () => [],
    listScenariosByCampaignPlayerAccess: async () => [],
    listScenariosByCampaignPlayerControl: async () => [],
    updateScenario: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createReusableEntity: async () => {
      throw new Error("Not implemented in test stub.");
    },
    createCampaignNpcWithRosterEntry: async (input) => {
      const now = "2026-04-21T00:00:00.000Z";
      const entity: ReusableEntity = {
        createdAt: now,
        description: input.description ?? undefined,
        gmUserId: input.gmUserId,
        id: `entity-${reusableEntities.length + 1}`,
        kind: input.kind,
        name: input.name,
        notes: input.notes ?? undefined,
        snapshot: input.snapshot,
        updatedAt: now,
      };
      const rosterEntry: CampaignRosterEntry = {
        campaignId: input.campaignId,
        category: "npc",
        createdAt: now,
        createdByUserId: input.createdByUserId,
        id: `roster-${rosterEntries.length + 1}`,
        labelSnapshot: entity.name,
        sourceId: entity.id,
        sourceType: "reusableEntity",
        updatedAt: now,
      };
      reusableEntities.push(entity);
      rosterEntries.push(rosterEntry);
      return { entity, rosterEntry };
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
        visibilityOverrides: input.visibilityOverrides,
      };
      participants.push(participant);
      return participant;
    },
    updateScenarioParticipantSnapshotAndState: async (participantId, snapshot, state) => {
      const participantIndex = participants.findIndex((entry) => entry.id === participantId);
      if (participantIndex < 0) {
        throw new Error("Scenario participant not found.");
      }
      const participant = {
        ...participants[participantIndex]!,
        snapshot,
        state,
        updatedAt: "2026-04-22T00:00:00.000Z",
      };
      participants[participantIndex] = participant;
      return participant;
    },
    getScenarioParticipantById: async (participantId, scenarioId) =>
      participants.find((p) => p.id === participantId && p.scenarioId === scenarioId) ?? null,
    listScenarioParticipants: async (scenarioId) =>
      participants.filter((participant) => participant.scenarioId === scenarioId),
    updateScenarioLiveState: async () => scenario,
    updateScenarioSessionState: async (input) => {
      scenario.liveState = {
        combatStatus: scenario.liveState?.combatStatus ?? "not_started",
        phase: scenario.liveState?.phase ?? 1,
        roundNumber: scenario.liveState?.roundNumber ?? 1,
        session: input.session,
      };
      scenario.updatedAt = "2026-04-21T00:00:01.000Z";
      return scenario;
    },
    pickUpScenarioAvailableItem: async () => {
      throw new Error("Not implemented in test stub.");
    },
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
    revokeScenarioParticipantControl: async (participantId) => {
      const participant = participants.find((entry) => entry.id === participantId);

      if (!participant) {
        throw new Error("Scenario participant not found.");
      }

      participant.controlledByUserId = undefined;
      participant.updatedAt = "2026-04-21T00:00:00.000Z";
      return participant;
    },
    revokeCampaignCharacterParticipantControl: async (input) => {
      const matching = participants.filter(
        (entry) =>
          entry.sourceType === "character" &&
          entry.characterId === input.characterId &&
          entry.controlledByUserId != null &&
          entry.scenarioId === scenario.id &&
          scenario.campaignId === input.campaignId,
      );

      for (const participant of matching) {
        participant.controlledByUserId = undefined;
        participant.updatedAt = "2026-04-21T00:00:00.000Z";
      }

      return matching.length;
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
          entry.sourceId === input.sourceId,
      );

      if (existing) {
        const currentElsewhere = rosterEntries.find(
          (entry) =>
            input.sourceType === "character" &&
            entry.sourceType === "character" &&
            entry.sourceId === input.sourceId &&
            entry.campaignId !== input.campaignId &&
            (entry.membershipState ?? "current") === "current",
        );
        if (currentElsewhere) {
          throw new CampaignRosterPersistenceConflictError(currentElsewhere.campaignId);
        }
        existing.membershipState = "current";
        return existing;
      }

      const currentElsewhere = rosterEntries.find(
        (entry) =>
          input.sourceType === "character" &&
          entry.sourceType === "character" &&
          entry.sourceId === input.sourceId &&
          (entry.membershipState ?? "current") === "current",
      );
      if (currentElsewhere) {
        throw new CampaignRosterPersistenceConflictError(currentElsewhere.campaignId);
      }

      const now = "2026-04-21T00:00:00.000Z";
      const rosterEntry: CampaignRosterEntry = {
        campaignId: input.campaignId,
        category: input.category,
        createdAt: now,
        createdByUserId: input.createdByUserId ?? undefined,
        id: `roster-${rosterEntries.length + 1}`,
        labelSnapshot: input.labelSnapshot ?? undefined,
        membershipState: "current",
        notes: input.notes ?? undefined,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        updatedAt: now,
      };
      rosterEntries.push(rosterEntry);
      return rosterEntry;
    },
    updateCampaignRosterMembershipState: async (input) => {
      const entry = rosterEntries.find((candidate) => candidate.id === input.entryId);
      if (!entry) throw new Error("Campaign roster entry not found.");
      entry.membershipState = input.membershipState;
      return entry;
    },
    deleteCampaignRosterEntry: async (entryId) => {
      const index = rosterEntries.findIndex((entry) => entry.id === entryId);

      if (index >= 0) {
        rosterEntries.splice(index, 1);
      }
    },
    deleteCampaignRosterEntryBySource: async (input) => {
      const index = rosterEntries.findIndex(
        (entry) =>
          entry.campaignId === input.campaignId &&
          entry.sourceId === input.sourceId &&
          entry.sourceType === input.sourceType,
      );

      if (index >= 0) {
        rosterEntries.splice(index, 1);
        return 1;
      }

      return 0;
    },
    getCampaignRosterEntryById: async (entryId) =>
      rosterEntries.find((entry) => entry.id === entryId) ?? null,
    listCampaignRosterEntries: async (campaignId) =>
      rosterEntries.filter(
        (entry) =>
          entry.campaignId === campaignId && (entry.membershipState ?? "current") === "current",
      ),
    listCampaignRosterHistoryEntries: async (campaignId) =>
      rosterEntries.filter((entry) => entry.campaignId === campaignId),
    listCharacterRosterHistoryEntries: async (characterId) =>
      rosterEntries.filter(
        (entry) => entry.sourceType === "character" && entry.sourceId === characterId,
      ),
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
        updatedAt: now,
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
        summary: input.summary,
      };
      eventLogs.push(eventLog);
      return eventLog;
    },
    listScenarioEventLogs: async () => eventLogs,
  };

  return {
    campaigns,
    eventLogs,
    participants,
    reusableEntities,
    repository,
    rosterEntries,
    scenario,
    scenarioRelationships,
  };
}
