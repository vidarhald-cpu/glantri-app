import { describe, expect, it, vi } from "vitest";

import {
  loadReadableCharacterInApi,
  projectCharacterForReadGrant,
  READ_GRANT_PROVENANCE_PERSPECTIVE,
} from "./characterReadAccess";

interface StubCharacter {
  id: string;
  owner: { displayName: string | null; email: string; id: string } | null;
  ownerId: string | null;
}

function stubCharacter(overrides?: Partial<StubCharacter>): StubCharacter {
  return {
    id: "character-1",
    owner: { displayName: "Owner", email: "owner@example.test", id: "owner-1" },
    ownerId: "owner-1",
    ...overrides,
  };
}

function createService(overrides?: {
  byId?: StubCharacter | null;
  gmCampaigns?: StubCharacter | null;
  owned?: StubCharacter | null;
  underControl?: StubCharacter | null;
}) {
  return {
    getCharacterById: vi.fn(async () => overrides?.byId ?? null),
    getCharacterByIdInGmCampaigns: vi.fn(async () => overrides?.gmCampaigns ?? null),
    getCharacterUnderPlayerControl: vi.fn(async () => overrides?.underControl ?? null),
    getOwnedCharacter: vi.fn(async () => overrides?.owned ?? null),
  };
}

describe("loadReadableCharacterInApi", () => {
  it("grants the owner read access without consulting control", async () => {
    const character = stubCharacter({ ownerId: "player-1" });
    const characterService = createService({ owned: character, underControl: character });

    const result = await loadReadableCharacterInApi({
      characterId: "character-1",
      characterService,
      user: { id: "player-1", roles: ["player"] },
    });

    expect(result).toEqual({ character, grant: "owner" });
    expect(characterService.getCharacterUnderPlayerControl).not.toHaveBeenCalled();
  });

  it("grants read access to a controller of a Character whose ownerId is null", async () => {
    const character = stubCharacter({ owner: null, ownerId: null });
    const characterService = createService({ underControl: character });

    const result = await loadReadableCharacterInApi({
      characterId: "character-1",
      characterService,
      user: { id: "player-1", roles: ["player"] },
    });

    expect(result).toEqual({ character, grant: "character_controller" });
    expect(characterService.getCharacterUnderPlayerControl).toHaveBeenCalledWith(
      "player-1",
      "character-1",
    );
  });

  it("grants read access to a controller of a Character owned by another user", async () => {
    const character = stubCharacter({ ownerId: "gm-1" });
    const characterService = createService({ underControl: character });

    const result = await loadReadableCharacterInApi({
      characterId: "character-1",
      characterService,
      user: { id: "player-1", roles: ["player"] },
    });

    expect(result).toEqual({ character, grant: "character_controller" });
  });

  it("denies a player who neither owns nor controls the Character", async () => {
    const characterService = createService();

    const result = await loadReadableCharacterInApi({
      characterId: "someone-elses-character",
      characterService,
      user: { id: "player-1", roles: ["player"] },
    });

    expect(result).toBeNull();
  });

  it("denies when control resolution returns nothing, so stale control cannot be inferred", async () => {
    const characterService = createService({ underControl: null });

    const result = await loadReadableCharacterInApi({
      characterId: "character-1",
      characterService,
      user: { id: "player-1", roles: ["player"] },
    });

    expect(result).toBeNull();
    expect(characterService.getCharacterUnderPlayerControl).toHaveBeenCalledOnce();
  });

  it("keeps the campaign GM grant for a GM-managed Character", async () => {
    const character = stubCharacter({ ownerId: "player-2" });
    const characterService = createService({ gmCampaigns: character });

    const result = await loadReadableCharacterInApi({
      characterId: "character-1",
      characterService,
      user: { id: "gm-1", roles: ["game_master"] },
    });

    expect(result).toEqual({ character, grant: "campaign_gm" });
    expect(characterService.getCharacterUnderPlayerControl).not.toHaveBeenCalled();
  });

  it("keeps the admin grant", async () => {
    const character = stubCharacter();
    const characterService = createService({ byId: character });

    const result = await loadReadableCharacterInApi({
      characterId: "character-1",
      characterService,
      user: { id: "admin-1", roles: ["admin"] },
    });

    expect(result).toEqual({ character, grant: "admin" });
    expect(characterService.getCharacterUnderPlayerControl).not.toHaveBeenCalled();
  });
});

describe("READ_GRANT_PROVENANCE_PERSPECTIVE", () => {
  it("projects a controller as entitled_player, never as a campaign GM or admin", () => {
    expect(READ_GRANT_PROVENANCE_PERSPECTIVE.character_controller).toBe("entitled_player");
    expect(READ_GRANT_PROVENANCE_PERSPECTIVE.owner).toBe("owner");
    expect(READ_GRANT_PROVENANCE_PERSPECTIVE.campaign_gm).toBe("current_campaign_gm");
    expect(READ_GRANT_PROVENANCE_PERSPECTIVE.admin).toBe("admin");
  });
});

describe("projectCharacterForReadGrant", () => {
  it("withholds the owner account block from a controller", () => {
    const character = stubCharacter({ ownerId: "gm-1" });

    expect(projectCharacterForReadGrant(character, "character_controller")).toEqual({
      ...character,
      owner: null,
    });
  });

  it("leaves owner, campaign GM and admin reads unchanged", () => {
    const character = stubCharacter();

    expect(projectCharacterForReadGrant(character, "owner")).toBe(character);
    expect(projectCharacterForReadGrant(character, "campaign_gm")).toBe(character);
    expect(projectCharacterForReadGrant(character, "admin")).toBe(character);
  });
});
