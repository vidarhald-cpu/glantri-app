import type { AuthRole } from "./roles";

export function hasRole(userRoles: AuthRole[], requiredRole: AuthRole): boolean {
  return userRoles.includes(requiredRole);
}
