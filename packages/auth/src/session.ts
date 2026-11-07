import type { AuthRole } from "./roles";

export function hasRole(userRoles: AuthRole[], requiredRole: AuthRole): boolean {
  return userRoles.includes(requiredRole);
}

export function hasAnyRole(userRoles: AuthRole[], requiredRoles: AuthRole[]): boolean {
  return requiredRoles.some((role) => hasRole(userRoles, role));
}

export function canAccessAdmin(userRoles: AuthRole[]): boolean {
  return hasAnyRole(userRoles, ["admin", "game_master"]);
}

export function isAdmin(userRoles: AuthRole[]): boolean {
  return hasRole(userRoles, "admin");
}

export function getPrimaryRole(userRoles: AuthRole[]): AuthRole {
  if (hasRole(userRoles, "admin")) {
    return "admin";
  }

  if (hasRole(userRoles, "game_master")) {
    return "game_master";
  }

  return "player";
}

export function formatAuthRoleLabel(role: AuthRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "game_master":
      return "GM";
    default:
      return "Player";
  }
}

/**
 * The single definition of "is this user the Game Master here".
 *
 * Product Owner ruling, Forgejo issue #977, 2026-11-06, verbatim:
 *
 * > use the same GM predicate everywhere — Campaign.gmUserId and current game_master role. A
 * > demoted account loses GM exemptions.
 *
 * Both halves are required, and the role half is read **at the time of the check** rather than
 * inherited from having once held it. The predicate therefore narrows: a Campaign owner who
 * does not currently hold `game_master` — because they were demoted, or because they created
 * the Campaign with `admin` alone — is not the GM anywhere.
 *
 * It is a pure function so that the two sites which resolve GM authority from different role
 * sources can still share one definition: the Scenario workspace gate reads the caller's own
 * session roles, while the controller-conflict exemption reads the stored roles of an
 * arbitrary candidate user who need not be the caller.
 *
 * `userRoles` is the **normalized** role set. Stored role rows may still carry the legacy name
 * `gm`, which `normalizeStoredAuthRole` maps to `game_master` before it reaches here; a caller
 * that passes raw stored names would under-report the role.
 *
 * It fails closed on a missing Campaign owner: a `null` or `undefined` `campaignGmUserId` is
 * never the GM, whatever roles the candidate holds.
 */
export function isCampaignGameMaster(input: {
  campaignGmUserId: string | null | undefined;
  userId: string;
  userRoles: readonly string[];
}): boolean {
  if (input.campaignGmUserId == null || input.campaignGmUserId !== input.userId) {
    return false;
  }

  return input.userRoles.includes("game_master");
}
