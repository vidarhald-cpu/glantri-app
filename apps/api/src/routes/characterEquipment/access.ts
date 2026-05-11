import type { AuthUser } from "@glantri/auth";
import { CharacterService } from "@glantri/database";
import { loadAccessibleCharacterInApi } from "../../lib/characterEditAccess";
import { NotFoundError } from "../../lib/errors";

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
    throw new NotFoundError("Character not found.");
  }
}
