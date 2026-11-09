import type {
  CombatRoundState,
  ReusableEntity,
  Scenario,
  ScenarioAvailableObjectReference,
  ScenarioRelationship,
  ScenarioParticipant,
  ScenarioParticipantRole,
  ScenarioSessionAvailableObject,
  ScenarioSessionParticipantEquipment,
} from "@glantri/domain";
import type { PrismaClient } from "@prisma/client";
import {
  createParticipantSnapshotFromCharacter,
  createParticipantSnapshotFromEntity,
  canMutateScenarioInStatus,
  canTransitionScenarioStatus,
  encounterRosterChangeWaitsForRoundBoundary,
  isScenarioReadOnly,
  isScenarioLiveInteractive,
  formatScenarioAvailableObjectReferenceType,
  scenarioAvailableObjectReferenceSchema,
  scenarioSessionStateSchema,
} from "@glantri/domain";

import { createPrismaCharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import {
  createPrismaScenarioRepository,
  ScenarioPersistenceError,
  type ScenarioRepository,
} from "../repositories/scenarioRepository";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterEquipmentWriteService } from "./characterEquipmentWriteService";
import { CharacterService } from "./characterService";
import {
  assertControllerAssignmentAvailable,
  resolveEntityParticipantSource,
  userHasPlayerScenarioAccess,
} from "./scenarioParticipantSupport";
import { prisma as defaultPrisma } from "../client";
import {
  fingerprintScenarioEquipment,
  resolveScenarioEquipmentStatuses,
} from "./scenarioEquipmentReconciliation";

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

export class ScenarioMutationConflictError extends Error {
  constructor(
    readonly code: "stale_revision" | "transaction_conflict",
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ScenarioMutationConflictError";
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
    private readonly client: PrismaClient = defaultPrisma,
    /**
     * Forgejo issue #599. Scenario participant capture is the write boundary at which Combat
     * begins to depend on a Character's equipment aggregate, so it is the boundary that must
     * guarantee the aggregate is initialized. See `captureCurrentEquipmentState`. It defaults to
     * a service bound to this service's own client, so a caller that supplied a client never
     * silently initializes an aggregate on a different database.
     */
    private readonly equipmentWriteService = new CharacterEquipmentWriteService(
      createPrismaCharacterEquipmentRepository(client),
    ),
  ) {}

  /**
   * Reads the equipment state a Scenario-owned projection is about to be captured from, having
   * first guaranteed the aggregate is initialized.
   *
   * Forgejo issue #599. Lazy initialization (default storage locations and an active loadout) is
   * the one remaining write that an otherwise read-only equipment request can still perform, and
   * it advances `CharacterEquipmentAggregate.revision`. A Character finalized through Chargen
   * reaches the roster uninitialized, so a projection captured before initialization recorded a
   * revision and fingerprint that the very next equipment read invalidated — and
   * `assertScenarioEquipmentCurrent` then refused every Item interaction and canonical Disarm in
   * that Scenario with a 409 until the GM reconciled.
   *
   * Initializing here, immediately before the capture, closes that ordering for good:
   * initialization advances the revision at most once per Character, so performing it before the
   * first projection of that Character exists means no later read — and no later capture for
   * another Scenario — can advance it again. It adds no write path of its own: this method is only
   * ever called from the two existing writes that capture the projection.
   */
  private async captureCurrentEquipmentState(characterId: string) {
    await this.equipmentWriteService.ensureCharacterEquipmentInitialized(characterId);
    return this.equipmentService.getCharacterEquipmentState(characterId, { kind: "gm" });
  }

  async resolveEquipmentStatuses(input: {
    participants: ScenarioParticipant[];
    userId: string;
    viewerMode: "gm" | "player";
  }): Promise<Record<string, ScenarioSessionParticipantEquipment>> {
    return resolveScenarioEquipmentStatuses({ client: this.client, ...input });
  }

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
    expectedRevision?: string;
    description?: string;
    kind?: Scenario["kind"];
    mapAssetId?: string | null;
    name?: string;
    scenarioId: string;
    status?: Scenario["status"];
  }): Promise<Scenario> {
    const scenario = await this.getScenarioById(input.scenarioId);

    if (!scenario) {
      throw new Error("Scenario not found.");
    }

    const hasFieldMutation =
      input.description !== undefined ||
      input.kind !== undefined ||
      input.mapAssetId !== undefined ||
      input.name !== undefined;

    if (isScenarioReadOnly(scenario.status)) {
      if (input.status === undefined || input.status === scenario.status || hasFieldMutation) {
        throw new Error("Scenario is not editable in its current status.");
      }
    }

    if (input.expectedRevision !== undefined && scenario.updatedAt !== input.expectedRevision) {
      throw new ScenarioMutationConflictError(
        "stale_revision",
        "Scenario changed before this update could be saved.",
      );
    }

    if (input.status !== undefined && !canTransitionScenarioStatus(scenario.status, input.status)) {
      throw new Error(`Scenario cannot transition from ${scenario.status} to ${input.status}.`);
    }

    try {
      return await this.repository.updateScenario({
        description: input.description,
        kind: input.kind,
        mapAssetId: input.mapAssetId,
        name: input.name,
        expectedRevision: input.expectedRevision,
        expectedStatus: input.status === undefined ? undefined : scenario.status,
        scenarioId: input.scenarioId,
        status: input.status,
      });
    } catch (error) {
      if (error instanceof ScenarioPersistenceError) {
        throw new ScenarioMutationConflictError(error.code, error.message, error);
      }
      throw error;
    }
  }

  async updateScenarioSessionState(input: {
    actorUserId?: string;
    availableObjects: ScenarioAvailableObjectReference[];
    expectedRevision: string;
    gmPrivateNotes: string;
    scenarioId: string;
  }): Promise<Scenario> {
    const scenario = await this.getScenarioById(input.scenarioId);
    if (!scenario) throw new Error("Scenario not found.");
    if (!isScenarioLiveInteractive(scenario.status)) {
      throw new Error("Scenario is not currently live.");
    }
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
        if (!asset || !asset.storageUrl.startsWith("artifact-internal:")) {
          throw new Error("Choose a secure Artifact from this Campaign.");
        }
        // The resolved two-state Artifact audience is the only player-access
        // authority. The legacy `visibility` column has none, and must never
        // broaden access beyond `audience` (content authoring §18.24; Product
        // Owner ruling 2026-09-26, Forgejo #339). `asset.audience` is already
        // fail-closed by `persistedArtifactAudienceSchema`.
        if (reference.visibility === "players" && asset.audience !== "campaign") {
          throw new Error(
            "Share this Campaign Artifact with players before making it available to players.",
          );
        }
        availableObjects.push({ ...reference, expectedHolderCharacterId: undefined });
        continue;
      }

      if (reference.sourceKind === "campaign_item") {
        const item = currentItems.itemsById[reference.sourceId];
        if (!item || item.campaignContextId !== scenario.campaignId) {
          throw new Error("Choose an Item from this Campaign.");
        }
        if (item.holderCharacterId) {
          throw new Error("Only an unheld Campaign Item can be made available for pickup.");
        }
        availableObjects.push({ ...reference, expectedHolderCharacterId: undefined });
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
        actorUserId: input.actorUserId,
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
        if (
          !asset ||
          !asset.storageUrl.startsWith("artifact-internal:") ||
          // Player-reachable projection: gated on the resolved audience only.
          // See the equivalent gate in `replaceScenarioAvailableObjects`.
          (input.viewerMode === "player" && asset.audience !== "campaign")
        ) {
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
        const template =
          item.templateId === null ? undefined : equipment.templatesById[item.templateId];
        return [
          {
            canPickUp: !item.holderCharacterId,
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
    if (!isScenarioLiveInteractive(scenario.status)) {
      throw new Error("Scenario is not currently live.");
    }
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
        actorAuthority: input.viewerMode === "gm" ? "campaign_gm" : "character_controller",
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

    if (!canMutateScenarioInStatus(scenario.status)) {
      throw new Error("Scenario is not editable in its current status.");
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

    const equipmentState = await this.captureCurrentEquipmentState(input.characterId);
    const snapshotState = createParticipantSnapshotFromCharacter({
      build: character.build,
      equipmentState,
      retainedCharacterRevision: character.retainedRevision ?? undefined,
      sourceUpdatedAt: character.updatedAt,
    });
    snapshotState.snapshot.equipmentProjection = {
      aggregateRevision: equipmentState.revision,
      capturedAt: new Date().toISOString(),
      contractVersion: "scenario-equipment-projection/v1",
      fingerprint: fingerprintScenarioEquipment(equipmentState),
      provenance: {
        characterId: character.id,
        source: "character_equipment_aggregate",
      },
    };
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

  /**
   * Explicitly reconciles the current canonical Character into the Scenario-owned projection.
   *
   * Equipment is always reconciled, exactly as before Forgejo #1068: Item interactions refuse a
   * stale projection, so the GM must be able to reconcile it during a round.
   *
   * Since #1068 the refresh also copies the Character's build (stats and skills), so a GM edit or
   * a resolved Progression reaches combat — but never mid-round (Product Owner ruling 8). The
   * combat resolvers read `snapshot.build` live whenever they resolve; there is no separate frozen
   * per-round copy. So while an active Encounter that holds this participant has a round under
   * way (the same boundary the #850 roster freeze uses,
   * `encounterRosterChangeWaitsForRoundBoundary`), the build is left as it is and only equipment
   * is reconciled. Between rounds, before round 1, or with no active Encounter, the build is
   * copied too, and the GM refreshes again after round end to pick a mid-round edit up.
   */
  async refreshCharacterParticipantEquipmentSnapshot(input: {
    participantId: string;
    scenarioId: string;
  }): Promise<ScenarioParticipant> {
    const scenario = await this.repository.getScenarioById(input.scenarioId);

    if (!scenario) {
      throw new Error("Scenario not found.");
    }

    if (!canMutateScenarioInStatus(scenario.status)) {
      throw new Error("Scenario is not editable in its current status.");
    }

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

    const equipmentState = await this.captureCurrentEquipmentState(participant.characterId);
    const refreshed = createParticipantSnapshotFromCharacter({
      build: character.build,
      equipmentState,
      sourceUpdatedAt: character.updatedAt,
    });

    // Read narrowly, as the #850 deactivation check does: the question is only whether a running
    // Encounter holds this participant in a round under way, and a full session parse would let an
    // unrelated stored-session defect refuse an ordinary equipment reconcile. The round in force
    // lives in the split active combat state, or in the session for a legacy-storage Encounter.
    const activeEncounters = await this.client.encounter.findMany({
      select: { activeCombatState: { select: { stateJson: true } }, sessionJson: true },
      where: { scenarioId: input.scenarioId, status: "active" },
    });
    const roundUnderWay = activeEncounters.some((record) => {
      const session = record.sessionJson as {
        combatRoundState?: CombatRoundState;
        participantMembershipMode?: string;
        participants?: { id?: string; scenarioParticipantId?: string }[];
      } | null;
      if (!session || typeof session !== "object" || Array.isArray(session)) return false;
      const participants = Array.isArray(session.participants) ? session.participants : [];
      // An Encounter with no explicit roster holds every active Scenario participant.
      const holdsParticipant =
        session.participantMembershipMode !== "explicit" && participants.length === 0
          ? participant.isActive
          : participants.some(
              (row) => row.scenarioParticipantId === participant.id || row.id === participant.id,
            );
      const roundState = (record.activeCombatState?.stateJson ?? session.combatRoundState) as
        | CombatRoundState
        | null
        | undefined;
      return (
        holdsParticipant &&
        Array.isArray(roundState?.commands) &&
        encounterRosterChangeWaitsForRoundBoundary({
          combatRoundState: roundState ?? undefined,
          status: "active",
        })
      );
    });

    const capturedAt = new Date().toISOString();
    const fingerprint = fingerprintScenarioEquipment(equipmentState);
    const reconciled = await this.repository.updateScenarioParticipantSnapshotAndState(
      participant.id,
      {
        ...participant.snapshot,
        ...(roundUnderWay ? {} : { build: refreshed.snapshot.build }),
        equipmentProjection: {
          aggregateRevision: equipmentState.revision,
          capturedAt,
          contractVersion: "scenario-equipment-projection/v1",
          fingerprint,
          provenance: {
            characterId: participant.characterId,
            source: "character_equipment_aggregate",
          },
        },
        equipmentState: refreshed.snapshot.equipmentState,
        sourceUpdatedAt: refreshed.snapshot.sourceUpdatedAt,
      },
      {
        ...participant.state,
        equipment: refreshed.state.equipment,
      },
    );
    await this.repository.createScenarioEventLog({
      eventType: "equipment_reconciled",
      participantId: participant.id,
      payload: {
        aggregateRevision: equipmentState.revision,
        characterId: participant.characterId,
        fingerprint,
      },
      scenarioId: input.scenarioId,
      summary: `${participant.snapshot.displayName}’s equipment was reconciled for Scenario play.`,
    });
    return reconciled;
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
    const scenario = await this.repository.getScenarioById(input.scenarioId);

    if (!scenario) {
      throw new Error("Scenario not found.");
    }

    if (!canMutateScenarioInStatus(scenario.status)) {
      throw new Error("Scenario is not editable in its current status.");
    }

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
    const scenario = await this.repository.getScenarioById(input.scenarioId);

    if (!scenario) {
      throw new Error("Scenario not found.");
    }

    if (!canMutateScenarioInStatus(scenario.status)) {
      throw new Error("Scenario is not editable in its current status.");
    }

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

    // A deactivation runs Serializable against this Scenario's running Encounters (#845), so it can
    // exhaust its bounded retry and come back as a serialization conflict. Converted to the same
    // conflict error the Scenario's other Serializable writes already raise, so the route can answer
    // it `409` instead of flattening it into "Unable to update participant metadata."
    const participant = await (async () => {
      try {
        return await this.repository.updateScenarioParticipantMetadata(input);
      } catch (error) {
        if (error instanceof ScenarioPersistenceError) {
          throw new ScenarioMutationConflictError(error.code, error.message, error);
        }
        throw error;
      }
    })();

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

  /**
   * Explicitly revoke a Scenario participant's control assignment.
   *
   * This is deliberately **not** `updateScenarioParticipantMetadata`. Metadata updates are
   * gameplay edits and are correctly refused by `canMutateScenarioInStatus` outside `live`.
   * Revoking control is an **authorization withdrawal**, not a gameplay edit: the Product
   * Owner ruling on Forgejo #439 extends control-derived Character read access into
   * `completed` and `archived` Scenarios "unless the control relationship is explicitly
   * revoked", so revocation must stay reachable in exactly those read-only statuses.
   *
   * The only column written is `controlledByUserId`, and the only value written is `null`.
   * Nothing else about a read-only Scenario becomes mutable through this path: not
   * `isActive`, not `role`, not the snapshot, state, grouping or ordering, and no Character
   * or ownership field anywhere. The `ScenarioParticipant` row is preserved, so the
   * historical record that this Character took part in this Scenario survives.
   */
  async revokeScenarioParticipantControl(input: {
    participantId: string;
    scenarioId: string;
  }): Promise<ScenarioParticipant> {
    const scenario = await this.repository.getScenarioById(input.scenarioId);

    if (!scenario) {
      throw new Error("Scenario not found.");
    }

    const existingParticipant = await this.repository.getScenarioParticipantById(
      input.participantId,
      input.scenarioId,
    );

    if (!existingParticipant) {
      throw new Error("Scenario participant not found.");
    }

    if (existingParticipant.controlledByUserId == null) {
      return existingParticipant;
    }

    const revokedFromUserId = existingParticipant.controlledByUserId;
    const participant = await this.repository.revokeScenarioParticipantControl(input.participantId);

    await this.repository.createScenarioEventLog({
      eventType: "participant_control_revoked",
      participantId: participant.id,
      payload: {
        isActive: participant.isActive,
        revokedFromUserId,
        role: participant.role,
      },
      phase: scenario.liveState?.phase,
      roundNumber: scenario.liveState?.roundNumber,
      scenarioId: input.scenarioId,
      summary: `Revoked player control of ${participant.snapshot.displayName}.`,
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
