import type { AuthUser } from "@glantri/auth";

export function canEditCharacterInApi(user: Pick<AuthUser, "roles">): boolean {
  return user.roles.includes("game_master") || user.roles.includes("admin");
}

export async function loadAccessibleCharacterInApi<TCharacter>(input: {
  characterId: string;
  characterService: {
    getCharacterById(characterId: string): Promise<TCharacter | null>;
    getOwnedCharacter(ownerId: string, characterId: string): Promise<TCharacter | null>;
  };
  user: Pick<AuthUser, "id" | "roles">;
}): Promise<TCharacter | null> {
  return canEditCharacterInApi(input.user)
    ? input.characterService.getCharacterById(input.characterId)
    : input.characterService.getOwnedCharacter(input.user.id, input.characterId);
}
