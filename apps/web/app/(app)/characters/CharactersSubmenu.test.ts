import { describe, expect, it } from "vitest";

import { buildCharactersSubmenuItems } from "./CharactersSubmenu";

describe("CharactersSubmenu", () => {
  it("hides the GM-only edit action for non-GM users", () => {
    const items = buildCharactersSubmenuItems({
      currentCharacterId: "character-1",
      isGameMaster: false,
      pathname: "/characters/character-1",
    });

    expect(items.map((item) => item.label)).not.toContain("Edit Character");
  });

  it("shows the GM-only edit action for GMs", () => {
    const items = buildCharactersSubmenuItems({
      currentCharacterId: "character-1",
      isGameMaster: true,
      pathname: "/characters/character-1/edit",
    });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/characters/character-1/edit",
          isActive: true,
          label: "Edit Character",
        }),
      ]),
    );
  });

  it("shows a resume link on the browser page when a remembered character exists", () => {
    const items = buildCharactersSubmenuItems({
      currentCharacterId: null,
      isGameMaster: false,
      pathname: "/characters",
      rememberedCharacterId: "character-2",
    });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/characters/character-2",
          isActive: false,
          label: "Resume last character",
        }),
      ]),
    );
  });
});
