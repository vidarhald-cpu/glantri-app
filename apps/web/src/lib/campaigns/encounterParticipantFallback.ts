import type { EncounterParticipant, EncounterSession, ScenarioParticipant } from "@glantri/domain";

export function getScenarioParticipantFallbackEncounterParticipants(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
}): EncounterParticipant[] {
  if (input.encounter.participants.length > 0) {
    return input.encounter.participants;
  }

  return input.scenarioParticipants
    .filter((participant) => participant.scenarioId === input.encounter.scenarioId)
    .filter((participant) => participant.isActive)
    .map((participant, index) => ({
      declaration: {
        actionType: "none",
        defenseFocus: "none",
        defensePosture: "none",
        targetLocation: "any",
      },
      facing: "north",
      id: `scenario-fallback-${participant.id}`,
      initiative: 0,
      label: participant.snapshot.displayName,
      order: participant.displayOrder ?? index,
      orientation: "neutral",
      participantType: "scenario",
      position: {
        x: 0,
        y: 0,
        zone: "center",
      },
      scenarioParticipantId: participant.id,
    }));
}

export function formatEncounterParticipantCountLabel(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
}): string {
  if (input.encounter.participants.length > 0) {
    return String(input.encounter.participants.length);
  }

  const fallbackCount = getScenarioParticipantFallbackEncounterParticipants(input).length;
  return `${fallbackCount} active scenario participants (default)`;
}

export function isUserAssignedToEffectiveEncounter(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
  userId?: string | null;
}): boolean {
  if (!input.userId || input.encounter.status === "archived") {
    return false;
  }

  const controlledScenarioParticipants = input.scenarioParticipants.filter(
    (participant) =>
      participant.isActive &&
      participant.role === "player_character" &&
      participant.controlledByUserId === input.userId
  );
  const controlledScenarioParticipantIds = new Set(
    controlledScenarioParticipants.map((participant) => participant.id)
  );
  const controlledCharacterIds = new Set(
    controlledScenarioParticipants
      .map((participant) => participant.characterId)
      .filter((characterId): characterId is string => Boolean(characterId))
  );
  const effectiveParticipants = getScenarioParticipantFallbackEncounterParticipants({
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
  });

  return effectiveParticipants.some(
    (participant) =>
      (participant.scenarioParticipantId &&
        controlledScenarioParticipantIds.has(participant.scenarioParticipantId)) ||
      (participant.characterId && controlledCharacterIds.has(participant.characterId))
  );
}
