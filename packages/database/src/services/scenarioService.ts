import type {
  Campaign,
  CampaignAsset,
  ReusableEntity,
  Scenario,
  ScenarioParticipant,
  ScenarioParticipantRole,
  ScenarioParticipantState
} from "@glantri/domain";
import {
  advanceScenarioRound,
  createParticipantSnapshotFromCharacter,
  createParticipantSnapshotFromEntity,
  createScenarioLiveState,
  setScenarioPhase,
  startScenario
} from "@glantri/domain";

import {
  createPrismaScenarioRepository,
  type ScenarioRepository
} from "../repositories/scenarioRepository";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterService } from "./characterService";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export class ScenarioService {
  constructor(
    private readonly repository: ScenarioRepository = createPrismaScenarioRepository(),
    private readonly characterService = new CharacterService(),
    private readonly equipmentService = new CharacterEquipmentReadModelService()
  ) {}

  async createCampaign(input: {
    description?: string;
    gmUserId: string;
    name: string;
    settings?: Campaign["settings"];
    status?: Campaign["status"];
  }): Promise<Campaign> {
    return this.repository.createCampaign({
      description: input.description?.trim() ?? "",
      gmUserId: input.gmUserId,
      name: input.name.trim(),
      settings: input.settings ?? {
        allowPlayerSelfJoin: false,
        defaultVisibility: "hidden"
      },
      slug: `${slugify(input.name)}-${Date.now().toString(36)}`,
      status: input.status ?? "draft"
    });
  }

  async listCampaignsByGameMaster(gmUserId: string): Promise<Campaign[]> {
    return this.repository.listCampaignsByGameMaster(gmUserId);
  }

  async listCampaignsAllowingPlayerSelfJoin(): Promise<Campaign[]> {
    return this.repository.listCampaignsAllowingPlayerSelfJoin();
  }

  async getCampaignById(campaignId: string): Promise<Campaign | null> {
    return this.repository.getCampaignById(campaignId);
  }

  async createScenario(input: {
    campaignId: string;
    description?: string;
    kind?: Scenario["kind"];
    mapAssetId?: string | null;
    name: string;
    status?: Scenario["status"];
  }): Promise<Scenario> {
    return this.repository.createScenario({
      campaignId: input.campaignId,
      description: input.description?.trim() ?? "",
      kind: input.kind ?? "mixed",
      mapAssetId: input.mapAssetId ?? null,
      name: input.name.trim(),
      status: input.status ?? "draft"
    });
  }

  async listScenariosByCampaign(campaignId: string): Promise<Scenario[]> {
    return this.repository.listScenariosByCampaign(campaignId);
  }

  async getScenarioById(scenarioId: string): Promise<Scenario | null> {
    return this.repository.getScenarioById(scenarioId);
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

  async createReusableEntity(input: {
    description?: string;
    gmUserId: string;
    kind: ReusableEntity["kind"];
    name: string;
    notes?: string;
    snapshot?: unknown;
  }): Promise<ReusableEntity> {
    return this.repository.createReusableEntity({
      description: input.description ?? null,
      gmUserId: input.gmUserId,
      kind: input.kind,
      name: input.name.trim(),
      notes: input.notes ?? null,
      snapshot: input.snapshot
    });
  }

  async listReusableEntitiesByGameMaster(gmUserId: string): Promise<ReusableEntity[]> {
    return this.repository.listReusableEntitiesByGameMaster(gmUserId);
  }

  async getReusableEntityById(entityId: string): Promise<ReusableEntity | null> {
    return this.repository.getReusableEntityById(entityId);
  }

  async createCampaignAsset(input: {
    campaignId: string;
    createdByUserId: string;
    description?: string;
    mimeType?: string;
    storageUrl: string;
    title: string;
    type: CampaignAsset["type"];
    visibility: CampaignAsset["visibility"];
  }): Promise<CampaignAsset> {
    return this.repository.createCampaignAsset({
      campaignId: input.campaignId,
      createdByUserId: input.createdByUserId,
      description: input.description ?? null,
      mimeType: input.mimeType ?? null,
      storageUrl: input.storageUrl,
      title: input.title.trim(),
      type: input.type,
      visibility: input.visibility
    });
  }

  async listCampaignAssets(campaignId: string): Promise<CampaignAsset[]> {
    return this.repository.listCampaignAssets(campaignId);
  }

  async getCampaignAssetById(assetId: string): Promise<CampaignAsset | null> {
    return this.repository.getCampaignAssetById(assetId);
  }

  async updateCampaignAssetVisibility(input: {
    assetId: string;
    visibility: CampaignAsset["visibility"];
  }): Promise<CampaignAsset> {
    return this.repository.updateCampaignAssetVisibility(input.assetId, input.visibility);
  }

  async addCharacterParticipant(input: {
    characterId: string;
    controlledByUserId?: string | null;
    joinSource: ScenarioParticipant["joinSource"];
    role?: ScenarioParticipantRole;
    scenarioId: string;
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

    const equipmentState = await this.equipmentService.getCharacterEquipmentState(input.characterId);
    const snapshotState = createParticipantSnapshotFromCharacter({
      build: character.build,
      equipmentState,
      sourceUpdatedAt: character.updatedAt
    });
    const participant = await this.repository.createScenarioParticipant({
      characterId: character.id,
      controlledByUserId: input.controlledByUserId ?? character.ownerId ?? null,
      joinSource: input.joinSource,
      role: input.role ?? "player_character",
      scenarioId: input.scenarioId,
      snapshot: snapshotState.snapshot,
      sourceType: "character",
      state: snapshotState.state
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
    controlledByUserId?: string | null;
    joinSource?: ScenarioParticipant["joinSource"];
    role: ScenarioParticipantRole;
    scenarioId: string;
  }): Promise<ScenarioParticipant> {
    const entity =
      input.entityId != null
        ? await this.repository.getReusableEntityById(input.entityId)
        : input.entityInput
          ? await this.createReusableEntity(input.entityInput)
          : null;

    if (!entity) {
      throw new Error("Reusable entity not found.");
    }

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
      entityId: entity.id,
      joinSource: input.joinSource ?? "gm_added",
      role: input.role,
      scenarioId: input.scenarioId,
      snapshot: snapshotState.snapshot,
      sourceType: "entity",
      state: snapshotState.state
    });

    await this.repository.createScenarioEventLog({
      eventType: "participant_added",
      participantId: participant.id,
      payload: {
        entityId: entity.id,
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

  async updateScenarioLiveState(input: {
    liveState: Scenario["liveState"];
    scenarioId: string;
  }): Promise<Scenario> {
    const existingScenario = await this.repository.getScenarioById(input.scenarioId);

    if (!existingScenario) {
      throw new Error("Scenario not found.");
    }

    const scenario = await this.repository.updateScenarioLiveState(
      input.scenarioId,
      input.liveState ?? createScenarioLiveState()
    );

    await this.repository.createScenarioEventLog({
      eventType: "live_state_updated",
      payload: scenario.liveState,
      phase: scenario.liveState?.phase,
      roundNumber: scenario.liveState?.roundNumber,
      scenarioId: input.scenarioId,
      summary: "Scenario live state updated."
    });

    return scenario;
  }

  async startScenario(scenarioId: string): Promise<Scenario> {
    const existingScenario = await this.repository.getScenarioById(scenarioId);

    if (!existingScenario) {
      throw new Error("Scenario not found.");
    }

    const liveState = startScenario(existingScenario.liveState ?? createScenarioLiveState());
    const scenario = await this.repository.updateScenarioLiveState(scenarioId, liveState);

    await this.repository.createScenarioEventLog({
      eventType: "scenario_started",
      payload: liveState,
      phase: liveState.phase,
      roundNumber: liveState.roundNumber,
      scenarioId,
      summary: "Scenario started."
    });

    return scenario;
  }

  async advanceScenarioRound(scenarioId: string): Promise<Scenario> {
    const existingScenario = await this.repository.getScenarioById(scenarioId);

    if (!existingScenario) {
      throw new Error("Scenario not found.");
    }

    const liveState = advanceScenarioRound(existingScenario.liveState ?? createScenarioLiveState());
    const scenario = await this.repository.updateScenarioLiveState(scenarioId, liveState);

    await this.repository.createScenarioEventLog({
      eventType: "round_advanced",
      payload: liveState,
      phase: liveState.phase,
      roundNumber: liveState.roundNumber,
      scenarioId,
      summary: `Advanced to round ${liveState.roundNumber}.`
    });

    return scenario;
  }

  async setScenarioPhase(input: {
    phase: 1 | 2;
    scenarioId: string;
  }): Promise<Scenario> {
    const existingScenario = await this.repository.getScenarioById(input.scenarioId);

    if (!existingScenario) {
      throw new Error("Scenario not found.");
    }

    const liveState = setScenarioPhase(
      existingScenario.liveState ?? createScenarioLiveState(),
      input.phase
    );
    const scenario = await this.repository.updateScenarioLiveState(input.scenarioId, liveState);

    await this.repository.createScenarioEventLog({
      eventType: "phase_changed",
      payload: liveState,
      phase: liveState.phase,
      roundNumber: liveState.roundNumber,
      scenarioId: input.scenarioId,
      summary: `Scenario phase set to ${input.phase}.`
    });

    return scenario;
  }

  async updateScenarioParticipantState(input: {
    participantId: string;
    scenarioId: string;
    state: ScenarioParticipantState;
  }): Promise<ScenarioParticipant> {
    const participant = await this.repository.updateScenarioParticipantState(
      input.participantId,
      input.state
    );
    const scenario = await this.repository.getScenarioById(input.scenarioId);

    await this.repository.createScenarioEventLog({
      eventType: "participant_state_updated",
      participantId: input.participantId,
      payload: input.state,
      phase: scenario?.liveState?.phase,
      roundNumber: scenario?.liveState?.roundNumber,
      scenarioId: input.scenarioId,
      summary: `Updated state for ${participant.snapshot.displayName}.`
    });

    return participant;
  }

  async listScenarioEventLogs(scenarioId: string) {
    return this.repository.listScenarioEventLogs(scenarioId);
  }
}
