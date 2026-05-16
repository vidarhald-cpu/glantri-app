import type { EncounterSession, ScenarioParticipant } from "@glantri/domain";

import { getScenarioParticipantFallbackEncounterParticipants } from "./encounterParticipantFallback";

export interface CharacterWorkspaceCandidate {
  characterId: string;
  id: string;
  label: string;
  scenarioParticipant: ScenarioParticipant;
}

function getParticipantLabel(participant: ScenarioParticipant): string {
  return participant.snapshot.displayName || participant.id;
}

function isActiveCharacterParticipant(
  participant: ScenarioParticipant | undefined,
): participant is ScenarioParticipant & { characterId: string } {
  return Boolean(
    participant?.isActive &&
      participant.characterId &&
      participant.sourceType === "character",
  );
}

function toCandidate(
  participant: ScenarioParticipant | undefined,
): CharacterWorkspaceCandidate | undefined {
  if (!isActiveCharacterParticipant(participant)) {
    return undefined;
  }

  return {
    characterId: participant.characterId,
    id: participant.id,
    label: getParticipantLabel(participant),
    scenarioParticipant: participant,
  };
}

function uniqueCandidates(
  candidates: Array<CharacterWorkspaceCandidate | undefined>,
): CharacterWorkspaceCandidate[] {
  const seen = new Set<string>();
  const unique: CharacterWorkspaceCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate.id)) {
      continue;
    }

    seen.add(candidate.id);
    unique.push(candidate);
  }

  return unique.sort(
    (left, right) =>
      (left.scenarioParticipant.displayOrder ?? 0) -
        (right.scenarioParticipant.displayOrder ?? 0) ||
      left.label.localeCompare(right.label),
  );
}

function findScenarioParticipantForEncounterParticipant(input: {
  characterId?: string;
  scenarioParticipantId?: string;
  scenarioParticipants: ScenarioParticipant[];
}): ScenarioParticipant | undefined {
  if (input.scenarioParticipantId) {
    const scenarioParticipant = input.scenarioParticipants.find(
      (participant) => participant.id === input.scenarioParticipantId,
    );

    if (scenarioParticipant) {
      return scenarioParticipant;
    }
  }

  if (input.characterId) {
    return input.scenarioParticipants.find(
      (participant) => participant.characterId === input.characterId,
    );
  }

  return undefined;
}

export function buildGmCharacterWorkspaceCandidates(input: {
  activeEncounter?: EncounterSession;
  scenarioId?: string;
  scenarioParticipants: ScenarioParticipant[];
}): CharacterWorkspaceCandidate[] {
  if (input.activeEncounter) {
    return uniqueCandidates(
      getScenarioParticipantFallbackEncounterParticipants({
        encounter: input.activeEncounter,
        scenarioParticipants: input.scenarioParticipants,
      }).map((participant) =>
        toCandidate(
          findScenarioParticipantForEncounterParticipant({
            characterId: participant.characterId,
            scenarioParticipantId: participant.scenarioParticipantId,
            scenarioParticipants: input.scenarioParticipants,
          }),
        ),
      ),
    );
  }

  return uniqueCandidates(
    input.scenarioParticipants
      .filter((participant) => !input.scenarioId || participant.scenarioId === input.scenarioId)
      .map((participant) => toCandidate(participant)),
  );
}

export function resolvePlayerCharacterWorkspaceCandidate(input: {
  activeEncounter?: EncounterSession;
  scenarioId?: string;
  scenarioParticipants: ScenarioParticipant[];
  userId?: string | null;
}): CharacterWorkspaceCandidate | undefined {
  if (!input.userId) {
    return undefined;
  }

  const controlledParticipants = input.scenarioParticipants.filter(
    (participant) =>
      participant.controlledByUserId === input.userId &&
      participant.role === "player_character" &&
      isActiveCharacterParticipant(participant) &&
      (!input.scenarioId || participant.scenarioId === input.scenarioId),
  );

  if (input.activeEncounter) {
    const effectiveEncounterParticipants = getScenarioParticipantFallbackEncounterParticipants({
      encounter: input.activeEncounter,
      scenarioParticipants: input.scenarioParticipants,
    });
    const controlledIds = new Set(controlledParticipants.map((participant) => participant.id));
    const controlledCharacterIds = new Set(
      controlledParticipants.map((participant) => participant.characterId),
    );
    const encounterControlledParticipant = effectiveEncounterParticipants.find(
      (participant) =>
        (participant.scenarioParticipantId &&
          controlledIds.has(participant.scenarioParticipantId)) ||
        (participant.characterId && controlledCharacterIds.has(participant.characterId)),
    );

    if (!encounterControlledParticipant) {
      return undefined;
    }

    return toCandidate(
      findScenarioParticipantForEncounterParticipant({
        characterId: encounterControlledParticipant.characterId,
        scenarioParticipantId: encounterControlledParticipant.scenarioParticipantId,
        scenarioParticipants: controlledParticipants,
      }),
    );
  }

  return toCandidate(controlledParticipants[0]);
}
