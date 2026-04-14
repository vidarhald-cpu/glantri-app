import type { AuthUser } from "@glantri/auth";

export function canEditCharacterInApi(user: Pick<AuthUser, "roles">): boolean {
  return user.roles.includes("game_master");
}
