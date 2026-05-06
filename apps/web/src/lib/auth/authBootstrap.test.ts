import { describe, expect, it } from "vitest";

import { canShowClaimGameMasterAction } from "./authBootstrap";

describe("auth bootstrap visibility", () => {
  it("shows the claim button only for logged-in non-privileged users while bootstrap is open", () => {
    expect(
      canShowClaimGameMasterAction({
        bootstrapAvailable: true,
        currentUser: {
          id: "user-1",
          email: "player@example.com",
          roles: ["player"],
        },
      }),
    ).toBe(true);
  });

  it("hides the claim button once a privileged user exists or the current user is already privileged", () => {
    expect(
      canShowClaimGameMasterAction({
        bootstrapAvailable: false,
        currentUser: {
          id: "user-1",
          email: "player@example.com",
          roles: ["player"],
        },
      }),
    ).toBe(false);

    expect(
      canShowClaimGameMasterAction({
        bootstrapAvailable: true,
        currentUser: {
          id: "user-2",
          email: "gm@example.com",
          roles: ["game_master"],
        },
      }),
    ).toBe(false);
  });
});
