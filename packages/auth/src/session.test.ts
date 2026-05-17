import { describe, expect, it } from "vitest";

import { formatAuthRoleLabel, getPrimaryRole, isAdmin } from "./session";

describe("isAdmin", () => {
  it("returns true only for admin role", () => {
    expect(isAdmin(["admin"])).toBe(true);
  });

  it("returns false for game_master", () => {
    expect(isAdmin(["game_master"])).toBe(false);
  });

  it("returns false for player", () => {
    expect(isAdmin(["player"])).toBe(false);
  });

  it("returns true when admin is present alongside other roles", () => {
    expect(isAdmin(["game_master", "admin"])).toBe(true);
  });
});

describe("auth session role helpers", () => {
  it("resolves legacy-style mixed player plus GM role arrays to GM as the primary role", () => {
    expect(getPrimaryRole(["player", "game_master"])).toBe("game_master");
    expect(formatAuthRoleLabel(getPrimaryRole(["player", "game_master"]))).toBe("GM");
  });

  it("keeps canonical game_master-only users on GM", () => {
    expect(getPrimaryRole(["game_master"])).toBe("game_master");
  });

  it("does not fall back to player when GM is present", () => {
    expect(getPrimaryRole(["player", "game_master", "player"])).toBe("game_master");
  });
});
