"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/admin/societies",
    label: "Catalog Editor"
  },
  {
    href: "/admin/societies/matrix",
    label: "Matrix Audit"
  }
];

export default function SocietiesWorkspaceTabs() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;

        return (
          <Link
            href={tab.href}
            key={tab.href}
            style={{
              background: active ? "#7e5d2a" : "rgba(126, 93, 42, 0.08)",
              border: active
                ? "1px solid transparent"
                : "1px solid rgba(126, 93, 42, 0.14)",
              borderRadius: 999,
              color: active ? "#fffaf0" : "#594320",
              fontWeight: 700,
              padding: "0.65rem 0.95rem",
              textDecoration: "none"
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
