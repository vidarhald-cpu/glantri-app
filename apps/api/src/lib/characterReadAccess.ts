import type { AuthUser } from "@glantri/auth";
import type { CharacterProvenancePerspective } from "@glantri/domain";

import { loadAccessibleCharacterInApi } from "./characterEditAccess";

/**
 * Read authorization for the player-facing Character surface.
 *
 * Product Owner ruling on Forgejo #439: a player who has **current authorized control** of a
 * Character must be able to read that Character's player-facing sheet and Character-owned
 * equipment information even when the player is not the Character's owner — including when
 * `ownerId` is `null`. Read authorization is therefore satisfied by
 * `ownership OR current authorized control`.
 *
 * This module is deliberately separate from `characterEditAccess`. That helper gates writes
 * (`PUT /characters/:id`, `DELETE /characters/:id`) as well as reads, and control must never
 * widen write authority. Nothing here is reachable from a mutating route.
 */

/** How a read was authorized. Drives the information projection the caller may return. */
export type CharacterReadGrant = "admin" | "campaign_gm" | "character_controller" | "owner";

/**
 * Retained-Character provenance perspective for each read grant.
 *
 * A controller who is neither owner, campaign GM nor admin reads as `entitled_player`: a
 * summary-only projection with no provenance events. Control must never open the
 * `current_campaign_gm` full-provenance projection.
 */
export const READ_GRANT_PROVENANCE_PERSPECTIVE = {
  admin: "admin",
  campaign_gm: "current_campaign_gm",
  character_controller: "entitled_player",
  owner: "owner",
} as const satisfies Record<CharacterReadGrant, CharacterProvenancePerspective>;

export interface ReadableCharacterAccess<TCharacter> {
  character: TCharacter;
  grant: CharacterReadGrant;
}

export async function loadReadableCharacterInApi<
  TCharacter extends { ownerId?: string | null },
>(input: {
  characterId: string;
  characterService: {
    getCharacterById(characterId: string): Promise<TCharacter | null>;
    getCharacterByIdInGmCampaigns(
      gmUserId: string,
      characterId: string,
    ): Promise<TCharacter | null>;
    getCharacterUnderPlayerControl(
      controllerUserId: string,
      characterId: string,
    ): Promise<TCharacter | null>;
    getOwnedCharacter(ownerId: string, characterId: string): Promise<TCharacter | null>;
  };
  user: Pick<AuthUser, "id" | "roles">;
}): Promise<ReadableCharacterAccess<TCharacter> | null> {
  const accessibleCharacter = await loadAccessibleCharacterInApi(input);

  if (accessibleCharacter) {
    return {
      character: accessibleCharacter,
      grant: input.user.roles.includes("admin")
        ? "admin"
        : accessibleCharacter.ownerId === input.user.id
          ? "owner"
          : "campaign_gm",
    };
  }

  const controlledCharacter = await input.characterService.getCharacterUnderPlayerControl(
    input.user.id,
    input.characterId,
  );

  return controlledCharacter
    ? { character: controlledCharacter, grant: "character_controller" }
    : null;
}

/**
 * Project a Character record for the grant that authorized the read.
 *
 * A controller is entitled to the Character, not to the owner's account identity, so the
 * expanded owner block (display name and email) is stripped for that grant only. Every other
 * grant is returned unchanged.
 */
export function projectCharacterForReadGrant<TCharacter extends { owner?: unknown }>(
  character: TCharacter,
  grant: CharacterReadGrant,
): TCharacter {
  return grant === "character_controller" ? { ...character, owner: null } : character;
}
