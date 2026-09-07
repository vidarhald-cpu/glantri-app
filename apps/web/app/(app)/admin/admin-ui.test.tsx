import { describe, expect, it, vi } from "vitest";

import { adminNavItems } from "./admin-ui";
import { skillsWorkspaceTabs } from "./skills/SkillsWorkspaceTabs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/skills"
}));

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

  it("labels the legacy skill workspace distinctly", () => {
    expect(adminNavItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/skills",
          label: "Legacy Catalogue"
        })
      ])
    );
    expect(adminNavItems).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/skills",
          label: "Skills"
        })
      ])
    );
  });

  it("shows Skill Reference in the skills workspace tabs", () => {
    expect(skillsWorkspaceTabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/admin/skills/reference",
          label: "Skill Reference"
        })
      ])
    );
  });
});
