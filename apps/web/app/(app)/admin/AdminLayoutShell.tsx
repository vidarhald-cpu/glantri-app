"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AdminContentProvider } from "../../../src/lib/admin/AdminContentContext";
import { adminNavGroups } from "./admin-ui";

function findActiveSection(pathname: string): string {
  const activeGroup = adminNavGroups.find((group) =>
    group.items.some(
      (item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
    )
  );

  return activeGroup?.label ?? "Overview";
}

function findActiveGroupItems(pathname: string) {
  const activeGroup = adminNavGroups.find((group) =>
    group.items.some(
      (item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
    )
  );

  return activeGroup ?? adminNavGroups[0];
}

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeSection = findActiveSection(pathname);
  const activeGroup = findActiveGroupItems(pathname);
  const showChildTabs = activeGroup.items.length > 1;

  return (
    <div
      style={{
        background:
          "radial-gradient(circle at top left, rgba(231, 207, 164, 0.38), transparent 32%), linear-gradient(160deg, #f9f3e4 0%, #efe5d0 45%, #dce7df 100%)",
        minHeight: "calc(100vh - 72px)",
        margin: "-2rem -1.5rem",
        padding: "2rem 1.5rem 2.5rem"
      }}
    >
      <div style={{ display: "grid", gap: "0.85rem", margin: "0 auto", maxWidth: 1420 }}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "flex-end" }}>
          <Link href="/" style={{ color: "#594320", fontSize: "0.92rem", whiteSpace: "nowrap" }}>
            Back to app
          </Link>
        </div>

        <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {adminNavGroups.map((group) => {
            const active = group.label === activeSection;
            const targetHref = group.items[0]?.href ?? "/admin";

            return (
              <Link
                href={targetHref}
                key={group.label}
                style={{
                  background: active ? "#7e5d2a" : "rgba(126, 93, 42, 0.08)",
                  border: active
                    ? "1px solid transparent"
                    : "1px solid rgba(126, 93, 42, 0.14)",
                  borderRadius: 999,
                  color: active ? "#fffaf0" : "#594320",
                  padding: "0.7rem 1rem",
                  textDecoration: "none"
                }}
              >
                {group.label}
              </Link>
            );
          })}
        </nav>

        {showChildTabs ? (
          <div
            style={{
              borderBottom: "1px solid rgba(85, 73, 48, 0.12)",
              paddingBottom: "0.2rem"
            }}
          >
            <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
              {activeGroup.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    href={item.href}
                    key={item.href}
                    style={{
                      background: active ? "rgba(126, 93, 42, 0.16)" : "transparent",
                      border: "1px solid transparent",
                      borderRadius: 999,
                      color: "#594320",
                      padding: "0.55rem 0.85rem",
                      textDecoration: "none"
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}

export default function AdminLayoutShell({ children }: { children: ReactNode }) {
  return (
    <AdminContentProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminContentProvider>
  );
}
