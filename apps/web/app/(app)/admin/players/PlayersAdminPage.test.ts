import { describe, expect, it } from "vitest";

import type { AuthUser } from "@glantri/auth";

import { getDisplayedUserRole } from "./PlayersAdminPage";

describe("PlayersAdminPage role display", () => {
  it("resolves GM when player and game_master are both present", () => {
    const user: AuthUser = {
      id: "user-1",
      email: "gm@example.com",
      displayName: "GM",
      roles: ["player", "game_master"],
    };

    expect(getDisplayedUserRole(user)).toBe("game_master");
  });

  it("resolves admin ahead of GM when both roles are present", () => {
    const user: AuthUser = {
      id: "user-2",
      email: "admin@example.com",
      displayName: "Admin",
      roles: ["player", "game_master", "admin"],
    };

    expect(getDisplayedUserRole(user)).toBe("admin");
  });
});
