import type {
  ReusableEntity,
  Scenario,
  ScenarioAvailableObjectReference,
  ScenarioRelationship,
  ScenarioParticipant,
  ScenarioParticipantRole,
  ScenarioSessionAvailableObject,
} from "@glantri/domain";
import {
  createParticipantSnapshotFromCharacter,
  createParticipantSnapshotFromEntity,
  formatScenarioAvailableObjectReferenceType,
  scenarioAvailableObjectReferenceSchema,
  scenarioSessionStateSchema,
} from "@glantri/domain";

import {
  createPrismaScenarioRepository,
  ScenarioPersistenceError,
  type ScenarioRepository,
} from "../repositories/scenarioRepository";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterService } from "./characterService";
import {
  assertControllerAssignmentAvailable,
  resolveEntityParticipantSource,
  userHasPlayerScenarioAccess,
} from "./scenarioParticipantSupport";

export class ScenarioSessionWriteError extends Error {
  constructor(
    readonly code: "stale_revision" | "transaction_conflict",
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ScenarioSessionWriteError";
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", { enumerable: false, value: cause });
    }
  }
}

export class ScenarioService {
  constructor(
    private readonly repository: ScenarioRepository = createPrismaScenarioRepository(),
    private readonly characterService = new CharacterService(),
    private readonly equipmentService = new CharacterEquipmentReadModelService(),
  ) {}

  async createScenario(input: {
    campaignId: string;
    continuesFromScenarioId?: string | null;
    description?: string;
    kind?: Scenario["kind"];
    mapAssetId?: string | null;
    name: string;
    status?: Scenario["status"];
  }): Promise<Scenario> {
    const previousScenario = input.continuesFromScenarioId
      ? await this.repository.getScenarioById(input.continuesFromScenarioId)
      : null;

    if (
      input.continuesFromScenarioId &&
      (!previousScenario || previousScenario.campaignId !== input.campaignId)
    ) {
      throw new Error("Continuation scenario not found in this campaign.");
    }

    const scenario = await this.repository.createScenario({
      campaignId: input.campaignId,
      description: input.description?.trim() ?? "",
      kind: input.kind ?? "mixed",
      mapAssetId: input.mapAssetId ?? null,
      name: input.name.trim(),
      status: input.status ?? "draft",
    });

    if (previousScenario) {
      await this.repository.createScenarioRelationship({
        campaignId: input.campaignId,
        fromScenarioId: previousScenario.id,
        relationType: "continues_from",
        toScenarioId: scenario.id,
      });
    }

    return scenario;
  }

  async listScenariosByCampaign(campaignId: string): Promise<Scenario[]> {
    return this.repository.listScenariosByCampaign(campaignId);
  }

  async listScenarioRelationshipsByCampaign(campaignId: string): Promise<ScenarioRelationship[]> {
    return this.repository.listScenarioRelationshipsByCampaign(campaignId);
  }

  async listScenariosByCampaignPlayerAccess(
    campaignId: string,
    userId: string,
  ): Promise<Scenario[]> {
    return this.repository.listScenariosByCampaignPlayerAccess(campaignId, userId);
  }

  async listScenariosByCampaignPlayerControl(
    campaignId: string,
    userId: string,
  ): Promise<Scenario[]> {
    return this.repository.listScenariosByCampaignPlayerControl(campaignId, userId);
  }

  async getScenarioById(scenarioId: string): Promise<Scenario | null> {
    return this.repository.getScenarioById(scenarioId);
  }

  async userHasPlayerScenarioAccess(input: {
    scenarioId: string;
    userId: string;
  }): Promise<boolean> {
    return userHasPlayerScenarioAccess(this.repository, this.characterService, input);
  }

  async updateScenario(input: {
    description?: string;
    kind?: Scenario["kind"];
    mapAssetId?: string | null;
    name?: string;
    scenarioId: string;
    status?: Scenario["status"];
  }): Promise<Scenario> {
    return this.repository.updateScenario(input);
  }

  async updateScenarioSessionState(input: {
    availableObjects: ScenarioAvailableObjectReference[];
    expectedRevision: string;
    gmPrivateNotes: string;
    scenarioId: string;
  }): Promise<Scenario> {
    const scenario = await this.getScenarioById(input.scenarioId);
    if (!scenario) throw new Error("Scenario not found.");
    const currentItems = await this.equipmentService.getCampaignEquipmentState(scenario.campaignId);
    const assets = await this.repository.listCampaignAssets(scenario.campaignId);
    const roster = await this.repository.listCampaignRosterEntries(scenario.campaignId);
    const seenIds = new Set<string>();
    const availableObjects: ScenarioAvailableObjectReference[] = [];

    for (const submitted of input.availableObjects) {
      const reference = scenarioAvailableObjectReferenceSchema.parse(submitted);
      if (seenIds.has(reference.id)) throw new Error("Available object identities must be unique.");
      seenIds.add(reference.id);

      if (reference.sourceKind === "campaign_asset") {
        const asset = assets.find((candidate) => candidate.id === reference.sourceId);
        if (!asset) throw new Error("Choose an asset from this Campaign.");
        if (reference.visibility === "players" && asset.visibility !== "visible_to_all") {
          throw new Error("Reveal this Campaign asset before making it available to players.");
        }
        availableObjects.push({ ...reference, expectedHolderCharacterId: undefined });
        continue;
      }

      if (reference.sourceKind === "campaign_item") {
        const item = currentItems.itemsById[reference.sourceId];
        if (!item || item.campaignContextId !== scenario.campaignId) {
          throw new Error("Choose an Item from this Campaign.");
        }
        const expectedHolderCharacterId =
          reference.expectedHolderCharacterId ?? item.holderCharacterId ?? undefined;
        if (!expectedHolderCharacterId) {
          throw new Error("Only an Item currently held by a Character can be made available.");
        }
        availableObjects.push({ ...reference, expectedHolderCharacterId });
        continue;
      }

      const rosterEntry = roster.find(
        (entry) => entry.sourceType === "reusableEntity" && entry.sourceId === reference.sourceId,
      );
      if (!rosterEntry || !(await this.repository.getReusableEntityById(reference.sourceId))) {
        throw new Error("Choose a reference from this Campaign roster.");
      }
      availableObjects.push({ ...reference, expectedHolderCharacterId: undefined });
    }

    const session = scenarioSessionStateSchema.parse({
      ...(scenario.liveState?.session ?? {}),
      availableObjects,
      gmPrivateNotes: input.gmPrivateNotes.trim(),
    });
    try {
      return await this.repository.updateScenarioSessionState({
        expectedRevision: input.expectedRevision,
        scenarioId: input.scenarioId,
        session,
      });
    } catch (error) {
      if (error instanceof ScenarioPersistenceError) {
        throw new ScenarioSessionWriteError(error.code, error.message, error);
      }
      throw error;
    }
  }

  async resolveScenarioAvailableObjects(input: {
    scenario: Scenario;
    viewerMode: "gm" | "player";
  }): Promise<ScenarioSessionAvailableObject[]> {
    const references = input.scenario.liveState?.session.availableObjects ?? [];
    const [assets, equipment, roster] = await Promise.all([
      this.repository.listCampaignAssets(input.scenario.campaignId),
      this.equipmentService.getCampaignEquipmentState(input.scenario.campaignId),
      this.repository.listCampaignRosterEntries(input.scenario.campaignId),
    ]);
    const entities = await Promise.all(
      references
        .filter((reference) => reference.sourceKind === "reusable_entity")
        .map((reference) => this.repository.getReusableEntityById(reference.sourceId)),
    );
    const entitiesById = new Map(
      entities.flatMap((entity) => (entity ? [[entity.id, entity]] : [])),
    );

    return references.flatMap<ScenarioSessionAvailableObject>((reference) => {
      if (input.viewerMode === "player" && reference.visibility !== "players") return [];
      if (reference.sourceKind === "campaign_asset") {
        const asset = assets.find((candidate) => candidate.id === reference.sourceId);
        if (!asset || (input.viewerMode === "player" && asset.visibility !== "visible_to_all")) {
          return [];
        }
        return [
          {
            canPickUp: false,
            description: asset.description,
            id: reference.id,
            name: asset.title,
            referenceType: formatScenarioAvailableObjectReferenceType({
              assetType: asset.type,
              sourceKind: reference.sourceKind,
            }),
            sourceKind: reference.sourceKind,
          },
        ];
      }
      if (reference.sourceKind === "campaign_item") {
        const item = equipment.itemsById[reference.sourceId];
        if (!item || item.campaignContextId !== input.scenario.campaignId) return [];
        const template = equipment.templatesById[item.templateId];
        return [
          {
            canPickUp:
              Boolean(item.holderCharacterId) &&
              item.holderCharacterId === reference.expectedHolderCharacterId,
            id: reference.id,
            name: item.displayName || template?.name || "Item",
            referenceType: "Item",
            sourceKind: reference.sourceKind,
          },
        ];
      }
      const entity = entitiesById.get(reference.sourceId);
      const inRoster = roster.some(
        (entry) => entry.sourceType === "reusableEntity" && entry.sourceId === reference.sourceId,
      );
      if (!entity || !inRoster) return [];
      return [
        {
          canPickUp: false,
          description: entity.description,
          id: reference.id,
          name: entity.name,
          referenceType: "Reference",
          sourceKind: reference.sourceKind,
        },
      ];
    });
  }

  async pickUpScenarioAvailableItem(input: {
    actorUserId: string;
    availabilityId: string;
    expectedRevision: string;
    requestId: string;
    scenarioId: string;
    targetParticipantId: string;
    viewerMode: "gm" | "player";
  }) {
    const scenario = await this.repository.getScenarioById(input.scenarioId);
    if (!scenario) throw new Error("Scenario not found.");
    const participant = await this.repository.getScenarioParticipantById(
      input.targetParticipantId,
      input.scenarioId,
    );
    if (!participant?.isActive || !participant.characterId) {
      throw new Error("Choose an active Character participant.");
    }
    if (input.viewerMode === "player") {
      const character = await this.characterService.getCharacterById(participant.characterId);
      const controlledByViewer =
        participant.controlledByUserId === input.actorUserId ||
        (!participant.controlledByUserId && character?.ownerId === input.actorUserId);
      if (!controlledByViewer) throw new Error("Available Item not found.");
    }
    const availableObject = (
      await this.resolveScenarioAvailableObjects({ scenario, viewerMode: input.viewerMode })
    ).find((candidate) => candidate.id === input.availabilityId);
    const alreadyApplied = scenario.liveState?.session.appliedRequestIds.includes(input.requestId);
    if ((!availableObject || availableObject.sourceKind !== "campaign_item") && !alreadyApplied) {
      throw new Error("Available Item not found.");
    }

    try {
      return await this.repository.pickUpScenarioAvailableItem({
        actorUserId: input.actorUserId,
        audienceParticipantIds: [participant.id],
        availabilityId: input.availabilityId,
        expectedRevision: input.expectedRevision,
        requestId: input.requestId,
        scenarioId: input.scenarioId,
        summary: `${participant.snapshot.displayName} picked up ${availableObject?.name ?? "an Item"}.`,
        targetCharacterId: participant.characterId,
      });
    } catch (error) {
      if (error instanceof ScenarioPersistenceError) {
        throw new ScenarioSessionWriteError(error.code, error.message, error);
      }
      throw error;
    }
  }

  async addCharacterParticipant(input: {
    characterId: string;
    controlledByUserId?: string | null;
    displayOrder?: number | null;
    factionId?: string | null;
    joinSource: ScenarioParticipant["joinSource"];
    role?: ScenarioParticipantRole;
    roleTag?: string | null;
    scenarioId: string;
    tacticalGroupId?: string | null;
  }): Promise<ScenarioParticipant> {
    const scenario = await this.repository.getScenarioById(input.scenarioId);

    if (!scenario) {
      throw new Error("Scenario not found.");
    }

    const campaignRoster = await this.repository.listCampaignRosterEntries(scenario.campaignId);
    const characterIsInCampaignRoster = campaignRoster.some(
      (entry) => entry.sourceType === "character" && entry.sourceId === input.characterId,
    );

    if (!characterIsInCampaignRoster) {
      throw new Error("Character is not in the campaign roster.");
    }

    const character = await this.characterService.getCharacterById(input.characterId);

    if (!character) {
      throw new Error("Character not found.");
    }

    const existingParticipant = (
      await this.repository.listScenarioParticipants(input.scenarioId)
    ).find((participant) => participant.characterId === input.characterId);

    if (existingParticipant) {
      throw new Error("Character is already participating in this scenario.");
    }

    await assertControllerAssignmentAvailable(this.repository, {
      controlledByUserId: input.controlledByUserId ?? character.ownerId ?? null,
      role: input.role ?? "player_character",
      scenarioId: input.scenarioId,
    });

    const equipmentState = await this.equipmentService.getCharacterEquipmentState(
      input.characterId,
    );
    const snapshotState = createParticipantSnapshotFromCharacter({
      build: character.build,
      equipmentState,
      sourceUpdatedAt: character.updatedAt,
    });
    const participant = await this.repository.createScenarioParticipant({
      characterId: character.id,
      controlledByUserId: input.controlledByUserId ?? character.ownerId ?? null,
      displayOrder: input.displayOrder ?? null,
      joinSource: input.joinSource,
      factionId: input.factionId ?? null,
      role: input.role ?? "player_character",
      roleTag: input.roleTag ?? null,
      scenarioId: input.scenarioId,
      snapshot: snapshotState.snapshot,
      sourceType: "character",
      state: snapshotState.state,
      tacticalGroupId: input.tacticalGroupId ?? null,
    });

    await this.repository.createScenarioEventLog({
      eventType: "participant_added",
      participantId: participant.id,
      payload: {
        characterId: character.id,
        joinSource: participant.joinSource,
        role: participant.role,
        sourceType: participant.sourceType,
      },
      scenarioId: input.scenarioId,
      summary: `Added ${participant.snapshot.displayName} to the scenario.`,
    });

    return participant;
  }

  /** Explicitly recommits current character equipment into the scenario-owned snapshot. */
  async refreshCharacterParticipantEquipmentSnapshot(input: {
    participantId: string;
    scenarioId: string;
  }): Promise<ScenarioParticipant> {
    const participant = await this.repository.getScenarioParticipantById(
      input.participantId,
      input.scenarioId,
    );

    if (!participant?.characterId || participant.sourceType !== "character") {
      throw new Error("Character-backed scenario participant not found.");
    }

    const character = await this.characterService.getCharacterById(participant.characterId);

    if (!character) {
      throw new Error("Character not found.");
    }

    const equipmentState = await this.equipmentService.getCharacterEquipmentState(
      participant.characterId,
    );
    const refreshed = createParticipantSnapshotFromCharacter({
      build: character.build,
      equipmentState,
      sourceUpdatedAt: character.updatedAt,
    });

    return this.repository.updateScenarioParticipantSnapshotAndState(
      participant.id,
      {
        ...participant.snapshot,
        equipmentState: refreshed.snapshot.equipmentState,
        sourceUpdatedAt: refreshed.snapshot.sourceUpdatedAt,
      },
      {
        ...participant.state,
        equipment: refreshed.state.equipment,
      },
    );
  }

  async addEntityParticipant(input: {
    entityId?: string;
    expectedGmUserId?: string;
    entityInput?: {
      description?: string;
      gmUserId: string;
      kind: ReusableEntity["kind"];
      name: string;
      notes?: string;
      snapshot?: unknown;
    };
    isTemporary?: boolean;
    controlledByUserId?: string | null;
    displayOrder?: number | null;
    factionId?: string | null;
    joinSource?: ScenarioParticipant["joinSource"];
    role: ScenarioParticipantRole;
    roleTag?: string | null;
    scenarioId: string;
    tacticalGroupId?: string | null;
  }): Promise<ScenarioParticipant> {
    const entity = await resolveEntityParticipantSource(this.repository, input);

    if (!entity) {
      throw new Error("Reusable entity not found.");
    }

    await assertControllerAssignmentAvailable(this.repository, {
      controlledByUserId: input.controlledByUserId ?? null,
      role: input.role,
      scenarioId: input.scenarioId,
    });

    const snapshotState = createParticipantSnapshotFromEntity({
      entity: {
        description: entity.description,
        kind: entity.kind,
        name: entity.name,
        notes: entity.notes,
        snapshot: entity.snapshot,
      },
      sourceUpdatedAt: entity.updatedAt,
    });
    const participant = await this.repository.createScenarioParticipant({
      controlledByUserId: input.controlledByUserId ?? null,
      displayOrder: input.displayOrder ?? null,
      entityId: entity.id || null,
      factionId: input.factionId ?? null,
      joinSource: input.joinSource ?? "gm_added",
      role: input.role,
      roleTag: input.roleTag ?? null,
      scenarioId: input.scenarioId,
      snapshot: snapshotState.snapshot,
      sourceType: "entity",
      state: snapshotState.state,
      tacticalGroupId: input.tacticalGroupId ?? null,
    });

    await this.repository.createScenarioEventLog({
      eventType: "participant_added",
      participantId: participant.id,
      payload: {
        entityId: entity.id || null,
        isTemporary: input.isTemporary ?? false,
        joinSource: participant.joinSource,
        role: participant.role,
        sourceType: participant.sourceType,
      },
      scenarioId: input.scenarioId,
      summary: `Added ${participant.snapshot.displayName} to the scenario.`,
    });

    return participant;
  }

  async getScenarioParticipantById(
    participantId: string,
    scenarioId: string,
  ): Promise<ScenarioParticipant | null> {
    return this.repository.getScenarioParticipantById(participantId, scenarioId);
  }

  async listScenarioParticipants(scenarioId: string): Promise<ScenarioParticipant[]> {
    return this.repository.listScenarioParticipants(scenarioId);
  }

  async updateScenarioParticipantMetadata(input: {
    controlledByUserId?: string | null;
    displayOrder?: number | null;
    factionId?: string | null;
    isActive?: boolean;
    participantId: string;
    roleTag?: string | null;
    scenarioId: string;
    tacticalGroupId?: string | null;
  }): Promise<ScenarioParticipant> {
    const participants = await this.repository.listScenarioParticipants(input.scenarioId);
    const existingParticipant = participants.find(
      (participant) => participant.id === input.participantId,
    );

    if (!existingParticipant) {
      throw new Error("Scenario participant not found.");
    }

    await assertControllerAssignmentAvailable(this.repository, {
      controlledByUserId:
        input.controlledByUserId === undefined
          ? (existingParticipant.controlledByUserId ?? null)
          : input.controlledByUserId,
      excludingParticipantId: existingParticipant.id,
      isActive: input.isActive ?? existingParticipant.isActive,
      role: existingParticipant.role,
      scenarioId: input.scenarioId,
    });

    const participant = await this.repository.updateScenarioParticipantMetadata(input);
    const scenario = await this.repository.getScenarioById(input.scenarioId);

    await this.repository.createScenarioEventLog({
      eventType:
        input.isActive === undefined || input.isActive === existingParticipant.isActive
          ? "participant_metadata_updated"
          : input.isActive
            ? "participant_activated"
            : "participant_deactivated",
      participantId: participant.id,
      payload: {
        controlledByUserId: participant.controlledByUserId ?? null,
        displayOrder: participant.displayOrder ?? null,
        factionId: participant.factionId ?? null,
        isActive: participant.isActive,
        roleTag: participant.roleTag ?? null,
        tacticalGroupId: participant.tacticalGroupId ?? null,
      },
      phase: scenario?.liveState?.phase,
      roundNumber: scenario?.liveState?.roundNumber,
      scenarioId: input.scenarioId,
      summary:
        input.isActive === undefined || input.isActive === existingParticipant.isActive
          ? `Updated control and grouping for ${participant.snapshot.displayName}.`
          : `${input.isActive ? "Activated" : "Deactivated"} ${participant.snapshot.displayName} in the Scenario.`,
    });

    return participant;
  }

  async listScenarioEventLogs(scenarioId: string) {
    return this.repository.listScenarioEventLogs(scenarioId);
  }

  async recordScenarioEvent(input: {
    actorUserId?: string | null;
    eventType: string;
    participantId?: string | null;
    payload?: unknown;
    scenarioId: string;
    summary: string;
  }) {
    const scenario = await this.repository.getScenarioById(input.scenarioId);

    if (!scenario) {
      throw new Error("Scenario not found.");
    }

    return this.repository.createScenarioEventLog({
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      participantId: input.participantId ?? null,
      payload: input.payload,
      phase: scenario.liveState?.phase,
      roundNumber: scenario.liveState?.roundNumber,
      scenarioId: input.scenarioId,
      summary: input.summary,
    });
  }
}
