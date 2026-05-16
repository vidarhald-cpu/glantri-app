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
    const getCharacterByIdInGmCampaigns = vi.fn();
    const getOwnedCharacter = vi.fn().mockResolvedValue({ id: "character-1" });

    await expect(
      loadAccessibleCharacterInApi({
        characterId: "character-1",
        characterService: {
          getCharacterById,
          getCharacterByIdInGmCampaigns,
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
    expect(getCharacterByIdInGmCampaigns).not.toHaveBeenCalled();
  });

  it("blocks normal players from loading another player's character by id", async () => {
    const getCharacterById = vi.fn();
    const getCharacterByIdInGmCampaigns = vi.fn();
    const getOwnedCharacter = vi.fn().mockResolvedValue(null);

    await expect(
      loadAccessibleCharacterInApi({
        characterId: "character-2",
        characterService: {
          getCharacterById,
          getCharacterByIdInGmCampaigns,
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
    expect(getCharacterByIdInGmCampaigns).not.toHaveBeenCalled();
  });

  it("lets GM users load a character in their own campaign by id", async () => {
    const getCharacterById = vi.fn();
    const getCharacterByIdInGmCampaigns = vi.fn().mockResolvedValue({ id: "character-2" });
    const getOwnedCharacter = vi.fn();

    await expect(
      loadAccessibleCharacterInApi({
        characterId: "character-2",
        characterService: {
          getCharacterById,
          getCharacterByIdInGmCampaigns,
          getOwnedCharacter
        },
        user: {
          id: "gm-1",
          roles: ["game_master"]
        }
      })
    ).resolves.toEqual({ id: "character-2" });

    expect(getCharacterByIdInGmCampaigns).toHaveBeenCalledWith("gm-1", "character-2");
    expect(getCharacterById).not.toHaveBeenCalled();
    expect(getOwnedCharacter).not.toHaveBeenCalled();
  });

  it("blocks GM users from loading a character outside their campaigns", async () => {
    const getCharacterById = vi.fn();
    const getCharacterByIdInGmCampaigns = vi.fn().mockResolvedValue(null);
    const getOwnedCharacter = vi.fn();

    await expect(
      loadAccessibleCharacterInApi({
        characterId: "character-99",
        characterService: {
          getCharacterById,
          getCharacterByIdInGmCampaigns,
          getOwnedCharacter
        },
        user: {
          id: "gm-1",
          roles: ["game_master"]
        }
      })
    ).resolves.toBeNull();

    expect(getCharacterByIdInGmCampaigns).toHaveBeenCalledWith("gm-1", "character-99");
    expect(getCharacterById).not.toHaveBeenCalled();
    expect(getOwnedCharacter).not.toHaveBeenCalled();
  });

  it("lets admin users load any character by id", async () => {
    const getCharacterById = vi.fn().mockResolvedValue({ id: "character-3" });
    const getCharacterByIdInGmCampaigns = vi.fn();
    const getOwnedCharacter = vi.fn();

    await expect(
      loadAccessibleCharacterInApi({
        characterId: "character-3",
        characterService: {
          getCharacterById,
          getCharacterByIdInGmCampaigns,
          getOwnedCharacter
        },
        user: {
          id: "admin-1",
          roles: ["admin"]
        }
      })
    ).resolves.toEqual({ id: "character-3" });

    expect(getCharacterById).toHaveBeenCalledWith("character-3");
    expect(getCharacterByIdInGmCampaigns).not.toHaveBeenCalled();
    expect(getOwnedCharacter).not.toHaveBeenCalled();
  });
});
