import { describe, expect, it } from "vitest";

import { formatAuthRoleLabel, getPrimaryRole, isAdmin, isCampaignGameMaster } from "./session";

describe("isAdmin", () => {
  it("returns true only for admin role", () => {
    expect(isAdmin(["admin"])).toBe(true);
  });

  it("returns false for game_master", () => {
    expect(isAdmin(["game_master"])).toBe(false);
  });

  it("returns false for player", () => {
    expect(isAdmin(["player"])).toBe(false);
  });

  it("returns true when admin is present alongside other roles", () => {
    expect(isAdmin(["game_master", "admin"])).toBe(true);
  });
});

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

/**
 * Forgejo issue #977. Product Owner ruling, 2026-11-06, verbatim:
 *
 * > use the same GM predicate everywhere — Campaign.gmUserId and current game_master role. A
 * > demoted account loses GM exemptions.
 *
 * Both halves are asserted as necessary, separately, so a predicate that silently dropped
 * either one would fail here rather than only at the two call sites.
 */
describe("isCampaignGameMaster (#977)", () => {
  const userId = "user-1";

  it("is true only for the Campaign owner who currently holds game_master", () => {
    expect(
      isCampaignGameMaster({ campaignGmUserId: userId, userId, userRoles: ["game_master"] }),
    ).toBe(true);
    expect(
      isCampaignGameMaster({
        campaignGmUserId: userId,
        userId,
        userRoles: ["player", "game_master"],
      }),
    ).toBe(true);
    expect(
      isCampaignGameMaster({
        campaignGmUserId: userId,
        userId,
        userRoles: ["admin", "game_master"],
      }),
    ).toBe(true);
  });

  it("is false for the Campaign owner without the role, which is the demotion the ruling names", () => {
    expect(isCampaignGameMaster({ campaignGmUserId: userId, userId, userRoles: ["player"] })).toBe(
      false,
    );
  });

  it("is false for an admin-only Campaign owner, because admin is not a super-GM class", () => {
    expect(isCampaignGameMaster({ campaignGmUserId: userId, userId, userRoles: ["admin"] })).toBe(
      false,
    );
  });

  it("is false for the Campaign owner with no roles at all", () => {
    expect(isCampaignGameMaster({ campaignGmUserId: userId, userId, userRoles: [] })).toBe(false);
  });

  it("is false for a game_master who is not this Campaign's owner", () => {
    expect(
      isCampaignGameMaster({
        campaignGmUserId: "user-other",
        userId,
        userRoles: ["game_master"],
      }),
    ).toBe(false);
  });

  it("fails closed when the Campaign owner is unknown", () => {
    expect(
      isCampaignGameMaster({ campaignGmUserId: null, userId, userRoles: ["game_master"] }),
    ).toBe(false);
    expect(
      isCampaignGameMaster({ campaignGmUserId: undefined, userId, userRoles: ["game_master"] }),
    ).toBe(false);
  });

  it("does not accept the legacy stored role name, which callers normalize before this point", () => {
    expect(isCampaignGameMaster({ campaignGmUserId: userId, userId, userRoles: ["gm"] })).toBe(
      false,
    );
  });
});
