import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { appNavigationLinks } from "./appNavigation";

describe("appNavigation", () => {
  it("includes auth in the shared top-line navigation", () => {
    expect(appNavigationLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/auth", label: "Auth" }),
        expect.objectContaining({ href: "/skills", label: "Skills" }),
        expect.objectContaining({ href: "/characters/resume", label: "Characters" }),
        expect.objectContaining({ href: "/campaigns", label: "Campaigns" }),
      ]),
    );
  });

  it("lets the shared navigation wrap on narrow screens", () => {
    const source = fs.readFileSync(path.join(__dirname, "AppHeader.module.css"), "utf-8");

    expect(source).toContain("flex-wrap: wrap");
  });
});
