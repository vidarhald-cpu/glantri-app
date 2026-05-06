import { describe, expect, it } from "vitest";

import { formatAuthRoleLabel, getPrimaryRole } from "./session";

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
