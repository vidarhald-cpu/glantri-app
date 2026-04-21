import { describe, expect, it, vi } from "vitest";

import {
  canEditCharacterInApi,
  loadAccessibleCharacterInApi
} from "./characterEditAccess";

describe("characterEditAccess", () => {
  it("allows GM users to edit characters through the server path", () => {
    expect(canEditCharacterInApi({ roles: ["game_master"] })).toBe(true);
  });

  it("allows admin users to edit characters through the server path", () => {
    expect(canEditCharacterInApi({ roles: ["admin"] })).toBe(true);
  });

  it("blocks normal players from the server edit path", () => {
    expect(canEditCharacterInApi({ roles: ["player"] })).toBe(false);
  });

  it("lets owners load their own character by id", async () => {
    const getCharacterById = vi.fn();
    const getOwnedCharacter = vi.fn().mockResolvedValue({ id: "character-1" });

    await expect(
      loadAccessibleCharacterInApi({
        characterId: "character-1",
        characterService: {
          getCharacterById,
          getOwnedCharacter
        },
        user: {
          id: "owner-1",
          roles: ["player"]
        }
      })
    ).resolves.toEqual({ id: "character-1" });

    expect(getOwnedCharacter).toHaveBeenCalledWith("owner-1", "character-1");
    expect(getCharacterById).not.toHaveBeenCalled();
  });

  it("blocks normal players from loading another player's character by id", async () => {
    const getCharacterById = vi.fn();
    const getOwnedCharacter = vi.fn().mockResolvedValue(null);

    await expect(
      loadAccessibleCharacterInApi({
        characterId: "character-2",
        characterService: {
          getCharacterById,
          getOwnedCharacter
        },
        user: {
          id: "player-1",
          roles: ["player"]
        }
      })
    ).resolves.toBeNull();

    expect(getOwnedCharacter).toHaveBeenCalledWith("player-1", "character-2");
    expect(getCharacterById).not.toHaveBeenCalled();
  });

  it("lets GM users load another player's character by id", async () => {
    const getCharacterById = vi.fn().mockResolvedValue({ id: "character-2" });
    const getOwnedCharacter = vi.fn();

    await expect(
      loadAccessibleCharacterInApi({
        characterId: "character-2",
        characterService: {
          getCharacterById,
          getOwnedCharacter
        },
        user: {
          id: "gm-1",
          roles: ["game_master"]
        }
      })
    ).resolves.toEqual({ id: "character-2" });

    expect(getCharacterById).toHaveBeenCalledWith("character-2");
    expect(getOwnedCharacter).not.toHaveBeenCalled();
  });

  it("lets admin users load another player's character by id", async () => {
    const getCharacterById = vi.fn().mockResolvedValue({ id: "character-3" });
    const getOwnedCharacter = vi.fn();

    await expect(
      loadAccessibleCharacterInApi({
        characterId: "character-3",
        characterService: {
          getCharacterById,
          getOwnedCharacter
        },
        user: {
          id: "admin-1",
          roles: ["admin"]
        }
      })
    ).resolves.toEqual({ id: "character-3" });

    expect(getCharacterById).toHaveBeenCalledWith("character-3");
    expect(getOwnedCharacter).not.toHaveBeenCalled();
  });
});
