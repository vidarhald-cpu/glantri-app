import type { AuthUser } from "@glantri/auth";

export function canShowClaimGameMasterAction(options: {
  bootstrapAvailable: boolean;
  currentUser: AuthUser | null;
}): boolean {
  if (!options.bootstrapAvailable || !options.currentUser) {
    return false;
  }

  return !options.currentUser.roles.includes("admin") && !options.currentUser.roles.includes("game_master");
}
