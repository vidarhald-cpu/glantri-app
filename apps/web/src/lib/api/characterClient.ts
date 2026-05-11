import type { CharacterBuild } from "@glantri/domain";

import { sendJson } from "./apiClient";

export interface ServerCharacterRecord {
  build: CharacterBuild;
  createdAt: string;
  id: string;
  level: number;
  name: string;
  owner?:
    | {
        displayName?: string | null;
        email: string;
        id: string;
      }
    | null;
  ownerId?: string | null;
  updatedAt: string;
}

export async function saveCharacterToServer(build: CharacterBuild): Promise<ServerCharacterRecord> {
  const payload = await sendJson<{ character: ServerCharacterRecord }>("/characters", {
    body: JSON.stringify({ build }),
    method: "POST"
  });

  return payload.character;
}

export async function loadServerCharacters(): Promise<ServerCharacterRecord[]> {
  const payload = await sendJson<{ characters: ServerCharacterRecord[] }>("/characters", {
    method: "GET"
  });

  return payload.characters;
}

export async function loadMyServerCharacters(): Promise<ServerCharacterRecord[]> {
  return loadServerCharacters();
}

export async function loadServerCharacterById(characterId: string): Promise<ServerCharacterRecord> {
  const payload = await sendJson<{ character: ServerCharacterRecord }>(`/characters/${characterId}`, {
    method: "GET"
  });

  return payload.character;
}

export async function updateServerCharacter(input: {
  build: CharacterBuild;
  characterId: string;
}): Promise<ServerCharacterRecord> {
  const payload = await sendJson<{ character: ServerCharacterRecord }>(`/characters/${input.characterId}`, {
    body: JSON.stringify({
      build: input.build
    }),
    method: "PUT"
  });

  return payload.character;
}
