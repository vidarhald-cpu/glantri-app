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
