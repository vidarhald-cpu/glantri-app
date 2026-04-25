import { describe, expect, it } from "vitest";

import { appNavigationLinks } from "./appNavigation";

describe("appNavigation", () => {
  it("includes auth in the shared top-line navigation", () => {
    expect(appNavigationLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/auth", label: "Auth" }),
        expect.objectContaining({ href: "/characters/resume", label: "Characters" }),
        expect.objectContaining({ href: "/campaigns/resume", label: "Campaigns" }),
      ]),
    );
  });
});
