import { describe, expect, it } from "vitest";

import { canEditCharacterInApi } from "./characterEditAccess";

describe("characterEditAccess", () => {
  it("allows GM users to edit characters through the server path", () => {
    expect(canEditCharacterInApi({ roles: ["game_master"] })).toBe(true);
  });

  it("blocks non-GM users from the server edit path", () => {
    expect(canEditCharacterInApi({ roles: ["player"] })).toBe(false);
    expect(canEditCharacterInApi({ roles: ["admin"] })).toBe(false);
  });
});
