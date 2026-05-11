import type {
  ReusableEntity,
  ScenarioParticipantRole,
} from "@glantri/domain";

import type { ScenarioRepository } from "../repositories/scenarioRepository";
import { CharacterService } from "./characterService";

function isPlayerControlledParticipant(
  role: ScenarioParticipantRole,
  controlledByUserId?: string | null,
  isActive = true,
): boolean {
  return role === "player_character" && Boolean(controlledByUserId) && isActive;
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
    !isPlayerControlledParticipant(
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

  if (conflictingParticipant) {
    throw new Error(
      `${conflictingParticipant.snapshot.displayName} is already the active controlled character for this player in the scenario.`,
    );
  }
}

export async function userHasPlayerScenarioAccess(
  repository: ScenarioRepository,
  characterService: CharacterService,
  input: {
    scenarioId: string;
    userId: string;
  },
): Promise<boolean> {
  const participants = await repository.listScenarioParticipants(input.scenarioId);

  for (const participant of participants) {
    if (!participant.isActive || participant.role !== "player_character") {
      continue;
    }

    if (participant.controlledByUserId === input.userId) {
      return true;
    }

    if (!participant.characterId) {
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
    return repository.getReusableEntityById(input.entityId);
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
