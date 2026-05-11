import type {
  ReusableEntity,
  Scenario,
  ScenarioRelationship,
  ScenarioParticipant,
  ScenarioParticipantRole,
} from "@glantri/domain";
import {
  createParticipantSnapshotFromCharacter,
  createParticipantSnapshotFromEntity,
} from "@glantri/domain";

import {
  createPrismaScenarioRepository,
  type ScenarioRepository
} from "../repositories/scenarioRepository";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterService } from "./characterService";
import {
  assertControllerAssignmentAvailable,
  resolveEntityParticipantSource,
  userHasPlayerScenarioAccess,
} from "./scenarioParticipantSupport";

export class ScenarioService {
  constructor(
    private readonly repository: ScenarioRepository = createPrismaScenarioRepository(),
    private readonly characterService = new CharacterService(),
    private readonly equipmentService = new CharacterEquipmentReadModelService()
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

    if (input.continuesFromScenarioId && (!previousScenario || previousScenario.campaignId !== input.campaignId)) {
      throw new Error("Continuation scenario not found in this campaign.");
    }

    const scenario = await this.repository.createScenario({
      campaignId: input.campaignId,
      description: input.description?.trim() ?? "",
      kind: input.kind ?? "mixed",
      mapAssetId: input.mapAssetId ?? null,
      name: input.name.trim(),
      status: input.status ?? "draft"
    });

    if (previousScenario) {
      await this.repository.createScenarioRelationship({
        campaignId: input.campaignId,
        fromScenarioId: previousScenario.id,
        relationType: "continues_from",
        toScenarioId: scenario.id
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

  async listScenariosByCampaignPlayerAccess(campaignId: string, userId: string): Promise<Scenario[]> {
    return this.repository.listScenariosByCampaignPlayerAccess(campaignId, userId);
  }

  async getScenarioById(scenarioId: string): Promise<Scenario | null> {
    return this.repository.getScenarioById(scenarioId);
  }

  async userHasPlayerScenarioAccess(input: { scenarioId: string; userId: string }): Promise<boolean> {
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
    const character = await this.characterService.getCharacterById(input.characterId);

    if (!character) {
      throw new Error("Character not found.");
    }

    const existingParticipant = (await this.repository.listScenarioParticipants(input.scenarioId)).find(
      (participant) => participant.characterId === input.characterId
    );

    if (existingParticipant) {
      throw new Error("Character is already participating in this scenario.");
    }

    await assertControllerAssignmentAvailable(this.repository, {
      controlledByUserId: input.controlledByUserId ?? character.ownerId ?? null,
      role: input.role ?? "player_character",
      scenarioId: input.scenarioId
    });

    const equipmentState = await this.equipmentService.getCharacterEquipmentState(input.characterId);
    const snapshotState = createParticipantSnapshotFromCharacter({
      build: character.build,
      equipmentState,
      sourceUpdatedAt: character.updatedAt
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
      tacticalGroupId: input.tacticalGroupId ?? null
    });

    await this.repository.createScenarioEventLog({
      eventType: "participant_added",
      participantId: participant.id,
      payload: {
        characterId: character.id,
        joinSource: participant.joinSource,
        role: participant.role,
        sourceType: participant.sourceType
      },
      scenarioId: input.scenarioId,
      summary: `Added ${participant.snapshot.displayName} to the scenario.`
    });

    return participant;
  }

  async addEntityParticipant(input: {
    entityId?: string;
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
      scenarioId: input.scenarioId
    });

    const snapshotState = createParticipantSnapshotFromEntity({
      entity: {
        description: entity.description,
        kind: entity.kind,
        name: entity.name,
        notes: entity.notes,
        snapshot: entity.snapshot
      },
      sourceUpdatedAt: entity.updatedAt
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
      tacticalGroupId: input.tacticalGroupId ?? null
    });

    await this.repository.createScenarioEventLog({
      eventType: "participant_added",
      participantId: participant.id,
      payload: {
        entityId: entity.id || null,
        isTemporary: input.isTemporary ?? false,
        joinSource: participant.joinSource,
        role: participant.role,
        sourceType: participant.sourceType
      },
      scenarioId: input.scenarioId,
      summary: `Added ${participant.snapshot.displayName} to the scenario.`
    });

    return participant;
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
      (participant) => participant.id === input.participantId
    );

    if (!existingParticipant) {
      throw new Error("Scenario participant not found.");
    }

    await assertControllerAssignmentAvailable(this.repository, {
      controlledByUserId:
        input.controlledByUserId === undefined
          ? existingParticipant.controlledByUserId ?? null
          : input.controlledByUserId,
      excludingParticipantId: existingParticipant.id,
      isActive: input.isActive ?? existingParticipant.isActive,
      role: existingParticipant.role,
      scenarioId: input.scenarioId
    });

    const participant = await this.repository.updateScenarioParticipantMetadata(input);
    const scenario = await this.repository.getScenarioById(input.scenarioId);

    await this.repository.createScenarioEventLog({
      eventType: "participant_metadata_updated",
      participantId: participant.id,
      payload: {
        controlledByUserId: participant.controlledByUserId ?? null,
        displayOrder: participant.displayOrder ?? null,
        factionId: participant.factionId ?? null,
        isActive: participant.isActive,
        roleTag: participant.roleTag ?? null,
        tacticalGroupId: participant.tacticalGroupId ?? null
      },
      phase: scenario?.liveState?.phase,
      roundNumber: scenario?.liveState?.roundNumber,
      scenarioId: input.scenarioId,
      summary: `Updated control and grouping for ${participant.snapshot.displayName}.`
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
      summary: input.summary
    });
  }
}
