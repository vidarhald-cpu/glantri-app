import type {
  ReusableEntity,
  Scenario,
  ScenarioLifecycleAction,
  ScenarioLifecycleTransition,
  ScenarioRelationship,
  ScenarioParticipant,
  ScenarioParticipantRole,
  ScenarioStartPreflight,
} from "@glantri/domain";
import {
  createParticipantSnapshotFromCharacter,
  createParticipantSnapshotFromEntity,
  deriveScenarioStartPreflight,
  getScenarioLifecycleTarget,
} from "@glantri/domain";

import {
  createPrismaScenarioRepository,
  type ScenarioRepository,
} from "../repositories/scenarioRepository";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterService } from "./characterService";
import {
  assertControllerAssignmentAvailable,
  resolveEntityParticipantSource,
  userHasPlayerScenarioAccess,
} from "./scenarioParticipantSupport";

export type ScenarioLifecycleConflictCode =
  | "invalid_transition"
  | "stale_revision"
  | "start_blocked"
  | "warnings_not_accepted";

export class ScenarioLifecycleConflictError extends Error {
  constructor(
    readonly code: ScenarioLifecycleConflictCode,
    message: string,
    readonly preflight?: ScenarioStartPreflight,
  ) {
    super(message);
    this.name = "ScenarioLifecycleConflictError";
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
    status?: Scenario["status"] | "prepared" | "completed";
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
      status: "draft",
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
    includePaused?: boolean;
    scenarioId: string;
    userId: string;
  }): Promise<boolean> {
    const scenario = await this.repository.getScenarioById(input.scenarioId);

    if (
      !scenario ||
      (scenario.status !== "live" && !(input.includePaused && scenario.status === "paused"))
    ) {
      return false;
    }

    return userHasPlayerScenarioAccess(this.repository, this.characterService, input);
  }

  async updateScenario(input: {
    description?: string;
    kind?: Scenario["kind"];
    mapAssetId?: string | null;
    name?: string;
    scenarioId: string;
  }): Promise<Scenario> {
    return this.repository.updateScenario(input);
  }

  async getScenarioStartPreflight(scenarioId: string): Promise<ScenarioStartPreflight | null> {
    const scenario = await this.repository.getScenarioById(scenarioId);

    if (!scenario) {
      return null;
    }

    return deriveScenarioStartPreflight({
      participants: await this.repository.listScenarioParticipants(scenarioId),
      scenario,
    });
  }

  async listScenarioLifecycleTransitions(
    scenarioId: string,
  ): Promise<ScenarioLifecycleTransition[]> {
    return this.repository.listScenarioLifecycleTransitions(scenarioId);
  }

  async transitionScenarioLifecycle(input: {
    acceptedWarningCodes?: string[];
    action: ScenarioLifecycleAction;
    actorUserId: string;
    expectedRevision: number;
    reason: string;
    scenarioId: string;
  }): Promise<{
    preflight?: ScenarioStartPreflight;
    scenario: Scenario;
    transition: ScenarioLifecycleTransition;
  } | null> {
    const reason = input.reason.trim();

    if (!reason) {
      throw new Error("A lifecycle transition reason is required.");
    }

    const scenario = await this.repository.getScenarioById(input.scenarioId);

    if (!scenario) {
      return null;
    }

    const lifecycleRevision = scenario.lifecycleRevision ?? 0;
    const lifecycleCycle = scenario.lifecycleCycle ?? 0;

    if (lifecycleRevision !== input.expectedRevision) {
      throw new ScenarioLifecycleConflictError(
        "stale_revision",
        "The Scenario changed. Refresh it before trying this action again.",
      );
    }

    const toStatus = getScenarioLifecycleTarget({
      action: input.action,
      lifecycleCycle,
      status: scenario.status,
    });

    if (!toStatus) {
      throw new ScenarioLifecycleConflictError(
        "invalid_transition",
        `The Scenario cannot ${input.action} while it is ${scenario.status}.`,
      );
    }

    let preflight: ScenarioStartPreflight | undefined;
    if (input.action === "start") {
      preflight = deriveScenarioStartPreflight({
        participants: await this.repository.listScenarioParticipants(input.scenarioId),
        scenario,
      });

      if (!preflight.ready) {
        throw new ScenarioLifecycleConflictError(
          "start_blocked",
          "Resolve the Scenario start blockers before starting play.",
          preflight,
        );
      }

      const acceptedWarnings = new Set(input.acceptedWarningCodes ?? []);
      if (preflight.warnings.some((warning) => !acceptedWarnings.has(warning.code))) {
        throw new ScenarioLifecycleConflictError(
          "warnings_not_accepted",
          "Review and accept the Scenario start warnings before starting play.",
          preflight,
        );
      }
    }

    const nextCycle =
      input.action === "start" || input.action === "reopen" ? lifecycleCycle + 1 : lifecycleCycle;
    const result = await this.repository.transitionScenarioLifecycle({
      action: input.action,
      actorUserId: input.actorUserId,
      cycle: nextCycle,
      expectedRevision: input.expectedRevision,
      fromStatus: scenario.status,
      reason,
      scenarioId: input.scenarioId,
      toStatus,
      transitionedAt: new Date(),
    });

    if (!result) {
      throw new ScenarioLifecycleConflictError(
        "stale_revision",
        "The Scenario changed. Refresh it before trying this action again.",
      );
    }

    return { ...result, preflight };
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
      eventType: "participant_metadata_updated",
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
      summary: `Updated control and grouping for ${participant.snapshot.displayName}.`,
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
