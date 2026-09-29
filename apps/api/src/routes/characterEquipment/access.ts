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

/**
 * Read gate for Character-owned equipment.
 *
 * Product Owner ruling on Forgejo #439: ownership OR current authorized control authorizes the
 * player-facing Character surface, and Character-owned equipment information is part of it.
 * Control resolves to the ordinary `holder` viewer — the player-facing equipment projection —
 * never to the `gm` viewer.
 *
 * Deliberately separate from `requireAccessibleCharacter`, which gates the equipment **write**
 * routes as well. Control must not widen write authority, so that helper is unchanged.
 */
export async function requireReadableCharacter(
  user: Pick<AuthUser, "id" | "roles">,
  characterId: string,
  service: Pick<
    CharacterService,
    "getCharacterByIdInGmCampaigns" | "getCharacterUnderPlayerControl" | "getOwnedCharacter"
  > = characterService,
): Promise<CharacterEquipmentViewer> {
  const [ownedCharacter, campaignManagedCharacter] = await Promise.all([
    service.getOwnedCharacter(user.id, characterId),
    user.roles.includes("game_master")
      ? service.getCharacterByIdInGmCampaigns(user.id, characterId)
      : null,
  ]);

  if (ownedCharacter || campaignManagedCharacter) {
    return equipmentViewerForAccessibleCharacter(
      user,
      characterId,
      campaignManagedCharacter !== null,
    );
  }

  const controlledCharacter = await service.getCharacterUnderPlayerControl(user.id, characterId);

  if (!controlledCharacter) {
    throw new NotFoundError("Character not found.");
  }

  return { characterId, kind: "holder" };
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
