"use client";

import { AdminWorkspaceTabs } from "../admin-ui";

export const skillsWorkspaceTabs = [
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/skills/reference", label: "Skill Reference" },
  { href: "/admin/skills/reference/system", label: "System Guide" },
  { href: "/admin/skills/reference/audit", label: "Technical Audit" },
  { href: "/admin/skills/matrix", label: "Matrix" },
];

export default function SkillsWorkspaceTabs() {
  return <AdminWorkspaceTabs tabs={skillsWorkspaceTabs} />;
}
