import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../lib/errors";
import {
  equipmentViewerForAccessibleCharacter,
  requireAccessibleCharacter,
  requireReadableCharacter,
} from "./access";

const characterId = "character-1";

function accessibleCharacterService(input: {
  controlled?: boolean;
  managed?: boolean;
  owned?: boolean;
}) {
  const character = { id: characterId } as never;

  return {
    getCharacterById: vi.fn().mockResolvedValue(null),
    getCharacterByIdInGmCampaigns: vi.fn().mockResolvedValue(input.managed ? character : null),
    getCharacterUnderPlayerControl: vi.fn().mockResolvedValue(input.controlled ? character : null),
    getOwnedCharacter: vi.fn().mockResolvedValue(input.owned ? character : null),
  };
}

describe("equipment viewer authorization", () => {
  it("projects only actual campaign GM access as full GM visibility", () => {
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

  it("denies an unrelated Admin instead of treating the technical role as gameplay authority", async () => {
    const service = accessibleCharacterService({});

    await expect(
      requireAccessibleCharacter({ id: "unrelated-admin", roles: ["admin"] }, characterId, service),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(service.getCharacterById).not.toHaveBeenCalled();
    expect(service.getCharacterByIdInGmCampaigns).not.toHaveBeenCalled();
    expect(service.getOwnedCharacter).toHaveBeenCalledWith("unrelated-admin", characterId);
  });

  it("keeps an Admin who owns the Character at holder-only visibility", async () => {
    const service = accessibleCharacterService({ owned: true });

    await expect(
      requireAccessibleCharacter({ id: "admin-owner", roles: ["admin"] }, characterId, service),
    ).resolves.toEqual({ characterId, kind: "holder" });
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

describe("equipment read access under current authorized control", () => {
  it("lets a controller who does not own the Character read it at holder visibility", async () => {
    const service = accessibleCharacterService({ controlled: true });

    await expect(
      requireReadableCharacter(
        { id: "controlling-player", roles: ["player"] },
        characterId,
        service,
      ),
    ).resolves.toEqual({ characterId, kind: "holder" });
    expect(service.getCharacterUnderPlayerControl).toHaveBeenCalledWith(
      "controlling-player",
      characterId,
    );
  });

  it("never escalates a controlling GM-role user to full GM Item visibility", async () => {
    const service = accessibleCharacterService({ controlled: true });

    await expect(
      requireReadableCharacter(
        { id: "controlling-global-gm", roles: ["game_master"] },
        characterId,
        service,
      ),
    ).resolves.toEqual({ characterId, kind: "holder" });
  });

  it("denies a player who neither owns nor controls the Character", async () => {
    const service = accessibleCharacterService({});

    await expect(
      requireReadableCharacter({ id: "unrelated-player", roles: ["player"] }, characterId, service),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not consult control when ownership already authorizes the read", async () => {
    const service = accessibleCharacterService({ controlled: true, owned: true });

    await expect(
      requireReadableCharacter({ id: "owner", roles: ["player"] }, characterId, service),
    ).resolves.toEqual({ characterId, kind: "holder" });
    expect(service.getCharacterUnderPlayerControl).not.toHaveBeenCalled();
  });

  it("keeps the managing Campaign GM at full Item visibility", async () => {
    const service = accessibleCharacterService({ managed: true });

    await expect(
      requireReadableCharacter({ id: "campaign-gm", roles: ["game_master"] }, characterId, service),
    ).resolves.toEqual({ kind: "gm" });
  });
});

describe("equipment write access is not widened by control", () => {
  it("still refuses the equipment write gate for control without ownership", async () => {
    const service = accessibleCharacterService({ controlled: true });

    await expect(
      requireAccessibleCharacter(
        { id: "controlling-player", roles: ["player"] },
        characterId,
        service,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(service.getCharacterUnderPlayerControl).not.toHaveBeenCalled();
  });
});
