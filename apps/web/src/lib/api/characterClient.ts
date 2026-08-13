import type { CharacterBuild, CharacterRecord } from "@glantri/domain";

import { ApiRequestError, sendJson } from "./apiClient";

export type { CharacterRecord };
export type ServerCharacterRecord = CharacterRecord;

export function getCurrentCharacterFromMutationConflict(
  error: unknown,
): CharacterRecord | undefined {
  if (!(error instanceof ApiRequestError) || error.status !== 409) {
    return undefined;
  }

  const currentCharacter = (error.payload as { currentCharacter?: unknown } | undefined)
    ?.currentCharacter;

  if (
    !currentCharacter ||
    typeof currentCharacter !== "object" ||
    !("build" in currentCharacter) ||
    typeof (currentCharacter as { id?: unknown }).id !== "string" ||
    typeof (currentCharacter as { updatedAt?: unknown }).updatedAt !== "string"
  ) {
    return undefined;
  }

  return currentCharacter as CharacterRecord;
}

export async function saveCharacterToServer(build: CharacterBuild): Promise<CharacterRecord> {
  const payload = await sendJson<{ character: CharacterRecord }>("/characters", {
    body: JSON.stringify({ build }),
    method: "POST",
  });

  return payload.character;
}

export async function loadServerCharacters(): Promise<CharacterRecord[]> {
  const payload = await sendJson<{ characters: CharacterRecord[] }>("/characters", {
    method: "GET",
  });

  return payload.characters;
}

export async function loadMyServerCharacters(): Promise<CharacterRecord[]> {
  return loadServerCharacters();
}

export async function loadServerCharacterById(characterId: string): Promise<CharacterRecord> {
  const payload = await sendJson<{ character: CharacterRecord }>(`/characters/${characterId}`, {
    method: "GET",
  });

  return payload.character;
}

export async function updateServerCharacter(input: {
  build: CharacterBuild;
  characterId: string;
  expectedUpdatedAt: string;
}): Promise<CharacterRecord> {
  const payload = await sendJson<{ character: CharacterRecord }>(
    `/characters/${input.characterId}`,
    {
      body: JSON.stringify({
        build: input.build,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
      method: "PUT",
    },
  );

  return payload.character;
}

export async function deleteServerCharacter(input: {
  characterId: string;
  expectedUpdatedAt: string;
}): Promise<void> {
  await sendJson<void>(`/characters/${input.characterId}`, {
    body: JSON.stringify({ expectedUpdatedAt: input.expectedUpdatedAt }),
    method: "DELETE",
  });
}
