import type { EncounterSession, ScenarioParticipant } from "@glantri/domain";

import { getScenarioParticipantFallbackEncounterParticipants } from "./encounterParticipantFallback";

export interface CharacterWorkspaceCandidate {
  characterId: string;
  id: string;
  label: string;
  scenarioParticipant: ScenarioParticipant;
}

/**
 * GM-only Character-screen candidate (#1118). Like `CharacterWorkspaceCandidate`, but
 * `characterId` is absent for an active participant without a Character record, such as
 * a generated NPC. Never build these for a player.
 */
export type GmCharacterScreenCandidate = Omit<CharacterWorkspaceCandidate, "characterId"> & {
  characterId?: string;
};

function getParticipantLabel(participant: ScenarioParticipant): string {
  return participant.snapshot.displayName || participant.id;
}

function isActiveCharacterParticipant(
  participant: ScenarioParticipant | undefined,
): participant is ScenarioParticipant & { characterId: string } {
  return Boolean(
    participant?.isActive && participant.characterId && participant.sourceType === "character",
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

function toGmCharacterScreenCandidate(
  participant: ScenarioParticipant | undefined,
): GmCharacterScreenCandidate | undefined {
  if (!participant?.isActive) {
    return undefined;
  }

  return (
    toCandidate(participant) ?? {
      id: participant.id,
      label: getParticipantLabel(participant),
      scenarioParticipant: participant,
    }
  );
}

function uniqueCandidates<Candidate extends GmCharacterScreenCandidate>(
  candidates: Array<Candidate | undefined>,
): Candidate[] {
  const seen = new Set<string>();
  const unique: Candidate[] = [];

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
        (right.scenarioParticipant.displayOrder ?? 0) || left.label.localeCompare(right.label),
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

function buildGmCandidates<Candidate extends GmCharacterScreenCandidate>(
  input: {
    activeEncounter?: EncounterSession;
    scenarioId?: string;
    scenarioParticipants: ScenarioParticipant[];
  },
  toEntry: (participant: ScenarioParticipant | undefined) => Candidate | undefined,
): Candidate[] {
  if (input.activeEncounter) {
    return uniqueCandidates(
      getScenarioParticipantFallbackEncounterParticipants({
        encounter: input.activeEncounter,
        scenarioParticipants: input.scenarioParticipants,
      }).map((participant) =>
        toEntry(
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
      .map((participant) => toEntry(participant)),
  );
}

export function buildGmCharacterWorkspaceCandidates(input: {
  activeEncounter?: EncounterSession;
  scenarioId?: string;
  scenarioParticipants: ScenarioParticipant[];
}): CharacterWorkspaceCandidate[] {
  return buildGmCandidates(input, toCandidate);
}

/**
 * GM-only candidates for the Encounter Character screen (#1118): every active participant,
 * including generated NPCs without a Character record. The shared Character predicate and
 * the player resolver are deliberately unchanged.
 */
export function buildGmCharacterScreenCandidates(input: {
  activeEncounter?: EncounterSession;
  scenarioId?: string;
  scenarioParticipants: ScenarioParticipant[];
}): GmCharacterScreenCandidate[] {
  return buildGmCandidates(input, toGmCharacterScreenCandidate);
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
