import { describe, expect, it, vi } from "vitest";

import { adminNavItems } from "./admin-ui";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/skills/reference",
}));

describe("admin navigation", () => {
  it("uses Rules Docs as the documentation entry instead of the legacy Documents page", () => {
    expect(adminNavItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/rules-docs",
          label: "Rules Docs",
        }),
      ]),
    );
    expect(adminNavItems).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/documents",
          label: "Documents",
        }),
      ]),
    );
  });

  it("routes competency navigation to the V2 reference", () => {
    expect(adminNavItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/skills/reference",
          label: "Competency Reference",
        }),
      ]),
    );
    expect(adminNavItems).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/skills",
        }),
      ]),
    );
  });
});
