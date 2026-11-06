import type { ReusableEntity, ScenarioParticipantRole } from "@glantri/domain";

import type { ScenarioRepository } from "../repositories/scenarioRepository";
import { CharacterService } from "./characterService";

/**
 * Does this assignment fall inside the one-controlled-Character invariant's subject set?
 *
 * This answers only "is this an active, controlled `player_character` assignment". It does
 * **not** answer "is the controller a player": nothing synchronous can, because that needs the
 * Scenario's Campaign. The GM question is asked separately by
 * {@link resolveScenarioGameMasterUserId}, so this predicate is deliberately named for the
 * narrow property it actually tests.
 */
function isControlledPlayerCharacterAssignment(
  role: ScenarioParticipantRole,
  controlledByUserId?: string | null,
  isActive = true,
): boolean {
  return role === "player_character" && Boolean(controlledByUserId) && isActive;
}

/**
 * The single definition of "the GM" for the controller-conflict rule.
 *
 * Product Owner ruling, Forgejo issue #786 comment 18040, verbatim:
 *
 * > The one-controlled-Character invariant applies only to player-controlled PC assignments.
 * > It does not limit GM authority: the GM may control multiple Characters/participants in the
 * > same Scenario.
 *
 * A user is the GM of a Scenario when, and only when, they are `Campaign.gmUserId` on the
 * Campaign that owns that Scenario. Application roles are deliberately **not** consulted:
 * Scenario authority in this product is per-Campaign, so an `admin` or `game_master` role
 * holder who is not this Campaign's GM holds no GM authority here — the API add path already
 * answers `404` for exactly that case (`participantRoutes.ts`, `campaign.gmUserId !== user.id`).
 *
 * The resolution **fails closed**: a Scenario or Campaign that cannot be read returns `null`,
 * no exemption is granted, and the invariant applies as before.
 *
 * Exported so that every evaluation of the invariant consumes this one definition rather than
 * carrying its own predicate.
 */
export async function resolveScenarioGameMasterUserId(
  repository: ScenarioRepository,
  scenarioId: string,
): Promise<string | null> {
  const scenario = await repository.getScenarioById(scenarioId);

  if (!scenario) {
    return null;
  }

  const campaign = await repository.getCampaignById(scenario.campaignId);

  return campaign?.gmUserId ?? null;
}

export async function assertControllerAssignmentAvailable(
  repository: ScenarioRepository,
  input: {
    controlledByUserId?: string | null;
    excludingParticipantId?: string;
    isActive?: boolean;
    role: ScenarioParticipantRole;
    scenarioId: string;
  },
): Promise<void> {
  if (
    !isControlledPlayerCharacterAssignment(
      input.role,
      input.controlledByUserId ?? null,
      input.isActive ?? true,
    )
  ) {
    return;
  }

  const participants = await repository.listScenarioParticipants(input.scenarioId);
  const conflictingParticipant = participants.find(
    (participant) =>
      participant.id !== input.excludingParticipantId &&
      participant.isActive &&
      participant.role === "player_character" &&
      participant.controlledByUserId === input.controlledByUserId,
  );

  if (!conflictingParticipant) {
    return;
  }

  // Only the refusal branch needs to know who the GM is, so the exemption adds no round trip
  // to the path that goes on to write. This ordering is load-bearing for the non-transactional
  // check-then-write window recorded as Forgejo #805: the gap between this check and the
  // caller's insert is unchanged by this repair.
  const gameMasterUserId = await resolveScenarioGameMasterUserId(repository, input.scenarioId);

  if (gameMasterUserId != null && input.controlledByUserId === gameMasterUserId) {
    return;
  }

  throw new Error(
    `${conflictingParticipant.snapshot.displayName} is already the active controlled character for this player in the scenario. A player may control only one Character per Scenario.`,
  );
}

export async function userHasPlayerScenarioAccess(
  repository: ScenarioRepository,
  characterService: CharacterService,
  input: {
    scenarioId: string;
    userId: string;
  },
): Promise<boolean> {
  const scenario = await repository.getScenarioById(input.scenarioId);

  if (!scenario) {
    return false;
  }

  const rosterEntries = await repository.listCampaignRosterEntries(scenario.campaignId);
  const rosterCharacterIds = new Set(
    rosterEntries
      .filter((entry) => entry.sourceType === "character")
      .map((entry) => entry.sourceId),
  );
  const participants = await repository.listScenarioParticipants(input.scenarioId);

  for (const participant of participants) {
    if (!participant.isActive || participant.role !== "player_character") {
      continue;
    }

    if (!participant.characterId || !rosterCharacterIds.has(participant.characterId)) {
      continue;
    }

    if (participant.controlledByUserId === input.userId) {
      return true;
    }

    if (participant.controlledByUserId != null || !participant.characterId) {
      continue;
    }

    const character = await characterService.getCharacterById(participant.characterId);

    if (character?.ownerId === input.userId) {
      return true;
    }
  }

  return false;
}

export async function resolveEntityParticipantSource(
  repository: ScenarioRepository,
  input: {
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
  },
): Promise<ReusableEntity | null> {
  if (input.entityId != null) {
    const entity = await repository.getReusableEntityById(input.entityId);

    if (entity && input.expectedGmUserId && entity.gmUserId !== input.expectedGmUserId) {
      return null;
    }

    return entity;
  }

  if (!input.entityInput) {
    return null;
  }

  if (input.isTemporary) {
    return {
      createdAt: new Date().toISOString(),
      description: input.entityInput.description,
      gmUserId: input.entityInput.gmUserId,
      id: "",
      kind: input.entityInput.kind,
      name: input.entityInput.name,
      notes: input.entityInput.notes,
      snapshot: input.entityInput.snapshot,
      updatedAt: new Date().toISOString(),
    };
  }

  return repository.createReusableEntity({
    description: input.entityInput.description ?? null,
    gmUserId: input.entityInput.gmUserId,
    kind: input.entityInput.kind,
    name: input.entityInput.name.trim(),
    notes: input.entityInput.notes ?? null,
    snapshot: input.entityInput.snapshot,
  });
}
