import type { AuthUser } from "@glantri/auth";
import { CharacterService, type CharacterEquipmentViewer } from "@glantri/database";
import { loadAccessibleCharacterInApi } from "../../lib/characterEditAccess";
import { NotFoundError } from "../../lib/errors";

const characterService = new CharacterService();

export function equipmentViewerForAccessibleCharacter(
  user: Pick<AuthUser, "roles">,
  characterId: string,
): CharacterEquipmentViewer {
  return user.roles.includes("admin") || user.roles.includes("game_master")
    ? { kind: "gm" }
    : { characterId, kind: "holder" };
}

export async function requireAccessibleCharacter(
  user: Pick<AuthUser, "id" | "roles">,
  characterId: string,
): Promise<CharacterEquipmentViewer> {
  const character = await loadAccessibleCharacterInApi({
    characterId,
    characterService,
    user,
  });

  if (!character) {
    throw new NotFoundError("Character not found.");
  }

  return equipmentViewerForAccessibleCharacter(user, characterId);
}
