import { describe, expect, it } from "vitest";

import { equipmentViewerForAccessibleCharacter } from "./access";

describe("equipment viewer authorization", () => {
  it("projects admin and campaign GM access as full GM visibility", () => {
    expect(equipmentViewerForAccessibleCharacter({ roles: ["admin"] }, "character-1")).toEqual({
      kind: "gm",
    });
    expect(
      equipmentViewerForAccessibleCharacter({ roles: ["game_master"] }, "character-1"),
    ).toEqual({ kind: "gm" });
  });

  it("projects an accessible player's character as holder-only visibility", () => {
    expect(equipmentViewerForAccessibleCharacter({ roles: ["player"] }, "character-1")).toEqual({
      characterId: "character-1",
      kind: "holder",
    });
  });
});
