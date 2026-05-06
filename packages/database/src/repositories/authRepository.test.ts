import { describe, expect, it } from "vitest";

import { normalizeStoredAuthRole } from "./authRepository";

describe("authRepository role normalization", () => {
  it("maps legacy gm roles to game_master so session users keep GM access", () => {
    expect(normalizeStoredAuthRole("gm")).toBe("game_master");
  });

  it("keeps canonical auth roles intact", () => {
    expect(normalizeStoredAuthRole("player")).toBe("player");
    expect(normalizeStoredAuthRole("game_master")).toBe("game_master");
    expect(normalizeStoredAuthRole("admin")).toBe("admin");
  });

  it("drops unknown stored role names", () => {
    expect(normalizeStoredAuthRole("super_admin")).toBeNull();
  });
});
