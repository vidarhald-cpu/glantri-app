import type { AuthUser } from "@glantri/auth";

export function canEditCharacterInApi(user: Pick<AuthUser, "roles">): boolean {
  return user.roles.includes("game_master") || user.roles.includes("admin");
}

export async function loadAccessibleCharacterInApi<TCharacter>(input: {
  characterId: string;
  characterService: {
    getCharacterById(characterId: string): Promise<TCharacter | null>;
    getCharacterByIdInGmCampaigns(gmUserId: string, characterId: string): Promise<TCharacter | null>;
    getOwnedCharacter(ownerId: string, characterId: string): Promise<TCharacter | null>;
  };
  user: Pick<AuthUser, "id" | "roles">;
}): Promise<TCharacter | null> {
  if (input.user.roles.includes("admin")) {
    return input.characterService.getCharacterById(input.characterId);
  }
  if (input.user.roles.includes("game_master")) {
    return input.characterService.getCharacterByIdInGmCampaigns(input.user.id, input.characterId);
  }
  return input.characterService.getOwnedCharacter(input.user.id, input.characterId);
}
