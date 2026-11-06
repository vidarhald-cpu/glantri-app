import { isCampaignGameMaster } from "@glantri/auth";
import type { ReusableEntity, ScenarioParticipantRole } from "@glantri/domain";

import type { ScenarioRepository } from "../repositories/scenarioRepository";
import { CharacterService } from "./characterService";

/**
 * Does this assignment fall inside the one-controlled-Character invariant's subject set?
 *
 * This answers only "is this an active, controlled `player_character` assignment". It does
 * **not** answer "is the controller a player": nothing synchronous can, because that needs the
 * Scenario's Campaign. The GM question is asked separately by
 * {@link isScenarioGameMaster}, so this predicate is deliberately named for the narrow property
 * it actually tests.
 */
function isControlledPlayerCharacterAssignment(
  role: ScenarioParticipantRole,
  controlledByUserId?: string | null,
  isActive = true,
): boolean {
  return role === "player_character" && Boolean(controlledByUserId) && isActive;
}

/**
 * Is this user the GM of this Scenario, for the controller-conflict rule?
 *
 * Product Owner ruling, Forgejo issue #977, 2026-11-06, verbatim:
 *
 * > use the same GM predicate everywhere — Campaign.gmUserId and current game_master role. A
 * > demoted account loses GM exemptions.
 *
 * Both halves are required, so the subject set of the exemption is exactly the set the Scenario
 * workspace gate (`apps/api/src/routes/scenarios/access.ts`) already treats as GMs. Both sites
 * evaluate the one pure predicate `isCampaignGameMaster`; only the source of the role set
 * differs, because the gate asks about its own caller while this asks about whichever user is
 * being assigned as controller.
 *
 * This **replaces** `resolveScenarioGameMasterUserId`, which resolved the exemption from
 * `Campaign.gmUserId` alone and carried a doc comment stating that "application roles are
 * deliberately not consulted". That earlier decision is superseded by the ruling above. Its
 * stated justification — that consulting roles is unnecessary because the add path already
 * answers `404` when `campaign.gmUserId !== user.id` — was measured to be incomplete: the
 * **player self-add branch** of `POST /scenarios/:id/participants/character` never reaches that
 * check, because the check is itself guarded by the caller's role. A Campaign owner demoted to
 * `player` therefore self-added three controlled Characters for `[200, 200, 200]` (issue #977).
 *
 * The half of the #786 ruling that still stands, and is load-bearing for the Alpha session:
 *
 * > The one-controlled-Character invariant applies only to player-controlled PC assignments.
 * > It does not limit GM authority: the GM may control multiple Characters/participants in the
 * > same Scenario.
 *
 * A Campaign GM who holds `game_master` keeps that authority unchanged. What narrowed is only
 * who counts as that GM.
 *
 * The resolution **fails closed** at every step: an unreadable Scenario, Campaign or user
 * yields `false`, no exemption is granted, and the invariant applies as it does to a player.
 *
 * Exported so that every evaluation of the invariant consumes this one definition rather than
 * carrying its own predicate.
 */
export async function isScenarioGameMaster(
  repository: ScenarioRepository,
  input: {
    scenarioId: string;
    userId: string;
  },
): Promise<boolean> {
  const scenario = await repository.getScenarioById(input.scenarioId);

  if (!scenario) {
    return false;
  }

  const campaign = await repository.getCampaignById(scenario.campaignId);

  if (!campaign) {
    return false;
  }

  // Neither half of the predicate is decided here. `isCampaignGameMaster` owns both, so the
  // role read happens even for a candidate who is plainly not the Campaign owner: one indexed
  // lookup on a path that is already in the refusal branch of a conflict, in exchange for
  // there being exactly one place where the two halves are combined.
  const userRoles = await repository.listUserAuthRoles(input.userId);

  return isCampaignGameMaster({
    campaignGmUserId: campaign.gmUserId,
    userId: input.userId,
    userRoles,
  });
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
  if (
    input.controlledByUserId != null &&
    (await isScenarioGameMaster(repository, {
      scenarioId: input.scenarioId,
      userId: input.controlledByUserId,
    }))
  ) {
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
