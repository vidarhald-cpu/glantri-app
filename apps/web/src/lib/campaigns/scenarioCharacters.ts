import type { ScenarioParticipant } from "@glantri/domain";

import type { ServerCharacterRecord } from "../api/localServiceClient";

export function getAvailableScenarioCharacters(input: {
  characters: ServerCharacterRecord[];
  participants: ScenarioParticipant[];
}): ServerCharacterRecord[] {
  const assignedCharacterIds = new Set(
    input.participants
      .map((participant) => participant.characterId)
      .filter((characterId): characterId is string => Boolean(characterId)),
  );

  return [...input.characters]
    .filter((character) => !assignedCharacterIds.has(character.id))
    .sort((left, right) => {
      const leftName = left.build.name.trim() || left.name.trim();
      const rightName = right.build.name.trim() || right.name.trim();
      return leftName.localeCompare(rightName);
    });
}

export function getScenarioCharacterDefaultControllerId(input: {
  character: ServerCharacterRecord | null | undefined;
  fallbackUserId?: string;
}): string {
  return input.character?.ownerId ?? input.fallbackUserId ?? "";
}
