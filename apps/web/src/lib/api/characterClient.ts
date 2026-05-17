import type { CharacterBuild, CharacterRecord } from "@glantri/domain";

import { sendJson } from "./apiClient";

export type { CharacterRecord };
export type ServerCharacterRecord = CharacterRecord;

export async function saveCharacterToServer(build: CharacterBuild): Promise<CharacterRecord> {
  const payload = await sendJson<{ character: CharacterRecord }>("/characters", {
    body: JSON.stringify({ build }),
    method: "POST"
  });

  return payload.character;
}

export async function loadServerCharacters(): Promise<CharacterRecord[]> {
  const payload = await sendJson<{ characters: CharacterRecord[] }>("/characters", {
    method: "GET"
  });

  return payload.characters;
}

export async function loadMyServerCharacters(): Promise<CharacterRecord[]> {
  return loadServerCharacters();
}

export async function loadServerCharacterById(characterId: string): Promise<CharacterRecord> {
  const payload = await sendJson<{ character: CharacterRecord }>(`/characters/${characterId}`, {
    method: "GET"
  });

  return payload.character;
}

export async function updateServerCharacter(input: {
  build: CharacterBuild;
  characterId: string;
}): Promise<CharacterRecord> {
  const payload = await sendJson<{ character: CharacterRecord }>(`/characters/${input.characterId}`, {
    body: JSON.stringify({
      build: input.build
    }),
    method: "PUT"
  });

  return payload.character;
}
