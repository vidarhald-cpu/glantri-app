import type { AuthUser } from "@glantri/auth";
import { CharacterService } from "@glantri/database";
import { loadAccessibleCharacterInApi } from "../../lib/characterEditAccess";

const characterService = new CharacterService();

export async function requireAccessibleCharacter(
  user: Pick<AuthUser, "id" | "roles">,
  characterId: string
) {
  const character = await loadAccessibleCharacterInApi({
    characterId,
    characterService,
    user,
  });

  if (!character) {
    throw new Error("Character not found.");
  }
}
