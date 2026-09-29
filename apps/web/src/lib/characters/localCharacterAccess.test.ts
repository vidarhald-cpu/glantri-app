import { describe, expect, it } from "vitest";

import type { AuthUser } from "@glantri/auth";
import type { LocalCharacterRecord } from "../offline/glantriDexie";

import { canPresentRetainedLocalCharacter } from "./localCharacterAccess";

describe("canPresentRetainedLocalCharacter", () => {
  const record = { creatorId: "owner-1" } as LocalCharacterRecord;

  function user(id: string, roles: AuthUser["roles"]): AuthUser {
    return { email: `${id}@example.com`, id, roles };
  }

  it("preserves owner, owning-GM, and admin access while denying an unrelated GM", () => {
    expect(
      canPresentRetainedLocalCharacter({
        currentUser: user("owner-1", ["player"]),
        hasServerAccess: false,
        record,
      }),
    ).toBe(true);
    expect(
      canPresentRetainedLocalCharacter({
        currentUser: user("owning-gm", ["game_master"]),
        hasServerAccess: true,
        record,
      }),
    ).toBe(true);
    expect(
      canPresentRetainedLocalCharacter({
        currentUser: user("other-gm", ["game_master"]),
        hasServerAccess: false,
        record,
      }),
    ).toBe(false);
    expect(
      canPresentRetainedLocalCharacter({
        currentUser: user("admin-1", ["admin"]),
        hasServerAccess: false,
        record,
      }),
    ).toBe(true);
  });

  it("admits a controlling player that the server authorized, and still denies one it did not", () => {
    // Forgejo #439: the browser gate defers to server read authorization, so widening the
    // server read gate to accept current authorized control needs no separate client rule.
    expect(
      canPresentRetainedLocalCharacter({
        currentUser: user("controlling-player", ["player"]),
        hasServerAccess: true,
        record,
      }),
    ).toBe(true);
    expect(
      canPresentRetainedLocalCharacter({
        currentUser: user("controlling-player", ["player"]),
        hasServerAccess: false,
        record,
      }),
    ).toBe(false);
  });
});
