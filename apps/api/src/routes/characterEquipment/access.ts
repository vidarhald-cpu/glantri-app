import type { AuthUser } from "@glantri/auth";
import { CharacterService, type CharacterEquipmentViewer } from "@glantri/database";
import { loadAccessibleCharacterInApi } from "../../lib/characterEditAccess";
import { NotFoundError } from "../../lib/errors";

const characterService = new CharacterService();

export function equipmentViewerForAccessibleCharacter(
  user: Pick<AuthUser, "roles">,
  characterId: string,
  hasCampaignGmAuthority: boolean,
): CharacterEquipmentViewer {
  return user.roles.includes("admin") ||
    (user.roles.includes("game_master") && hasCampaignGmAuthority)
    ? { kind: "gm" }
    : { characterId, kind: "holder" };
}

export async function requireAccessibleCharacter(
  user: Pick<AuthUser, "id" | "roles">,
  characterId: string,
  service: Pick<
    CharacterService,
    "getCharacterById" | "getCharacterByIdInGmCampaigns" | "getOwnedCharacter"
  > = characterService,
): Promise<CharacterEquipmentViewer> {
  const [character, campaignManagedCharacter] = await Promise.all([
    loadAccessibleCharacterInApi({
      characterId,
      characterService: service,
      user,
    }),
    user.roles.includes("game_master") && !user.roles.includes("admin")
      ? service.getCharacterByIdInGmCampaigns(user.id, characterId)
      : null,
  ]);

  if (!character) {
    throw new NotFoundError("Character not found.");
  }

  return equipmentViewerForAccessibleCharacter(
    user,
    characterId,
    campaignManagedCharacter !== null,
  );
}
