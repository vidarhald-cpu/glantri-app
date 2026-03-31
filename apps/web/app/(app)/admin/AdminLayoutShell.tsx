"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AdminContentProvider, useAdminContent } from "../../../src/lib/admin/AdminContentContext";
import {
  adminNavItems,
  AdminButton,
  AdminStatusBadge,
  formatAdminTimestamp
} from "./admin-ui";

function describeSource(source: "cached-database" | "database" | "seed"): string {
  if (source === "cached-database") {
    return "Cached database snapshot";
  }

  return source === "database" ? "Database snapshot" : "Seed content";
}

function describeSaveState(state: "conflict" | "failed" | "idle" | "saving" | "succeeded") {
  if (state === "saving") {
    return { label: "Save in progress", tone: "warning" as const };
  }

  if (state === "succeeded") {
    return { label: "Save succeeded", tone: "success" as const };
  }

  if (state === "conflict") {
    return { label: "Revision conflict", tone: "danger" as const };
  }

  if (state === "failed") {
    return { label: "Save failed", tone: "danger" as const };
  }

  return { label: "Ready", tone: "neutral" as const };
}

function buildRecoveryMessage(options: {
  hasDraftChanges: boolean;
  hasLocalDraft: boolean;
  hasRevisionConflict: boolean;
  lastSaveFailed: boolean;
  publishedRevision: number;
  revision: number;
}) {
  if (options.hasRevisionConflict) {
    return `The server published revision ${options.publishedRevision} while your attempted save stayed local as draft revision ${options.revision}.`;
  }

  if (options.lastSaveFailed && options.hasLocalDraft) {
    return `The last save did not reach the server. Your attempted changes were preserved locally as a Dexie draft against revision ${options.revision}.`;
  }

  if (options.hasDraftChanges) {
    return `A preserved local draft differs from the published server content at revision ${options.publishedRevision}.`;
  }

  if (options.hasLocalDraft) {
    return "A local admin draft is loaded and matches the latest published revision.";
  }

  return undefined;
}

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    discardLocalDraft,
    feedback,
    hasDraftChanges,
    hasLocalDraft,
    hasRevisionConflict,
    isLoading,
    isSaving,
    keepLocalDraft,
    lastDraftSavedAt,
    lastPublishedUpdatedAt,
    lastSaveFailed,
    lastSaveState,
    loadedSource,
    publishedRevision,
    reloadFromServer,
    revision,
    syncState
  } = useAdminContent();
  const saveState = describeSaveState(lastSaveState);
  const recoveryMessage = buildRecoveryMessage({
    hasDraftChanges,
    hasLocalDraft,
    hasRevisionConflict,
    lastSaveFailed,
    publishedRevision,
    revision
  });
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
                Server-backed rules content with preserved local drafts for failed saves and
                revision conflicts.
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <AdminButton
                disabled={isLoading || isSaving}
                onClick={() => void reloadFromServer()}
                variant="ghost"
              >
                Reload Latest Server Content
              </AdminButton>
              {hasLocalDraft ? (
                <AdminButton disabled={isLoading || isSaving} onClick={keepLocalDraft} variant="secondary">
                  Keep Local Draft
                </AdminButton>
              ) : null}
              {hasLocalDraft ? (
                <AdminButton
                  disabled={isLoading || isSaving}
                  onClick={() => void discardLocalDraft()}
                  variant="ghost"
                >
                  Discard Local Draft
                </AdminButton>
              ) : null}
              <Link href="/">Back to app</Link>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <AdminStatusBadge>{describeSource(loadedSource)}</AdminStatusBadge>
            <AdminStatusBadge tone={saveState.tone}>{saveState.label}</AdminStatusBadge>
            <AdminStatusBadge tone={hasDraftChanges ? "warning" : "neutral"}>
              {hasDraftChanges ? "Draft differs from published" : "No unpublished draft delta"}
            </AdminStatusBadge>
            {hasLocalDraft ? (
              <AdminStatusBadge tone={hasRevisionConflict ? "danger" : "warning"}>
                {hasRevisionConflict ? "Draft has stale revision" : "Local draft preserved"}
              </AdminStatusBadge>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
            }}
          >
            <div
              style={{
                background: "rgba(255, 252, 245, 0.72)",
                border: "1px solid rgba(85, 73, 48, 0.1)",
                borderRadius: 18,
                display: "grid",
                gap: "0.25rem",
                padding: "0.9rem"
              }}
            >
              <span
                style={{
                  color: "#776b52",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase"
                }}
              >
                Published Source
              </span>
              <strong style={{ color: "#2b2419" }}>{describeSource(loadedSource)}</strong>
              <span style={{ color: "#5f543a" }}>Revision {publishedRevision}</span>
            </div>
            <div
              style={{
                background: "rgba(255, 252, 245, 0.72)",
                border: "1px solid rgba(85, 73, 48, 0.1)",
                borderRadius: 18,
                display: "grid",
                gap: "0.25rem",
                padding: "0.9rem"
              }}
            >
              <span
                style={{
                  color: "#776b52",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase"
                }}
              >
                Working Revision
              </span>
              <strong style={{ color: "#2b2419" }}>{revision}</strong>
              <span style={{ color: "#5f543a" }}>
                {hasLocalDraft ? "Local draft base revision" : "Matches published content"}
              </span>
            </div>
            <div
              style={{
                background: "rgba(255, 252, 245, 0.72)",
                border: "1px solid rgba(85, 73, 48, 0.1)",
                borderRadius: 18,
                display: "grid",
                gap: "0.25rem",
                padding: "0.9rem"
              }}
            >
              <span
                style={{
                  color: "#776b52",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase"
                }}
              >
                Last Published Update
              </span>
              <strong style={{ color: "#2b2419" }}>
                {formatAdminTimestamp(lastPublishedUpdatedAt)}
              </strong>
              <span style={{ color: "#5f543a" }}>Server snapshot timestamp</span>
            </div>
            <div
              style={{
                background: "rgba(255, 252, 245, 0.72)",
                border: "1px solid rgba(85, 73, 48, 0.1)",
                borderRadius: 18,
                display: "grid",
                gap: "0.25rem",
                padding: "0.9rem"
              }}
            >
              <span
                style={{
                  color: "#776b52",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase"
                }}
              >
                Local Draft State
              </span>
              <strong style={{ color: "#2b2419" }}>
                {hasLocalDraft ? "Present in Dexie" : "No preserved draft"}
              </strong>
              <span style={{ color: "#5f543a" }}>
                Saved locally: {formatAdminTimestamp(lastDraftSavedAt)}
              </span>
            </div>
          </div>

          {recoveryMessage ? (
            <div
              style={{
                background:
                  hasRevisionConflict || lastSaveFailed
                    ? "rgba(164, 69, 38, 0.08)"
                    : "rgba(163, 108, 23, 0.08)",
                border:
                  hasRevisionConflict || lastSaveFailed
                    ? "1px solid rgba(164, 69, 38, 0.16)"
                    : "1px solid rgba(163, 108, 23, 0.16)",
                borderRadius: 18,
                display: "grid",
                gap: "0.7rem",
                padding: "0.95rem 1rem"
              }}
            >
              <div style={{ display: "grid", gap: "0.25rem" }}>
                <strong style={{ color: "#2b2419" }}>
                  {hasRevisionConflict
                    ? "Revision conflict recovery"
                    : lastSaveFailed
                      ? "Save failure recovery"
                      : "Local draft status"}
                </strong>
                <span style={{ color: "#5f543a", lineHeight: 1.5 }}>{recoveryMessage}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <AdminButton
                  disabled={isLoading || isSaving}
                  onClick={() => void reloadFromServer()}
                  variant="ghost"
                >
                  Reload Latest Server Content
                </AdminButton>
                <AdminButton disabled={isLoading || isSaving} onClick={keepLocalDraft} variant="secondary">
                  Keep Local Draft
                </AdminButton>
                <AdminButton
                  disabled={isLoading || isSaving}
                  onClick={() => void discardLocalDraft()}
                  variant="ghost"
                >
                  Discard Local Draft
                </AdminButton>
              </div>
            </div>
          ) : null}

          <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {adminNavItems.map((item) => {
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

          <div style={{ color: isLoading ? "#7b5713" : feedbackColor, minHeight: 24 }}>
            {isLoading
              ? "Loading server-backed rules content..."
              : `${isSaving ? "Saving to server... " : ""}${feedback ?? ""}`}
          </div>
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
