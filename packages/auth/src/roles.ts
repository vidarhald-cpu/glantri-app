export const authRoles = ["player", "game_master", "admin"] as const;

export type AuthRole = (typeof authRoles)[number];
