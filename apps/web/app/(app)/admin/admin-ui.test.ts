import { describe, expect, it } from "vitest";

import { adminNavItems } from "./admin-ui";

describe("admin navigation", () => {
  it("uses Rules Docs as the documentation entry instead of the legacy Documents page", () => {
    expect(adminNavItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/rules-docs",
          label: "Rules Docs"
        })
      ])
    );
    expect(adminNavItems).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/documents",
          label: "Documents"
        })
      ])
    );
  });
});
