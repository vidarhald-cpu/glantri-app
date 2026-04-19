"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AdminContentProvider, useAdminContent } from "../../../src/lib/admin/AdminContentContext";
import { useCanAccessAdmin } from "../../../src/lib/auth/SessionUserContext";
import {
  adminNavGroups,
  AdminStatusBadge
} from "./admin-ui";

function findActiveSection(pathname: string): string {
  const activeGroup = adminNavGroups.find((group) =>
    group.items.some(
      (item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
    )
  );

  return activeGroup?.label ?? "Overview";
}

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const canEdit = useCanAccessAdmin();
  const {
    feedback,
    hasDraftChanges,
    hasLocalDraft,
    hasRevisionConflict,
    isLoading,
    isSaving,
    syncState
  } = useAdminContent();
  const activeSection = findActiveSection(pathname);
  const feedbackColor =
    syncState === "conflict" || syncState === "error"
      ? "#7f2f17"
      : syncState === "saving"
        ? "#7b5713"
        : syncState === "synced"
          ? "#2f6a44"
          : "#5f543a";

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
      <div style={{ display: "grid", gap: "1.25rem", margin: "0 auto", maxWidth: 1420 }}>
        <section
          style={{
            background: "rgba(254, 251, 245, 0.88)",
            border: "1px solid rgba(85, 73, 48, 0.14)",
            borderRadius: 28,
            boxShadow: "0 24px 60px rgba(73, 56, 29, 0.09)",
            display: "grid",
            gap: "1rem",
            padding: "1.25rem"
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "grid", gap: "0.25rem" }}>
              <strong style={{ color: "#2b2419", fontSize: "1.1rem" }}>Glantri Rules Admin</strong>
              <span style={{ color: "#5f543a", lineHeight: 1.5 }}>
                Grouped admin workspaces for content review, equipment reference, accounts, and workbook-backed rules documentation.
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <AdminStatusBadge tone={hasDraftChanges ? "warning" : "neutral"}>
                {hasDraftChanges ? "Unpublished draft changes" : "No unpublished draft delta"}
              </AdminStatusBadge>
              {hasLocalDraft ? (
                <AdminStatusBadge tone={hasRevisionConflict ? "danger" : "warning"}>
                  {hasRevisionConflict ? "Local draft has stale revision" : "Local draft preserved"}
                </AdminStatusBadge>
              ) : null}
              <AdminStatusBadge tone={canEdit ? "warning" : "neutral"}>
                {canEdit ? "Editing enabled" : "View-only access"}
              </AdminStatusBadge>
              <Link href="/">Back to app</Link>
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.85rem" }}>
            {adminNavGroups.map((group) => (
              <div key={group.label} style={{ display: "grid", gap: "0.45rem" }}>
                <div
                  style={{
                    color: group.label === activeSection ? "#7e5d2a" : "#6b5c3e",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase"
                  }}
                >
                  {group.label}
                </div>
                <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  {group.items.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

                    return (
                      <Link
                        href={item.href}
                        key={item.href}
                        style={{
                          background: active ? "#7e5d2a" : "rgba(126, 93, 42, 0.08)",
                          border: active
                            ? "1px solid transparent"
                            : "1px solid rgba(126, 93, 42, 0.14)",
                          borderRadius: 999,
                          color: active ? "#fffaf0" : "#594320",
                          padding: "0.65rem 0.9rem",
                          textDecoration: "none"
                        }}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          <div style={{ color: isLoading ? "#7b5713" : feedbackColor, minHeight: 24 }}>
            {isLoading
              ? "Loading server-backed rules content..."
              : `${isSaving ? "Saving to server... " : ""}${feedback ?? ""}`}
          </div>
          {!canEdit && !isLoading ? (
            <div style={{ color: "#5f543a" }}>
              You can browse the admin reference pages with a player account, but editing tools are
              hidden unless your role is Admin or GM.
            </div>
          ) : null}
        </section>

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
