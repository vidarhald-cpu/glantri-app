import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../lib/errors";
import { equipmentViewerForAccessibleCharacter, requireAccessibleCharacter } from "./access";

const characterId = "character-1";

function accessibleCharacterService(input: { managed?: boolean; owned?: boolean }) {
  const character = { id: characterId } as never;

  return {
    getCharacterById: vi.fn().mockResolvedValue(null),
    getCharacterByIdInGmCampaigns: vi.fn().mockResolvedValue(input.managed ? character : null),
    getOwnedCharacter: vi.fn().mockResolvedValue(input.owned ? character : null),
  };
}

describe("equipment viewer authorization", () => {
  it("projects admin and actual campaign GM access as full GM visibility", () => {
    expect(equipmentViewerForAccessibleCharacter({ roles: ["admin"] }, characterId, false)).toEqual(
      { kind: "gm" },
    );
    expect(
      equipmentViewerForAccessibleCharacter({ roles: ["game_master"] }, characterId, true),
    ).toEqual({ kind: "gm" });
  });

  it("does not derive GM visibility from the global role alone", () => {
    expect(
      equipmentViewerForAccessibleCharacter({ roles: ["game_master"] }, characterId, false),
    ).toEqual({
      characterId,
      kind: "holder",
    });
  });

  it("projects an accessible player's character as holder-only visibility", () => {
    expect(
      equipmentViewerForAccessibleCharacter({ roles: ["player"] }, characterId, false),
    ).toEqual({
      characterId,
      kind: "holder",
    });
  });

  it("keeps a global GM who owns but does not manage the Character at holder visibility", async () => {
    const service = accessibleCharacterService({ owned: true });

    await expect(
      requireAccessibleCharacter(
        { id: "global-gm-owner", roles: ["game_master"] },
        characterId,
        service,
      ),
    ).resolves.toEqual({ characterId, kind: "holder" });
    expect(service.getCharacterByIdInGmCampaigns).toHaveBeenCalledWith(
      "global-gm-owner",
      characterId,
    );
  });

  it("gives the managing Campaign GM full Item visibility", async () => {
    const service = accessibleCharacterService({ managed: true });

    await expect(
      requireAccessibleCharacter(
        { id: "campaign-gm", roles: ["game_master"] },
        characterId,
        service,
      ),
    ).resolves.toEqual({ kind: "gm" });
  });

  it("denies a global GM without ownership or Campaign authority", async () => {
    const service = accessibleCharacterService({});

    await expect(
      requireAccessibleCharacter(
        { id: "unrelated-global-gm", roles: ["game_master"] },
        characterId,
        service,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies an ordinary Campaign player who does not own the Character", async () => {
    const service = accessibleCharacterService({});

    await expect(
      requireAccessibleCharacter(
        { id: "campaign-player", roles: ["player"] },
        characterId,
        service,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(service.getCharacterByIdInGmCampaigns).not.toHaveBeenCalled();
  });
});
