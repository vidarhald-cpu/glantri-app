"use client";

import { AdminWorkspaceTabs } from "../admin-ui";

export const skillsWorkspaceTabs = [
  { href: "/admin/skills", label: "Legacy Catalogue" },
  { href: "/admin/skills/reference", label: "Skill Reference" },
  { href: "/admin/skills/reference/system", label: "Skill System" },
  { href: "/admin/skills/reference/audit", label: "Reference Audit" },
  { href: "/admin/skills/matrix", label: "Matrix Audit" },
];

export default function SkillsWorkspaceTabs() {
  return <AdminWorkspaceTabs tabs={skillsWorkspaceTabs} />;
}
