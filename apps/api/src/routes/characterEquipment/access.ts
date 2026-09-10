import type { AuthUser } from "@glantri/auth";
import { CharacterService, type CharacterEquipmentViewer } from "@glantri/database";
import { NotFoundError } from "../../lib/errors";

const characterService = new CharacterService();

export function equipmentViewerForAccessibleCharacter(
  user: Pick<AuthUser, "roles">,
  characterId: string,
  hasCampaignGmAuthority: boolean,
): CharacterEquipmentViewer {
  return user.roles.includes("game_master") && hasCampaignGmAuthority
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
  const [ownedCharacter, campaignManagedCharacter] = await Promise.all([
    service.getOwnedCharacter(user.id, characterId),
    user.roles.includes("game_master")
      ? service.getCharacterByIdInGmCampaigns(user.id, characterId)
      : null,
  ]);

  if (!ownedCharacter && !campaignManagedCharacter) {
    throw new NotFoundError("Character not found.");
  }

  return equipmentViewerForAccessibleCharacter(
    user,
    characterId,
    campaignManagedCharacter !== null,
  );
}
